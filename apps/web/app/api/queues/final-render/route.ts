import { handleCallback } from "@vercel/queue";

import {
  FINAL_RENDER_MAX_QUEUE_ATTEMPTS,
  runFinalRender,
  type FinalRenderQueueMessage
} from "@/lib/render-runner";

// Vercel Queues push consumer for the final grounded render. The `queue/v2beta` trigger in
// vercel.json air-gaps this route: it has no public URL and can only be invoked by the queue
// infrastructure, so no auth logic lives here. Delivery is at-least-once; all idempotency is
// carried by runFinalRender's claim/success/failure CAS writes on the render_jobs row.

// Hero + spatial QA + one corrective regen + two angle views can approach ten minutes
// against the real renderer; needs Fluid Compute's extended duration (Pro plan).
export const maxDuration = 800;

export const POST = handleCallback<FinalRenderQueueMessage>(
  async (message, metadata) => {
    await runFinalRender({
      renderJobId: message.renderJobId,
      attempt: { mode: "queue", deliveryCount: metadata.deliveryCount }
    });
  },
  {
    // Backstop only: runFinalRender marks the job failed and returns cleanly on its final
    // attempt, so a message reaching this cap means the runner itself kept crashing.
    retry: (_error, metadata) =>
      metadata.deliveryCount >= FINAL_RENDER_MAX_QUEUE_ATTEMPTS
        ? { acknowledge: true }
        : { afterSeconds: 60 }
  }
);
