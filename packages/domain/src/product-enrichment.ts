import { z } from "zod";

export const productTagSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .transform((value) => value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_/-]/g, ""))
  .refine((value) => value.length >= 2);

export const productEnrichmentInputSchema = z.object({
  productId: z.uuid().optional(),
  retailerName: z.string().min(1).max(120).optional().nullable(),
  name: z.string().min(1).max(240),
  description: z.string().max(4000).optional().nullable(),
  categoryRaw: z.string().max(240).optional().nullable(),
  categoryNormalized: z.string().max(80).optional().nullable(),
  color: z.string().max(120).optional().nullable(),
  material: z.string().max(240).optional().nullable(),
  priceAed: z.number().nonnegative().optional().nullable(),
  salePriceAed: z.number().nonnegative().optional().nullable(),
  availability: z.string().max(120).optional().nullable(),
  primaryImageUrl: z.url().optional().nullable(),
  dimensions: z
    .object({
      widthCm: z.number().positive().optional().nullable(),
      depthCm: z.number().positive().optional().nullable(),
      heightCm: z.number().positive().optional().nullable(),
      diameterCm: z.number().positive().optional().nullable(),
      sourceText: z.string().max(500).optional().nullable()
    })
    .optional()
    .nullable()
});

export const productEnrichmentResponseSchema = z.object({
  normalizedCategory: z.string().min(2).max(80).nullable(),
  styleTags: z.array(productTagSchema).max(10),
  colorTags: z.array(productTagSchema).max(8),
  materialTags: z.array(productTagSchema).max(8),
  roomTags: z.array(productTagSchema).max(8),
  sourceConfidence: z.enum(["verified", "assumed", "estimated", "unknown"]),
  warnings: z.array(z.string().min(4).max(180)).max(6),
  derivedBy: z.literal("model-enriched")
});

export type ProductEnrichmentInput = z.infer<typeof productEnrichmentInputSchema>;
export type ProductEnrichmentResponse = z.infer<typeof productEnrichmentResponseSchema>;

export function normalizeTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => productTagSchema.parse(tag)).filter(Boolean))).sort();
}

export function buildProductSearchText(input: ProductEnrichmentInput, enrichment?: ProductEnrichmentResponse) {
  const facts = productEnrichmentInputSchema.parse(input);
  const lines = [
    `name: ${facts.name}`,
    facts.retailerName ? `retailer: ${facts.retailerName}` : null,
    facts.categoryNormalized ? `category: ${facts.categoryNormalized}` : null,
    facts.categoryRaw ? `retailer category: ${facts.categoryRaw}` : null,
    facts.description ? `description: ${facts.description}` : null,
    facts.color ? `retailer color: ${facts.color}` : null,
    facts.material ? `retailer material: ${facts.material}` : null,
    facts.dimensions?.sourceText ? `dimensions: ${facts.dimensions.sourceText}` : null,
    enrichment?.styleTags.length ? `model style tags: ${enrichment.styleTags.join(", ")}` : null,
    enrichment?.colorTags.length ? `model color tags: ${enrichment.colorTags.join(", ")}` : null,
    enrichment?.materialTags.length ? `model material tags: ${enrichment.materialTags.join(", ")}` : null,
    enrichment?.roomTags.length ? `model room tags: ${enrichment.roomTags.join(", ")}` : null
  ];

  return lines.filter(Boolean).join("\n");
}
