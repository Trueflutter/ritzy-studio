import assert from "node:assert/strict";

import { fetchRemoteImage } from "./render-images";

// fetchRemoteImage's contract: policy refusals, HTTP failures, redirect escapes, and
// mid-body errors all return null (never throw), so one bad reference degrades to
// "no image" instead of failing a whole render or sourcing operation.

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example-project.supabase.co";

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01, 0x02, 0x03]);

type Route = {
  status: number;
  headers?: Record<string, string>;
  body?: Buffer | "stream-error";
};

function mockFetch(routes: Record<string, Route>) {
  const seen: string[] = [];
  const impl = async (input: string | URL) => {
    const url = String(input);
    seen.push(url);
    const route = routes[url];
    if (!route) {
      throw new Error(`no mock for ${url}`);
    }
    const headers = route.headers ?? {};
    let body: ReadableStream<Uint8Array> | null = null;
    if (route.body === "stream-error") {
      body = new ReadableStream<Uint8Array>({
        pull() {
          throw new Error("ECONNRESET mid-body");
        }
      });
    } else if (route.body) {
      const bytes = route.body;
      body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(bytes));
          controller.close();
        }
      });
    }
    return {
      status: route.status,
      ok: route.status >= 200 && route.status < 300,
      headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
      body
    } as unknown as Response;
  };
  return { impl, seen };
}

async function main() {
  // Policy refusal: non-allowlisted host returns null without any fetch.
  {
    const { impl, seen } = mockFetch({});
    const result = await fetchRemoteImage("https://evil.example.com/a.jpg", impl);
    assert.equal(result, null);
    assert.equal(seen.length, 0);
  }

  // Success: allowlisted host serves an image within caps.
  {
    const { impl } = mockFetch({
      "https://media.homecentre.com/ok.jpg": {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": String(JPEG_BYTES.length) },
        body: JPEG_BYTES
      }
    });
    const result = await fetchRemoteImage("https://media.homecentre.com/ok.jpg", impl);
    assert.ok(result);
    assert.equal(result?.mimeType, "image/jpeg");
    assert.equal(result?.bytes.length, JPEG_BYTES.length);
  }

  // Mid-body stream error returns null, never throws (the retry also nulls).
  {
    const { impl } = mockFetch({
      "https://media.homecentre.com/reset.jpg": {
        status: 200,
        headers: { "content-type": "image/jpeg" },
        body: "stream-error"
      }
    });
    const result = await fetchRemoteImage("https://media.homecentre.com/reset.jpg", impl);
    assert.equal(result, null);
  }

  // Redirect to a non-allowlisted target returns null and never fetches the target.
  {
    const { impl, seen } = mockFetch({
      "https://media.homecentre.com/moved.jpg": {
        status: 302,
        headers: { location: "https://evil.example.com/steal.jpg" }
      }
    });
    const result = await fetchRemoteImage("https://media.homecentre.com/moved.jpg", impl);
    assert.equal(result, null);
    assert.ok(!seen.some((u) => u.includes("evil.example.com")));
  }

  // The 2XL resize params are stripped before the fetch (Phase 0 fix at this layer too).
  {
    const { impl, seen } = mockFetch({
      "https://2xlhome.com/media/catalog/product/rug.jpg": {
        status: 200,
        headers: { "content-type": "image/jpeg" },
        body: JPEG_BYTES
      }
    });
    const result = await fetchRemoteImage(
      "https://2xlhome.com/media/catalog/product/rug.jpg?width=600&height=492&canvas=",
      impl
    );
    assert.ok(result);
    assert.ok(seen.every((u) => !u.includes("width=600")));
  }



  console.log("render-images tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
