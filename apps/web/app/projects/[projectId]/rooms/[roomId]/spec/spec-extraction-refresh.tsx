"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Polls the /spec page while an extraction lease is live, so the ledger appears
// the moment the detached runner persists it. Bounded by the lease: once the job
// is past staleAt the next server read reclaims it and renders the failed state,
// so polling stops shortly after instead of running forever.
const POLL_INTERVAL_MS = 3_000;
const POLL_GRACE_AFTER_STALE_MS = 10_000;

export function SpecExtractionRefresh({ staleAtMs }: { staleAtMs: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (Date.now() > staleAtMs + POLL_GRACE_AFTER_STALE_MS) {
        window.clearInterval(timer);
        return;
      }
      router.refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [router, staleAtMs]);

  return null;
}
