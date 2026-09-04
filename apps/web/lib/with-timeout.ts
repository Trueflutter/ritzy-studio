// A deadline for work that has none of its own. Both paid pipelines need it for
// the same reason: a catalogue read through a degraded pooler, a stalled
// retailer CDN and a provider that accepted a request and went quiet all hang
// rather than fail, and a request the platform kills runs no catch path, so its
// job row is left "running" and the dedupe locks the user out of a retry.
//
// The losing promise is not cancelled, only stopped being waited on. Callers
// that need real cancellation pass the provider its own deadline as well, and
// keep this as the backstop.
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}
