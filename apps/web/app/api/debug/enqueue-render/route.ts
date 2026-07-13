import { enqueueFinalRender } from "@/lib/render-runner";

// TEMPORARY verification aid for PR #322's forced-redelivery idempotency proof. Preview-only
// (404 everywhere else), enqueue-only (cannot create/mutate jobs), token-gated. This commit is
// reverted before the PR is merge-ready.
const VERIFICATION_TOKEN = "5f1c1d0e-9d5c-4f9a-b0d3-7c62f3a1e8b4";

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return new Response("Not found", { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as { renderJobId?: string; token?: string } | null;
  if (body?.token !== VERIFICATION_TOKEN || typeof body.renderJobId !== "string") {
    return new Response("Forbidden", { status: 403 });
  }
  await enqueueFinalRender(body.renderJobId);
  return Response.json({ enqueued: body.renderJobId });
}
