export type VisualStyleOption = {
  slug: string;
  name: string;
  description: string;
  tags: string[];
};

export const visualStyleOptions = [
  {
    slug: "warm-minimal",
    name: "Warm minimal",
    description: "Calm rooms, soft neutrals, natural texture, and very little visual noise.",
    tags: ["warm", "minimal", "neutral", "natural"]
  },
  {
    slug: "modern-organic",
    name: "Modern organic",
    description: "Curved forms, stone, wood, linen, and relaxed contemporary pieces.",
    tags: ["modern", "organic", "wood", "linen"]
  },
  {
    slug: "quiet-luxury",
    name: "Quiet luxury",
    description: "Hotel-level polish, tailored upholstery, rich texture, and restrained colour.",
    tags: ["luxury", "tailored", "hotel", "textured"]
  },
  {
    slug: "classic-contemporary",
    name: "Classic contemporary",
    description: "Timeless silhouettes, balanced symmetry, soft contrast, and elegant details.",
    tags: ["classic", "contemporary", "elegant", "balanced"]
  },
  {
    slug: "coastal-light",
    name: "Coastal light",
    description: "Airy, pale, relaxed, and sun-washed without feeling themed.",
    tags: ["coastal", "airy", "light", "relaxed"]
  },
  {
    slug: "earthy-rustic",
    name: "Earthy rustic",
    description: "Grounded woods, woven pieces, tactile finishes, and a relaxed lived-in mood.",
    tags: ["earthy", "rustic", "woven", "tactile"]
  }
] satisfies VisualStyleOption[];

export function visualStyleSummary(slugs: string[]) {
  const selected = visualStyleOptions.filter((option) => slugs.includes(option.slug));
  if (selected.length === 0) {
    return null;
  }

  return selected
    .map((option) => `${option.name}: ${option.description}`)
    .join(" ");
}
