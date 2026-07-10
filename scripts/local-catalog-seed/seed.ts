/**
 * Seed the LOCAL Supabase with the synthetic fixture catalog.
 *
 * Local development only: refuses to run unless NEXT_PUBLIC_SUPABASE_URL points at
 * localhost. Gives the app a role-complete catalog (including deliberate trap
 * products) so the full photo -> concept -> matching -> render flow can be
 * exercised without the hosted database. Never run against a hosted project.
 *
 * Usage: npx tsx scripts/local-catalog-seed/seed.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
  throw new Error(`Refusing to seed a non-local Supabase (${url}). This fixture catalog is local-dev only.`);
}

type SeedProduct = {
  sku: string;
  name: string;
  category_raw: string;
  category_normalized: string;
  color: string;
  material: string;
  style_tags: string[];
  color_tags: string[];
  material_tags: string[];
  room_tags: string[];
  price_aed: number;
  dims: { w: number; d: number; h: number };
  image_prompt: string;
};

const seedDir = resolve(process.cwd(), "scripts/local-catalog-seed");
const catalog = JSON.parse(readFileSync(resolve(seedDir, "catalog.json"), "utf8")) as {
  retailer: { name: string; domain: string; adapter_key: string; status: string };
  products: SeedProduct[];
};
const imageManifest = JSON.parse(readFileSync(resolve(seedDir, "image-manifest.json"), "utf8")) as Record<
  string,
  string
>;

const supabase = createClient(url, serviceRoleKey);

async function main() {
  const { data: retailer, error: retailerError } = await supabase
    .from("retailers")
    .upsert(
      {
        name: catalog.retailer.name,
        domain: catalog.retailer.domain,
        country: "AE",
        adapter_key: catalog.retailer.adapter_key,
        status: catalog.retailer.status
      },
      { onConflict: "adapter_key" }
    )
    .select("id")
    .single();

  if (retailerError) throw new Error(retailerError.message);

  let created = 0;
  let missingImages: string[] = [];

  for (const product of catalog.products) {
    const imageUrl = imageManifest[product.sku] ?? null;
    if (!imageUrl) missingImages.push(product.sku);

    const { data: row, error } = await supabase
      .from("products")
      .upsert(
        {
          retailer_id: retailer.id,
          external_sku: product.sku,
          canonical_url: `https://${catalog.retailer.domain}/products/${product.sku}`,
          name: product.name,
          description: product.image_prompt,
          category_raw: product.category_raw,
          category_normalized: product.category_normalized,
          price_aed: product.price_aed,
          currency: "AED",
          availability: "in stock",
          primary_image_url: imageUrl,
          color: product.color,
          material: product.material,
          style_tags: product.style_tags,
          room_tags: product.room_tags,
          color_tags: product.color_tags,
          material_tags: product.material_tags,
          data_confidence: "verified",
          last_checked_at: new Date().toISOString(),
          enriched_at: new Date().toISOString(),
          enrichment_model: "local-fixture"
        },
        { onConflict: "retailer_id,canonical_url" }
      )
      .select("id")
      .single();

    if (error) throw new Error(`${product.sku}: ${error.message}`);

    await supabase.from("product_dimensions").delete().eq("product_id", row.id);
    const { error: dimensionsError } = await supabase.from("product_dimensions").insert({
      product_id: row.id,
      width_cm: product.dims.w,
      depth_cm: product.dims.d,
      height_cm: product.dims.h,
      source_text: `W${product.dims.w} x D${product.dims.d} x H${product.dims.h} cm`
    });
    if (dimensionsError) throw new Error(`${product.sku} dims: ${dimensionsError.message}`);

    if (imageUrl) {
      await supabase.from("product_images").delete().eq("product_id", row.id);
      const { error: imageError } = await supabase.from("product_images").insert({
        product_id: row.id,
        image_url: imageUrl,
        sort_order: 0,
        source: "local-fixture"
      });
      if (imageError) throw new Error(`${product.sku} image: ${imageError.message}`);
    }

    created += 1;
  }

  console.log(
    JSON.stringify({ retailerId: retailer.id, productsSeeded: created, missingImages }, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
