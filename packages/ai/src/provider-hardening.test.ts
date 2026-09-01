import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";

import {
  createOpenAiImageFallbackClient,
  generateClarifyingQuestions,
  generateConceptView,
  hardenReferenceUrls,
  textTimeoutMs
} from "./index";

// Required server env for parseServerEnv inside the functions under test.
const BASE_ENV: Record<string, string> = {
  OPENAI_API_KEY: "sk-test-dummy-key-for-hardening-tests",
  NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-dummy",
  SUPABASE_SERVICE_ROLE_KEY: "service-dummy",
  RITZY_IMAGE_PROVIDER: "evolink",
  EVOLINK_API_KEY: "evolink-dummy"
};

function applyEnv(overrides: Record<string, string | undefined>) {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

// A 1x1 transparent PNG.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

// --- textTimeoutMs unit behavior ------------------------------------------------

assert.equal(textTimeoutMs({}), 90_000);
assert.equal(textTimeoutMs({ RITZY_TEXT_TIMEOUT_MS: "0" }), 90_000);
assert.equal(textTimeoutMs({ RITZY_TEXT_TIMEOUT_MS: "-5" }), 90_000);
assert.equal(textTimeoutMs({ RITZY_TEXT_TIMEOUT_MS: "abc" }), 90_000);
assert.equal(textTimeoutMs({ RITZY_TEXT_TIMEOUT_MS: "2500" }), 2500);

// --- fallback credential matrix -------------------------------------------------

// Dedicated fallback key always works and pins api.openai.com.
{
  const client = createOpenAiImageFallbackClient({
    OPENAI_API_KEY: "sk-gateway",
    OPENAI_FALLBACK_API_KEY: "sk-real-openai",
    OPENAI_BASE_URL: "https://api.evolink.ai/v1"
  });
  assert.equal(client.baseURL, "https://api.openai.com/v1");
}
// A genuine gateway base without a fallback key must fail fast, not 401 later.
assert.throws(
  () =>
    createOpenAiImageFallbackClient({
      OPENAI_API_KEY: "sk-gateway",
      OPENAI_BASE_URL: "https://api.evolink.ai/v1"
    }),
  /No distinct OpenAI fallback credential/
);
// No base URL: the primary key is a real OpenAI credential and is used.
{
  const client = createOpenAiImageFallbackClient({ OPENAI_API_KEY: "sk-real" });
  assert.equal(client.baseURL, "https://api.openai.com/v1");
}
// An EXPLICIT api.openai.com base is not a gateway; the primary key stays valid.
{
  const client = createOpenAiImageFallbackClient({
    OPENAI_API_KEY: "sk-real",
    OPENAI_BASE_URL: "https://api.openai.com/v1"
  });
  assert.equal(client.baseURL, "https://api.openai.com/v1");
}

// --- hardenReferenceUrls transformation (Phase 0 payload, mocked preflight) ------

{
  const restore = applyEnv({});
  const preflightSeen: string[] = [];
  const mockFetch = async (input: string | URL) => {
    preflightSeen.push(String(input));
    return {
      status: 200,
      ok: true,
      headers: { get: (n: string) => ({ "content-type": "image/jpeg" })[n.toLowerCase()] ?? null },
      body: null
    } as unknown as Response;
  };

  const hardened = await hardenReferenceUrls(
    [
      {
        bytes: TINY_PNG,
        mimeType: "image/png",
        name: "poisoned-2xl-rug",
        url: "https://2xlhome.com/media/catalog/product/o/l/olaf-rug_1.jpg?width=600&height=492&canvas="
      },
      {
        bytes: TINY_PNG,
        mimeType: "image/png",
        name: "refused-host",
        url: "https://evil.example.com/a.jpg"
      },
      {
        bytes: TINY_PNG,
        mimeType: "image/png",
        name: "byte-only",
        url: null
      }
    ],
    {
      NEXT_PUBLIC_SUPABASE_URL: BASE_ENV.NEXT_PUBLIC_SUPABASE_URL
    },
    mockFetch
  );

  // The poisoned URL survives as a URL, param-free (the Phase 0 fix).
  assert.equal(hardened[0].url, "https://2xlhome.com/media/catalog/product/o/l/olaf-rug_1.jpg");
  // The refused host loses its URL (bytes inline downstream); no preflight was attempted for it.
  assert.equal(hardened[1].url, null);
  assert.ok(!preflightSeen.some((u) => u.includes("evil.example.com")));
  // Byte-only references pass through untouched.
  assert.equal(hardened[2].url, null);
  restore();
}

// An allowlisted but undeliverable URL (preflight 404) also inlines: the dead link can
// never reach a gateway whose whole task dies on one bad reference.
{
  const restore = applyEnv({});
  const mock404 = async () =>
    ({
      status: 404,
      ok: false,
      headers: { get: () => null },
      body: null
    }) as unknown as Response;
  const hardened = await hardenReferenceUrls(
    [
      {
        bytes: TINY_PNG,
        mimeType: "image/png",
        name: "dead-allowlisted-url",
        url: "https://media.homecentre.com/gone.jpg"
      }
    ],
    { NEXT_PUBLIC_SUPABASE_URL: BASE_ENV.NEXT_PUBLIC_SUPABASE_URL },
    mock404
  );
  assert.equal(hardened[0].url, null);
  restore();
}

// --- Evolink wiring: a poisoned/refused reference can never reach the gateway ----

{
  const submits: Array<Record<string, unknown>> = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      if (req.method === "POST" && req.url === "/v1/images/generations") {
        submits.push(JSON.parse(Buffer.concat(chunks).toString() || "{}"));
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ id: "task-test-1", status: "processing" }));
        return;
      }
      if (req.url?.startsWith("/v1/tasks/")) {
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            id: "task-test-1",
            status: "completed",
            results: [`${origin}/result.png`],
            usage: { credits_used: 1.23 }
          })
        );
        return;
      }
      if (req.url === "/result.png") {
        res.setHeader("content-type", "image/png");
        res.end(TINY_PNG);
        return;
      }
      res.statusCode = 404;
      res.end();
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  const restore = applyEnv({ EVOLINK_BASE_URL: origin });
  try {
    const result = await generateConceptView({
      viewKey: "reverse_wide",
      roomType: "Living Room",
      conceptTitle: "Test direction",
      conceptDescription: undefined,
      heroImageBytes: TINY_PNG,
      heroImageMimeType: "image/png",
      // A host the guard refuses: the submit payload must carry a data URL, never this URL.
      heroImageUrl: "https://evil.example.com/hero.png" as string | undefined
    });
    assert.equal(result.imageProvider, "evolink");
    assert.equal(result.imageBase64, TINY_PNG.toString("base64"));
    assert.equal(submits.length, 1);
    const urls = (submits[0].image_urls ?? []) as string[];
    assert.equal(urls.length, 1);
    assert.ok(urls[0].startsWith("data:image/"), `expected inlined data URL, got ${urls[0].slice(0, 60)}`);
    // The gateway-origin result URL passed the same-origin result guard and was capped-read.
  } finally {
    restore();
    server.close();
  }
}

