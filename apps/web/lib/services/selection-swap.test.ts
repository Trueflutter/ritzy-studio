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
        return { data: { id: "item-2", category: "sofas", role_label: "living-zone sofa" } };
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
    // 1. Clear the ROLE's current selection (category plus label: two roles in
    // one category never clear each other).
    assert.equal(updates[0].table, "shopping_list_items");
    assert.deepEqual(updates[0].payload, { status: "option" });
    assert.deepEqual(updates[0].filters, [
      ["shopping_list_id", "list-1"],
      ["category", "sofas"],
      ["role_label", "living-zone sofa"],
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

  // --- selectShoppingItem: a keyed row clears by spec key, never by label
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "shopping_list_items" && call.op === "select" && call.single) {
        return { data: { id: "item-2", category: "lighting", role_label: "lamp", spec_key: "obj:3:floor_lamp" } };
      }
      if (call.table === "shopping_list_items" && call.op === "select") {
        return { data: [] };
      }
      return { data: null };
    });
    await selectShoppingItem(client, { shoppingListId: "list-1", itemId: "item-2" });
    const clear = calls.filter((call) => call.op === "update")[0];
    // By key alone: a swapped pick may sit in a sibling category of the role.
    assert.deepEqual(clear.filters, [
      ["shopping_list_id", "list-1"],
      ["spec_key", "obj:3:floor_lamp"],
      ["status", "selected"]
    ]);
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
    // The reason is prose about the swap, never a ranking warning dump.
    assert.match(String(itemUpdate?.payload?.selection_reason), /^Swapped in as the cheaper option\./);
    assert.ok(!String(itemUpdate?.payload?.selection_reason).includes("Warning"));
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

  // --- substituteProduct: a row whose spec key is no longer in the concept's
  // spec is stale; the swap refuses (stale_spec) and writes nothing
  {
    const currentProduct = productRow({ id: "00000000-0000-4000-8000-000000000001", price_aed: 3000 });
    const cheaper = productRow({ id: "00000000-0000-4000-8000-000000000002", price_aed: 2000 });
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
        return {
          data: {
            id: "item-1",
            category: "sofas",
            quantity: 1,
            unit_price_aed: 3000,
            line_total_aed: 3000,
            role_label: "sofa",
            spec_key: "obj:99:vanished",
            role_priority: "required",
            role_quantity: 1,
            product: currentProduct
          }
        };
      }
      if (call.table === "products") return { data: [currentProduct, cheaper] };
      if (call.table === "room_design_specs") {
        return {
          data: {
            id: "spec-2",
            room_id: "r",
            concept_id: "c",
            status: "confirmed",
            must_preserve: [],
            objects: [{ role: "sofa", label: "curved sofa", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] }]
          }
        };
      }
      return { data: null };
    });
    const result = await substituteProduct(
      { supabase: client, serviceSupabase: service },
      { projectId: "p", roomId: "r", shoppingListId: "l", itemId: "item-1", mode: "cheaper" },
      { ensureEntitled: async () => {} }
    );
    assert.deepEqual(result, { status: "stale_spec" });
    assert.equal(userUpdates.length, 0);
  }

  // --- substituteProduct: a blueprint-built list is never stale; its rows
  // swap without a spec contract
  {
    const currentProduct = productRow({ id: "00000000-0000-4000-8000-000000000001", price_aed: 3000 });
    const cheaper = productRow({ id: "00000000-0000-4000-8000-000000000002", price_aed: 2000 });
    const userUpdates: RecordedCall[] = [];
    const { client } = fakeSupabase((call) => {
      if (call.op === "update") {
        userUpdates.push(call);
        return { data: null };
      }
      if (call.table === "projects") return { data: { id: "p", budget_max_aed: null } };
      if (call.table === "rooms") return { data: { id: "r", room_type: "Living Room" } };
      if (call.table === "shopping_lists") return { data: { id: "l", concept_id: "c", spec_source: "blueprint_fallback" } };
      if (call.table === "concepts") return { data: { id: "c", title: "T", description: null } };
      if (call.table === "room_measurements") return { data: null };
      if (call.table === "shopping_list_items") return { data: [{ status: "selected", unit_price_aed: 2000, quantity: 1 }] };
      return { data: null };
    });
    const { client: service, calls: serviceCalls } = fakeSupabase((call) => {
      if (call.table === "shopping_list_items" && call.single) {
        return {
          data: {
            id: "item-1",
            category: "sofas",
            quantity: 1,
            unit_price_aed: 3000,
            line_total_aed: 3000,
            role_label: "living-zone sofa",
            spec_key: "blueprint:0:sofas",
            role_priority: "required",
            role_quantity: 1,
            product: currentProduct
          }
        };
      }
      if (call.table === "products") return { data: [currentProduct, cheaper] };
      // A malformed spec row: unreadable, never a reason to refuse the swap.
      if (call.table === "room_design_specs") return { data: { id: "spec-x", room_id: "r", concept_id: "c", status: "extracted", must_preserve: [], objects: "not-a-list" } };
      return { data: null };
    });
    const result = await substituteProduct(
      { supabase: client, serviceSupabase: service },
      { projectId: "p", roomId: "r", shoppingListId: "l", itemId: "item-1", mode: "cheaper" },
      { ensureEntitled: async () => {} }
    );
    assert.equal(result.status, "swapped");
    assert.ok(serviceCalls.some((call) => call.table === "room_design_specs"), "the spec is consulted; it is simply unreadable");
    assert.equal(userUpdates.find((call) => call.table === "shopping_list_items")?.payload?.product_id, "00000000-0000-4000-8000-000000000002");
  }

  // --- substituteProduct: a blueprint-built list whose concept has SINCE
  // gained a confirmed spec is stale; the list must be re-sourced, never
  // swapped under no contract
  {
    const currentProduct = productRow({ id: "00000000-0000-4000-8000-000000000001", price_aed: 3000 });
    const cheaper = productRow({ id: "00000000-0000-4000-8000-000000000002", price_aed: 2000 });
    const userUpdates: RecordedCall[] = [];
    const { client } = fakeSupabase((call) => {
      if (call.op === "update") {
        userUpdates.push(call);
        return { data: null };
      }
      if (call.table === "projects") return { data: { id: "p", budget_max_aed: null } };
      if (call.table === "rooms") return { data: { id: "r", room_type: "Living Room" } };
      if (call.table === "shopping_lists") return { data: { id: "l", concept_id: "c", spec_source: "blueprint_fallback" } };
      if (call.table === "concepts") return { data: { id: "c", title: "T", description: null } };
      if (call.table === "room_measurements") return { data: null };
      if (call.table === "shopping_list_items") return { data: [] };
      return { data: null };
    });
    const { client: service } = fakeSupabase((call) => {
      if (call.table === "shopping_list_items" && call.single) {
        return {
          data: {
            id: "item-1",
            category: "sofas",
            quantity: 1,
            unit_price_aed: 3000,
            line_total_aed: 3000,
            role_label: "living-zone sofa",
            spec_key: "blueprint:0:sofas",
            role_priority: "required",
            role_quantity: 1,
            product: currentProduct
          }
        };
      }
      if (call.table === "products") return { data: [currentProduct, cheaper] };
      if (call.table === "room_design_specs") {
        return {
          data: {
            id: "spec-y",
            room_id: "r",
            concept_id: "c",
            status: "confirmed",
            must_preserve: [],
            objects: [{ role: "sofa", label: "curved sofa", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] }]
          }
        };
      }
      return { data: null };
    });
    const result = await substituteProduct(
      { supabase: client, serviceSupabase: service },
      { projectId: "p", roomId: "r", shoppingListId: "l", itemId: "item-1", mode: "cheaper" },
      { ensureEntitled: async () => {} }
    );
    assert.deepEqual(result, { status: "stale_spec" });
    assert.equal(userUpdates.length, 0);
  }

  console.log("selection-swap service tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
