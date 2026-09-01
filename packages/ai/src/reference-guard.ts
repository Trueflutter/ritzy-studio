// Reference-image URL guard shared by every image-generation path.
//
// Two production incidents motivate this module:
// - 2XL Magento resize URLs (?width=&height=&canvas=) fail Evolink generation tasks
//   outright ("Invalid parameters"), which blocked all generation for any room whose
//   anchors included a 2XL product (Phase 0 root cause).
// - Reference URLs and remote image fetches previously followed redirects blindly with
//   no host restrictions, an SSRF surface once any URL is data-influenced.
//
// Policy: remote reference URLs must resolve to a small allowlist of retailer image
// CDNs plus our own Supabase storage host. Anything else is refused; callers fall back
// to inlining bytes they already hold, or drop the reference with a recorded reason.

export type ReferenceUrlVerdict = { ok: true; url: string } | { ok: false; reason: string };

export type ReferencePreflightResult = { ok: boolean; reason?: string; finalUrl?: string };

// Every host observed across the production catalog's primary_image_url values
// (census 2026-09-01: assets.danubehome.com, mp-sellers-files.danubehome.com,
// media.homecentre.com, media.chattelsandmore.com, 2xlhome.com, cdn.media.amplience.net)
// plus the Evolink public file host used by the local fixture catalog. Registrable
// domains cover their subdomains.
const DEFAULT_REFERENCE_IMAGE_HOSTS = [
  "media.homecentre.com",
  "cdn.media.amplience.net",
  "danubehome.com",
  "media.chattelsandmore.com",
  "www.chattelsandmore.com",
  "2xlhome.com",
  "files.evolink.ai",
  // Image hosts of the five adapters that are dry-run today but registered in the
  // ingestion CLI; the guard must not orphan their products the day one is enabled.
  "www.homesrus.ae",
  "www.ikea.com",
  "prodmarinamedia.gumlet.io",
  "cdn.panhomestores.com",
  "www.theone.com"
];

// Hosts whose resize/query parameters are known to break downstream image providers.
// Stripping the query serves the original full-size asset, which every provider accepts.
const DEFAULT_STRIP_QUERY_HOSTS = ["2xlhome.com"];

const PREFLIGHT_TIMEOUT_MS = 8_000;
const PREFLIGHT_MAX_BYTES = 20 * 1024 * 1024;
const PREFLIGHT_MAX_REDIRECTS = 3;

function parseHostList(configured: string | null | undefined): string[] {
  if (!configured) {
    return [];
  }
  return configured
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function buildReferenceHostAllowlist({
  configured,
  supabaseUrl
}: {
  configured?: string | null;
  supabaseUrl?: string | null;
} = {}): Set<string> {
  const entries = new Set<string>(DEFAULT_REFERENCE_IMAGE_HOSTS);
  for (const host of parseHostList(configured)) {
    entries.add(host);
  }
  if (supabaseUrl) {
    try {
      const host = new URL(supabaseUrl).hostname.toLowerCase();
      if (host) {
        entries.add(host);
      }
    } catch {
      // a malformed supabase URL never widens the allowlist
    }
  }
  return entries;
}

function hostMatchesEntry(host: string, entry: string): boolean {
  return host === entry || host.endsWith(`.${entry}`);
}

function isAllowlistedHost(host: string, allowlist: Set<string>): boolean {
  for (const entry of allowlist) {
    if (hostMatchesEntry(host, entry)) {
      return true;
    }
  }
  return false;
}

function isPrivateOrLocalHost(host: string): boolean {
  const lowered = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (lowered === "localhost" || lowered.endsWith(".localhost") || lowered.endsWith(".local")) {
    return true;
  }
  if (lowered.includes(":")) {
    // IPv6 literal (URL.hostname strips the brackets): loopback, unspecified,
    // link-local, and unique-local ranges are refused; IPv4-mapped addresses
    // (::ffff:a.b.c.d) are judged by their embedded IPv4 value.
    if (lowered === "::1" || lowered === "::" || /^fe[89ab][0-9a-f]:/.test(lowered) || lowered.startsWith("fc") || lowered.startsWith("fd")) {
      return true;
    }
    const mapped = lowered.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mapped) {
      return isPrivateOrLocalHost(mapped[1]);
    }
    return false;
  }
  const ipv4 = lowered.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) {
    return false;
  }
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  if (a === 0 || a === 10 || a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  return false;
}

export function sanitizeReferenceImageUrl(url: string, stripQueryHosts?: string[] | null): string {
  // Configured hosts EXTEND the defaults; replacing them would silently reopen the
  // 2XL "Invalid parameters" outage the defaults exist to prevent.
  const hosts = [...DEFAULT_STRIP_QUERY_HOSTS, ...(stripQueryHosts ?? [])];
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (parsed.search && hosts.some((entry) => hostMatchesEntry(host, entry.toLowerCase()))) {
      parsed.search = "";
      return parsed.toString();
    }
    return url;
  } catch {
    return url;
  }
}

