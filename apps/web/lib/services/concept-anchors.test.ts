import assert from "node:assert/strict";

import type { AnchorSetPick, AnchorSetResult } from "@ritzy-studio/ai";
import type { RankedProductMatch } from "@ritzy-studio/domain";

import { chooseConceptAnchors, claimAnchoredPools, persistConceptAnchors } from "./concept-anchors";
import { fakeSupabase, type RecordedCall, type Responder } from "./supabase-test-double";

// The anchor path decides what a paid render is built around, so what it does
// when the aesthetic pass declines, fails, or cannot be afforded is the
// contract. The pass itself is injected; nothing here makes a paid call.

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example-project.supabase.co";

const INPUT = {
  userId: "user-1",
  roomId: "room-1",
  roomType: "Living Room",
  roomPhotoDataUrl: "data:image/jpeg;base64,ROOM",
  budgetMaxAed: null,
  designBrief: { style_notes: "warm minimal", color_notes: "olive and brass", avoid_notes: "no beige" },
  styleSlugs: ["warm-minimal"],
  measurements: null,
  startedAt: 0
};

// The domain candidate schema requires uuid product ids, so the fixtures carry
// real ones and this map keeps the assertions readable.
const ID = {
  "sofa-1": "11111111-1111-4111-8111-111111111111",
  "sofa-2": "22222222-2222-4222-8222-222222222222",
  "rug-1": "33333333-3333-4333-8333-333333333333",
  "rug-2": "44444444-4444-4444-8444-444444444444",
  "chair-1": "55555555-5555-4555-8555-555555555555",
  "table-1": "66666666-6666-4666-8666-666666666666",
  "sofa-beige": "77777777-7777-4777-8777-777777777777"
} as const;

function product(key: keyof typeof ID, category: string, name: string, extra: Record<string, unknown> = {}) {
  const id = ID[key];
  return {
    id,
    name,
    category_normalized: category,
    price_aed: 4000,
    primary_image_url: `https://retailer.example/${id}.jpg`,
    canonical_url: `https://retailer.example/${id}`,
    description: name,
    sale_price_aed: null,
    availability: "in stock",
    color: "olive",
    material: "linen",
    style_tags: ["warm-minimal"],
    color_tags: ["olive"],
    material_tags: ["linen"],
    room_tags: ["living_room"],
    last_checked_at: "2026-09-01T00:00:00Z",
    retailer: { name: `Retailer ${id}`, status: "active" },
    dimensions: [],
    ...extra
  };
}

const CATALOGUE = [
  product("sofa-1", "sofas", "Osvaldo 3 Seater Sofa Olive"),
  product("sofa-2", "sofas", "Marlow 3 Seater Sofa Slate"),
  product("rug-1", "rugs", "Fara Dhurry Rug 300X400"),
  product("rug-2", "rugs", "Bryn Dhurry Rug 400X500"),
  product("chair-1", "armchairs", "Vina Accent Chair Bluegrey"),
  product("table-1", "coffee_tables", "Dimension Coffee Table Grey Steel")
];

function clients({
  catalogue = CATALOGUE,
  recentAnchors = [] as Array<{ product_id: string }>,
  onCall
}: {
  catalogue?: unknown[];
  recentAnchors?: Array<{ product_id: string }>;
  onCall?: (call: RecordedCall) => void;
} = {}) {
  const respondUser: Responder = (call) => {
    onCall?.(call);
    if (call.table === "concept_anchors" && call.op === "select") return { data: recentAnchors };
    return { data: null };
  };
  const respondService: Responder = (call) => {
    onCall?.(call);
    if (call.table === "products") return { data: catalogue };
    if (call.table === "ai_jobs" && call.op === "insert") return { data: { id: "anchor-job-1" } };
    return { data: null };
  };
  const user = fakeSupabase(respondUser);
  const service = fakeSupabase(respondService);
  return { user, service, clients: { supabase: user.client, serviceSupabase: service.client } };
}

const fetchImage = async (url: string) => ({ bytes: Buffer.from(`bytes:${url}`), mimeType: "image/jpeg" });

function passResult(picks: AnchorSetPick[], setNote = "olive and steel", textCostUsd: number | null = 0.02): AnchorSetResult {
  return { promptKey: "k", promptVersion: "v", model: "gpt-5.1", textCostUsd, picks, dropped: [], setNote };
}

