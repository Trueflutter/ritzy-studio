import type { CatalogSupabaseClient } from "./types";

export type CategoryCountRow = {
  category_normalized: string | null;
};

export type CategoryCountPageFetcher = (
  from: number,
  to: number
) => Promise<{
  data: CategoryCountRow[] | null;
  error: { message: string } | null;
}>;

export async function countProductCategoriesFromPages(
  fetchPage: CategoryCountPageFetcher,
  pageSize = 1000
) {
  const counts = new Map<string, number>();
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const page = data ?? [];
    for (const product of page) {
      const category = product.category_normalized ?? "uncategorized";
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }

    if (page.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return Object.fromEntries([...counts.entries()].sort());
}

export async function categoryCounts(supabase: CatalogSupabaseClient, adapterKey: string) {
  const { data: retailer, error: retailerError } = await supabase
    .from("retailers")
    .select("id")
    .eq("adapter_key", adapterKey)
    .maybeSingle();

  if (retailerError) {
    throw new Error(retailerError.message);
  }

  if (!retailer) {
    return {};
  }

  return countProductCategoriesFromPages(async (from, to) =>
    await supabase
      .from("products")
      .select("category_normalized")
      .eq("retailer_id", retailer.id)
      .not("price_aed", "is", null)
      .not("primary_image_url", "is", null)
      .range(from, to)
  );
}
