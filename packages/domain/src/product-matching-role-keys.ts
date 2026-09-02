// What survives of the catalogue-first product-matching apparatus, which S3
// retired: the two helpers that still describe how a role's category is
// normalised for reconciliation. The QA stop-rule, confidence tiering and
// pool-summary machinery around them had no caller left once sourcing was
// rebuilt against the confirmed spec, and a module that still exported them
// would tell the next reader this pipeline has gates it does not have.

function normalizeRoleKeyPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function productMatchRoleKey(category: string, roleLabel: string) {
  return `${normalizeRoleKeyPart(category)}::${normalizeRoleKeyPart(roleLabel)}`;
}

function isBedRoleText(text: string, normalizedCategory: string) {
  if (normalizedCategory === "beds") {
    return true;
  }

  return /\bbed(s)?\b/.test(text);
}

export function normalizeProductMatchRoleResultCategory(category: string, roleLabel: string) {
  const normalizedCategory = normalizeRoleKeyPart(category);
  const text = `${category} ${roleLabel}`.toLowerCase();

  if (normalizedCategory === "side_tables") {
    return "side_tables";
  }

  if (text.includes("dining") && text.includes("chair")) {
    return "chairs";
  }

  if (text.includes("headboard")) {
    return "headboards";
  }

  if (text.includes("nightstand") || (text.includes("bedside") && text.includes("table"))) {
    return "side_tables";
  }

  if (text.includes("dining") && text.includes("table")) {
    return "dining_tables";
  }

  if (text.includes("desk")) {
    return "desks";
  }

  if (text.includes("office") && text.includes("chair")) {
    return "office_chairs";
  }

  if (text.includes("armchair") || text.includes("chair") || text.includes("lounge")) {
    return "armchairs";
  }

  if (text.includes("sofa") || text.includes("sectional") || text.includes("seating")) {
    return "sofas";
  }

  if (text.includes("coffee")) {
    return "coffee_tables";
  }

  if (text.includes("side table") || text.includes("side_tables") || text.includes("occasional")) {
    return "side_tables";
  }

  if (text.includes("rug") || text.includes("flatweave")) {
    return "rugs";
  }

  if (text.includes("wall") || text.includes("art") || text.includes("canvas")) {
    return "wall_art";
  }

  if (text.includes("lamp") || text.includes("light") || text.includes("pendant")) {
    return "lighting";
  }

  if (text.includes("mirror")) {
    return "mirrors";
  }

  if (text.includes("decor") || text.includes("vase") || text.includes("cushion")) {
    return "decor";
  }

  if (text.includes("console") || text.includes("storage") || text.includes("media")) {
    return "storage";
  }

  if (isBedRoleText(text, normalizedCategory)) {
    return "beds";
  }

  return normalizedCategory;
}
