import type { CatalogAdapter, ProductDiscoveryResult, RawProductCandidate } from "../types";

const BASE_URL = "https://www.theone.com";
const ROBOTS_URL = `${BASE_URL}/robots.txt`;
const SITEMAP_URL = `${BASE_URL}/sitemap.xml`;
const FETCH_DELAY_MS = 1_000;
const MAX_DEFAULT_DISCOVERIES = 2;
const MAX_DISCOVERIES = 4;
const ROBOTS_NOTES =
  "robots.txt is readable and disallows account/order/address/return/wishlist/cart/checkout/thank-you/producttag/search surfaces. Adapter accepts only robots.txt, sitemap.xml, clean /category/... URLs, and clean /product/...-<numeric-sku> URLs; it rejects query/hash/private/auth/search/filter/cart/checkout/account/order/payment/wishlist/producttag/internal paths before fetch.";
const TERMS_NOTES =
  "No official The One feed or partner permission confirmed. Treat as tiny dry-run-only fixture/parser coverage using a hand-curated allowlist; prefer partner/feed approval before live writes or scale.";

type TheOneSeed = {
  url: string;
  categoryHint: string;
  seedCategoryUrl: string;
};

type StructuredProduct = {
  "@type"?: string | string[];
  name?: string;
  image?: string | string[];
  description?: string;
  sku?: string;
  offers?: {
    price?: number | string;
    priceCurrency?: string;
    availability?: string;
  };
};

type BreadcrumbList = {
  "@type"?: string;
  itemListElement?: Array<{
    item?: {
      name?: string;
      "@id"?: string;
    };
    name?: string;
  }>;
};

const APPROVED_PRODUCT_SEEDS: TheOneSeed[] = [
  {
    url: "https://www.theone.com/product/casablanca-lantern-nickel-h64cm-449686",
    categoryHint: "lighting",
    seedCategoryUrl: "https://www.theone.com/category/lighting-table-lamps"
  },
  {
    url: "https://www.theone.com/product/ruth-dining-table-white-dia-100cm-659377",
    categoryHint: "dining table",
    seedCategoryUrl: "https://www.theone.com/category/dining-dining-tables"
  },
  {
    url: "https://www.theone.com/product/kiwin-bedside-table-clear-561435",
    categoryHint: "nightstand",
    seedCategoryUrl: "https://www.theone.com/category/bed-bath-beds-bedside-tables"
  },
  {
    url: "https://www.theone.com/product/oren-rug-white-grey-200x300cm-647001",
    categoryHint: "rugs/floor covering",
    seedCategoryUrl: "https://www.theone.com/category/home-decor-rugs"
  }
];

const cache = new Map<string, string>();
let lastFetchAt = 0;

export const theOneAdapter: CatalogAdapter = {
  key: "theone-ae",
  dryRunOnly: true,
  retailer: {
    name: "The One UAE",
    domain: "www.theone.com",
    country: "AE",
    adapterKey: "theone-ae",
    status: "candidate",
    robotsNotes: ROBOTS_NOTES,
    termsNotes: TERMS_NOTES
  },
  getComplianceNotes: () => ({
    robotsNotes: ROBOTS_NOTES,
    termsNotes: TERMS_NOTES
  }),
  discoverProducts: async function* ({ limit, categories } = {}) {
    const discoveryLimit = Math.min(limit ?? MAX_DEFAULT_DISCOVERIES, MAX_DISCOVERIES);
    const allowedCategories = categories?.length
      ? new Set(categories.filter((categoryUrl) => isCleanTheOneCategoryUrl(categoryUrl)))
      : null;
    let yielded = 0;

    for (const seed of APPROVED_PRODUCT_SEEDS) {
      if (allowedCategories && !allowedCategories.has(seed.seedCategoryUrl)) {
        continue;
      }

      yield {
        url: seed.url,
        categoryHint: seed.categoryHint,
        source: "manual_seed",
        sourcePayload: {
          seedCategoryUrl: seed.seedCategoryUrl,
          sourceFreshnessTimestamp: new Date().toISOString(),
          dryRunOnly: true,
          robotsNotes: ROBOTS_NOTES
        }
      };

      yielded += 1;
      if (yielded >= discoveryLimit) return;
    }
  },
  extractProduct: async (discovery) => {
    if (!isCleanTheOneProductUrl(discovery.url)) {
      throw new Error(`The One discovery URL is not a clean product URL: ${discovery.url}`);
    }

    return parseTheOneProductHtml(await fetchText(discovery.url), discovery.url, discovery.categoryHint, discovery.sourcePayload);
  }
};

export function parseTheOneProductUrls(html: string) {
  return unique(
    Array.from(html.matchAll(/https:\/\/www\.theone\.com\/product\/[-a-z0-9]+-\d{5,}/g), (match) => {
      const url = match[0];
      return isCleanTheOneProductUrl(url) ? url : null;
    })
  );
}

