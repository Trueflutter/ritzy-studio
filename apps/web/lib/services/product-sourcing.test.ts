import assert from "node:assert/strict";

import type { extractConceptImagePalette, SourceProductsFromConceptInput } from "@ritzy-studio/ai";
import { sourcingRolesFromDesignSpec } from "@ritzy-studio/domain";

import type { RoomDesignSpecState } from "./design-spec";
import { findMoreShoppingOptions, groundProductsForRoom, refreshShoppingOptions } from "./product-sourcing";
import { fakeSupabase, type RecordedCall, type Responder } from "./supabase-test-double";

// State-gate and persisted-transition tests for the S3 sourcing service. The
// paid visual pass, the image fetch and the palette extraction are injected;
// these pin the spec gate, the contract-clean pools, the honest missing-role
// output on the list, the row and job bookkeeping, the ranking fallback, and
// the blueprint fallback for a room whose spec could not be read.

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

const SOFA_ID = "00000000-0000-4000-8000-000000000101";
const CHAIR_ID = "00000000-0000-4000-8000-000000000102";
const CHANDELIER_ID = "00000000-0000-4000-8000-000000000103";
const SWING_ID = "00000000-0000-4000-8000-000000000104";

const CATALOGUE = [
  productRow({ id: SOFA_ID, name: "Milo 3 Seater Sofa", category_normalized: "sofas", price_aed: 3000 }),
  productRow({
    id: CHAIR_ID,
    name: "Stilo Armchair in Savoy Cognac Brown Leather",
    category_normalized: "armchairs",
    price_aed: 5670,
    description: "Casual comfort in cognac leather.",
    color: "brown",
    material: "leather",
    dimensions: [{ width_cm: 80, depth_cm: 88, height_cm: 89, source_text: "80x88x89" }]
  }),
  productRow({
    id: SWING_ID,
    name: "Armchair Swing Ritmo Vintage Econo",
    category_normalized: "armchairs",
    price_aed: 2790,
    description: "A rocking chair for relaxing in all living rooms.",
    color: "brown",
    material: "birch",
    dimensions: [{ width_cm: null, depth_cm: 76, height_cm: 83, source_text: "?x76x83" }]
  }),
  productRow({
    id: CHANDELIER_ID,
    name: "Emis 12-Lights Faux Alabaster Chandelier",
    category_normalized: "lighting",
    price_aed: 3095,
    description: "Buy Emis 12-Lights Faux Alabaster Chandelier online.",
    color: null,
    material: null,
    dimensions: []
  })
];

const CONFIRMED_SPEC: Extract<RoomDesignSpecState, { status: "ready" }> = {
  status: "ready",
  conceptTitle: "Warm Gallery",
  renderSignedUrl: null,
  spec: {
    id: "spec-1",
    roomId: "room-1",
    conceptId: "concept-1",
    status: "confirmed",
    mustPreserve: ["sliding doors"],
    objects: [
      { role: "sofa", label: "curved three-seat sofa", quantity: 1, sizeDescriptor: "around 240 cm", capacity: "seats 3", paletteMaterials: ["ivory boucle"] },
      { role: "lounge_chair", label: "cognac leather lounge chair", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: ["cognac leather"] },
      { role: "floor_lamp", label: "tall tripod floor lamp", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: ["brass"] },
      { role: "lighting", label: "recessed downlights", quantity: 8, sizeDescriptor: null, capacity: null, paletteMaterials: [] }
    ]
  }
};

// The spec key the sofa object carries, as the service will persist it.
const SOFA_SPEC_KEY = sourcingRolesFromDesignSpec(CONFIRMED_SPEC.spec, "Living Room").roles[0].specKey;

const CONCEPT = {
  id: "concept-1",
  title: "Warm Gallery",
  description: "Calm neutral layers.",
  status: "selected",
  palette_json: { dominantColors: ["ivory"], accentColors: ["cognac"], avoidColors: [] },
  primary_image_asset: { storage_path: "u/room-1/concept-1.png", mime_type: "image/png" }
};

// A user client that resolves the room context; the spec table is never read
// here because the spec seam is injected.
function userClient(respond: Responder = () => ({ data: null })) {
  return fakeSupabase((call) => {
    if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: null } };
    if (call.table === "rooms" && call.op === "select") return { data: { id: "room-1", room_type: "Living Room" } };
    if (call.table === "concepts" && call.op === "select") return { data: CONCEPT };
    if (call.table === "shopping_lists" && call.op === "insert") return { data: { id: "list-1" } };
    return respond(call);
  }, (storageCall) => (storageCall.op === "download" ? { data: new Blob([Buffer.from([1, 2, 3])]) } : { data: null }));
}

