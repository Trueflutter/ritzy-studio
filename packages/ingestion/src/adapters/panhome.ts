import type { CatalogAdapter, ProductDiscoveryResult, RawProductCandidate } from "../types";

const ROOT_SITEMAP_URL = "https://www.panhomestores.com/media/uae_en_sitemap.xml";
const PRODUCT_URL_PREFIX = "https://www.panhomestores.com/uae_en/";
const CHILD_SITEMAP_PATTERN = /^https:\/\/www\.panhomestores\.com\/pub\/media\/uae_en_sitemap_\d+\.xml$/;
const RELEVANT_SLUG_TERMS = [
  "living",
  "sofa",
  "couch",
  "coffee-table",
  "end-table",
  "side-table",
  "console",
  "tv-unit",
  "media",
  "dining",
  "chair",
  "sideboard",
  "bed",
  "nightstand",
  "bedside",
  "dresser",
  "wardrobe",
  "desk",
  "office",
  "rug",
  "carpet",
  "floor",
  "lamp",
  "lighting",
  "mirror",
  "wall-art",
  "wall-decor",
  "wall-mirror",
  "painting",
  "canvas",
  "curtain",
  "cushion",
  "storage",
  "decor",
  "vase"
];
const ROBOTS_NOTES =
  "robots.txt lists the UAE sitemap and disallows checkout, customer/my-account, search, catalog view, SID, and parameterized filter/sort/price URLs. Adapter uses clean /uae_en/ product URLs from sitemap only.";
const TERMS_NOTES =
  "No official Pan Home feed confirmed. Treat as controlled dry-run-only coverage using public sitemap/product pages at low request volume; prefer partner/feed approval before live writes.";

type PanHomeSitemapPayload = {
  lastmod?: string | null;
  imageUrls?: string[];
  imageTitles?: string[];
};

const cache = new Map<string, string>();
let lastFetchAt = 0;

export const panHomeAdapter: CatalogAdapter = {
  key: "panhome-ae",
  dryRunOnly: true,
  retailer: {
    name: "Pan Home",
    domain: "www.panhomestores.com",
    country: "AE",
    adapterKey: "panhome-ae",
    status: "candidate",
    robotsNotes: ROBOTS_NOTES,
    termsNotes: TERMS_NOTES
  },
  getComplianceNotes: () => ({
    robotsNotes: ROBOTS_NOTES,
    termsNotes: TERMS_NOTES
  }),
  discoverProducts: async function* ({ limit, categories } = {}) {
    const childSitemaps = categories?.length ? categories : parsePanHomeChildSitemaps(await fetchText(ROOT_SITEMAP_URL));
    const seenUrls = new Set<string>();
    let yielded = 0;

    for (const sitemapUrl of childSitemaps) {
      if (!CHILD_SITEMAP_PATTERN.test(sitemapUrl)) {
        continue;
      }

      const entries = parsePanHomeSitemapEntries(await fetchText(sitemapUrl));
      for (const entry of entries) {
        if (!isCleanPanHomeProductUrl(entry.url) || !isRelevantPanHomeProductUrl(entry.url) || seenUrls.has(entry.url)) {
          continue;
        }

        seenUrls.add(entry.url);
        yield {
          url: entry.url,
          categoryHint: inferPanHomeCategory(entry.url),
          source: "sitemap",
          sourcePayload: {
            lastmod: entry.lastmod,
            imageUrls: entry.imageUrls,
            imageTitles: entry.imageTitles
          } satisfies PanHomeSitemapPayload
        };
        yielded += 1;
        if (limit && yielded >= limit) return;
      }
    }
  },
  extractProduct: async (discovery) =>
    parsePanHomeProductHtml(await fetchText(discovery.url), discovery.url, discovery.categoryHint, discovery.sourcePayload)
};

export function parsePanHomeChildSitemaps(xml: string) {
  return Array.from(xml.matchAll(/<loc>\s*([^<]+uae_en_sitemap_\d+\.xml)\s*<\/loc>/g), (match) =>
    decodeXml(match[1].trim())
  ).filter((url) => CHILD_SITEMAP_PATTERN.test(url));
}

export function parsePanHomeSitemapEntries(xml: string) {
  return Array.from(xml.matchAll(/<url>([\s\S]*?)<\/url>/g), (match) => {
    const block = match[1];
    const url = decodeXml(matchContent(block, /<loc>\s*([^<]+)\s*<\/loc>/) ?? "");
    return {
      url,
      lastmod: matchContent(block, /<lastmod>\s*([^<]+)\s*<\/lastmod>/),
      imageUrls: Array.from(block.matchAll(/<image:loc>\s*([^<]+)\s*<\/image:loc>/g), (imageMatch) =>
        decodeXml(imageMatch[1].trim())
      ),
      imageTitles: Array.from(block.matchAll(/<image:title>\s*([^<]+)\s*<\/image:title>/g), (imageMatch) =>
        decodeXml(imageMatch[1].trim())
      )
    };
  }).filter((entry) => entry.url);
}