export function parseTheOneProductHtml(
  html: string,
  fallbackUrl: string,
  categoryHint?: string,
  sourcePayload?: unknown
): RawProductCandidate {
  if (!isCleanTheOneProductUrl(fallbackUrl)) {
    throw new Error(`The One fallback URL is not a clean product URL: ${fallbackUrl}`);
  }

  const structuredProduct = parseStructuredProduct(html);
  const breadcrumbs = parseBreadcrumbs(html);
  const canonicalCandidate = normalizeTheOneUrl(
    matchContent(html, /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ??
      matchContent(html, /<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i) ??
      fallbackUrl
  );
  const canonicalUrl = isCleanTheOneProductUrl(canonicalCandidate) ? canonicalCandidate : fallbackUrl;
  const name =
    structuredProduct?.name ??
    matchContent(html, /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ??
    matchContent(html, /<title>\s*([^<|]+)(?:\||<\/title>)/i) ??
    nameFromUrl(canonicalUrl) ??
    "Untitled The One product";
  const imageUrls = unique([
    ...normalizeImageField(structuredProduct?.image),
    matchContent(html, /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i),
    ...parseGalleryUrls(html)
  ]);
  const category = categoryHint ?? inferTheOneCategory(canonicalUrl, breadcrumbs);

  return {
    canonicalUrl,
    name: decodeHtml(name),
    retailerCategory: category,
    description: stripHtml(
      structuredProduct?.description ?? matchContent(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
    ),
    externalSku: structuredProduct?.sku ?? skuFromUrl(canonicalUrl),
    priceText: stringifyPrice(structuredProduct?.offers?.price),
    salePriceText: null,
    currency: structuredProduct?.offers?.priceCurrency ?? "AED",
    availability: parseAvailability(structuredProduct?.offers?.availability),
    primaryImageUrl: imageUrls[0] ?? null,
    imageUrls,
    color: colorFromName(name),
    material: materialFromName(name),
    dimensionsText: dimensionsFromText(`${name} ${canonicalUrl}`),
    sourcePayload: {
      source: "theone",
      sourceFreshnessTimestamp: extractSourceFreshness(sourcePayload),
      seedCategoryUrl: extractSeedCategoryUrl(sourcePayload),
      breadcrumbs,
      dryRunOnly: true,
      robotsNotes: ROBOTS_NOTES
    }
  };
}

export function isAllowedTheOneFetchUrl(url: string) {
  return (
    normalizeTheOneUrl(url) === ROBOTS_URL ||
    normalizeTheOneUrl(url) === SITEMAP_URL ||
    isCleanTheOneCategoryUrl(url) ||
    isCleanTheOneProductUrl(url)
  );
}

export function isCleanTheOneCategoryUrl(url: string) {
  if (!isCleanTheOnePublicUrl(url)) return false;
  const pathname = new URL(normalizeTheOneUrl(url)).pathname;
  return /^\/category\/[a-z0-9-]+$/.test(pathname);
}

export function isCleanTheOneProductUrl(url: string) {
  if (!isCleanTheOnePublicUrl(url)) return false;
  const pathname = new URL(normalizeTheOneUrl(url)).pathname;
  return /^\/product\/[-a-z0-9]+-\d{5,}$/.test(pathname);
}

function isCleanTheOnePublicUrl(url: string) {
  try {
    const parsed = new URL(normalizeTheOneUrl(url));
    if (parsed.origin !== BASE_URL || parsed.search || parsed.hash) return false;
    const pathname = parsed.pathname.toLowerCase();
    if (
      pathname.includes("/search") ||
      pathname.includes("/account") ||
      pathname.includes("/cart") ||
      pathname.includes("/checkout") ||
      pathname.includes("/my-order") ||
      pathname.includes("/address-book") ||
      pathname.includes("/return") ||
      pathname.includes("/wishlist") ||
      pathname.includes("/thankyou") ||
      pathname.includes("/producttag") ||
      pathname.includes("/payment") ||
      pathname.includes("/order") ||
      pathname.includes("/catalog/") ||
      pathname.includes("/api/") ||
      pathname.includes("/graphql") ||
      pathname.includes("/rest/")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function fetchText(url: string) {
  const normalized = normalizeTheOneUrl(url);
  if (!isAllowedTheOneFetchUrl(normalized)) {
    throw new Error(`The One URL is outside the approved dry-run allowlist: ${url}`);
  }
  if (cache.has(normalized)) return cache.get(normalized) as string;

  const elapsed = Date.now() - lastFetchAt;
  if (elapsed < FETCH_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, FETCH_DELAY_MS - elapsed));
  }

  const response = await fetch(normalized, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9"
    },
    signal: AbortSignal.timeout(25_000)
  });
  lastFetchAt = Date.now();

  if (!response.ok) throw new Error(`The One fetch failed ${response.status} for ${normalized}`);
  const text = await response.text();
  cache.set(normalized, text);
  return text;
}

function parseStructuredProduct(html: string) {
  for (const json of parseJsonLd(html)) {
    const product = findJsonLdNode<StructuredProduct>(json, (node) => hasJsonLdType(node, "Product"));
    if (product) return product;
  }
  return null;
}

function parseBreadcrumbs(html: string) {
  for (const json of parseJsonLd(html)) {
    const breadcrumbs = findJsonLdNode<BreadcrumbList>(json, (node) => hasJsonLdType(node, "BreadcrumbList"));
    if (breadcrumbs?.itemListElement?.length) {
      return breadcrumbs.itemListElement
        .map((item) => item.item?.name ?? item.name)
        .filter((name): name is string => Boolean(name))
        .map(decodeHtml);
    }
  }
  return [];
}

function parseJsonLd(html: string) {
  return Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi), (match) =>
    safeJsonParse<unknown>(decodeHtml(match[1]?.trim() ?? ""))
  ).filter(Boolean);
}

