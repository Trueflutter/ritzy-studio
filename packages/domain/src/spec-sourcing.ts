import { z } from "zod";

import type { DesignSpecObject } from "./design-spec";
import {
  buildRoleScopedCandidatePools,
  classTagsConflictWithRole,
  roleClassContractForRole,
  roleOptionKey,
  roomScopeConflictsWithRole,
  sizeClassConflictsWithRole,
  type ProductMatchCandidate,
  type ProductMatchRequest,
  type RoleProductOptions,
  type RoleScopedRankedProductMatch,
  type RoleSizeClass,
  type RoomProductRoleSpec
} from "./product-matching";

// S3: the confirmed design spec is the sourcing contract. Each purchasable spec
// object becomes a sourcing role with a canonical catalogue category and a HARD
// contract (category, class tags, room scope, lighting fixture class, seating
// silhouette, seat capacity, size class). A candidate that violates the
// contract can never be selected for that role, however well it scores; a role
// with no surviving candidate is reported as missing, never filled with the
// wrong thing. This is the mechanism behind the two Phase 0 failures the plan
// names (chandelier for a floor-lamp role, swing chair for a lounge chair).

export type SpecRoleFixtureClass = "floor_or_table" | "ceiling" | "wall";

// Catalogue categories are the strings products.category_normalized carries
// (the exported canonical list predates "sofas", which the scorer and the
// catalogue both use), so the contract speaks the same vocabulary as the rows.
export type SourcingCategory = string;

export type SpecRoleContract = {
  category: SourcingCategory;
  roomType: string;
  fixtureClass?: SpecRoleFixtureClass;
  // The kinds of object this role can be filled by, when the spec names one
  // ("tray and small bowl" -> tray, bowl). A candidate whose own name says it
  // is a different kind can never fill the role: a vase is not a tray, and a
  // battery table lamp is not an arc floor lamp.
  objectKinds?: string[];
  // Seat range the spec asks for (from `capacity`), when it names one.
  minSeats?: number;
  maxSeats?: number;
  // Silhouette tokens that can never fill this seating role (unless the spec
  // itself asks for them, e.g. a rocking chair).
  excludedSilhouettes: string[];
};

export type SpecSourcingRole = RoomProductRoleSpec & {
  specKey: string;
  // The short label the visual pass is asked to echo ("role-3"): unique per
  // role, well under the response schema's label cap, and immune to label
  // edits, casing and truncation. Reconciliation matches on it first.
  echoKey: string;
  specObjectIndex: number;
  specRole: string;
  specLabel: string;
  // The spec object's own words, kept apart from the joined visual brief so
  // the visual pass can be told size, capacity and palette as the spec says.
  specSizeDescriptor: string | null;
  specCapacity: string | null;
  specPaletteMaterials: string[];
  contract: SpecRoleContract;
};

export type UnsourceableSpecObject = {
  specKey: string;
  specObjectIndex: number;
  kind: "built_in" | "no_catalogue_category";
  label: string;
  quantity: number;
  reason: string;
};

export type SpecContractRejection =
  | "category_mismatch"
  | "class_tag_conflict"
  | "room_scope_conflict"
  | "object_kind_mismatch"
  | "lighting_fixture_class_mismatch"
  | "silhouette_excluded"
  | "capacity_mismatch"
  | "size_class_mismatch";

export type SpecContractVerdict = { ok: true } | { ok: false; reason: SpecContractRejection };

// The jsonb contract of shopping_lists.missing_roles (migration M2): one entry
// per spec object the list does not carry, with the reason and what to do.
export const missingRoleEntrySchema = z.object({
  specKey: z.string().min(1).max(80),
  kind: z.enum(["missing", "built_in", "no_catalogue_category"]),
  label: z.string().min(1).max(200),
  category: z.string().min(1).max(60).nullable(),
  quantity: z.number().int().min(1).max(99),
  reason: z.string().min(1).max(400),
  guidance: z.string().min(1).max(400)
});

export const missingRolesSchema = z.array(missingRoleEntrySchema).max(60);

export type MissingRoleEntry = z.infer<typeof missingRoleEntrySchema>;

// Reads the jsonb column; a malformed value reads as "nothing recorded" so the
// screens never crash on a hand-edited row, and never invent entries either.
export function parseMissingRoles(value: unknown): MissingRoleEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  // Per entry: one malformed entry must not make the whole column read as
  // "nothing missing" (false completeness is the failure mode AC 9 forbids).
  return value.flatMap((entry) => {
    const parsed = missingRoleEntrySchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export function missingRoleEntryForUnsourceable(entry: UnsourceableSpecObject): MissingRoleEntry {
  return {
    specKey: entry.specKey,
    kind: entry.kind,
    label: entry.label,
    category: null,
    quantity: entry.quantity,
    reason: entry.reason,
    guidance:
      entry.kind === "built_in"
        ? "Nothing to buy for this one."
        : "Source it directly from a retailer; the design keeps it."
  };
}

// ---------------------------------------------------------------- mapping

const ANCHOR_CATEGORIES = new Set<SourcingCategory>([
  "sofas",
  "armchairs",
  "beds",
  "headboards",
  "chairs",
  "dining_tables",
  "coffee_tables",
  "side_tables",
  "desks",
  "office_chairs",
  "storage",
  "lighting",
  "rugs"
]);

const BUILT_IN_PHRASES = [
  "recessed",
  "downlight",
  "spotlight",
  "track light",
  "cove light",
  "cove lighting",
  "led strip",
  "skylight",
  "fireplace",
  "built in",
  "ceiling fan",
  "radiator",
  "air conditioning",
  "ac unit",
  "flooring",
  "floor tiles",
  "wall panel",
  "panelling",
  "paneling",
  "wainscot",
  "cornice",
  "skirting",
  "curtain rail",
  "curtain track",
  "ceiling beam",
  "window frame",
  "door frame"
];

type CategoryRule = { category: SourcingCategory; phrases: string[] };

// Ordered: the first rule whose phrase appears in the text wins. Head nouns
// that ride on a furniture modifier (desk lamp, bedside lamp, bed throw,
// coffee table books, desk chair) are claimed by their own rule BEFORE the
// generic furniture nouns (desk, bedside, bed, coffee table, chair) can
// swallow them; specific phrases (dining chair, bedding) precede the generic
// nouns they contain for the same reason.
// Compound head nouns that ride on a furniture modifier are claimed first
// (desk lamp is a lamp, bed throw a throw, desk chair an office chair); then
// the furniture rules, most specific first (bedside table before bed, dining
// chair before chair); lighting and decor's generic tokens ("light", "lamp",
// "tray", "bowl") come after every furniture rule so "light oak dining table"
// and "bowl chair" keep their furniture.
const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "lighting",
    phrases: ["desk lamp", "bedside lamp", "table lamp", "floor lamp", "wall lamp", "reading lamp", "task lamp", "standing lamp", "tripod lamp", "arc lamp", "pendant lamp", "ceiling lamp"]
  },
  { category: "decor", phrases: ["bed throw", "sofa throw", "coffee table book", "bed cushion", "sofa cushion", "throw pillow", "scatter cushion"] },
  { category: "bedding", phrases: ["bed runner", "bed linen", "bedsheet", "bed sheet", "bed pillow"] },
  { category: "office_chairs", phrases: ["office chair", "task chair", "desk chair"] },
  { category: "stools", phrases: ["bar stool", "counter stool", "bar chair", "counter chair"] },
  { category: "chairs", phrases: ["dining chair", "dining chairs", "dining seat"] },
  { category: "sofas", phrases: ["sofa bed", "sofabed", "sleeper sofa"] },
  {
    category: "side_tables",
    phrases: ["bedside", "nightstand", "night stand", "side table", "end table", "accent table", "occasional table", "console table", "lamp table", "hall table"]
  },
  { category: "coffee_tables", phrases: ["coffee table", "cocktail table", "centre table", "center table"] },
  { category: "dining_tables", phrases: ["dining table"] },
  { category: "desks", phrases: ["desk", "workstation", "writing table"] },
  { category: "stools", phrases: ["stool", "ottoman", "pouf", "pouffe", "footstool", "bench"] },
  {
    category: "armchairs",
    phrases: ["armchair", "arm chair", "lounge chair", "accent chair", "occasional chair", "club chair", "wingback", "slipper chair", "reading chair", "swivel chair", "rocking chair", "chair"]
  },
  { category: "sofas", phrases: ["sofa", "sectional", "loveseat", "couch", "chaise", "settee", "daybed", "modular seating"] },
  { category: "headboards", phrases: ["headboard"] },
  { category: "bedding", phrases: ["bedding", "duvet", "quilt", "coverlet", "comforter", "bedspread", "pillowcase"] },
  { category: "beds", phrases: ["bed frame", "bed"] },
  { category: "rugs", phrases: ["rug", "carpet", "runner"] },
  { category: "curtains", phrases: ["curtain", "drape", "drapery", "sheer", "blind", "blinds"] },
  { category: "mirrors", phrases: ["mirror"] },
  { category: "wall_art", phrases: ["wall art", "artwork", "art print", "painting", "canvas", "poster", "framed print", "gallery wall", "art"] },
  {
    category: "lighting",
    phrases: ["lamp", "pendant", "chandelier", "sconce", "lighting", "light", "lantern", "luminaire"]
  },
  {
    category: "storage",
    phrases: ["media console", "tv unit", "tv console", "tv stand", "media unit", "entertainment unit", "sideboard", "credenza", "buffet", "bookcase", "bookshelf", "shelving", "shelves", "shelf", "cabinet", "dresser", "chest of drawers", "chest", "wardrobe", "armoire", "display unit", "storage", "console", "bar cart", "trolley"]
  },
  {
    category: "decor",
    phrases: ["cushion", "throw", "pillow", "vase", "plant", "planter", "tray", "candle", "sculpture", "decor", "accessory", "accessories", "basket", "bowl", "books", "greenery", "clock", "figurine", "ornament", "object"]
  },
  { category: "towels", phrases: ["towel"] }
];

