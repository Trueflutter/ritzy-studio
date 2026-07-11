// How long a final-render job may sit in `running`/`queued` before it is treated as stalled.
//
// The render runs in an in-request `after()` task. If that task never completes (the request was
// abandoned before it was scheduled, the function was torn down, or a provider call hung past the
// function's budget) the render_job stays `running` with no recovery. This threshold bounds that:
// generateFinalRenderAction fails a stalled job on the next attempt instead of reporting "already
// running", and the presentation page drops out of its progress spinner into a retry affordance.
//
// A normal render (generate + spatial QA + at most one corrective regen) completes well within a
// couple of minutes, so 4 minutes recovers quickly without cutting off a legitimately slow render.
export const FINAL_RENDER_STALE_MS = 4 * 60 * 1000;

export function isRenderJobStalled(
  status: string | null | undefined,
  createdAt: string | null | undefined,
  now: number = Date.now()
): boolean {
  if (status !== "running" && status !== "queued") {
    return false;
  }
  if (!createdAt) {
    return false;
  }
  const startedAt = Date.parse(createdAt);
  return Number.isFinite(startedAt) && now - startedAt > FINAL_RENDER_STALE_MS;
}