function findJsonLdNode<T>(value: unknown, predicate: (node: Record<string, unknown>) => boolean): T | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findJsonLdNode<T>(item, predicate);
      if (match) return match;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const node = value as Record<string, unknown>;
  if (predicate(node)) return node as T;
  if (Array.isArray(node["@graph"])) return findJsonLdNode<T>(node["@graph"], predicate);
  return null;
}

function hasJsonLdType(node: Record<string, unknown>, type: string) {
  const value = node["@type"];
  return value === type || (Array.isArray(value) && value.includes(type));
}

function parseGalleryUrls(html: string) {
  return unique(
    Array.from(html.matchAll(/https:\/\/[^"'\s]+(?:theone|cdn|image)[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi), (match) =>
      decodeHtml(match[0].replace(/\\\//g, "/"))
    )
  );
}

function normalizeImageField(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function inferTheOneCategory(url: string, breadcrumbs: string[]) {
  const text = `${new URL(url).pathname} ${breadcrumbs.join(" ")}`.toLowerCase();
  if (/sofa|armchair|living|coffee-table|tv-unit/.test(text)) return "living room";
  if (/dining|sideboard|buffet/.test(text)) return "dining";
  if (/bed|bedside|dresser|wardrobe|chest/.test(text)) return "bedroom";
  if (/desk|office|chair/.test(text)) return "home office";
  if (/rug|floor/.test(text)) return "rugs/floor covering";
  if (/lamp|lighting|chandelier/.test(text)) return "lighting";
  if (/mirror|wall-art|wall-decor/.test(text)) return "mirrors/wall decor";
  if (/curtain|cushion|throw/.test(text)) return "soft furnishing";
  if (/storage|decor|vase|lantern/.test(text)) return "storage/decor";
  return "The One category";
}

function parseAvailability(value?: string) {
  if (value?.includes("InStock")) return "in stock";
  if (value?.includes("OutOfStock")) return "out of stock";
  return null;
}

function colorFromName(name: string) {
  const normalized = name.toLowerCase();
  const match = normalized.match(/\b(white|black|grey|gray|cream|beige|brown|nickel|brass|clear|blue|green|gold|silver)\b/);
  return match ? titleCase(match[1]) : null;
}

function materialFromName(name: string) {
  const normalized = name.toLowerCase();
  const match = normalized.match(/\b(wood|metal|glass|fabric|velvet|leather|marble|ceramic|rattan|nickel|brass)\b/);
  return match ? titleCase(match[1]) : null;
}

function dimensionsFromText(text: string) {
  const dimensionMatch = text.match(/(?:^|[-\s])(\d{1,3})\s*x\s*(\d{1,3})(?:\s*x\s*(\d{1,3}))?\s*cm(?:[-/\s]|$)/i);
  if (dimensionMatch) return [dimensionMatch[1], dimensionMatch[2], dimensionMatch[3]].filter(Boolean).join(" x ") + " cm";
  const heightMatch = text.match(/\bh\s*(\d{1,3})\s*cm\b/i);
  if (heightMatch) return `H ${heightMatch[1]} cm`;
  const diameterMatch = text.match(/\bdia\s*(\d{1,3})\s*cm\b/i);
  if (diameterMatch) return `Dia ${diameterMatch[1]} cm`;
  return null;
}

function skuFromUrl(url: string) {
  return new URL(url).pathname.match(/-(\d{5,})$/)?.[1] ?? null;
}

function nameFromUrl(url: string) {
  const slug = new URL(url).pathname.split("/").pop()?.replace(/-\d{5,}$/, "") ?? "";
  return slug ? titleCase(slug.replace(/-/g, " ")) : null;
}

function extractSourceFreshness(value: unknown) {
  return typeof value === "object" && value && "sourceFreshnessTimestamp" in value
    ? String(value.sourceFreshnessTimestamp)
    : null;
}

function extractSeedCategoryUrl(value: unknown) {
  return typeof value === "object" && value && "seedCategoryUrl" in value ? String(value.seedCategoryUrl) : null;
}

function normalizeTheOneUrl(url: string) {
  const parsed = new URL(decodeHtml(url.replace(/\\\//g, "/")));
  return parsed.toString().replace(/\/$/, "");
}

function matchContent(value: string, regex: RegExp) {
  return value.match(regex)?.[1] ?? null;
}

function stringifyPrice(value: unknown) {
  if (typeof value === "number") return value.toString();
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function stripHtml(value: string | null | undefined) {
  return value?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || null;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/[\s-]+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}