// A label often places the object ("artwork above the fireplace", "pendant
// over the dining table"). Only the clause before the placement preposition
// describes the object itself; the rest names other things in the room.
// A placement clause is a linking word FOLLOWED BY AN ARTICLE ("above the
// fireplace", "near a window", "to the left of the bed"); "wrap around
// sectional" and "under bed storage" have no article and stay whole.
const PLACEMENT_LINKS = [
  "above", "over", "beside", "flanking", "facing", "near", "at", "in", "under", "beneath", "below", "behind",
  "next to", "by", "around", "opposite", "against", "along", "alongside", "between", "in front of", "on",
  "on top of", "either side of", "to the left of", "to the right of", "across from", "toward", "towards"
];
const ARTICLES = "(?:the|a|an|its|your|this|that|our|their|each|either|both|my|his|her)";

// Links that also cut when followed (within three modifier words) by a room
// object at the END of the text: "light over dining table", "sofa opposite six
// seater dining table", "rug under coffee table". "around" never joins this
// list ("wrap around sectional"), and a link whose object is followed by more
// words ("under bed storage drawers") is a compound modifier, not a placement.
const OBJECT_PLACEMENT_LINKS = [
  "above", "over", "beside", "flanking", "facing", "near", "at", "under", "beneath", "below", "behind",
  "next to", "by", "opposite", "against", "along", "alongside", "between", "in front of", "on", "atop", "toward", "towards"
];
const ROOM_OBJECT_PHRASES = [
  ...new Set([
    ...CATEGORY_RULES.flatMap((rule) => rule.phrases),
    "wall", "ceiling", "window", "windows", "door", "doors", "fireplace", "floor", "corner", "island", "tv", "television",
    "terrace", "balcony", "hallway", "entrance", "stairs", "column", "columns", "niche", "alcove", "mantel", "mantelpiece",
    "media console", "media unit", "console", "counter", "worktop", "vanity", "bath", "shower"
  ])
];
// Inside a phrase, and after a link, a word boundary may be written as a space
// OR a hyphen: labels say "dining table", "dining-table", "8-seat dining-table".
// The seat-parsing copy of the label keeps its hyphens, so a space-only pattern
// would leave the placement clause uncut there and let the OTHER object's seat
// count become this role's capacity. The boundary BEFORE a link stays a space,
// so compounds ("wrap-around sectional", "built-in storage") are never read as
// placement.
const WORD_BREAK = "[\\s-]+";
function phrasePattern(phrase: string) {
  return phrase.replace(/\s+/g, WORD_BREAK);
}
const ROOM_OBJECT_PATTERN = ROOM_OBJECT_PHRASES.map(phrasePattern).join("|");

export function placementStrippedText(text: string): string {
  let head = text;
  for (const link of PLACEMENT_LINKS) {
    const pattern = new RegExp(`(?:^|\\s)${phrasePattern(link)}${WORD_BREAK}${ARTICLES}(?:${WORD_BREAK}|$)`);
    const match = pattern.exec(head);
    if (match && match.index > 0) {
      head = head.slice(0, match.index).trim();
    }
  }
  for (const link of OBJECT_PLACEMENT_LINKS) {
    const pattern = new RegExp(
      `(?:^|\\s)${phrasePattern(link)}(?:${WORD_BREAK}[a-z0-9-]+){0,3}?${WORD_BREAK}(?:${ROOM_OBJECT_PATTERN})(?:s|es)?$`
    );
    const match = pattern.exec(head);
    if (match && match.index > 0) {
      head = head.slice(0, match.index).trim();
    }
  }
  return head;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

// Seat parsing needs the hyphens ("6-8 seater", "8-seat"): the same
// normalization, hyphens kept, so placement stripping sees one token per word.
function normalizeTextKeepingHyphens(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/[^a-z0-9-]+/g, " ").replace(/\s+/g, " ").trim();
}

function hasPhrase(text: string, phrase: string) {
  return new RegExp(`(?:^|\\s)${phrase.replace(/\s+/g, "\\s+")}(?:s|es)?(?:\\s|$)`).test(text);
}

function categoryForText(text: string): SourcingCategory | null {
  for (const rule of CATEGORY_RULES) {
    if (rule.phrases.some((phrase) => hasPhrase(text, phrase))) {
      return rule.category;
    }
  }
  return null;
}

