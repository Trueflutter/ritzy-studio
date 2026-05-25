// ASSET: aura-cdn — temporary references to the purchased Aura template assets.
// Swap each entry to a Ritzy-rendered concept image in the follow-up swap PR.
//
// The Aura CDN domain is allow-listed in apps/web/next.config.ts (the wildcard
// *.supabase.co/storage/v1/**) so next/image works without further config.

export const AURA_ASSETS = {
  // Warm editorial living room — primary hero & full-bleed CTA backdrop.
  heroVideo:
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/generated-videos/66a84ecf-0972-40f3-8a4c-15b11d3aee0a/1779500363762-9c8dfe0b-f52e-462c-ab07-46cb6e1859e9.mp4",
  heroPoster:
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/545b052a-b0c2-4ec1-aeac-c36a8f948a5d_3840w.png",

  // Empty room (the "before" reference).
  beforeRoom:
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/de7c127b-e2ce-4fbc-af38-233509c064a3_800w.png",

  // Three concept interiors used across style cards + product cards.
  conceptEditorial:
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/545b052a-b0c2-4ec1-aeac-c36a8f948a5d_3840w.png",
  conceptEditorialSm:
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/545b052a-b0c2-4ec1-aeac-c36a8f948a5d_320w.png",
  conceptSoftMinimal:
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/f0141fd7-e67a-4967-b6eb-a5ad3dd479e8_320w.png",
  conceptWarmContemporary:
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/aaa4a07b-8f7b-407d-83bb-124126fea659_320w.png"
} as const;

// Retailer list from docs/Research/uae-retailer-ingestion-feasibility.md.
// P0 = first-class adapters (Home Centre live, IKEA next). P1 = next tranche.
export type Retailer = {
  name: string;
  priority: "P0" | "P1";
  // Display abbreviation used inside the SVG placeholder until real logos arrive.
  short: string;
};

export const RETAILERS: Retailer[] = [
  { name: "Home Centre", priority: "P0", short: "HC" },
  { name: "IKEA UAE", priority: "P0", short: "IKEA" },
  { name: "Crate & Barrel UAE", priority: "P1", short: "C&B" },
  { name: "2XL Home", priority: "P1", short: "2XL" },
  { name: "Chattels & More", priority: "P1", short: "C&M" },
  { name: "Pan Home", priority: "P1", short: "PAN" }
];
