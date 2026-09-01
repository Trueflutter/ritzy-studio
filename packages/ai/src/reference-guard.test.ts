import assert from "node:assert/strict";

import {
  buildReferenceHostAllowlist,
  checkReferenceImageUrl,
  preflightReferenceImage,
  sanitizeReferenceImageUrl
} from "./reference-guard";

const allowlist = buildReferenceHostAllowlist({
  supabaseUrl: "https://baevldudfqfnzczbvooz.supabase.co"
});

// --- sanitizeReferenceImageUrl -------------------------------------------------

// The Phase 0 outage: 2XL Magento resize params fail Evolink tasks with "Invalid parameters".
assert.equal(
  sanitizeReferenceImageUrl(
    "https://2xlhome.com/media/catalog/product/o/l/olaf-looselay-rug-brown-grey-200x290-cm_1.jpg?width=600&height=492&canvas="
  ),
  "https://2xlhome.com/media/catalog/product/o/l/olaf-looselay-rug-brown-grey-200x290-cm_1.jpg"
);

// Non-broken hosts keep their query strings (Home Centre's cache-busting ?v=1 is harmless).
assert.equal(
  sanitizeReferenceImageUrl("https://media.homecentre.com/i/homecentre/165795903.jpg?v=1"),
  "https://media.homecentre.com/i/homecentre/165795903.jpg?v=1"
);

// Data URLs and garbage pass through untouched.
assert.equal(sanitizeReferenceImageUrl("data:image/jpeg;base64,abc"), "data:image/jpeg;base64,abc");
assert.equal(sanitizeReferenceImageUrl("not a url"), "not a url");

// --- checkReferenceImageUrl ----------------------------------------------------

// The exact reference list from the captured Phase 0 failing payload, post-sanitize, all pass.
const phase0Refs = [
  "https://baevldudfqfnzczbvooz.supabase.co/storage/v1/object/sign/room-assets/a/b/c.jpg?token=x",
  "https://media.chattelsandmore.com/catalog/product/2026-01-20/1768904493_FCM01OLTA0154.webp",
  "https://media.homecentre.com/i/homecentre/165795903-165795903-HC18102023_01-2100.jpg?v=1",
  "https://2xlhome.com/media/catalog/product/o/l/olaf-looselay-rug-brown-grey-200x290-cm_1.jpg",
  "https://assets.danubehome.com/media/catalog/product/x.jpg",
  "https://mp-sellers-files.danubehome.com/products/y.webp",
  "https://cdn.media.amplience.net/i/homecentre/z.jpg"
];
for (const url of phase0Refs) {
  const verdict = checkReferenceImageUrl(url, allowlist);
  assert.equal(verdict.ok, true, `expected pass for ${url}: ${"reason" in verdict ? verdict.reason : ""}`);
}

// Private, loopback, and link-local targets are refused regardless of allowlist contents.
const privateTargets = [
  "http://localhost/img.jpg",
  "http://127.0.0.1/img.jpg",
  "http://10.0.0.8/a.png",
  "http://172.16.4.2/a.png",
  "http://192.168.1.10/a.png",
  "http://169.254.169.254/latest/meta-data",
  "http://[::1]/a.jpg",
  "http://internal.local/a.jpg",
  "http://0.0.0.0/x.png"
];
for (const url of privateTargets) {
  const verdict = checkReferenceImageUrl(url, allowlist);
  assert.equal(verdict.ok, false, `expected refusal for ${url}`);
}

// Non-allowlisted public hosts are refused; so are non-http(s) schemes.
assert.equal(checkReferenceImageUrl("https://evil.example.com/a.jpg", allowlist).ok, false);
assert.equal(checkReferenceImageUrl("ftp://media.homecentre.com/a.jpg", allowlist).ok, false);
assert.equal(checkReferenceImageUrl("data:image/jpeg;base64,abc", allowlist).ok, false);

// Subdomains of allowlisted registrable domains pass; lookalike suffixes do not.
assert.equal(checkReferenceImageUrl("https://assets.danubehome.com/a.jpg", allowlist).ok, true);
assert.equal(checkReferenceImageUrl("https://notdanubehome.com/a.jpg", allowlist).ok, false);
assert.equal(checkReferenceImageUrl("https://danubehome.com.evil.io/a.jpg", allowlist).ok, false);

// Extra hosts configured via env string extend the allowlist.
const extended = buildReferenceHostAllowlist({
  configured: "images.example-retailer.ae, cdn.other.com",
  supabaseUrl: "https://baevldudfqfnzczbvooz.supabase.co"
});
assert.equal(checkReferenceImageUrl("https://images.example-retailer.ae/p.jpg", extended).ok, true);

