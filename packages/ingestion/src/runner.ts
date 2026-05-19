import type { CatalogAdapter, CatalogSupabaseClient } from "./types";
import { normalizeProductCandidate } from "./normalization";

export async function runCatalogIngestion({
  adapter,
  supabase,
  limit
}: {
  adapter: CatalogAdapter;
  supabase: CatalogSupabaseClient;
  limit?: number;
}) {
  const compliance = adapter.getComplianceNotes ? await adapter.getComplianceNotes() : {};
  const { data: existingRetailer, error: existingRetailerError } = await supabase
    .from("retailers")
    .select("status")
    .eq("adapter_key", adapter.key)
    .maybeSingle();

  if (existingRetailerError) {
    throw new Error(existingRetailerError.message);
  }

  const { data: retailer, error: retailerError } = await supabase
    .from("retailers")
    .upsert(
      {
        name: adapter.retailer.name,
        domain: adapter.retailer.domain,
        country: adapter.retailer.country ?? "AE",
        adapter_key: adapter.key,
        status: existingRetailer?.status ?? adapter.retailer.status ?? "candidate",
        robots_notes: compliance.robotsNotes ?? adapter.retailer.robotsNotes ?? null,
        terms_notes: compliance.termsNotes ?? adapter.retailer.termsNotes ?? null
      },
      { onConflict: "adapter_key" }
    )
    .select("id")
    .single();

  if (retailerError) {
    throw new Error(retailerError.message);
  }

  const { data: run, error: runError } = await supabase
    .from("ingestion_runs")
    .insert({
      retailer_id: retailer.id,
      adapter_key: adapter.key,
      status: "running"
    })
    .select("id")
    .single();

  if (runError) {
    throw new Error(runError.message);
  }

  const stats = {
    products_seen: 0,
    products_created: 0,
    products_updated: 0,
    products_failed: 0
  };

  try {
    const discoveries = await adapter.discoverProducts({ limit });
    for await (const discovery of discoveries) {
      if (limit && stats.products_seen >= limit) {
        break;
      }

      stats.products_seen += 1;

      try {
        const rawProduct = await adapter.extractProduct(discovery);
        const normalized = normalizeProductCandidate(rawProduct);
        const { data: upsertedProduct, error: productError } = await supabase
          .from("products")
          .upsert(
            {
              retailer_id: retailer.id,
              ...normalized.product
            },
            { onConflict: "retailer_id,canonical_url" }
          )
          .select("id, created_at, updated_at")
          .single();

        if (productError) {
          throw new Error(productError.message);
        }

        if (upsertedProduct.created_at === upsertedProduct.updated_at) {
          stats.products_created += 1;
        } else {
          stats.products_updated += 1;
        }

        const { error: dimensionsDeleteError } = await supabase
          .from("product_dimensions")
          .delete()
          .eq("product_id", upsertedProduct.id);
        if (dimensionsDeleteError) {
          throw new Error(dimensionsDeleteError.message);
        }

        const { error: imagesDeleteError } = await supabase
          .from("product_images")
          .delete()
          .eq("product_id", upsertedProduct.id);
        if (imagesDeleteError) {
          throw new Error(imagesDeleteError.message);
        }

        if (normalized.dimensions) {
          const { error: dimensionsInsertError } = await supabase.from("product_dimensions").insert({
            product_id: upsertedProduct.id,
            ...normalized.dimensions
          });
          if (dimensionsInsertError) {
            throw new Error(dimensionsInsertError.message);
          }
        }

        if (normalized.images.length > 0) {
          const { error: imagesInsertError } = await supabase.from("product_images").insert(
            normalized.images.map((image) => ({
              product_id: upsertedProduct.id,
              ...image
            }))
          );
          if (imagesInsertError) {
            throw new Error(imagesInsertError.message);
          }
        }
      } catch {
        stats.products_failed += 1;
      }
    }

    await supabase
      .from("ingestion_runs")
      .update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        ...stats
      })
      .eq("id", run.id);

    return {
      runId: run.id,
      retailerId: retailer.id,
      ...stats
    };
  } catch (error) {
    await supabase
      .from("ingestion_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_summary: error instanceof Error ? error.message : "Ingestion failed.",
        ...stats
      })
      .eq("id", run.id);

    throw error;
  }
}
