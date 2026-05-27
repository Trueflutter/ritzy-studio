export const AURA_ASSETS = {
  heroPoster: "/landing-page-images/hero-design-the-room.webp",
  heroPosterThumb: "/landing-page-images/hero-design-the-room-thumb.webp",

  beforeRoom: "/landing-page-images/hero-before.webp",
  beforeRoomThumb: "/landing-page-images/hero-before-thumb.webp",

  sourceTheRoom: "/landing-page-images/source-the-room.webp",
  conceptEditorial: "/landing-page-images/extra-additional.webp",
  finalCta: "/landing-page-images/design-next-version.webp",

  styleContemporary: "/landing-page-images/style-contemporary.webp",
  styleContemporaryThumb: "/landing-page-images/style-contemporary-thumb.webp",
  styleModern: "/landing-page-images/style-modern.webp",
  styleModernThumb: "/landing-page-images/style-modern-thumb.webp",
  styleScandinavian: "/landing-page-images/style-scandinavian.webp",
  styleScandinavianThumb: "/landing-page-images/style-scandinavian-thumb.webp",
  styleBohemian: "/landing-page-images/style-bohemian.webp",
  styleBohemianThumb: "/landing-page-images/style-bohemian-thumb.webp"
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