// The service client serves the catalogue, the job row, and the concept
// render download (a few bytes: the resize falls back to a plain data URL).
function serviceClient(respond: Responder = () => ({ data: null })) {
  return fakeSupabase((call) => {
    if (call.table === "products") return { data: CATALOGUE };
    if (call.table === "ai_jobs" && call.op === "insert") return { data: { id: "job-1" } };
    return respond(call);
  }, (storageCall) => (storageCall.op === "download" ? { data: new Blob([Buffer.from([1, 2, 3])]) } : { data: null }));
}

type PaletteResult = Awaited<ReturnType<typeof extractConceptImagePalette>>;
const noPalette = async () =>
  ({ promptKey: "k", promptVersion: "v", model: "stub", textCostUsd: 0, palette: CONCEPT.palette_json }) as unknown as PaletteResult;

async function main() {
  // --- missing room/project/concept resolves not_found, no writes
  {
    const { client } = fakeSupabase(() => ({ data: null }));
    const { client: service, calls: serviceCalls } = fakeSupabase(() => ({ data: null }));
    const result = await groundProductsForRoom({ supabase: client, serviceSupabase: service }, GROUND_INPUT);
    assert.deepEqual(result, { status: "not_found" });
    assert.equal(serviceCalls.filter((call: RecordedCall) => call.op !== "select").length, 0);
  }

  // --- unselected concept blocks with the exact message, nothing written
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: null } };
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") return { data: { ...CONCEPT, status: "generated" } };
      return { data: null };
    });
    const { client: service, calls: serviceCalls } = fakeSupabase(() => ({ data: null }));
    const result = await groundProductsForRoom({ supabase: client, serviceSupabase: service }, GROUND_INPUT);
    assert.deepEqual(result, { status: "blocked", message: "Select a concept before product grounding." });
    assert.equal(calls.filter((call: RecordedCall) => call.op !== "select").length, 0);
    assert.equal(serviceCalls.filter((call: RecordedCall) => call.op !== "select").length, 0);
  }

  // --- the spec gate: unread, in-flight, or unconfirmed specs send the user to /spec
  for (const state of [
    { status: "extraction_needed" as const, conceptId: "concept-1" },
    { status: "extraction_running" as const, jobId: "job-x", startedAt: "2026-09-02T10:00:00.000Z", staleAt: "2026-09-02T10:02:00.000Z" },
    { ...CONFIRMED_SPEC, spec: { ...CONFIRMED_SPEC.spec, status: "extracted" as const } }
  ]) {
    const { client, calls } = userClient();
    const { client: service, calls: serviceCalls } = serviceClient();
    const result = await groundProductsForRoom(
      { supabase: client, serviceSupabase: service },
      GROUND_INPUT,
      { readSpec: async () => state }
    );
    assert.deepEqual(result, { status: "spec_pending" }, `state ${state.status} gates`);
    assert.equal(calls.filter((call: RecordedCall) => call.table === "products").length, 0);
    assert.equal(serviceCalls.filter((call: RecordedCall) => call.op === "insert").length, 0, "no job is opened before the gate");
  }

  // --- confirmed spec, full run: contract-clean pools, the visual pass's picks
  // inside them, the unfillable role and the built-in fixture on the list as
  // missing entries, rows keyed by role, honest bookkeeping on the job
  {
    const { client, calls } = userClient();
    const { client: service, calls: serviceCalls } = serviceClient();
    let passInput: SourceProductsFromConceptInput | null = null;
    let imageRequest: Array<{ id: string }> | null = null;
    const result = await groundProductsForRoom(
      { supabase: client, serviceSupabase: service },
      GROUND_INPUT,
      {
        readSpec: async () => CONFIRMED_SPEC,
        extractPalette: noPalette,
        fetchCandidateImages: async (candidates) => {
          imageRequest = candidates;
          return Object.fromEntries(candidates.map((candidate) => [candidate.id, `data:image/jpeg;base64,${candidate.id.slice(-3)}`]));
        },
        sourceProducts: async (input) => {
          passInput = input;
          return {
            promptKey: "sourcing.spec_visual_product_match",
            promptVersion: "test",
            model: "stub",
            textCostUsd: 0.02,
            needs: [],
            selectedProducts: [
              { productId: SOFA_ID, category: "sofas", roleLabel: "role-1", quantity: 1, matchStatus: "strong_match", visualMatchReason: "Selected for its curved ivory boucle silhouette, matching the sofa in the concept.", mismatchNote: null }
            ],
            roleResults: [
              { category: "sofas", roleLabel: "role-1", status: "strong_match", productId: SOFA_ID, reason: "Curved ivory boucle." },
              { category: "armchairs", roleLabel: "role-2", status: "acceptable_match", productId: CHAIR_ID, reason: "Cognac leather, close silhouette." }
            ],
            missingRoles: []
          };
        }
      }
    );
    assert.deepEqual(result, { status: "sourced", selectedCount: 2, missingRoleCount: 1 });

    // The pass saw only contract-clean pools: the swing chair never reached the
    // lounge-chair pool, the chandelier never reached the floor-lamp role (which
    // therefore has no pool at all), and each pool carries its echo key.
    const seen = passInput as SourceProductsFromConceptInput | null;
    if (!seen) {
      throw new Error("the visual pass was not called");
    }
    assert.deepEqual(
      seen.roleCandidatePools?.map((pool) => [pool.roleLabel, pool.category, pool.candidateIds]),
      [
        ["role-1", "sofas", [SOFA_ID]],
        ["role-2", "armchairs", [CHAIR_ID]]
      ]
    );
    assert.deepEqual(seen.designSpec.roles.map((role) => [role.echoKey, role.label, role.capacity]), [
      ["role-1", "curved three-seat sofa", "seats 3"],
      ["role-2", "cognac leather lounge chair", null]
    ]);
    assert.deepEqual(seen.designSpec.mustPreserve, ["sliding doors"]);
    assert.equal(seen.conceptImageDetail, "high");
    assert.equal(seen.candidateImageDetail, "low");
    assert.deepEqual(Object.keys(seen.candidateImageDataUrls ?? {}).sort(), [SOFA_ID, CHAIR_ID].sort(), "the top of every pool got an image");
    assert.deepEqual(((imageRequest as Array<{ id: string }> | null) ?? []).map((candidate) => candidate.id), [SOFA_ID, CHAIR_ID]);

    // Persisted list: rows for the two filled roles (selected first), the
    // missing floor lamp and the built-in downlights recorded, totals from
    // selected rows only.
    const deletes = calls.filter((call: RecordedCall) => call.table === "shopping_list_items" && call.op === "delete");
    assert.equal(deletes.length, 1);
    const insert = calls.find((call: RecordedCall) => call.table === "shopping_list_items" && call.op === "insert");
    const rows = (insert?.payload as unknown as Array<Record<string, unknown>>) ?? [];
    assert.deepEqual(
      rows.map((row) => [row.product_id, row.status, row.role_label, row.category]),
      [
        [SOFA_ID, "selected", "curved three-seat sofa", "sofas"],
        [CHAIR_ID, "selected", "cognac leather lounge chair", "armchairs"]
      ]
    );
    assert.equal(rows[0].selection_reason, "Selected for its curved ivory boucle silhouette, matching the sofa in the concept.");
    // Rows carry the spec object's key; the list carries its provenance.
    assert.equal(rows[0].spec_key, SOFA_SPEC_KEY);
    assert.ok(rows.every((row) => typeof row.spec_key === "string"));
    const listUpdate = calls.find((call: RecordedCall) => call.table === "shopping_lists" && call.op === "update");
    assert.equal(listUpdate?.payload?.estimated_total_aed, 3000 + 5670);
    assert.equal(listUpdate?.payload?.spec_source, "confirmed_spec");
    assert.equal(listUpdate?.payload?.spec_id, "spec-1");
    const missing = listUpdate?.payload?.missing_roles as Array<Record<string, unknown>>;
    assert.deepEqual(
      missing.map((entry) => [entry.kind, entry.label, entry.category]),
      [
        ["built_in", "recessed downlights", null],
        ["missing", "tall tripod floor lamp", "lighting"]
      ]
    );
    assert.match(String(missing[1].reason), /wrong kind of fixture/);
    assert.ok(String(missing[1].guidance).length > 0);

    // Job bookkeeping: opened before the pass, closed with cost and the truth.
    const jobInsert = serviceCalls.find((call: RecordedCall) => call.table === "ai_jobs" && call.op === "insert");
    assert.equal(jobInsert?.payload?.status, "running");
    assert.equal((jobInsert?.payload?.input_summary as { specSource?: string })?.specSource, "confirmed_spec");
    const jobUpdate = serviceCalls.find((call: RecordedCall) => call.table === "ai_jobs" && call.op === "update");
    assert.equal(jobUpdate?.payload?.status, "succeeded");
    assert.equal(jobUpdate?.payload?.cost_estimate_usd, 0.02);
    const summary = jobUpdate?.payload?.output_summary as Record<string, unknown>;
    assert.deepEqual(summary.missingRoles, ["tall tripod floor lamp"]);
    assert.deepEqual(summary.unsourceable, ["recessed downlights"]);
    assert.equal((summary.visualPass as { used: boolean }).used, true);
    assert.equal((summary.contractRejections as Record<string, number>).silhouette_excluded, 1);
    assert.equal(summary.selectedCount, 2);
  }

  // --- the visual pass judging a role unmatched keeps it missing with its own
  // reason, even though the pool had a contract-clean candidate
  {
    const { client, calls } = userClient();
    const { client: service } = serviceClient();
    const result = await groundProductsForRoom(
      { supabase: client, serviceSupabase: service },
      GROUND_INPUT,
      {
        readSpec: async () => CONFIRMED_SPEC,
        extractPalette: noPalette,
        fetchCandidateImages: async () => ({}),
        sourceProducts: async () => ({
          promptKey: "k",
          promptVersion: "v",
          model: "stub",
          textCostUsd: 0.01,
          needs: [],
          selectedProducts: [],
          roleResults: [
            { category: "sofas", roleLabel: "role-1", status: "missing_required", productId: null, reason: "The only sofa is a straight three-seater; the design is curved." },
            { category: "armchairs", roleLabel: "role-2", status: "strong_match", productId: CHAIR_ID, reason: "Matches." }
          ],
          missingRoles: ["role-1"]
        })
      }
    );
    assert.deepEqual(result, { status: "sourced", selectedCount: 1, missingRoleCount: 2 });
    const listUpdate = calls.find((call: RecordedCall) => call.table === "shopping_lists" && call.op === "update");
    const missing = listUpdate?.payload?.missing_roles as Array<Record<string, unknown>>;
    const sofa = missing.find((entry) => entry.label === "curved three-seat sofa");
    assert.match(String(sofa?.reason), /visual pass found no catalogue piece.*straight three-seater/);
  }

  // --- the pass failing (timeout, provider) degrades to honest ranking: rows
  // say so, the job records the failure and no visual claim
  {
    const { client, calls } = userClient();
    const { client: service, calls: serviceCalls } = serviceClient();
    const result = await groundProductsForRoom(
      { supabase: client, serviceSupabase: service },
      GROUND_INPUT,
      {
        readSpec: async () => CONFIRMED_SPEC,
        extractPalette: noPalette,
        fetchCandidateImages: async () => ({}),
        sourceProducts: async () => {
          throw new Error("Product visual sourcing timed out.");
        }
      }
    );
    assert.deepEqual(result, { status: "sourced", selectedCount: 2, missingRoleCount: 1 });
    const insert = calls.find((call: RecordedCall) => call.table === "shopping_list_items" && call.op === "insert");
    const rows = (insert?.payload as unknown as Array<Record<string, unknown>>) ?? [];
    assert.ok(rows.every((row) => String(row.selection_reason).includes("catalogue ranking")));
    const jobUpdate = serviceCalls.find((call: RecordedCall) => call.table === "ai_jobs" && call.op === "update");
    assert.equal(jobUpdate?.payload?.status, "succeeded");
    const pass = (jobUpdate?.payload?.output_summary as { visualPass: { used: boolean; error: string | null } }).visualPass;
    assert.equal(pass.used, false);
    assert.match(String(pass.error), /timed out/);
  }

  // --- the paid pass succeeded but the list could not be written: the job
  // closes failed WITH the pass's cost, and the failure surfaces to the caller
  {
    const { client } = userClient((call) =>
      call.table === "shopping_list_items" && call.op === "delete" ? { error: { message: "shopping_list_items is unavailable" } } : { data: null }
    );
    const { client: service, calls: serviceCalls } = serviceClient();
    await assert.rejects(
      groundProductsForRoom(
        { supabase: client, serviceSupabase: service },
        GROUND_INPUT,
        {
          readSpec: async () => CONFIRMED_SPEC,
          extractPalette: noPalette,
          fetchCandidateImages: async () => ({}),
          sourceProducts: async () => ({
            promptKey: "k",
            promptVersion: "v",
            model: "stub",
            textCostUsd: 0.03,
            needs: [],
            selectedProducts: [],
            roleResults: [{ category: "sofas", roleLabel: "role-1", status: "strong_match", productId: SOFA_ID, reason: "Matches." }],
            missingRoles: []
          })
        }
      ),
      /shopping_list_items is unavailable/
    );
    const jobUpdate = serviceCalls.find((call: RecordedCall) => call.table === "ai_jobs" && call.op === "update");
    assert.equal(jobUpdate?.payload?.status, "failed", "a paid pass never leaves the job running");
    assert.equal(jobUpdate?.payload?.cost_estimate_usd, 0.03, "the spend is real even though the list was not written");
    assert.match(String(jobUpdate?.payload?.error_message), /shopping_list_items is unavailable/);
    assert.equal((jobUpdate?.payload?.output_summary as { failedAfterVisualPass: boolean }).failedAfterVisualPass, true);
  }

  // --- a room whose extraction failed sources against the blueprint roles
  // through the same contracts, and the job says so
  {
    const { client, calls } = userClient();
    const { client: service, calls: serviceCalls } = serviceClient();
    let poolLabels: string[] = [];
    const result = await groundProductsForRoom(
      { supabase: client, serviceSupabase: service },
      GROUND_INPUT,
      {
        readSpec: async () => ({ status: "extraction_failed", conceptId: "concept-1", retryable: true }),
        extractPalette: noPalette,
        fetchCandidateImages: async () => ({}),
        sourceProducts: async (input) => {
          poolLabels = (input.roleCandidatePools ?? []).map((pool) => pool.roleLabel);
          throw new Error("no pass in this test");
        }
      }
    );
    assert.equal(result.status, "sourced");
    assert.ok(poolLabels.length > 0, "blueprint roles produced pools");
    const jobInsert = serviceCalls.find((call: RecordedCall) => call.table === "ai_jobs" && call.op === "insert");
    assert.equal((jobInsert?.payload?.input_summary as { specSource?: string })?.specSource, "blueprint_fallback");
    // The list records that its rows came from the room type, not the design.
    const listUpdate = calls.find((call: RecordedCall) => call.table === "shopping_lists" && call.op === "update");
    assert.equal(listUpdate?.payload?.spec_source, "blueprint_fallback");
    assert.equal(listUpdate?.payload?.spec_id, null);
  }

  // --- an empty catalogue blocks honestly before any job is opened
  {
    const { client } = userClient();
    const { client: service, calls: serviceCalls } = fakeSupabase(
      (call) => (call.table === "products" ? { data: [] } : { data: null }),
      (storageCall) => (storageCall.op === "download" ? { data: new Blob([Buffer.from([1, 2, 3])]) } : { data: null })
    );
    const result = await groundProductsForRoom(
      { supabase: client, serviceSupabase: service },
      GROUND_INPUT,
      { readSpec: async () => CONFIRMED_SPEC, extractPalette: noPalette }
    );
    assert.equal(result.status, "blocked");
    assert.equal(serviceCalls.filter((call: RecordedCall) => call.op === "insert").length, 0);
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
    const result = await refreshShoppingOptions({ supabase: client, serviceSupabase: service }, REFILL_INPUT);
    assert.deepEqual(result, { status: "no_change" });
    assert.equal(calls.filter((call: RecordedCall) => call.op !== "select").length, 0);
  }

  // --- refreshShoppingOptions success: rejects only non-selected options of
  // THIS role, inserts fresh ranked options, and a spec role constrains them
  {
    const freshId = "00000000-0000-4000-8000-00000000bbbb";
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "shopping_lists") return { data: { id: "list-1", concept_id: "concept-1" } };
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: null } };
      if (call.table === "concepts") return { data: { title: "T", description: null } };
      if (call.table === "shopping_list_items" && call.op === "select") {
        return {
          data: [
            { id: "i1", product_id: "p1", status: "selected", ...ITEM_TEMPLATE, role_label: "curved three-seat sofa", option_rank: 0 },
            { id: "i2", product_id: "p2", status: "option", ...ITEM_TEMPLATE, role_label: "curved three-seat sofa", option_rank: 1 }
          ]
        };
      }
      return { data: null };
    });
    const { client: service } = fakeSupabase((call) => {
      if (call.table === "products") {
        return {
          data: [
            productRow({ id: freshId, name: "Milo 3 Seater Sofa" }),
            productRow({ id: "00000000-0000-4000-8000-00000000cccc", name: "Milo 2 Seater Sofa", dimensions: [{ width_cm: 160, depth_cm: 90, height_cm: 80, source_text: "160x90x80" }] })
          ]
        };
      }
      if (call.table === "room_design_specs") {
        return { data: { id: "spec-1", room_id: "room-1", concept_id: "concept-1", objects: CONFIRMED_SPEC.spec.objects, must_preserve: [], status: "confirmed" } };
      }
      return { data: null };
    });
    const result = await refreshShoppingOptions(
      { supabase: client, serviceSupabase: service },
      { ...REFILL_INPUT, roleLabel: "curved three-seat sofa" }
    );
    assert.deepEqual(result, { status: "refreshed" });
    const reject = calls.find((call: RecordedCall) => call.table === "shopping_list_items" && call.op === "update");
    assert.ok(reject?.filters.some(([column, value]) => column === "role_label" && value === "curved three-seat sofa"), "reject is scoped to the role");
    assert.deepEqual(reject?.neq, [["status", "selected"]]);
    const insert = calls.find((call: RecordedCall) => call.table === "shopping_list_items" && call.op === "insert");
    const rows = (insert?.payload as unknown as Array<Record<string, unknown>>) ?? [];
    assert.deepEqual(rows.map((row) => row.product_id), [freshId], "the two-seater cannot refill a seats-3 sofa role");
    assert.equal(rows[0].role_label, "curved three-seat sofa");
  }

  // --- refreshShoppingOptions without a caller identity: the rows' spec key
  // defines the role, the reject is scoped by that key, and new rows carry it
  {
    const freshId = "00000000-0000-4000-8000-00000000bbbb";
    const specRow = { id: "spec-1", room_id: "room-1", concept_id: "concept-1", objects: CONFIRMED_SPEC.spec.objects, must_preserve: [], status: "confirmed" };
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "shopping_lists") return { data: { id: "list-1", concept_id: "concept-1" } };
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: null } };
      if (call.table === "concepts") return { data: { title: "T", description: null } };
      if (call.table === "shopping_list_items" && call.op === "select") {
        return {
          data: [
            { id: "i1", product_id: "p1", status: "selected", ...ITEM_TEMPLATE, spec_key: SOFA_SPEC_KEY, role_label: "renamed on /spec", option_rank: 0 },
            { id: "i2", product_id: "p2", status: "option", ...ITEM_TEMPLATE, spec_key: SOFA_SPEC_KEY, role_label: "renamed on /spec", option_rank: 1 }
          ]
        };
      }
      return { data: null };
    });
    const { client: service } = fakeSupabase((call) => {
      if (call.table === "products") {
        return {
          data: [
            productRow({ id: freshId, name: "Milo 3 Seater Sofa" }),
            productRow({ id: "00000000-0000-4000-8000-00000000cccc", name: "Milo 2 Seater Sofa", dimensions: [{ width_cm: 160, depth_cm: 90, height_cm: 80, source_text: "160x90x80" }] })
          ]
        };
      }
      if (call.table === "room_design_specs") return { data: specRow };
      return { data: null };
    });
    const result = await refreshShoppingOptions({ supabase: client, serviceSupabase: service }, REFILL_INPUT);
    assert.deepEqual(result, { status: "refreshed" }, "an edited label never drops the contract: identity is the key");
    const reject = calls.find((call: RecordedCall) => call.table === "shopping_list_items" && call.op === "update");
    assert.ok(reject?.filters.some(([column, value]) => column === "spec_key" && value === SOFA_SPEC_KEY), "reject is scoped by spec key");
    assert.ok(!reject?.filters.some(([column]) => column === "role_label"));
    const insert = calls.find((call: RecordedCall) => call.table === "shopping_list_items" && call.op === "insert");
    const rows = (insert?.payload as unknown as Array<Record<string, unknown>>) ?? [];
    assert.deepEqual(rows.map((row) => [row.product_id, row.spec_key]), [[freshId, SOFA_SPEC_KEY]], "seats-3 contract applied; the key is carried");
    assert.ok(!String(rows[0].selection_reason).includes("Warning"), "reasons are prose, never ranking warnings");
  }

  // --- refills on a list whose spec moved on refuse with stale_spec, no writes
  {
    const specRow = { id: "spec-2", room_id: "room-1", concept_id: "concept-1", objects: CONFIRMED_SPEC.spec.objects, must_preserve: [], status: "confirmed" };
    const staleRows = [
      { id: "i1", product_id: "p1", status: "selected", ...ITEM_TEMPLATE, spec_key: "obj:99:vanished", option_rank: 0 },
      { id: "i2", product_id: "p2", status: "option", ...ITEM_TEMPLATE, spec_key: "obj:99:vanished", option_rank: 1 }
    ];
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "shopping_lists") return { data: { id: "list-1", concept_id: "concept-1" } };
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: null } };
      if (call.table === "concepts") return { data: { title: "T", description: null } };
      if (call.table === "shopping_list_items" && call.op === "select") return { data: staleRows };
      return { data: null };
    });
    const { client: service } = fakeSupabase((call) => {
      if (call.table === "products") return { data: [productRow({ id: "00000000-0000-4000-8000-00000000bbbb" })] };
      if (call.table === "room_design_specs") return { data: specRow };
      return { data: null };
    });
    assert.deepEqual(await refreshShoppingOptions({ supabase: client, serviceSupabase: service }, REFILL_INPUT), { status: "stale_spec" });
    assert.deepEqual(await findMoreShoppingOptions({ supabase: client, serviceSupabase: service }, REFILL_INPUT), { status: "stale_spec" });
    assert.equal(calls.filter((call: RecordedCall) => call.op !== "select").length, 0);
  }

  // --- two roles in one category with no caller identity are never blended
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "shopping_lists") return { data: { id: "list-1", concept_id: "concept-1" } };
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: null } };
      if (call.table === "concepts") return { data: { title: "T", description: null } };
      if (call.table === "shopping_list_items" && call.op === "select") {
        return {
          data: [
            { id: "i1", product_id: "p1", status: "selected", ...ITEM_TEMPLATE, spec_key: "obj:3:floor_lamp", role_label: "floor lamp", option_rank: 0 },
            { id: "i2", product_id: "p2", status: "option", ...ITEM_TEMPLATE, spec_key: "obj:7:pendant", role_label: "pendant", option_rank: 1 }
          ]
        };
      }
      return { data: null };
    });
    const { client: service } = fakeSupabase(() => ({ data: [] }));
    assert.deepEqual(await refreshShoppingOptions({ supabase: client, serviceSupabase: service }, { ...REFILL_INPUT, category: "lighting" }), { status: "no_change" });
    assert.equal(calls.filter((call: RecordedCall) => call.op !== "select").length, 0);
  }

  // --- findMoreShoppingOptions: zero candidates resolves no_candidates without insert
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "shopping_lists") return { data: { id: "list-1", concept_id: "concept-1" } };
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: null } };
      if (call.table === "concepts") return { data: { title: "T", description: null } };
      if (call.table === "shopping_list_items") return { data: [{ product_id: "p1", ...ITEM_TEMPLATE }] };
      return { data: null };
    });
    // No spec row for the concept (a real maybeSingle answers null, never an
    // empty array) and an empty catalogue.
    const { client: service } = fakeSupabase((call) => (call.table === "room_design_specs" ? { data: null } : { data: [] }));
    const result = await findMoreShoppingOptions({ supabase: client, serviceSupabase: service }, REFILL_INPUT);
    assert.deepEqual(result, { status: "no_candidates" });
    assert.equal(calls.filter((call: RecordedCall) => call.op === "insert").length, 0);
  }

  // --- findMoreShoppingOptions: missing gates resolve no_change
  {
    const { client } = fakeSupabase(() => ({ data: null }));
    const { client: service } = fakeSupabase(() => ({ data: [] }));
    const result = await findMoreShoppingOptions({ supabase: client, serviceSupabase: service }, REFILL_INPUT);
    assert.deepEqual(result, { status: "no_change" });
  }

  console.log("product-sourcing service tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
