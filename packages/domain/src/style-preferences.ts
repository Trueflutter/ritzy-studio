export type VisualStyleOption = {
  slug: string;
  name: string;
  description: string;
  tags: string[];
};

export const visualStyleOptions = [
  {
    slug: "modern",
    name: "Modern",
    description: "Clean lines, minimal decoration, neutral colour, sleek finishes, and functional furniture.",
    tags: ["modern", "clean", "minimal", "neutral", "sleek"]
  },
  {
    slug: "contemporary",
    name: "Contemporary",
    description: "Current, expressive interiors with mixed textures, curved forms, and evolving design details.",
    tags: ["contemporary", "current", "curved", "textured", "trend"]
  },
  {
    slug: "scandinavian",
    name: "Scandinavian",
    description: "Light, airy rooms with soft neutrals, natural wood, cozy textures, and practical furniture.",
    tags: ["scandinavian", "airy", "light", "wood", "cozy", "functional"]
  },
  {
    slug: "industrial",
    name: "Industrial",
    description: "Warehouse-inspired spaces with exposed brick, metal, concrete, darker tones, and raw finishes.",
    tags: ["industrial", "brick", "metal", "concrete", "raw", "dark"]
  },
  {
    slug: "traditional",
    name: "Traditional",
    description: "Classic elegance with detailed moldings, rich wood, layered fabrics, and timeless furniture.",
    tags: ["traditional", "classic", "elegant", "molding", "wood", "timeless"]
  },
  {
    slug: "bohemian",
    name: "Bohemian",
    description: "Relaxed and expressive rooms with mixed patterns, vibrant colour, plants, natural materials, and collected decor.",
    tags: ["bohemian", "boho", "pattern", "colour", "plants", "collected"]
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
