import assert from "node:assert/strict";

import { fakeSupabase, type RecordedCall } from "./supabase-test-double";
import { writeBriefDocument } from "./brief-document";

// S5b, PR review: two writers share `design_briefs.structured_json`.
//
// `saveDesignBriefAction` owns `visualPreferences`, `measurements` and
// `spatialIntent`; the floor plan confirmation owns `floorPlan`. Both read the
// whole document, merge their key, and write the whole thing back, and the
// screen lets a shopper press Continue while a confirmation is in flight.
//
// The first fix guarded only the confirmation, which closed one ordering and
// left the other open: the save action could still write a document it had
// read before the confirmation landed, erasing the room she had just picked.
// The guard belongs to the column, so both orderings are exercised here.

const ROOM = "11111111-1111-4111-8111-111111111111";

type Doc = Record<string, unknown>;

function harness({ start, id = "brief-1" }: { start: Doc | null; id?: string | null }) {
  const calls: RecordedCall[] = [];
  let document: Doc | null = start;
  let version = "2026-09-10T10:00:00Z";
  let interleave: (() => void) | null = null;

  const { client } = fakeSupabase((call) => {
    calls.push(call);
    if (call.table !== "design_briefs") {
      return { data: null };
    }
    if (call.op === "select") {
      return { data: document === null ? null : { id, structured_json: document, updated_at: version } };
    }
    if (call.op === "insert") {
      document = (call.payload?.structured_json ?? {}) as Doc;
      return { data: { id } };
    }
    // The other writer lands between this writer's read and its write.
    if (interleave) {
      interleave();
      interleave = null;
    }
    const guardedOn = call.filters.find(([field]) => field === "updated_at")?.[1];
    if (guardedOn !== version) {
      return { data: [] };
    }
    document = (call.payload?.structured_json ?? {}) as Doc;
    version = `2026-09-10T10:00:0${calls.length}Z`;
    return { data: [{ id }] };
  });

  return {
    calls,
    supabase: client as never,
    document: () => document,
    updates: () => calls.filter((call) => call.table === "design_briefs" && call.op === "update"),
    concurrently: (change: Doc) => {
      interleave = () => {
        document = { ...(document ?? {}), ...change };
        version = "2026-09-10T11:00:00Z";
      };
    }
  };
}

async function main() {
  // The ordering the first fix covered: a confirmation writes while the save
  // action holds a stale read.
  {
    const h = harness({ start: { visualPreferences: { likedStyleSlugs: ["quiet-luxury"] } } });
    h.concurrently({ floorPlan: { assetId: "plan-a", label: "Living Room", index: 0 } });

    await writeBriefDocument(h.supabase, ROOM, {
      columns: { color_notes: "cool limestone and pale oak" },
      merge: (current) => ({ ...current, measurements: { wallLengthCm: 470 } })
    });

    assert.equal(h.updates().length, 2, "the guarded write lost once and was retried");
    const document = h.document() as Doc;
    assert.deepEqual(document.floorPlan, { assetId: "plan-a", label: "Living Room", index: 0 }, "the room she picked survives");
    assert.deepEqual(document.measurements, { wallLengthCm: 470 }, "and so does what this writer came to say");
    assert.ok(document.visualPreferences, "along with everything that was already there");
    assert.equal(
      h.updates()[1].payload?.color_notes,
      "cool limestone and pale oak",
      "the columns this write owns are re-applied on the retry, not dropped"
    );
  }

  // The ordering the review found, which the first fix left open: the SAVE
  // action writes while a confirmation it never saw has already landed.
  {
    const h = harness({ start: { visualPreferences: { likedStyleSlugs: ["quiet-luxury"] } } });
    h.concurrently({ measurements: { wallLengthCm: 470 }, spatialIntent: { focalPoint: "fireplace" } });

    await writeBriefDocument(h.supabase, ROOM, {
      merge: (current) => ({ ...current, floorPlan: { assetId: "plan-a", label: "Living Room", index: 0 } })
    });

    const document = h.document() as Doc;
    assert.deepEqual(document.floorPlan, { assetId: "plan-a", label: "Living Room", index: 0 });
    assert.deepEqual(document.measurements, { wallLengthCm: 470 }, "her typed measurements survive the confirmation");
    assert.deepEqual(document.spatialIntent, { focalPoint: "fireplace" }, "and so does everything else she answered");
  }

  // Every write carries the guard, whichever writer it is.
  {
    const h = harness({ start: {} });
    await writeBriefDocument(h.supabase, ROOM, { merge: (current) => ({ ...current, floorPlan: null }) });
    assert.ok(
      h.updates().every((call) => call.filters.some(([field]) => field === "updated_at")),
      "guarded on the version it read"
    );
  }

  // A room with no brief row yet is created, not guarded against nothing.
  {
    const h = harness({ start: null });
    const { id } = await writeBriefDocument(h.supabase, ROOM, {
      columns: { color_notes: "warm walnut" },
      merge: (current) => ({ ...current, floorPlan: { assetId: "plan-a", label: "Living Room", index: 0 } })
    });
    assert.equal(id, "brief-1");
    const inserted = h.calls.filter((call) => call.table === "design_briefs" && call.op === "insert");
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].payload?.room_id, ROOM);
    assert.equal(inserted[0].payload?.color_notes, "warm walnut");
  }

  // Losing three times in a row is not contention. Better a write that fails
  // and says so than one that drops an answer.
  {
    const calls: RecordedCall[] = [];
    const { client } = fakeSupabase((call) => {
      calls.push(call);
      if (call.table !== "design_briefs") {
        return { data: null };
      }
      return call.op === "select"
        ? { data: { id: "brief-1", structured_json: {}, updated_at: "2026-09-10T10:00:00Z" } }
        : { data: [] };
    });

    await assert.rejects(
      writeBriefDocument(client as never, ROOM, { merge: (current) => current }),
      /saved from two places at once/
    );
    assert.equal(calls.filter((call) => call.op === "update").length, 3, "bounded, not a spin");
  }

  console.log("brief document writer tests passed");
}

void main();
