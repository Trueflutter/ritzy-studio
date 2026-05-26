import type { CatalogAdapter, ProductDiscoveryResult, RawProductCandidate } from "../types";

const SITEMAP_URL = "https://www.marinahomeinteriors.com/uae_en_sitemap.xml";
const BASE_URL = "https://www.marinahomeinteriors.com";
const MARKET_PREFIX = `${BASE_URL}/en-uae/`;
const FETCH_DELAY_MS = 1_000;
const MAX_DEFAULT_DISCOVERIES = 4;
const MAX_DISCOVERIES = 8;
const RELEVANT_ROUTE_TERMS = [
  "/seating/",
  "/table/",
  "/tables",
  "/bed/",
  "/storage/",
  "/lighting/",
  "/rug/",
  "/decor/wall/",
  "/decor/fabric/"
];
const ROBOTS_NOTES =
  "robots.txt disallows cart, checkout, customer, catalogsearch, tag, review, Magento /catalog/category/view/ and /catalog/product/view/ paths, and ?filter= URLs. Adapter uses only clean /en-uae/...html sitemap URLs and rejects query/hash/search/filter/cart/account/checkout/review/tag/Magento /catalog/ paths before fetch.";
const TERMS_NOTES =
  "No official Marina Home feed or partner permission confirmed. Treat as controlled dry-run-only coverage using public UAE sitemap metadata at low request volume; prefer partner/feed approval before live writes or scale.";

type MarinaHomeSitemapPayload = {
  lastmod?: string | null;
  imageUrls?: string[];
  imageTitles?: string[];
  imageCaptions?: string[];
  sitemapCategoryUrl?: string | null;
};

type MarinaHomeSitemapEntry = MarinaHomeSitemapPayload & {
  url: string;
};

const cache = new Map<string, string>();
let lastFetchAt = 0;

export const marinaHomeAdapter: CatalogAdapter = {
  key: "marinahome-ae",
  dryRunOnly: true,
  retailer: {
    name: "Marina Home UAE",
    domain: "www.marinahomeinteriors.com",
    country: "AE",
    adapterKey: "marinahome-ae",
    status: "candidate",
    robotsNotes: ROBOTS_NOTES,
    termsNotes: TERMS_NOTES
  },
  getComplianceNotes: () => ({
    robotsNotes: ROBOTS_NOTES,
    termsNotes: TERMS_NOTES
  }),
  discoverProducts: async function* ({ limit, categories } = {}) {
    for (const discovery of parseMarinaHomeSitemapDiscoveries(await fetchText(SITEMAP_URL), { limit, categories })) {
      yield discovery;
    }
  },
  extractProduct: async (discovery) => {
    if (!isCleanMarinaHomeProductUrl(discovery.url)) {
      throw new Error(`Marina Home discovery URL is not a clean product URL: ${discovery.url}`);
    }

    return parseMarinaHomeProductHtml(await fetchText(discovery.url), discovery.url, discovery.categoryHint, discovery.sourcePayload);
  }
};

export const DEFAULT_CATEGORY_URLS = [
  "https://www.marinahomeinteriors.com/en-uae/seating/sofas.html",
  "https://www.marinahomeinteriors.com/en-uae/table/dining-tables.html",
  "https://www.marinahomeinteriors.com/en-uae/bed/beds.html",
  "https://www.marinahomeinteriors.com/en-uae/table/desks.html",
  "https://www.marinahomeinteriors.com/en-uae/storage/media-units.html",
  "https://www.marinahomeinteriors.com/en-uae/lighting/table-lamps.html",
  "https://www.marinahomeinteriors.com/en-uae/rug/handcrafted.html",
  "https://www.marinahomeinteriors.com/en-uae/decor/wall/mirrors.html",
  "https://www.marinahomeinteriors.com/en-uae/decor/fabric/cushion-covers.html"
];