// Compound phrases whose head noun rides on a furniture modifier: claimed on
// the whole text before the head-noun step, so "dining chair" is a dining
// chair (chairs), not a chair (armchairs), and "floor lamp" a floor lamp.
const LEADING_COMPOUND_RULES: CategoryRule[] = CATEGORY_RULES.slice(0, 7);

// The extractor's role keys and most labels end in their head noun
// ("coffee_table_sculpture", "media_console_books", "stack of coffee table
// books"): the head noun decides before the whole text can be swallowed by an
// earlier rule naming the furniture the object sits on.
function categoryForObjectText(text: string): SourcingCategory | null {
  for (const rule of LEADING_COMPOUND_RULES) {
    if (rule.phrases.some((phrase) => hasPhrase(text, phrase))) {
      return rule.category;
    }
  }
  const tokens = text.split(" ").filter(Boolean);
  const head = tokens[tokens.length - 1] ?? "";
  return (head ? categoryForText(head) : null) ?? categoryForText(text);
}

function withoutParentheticals(value: string) {
  return value.replace(/\([^)]*\)/g, " ");
}

function isBuiltIn(text: string) {
  return BUILT_IN_PHRASES.some((phrase) => hasPhrase(text, phrase));
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  ten: 10,
  twelve: 12
};

function numberFromToken(token: string): number | null {
  if (/^\d+$/.test(token)) {
    return Number(token);
  }
  return NUMBER_WORDS[token] ?? null;
}

const NUMBER_TOKEN = "(\\d+|one|two|three|four|five|six|seven|eight|ten|twelve)";

// "seats 6", "seats 6-8", "seats up to 8", "6 seater", "three-seat",
// "2-3 seater" -> a seat range. Text is normalized first (hyphens become
// spaces), so a range is two numbers separated by whitespace or "to"; a
// two-digit count can never be split into a fake range.
export function parseSeatRange(value: string | null | undefined): { min: number; max: number } | null {
  if (!value) {
    return null;
  }
  // Ranges need an explicit separator on the RAW text (hyphen, en dash, "to"):
  // "seats 6-8", "seats 6 to 8", "2-3 seater". A number that merely follows
  // ("Seats 4. 10 year guarantee.") is noise, never the top of a range.
  const raw = value.toLowerCase();
  const separator = "\\s*(?:-|\u2013|to)\\s*";
  const rawSeatsRange = raw.match(new RegExp(`\\bseats?\\s+(?:up\\s+to\\s+)?${NUMBER_TOKEN}${separator}${NUMBER_TOKEN}\\b`));
  const rawSeaterRange = raw.match(new RegExp(`\\b${NUMBER_TOKEN}${separator}${NUMBER_TOKEN}\\s*-?\\s*seat(?:er|s)?\\b`));
  const range = rawSeatsRange ?? rawSeaterRange;
  if (range) {
    const min = numberFromToken(range[1]);
    const max = numberFromToken(range[2]);
    if (min !== null && max !== null && min > 0 && min <= max) {
      return { min, max };
    }
  }
  const text = normalizeText(value);
  const upTo = text.match(new RegExp(`\\bseats?\\s+up\\s+to\\s+${NUMBER_TOKEN}\\b`));
  if (upTo) {
    const max = numberFromToken(upTo[1]);
    if (max !== null && max > 0) {
      return { min: 1, max };
    }
  }
  const seatsForm = text.match(new RegExp(`\\bseats?\\s+${NUMBER_TOKEN}\\b`));
  const nSeater = text.match(new RegExp(`\\b${NUMBER_TOKEN}\\s*seat(?:er|s)?\\b`));
  const token = seatsForm?.[1] ?? nSeater?.[1];
  const seats = token ? numberFromToken(token) : null;
  return seats !== null && seats > 0 ? { min: seats, max: seats } : null;
}

const LARGE_SOFA_PHRASES = ["sectional", "corner", "modular", "chaise", "l shaped", "u shaped"];

// Mirrors the scorer's vocabulary: "large" means a sectional/corner/modular
// silhouette (a straight four-seater is "standard" there), "compact" a
// loveseat or two-seater.
function sofaSizeClassForSpec(text: string, seats: { min: number; max: number } | null): RoleSizeClass {
  if (LARGE_SOFA_PHRASES.some((phrase) => hasPhrase(text, phrase))) {
    return "large";
  }
  if (hasPhrase(text, "loveseat") || (seats && seats.max <= 2)) {
    return "compact";
  }
  // Five seats and up (as a floor, a ceiling or a range) with no shape word:
  // the spec proved capacity, not a straight silhouette, so a sectional may
  // fill it and capacity constrains.
  if (seats && seats.max >= 5) {
    return "any";
  }
  return "standard";
}

const WALL_FIXTURE_PHRASES = ["sconce", "wall light", "wall lamp", "wall mounted light", "wall mounted lamp", "picture light"];
const CEILING_FIXTURE_PHRASES = ["pendant", "chandelier", "ceiling", "flush mount", "semi flush", "hanging", "suspension", "downlight", "recessed"];
const FLOOR_OR_TABLE_PHRASES = ["floor lamp", "table lamp", "desk lamp", "bedside lamp", "task lamp", "reading lamp", "floor light", "standing lamp", "tripod lamp", "arc lamp"];

// Role text is the spec's own words ("floor/table lighting", "bedside lamp"),
// so a bare floor/table/bedside/desk token is enough to classify a ROLE. A
// candidate's marketing text is not, and keeps the strict phrase list.
const FLOOR_OR_TABLE_ROLE_TOKENS = ["floor", "table", "desk", "task", "bedside", "reading", "standing", "tripod", "arc"];

function fixtureClassForRoleText(text: string): SpecRoleFixtureClass | undefined {
  const strict = fixtureClassForText(text);
  if (strict) {
    return strict;
  }
  const tokens = new Set(text.split(" ").filter(Boolean));
  return FLOOR_OR_TABLE_ROLE_TOKENS.some((token) => tokens.has(token)) ? "floor_or_table" : undefined;
}

// An explicit floor/table lamp phrase names the fixture outright and wins
// over incidental ceiling words ("uplighter washes light across the
// ceiling"); wall before ceiling because "wall light" and "sconce" are as
// explicit; ceiling words last.
function fixtureClassForText(text: string): SpecRoleFixtureClass | undefined {
  if (FLOOR_OR_TABLE_PHRASES.some((phrase) => hasPhrase(text, phrase))) {
    return "floor_or_table";
  }
  if (WALL_FIXTURE_PHRASES.some((phrase) => hasPhrase(text, phrase))) {
    return "wall";
  }
  if (CEILING_FIXTURE_PHRASES.some((phrase) => hasPhrase(text, phrase))) {
    return "ceiling";
  }
  return undefined;
}

