import assert from "node:assert/strict";

import { selectShoppingItem, substituteProduct } from "./selection-swap";
import { fakeSupabase, type RecordedCall } from "./supabase-test-double";

// Service-level tests with a recording fake Supabase client: the service owns the
// persisted state transitions, so the tests pin WHICH rows are read and written,
// the one-pick-per-role invariant, and the swap's price math, without any Next.js
// or network dependency.

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example-project.supabase.co";

function productRow(overrides: Record<string, unknown>) {
  return {
    id: "00000000-0000-4000-8000-00000000aaaa",
    name: "Product",
    retailer: { name: "Home Centre", status: "active" },
    canonical_url: "https://media.homecentre.com/p",
    description: "A soft neutral three-seat sofa in warm boucle.",
    category_normalized: "sofas",
    price_aed: 1000,
    sale_price_aed: null,
    availability: "in stock",
    primary_image_url: "https://media.homecentre.com/p.jpg",
    color: "beige",
    material: "boucle",
    style_tags: ["modern"],
    color_tags: ["beige"],
    material_tags: ["boucle"],
    room_tags: ["living"],
    last_checked_at: "2026-09-01T00:00:00Z",
    dimensions: [{ width_cm: 220, depth_cm: 95, height_cm: 80, source_text: "220x95x80" }],
    ...overrides
  };
}