export function parseMarinaHomeSitemapDiscoveries(
  xml: string,
  {
    limit,
    categories
  }: {
    limit?: number;
    categories?: string[];
  } = {}
): ProductDiscoveryResult[] {
  const allowedCategoryUrls = allowedMarinaHomeCategoryUrls(categories);
  const discoveryLimit = Math.min(limit ?? MAX_DEFAULT_DISCOVERIES, MAX_DISCOVERIES);
  const discoveries: ProductDiscoveryResult[] = [];
  const seenUrls = new Set<string>();

  for (const entry of parseMarinaHomeSitemapEntries(xml)) {
    if (!isCleanMarinaHomeProductUrl(entry.url) || seenUrls.has(entry.url)) {
      continue;
    }

    const categoryUrl = inferMarinaHomeCategoryUrl(entry.url);
    if (!allowedCategoryUrls.has(categoryUrl)) {
      continue;
    }

    seenUrls.add(entry.url);
    discoveries.push({
      url: entry.url,
      categoryHint: inferMarinaHomeCategory(entry.url),
      source: "sitemap",
      sourcePayload: {
        lastmod: entry.lastmod,
        imageUrls: entry.imageUrls,
        imageTitles: entry.imageTitles,
        imageCaptions: entry.imageCaptions,
        sitemapCategoryUrl: categoryUrl
      } satisfies MarinaHomeSitemapPayload
    });

    if (discoveries.length >= discoveryLimit) return discoveries;
  }

  return discoveries;
}

export function parseMarinaHomeSitemapEntries(xml: string): MarinaHomeSitemapEntry[] {
  return Array.from(xml.matchAll(/<url>([\s\S]*?)<\/url>/g), (match) => {
    const block = match[1] ?? "";
    return {
      url: decodeXml(matchContent(block, /<loc>\s*([^<]+)\s*<\/loc>/) ?? ""),
      lastmod: matchContent(block, /<lastmod>\s*([^<]+)\s*<\/lastmod>/),
      imageUrls: Array.from(block.matchAll(/<image:loc>\s*([^<]+)\s*<\/image:loc>/g), (imageMatch) =>
        decodeXml(imageMatch[1]?.trim() ?? "")
      ).filter(Boolean),
      imageTitles: Array.from(block.matchAll(/<image:title>\s*([^<]+)\s*<\/image:title>/g), (imageMatch) =>
        decodeXml(imageMatch[1]?.trim() ?? "")
      ).filter(Boolean),
      imageCaptions: Array.from(block.matchAll(/<image:caption>\s*([^<]+)\s*<\/image:caption>/g), (imageMatch) =>
        decodeXml(imageMatch[1]?.trim() ?? "")
      ).filter(Boolean)
    };
  }).filter((entry) => entry.url);
}

function allowedMarinaHomeCategoryUrls(categories?: string[]) {
  const defaultAllowed = new Set(DEFAULT_CATEGORY_URLS);
  if (!categories?.length) {
    return defaultAllowed;
  }

  return new Set(categories.filter((url) => defaultAllowed.has(url) && isCleanMarinaHomeCategoryUrl(url)));
}

export function parseMarinaHomeProductHtml(
  html: string,
  fallbackUrl: string,
  categoryHint?: string,
  sourcePayload?: unknown
): RawProductCandidate {
  if (!isCleanMarinaHomeProductUrl(fallbackUrl)) {
    throw new Error(`Marina Home fallback URL is not a clean product URL: ${fallbackUrl}`);
  }

  const payload = normalizeSitemapPayload(sourcePayload);
  const canonicalCandidate =
    matchContent(html, /<link\s+[^>]*rel="canonical"[^>]*href="([^"]+)"/i) ??
    matchContent(html, /<meta\s+property="og:url"\s+content="([^"]+)"/i) ??
    fallbackUrl;
  const canonicalUrl = isCleanMarinaHomeProductUrl(canonicalCandidate) ? normalizeMarinaHomeUrl(canonicalCandidate) : fallbackUrl;
  const name = nameFromPayload(payload) ?? nameFromUrl(canonicalUrl) ?? "Untitled Marina Home product";
  const images = unique([
    ...payload.imageUrls,
    matchContent(html, /<meta\s+property="og:image"\s+content="([^"]+)"/i)
  ]);

  return {
    canonicalUrl,
    name,
    retailerCategory: categoryHint ?? inferMarinaHomeCategory(canonicalUrl),
    description: null,
    externalSku: skuFromUrl(canonicalUrl),
    priceText: null,
    salePriceText: null,
    currency: "AED",
    availability: null,
    primaryImageUrl: images[0] ?? null,
    imageUrls: images,
    color: colorFromUrl(canonicalUrl),
    material: materialFromUrl(canonicalUrl),
    dimensionsText: null,
    sourcePayload: {
      source: "marinahome",
      sourceFreshnessTimestamp: payload.lastmod ?? null,
      sitemapCategoryUrl: payload.sitemapCategoryUrl ?? inferMarinaHomeCategoryUrl(canonicalUrl),
      imageTitles: payload.imageTitles,
      imageCaptions: payload.imageCaptions,
      nullFieldPolicy:
        "price, sale price, availability, dimensions, and rich attributes remain null unless future public clean fixtures prove them",
      robotsNotes: ROBOTS_NOTES
    }
  };
}

