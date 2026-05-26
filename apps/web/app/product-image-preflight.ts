export type ProductImagePreflightRejectionReason =
  | "invalid_url"
  | "unsupported_extension"
  | "timeout"
  | "fetch_failed"
  | "non_ok_status"
  | "unsupported_mime"
  | "too_large";

export type ProductImagePreflightSummary = {
  checkedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  rejectionReasons: Partial<Record<ProductImagePreflightRejectionReason, number>>;
};

type ProductImageCandidate = {
  id: string;
  primaryImageUrl: string | null;
};

type ProductImagePreflightOptions = {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
  concurrency?: number;
};

type ProductImagePreflightRolePool = {
  role: {
    label: string;
    priority: "required" | "supporting";
  };
  candidates: Array<{ id: string }>;
};

const unsupportedImageExtensions = new Set([".avif", ".heic", ".heif", ".svg"]);
const supportedImageContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const defaultTimeoutMs = 2_500;
const defaultMaxBytes = 20 * 1024 * 1024;
const defaultConcurrency = 6;

export async function preflightProductCandidateImages<T extends ProductImageCandidate>(
  candidates: T[],
  options: ProductImagePreflightOptions = {}
) {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const maxBytes = options.maxBytes ?? defaultMaxBytes;
  const concurrency = Math.max(1, options.concurrency ?? defaultConcurrency);
  const checks = await mapWithConcurrency(candidates, concurrency, async (candidate) => ({
    candidate,
    result: await validateProductImageUrlForAi(candidate.primaryImageUrl, {
      fetcher,
      timeoutMs,
      maxBytes
    })
  }));
  const rejectionReasons: ProductImagePreflightSummary["rejectionReasons"] = {};
  const acceptedCandidateIds: string[] = [];
  let checkedCount = 0;

  const sanitizedCandidates = checks.map(({ candidate, result }) => {
    if (result.status === "missing") {
      return candidate;
    }

    checkedCount += 1;

    if (result.status === "accepted") {
      acceptedCandidateIds.push(candidate.id);
      return candidate;
    }

    rejectionReasons[result.reason] = (rejectionReasons[result.reason] ?? 0) + 1;
    return {
      ...candidate,
      primaryImageUrl: null
    };
  });

  return {
    candidates: sanitizedCandidates,
    acceptedCandidateIds,
    summary: {
      checkedCount,
      acceptedCount: acceptedCandidateIds.length,
      rejectedCount: checkedCount - acceptedCandidateIds.length,
      rejectionReasons
    }
  };
}

export async function validateProductImageUrlForAi(
  imageUrl: string | null,
  options: ProductImagePreflightOptions = {}
): Promise<
  | { status: "missing" }
  | { status: "accepted" }
  | { status: "rejected"; reason: ProductImagePreflightRejectionReason }
> {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const maxBytes = options.maxBytes ?? defaultMaxBytes;

  if (!imageUrl) {
    return { status: "missing" };
  }

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return { status: "rejected", reason: "invalid_url" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { status: "rejected", reason: "invalid_url" };
  }

  if (hasUnsupportedImageExtension(parsed.pathname)) {
    return { status: "rejected", reason: "unsupported_extension" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "image/jpeg,image/png,image/webp,image/gif",
        Range: "bytes=0-0"
      }
    });

    await response.body?.cancel();

    if (!response.ok) {
      return { status: "rejected", reason: "non_ok_status" };
    }

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!supportedImageContentTypes.has(contentType)) {
      return { status: "rejected", reason: "unsupported_mime" };
    }

    const contentLength = parseContentLength(response.headers);
    if (contentLength !== null && contentLength > maxBytes) {
      return { status: "rejected", reason: "too_large" };
    }

    return { status: "accepted" };
  } catch (error) {
    if (isAbortError(error)) {
      return { status: "rejected", reason: "timeout" };
    }

    return { status: "rejected", reason: "fetch_failed" };
  } finally {
    clearTimeout(timeout);
  }
}

export function buildProductImagePreflightGate({
  candidateCount,
  acceptedCandidateIds,
  rolePools
}: {
  candidateCount: number;
  acceptedCandidateIds: string[];
  rolePools: ProductImagePreflightRolePool[];
}) {
  const acceptedIds = new Set(acceptedCandidateIds);
  const requiredPools = rolePools.filter((pool) => pool.role.priority === "required");
  const requiredRolesWithoutAcceptedImage = requiredPools
    .filter((pool) => !pool.candidates.some((candidate) => acceptedIds.has(candidate.id)))
    .map((pool) => pool.role.label);

  if (requiredPools.length > 0) {
    return {
      usable: requiredRolesWithoutAcceptedImage.length === 0,
      minAcceptedCount: requiredPools.length,
      requiredRolesWithoutAcceptedImage
    };
  }

  const minAcceptedCount = Math.min(3, candidateCount);
  return {
    usable: acceptedIds.size >= minAcceptedCount,
    minAcceptedCount,
    requiredRolesWithoutAcceptedImage
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex] as T);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function hasUnsupportedImageExtension(pathname: string) {
  const lowerPath = pathname.toLowerCase();
  return [...unsupportedImageExtensions].some((extension) => lowerPath.endsWith(extension));
}

function parseContentLength(headers: Headers) {
  const contentRange = headers.get("content-range");
  const contentRangeTotal = contentRange?.match(/\/(\d+)$/)?.[1];
  if (contentRangeTotal) {
    return Number(contentRangeTotal);
  }

  const contentLength = headers.get("content-length");
  if (!contentLength) {
    return null;
  }

  const parsed = Number(contentLength);
  return Number.isFinite(parsed) ? parsed : null;
}

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError")
  );
}