// Object KIND, finer than the catalogue category. Two categories are grab
// bags whose members are not interchangeable: decor holds vases, trays, bowls,
// sculptures, candles, books and plants, and lighting holds floor lamps and
// table lamps under one fixture class. The live run put vases into a tray
// role, a bowl role and a sculpture role, and a swap put a battery table lamp
// into an arc floor-lamp role; every one of them passed every other contract.
// Rules are ordered most specific first, and the kind a rule names is the
// human noun used in the honest missing-role reason.
const OBJECT_KIND_RULES: Array<{ kind: string; phrases: string[] }> = [
  { kind: "floor lamp", phrases: ["floor lamp", "floor light", "arc lamp", "arch lamp", "arched lamp", "standing lamp", "tripod lamp", "torchiere"] },
  { kind: "table lamp", phrases: ["table lamp", "desk lamp", "bedside lamp", "reading lamp", "task lamp", "accent lamp", "bedside light"] },
  { kind: "cushion", phrases: ["cushion", "pillow", "bolster"] },
  { kind: "throw", phrases: ["throw", "blanket", "plaid"] },
  { kind: "tray", phrases: ["tray", "platter"] },
  { kind: "bowl", phrases: ["bowl", "dish"] },
  { kind: "vase", phrases: ["vase", "vessel", "urn", "jug", "carafe"] },
  { kind: "sculpture", phrases: ["sculpture", "figurine", "statue", "statuette", "bust", "objet"] },
  { kind: "candle", phrases: ["candle", "candleholder", "candle holder", "candlestick", "tealight", "tea light", "diffuser"] },
  { kind: "book", phrases: ["book", "coffee table book"] },
  { kind: "plant", phrases: ["plant", "planter", "greenery", "fern", "palm", "fig", "olive tree", "succulent", "orchid", "bouquet", "stems"] },
  { kind: "basket", phrases: ["basket", "hamper"] },
  { kind: "clock", phrases: ["clock"] }
];

// Only where the evidence says a category is a grab bag. Anchor furniture is
// already separated by category, class tags and size, and artwork or textiles
// would over-reject on wording alone ("canvas" against "painting").
const KIND_CONSTRAINED_CATEGORIES = new Set<string>(["decor", "lighting"]);

// Catch-all nouns that make a line open-ended: "cushions, tray, ceramics and
// decor" names EXAMPLES, not a closed list, so pinning it to the two nouns
// that happen to be in the rules would reject everything else it invites.
// These are nouns, so an adjective ("decorative tray", "ceramic sculpture")
// still reads as a closed enumeration.
const OPEN_KIND_TAIL_PHRASES = [
  "decor", "accessory", "accessories", "object", "objects", "ceramics", "styling", "accent", "accents",
  "furnishings", "soft furnishings", "ornaments", "pieces", "items", "props"
];

// Every kind a text names. Both sides use this: a role line may ask for two
// ("decorative tray and small bowl") and a product may name two ("Marble Bowl
// and Tray Set"); the contract holds when the two sets intersect.
function objectKindsIn(text: string): string[] {
  return OBJECT_KIND_RULES.filter((rule) => rule.phrases.some((phrase) => hasPhrase(text, phrase))).map((rule) => rule.kind);
}

// The role's kinds: its own noun decides, exactly as the fixture class does,
// and the label speaks only when the role names no kind at all. Anything else
// lets a kind mentioned in passing ("arc floor lamp echoing the table lamp
// opposite") silently widen the contract.
function objectKindsForRole(roleText: string, labelText: string): string[] | undefined {
  for (const text of [placementStrippedText(roleText), labelText]) {
    const kinds = objectKindsIn(text);
    if (kinds.length === 0) {
      continue;
    }
    return OPEN_KIND_TAIL_PHRASES.some((phrase) => hasPhrase(text, phrase)) ? undefined : kinds;
  }
  return undefined;
}

const SEATING_CATEGORIES = new Set<string>(["sofas", "armchairs", "chairs", "stools"]);
// Silhouettes a lounge/dining seating role can never accept. The unambiguous
// ones are proof wherever they appear, description included ("this rocking
// chair"); the ambiguous ones are matched against the name and style tags
// only, so marketing copy ("perfect for hanging out", "garden-inspired
// palette") never rejects a fitting piece.
const SEATING_SILHOUETTE_EXCLUSIONS = [
  "swing",
  "rocking",
  "rocker",
  "hanging chair",
  "hanging egg",
  "hammock",
  "egg chair",
  "gaming",
  "massage",
  "outdoor",
  "garden",
  "patio",
  "inflatable",
  "bean bag",
  "beanbag"
];
// A spec that names a silhouette ("oak rocking chair") opts out of its whole
// synonym group, so a "rocker" can fill a rocking-chair role.
const SILHOUETTE_GROUPS: string[][] = [
  ["rocking", "rocker"],
  ["swing", "hanging chair", "hanging egg", "egg chair", "hammock"],
  ["bean bag", "beanbag"],
  ["outdoor", "garden", "patio"],
  ["gaming"],
  ["massage"],
  ["inflatable"]
];

function excludedSilhouettesFor(specText: string): string[] {
  const requested = new Set<string>();
  for (const group of SILHOUETTE_GROUPS) {
    if (group.some((phrase) => hasPhrase(specText, phrase))) {
      group.forEach((phrase) => requested.add(phrase));
    }
  }
  return SEATING_SILHOUETTE_EXCLUSIONS.filter((phrase) => !requested.has(phrase));
}

const UNAMBIGUOUS_SILHOUETTES = new Set([
  "rocking",
  "rocker",
  "hanging chair",
  "hanging egg",
  "hammock",
  "egg chair",
  "massage",
  "inflatable",
  "bean bag",
  "beanbag"
]);

function visualBriefFor(object: DesignSpecObject) {
  return [object.label, object.sizeDescriptor, object.capacity, object.paletteMaterials.join(", ")]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join("; ");
}