export function isCleanMarinaHomeCategoryUrl(url: string) {
  const normalized = normalizeMarinaHomeUrl(url);
  if (!isCleanMarinaHomePublicUrl(normalized)) return false;
  const pathname = new URL(normalized).pathname;
  if (!pathname.endsWith(".html")) return false;
  if (isLikelyProductPath(pathname)) return false;
  return RELEVANT_ROUTE_TERMS.some((term) => pathname.includes(term)) || DEFAULT_CATEGORY_URLS.includes(normalized);
}

export function isCleanMarinaHomeProductUrl(url: string) {
  const normalized = normalizeMarinaHomeUrl(url);
  if (!isCleanMarinaHomePublicUrl(normalized)) return false;
  const pathname = new URL(normalized).pathname;
  return pathname.endsWith(".html") && isLikelyProductPath(pathname);
}

function isCleanMarinaHomePublicUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== BASE_URL || parsed.search || parsed.hash) return false;
    if (!parsed.pathname.startsWith("/en-uae/")) return false;
    if (
      parsed.pathname.includes("/cart/") ||
      parsed.pathname.includes("/checkout/") ||
      parsed.pathname.includes("/customer/") ||
      parsed.pathname.includes("/catalogsearch/") ||
      parsed.pathname.includes("/tag/") ||
      parsed.pathname.includes("/review/") ||
      parsed.pathname.includes("/catalog/") ||
      parsed.pathname.includes("/account/") ||
      parsed.pathname.includes("/login/") ||
      parsed.pathname.includes("/payment/") ||
      parsed.pathname.includes("/rest/") ||
      parsed.pathname.includes("/graphql")
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function isLikelyProductPath(pathname: string) {
  const slug = pathname.split("/").pop() ?? "";
  return /-[a-z]{2,4}\d{3,5}\.html$/i.test(slug);
}

function inferMarinaHomeCategoryUrl(url: string) {
  const slug = new URL(url).pathname.split("/").pop() ?? "";
  if (/sofa|sectional|armchair|lounge-chair|swivel-chair|recliner|ottoman|pouf/.test(slug)) {
    return "https://www.marinahomeinteriors.com/en-uae/seating/sofas.html";
  }
  if (/dining-table/.test(slug)) return "https://www.marinahomeinteriors.com/en-uae/table/dining-tables.html";
  if (/desk/.test(slug)) return "https://www.marinahomeinteriors.com/en-uae/table/desks.html";
  if (/bedside/.test(slug)) return "https://www.marinahomeinteriors.com/en-uae/bed/bedside-tables.html";
  if (/\bbed\b|bed-/.test(slug)) return "https://www.marinahomeinteriors.com/en-uae/bed/beds.html";
  if (/sideboard/.test(slug)) return "https://www.marinahomeinteriors.com/en-uae/storage/side-boards.html";
  if (/media/.test(slug)) return "https://www.marinahomeinteriors.com/en-uae/storage/media-units.html";
  if (/lamp|chandelier|lantern/.test(slug)) return "https://www.marinahomeinteriors.com/en-uae/lighting/table-lamps.html";
  if (/rug|carpet/.test(slug)) return "https://www.marinahomeinteriors.com/en-uae/rug/handcrafted.html";
  if (/mirror|wall-art|photo|frame/.test(slug)) return "https://www.marinahomeinteriors.com/en-uae/decor/wall/mirrors.html";
  if (/cushion|pillow|throw|fabric/.test(slug)) return "https://www.marinahomeinteriors.com/en-uae/decor/fabric/cushion-covers.html";
  return "https://www.marinahomeinteriors.com/en-uae/decor.html";
}

function inferMarinaHomeCategory(url: string) {
  const slug = new URL(url).pathname.split("/").pop() ?? "";
  if (/sofa|sectional|armchair|chair|ottoman|pouf|recliner/.test(slug)) return "seating";
  if (/dining-table/.test(slug)) return "dining tables";
  if (/coffee-table|side-table|console|desk/.test(slug)) return "tables";
  if (/bedside|bed|dresser/.test(slug)) return "bedroom";
  if (/sideboard|media|shelving|bookcase|cabinet/.test(slug)) return "storage";
  if (/lamp|chandelier|lantern/.test(slug)) return "lighting";
  if (/rug|carpet/.test(slug)) return "rug";
  if (/mirror|wall-art|photo|frame/.test(slug)) return "wall decor";
  if (/cushion|pillow|throw|fabric/.test(slug)) return "soft furnishing";
  return "Marina Home sitemap product";
}

async function fetchText(url: string) {
  if (cache.has(url)) return cache.get(url) as string;

  const elapsed = Date.now() - lastFetchAt;
  if (elapsed < FETCH_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, FETCH_DELAY_MS - elapsed));
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": "RitzyStudioBot/0.1 (+https://ritzy-studio.local; dry-run catalog research)",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-AE,en;q=0.9"
    },
    signal: AbortSignal.timeout(25_000)
  });
  lastFetchAt = Date.now();

  if (!response.ok) throw new Error(`Marina Home fetch failed ${response.status} for ${url}`);
  const text = await response.text();
  cache.set(url, text);
  return text;
}

