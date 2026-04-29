import type { Database } from "@ritzy-studio/db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CatalogSupabaseClient = SupabaseClient<Database>;

export type RetailerComplianceNotes = {
  robotsNotes?: string | null;
  termsNotes?: string | null;
};

export type RetailerRegistration = {
  name: string;
  domain: string;
  country?: string;
  adapterKey: string;
  status?: Database["public"]["Enums"]["retailer_status"];
} & RetailerComplianceNotes;

export type ProductDiscoveryResult = {
  url: string;
  categoryHint?: string;
  source: "sitemap" | "category_page" | "search_page" | "structured_data" | "manual_seed";
};

export type RawProductCandidate = {
  canonicalUrl: string;
  name: string;
  retailerCategory?: string | null;
  description?: string | null;
  externalSku?: string | null;
  priceText?: string | null;
  salePriceText?: string | null;
  currency?: string | null;
  availability?: string | null;
  primaryImageUrl?: string | null;
  imageUrls?: string[];
  color?: string | null;
  material?: string | null;
  dimensionsText?: string | null;
  sourcePayload?: unknown;
};

export type NormalizedProductRecord = {
  product: {
    canonical_url: string;
    name: string;
    description: string | null;
    external_sku: string | null;
    category_raw: string | null;
    category_normalized: string | null;
    price_aed: number | null;
    sale_price_aed: number | null;
    currency: string;
    availability: string | null;
    primary_image_url: string | null;
    color: string | null;
    material: string | null;
    style_tags: string[];
    room_tags: string[];
    data_confidence: Database["public"]["Enums"]["confidence_level"];
    last_checked_at: string;
  };
  dimensions: {
    width_cm: number | null;
    depth_cm: number | null;
    height_cm: number | null;
    diameter_cm: number | null;
    source_text: string | null;
    confidence: Database["public"]["Enums"]["confidence_level"];
  } | null;
  images: Array<{
    image_url: string;
    sort_order: number;
    alt_text: string | null;
    source: string | null;
  }>;
};

export type CatalogAdapter = {
  key: string;
  retailer: RetailerRegistration;
  getComplianceNotes?: () => Promise<RetailerComplianceNotes> | RetailerComplianceNotes;
  discoverProducts: (options?: {
    limit?: number;
    categories?: string[];
  }) => AsyncIterable<ProductDiscoveryResult> | Promise<AsyncIterable<ProductDiscoveryResult>>;
  extractProduct: (discovery: ProductDiscoveryResult) => Promise<RawProductCandidate>;
};