export function parsePanHomeProductHtml(
  html: string,
  fallbackUrl: string,
  categoryHint?: string,
  sourcePayload?: unknown
): RawProductCandidate {
  const sitemapPayload = normalizeSitemapPayload(sourcePayload);
  const sitemapImageUrls = sitemapPayload.imageUrls ?? [];
  const actionName = parsePanHomeActionName(html);
  const name =
    actionName.name ??
    matchContent(html, /<meta property="og:title" content="([^"]+)"/) ??
    matchContent(html, /<title>\s*([^<]+)\s*<\/title>/) ??
    "Untitled Pan Home product";
  const galleryUrls = unique([
    actionName.imageUrl,
    ...actionName.galleryUrls,
    ...sitemapImageUrls,
    matchContent(html, /<meta property="og:image" content="([^"]+)"/)
  ]);
  const prices = parsePanHomePrices(html);
  const category = categoryHint ?? inferPanHomeCategory(fallbackUrl);

  return {
    canonicalUrl: matchContent(html, /<link rel="canonical" href="([^"]+)"/) ?? fallbackUrl,
    name: decodeHtml(name),
    retailerCategory: category,
    description: stripHtml(matchContent(html, /<meta name="description" content="([^"]+)"/) ?? null),
    externalSku: actionName.sku ?? skuFromUrl(fallbackUrl),
    priceText: prices.priceText,
    salePriceText: prices.salePriceText,
    currency: "AED",
    availability: actionName.stockSignal,
    primaryImageUrl: galleryUrls[0] ?? null,
    imageUrls: galleryUrls,
    color: parseAttribute(html, "color") ?? colorFromName(name),
    material: parseMaterial(html, name),
    dimensionsText: parseAttribute(html, "dimensions") ?? dimensionsFromText(`${name} ${fallbackUrl}`),
    sourcePayload: {
      source: "panhome",
      sourceFreshnessTimestamp: sitemapPayload.lastmod ?? null,
      sitemapImageCount: sitemapImageUrls.length,
      stockQuantity: actionName.availableQty,
      robotsNotes: ROBOTS_NOTES,
      attributes: {
        fabric: parseAttribute(html, "fabric"),
        finish: parseAttribute(html, "finish")
      }
    }
  };
}

export function isCleanPanHomeProductUrl(url: string) {
  if (!url.startsWith(PRODUCT_URL_PREFIX) || url.includes("?") || url.includes("#")) {
    return false;
  }

  const path = new URL(url).pathname;
  if (
    [
      "/uae_en/",
      "/uae_en/enable-cookies",
      "/uae_en/privacy-policy-cookie-restriction-mode",
      "/uae_en/faqs",
      "/uae_en/about-us",
      "/uae_en/interior-design"
    ].includes(path)
  ) {
    return false;
  }

  return /-[a-z0-9]*\d{5,}$/i.test(path);
}

function isRelevantPanHomeProductUrl(url: string) {
  const slug = new URL(url).pathname.split("/").pop() ?? "";
  return RELEVANT_SLUG_TERMS.some((term) => slug.includes(term));
}

function parsePanHomeActionName(html: string) {
  const sku = matchBacktickValue(html, "sku");
  const name = matchBacktickValue(html, "name");
  const imageUrl = normalizeImageUrl(matchBacktickValue(html, "imageUrl"));
  const pageJson = matchContent(html, /page:\s*(\{[\s\S]*?\})\s*\|\|\s*\{\}/);
  const mediaGalleryRaw = matchBacktickValue(html, "mediaGallery");
  const galleryUrls = mediaGalleryRaw ? extractGalleryUrls(mediaGalleryRaw) : [];
  const page = safeJsonParse<{ isInStock?: number | boolean; availableQty?: Array<{ available_qty?: number }> }>(pageJson);
  const availableQty = page?.availableQty?.reduce((total, item) => total + (Number(item.available_qty) || 0), 0) ?? null;
  const isInStock = page?.isInStock;

  return {
    sku,
    name,
    imageUrl,
    galleryUrls,
    availableQty,
    stockSignal:
      isInStock === 1 || isInStock === true || (availableQty !== null && availableQty > 0)
        ? "in stock"
        : isInStock === 0 || isInStock === false || availableQty === 0
          ? "out of stock"
          : null
  };
}