export function checkReferenceImageUrl(url: string, allowlist: Set<string>): ReferenceUrlVerdict {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "not a valid URL" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: `unsupported protocol ${parsed.protocol}` };
  }

  const host = parsed.hostname.toLowerCase();
  if (isPrivateOrLocalHost(host)) {
    return { ok: false, reason: `private or local host ${host}` };
  }

  if (!isAllowlistedHost(host, allowlist)) {
    return { ok: false, reason: `host ${host} is not on the reference-image allowlist` };
  }

  return { ok: true, url };
}

export type ReferenceFetchImpl = (input: string | URL, init?: RequestInit) => Promise<Response>;

// DNS-level check: an allowlisted hostname whose CURRENT resolution is a private
// address (compromised or rebound DNS) is refused before any connection. Node's
// fetch still resolves independently afterwards, so a fast-flux TOCTOU window
// remains; closing it fully needs a pinned-address dispatcher, which is documented
// as an accepted residual for this fixed, operator-curated allowlist.
async function resolvesToPublicAddress(host: string): Promise<boolean> {
  // IP literals were already screened by isPrivateOrLocalHost.
  if (/^[\d.]+$/.test(host) || host.includes(":")) {
    return true;
  }
  try {
    const dns = await import("node:dns/promises");
    // A hanging resolver must not stall the pipeline before any fetch timeout can
    // apply; past the bound we fall through to the fetch's own failure mode.
    const results = await Promise.race([
      dns.lookup(host, { all: true, verbatim: true }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_000))
    ]);
    if (!results) {
      return true;
    }
    return results.every((entry) => !isPrivateOrLocalHost(entry.address));
  } catch {
    // Resolution failure: let the fetch fail on its own terms rather than
    // misreporting a policy refusal.
    return true;
  }
}