function normalizeSitemapPayload(value: unknown): Required<MarinaHomeSitemapPayload> {
  if (!value || typeof value !== "object") {
    return { lastmod: null, imageUrls: [], imageTitles: [], imageCaptions: [], sitemapCategoryUrl: null };
  }

  const payload = value as MarinaHomeSitemapPayload;
  return {
    lastmod: typeof payload.lastmod === "string" ? payload.lastmod : null,
    imageUrls: Array.isArray(payload.imageUrls) ? payload.imageUrls.filter(isUrl) : [],
    imageTitles: Array.isArray(payload.imageTitles) ? payload.imageTitles : [],
    imageCaptions: Array.isArray(payload.imageCaptions) ? payload.imageCaptions : [],
    sitemapCategoryUrl: typeof payload.sitemapCategoryUrl === "string" ? payload.sitemapCategoryUrl : null
  };
}

function nameFromPayload(payload: Required<MarinaHomeSitemapPayload>) {
  return payload.imageTitles[0]?.replace(/\s+\[IMAGE\]$/i, "").replace(/\s+/g, " ").trim() || null;
}

function nameFromUrl(url: string) {
  const slug = new URL(url).pathname.split("/").pop()?.replace(/\.html$/i, "") ?? "";
  const withoutSku = slug.replace(/-[a-z]{2,4}\d{3,5}$/i, "");
  return titleCase(withoutSku.replace(/-/g, " "));
}

function skuFromUrl(url: string) {
  return new URL(url).pathname.match(/-([a-z]{2,4}\d{3,5})\.html$/i)?.[1]?.toUpperCase() ?? null;
}

function colorFromUrl(url: string) {
  const slug = new URL(url).pathname.split("/").pop() ?? "";
  return matchKnownTerm(slug, ["beige", "black", "blue", "brown", "gold", "green", "grey", "gray", "multicolor", "silver", "white", "yellow"]);
}

function materialFromUrl(url: string) {
  const slug = new URL(url).pathname.split("/").pop() ?? "";
  return matchKnownTerm(slug, ["acrylic", "aluminium", "fabric", "glass", "leather", "metal", "plastic", "polyresin", "steel", "stone", "wood"]);
}

function matchKnownTerm(value: string, terms: string[]) {
  const match = terms.find((term) => new RegExp(`(?:^|-)${term}(?:-|\\.)`, "i").test(value));
  return match ? titleCase(match === "gray" ? "grey" : match) : null;
}

function normalizeMarinaHomeUrl(url: string) {
  if (url.startsWith("/")) return `${BASE_URL}${url}`;
  return url;
}

function matchContent(value: string, regex: RegExp) {
  return value.match(regex)?.[1] ?? null;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && isUrl(value))));
}

function isUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function decodeXml(value: string) {
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
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}