// --- preflightReferenceImage ---------------------------------------------------

type MockResponse = {
  status: number;
  headers: Record<string, string>;
};

function mockFetch(routes: Record<string, MockResponse | MockResponse[]>) {
  const seen: string[] = [];
  const counts: Record<string, number> = {};
  const impl = async (input: string | URL, init?: { method?: string }) => {
    const url = String(input);
    seen.push(`${init?.method ?? "GET"} ${url}`);
    const route = routes[url];
    if (!route) {
      throw new Error(`no mock for ${url}`);
    }
    const step = Array.isArray(route) ? route[Math.min(counts[url] ?? 0, route.length - 1)] : route;
    counts[url] = (counts[url] ?? 0) + 1;
    return {
      status: step.status,
      ok: step.status >= 200 && step.status < 300,
      headers: {
        get: (name: string) => step.headers[name.toLowerCase()] ?? null
      },
      body: null
    } as unknown as Response;
  };
  return { impl, seen };
}

// Happy path: HEAD 200 with an image content type within the byte cap.
{
  const { impl } = mockFetch({
    "https://media.homecentre.com/ok.jpg": {
      status: 200,
      headers: { "content-type": "image/jpeg", "content-length": "150000" }
    }
  });
  const result = await preflightReferenceImage("https://media.homecentre.com/ok.jpg", {
    allowlist,
    fetchImpl: impl
  });
  assert.equal(result.ok, true);
}

// HEAD-rejecting host (405) falls back to GET and still passes.
{
  const { impl, seen } = mockFetch({
    "https://media.homecentre.com/no-head.jpg": [
      { status: 405, headers: {} },
      { status: 200, headers: { "content-type": "image/jpeg" } }
    ]
  });
  const result = await preflightReferenceImage("https://media.homecentre.com/no-head.jpg", {
    allowlist,
    fetchImpl: impl
  });
  assert.equal(result.ok, true);
  assert.ok(seen.some((s) => s.startsWith("HEAD ")));
  assert.ok(seen.some((s) => s.startsWith("GET ")));
}

// A redirect to a non-allowlisted or private host is refused mid-flight.
{
  const { impl } = mockFetch({
    "https://media.homecentre.com/redirect.jpg": {
      status: 302,
      headers: { location: "http://169.254.169.254/latest" }
    }
  });
  const result = await preflightReferenceImage("https://media.homecentre.com/redirect.jpg", {
    allowlist,
    fetchImpl: impl
  });
  assert.equal(result.ok, false);
}

// A redirect within the allowlist is followed (bounded) and passes.
{
  const { impl } = mockFetch({
    "https://media.homecentre.com/moved.jpg": {
      status: 301,
      headers: { location: "https://cdn.media.amplience.net/i/homecentre/moved.jpg" }
    },
    "https://cdn.media.amplience.net/i/homecentre/moved.jpg": {
      status: 200,
      headers: { "content-type": "image/webp", "content-length": "90000" }
    }
  });
  const result = await preflightReferenceImage("https://media.homecentre.com/moved.jpg", {
    allowlist,
    fetchImpl: impl
  });
  assert.equal(result.ok, true);
}

// Oversized content-length and non-image content types are refused.
{
  const { impl } = mockFetch({
    "https://media.homecentre.com/huge.jpg": {
      status: 200,
      headers: { "content-type": "image/jpeg", "content-length": String(50 * 1024 * 1024) }
    },
    "https://media.homecentre.com/page.html": {
      status: 200,
      headers: { "content-type": "text/html" }
    }
  });
  assert.equal(
    (await preflightReferenceImage("https://media.homecentre.com/huge.jpg", { allowlist, fetchImpl: impl })).ok,
    false
  );
  assert.equal(
    (
      await preflightReferenceImage("https://media.homecentre.com/page.html", {
        allowlist,
        fetchImpl: impl
      })
    ).ok,
    false
  );
}

// Endless redirect loops are cut off.
{
  const { impl } = mockFetch({
    "https://media.homecentre.com/loop.jpg": {
      status: 302,
      headers: { location: "https://media.homecentre.com/loop.jpg" }
    }
  });
  const result = await preflightReferenceImage("https://media.homecentre.com/loop.jpg", {
    allowlist,
    fetchImpl: impl
  });
  assert.equal(result.ok, false);
}

console.log("reference-guard tests passed");
