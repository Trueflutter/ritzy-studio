import assert from "node:assert/strict";

import { findMoreShoppingOptions, groundProductsForRoom, refreshShoppingOptions } from "./product-sourcing";
import { fakeSupabase, type RecordedCall } from "./supabase-test-double";

// State-gate tests for the product-sourcing service. The full grounding pipeline
// runs against live providers in acceptance runs; these pin the EARLY read gates
// (not_found, unselected-concept blocked) and the refresh/find-more refill
// contracts. The sourced path's persisted transitions and the deep blocked
// terminals get automated coverage with the S3 sourcing rework.

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example-project.supabase.co";

const GROUND_INPUT = {
  userId: "user-1",
  userEmail: "user@example.com",
  projectId: "proj-1",
  roomId: "room-1",
  conceptId: "concept-1"
};

const REFILL_INPUT = {
  projectId: "proj-1",
  roomId: "room-1",
  shoppingListId: "list-1",
  category: "sofas"
};

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

const ITEM_TEMPLATE = {
  role_label: "sofa",
  role_visual_brief: "Soft neutral boucle sofa",
  role_priority: "required",
  role_quantity: 1,
  option_rank: 3
};

async function main() {
  // --- groundProductsForRoom: missing room/project/concept resolves not_found, no writes
  {
    const { client } = fakeSupabase(() => ({ data: null }));
    const { client: service, calls: serviceCalls } = fakeSupabase(() => ({ data: null }));
    const result = await groundProductsForRoom(
      { supabase: client, serviceSupabase: service },
      GROUND_INPUT
    );
    assert.deepEqual(result, { status: "not_found" });
    assert.equal(serviceCalls.filter((call: RecordedCall) => call.op !== "select").length, 0);
  }

  // --- groundProductsForRoom: unselected concept blocks with the exact message,
  // and neither client has written anything at that point
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: null } };
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") {
        return { data: { id: "concept-1", title: "T", description: null, status: "generated", generation_job_id: null, palette_json: null, primary_image_asset: null } };
      }
      return { data: null };
    });
    const { client: service, calls: serviceCalls } = fakeSupabase(() => ({ data: null }));
    const result = await groundProductsForRoom(
      { supabase: client, serviceSupabase: service },
      GROUND_INPUT
    );
    assert.deepEqual(result, {
      status: "blocked",
      message: "Select a concept before product grounding."
    });
    assert.equal(calls.filter((call: RecordedCall) => call.op !== "select").length, 0);
    assert.equal(serviceCalls.filter((call: RecordedCall) => call.op !== "select").length, 0);
  }

  // --- A running spec extraction sends sourcing to /spec (step 8 backfill gate)
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: null } };
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") {
        return { data: { id: "concept-1", title: "T", description: null, status: "selected", generation_job_id: null, palette_json: null, primary_image_asset: null } };
      }
      return { data: null };
    });
    const { client: service, calls: serviceCalls } = fakeSupabase(() => ({ data: null }));
    const result = await groundProductsForRoom(
      { supabase: client, serviceSupabase: service },
      GROUND_INPUT,
      {
        readSpec: async () => ({
          status: "extraction_running" as const,
          jobId: "job-1",
          startedAt: "2026-09-02T10:00:00.000Z",
          staleAt: "2026-09-02T10:02:00.000Z"
        })
      }
    );
    assert.deepEqual(result, { status: "spec_pending" });
    assert.equal(
      calls.filter((call: RecordedCall) => call.table === "room_measurements").length,
      0,
      "a running extraction must gate before further sourcing reads"
    );
    assert.equal(
      serviceCalls.filter((call: RecordedCall) => call.op !== "select").length,
      0,
      "sourcing never opens an extraction job itself"
    );
  }

  // --- A room with no extraction attempt yet is sent to /spec too: sourcing
  // never runs the paid call, the spec screen owns that lifecycle
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: null } };
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") {
        return { data: { id: "concept-1", title: "T", description: null, status: "selected", generation_job_id: null, palette_json: null, primary_image_asset: null } };
      }
      return { data: null };
    });
    const { client: service, calls: serviceCalls } = fakeSupabase(() => ({ data: null }));
    const result = await groundProductsForRoom(
      { supabase: client, serviceSupabase: service },
      GROUND_INPUT,
      { readSpec: async () => ({ status: "extraction_needed" as const, conceptId: "concept-1" }) }
    );
    assert.deepEqual(result, { status: "spec_pending" });
    assert.equal(calls.filter((call: RecordedCall) => call.table === "room_measurements").length, 0);
    assert.equal(serviceCalls.filter((call: RecordedCall) => call.op === "insert").length, 0);
  }

  // --- A recorded failed extraction does NOT block sourcing (no dead end that
  // never existed); S3 makes the spec load-bearing
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: null } };
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") {
        return { data: { id: "concept-1", title: "T", description: null, status: "selected", generation_job_id: null, palette_json: null, primary_image_asset: null } };
      }
      return { data: null };
    });
    const { client: service } = fakeSupabase(() => ({ data: [] }));
    await groundProductsForRoom(
      { supabase: client, serviceSupabase: service },
      GROUND_INPUT,
      { readSpec: async () => ({ status: "extraction_failed" as const, conceptId: "concept-1", retryable: true }) }
    );
    assert.ok(
      calls.some((call: RecordedCall) => call.table === "room_measurements"),
      "a failed extraction must let sourcing proceed past the gate"
    );
  }

  // --- With the spec stored, sourcing proceeds past the gate
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: null } };
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") {
        return { data: { id: "concept-1", title: "T", description: null, status: "selected", generation_job_id: null, palette_json: null, primary_image_asset: null } };
      }
      return { data: null };
    });
    const { client: service } = fakeSupabase(() => ({ data: [] }));
    await groundProductsForRoom(
      { supabase: client, serviceSupabase: service },
      GROUND_INPUT,
      {
        readSpec: async () => ({
          status: "ready" as const,
          spec: {
            id: "spec-1",
            roomId: "room-1",
            conceptId: "concept-1",
            objects: [
              { role: "sofa", label: "Sofa", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] }
            ],
            mustPreserve: [],
            status: "extracted" as const
          },
          conceptTitle: "T",
          renderSignedUrl: null
        })
      }
    );
    assert.ok(
      calls.some((call: RecordedCall) => call.table === "room_measurements"),
      "a stored spec must let sourcing proceed past the gate"
    );
  }

  // --- refreshShoppingOptions: no selected pick means no_change and zero writes
  // (refresh is scoped to exploration; it must never run without a protected pick)
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "shopping_lists") return { data: { id: "list-1", concept_id: "concept-1" } };
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: null } };
      if (call.table === "concepts") return { data: { title: "T", description: null } };
      if (call.table === "shopping_list_items") {
        return { data: [{ id: "i1", product_id: "p1", status: "option", ...ITEM_TEMPLATE }] };
      }
      return { data: null };
    });
    const { client: service } = fakeSupabase(() => ({ data: [] }));
    const result = await refreshShoppingOptions(
      { supabase: client, serviceSupabase: service },
      REFILL_INPUT
    );
    assert.deepEqual(result, { status: "no_change" });
    assert.equal(calls.filter((call: RecordedCall) => call.op !== "select").length, 0);
  }

  // --- refreshShoppingOptions success: rejects only non-selected options, inserts
  // fresh rows inheriting the template role fields with sequential option ranks
  {
    const freshProduct = productRow({ id: "00000000-0000-4000-8000-000000000009", name: "Fresh sofa", price_aed: 1500 });
    const writes: RecordedCall[] = [];
    const reads: RecordedCall[] = [];
    const { client } = fakeSupabase((call) => {
      if (call.op !== "select") {
        writes.push(call);
        return { data: null };
      }
      reads.push(call);
      if (call.table === "shopping_lists") return { data: { id: "list-1", concept_id: "concept-1" } };
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: 20000 } };
      if (call.table === "concepts") {
        return { data: { title: "Warm modern living room", description: "Soft neutral boucle sofa and walnut accents." } };
      }
      if (call.table === "shopping_list_items") {
        return {
          data: [
            { id: "i1", product_id: "00000000-0000-4000-8000-000000000001", status: "selected", ...ITEM_TEMPLATE, option_rank: 1 },
            { id: "i2", product_id: "00000000-0000-4000-8000-000000000002", status: "option", ...ITEM_TEMPLATE, option_rank: 3 }
          ]
        };
      }
      if (call.table === "room_measurements") return { data: null };
      return { data: null };
    });
    const { client: service } = fakeSupabase((call) => {
      if (call.table === "products") return { data: [freshProduct] };
      return { data: null };
    });

    const result = await refreshShoppingOptions(
      { supabase: client, serviceSupabase: service },
      REFILL_INPUT
    );
    assert.deepEqual(result, { status: "refreshed" });

    // The template arithmetic (option_rank + 1) and inherited role fields depend on
    // these columns actually being selected; a trimmed column list must fail here,
    // not in production against real PostgREST rows.
    const itemsRead = reads.find(
      (call) => call.table === "shopping_list_items" && call.op === "select"
    );
    for (const column of ["option_rank", "role_label", "role_visual_brief", "role_priority", "role_quantity", "status", "product_id"]) {
      assert.ok(
        itemsRead?.columns?.includes(column),
        `refresh item read must select ${column}; got: ${itemsRead?.columns}`
      );
    }

    const reject = writes.find((call) => call.op === "update");
    assert.ok(reject, "must reject stale options");
    assert.deepEqual(reject?.payload, { status: "rejected" });
    assert.deepEqual(reject?.filters, [
      ["shopping_list_id", "list-1"],
      ["category", "sofas"]
    ]);
    // The selected row's only protection is the .neq guard: pin it.
    assert.deepEqual(reject?.neq, [["status", "selected"]]);

    const insert = writes.find((call) => call.op === "insert");
    assert.ok(insert, "must insert fresh options");
    const rows = insert?.payload as unknown as Array<Record<string, unknown>>;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].product_id, "00000000-0000-4000-8000-000000000009");
    assert.equal(rows[0].status, "option");
    assert.equal(rows[0].role_label, "sofa");
    // option_rank continues after the highest existing rank (3 -> 4).
    assert.equal(rows[0].option_rank, 4);
    assert.equal(rows[0].line_total_aed, 1500);
  }

  // --- refreshShoppingOptions: selected pick present but the pool is exhausted
  // (every catalog candidate already in the list): no_change, and the reject
  // write must NOT have fired (rejection only happens once replacements exist)
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "shopping_lists") return { data: { id: "list-1", concept_id: "concept-1" } };
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: null } };
      if (call.table === "concepts") return { data: { title: "T", description: null } };
      if (call.table === "shopping_list_items") {
        return {
          data: [
            { id: "i1", product_id: "00000000-0000-4000-8000-000000000001", status: "selected", ...ITEM_TEMPLATE },
            { id: "i2", product_id: "00000000-0000-4000-8000-000000000002", status: "option", ...ITEM_TEMPLATE }
          ]
        };
      }
      return { data: null };
    });
    const { client: service } = fakeSupabase(() => ({ data: [] }));
    const result = await refreshShoppingOptions(
      { supabase: client, serviceSupabase: service },
      REFILL_INPUT
    );
    assert.deepEqual(result, { status: "no_change" });
    assert.equal(
      calls.filter((call: RecordedCall) => call.op !== "select").length,
      0,
      "an exhausted pool must not reject the shopper's existing options"
    );
  }

  // --- findMoreShoppingOptions: zero candidates resolves no_candidates without insert
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "shopping_lists") return { data: { id: "list-1", concept_id: "concept-1" } };
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: null } };
      if (call.table === "concepts") return { data: { title: "T", description: null } };
      if (call.table === "shopping_list_items") {
        return { data: [{ product_id: "p1", ...ITEM_TEMPLATE }] };
      }
      return { data: null };
    });
    const { client: service } = fakeSupabase(() => ({ data: [] }));
    const result = await findMoreShoppingOptions(
      { supabase: client, serviceSupabase: service },
      REFILL_INPUT
    );
    assert.deepEqual(result, { status: "no_candidates" });
    assert.equal(calls.filter((call: RecordedCall) => call.op === "insert").length, 0);
  }

  // --- findMoreShoppingOptions: missing gates resolve no_change
  {
    const { client } = fakeSupabase(() => ({ data: null }));
    const { client: service } = fakeSupabase(() => ({ data: null }));
    const result = await findMoreShoppingOptions(
      { supabase: client, serviceSupabase: service },
      REFILL_INPUT
    );
    assert.deepEqual(result, { status: "no_change" });
  }

  console.log("product-sourcing service tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