export function sourcingRolesFromDesignSpec(
  spec: { objects: DesignSpecObject[] },
  roomType: string
): { roles: SpecSourcingRole[]; unsourceable: UnsourceableSpecObject[] } {
  const roles: SpecSourcingRole[] = [];
  const unsourceable: UnsourceableSpecObject[] = [];

  // Two spec objects with the same label in one category are one role with
  // the summed quantity: persisted rows and the picker identify a role by
  // category plus label, so two roles with one label would double-select and
  // double-count. Merged by normalized label (casing and spacing ignored).
  const merged: DesignSpecObject[] = [];
  const mergedIndexByKey = new Map<string, number>();
  for (const object of spec.objects) {
    const key = `${normalizeText(object.role)}|${normalizeText(object.label)}`;
    const existingIndex = mergedIndexByKey.get(key);
    if (existingIndex === undefined) {
      mergedIndexByKey.set(key, merged.length);
      merged.push({ ...object, paletteMaterials: [...object.paletteMaterials] });
      continue;
    }
    const existing = merged[existingIndex];
    merged[existingIndex] = {
      ...existing,
      quantity: existing.quantity + object.quantity,
      sizeDescriptor: existing.sizeDescriptor ?? object.sizeDescriptor,
      capacity: existing.capacity ?? object.capacity,
      paletteMaterials: Array.from(new Set([...existing.paletteMaterials, ...object.paletteMaterials]))
    };
  }

  merged.forEach((object, index) => {
    const roleText = normalizeText(object.role);
    // The label's object clause only: parentheticals ("(coffee table)") and
    // placement phrases ("above the fireplace", "on media console") name the
    // things the object sits on or near, not the object.
    const labelText = placementStrippedText(normalizeText(withoutParentheticals(object.label)));
    // Seat parsing needs the hyphens ("6-8 seater"), so it reads a
    // placement-stripped, hyphen-keeping copy of the label: a placement clause
    // naming an "8-seat dining table" is cut before any count is read.
    const rawLabelForSeats = placementStrippedText(normalizeTextKeepingHyphens(withoutParentheticals(object.label)));
    const specKey = `${index}:${roleText.replace(/\s+/g, "_") || "object"}`;

    if (isBuiltIn(roleText) || isBuiltIn(labelText)) {
      unsourceable.push({
        specKey,
        specObjectIndex: index,
        kind: "built_in",
        label: object.label,
        quantity: object.quantity,
        reason: "Built into the room; not a purchasable piece."
      });
      return;
    }

    // The role field is the extractor's clean noun ("pendant", "dining_table",
    // "coffee_table_sculpture"); it decides first, head noun before whole
    // text. A role key that carries a placement clause ("cushions_on_sofa",
    // "rug_under_coffee_table") is read for its object clause only, so the
    // furniture an object sits on or near never claims it. The label decides
    // when the role is vague; a whole key is never a fallback, because the
    // only category it could add is the placement furniture's.
    const category = categoryForObjectText(placementStrippedText(roleText)) ?? categoryForObjectText(labelText);
    if (!category) {
      unsourceable.push({
        specKey,
        specObjectIndex: index,
        kind: "no_catalogue_category",
        label: object.label,
        quantity: object.quantity,
        reason: "The catalogue has no category for this piece yet."
      });
      return;
    }

    roles.push(
      specSourcingRole({
        category,
        roomType,
        roleText,
        labelText,
        specKey,
        specObjectIndex: index,
        specRole: object.role,
        label: object.label,
        visualBrief: visualBriefFor(object),
        quantity: object.quantity,
        seats: parseSeatRange(object.capacity) ?? parseSeatRange(rawLabelForSeats),
        specSizeDescriptor: object.sizeDescriptor,
        specCapacity: object.capacity,
        specPaletteMaterials: object.paletteMaterials
      })
    );
  });

  return { roles, unsourceable };
}

function specSourcingRole({
  category,
  roomType,
  roleText,
  labelText,
  specKey,
  specObjectIndex,
  specRole,
  label,
  visualBrief,
  quantity,
  seats,
  specSizeDescriptor,
  specCapacity,
  specPaletteMaterials,
  priority
}: {
  category: SourcingCategory;
  roomType: string;
  roleText: string;
  labelText: string;
  specKey: string;
  specObjectIndex: number;
  specRole: string;
  label: string;
  visualBrief: string | null;
  quantity: number;
  seats: { min: number; max: number } | null;
  specSizeDescriptor: string | null;
  specCapacity: string | null;
  specPaletteMaterials: string[];
  priority?: "required" | "supporting";
}): SpecSourcingRole {
  const combined = `${roleText} ${labelText}`;
  // The role noun decides the fixture class; the label only when the role is
  // unclassifiable ("floor_lamp" stays a floor lamp whatever its label says
  // about where it hangs).
  const contract: SpecRoleContract = {
    category,
    roomType,
    fixtureClass:
      category === "lighting" ? (fixtureClassForRoleText(roleText) ?? fixtureClassForRoleText(labelText)) : undefined,
    objectKinds: KIND_CONSTRAINED_CATEGORIES.has(category) ? objectKindsForRole(roleText, labelText) : undefined,
    minSeats: seats?.min,
    maxSeats: seats?.max,
    excludedSilhouettes: SEATING_CATEGORIES.has(category) ? excludedSilhouettesFor(combined) : []
  };
  const baseRole: RoomProductRoleSpec = {
    category,
    label,
    visualBrief,
    quantity,
    priority: priority ?? (ANCHOR_CATEGORIES.has(category) ? "required" : "supporting"),
    sizeClass: category === "sofas" ? sofaSizeClassForSpec(combined, seats) : undefined
  };
  const classContract = roleClassContractForRole(baseRole, roomType);
  return {
    ...baseRole,
    allowedCategories: classContract.allowedCategories,
    roomScope: classContract.roomScope,
    roleKey: `${category}::${specKey}`,
    specKey,
    echoKey: `role-${specObjectIndex + 1}`,
    specObjectIndex,
    specRole,
    specLabel: label,
    specSizeDescriptor,
    specCapacity,
    specPaletteMaterials,
    contract
  };
}

// The no-spec fallback (a room whose extraction failed and whose user chose
// to source anyway): the room-type blueprint roles, carried through the same
// contract machinery so the list is still honest about what it could not
// fill. Categories are the blueprint's own; only the contract is derived.
export function sourcingRolesFromBlueprint(
  blueprint: ReadonlyArray<{
    category: string;
    label: string;
    visualBrief?: string | null;
    quantity: number;
    required?: boolean;
  }>,
  roomType: string
): SpecSourcingRole[] {
  return blueprint.map((role, index) =>
    specSourcingRole({
      category: role.category,
      roomType,
      roleText: normalizeText(role.category),
      labelText: normalizeText(role.label),
      specKey: `blueprint:${index}:${role.category}`,
      specObjectIndex: index,
      specRole: role.category,
      label: role.label,
      visualBrief: role.visualBrief ?? null,
      quantity: Math.max(1, role.quantity),
      seats: parseSeatRange(role.label),
      specSizeDescriptor: null,
      specCapacity: null,
      specPaletteMaterials: [],
      priority: role.required ? "required" : "supporting"
    })
  );
}

// ---------------------------------------------------------------- contract

function candidateText(candidate: ProductMatchCandidate) {
  return normalizeText(
    [candidate.name, candidate.description, candidate.color, candidate.material, ...candidate.styleTags, ...candidate.roomTags]
      .filter((part): part is string => Boolean(part))
      .join(" ")
  );
}

// Seats a candidate offers: from its text, else (sofas only) from its width.
// Silence stays null: a contract can only reject what it can prove.
export function candidateSeatRange(candidate: ProductMatchCandidate): { min: number; max: number } | null {
  const fromText = parseSeatRange(`${candidate.name} ${candidate.description ?? ""}`);
  if (fromText) {
    return fromText;
  }
  if (candidate.categoryNormalized !== "sofas") {
    return null;
  }
  const width = candidate.dimensions?.widthCm ?? null;
  if (width === null) {
    return null;
  }
  if (width >= 210) {
    return { min: 3, max: 6 };
  }
  if (width >= 165) {
    return { min: 2, max: 3 };
  }
  return { min: 1, max: 2 };
}