function parsePanHomePrices(html: string) {
  const finalPrice =
    matchContent(html, /"final_price"\s*:\s*\{\s*"value"\s*:\s*(\d+(?:\.\d+)?)/) ??
    matchContent(html, /"final_price"\s*:\s*(\d+(?:\.\d+)?)/) ??
    matchContent(html, /"price"\s*:\s*(\d+(?:\.\d+)?)/);
  const regularPrice =
    matchContent(html, /"regular_price"\s*:\s*\{\s*"value"\s*:\s*(\d+(?:\.\d+)?)/) ??
    matchContent(html, /"regular_price"\s*:\s*(\d+(?:\.\d+)?)/);

  return {
    priceText: regularPrice ?? finalPrice ?? null,
    salePriceText: regularPrice && finalPrice && Number(regularPrice) > Number(finalPrice) ? finalPrice : null
  };
}

function parseMaterial(html: string, name: string) {
  return (
    parseAttribute(html, "material") ??
    parseAttribute(html, "fabric") ??
    parseAttribute(html, "finish") ??
    matchContent(name.toLowerCase(), /\b(marble|wood|metal|glass|velvet|leather|cotton|fabric|ceramic|rattan)\b/)
  );
}

function parseAttribute(html: string, label: string) {
  const pattern = new RegExp(
    `<(?:th|td|span|div)[^>]*>\\s*${label}\\s*<\\/(?:th|td|span|div)>\\s*<(?:td|span|div)[^>]*>\\s*([^<]+)`,
    "i"
  );
  return stripHtml(matchContent(html, pattern));
}

function inferPanHomeCategory(url: string) {
  const slug = new URL(url).pathname.split("/").pop() ?? "";
  if (/sofa|couch|coffee-table|end-table|side-table|tv-unit|living/.test(slug)) return "living room";
  if (/dining|sideboard/.test(slug)) return "dining";
  if (/bed|nightstand|bedside|dresser|wardrobe/.test(slug)) return "bedroom";
  if (/desk|office/.test(slug)) return "home office";
  if (/rug|carpet|floor/.test(slug)) return "rugs/floor covering";
  if (/lamp|lighting/.test(slug)) return "lighting";
  if (/mirror|wall-art|wall-decor|wall-mirror|painting|canvas/.test(slug)) return "mirrors/wall decor";
  if (/curtain|cushion|fabric|textile/.test(slug)) return "soft furnishing";
  if (/storage|decor|vase/.test(slug)) return "storage/decor";
  return "Pan Home sitemap product";
}

async function fetchText(url: string) {
  if (cache.has(url)) return cache.get(url) as string;

  const elapsed = Date.now() - lastFetchAt;
  if (elapsed < 700) {
    await new Promise((resolve) => setTimeout(resolve, 700 - elapsed));
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": "RitzyStudioBot/0.1 (+https://ritzy-studio.local; dry-run catalog research)"
    },
    signal: AbortSignal.timeout(20000)
  });
  lastFetchAt = Date.now();

  if (!response.ok) throw new Error(`Pan Home fetch failed ${response.status} for ${url}`);
  const text = await response.text();
  cache.set(url, text);
  return text;
}

function extractGalleryUrls(value: string) {
  const parsed = safeJsonParse<Array<Record<string, { url?: string }>>>(value.replace(/\\"/g, '"').replace(/\\\//g, "/"));
  if (!Array.isArray(parsed)) return [];

  return unique(
    parsed.flatMap((item) =>
      [item.base?.url, item.large?.url, item.thumbnail?.url].map((url) => normalizeImageUrl(url)).filter(Boolean)
    )
  );
}

function normalizeSitemapPayload(value: unknown): PanHomeSitemapPayload {
  if (!value || typeof value !== "object") {
    return { imageUrls: [], imageTitles: [] };
  }

  const payload = value as PanHomeSitemapPayload;
  return {
    lastmod: typeof payload.lastmod === "string" ? payload.lastmod : null,
    imageUrls: Array.isArray(payload.imageUrls) ? payload.imageUrls : [],
    imageTitles: Array.isArray(payload.imageTitles) ? payload.imageTitles : []
  };
}

function dimensionsFromText(text: string) {
  const match = text.match(/(?:^|[-\s])(\d{1,3})\s*x\s*(\d{1,3})(?:\s*x\s*(\d{1,3}))?\s*(?:cm|cms)?(?:[-\s]|$)/i);
  return match ? [match[1], match[2], match[3]].filter(Boolean).join(" x ") + " cm" : null;
}

function colorFromName(name: string) {
  const match = name.match(/[-–]\s*([A-Za-z &/]+)$/);
  return match ? titleCase(match[1].replace(/\s+/g, " ").trim()) : null;
}

function skuFromUrl(url: string) {
  return (new URL(url).pathname.match(/-([a-z0-9]*\d{5,})$/i)?.[1] ?? null)?.toUpperCase() ?? null;
}

function matchBacktickValue(html: string, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return matchContent(html, new RegExp(`${escapedKey}:\\s*\`([\\s\\S]*?)\`\\s*(?:\\|\\|\\s*null)?\\s*(?:,|\\})`));
}

function matchContent(value: string, regex: RegExp) {
  return value.match(regex)?.[1] ?? null;
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeImageUrl(value: string | null | undefined) {
  return value ? decodeHtml(value.replace(/\\\//g, "/")) : null;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function stripHtml(value: string | null) {
  return value?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || null;
}

function decodeXml(value: string) {
  return decodeHtml(value);
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
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}