async function main() {
  // --- selectShoppingItem: one pick per role, total recalculated from selected rows only
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "shopping_list_items" && call.op === "select" && call.single) {
        return { data: { id: "item-2", category: "sofas" } };
      }
      if (call.table === "shopping_list_items" && call.op === "select") {
        return {
          data: [
            { status: "selected", unit_price_aed: 100, quantity: 2 },
            { status: "option", unit_price_aed: 999, quantity: 1 }
          ]
        };
      }
      return { data: null };
    });

    const result = await selectShoppingItem(client, { shoppingListId: "list-1", itemId: "item-2" });
    assert.deepEqual(result, { status: "selected" });

    const updates = calls.filter((call) => call.op === "update");
    assert.equal(updates.length, 3);
    // 1. Clear the category's current selection.
    assert.equal(updates[0].table, "shopping_list_items");
    assert.deepEqual(updates[0].payload, { status: "option" });
    assert.deepEqual(updates[0].filters, [
      ["shopping_list_id", "list-1"],
      ["category", "sofas"],
      ["status", "selected"]
    ]);
    // 2. Select the target item.
    assert.deepEqual(updates[1].payload, { status: "selected" });
    assert.deepEqual(updates[1].filters, [
      ["id", "item-2"],
      ["shopping_list_id", "list-1"]
    ]);
    // 3. Total counts selected rows only: 100 x 2, never the 999 option.
    assert.equal(updates[2].table, "shopping_lists");
    assert.equal(updates[2].payload?.estimated_total_aed, 200);
  }

  // --- selectShoppingItem: unknown item writes nothing
  {
    const { client, calls } = fakeSupabase(() => ({ data: null }));
    const result = await selectShoppingItem(client, { shoppingListId: "list-1", itemId: "missing" });
    assert.deepEqual(result, { status: "not_found" });
    assert.equal(calls.filter((call) => call.op === "update").length, 0);
  }

  // --- substituteProduct: missing project resolves not_found with zero writes,
  // and the commerce gate runs BEFORE the first read or write
  {
    const events: string[] = [];
    const { client } = fakeSupabase((call) => {
      events.push(`${call.op}:${call.table}`);
      return { data: null };
    });
    const { client: service, calls: serviceCalls } = fakeSupabase((call) => {
      events.push(`${call.op}:${call.table}`);
      return { data: null };
    });
    const result = await substituteProduct(
      { supabase: client, serviceSupabase: service },
      { projectId: "p", roomId: "r", shoppingListId: "l", itemId: "i", mode: "cheaper" },
      {
        ensureEntitled: async () => {
          events.push("ensureEntitled");
        }
      }
    );
    assert.deepEqual(result, { status: "not_found" });
    assert.equal(serviceCalls.filter((call) => call.op === "update").length, 0);
    assert.equal(events[0], "ensureEntitled", `gate must precede all DB work; saw ${events.join(", ")}`);
  }

  // --- substituteProduct: cheaper swap updates the row, keeps quantity, recalculates
  {
    const currentProduct = productRow({ id: "00000000-0000-4000-8000-000000000001", name: "Current sofa", price_aed: 3000 });
    const cheaper = productRow({ id: "00000000-0000-4000-8000-000000000002", name: "Cheaper sofa", price_aed: 2000 });

    const userUpdates: RecordedCall[] = [];
    const { client } = fakeSupabase((call) => {
      if (call.op === "update") {
        userUpdates.push(call);
        return { data: null };
      }
      if (call.table === "projects") {
        return { data: { id: "p", budget_max_aed: 20000 } };
      }
      if (call.table === "rooms") {
        return { data: { id: "r", room_type: "Living Room" } };
      }
      if (call.table === "shopping_lists") {
        return { data: { id: "l", concept_id: "c" } };
      }
      if (call.table === "concepts") {
        return { data: { id: "c", title: "Warm modern living room", description: "Soft neutral boucle sofa and walnut accents." } };
      }
      if (call.table === "room_measurements") {
        return { data: { wall_length_cm: 500, room_depth_cm: 400 } };
      }
      if (call.table === "shopping_list_items") {
        // post-swap recalc read
        return { data: [{ status: "selected", unit_price_aed: 2000, quantity: 2 }] };
      }
      return { data: null };
    });
    const { client: service } = fakeSupabase((call) => {
      if (call.table === "shopping_list_items" && call.single) {
        return {
          data: {
            id: "item-1",
            category: "sofas",
            quantity: 2,
            unit_price_aed: 3000,
            line_total_aed: 6000,
            role_label: "sofa",
            role_priority: "required",
            role_quantity: 1,
            product: currentProduct
          }
        };
      }
      if (call.table === "products") {
        return { data: [currentProduct, cheaper] };
      }
      return { data: null };
    });

    const result = await substituteProduct(
      { supabase: client, serviceSupabase: service },
      { projectId: "p", roomId: "r", shoppingListId: "l", itemId: "item-1", mode: "cheaper" },
      { ensureEntitled: async () => {} }
    );

    assert.equal(result.status, "swapped");
    const itemUpdate = userUpdates.find((call) => call.table === "shopping_list_items");
    assert.ok(itemUpdate, "swap must write the item row");
    assert.equal(itemUpdate?.payload?.product_id, "00000000-0000-4000-8000-000000000002");
    assert.equal(itemUpdate?.payload?.unit_price_aed, 2000);
    // The swap keeps the row's purchase quantity: line total is 2 x 2000.
    assert.equal(itemUpdate?.payload?.line_total_aed, 4000);
    // Impact = new line total minus previous line total.
    assert.equal(result.status === "swapped" && result.priceImpactAed, 4000 - 6000);
    const totalUpdate = userUpdates.find((call) => call.table === "shopping_lists");
    assert.equal(totalUpdate?.payload?.estimated_total_aed, 4000);
  }

  // --- substituteProduct: no candidate pool resolves no_replacement with no writes
  {
    const currentProduct = productRow({ id: "00000000-0000-4000-8000-000000000001", price_aed: 3000 });
    const userUpdates: RecordedCall[] = [];
    const { client } = fakeSupabase((call) => {
      if (call.op === "update") {
        userUpdates.push(call);
        return { data: null };
      }
      if (call.table === "projects") return { data: { id: "p", budget_max_aed: null } };
      if (call.table === "rooms") return { data: { id: "r", room_type: "Living Room" } };
      if (call.table === "shopping_lists") return { data: { id: "l", concept_id: "c" } };
      if (call.table === "concepts") return { data: { id: "c", title: "T", description: null } };
      if (call.table === "room_measurements") return { data: null };
      if (call.table === "shopping_list_items") return { data: [] };
      return { data: null };
    });
    const { client: service } = fakeSupabase((call) => {
      if (call.table === "shopping_list_items" && call.single) {
        return { data: { id: "item-1", category: "sofas", quantity: 1, unit_price_aed: 3000, line_total_aed: 3000, product: currentProduct } };
      }
      if (call.table === "products") {
        return { data: [] };
      }
      return { data: null };
    });

    const result = await substituteProduct(
      { supabase: client, serviceSupabase: service },
      { projectId: "p", roomId: "r", shoppingListId: "l", itemId: "item-1", mode: "cheaper" },
      { ensureEntitled: async () => {} }
    );
    assert.deepEqual(result, { status: "no_replacement" });
    assert.equal(userUpdates.length, 0);
  }

  console.log("selection-swap service tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