export function checkCandidateAgainstSpecRole(
  candidate: ProductMatchCandidate,
  role: SpecSourcingRole
): SpecContractVerdict {
  const contract = roleClassContractForRole(role, role.contract.roomType);
  if (!candidate.categoryNormalized || !contract.allowedCategories.includes(candidate.categoryNormalized)) {
    return { ok: false, reason: "category_mismatch" };
  }
  if (classTagsConflictWithRole(candidate, contract)) {
    return { ok: false, reason: "class_tag_conflict" };
  }
  if (roomScopeConflictsWithRole(candidate, contract)) {
    return { ok: false, reason: "room_scope_conflict" };
  }

  // Classification reads what the product IS (name, style tags), never its
  // marketing copy: a floor lamp that "washes light across the ceiling" is
  // still a floor lamp, and a sofa "for hanging out" is still a sofa.
  const nameText = normalizeText([candidate.name, ...candidate.styleTags].join(" "));

  if (role.contract.fixtureClass) {
    const candidateClass = fixtureClassForText(nameText);
    if (candidateClass && candidateClass !== role.contract.fixtureClass) {
      return { ok: false, reason: "lighting_fixture_class_mismatch" };
    }
  }

  if (role.contract.objectKinds && role.contract.objectKinds.length > 0) {
    // A product's kinds come from its NAME and style tags only, never its
    // marketing copy, and one shared kind is enough: a bowl-and-tray set fills
    // a bowl role. A product naming no kind cannot be proven wrong.
    const candidateKinds = objectKindsIn(nameText);
    const kinds = role.contract.objectKinds;
    if (candidateKinds.length > 0 && !candidateKinds.some((kind) => kinds.includes(kind))) {
      return { ok: false, reason: "object_kind_mismatch" };
    }
  }

  const fullText = candidateText(candidate);
  if (
    role.contract.excludedSilhouettes.some((phrase) =>
      hasPhrase(UNAMBIGUOUS_SILHOUETTES.has(phrase) ? fullText : nameText, phrase)
    )
  ) {
    return { ok: false, reason: "silhouette_excluded" };
  }

  if (role.contract.minSeats !== undefined && role.contract.maxSeats !== undefined) {
    const seats = candidateSeatRange(candidate);
    if (seats && (seats.max < role.contract.minSeats || seats.min > role.contract.maxSeats)) {
      return { ok: false, reason: "capacity_mismatch" };
    }
  }

  if (sizeClassConflictsWithRole(candidate, contract)) {
    return { ok: false, reason: "size_class_mismatch" };
  }

  return { ok: true };
}

// ------------------------------------------------------------------ plan

export type SpecRolePool = {
  role: SpecSourcingRole;
  // Contract-clean, scorer-ranked candidates for this role.
  candidates: RoleScopedRankedProductMatch[];
  // Why the rest were left out (contract rejections plus the scorer's gates).
  rejectionReasons: Record<string, number>;
};

export type SpecSourcingPlan = {
  pools: SpecRolePool[];
  missing: MissingRoleEntry[];
};

const CATEGORY_NOUNS: Record<string, string> = {
  armchairs: "armchair",
  bedding: "bedding",
  beds: "bed",
  chairs: "chair",
  coffee_tables: "coffee table",
  curtains: "curtains",
  decor: "decor piece",
  desks: "desk",
  dining_tables: "dining table",
  headboards: "headboard",
  lighting: "light",
  mirrors: "mirror",
  office_chairs: "office chair",
  rugs: "rug",
  side_tables: "side table",
  sofas: "sofa",
  storage: "storage piece",
  stools: "stool",
  towels: "towel",
  wall_art: "artwork"
};

export function humanizeCategory(category: string): string {
  return CATEGORY_NOUNS[category] ?? category.replace(/_/g, " ");
}

export const MISSING_ROLE_GUIDANCE =
  "Try Refresh matches after the nightly catalogue update, or source this piece directly from a retailer.";

// "tray", "tray or bowl", "tray, bowl or candle". No articles: the kinds are
// dropped into a sentence and some are already plural in the reader's head.
function listPhrase(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? "a different piece";
  }
  return `${values.slice(0, -1).join(", ")} or ${values[values.length - 1]}`;
}

function fixtureNoun(fixtureClass: SpecRoleFixtureClass | undefined) {
  switch (fixtureClass) {
    case "ceiling":
      return "a ceiling fixture";
    case "wall":
      return "a wall light";
    case "floor_or_table":
      return "a floor or table lamp";
    default:
      return "a light";
  }
}

// Honest, user-facing reason for an unfilled role, from what the contract and
// the scorer rejected. No dollar signs, no internal identifiers.
export function missingRoleReason(
  role: SpecSourcingRole,
  rejectionReasons: Record<string, number>,
  contractCleanCount: number
): string {
  const noun = humanizeCategory(role.category);
  const [topReason] =
    Object.entries(rejectionReasons)
      .filter(([reason]) => reason !== "category_mismatch")
      .sort((left, right) => right[1] - left[1])[0] ?? [];

  if (contractCleanCount > 0) {
    switch (topReason) {
      case "unavailable":
        return `Every ${noun} that fits the design is out of stock right now.`;
      case "missing_image":
        return `The ${noun} pieces that fit the design have no usable product image yet.`;
      case "over_budget":
        return `Every ${noun} that fits the design is above the room's budget.`;
      case "avoid_color":
        return `Every ${noun} that fits the design comes in a colour the brief asked to avoid.`;
      default:
        return `No ${noun} in the catalogue fit the design's palette, budget and room size.`;
    }
  }
  switch (topReason) {
    case "lighting_fixture_class_mismatch":
      return `Every lighting piece in the catalogue is the wrong kind of fixture for this role; the design asks for ${fixtureNoun(role.contract.fixtureClass)}.`;
    case "object_kind_mismatch":
      return `Every ${noun} in the catalogue is a different kind of object from the one the design asks for (${listPhrase(role.contract.objectKinds ?? [])}).`;
    case "silhouette_excluded":
      return `The only ${noun} pieces left were swing, rocking or outdoor silhouettes, which the design does not ask for.`;
    case "capacity_mismatch": {
      const seats =
        role.contract.minSeats === role.contract.maxSeats
          ? `${role.contract.minSeats}`
          : `${role.contract.minSeats} to ${role.contract.maxSeats}`;
      return `No ${noun} matched the seat count the design asks for (seats ${seats}).`;
    }
    case "size_class_mismatch":
      return `No ${noun} matched the size the design asks for.`;
    case "class_tag_conflict":
    case "room_scope_conflict":
      return `The matching ${noun} pieces were made for another room or use.`;
    default:
      return `No ${noun} in the live catalogue matched this piece.`;
  }
}

export function missingRoleEntryForRole(
  role: SpecSourcingRole,
  rejectionReasons: Record<string, number>,
  contractCleanCount: number,
  reason = missingRoleReason(role, rejectionReasons, contractCleanCount)
): MissingRoleEntry {
  return {
    specKey: role.specKey,
    kind: "missing",
    label: role.specLabel,
    category: role.category,
    quantity: role.quantity,
    reason,
    guidance: MISSING_ROLE_GUIDANCE
  };
}

