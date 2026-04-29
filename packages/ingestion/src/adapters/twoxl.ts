import type { CatalogAdapter, ProductDiscoveryResult, RawProductCandidate } from "../types";

const BASE_URL = "https://2xlhome.com";
const DEFAULT_CATEGORY_URLS = [
  "https://2xlhome.com/ae-en/furniture/sofa-seating/sofas",
  "https://2xlhome.com/ae-en/furniture/sofa-seating/living-chair",
  "https://2xlhome.com/ae-en/furniture/living/tables/coffee-table",
  "https://2xlhome.com/ae-en/furniture/living/tables/side-table",
  "https://2xlhome.com/ae-en/furniture/bedroom/beds",
  "https://2xlhome.com/ae-en/furniture/dining/dining-tables"
];

const cache = new Map<string, string>();
let lastFetchAt = 0;

export const twoXlAdapter: CatalogAdapter = {
  key: "2xlhome-ae",
  retailer: {
    name: "2XL Home",
    domain: "2xlhome.com",
    country: "AE",
    adapterKey: "2xlhome-ae",
    status: "candidate",
    robotsNotes:
      "robots.txt allows / and lists sitemap files; disallows checkout, customer, review, sendfriend, parameterized and internal Magento paths.",
    termsNotes:
      "No official feed confirmed for MVP. Adapter uses public Magento category/product pages with light rate limiting."
  },
  getComplianceNotes: () => ({
    robotsNotes:
      "robots.txt allows public pages and disallows checkout/customer/review/internal Magento/parameterized URLs.",
    termsNotes:
      "Use category and product pages only; prefer approved feed or B2B/trade access long term."
  }),
  discoverProducts: async function* ({ limit, categories } = {}) {
    const categoryUrls = categories?.length ? categories : DEFAULT_CATEGORY_URLS;
    let yielded = 0;

    for (const categoryUrl of categoryUrls) {
      const html = await fetchText(categoryUrl);
      for (const url of parseTwoXlProductUrls(html)) {
        yield { url, categoryHint: categoryUrl, source: "category_page" };
        yielded += 1;
        if (limit && yielded >= limit) return;
      }
    }
  },
  extractProduct: async (discovery) =>
    parseTwoXlProductHtml(await fetchText(discovery.url), discovery.url, discovery.categoryHint)
};

export function parseTwoXlProductUrls(html: string) {
  const urls = new Set<string>();
  for (const match of html.matchAll(/https:\/\/2xlhome\.com\/ae-en\/[a-z0-9-]+/g)) {
    const url = match[0];
    if (isLikelyProductUrl(url)) {
      urls.add(url);
    }
  }
  return Array.from(urls);
}

export function parseTwoXlProductHtml(
  html: string,
  fallbackUrl: string,
  categoryHint?: string
): RawProductCandidate {
  const name =
    matchContent(html, /<meta property="og:title" content="([^"]+)"/) ??
    matchContent(html, /"name":"([^"]+)"/) ??
    "Untitled product";
  const price =
    matchContent(html, /"final_price":(\d+(?:\.\d+)?)/) ??
    matchContent(html, /"price":(\d+(?:\.\d+)?)/);
  const regularPrice = matchContent(html, /"regular_price":(\d+(?:\.\d+)?)/);
  const image =
    matchContent(html, /<meta property="og:image" content="([^"]+)"/) ??
    matchContent(html, /"url":"(https:\\\/\\\/2xlhome\.com\\\/media\\\/catalog\\\/product[^"]+)"/);
  const sku =
    matchContent(html, /"productSku": "([^"]+)"/) ??
    matchContent(html, /catalog_product_view_sku_([A-Za-z0-9_-]+)/);

  return {
    canonicalUrl: fallbackUrl,
    name: decodeHtml(name),
    retailerCategory: categoryHint ?? null,
    description: stripHtml(matchContent(html, /<meta name="description" content="([^"]+)"/) ?? null),
    externalSku: sku ?? null,
    priceText: regularPrice ?? price ?? null,
    salePriceText: regularPrice && price && Number(regularPrice) > Number(price) ? price : null,
    currency: "AED",
    availability: html.includes('"is_salable":"1"') || html.includes('"is_available":true') ? "in stock" : null,
    primaryImageUrl: image ? decodeEscapedUrl(image) : null,
    imageUrls: image ? [decodeEscapedUrl(image)] : [],
    color: null,
    material: null,
    dimensionsText: dimensionsFromUrl(fallbackUrl)
  };
}

async function fetchText(url: string) {
  if (cache.has(url)) return cache.get(url) as string;

  const elapsed = Date.now() - lastFetchAt;
  if (elapsed < 500) {
    await new Promise((resolve) => setTimeout(resolve, 500 - elapsed));
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": "RitzyStudioBot/0.1 (+https://ritzy-studio.local; light catalog ingestion)"
    }
  });
  lastFetchAt = Date.now();

  if (!response.ok) throw new Error(`2XL Home fetch failed ${response.status} for ${url}`);
  const text = await response.text();
  cache.set(url, text);
  return text;
}

function isLikelyProductUrl(url: string) {
  const path = new URL(url).pathname;
  if (path.includes("/furniture/") || path.includes("/checkout") || path.includes("/customer")) {
    return false;
  }
  return /-\d{4,}$/.test(path) || /\d+x\d+/.test(path);
}

function matchContent(html: string, regex: RegExp) {
  return html.match(regex)?.[1] ?? null;
}

function decodeEscapedUrl(value: string) {
  return decodeHtml(value.replace(/\\\//g, "/"));
}

function dimensionsFromUrl(url: string) {
  const path = new URL(url).pathname;
  const match = path.match(/(?:^|-)(\d{2,3})x(\d{2,3})x(\d{2,3})(?:-|$)/);
  return match ? `${match[1]} x ${match[2]} x ${match[3]} cm` : null;
}

function stripHtml(value: string | null) {
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