async function fetchWithTimeout(
  fetchImpl: ReferenceFetchImpl,
  url: string,
  method: "HEAD" | "GET",
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      method,
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "user-agent": "RitzyStudioBot/0.1 (+https://ritzystudio.app; reference preflight)"
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

// One-call policy verdict: sanitize then check. Both URL-selection (Evolink) and
// byte-fetch (render-images) paths compose exactly this, so a policy change lands in
// one place.
export function guardReferenceUrl(
  url: string,
  {
    allowlist,
    stripQueryHosts
  }: { allowlist: Set<string>; stripQueryHosts?: string[] | null }
): ReferenceUrlVerdict {
  const sanitized = sanitizeReferenceImageUrl(url, stripQueryHosts);
  const verdict = checkReferenceImageUrl(sanitized, allowlist);
  return verdict.ok ? { ok: true, url: sanitized } : verdict;
}

// The single allowlist-validated redirect follower. Every hop is re-checked against
// the allowlist and private-address rules BEFORE it is fetched; the final Response is
// returned to the caller (body unread). HEAD-rejecting hosts fall back to GET.
export async function followGuardedRedirects(
  url: string,
  {
    allowlist,
    fetchImpl = fetch,
    timeoutMs = PREFLIGHT_TIMEOUT_MS,
    overallTimeoutMs,
    stripQueryHosts,
    method = "GET"
  }: {
    allowlist: Set<string>;
    fetchImpl?: ReferenceFetchImpl;
    timeoutMs?: number;
    // Hard ceiling across ALL hops and DNS screens; per-hop timeouts alone would
    // let a redirect chain multiply the stated deadline. Defaults to 2x the per-hop
    // timeout.
    overallTimeoutMs?: number;
    // Hosts whose query strings are stripped on EVERY hop, so a redirect landing on
    // a known-breaking URL shape (the 2XL resize params) is sanitized before it is
    // fetched or returned as finalUrl.
    stripQueryHosts?: string[] | null;
    method?: "HEAD" | "GET";
  }
): Promise<{ ok: true; response: Response; finalUrl: string } | { ok: false; reason: string }> {
  let currentUrl = url;
  let currentMethod: "HEAD" | "GET" = method;
  const overallDeadline = Date.now() + (overallTimeoutMs ?? timeoutMs * 2);

  for (let hop = 0; hop <= PREFLIGHT_MAX_REDIRECTS; hop += 1) {
    const remaining = overallDeadline - Date.now();
    if (remaining <= 0) {
      return { ok: false, reason: "overall fetch deadline exceeded" };
    }
    const hopTimeout = Math.min(timeoutMs, remaining);

    // Full policy per hop: sanitize (strip-host query removal) THEN check, so a
    // redirect target is never fetched or returned in its poisoned form.
    const guarded = guardReferenceUrl(currentUrl, { allowlist, stripQueryHosts });
    if (!guarded.ok) {
      return { ok: false, reason: guarded.reason };
    }
    currentUrl = guarded.url;

    // Only run the DNS screen for the real network fetch; injected test fetchers
    // never touch the network.
    if (fetchImpl === fetch && !(await resolvesToPublicAddress(new URL(currentUrl).hostname))) {
      return { ok: false, reason: `host ${new URL(currentUrl).hostname} resolves to a private address` };
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(fetchImpl, currentUrl, currentMethod, hopTimeout);
      if (currentMethod === "HEAD" && (response.status === 405 || response.status === 501 || response.status === 403)) {
        response = await fetchWithTimeout(fetchImpl, currentUrl, "GET", hopTimeout);
      }
    } catch (error) {
      return { ok: false, reason: `guarded fetch failed: ${(error as Error).message}` };
    }

    if (isRedirect(response.status)) {
      void response.body?.cancel().catch(() => {});
      const location = response.headers.get("location");
      if (!location) {
        return { ok: false, reason: "redirect without location" };
      }
      let next: URL;
      try {
        next = new URL(location, currentUrl);
      } catch {
        return { ok: false, reason: `unparseable redirect target ${location}` };
      }
      // No plaintext downgrade mid-chain: an https reference must stay https, or a
      // network-position attacker could swap the image bytes on the clear hop.
      if (new URL(currentUrl).protocol === "https:" && next.protocol !== "https:") {
        return { ok: false, reason: `refusing https-to-${next.protocol.replace(":", "")} redirect downgrade` };
      }
      if (next.toString() === currentUrl) {
        return { ok: false, reason: "redirect loop" };
      }
      // 303 semantically converts the follow-up to GET.
      if (response.status === 303) {
        currentMethod = "GET";
      }
      currentUrl = next.toString();
      continue;
    }

    return { ok: true, response, finalUrl: currentUrl };
  }

  return { ok: false, reason: `exceeded ${PREFLIGHT_MAX_REDIRECTS} redirects` };
}

// Reads a response body with a hard byte ceiling and an optional read deadline; null
// when the stream exceeds either. The deadline matters because fetch timeouts cover
// headers only; a drip-feeding body would otherwise hold the caller open unbounded.
export async function readResponseBytesCapped(
  response: Response,
  maxBytes: number,
  timeoutMs?: number
): Promise<Buffer | null> {
  const reader = response.body?.getReader();
  if (!reader) {
    return null;
  }
  const deadline = timeoutMs ? Date.now() + timeoutMs : null;
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      if (deadline) {
        // Each race's losing timer is cleared, or a multi-chunk body would leave
        // hundreds of pending timers retaining the worker.
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          chunk = await Promise.race([
            reader.read(),
            new Promise<never>((_, rejectFn) => {
              timer = setTimeout(
                () => rejectFn(new Error("body read deadline exceeded")),
                Math.max(1, deadline - Date.now())
              );
            })
          ]);
        } finally {
          clearTimeout(timer);
        }
      } else {
        chunk = await reader.read();
      }
      const { done, value } = chunk;
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => {});
    return null;
  }
  return Buffer.concat(chunks, totalBytes);
}

// Verifies a reference URL is actually deliverable before it is handed to an image
// provider whose whole task dies on a bad reference. Thin wrapper over the shared
// follower; HEAD first, GET fallback for HEAD-rejecting CDNs.
export async function preflightReferenceImage(
  url: string,
  {
    allowlist,
    fetchImpl = fetch,
    timeoutMs = PREFLIGHT_TIMEOUT_MS,
    overallTimeoutMs,
    stripQueryHosts,
    maxBytes = PREFLIGHT_MAX_BYTES
  }: {
    allowlist: Set<string>;
    fetchImpl?: ReferenceFetchImpl;
    timeoutMs?: number;
    overallTimeoutMs?: number;
    stripQueryHosts?: string[] | null;
    maxBytes?: number;
  }
): Promise<ReferencePreflightResult> {
  const followed = await followGuardedRedirects(url, {
    allowlist,
    fetchImpl,
    timeoutMs,
    overallTimeoutMs,
    stripQueryHosts,
    method: "HEAD"
  });
  if (!followed.ok) {
    return { ok: false, reason: followed.reason };
  }
  const { response, finalUrl } = followed;
  // Headers are all we need; an unconsumed body pins its pooled socket under undici.
  void response.body?.cancel().catch(() => {});

  if (!response.ok) {
    return { ok: false, reason: `preflight HTTP ${response.status}` };
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!contentType || !contentType.startsWith("image/")) {
    return { ok: false, reason: contentType ? `non-image content type ${contentType}` : "missing content type" };
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { ok: false, reason: `content length ${contentLength} exceeds cap ${maxBytes}` };
  }

  return { ok: true, finalUrl };
}