// Per-role retrieval through the existing scorer, with the spec contract
// applied BEFORE the pool's top-N cut: a floor lamp at rank thirteen behind
// twelve chandeliers must survive, so the contract filters the whole catalogue
// for the role and the scorer ranks what is left. Roles that end up empty are
// reported as missing with the reason the rejections tell.
export function buildSpecSourcingPlan({
  roles,
  unsourceable,
  candidates,
  roomType,
  conceptText,
  budgetMaxAed = null,
  roomMeasurements = null,
  recentlyUsedProductIds,
  avoidColorTags,
  candidatesPerRole = 12
}: {
  roles: SpecSourcingRole[];
  unsourceable: UnsourceableSpecObject[];
  candidates: ProductMatchCandidate[];
  roomType: string;
  conceptText: string;
  budgetMaxAed?: number | null;
  roomMeasurements?: ProductMatchRequest["roomMeasurements"];
  recentlyUsedProductIds?: string[];
  avoidColorTags?: string[];
  candidatesPerRole?: number;
}): SpecSourcingPlan {
  const pools: SpecRolePool[] = [];
  const missing: MissingRoleEntry[] = unsourceable.map(missingRoleEntryForUnsourceable);

  for (const role of roles) {
    const rejectionReasons: Record<string, number> = {};
    const clean = candidates.filter((candidate) => {
      const verdict = checkCandidateAgainstSpecRole(candidate, role);
      if (!verdict.ok) {
        rejectionReasons[verdict.reason] = (rejectionReasons[verdict.reason] ?? 0) + 1;
      }
      return verdict.ok;
    });
    const pool =
      clean.length > 0
        ? buildRoleScopedCandidatePools({
            roomType,
            conceptText,
            roles: [role],
            candidates: clean,
            // The scorer's cross-category adjustments (a statement coffee
            // table beside a patterned rug) read the whole catalogue, not
            // just this role's clean list.
            companionCandidates: candidates,
            budgetMaxAed,
            roomMeasurements,
            candidatesPerRole,
            recentlyUsedProductIds,
            avoidColorTags
          }).pools[0]
        : null;
    const reasons = { ...rejectionReasons, ...(pool?.rejectionReasons ?? {}) };
    if (pool && pool.candidates.length > 0) {
      pools.push({ role, candidates: pool.candidates, rejectionReasons: reasons });
    } else {
      missing.push(missingRoleEntryForRole(role, reasons, clean.length));
    }
  }

  return { pools, missing };
}

// Which candidates get an image in front of the visual pass: the top of every
// pool first (round-robin by rank), so a budget of N images covers every role
// before any role gets its second, and only candidates that have an image.
export function imageCandidateIdsForPools(
  pools: SpecRolePool[],
  { perRole, total }: { perRole: number; total: number }
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (let rank = 0; rank < Math.max(0, perRole); rank += 1) {
    let any = false;
    for (const pool of pools) {
      const candidate = pool.candidates[rank];
      if (!candidate) {
        continue;
      }
      any = true;
      if (!candidate.primaryImageUrl || seen.has(candidate.id) || ids.length >= total) {
        continue;
      }
      seen.add(candidate.id);
      ids.push(candidate.id);
    }
    if (!any || ids.length >= total) {
      break;
    }
  }
  return ids;
}

// -------------------------------------------------------------- outcomes

export type SpecVisualRoleResult = {
  category: string;
  roleLabel: string;
  status: "strong_match" | "acceptable_match" | "closest_available" | "missing_required" | "missing_supporting";
  productId: string | null;
  // The pass's own visual similarity for the product it proposes (0 to 1).
  similarity?: number | null;
  reason: string;
  // A validator-synthesized entry (no valid verdict came back for the role):
  // not the pass's judgement, so it never becomes a user-facing reason.
  synthesized?: boolean;
};

export type SpecVisualSelection = {
  productId: string;
  category: string;
  roleLabel: string;
  matchStatus: "strong_match" | "acceptable_match" | "closest_available";
  visualMatchReason: string;
  mismatchNote: string | null;
};

export type SpecRoleOutcome =
  | {
      kind: "selected";
      role: SpecSourcingRole;
      pool: SpecRolePool;
      selectedProductId: string;
      matchStatus: SpecVisualSelection["matchStatus"];
      reason: string;
      mismatchNote: string | null;
      // The sourcing pass's own score for the piece it proposed: telemetry and
      // the tiebreak when two roles want the same product, never the bar.
      similarity: number | null;
      // The design check's independent score, set once the piece has been
      // judged against the render. A selected outcome only survives
      // verification with one.
      verifiedSimilarity?: number;
    }
  // Sourced, but nothing was chosen FOR the shopper: the role's ranked,
  // contract-clean options are on the list and the shopper picks.
  // Two different measurements can explain an open role, so each is named:
  // passSimilarity is the sourcing pass's self-report for the piece it
  // proposed, checkSimilarity the design check's independent score.
  | {
      kind: "open";
      role: SpecSourcingRole;
      pool: SpecRolePool;
      reason: string;
      passSimilarity: number | null;
      checkSimilarity: number | null;
    }
  | { kind: "missing"; role: SpecSourcingRole; entry: MissingRoleEntry };

// The pass echoes the role's short key (or, failing that, its label); either
// identifies the pool, and the category is compared normalized so "Lighting"
// and "side tables" reconcile with "lighting" and "side_tables".
function poolMatches(pool: SpecRolePool, category: string, roleLabel: string) {
  const echoed = normalizeText(roleLabel);
  return (
    normalizeText(pool.role.category) === normalizeText(category) &&
    (echoed === normalizeText(pool.role.echoKey) || echoed === normalizeText(pool.role.label))
  );
}

// The design GATE's bar: the score at or above which the critique harness
// calls a product a match. Read from its checklist by test so the two cannot
// drift.
export const PRODUCT_CONSISTENCY_THRESHOLD = 0.6;

// The bar the APP selects at, which is deliberately higher. Both numbers come
// from a model judging an image, and a model judging the same pair twice does
// not return the same number twice. Selecting at exactly the gate's bar means
// selecting pieces the gate will sometimes score just below it: measured on
// the five harness rooms, three products the app passed at the shared bar
// were scored 0.40, 0.45 and 0.55 by the gate. The margin is what makes "the
// app never chooses something the gate would fail" hold in the presence of
// that variance, and it costs only the borderline pieces, which are the ones
// least worth presenting as matches.
export const PRODUCT_SELECTION_THRESHOLD = 0.75;

export const NO_VERDICT_OPEN_REASON =
  "The visual pass returned no verdict for this piece, so nothing was chosen for you; these are the closest catalogue options.";
export const VERIFICATION_FAILED_OPEN_REASON =
  "The closest catalogue piece did not match the design closely enough when it was checked against the render, so nothing was chosen for you; these are the closest options.";
export const VERIFICATION_UNAVAILABLE_OPEN_REASON =
  "The design check could not run for this piece, so nothing was chosen for you; these are the closest options.";
export const OUTSIDE_POOL_OPEN_REASON =
  "The visual pass named a piece that is not in this role's contract-clean pool, so its verdict could not be used; these are the closest options.";
export const BUDGET_OPEN_REASON =
  "The piece that matched the design here is above the room's budget, and no cheaper piece was confirmed to match; these are the closest options.";
export const CONTESTED_OPEN_REASON =
  "The visual pass proposed the same piece it chose for another role, so nothing was chosen for this one; these are the closest options.";

