export type CatalogTimestampFreshnessStatus = "fresh" | "stale" | "missing" | "invalid";

export type CatalogTimestampFreshness = {
  catalogFreshnessStatus: CatalogTimestampFreshnessStatus;
  checkedAt: string | null;
  ageDays: number | null;
  thresholdDays: number;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function classifyCatalogTimestampFreshness({
  lastCheckedAt,
  nowMs,
  thresholdDays = 7
}: {
  lastCheckedAt: string | null;
  nowMs: number;
  thresholdDays?: number;
}): CatalogTimestampFreshness {
  if (!lastCheckedAt) {
    return {
      catalogFreshnessStatus: "missing",
      checkedAt: null,
      ageDays: null,
      thresholdDays
    };
  }

  const checkedAtMs = new Date(lastCheckedAt).getTime();
  if (!Number.isFinite(checkedAtMs)) {
    return {
      catalogFreshnessStatus: "invalid",
      checkedAt: lastCheckedAt,
      ageDays: null,
      thresholdDays
    };
  }

  const rawAgeDays = (nowMs - checkedAtMs) / MS_PER_DAY;
  const ageDays = Number(rawAgeDays.toFixed(3));

  return {
    catalogFreshnessStatus: rawAgeDays > thresholdDays ? "stale" : "fresh",
    checkedAt: lastCheckedAt,
    ageDays,
    thresholdDays
  };
}