async function main() {
  // --- The pass chooses; only what it chose is anchored.
  {
    const { clients: c, service } = clients();
    const outcome = await chooseConceptAnchors(c, INPUT, {
      fetchImage,
      selectSet: async ({ roles }) =>
        passResult([{ roleKey: roles[0].roleKey, productId: roles[0].candidates[0].productId, reason: "grounds it" }]),
      now: () => 0
    });

    assert.equal(outcome.status, "chosen");
    assert.equal(outcome.anchors.length, 1, "a role the pass declined stays declined");
    assert.equal(outcome.anchors[0].source, "aesthetic_pass");
    assert.equal(outcome.anchors[0].reason, "grounds it");
    assert.ok(outcome.anchors[0].imageBytes.length > 0, "an anchor carries the bytes the render is built from");
    assert.equal(outcome.setNote, "olive and steel");
    assert.equal(outcome.costUsd, 0.02);

    // The paid call is bracketed by a job row: opened before it, closed with
    // its cost after (criterion 9).
    const jobCalls = service.calls.filter((call: RecordedCall) => call.table === "ai_jobs");
    assert.equal(jobCalls[0].op, "insert");
    assert.equal(jobCalls[0].payload?.status, "running");
    assert.equal(jobCalls[0].payload?.job_type, "anchor_set_selection");
    assert.equal(jobCalls[1].op, "update");
    assert.equal(jobCalls[1].payload?.status, "succeeded");
    assert.equal(jobCalls[1].payload?.cost_estimate_usd, 0.02);
  }

  // --- A role the pass declines is NOT filled with the head of the shortlist
  // it just rejected. Sourcing fills it afterwards, on the list, where a
  // shopper can see the options; anchoring it would put the rejected piece in
  // the render and make it the room.
  {
    const { clients: c } = clients();
    const outcome = await chooseConceptAnchors(c, INPUT, {
      fetchImage,
      selectSet: async () => passResult([], "nothing here works together", 0.01),
      now: () => 0
    });
    assert.equal(outcome.status, "chosen");
    assert.deepEqual(outcome.anchors, []);
  }

  // --- The pass fails: the room still gets anchors, from the ranked
  // shortlist, and the job says the pass is why (criterion 10).
  {
    const { clients: c, service } = clients();
    const outcome = await chooseConceptAnchors(c, INPUT, {
      fetchImage,
      selectSet: async () => {
        throw new Error("provider timeout");
      },
      now: () => 0
    });
    assert.equal(outcome.status, "pass_failed");
    assert.equal(outcome.error, "provider timeout");
    assert.ok(outcome.anchors.length > 0, "a room without the pass still gets a concept built on real pieces");
    assert.ok(outcome.anchors.every((anchor) => anchor.source === "ranked_shortlist"));
    const jobUpdate = service.calls.find((call: RecordedCall) => call.table === "ai_jobs" && call.op === "update");
    assert.equal(jobUpdate?.payload?.status, "failed");
    assert.equal(jobUpdate?.payload?.error_message, "provider timeout");
  }

  // --- No budget left for the pass: the shortlist decides and nothing is paid
  // for. Starting a call that cannot return spends tokens and records nothing.
  {
    const { clients: c, service } = clients();
    let called = false;
    const outcome = await chooseConceptAnchors(c, INPUT, {
      fetchImage,
      selectSet: async () => {
        called = true;
        throw new Error("must not run");
      },
      now: () => 280_000
    });
    assert.equal(outcome.status, "skipped_no_budget");
    assert.ok(!called, "no paid call is started without the time to finish it");
    assert.ok(outcome.anchors.length > 0);
    assert.equal(service.calls.filter((call: RecordedCall) => call.table === "ai_jobs").length, 0);
  }

  // --- A product whose photograph cannot be fetched cannot anchor anything.
  // The pass needs the image to judge it and the render needs it to build from,
  // so there is no path where an unfetchable piece becomes the room.
  {
    const { clients: c } = clients();
    const outcome = await chooseConceptAnchors(c, INPUT, {
      fetchImage: async () => null,
      selectSet: async () => {
        throw new Error("must not run");
      },
      now: () => 0
    });
    assert.equal(outcome.status, "no_images");
    assert.deepEqual(outcome.anchors, []);
  }

  // --- The recency read is scoped to the owner by the row policy, not by a
  // filter this code could forget, and it never counts the room being generated.
  {
    const seen: RecordedCall[] = [];
    const { clients: c } = clients({
      recentAnchors: [{ product_id: ID["sofa-1"] }],
      onCall: (call) => {
        if (call.table === "concept_anchors") seen.push(call);
      }
    });
    const outcome = await chooseConceptAnchors(c, INPUT, {
      fetchImage,
      selectSet: async () => {
        throw new Error("fall back");
      },
      now: () => 0
    });
    assert.deepEqual(seen[0].neq, [["room_id", "room-1"]]);
    assert.deepEqual(seen[0].order, [["created_at", { ascending: false }]]);
    assert.ok(
      outcome.anchors.every((anchor) => anchor.product.id !== ID["sofa-1"]),
      "a piece anchored recently is not offered again"
    );
  }

  // --- A brief's prohibitions are a hard filter on an anchor, not a penalty.
  // The render is built AROUND the piece, so one the brief rules out cannot be
  // the last candidate standing.
  {
    const { clients: c } = clients({
      catalogue: [
        product("sofa-beige", "sofas", "Rio 4-Seater Sofa Beige", { color: "beige", color_tags: ["beige"] }),
        product("rug-1", "rugs", "Fara Dhurry Rug 300X400")
      ]
    });
    const outcome = await chooseConceptAnchors(c, INPUT, {
      fetchImage,
      selectSet: async () => {
        throw new Error("fall back");
      },
      now: () => 0
    });
    assert.ok(
      outcome.anchors.every((anchor) => anchor.product.id !== ID["sofa-beige"]),
      "a no-beige brief cannot be anchored on a beige sofa"
    );
  }

  // --- Persistence names the conflict target, so a retried generation updates
  // the concept's anchors instead of failing on the unique index.
  {
    const { client, calls } = fakeSupabase(() => ({ data: null }));
    await persistConceptAnchors(client, {
      roomId: "room-1",
      conceptId: "concept-1",
      anchors: [
        {
          roleKey: "sofas",
          roleCategory: "sofas",
          roleLabel: "Sofa",
          product: { id: ID["sofa-1"], name: "Osvaldo" } as RankedProductMatch,
          imageBytes: Buffer.from("x"),
          imageMimeType: "image/jpeg",
          source: "aesthetic_pass",
          reason: "grounds it"
        }
      ],
      selectionJobId: "anchor-job-1"
    });
    assert.equal(calls[0].op, "upsert");
    assert.equal(calls[0].table, "concept_anchors");
    assert.equal(calls[0].upsertOptions?.onConflict, "concept_id,role_key");

    // Nothing chosen writes nothing, rather than an empty upsert.
    const { client: empty, calls: emptyCalls } = fakeSupabase(() => ({ data: null }));
    await persistConceptAnchors(empty, { roomId: "r", conceptId: "c", anchors: [], selectionJobId: null });
    assert.equal(emptyCalls.length, 0);
  }

  // --- Which spec roles sourcing must not decide again.
  {
    const pool = (category: string, ids: string[]) => ({ role: { category }, candidates: ids.map((id) => ({ id })) });
    const anchor = (role_category: string, product_id: string) => ({ role_category, product_id, reason: null });

    // The ordinary case: the anchor claims its category's role, which then does
    // not appear in what is left for the pass to source.
    {
      const pools = [pool("sofas", ["s1", "s2"]), pool("rugs", ["r1"])];
      const result = claimAnchoredPools({ pools, anchors: [anchor("sofas", "s2")] });
      assert.deepEqual(result.anchored.map((claim) => claim.productId), ["s2"]);
      assert.deepEqual(result.remaining.map((entry) => entry.role.category), ["rugs"]);
      assert.deepEqual(result.unclaimed, []);
    }

    // A living-dining hall carries two roles in one category. One anchor takes
    // one of them; the other is sourced normally rather than being overwritten.
    {
      const pools = [pool("sofas", ["s1"]), pool("sofas", ["s1", "s9"])];
      const result = claimAnchoredPools({ pools, anchors: [anchor("sofas", "s1")] });
      assert.equal(result.anchored.length, 1);
      assert.equal(result.remaining.length, 1);
    }

    // A category the spec has no role for cannot be claimed. The render still
    // contains the piece; sourcing simply has nothing to attach it to, and the
    // count is reported rather than lost.
    {
      const result = claimAnchoredPools({ pools: [pool("rugs", ["r1"])], anchors: [anchor("sofas", "s1")] });
      assert.deepEqual(result.anchored, []);
      assert.deepEqual(result.unclaimed, ["s1"]);
      assert.equal(result.remaining.length, 1, "and the role it could not claim is still sourced");
    }

    // The anchor sits below the cut the sourcing pass is sized for. The pool is
    // rebuilt deeper, on the same contracts and the same scorer, before the
    // claim is given up.
    {
      const shallow = pool("sofas", ["s1"]);
      const deep = pool("sofas", ["s1", "s2", "s3"]);
      const result = claimAnchoredPools({
        pools: [shallow],
        anchors: [anchor("sofas", "s3")],
        deepen: () => deep
      });
      assert.deepEqual(result.anchored.map((claim) => claim.pool), [deep]);
      assert.deepEqual(result.remaining, []);
    }

    // Deeper and still absent: the contracts genuinely reject the piece for
    // this role. It is not forced in with a score nobody computed.
    {
      const shallow = pool("sofas", ["s1"]);
      const result = claimAnchoredPools({
        pools: [shallow],
        anchors: [anchor("sofas", "s3")],
        deepen: () => null
      });
      assert.deepEqual(result.anchored, []);
      assert.deepEqual(result.unclaimed, ["s3"]);
      assert.deepEqual(result.remaining, [shallow], "the role goes to normal sourcing");
    }
  }

  console.log("concept-anchors tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