// The visual pass's verdict per role, held to the contract. The pass PROPOSES
// one product per role from that role's contract-clean pool; whether the
// proposal is good enough to present to a shopper is decided afterwards by the
// design check (applyProductVerification), because the pass's own score is not
// a calibrated measure of its own work. A role with no usable proposal is left
// OPEN with its ranked options; a role the pass looked at and rejected
// outright stays an honest missing entry.
export function resolveSpecRoleOutcomes({
  pools,
  roleResults,
  selections
}: {
  pools: SpecRolePool[];
  roleResults: SpecVisualRoleResult[];
  selections: SpecVisualSelection[];
}): SpecRoleOutcome[] {
  const verdicts = pools.map((pool) => {
    const found = roleResults.find((entry) => poolMatches(pool, entry.category, entry.roleLabel)) ?? null;
    // A synthesized entry means the pass gave no usable verdict for this role:
    // neither a pick nor an honest "nothing fits". It is no verdict at all,
    // never the pass's own missing verdict, and its internal text never
    // reaches a user.
    const result = found?.synthesized ? null : found;
    const selection = selections.find((entry) => poolMatches(pool, entry.category, entry.roleLabel)) ?? null;
    const declaredMissing = result?.status === "missing_required" || result?.status === "missing_supporting";
    const pickedId = declaredMissing ? null : (result?.productId ?? selection?.productId ?? null);
    const picked = pickedId ? pool.candidates.find((candidate) => candidate.id === pickedId) : undefined;
    const similarity = typeof result?.similarity === "number" ? result.similarity : null;
    return {
      pool,
      result,
      selection,
      picked,
      declaredMissing,
      similarity,
      noVerdict: !result && !selection,
      // The pass named something outside this role's contract-clean pool: a
      // contract violation, not a low score, and its score belongs to a piece
      // this role could never have.
      outsidePool: Boolean(result?.productId ?? selection?.productId) && !declaredMissing && !picked,
      // A usable proposal: a product this role's pool actually contains.
      confident: Boolean(picked)
    };
  });

  // One product fills one role. Two roles proposed the same product: the one
  // the pass scored closer keeps it (pool order breaks a tie) and the other is
  // left open rather than handed a piece nobody proposed for it.
  const winnerByProduct = new Map<string, number>();
  verdicts.forEach((verdict, index) => {
    if (!verdict.confident || !verdict.picked) {
      return;
    }
    const current = winnerByProduct.get(verdict.picked.id);
    if (current === undefined || (verdict.similarity ?? 0) > (verdicts[current].similarity ?? 0)) {
      winnerByProduct.set(verdict.picked.id, index);
    }
  });

  return verdicts.map((verdict, index) => {
    const { pool, result, selection, picked } = verdict;
    if (verdict.confident && picked && winnerByProduct.get(picked.id) === index) {
      return {
        kind: "selected",
        role: pool.role,
        pool,
        selectedProductId: picked.id,
        matchStatus:
          selection?.matchStatus ??
          (result?.status === "strong_match" || result?.status === "acceptable_match" ? result.status : "closest_available"),
        reason: selection?.visualMatchReason ?? result?.reason ?? "Chosen by the visual pass.",
        mismatchNote: selection?.mismatchNote ?? null,
        similarity: verdict.similarity
      };
    }
    if (verdict.declaredMissing && result) {
      return {
        kind: "missing",
        role: pool.role,
        entry: missingRoleEntryForRole(
          pool.role,
          pool.rejectionReasons,
          pool.candidates.length,
          `The visual pass found no catalogue piece that matches the design: ${result.reason}`
        )
      };
    }
    if (verdict.outsidePool) {
      return { kind: "open", role: pool.role, pool, reason: OUTSIDE_POOL_OPEN_REASON, passSimilarity: null, checkSimilarity: null };
    }
    return {
      kind: "open",
      role: pool.role,
      pool,
      reason: verdict.confident ? CONTESTED_OPEN_REASON : NO_VERDICT_OPEN_REASON,
      passSimilarity: verdict.similarity,
      checkSimilarity: null
    };
  });
}

// The design check's verdicts applied to the pass's proposals: a proposal is
// presented to the shopper as the app's choice ONLY when an independent judge,
// on the same rubric the design gate uses, says it is the same kind of object
// and matches the render at or above the committed bar. Everything else is
// opened, including a piece the check could not see (no usable image) and
// every piece when the check could not run at all.
export function applyProductVerification({
  outcomes,
  verdicts,
  threshold = PRODUCT_SELECTION_THRESHOLD
}: {
  outcomes: SpecRoleOutcome[];
  // By product id. A product absent from the map was not judged.
  verdicts: Map<string, { categoryMatches: boolean; similarity: number }>;
  threshold?: number;
}): SpecRoleOutcome[] {
  return outcomes.map((outcome) => {
    if (outcome.kind !== "selected") {
      return outcome;
    }
    const verdict = verdicts.get(outcome.selectedProductId);
    if (verdict && verdict.categoryMatches && verdict.similarity >= threshold) {
      return { ...outcome, verifiedSimilarity: verdict.similarity };
    }
    return {
      kind: "open",
      role: outcome.role,
      pool: outcome.pool,
      reason: verdict ? VERIFICATION_FAILED_OPEN_REASON : VERIFICATION_UNAVAILABLE_OPEN_REASON,
      passSimilarity: outcome.similarity,
      checkSimilarity: verdict?.similarity ?? null
    };
  });
}

// When the visual pass is unavailable (timeout, provider failure, or no time
// left in the request), nothing has been judged against the design, so nothing
// is chosen for the shopper: every role is open with its ranked options.
export function openSpecRoleOutcomes(pools: SpecRolePool[], reason: string): SpecRoleOutcome[] {
  return pools.map((pool) => ({ kind: "open", role: pool.role, pool, reason, passSimilarity: null, checkSimilarity: null }));
}

export type OpenRoleEntry = {
  specKey: string;
  label: string;
  reason: string;
  // The sourcing pass's self-report and the design check's score, kept apart:
  // one run can carry both, and reading either as the other misreads the drift
  // between what the pass claims and what the check sees.
  passSimilarity: number | null;
  checkSimilarity: number | null;
};

export function roleOptionsFromOutcomes(outcomes: SpecRoleOutcome[]): {
  roleOptions: RoleProductOptions[];
  selectedProductIdByRole: Map<string, string>;
  missing: MissingRoleEntry[];
  openRoles: OpenRoleEntry[];
} {
  const roleOptions: RoleProductOptions[] = [];
  const selectedProductIdByRole = new Map<string, string>();
  const missing: MissingRoleEntry[] = [];
  const openRoles: OpenRoleEntry[] = [];
  for (const outcome of outcomes) {
    if (outcome.kind === "missing") {
      missing.push(outcome.entry);
      continue;
    }
    if (outcome.kind === "open") {
      roleOptions.push({ ...outcome.role, options: outcome.pool.candidates });
      openRoles.push({
        specKey: outcome.role.specKey,
        label: outcome.role.label,
        reason: outcome.reason,
        passSimilarity: outcome.passSimilarity,
        checkSimilarity: outcome.checkSimilarity
      });
      continue;
    }
    const selected = outcome.pool.candidates.find((candidate) => candidate.id === outcome.selectedProductId);
    const options = selected
      ? [selected, ...outcome.pool.candidates.filter((candidate) => candidate.id !== selected.id)]
      : outcome.pool.candidates;
    const key = roleOptionKey(outcome.role);
    roleOptions.push({ ...outcome.role, options });
    selectedProductIdByRole.set(key, outcome.selectedProductId);
  }
  return { roleOptions, selectedProductIdByRole, missing, openRoles };
}
