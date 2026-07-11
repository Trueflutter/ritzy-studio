import assert from "node:assert/strict";

import {
  buildProductImagePreflightGate,
  preflightProductCandidateImages,
  validateProductImageUrlForAi
} from "./product-image-preflight";

const okImage = new Response(null, {
  status: 206,
  headers: {
    "content-type": "image/jpeg",
    "content-range": "bytes 0-0/1024"
  }
});

const fetcherFor = (responses: Record<string, Response | Error>) =>
  (async (url: string) => {
    const response = responses[url];
    if (!response) {
      throw new Error(`Unexpected URL ${url}`);
    }
    if (response instanceof Error) {
      throw response;
    }
    return response;
  }) as typeof fetch;

async function run() {
  assert.deepEqual(
    await validateProductImageUrlForAi("https://retailer.example/product.jpg", {
      fetcher: fetcherFor({
        "https://retailer.example/product.jpg": okImage.clone()
      })
    }),
    { status: "accepted" }
  );

  assert.deepEqual(await validateProductImageUrlForAi("ftp://retailer.example/product.jpg"), {
    status: "rejected",
    reason: "invalid_url"
  });

  assert.deepEqual(await validateProductImageUrlForAi("not a retailer URL"), {
    status: "rejected",
    reason: "invalid_url"
  });

  assert.deepEqual(await validateProductImageUrlForAi("https://retailer.example/product.svg"), {
    status: "rejected",
    reason: "unsupported_extension"
  });

  assert.deepEqual(
    await validateProductImageUrlForAi("https://retailer.example/product", {
      fetcher: fetcherFor({
        "https://retailer.example/product": new Response("<html></html>", {
          status: 200,
          headers: { "content-type": "text/html" }
        })
      })
    }),
    { status: "rejected", reason: "unsupported_mime" }
  );

  assert.deepEqual(
    await validateProductImageUrlForAi("https://retailer.example/missing.jpg", {
      fetcher: fetcherFor({
        "https://retailer.example/missing.jpg": new Response(null, {
          status: 404,
          headers: { "content-type": "image/jpeg" }
        })
      })
    }),
    { status: "rejected", reason: "non_ok_status" }
  );

  assert.deepEqual(
    await validateProductImageUrlForAi("https://retailer.example/large.jpg", {
      maxBytes: 10,
      fetcher: fetcherFor({
        "https://retailer.example/large.jpg": new Response(null, {
          status: 200,
          headers: {
            "content-type": "image/webp",
            "content-length": "11"
          }
        })
      })
    }),
    { status: "rejected", reason: "too_large" }
  );

  assert.deepEqual(
    await validateProductImageUrlForAi("https://retailer.example/timeout.jpg", {
      timeoutMs: 5,
      fetcher: (async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        })) as typeof fetch
    }),
    { status: "rejected", reason: "timeout" }
  );

  assert.deepEqual(
    await validateProductImageUrlForAi("https://retailer.example/broken-cdn.jpg", {
      fetcher: fetcherFor({
        "https://retailer.example/broken-cdn.jpg": new Error("socket hang up")
      })
    }),
    { status: "rejected", reason: "fetch_failed" }
  );

  const preflight = await preflightProductCandidateImages(
    [
      {
        id: "good",
        name: "Good image",
        primaryImageUrl: "https://retailer.example/good.jpg"
      },
      {
        id: "bad-html",
        name: "HTML instead of image",
        primaryImageUrl: "https://retailer.example/bad-html.jpg"
      },
      {
        id: "bad-extension",
        name: "Unsupported extension",
        primaryImageUrl: "https://retailer.example/bad.avif"
      },
      {
        id: "no-image",
        name: "No image",
        primaryImageUrl: null
      }
    ],
    {
      fetcher: fetcherFor({
        "https://retailer.example/good.jpg": okImage.clone(),
        "https://retailer.example/bad-html.jpg": new Response("<html></html>", {
          status: 200,
          headers: { "content-type": "text/html" }
        })
      })
    }
  );

  assert.deepEqual(preflight.summary, {
    checkedCount: 3,
    acceptedCount: 1,
    rejectedCount: 2,
    skippedCount: 0,
    rejectionReasons: {
      unsupported_mime: 1,
      unsupported_extension: 1
    }
  });
  assert.deepEqual(preflight.acceptedCandidateIds, ["good"]);
  assert.equal(preflight.candidates[0]?.primaryImageUrl, "https://retailer.example/good.jpg");
  assert.equal(preflight.candidates[1]?.primaryImageUrl, null);
  assert.equal(preflight.candidates[1]?.name, "HTML instead of image");
  assert.equal(preflight.candidates[2]?.primaryImageUrl, null);
  assert.equal(preflight.candidates[3]?.primaryImageUrl, null);

  // Wall-clock budget: an already-spent budget skips every fetch. Skipped candidates with an
  // image are passed through optimistically (kept + counted usable) so a slow CDN can never
  // block a required role; a null-image candidate stays missing (not counted usable).
  const budgetSpent = await preflightProductCandidateImages(
    [
      { id: "slow-1", primaryImageUrl: "https://retailer.example/slow-1.jpg" },
      { id: "slow-2", primaryImageUrl: "https://retailer.example/slow-2.jpg" },
      { id: "no-image", primaryImageUrl: null }
    ],
    {
      budgetMs: -1,
      fetcher: (async () => {
        throw new Error("preflight must not fetch once the budget is spent");
      }) as typeof fetch
    }
  );

  assert.deepEqual(budgetSpent.summary, {
    checkedCount: 0,
    acceptedCount: 0,
    rejectedCount: 0,
    skippedCount: 2,
    rejectionReasons: {}
  });
  assert.deepEqual(budgetSpent.acceptedCandidateIds, ["slow-1", "slow-2"]);
  assert.equal(budgetSpent.candidates[0]?.primaryImageUrl, "https://retailer.example/slow-1.jpg");
  assert.equal(budgetSpent.candidates[1]?.primaryImageUrl, "https://retailer.example/slow-2.jpg");
  assert.equal(budgetSpent.candidates[2]?.primaryImageUrl, null);

  // A required role whose only candidate was skipped on budget still reads as usable.
  assert.equal(
    buildProductImagePreflightGate({
      candidateCount: 2,
      acceptedCandidateIds: budgetSpent.acceptedCandidateIds,
      rolePools: [
        {
          role: { label: "Sofa", priority: "required" },
          candidates: [{ id: "slow-1" }]
        }
      ]
    }).usable,
    true
  );

  assert.deepEqual(
    buildProductImagePreflightGate({
      candidateCount: 4,
      acceptedCandidateIds: ["sofa-1", "rug-1"],
      rolePools: [
        {
          role: { label: "Sofa", priority: "required" },
          candidates: [{ id: "sofa-1" }]
        },
        {
          role: { label: "Media Console", priority: "required" },
          candidates: [{ id: "console-1" }]
        },
        {
          role: { label: "Rug", priority: "supporting" },
          candidates: [{ id: "rug-1" }]
        }
      ]
    }),
    {
      usable: false,
      minAcceptedCount: 2,
      requiredRolesWithoutAcceptedImage: ["Media Console"]
    }
  );

  assert.equal(
    buildProductImagePreflightGate({
      candidateCount: 4,
      acceptedCandidateIds: ["sofa-1", "console-1"],
      rolePools: [
        {
          role: { label: "Sofa", priority: "required" },
          candidates: [{ id: "sofa-1" }]
        },
        {
          role: { label: "Media Console", priority: "required" },
          candidates: [{ id: "console-1" }]
        }
      ]
    }).usable,
    true
  );

  assert.deepEqual(
    buildProductImagePreflightGate({
      candidateCount: 2,
      acceptedCandidateIds: ["one"],
      rolePools: []
    }),
    {
      usable: false,
      minAcceptedCount: 2,
      requiredRolesWithoutAcceptedImage: []
    }
  );
}

run().catch((error) => {
  throw error;
});