// --- Stalling text provider surfaces within the configured deadline, one attempt --

{
  let attempts = 0;
  const server = http.createServer((req) => {
    attempts += 1;
    void req; // never respond
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  const restore = applyEnv({ OPENAI_BASE_URL: `${origin}/v1`, RITZY_TEXT_TIMEOUT_MS: "1200" });
  const startedAt = Date.now();
  try {
    await assert.rejects(
      generateClarifyingQuestions({
        intendedMode: "homeowner",
        roomType: "Living Room",
        styleNotes: "warm",
        colorNotes: undefined,
        functionalRequirements: undefined,
        avoidNotes: undefined,
        inspirationNotes: undefined,
        inspirationImageUrls: []
      }),
      /timed out|timeout|abort/i
    );
    const elapsed = Date.now() - startedAt;
    assert.ok(elapsed < 6_000, `expected bounded failure, took ${elapsed}ms`);
    assert.equal(attempts, 1, `expected exactly one attempt, saw ${attempts}`);
  } finally {
    restore();
    server.closeAllConnections?.();
    server.close();
  }
}

// A hung gateway SUBMIT is bounded by the submit timeout, then the fallback path
// engages (here the fallback also fails fast on a dummy key, composing both errors).
{
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/v1/images/generations") {
      void res; // never respond
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  const restore = applyEnv({
    EVOLINK_BASE_URL: origin,
    RITZY_EVOLINK_SUBMIT_TIMEOUT_MS: "800",
    OPENAI_FALLBACK_API_KEY: "sk-fallback-dummy"
  });
  const startedAt = Date.now();
  try {
    await assert.rejects(
      generateConceptView({
        viewKey: "reverse_wide",
        roomType: "Living Room",
        conceptTitle: "Hung submit",
        conceptDescription: undefined,
        heroImageBytes: TINY_PNG,
        heroImageMimeType: "image/png",
        heroImageUrl: undefined
      }),
      /Evolink image generation failed/
    );
    const elapsed = Date.now() - startedAt;
    assert.ok(elapsed < 15_000, `expected bounded submit failure, took ${elapsed}ms`);
  } finally {
    restore();
    server.closeAllConnections?.();
    server.close();
  }
}

console.log("provider-hardening tests passed");
