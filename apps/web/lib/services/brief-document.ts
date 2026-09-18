import type { Database } from "@ritzy-studio/db";

import { structuredBriefJson } from "./sourcing-support";
import type { UserSupabaseClient } from "./supabase-clients";

// The one writer of `design_briefs.structured_json` (S5b, PR review).
//
// Two paths write that column: `saveDesignBriefAction`, which owns
// `visualPreferences`, `measurements` and `spatialIntent`, and the floor plan
// confirmation, which owns `floorPlan`. Both read the whole document, merge
// their key into it, and write the whole thing back, and the screen lets a
// shopper press Continue while a confirmation is in flight. Whichever write
// READ first loses its key when the other one lands, in either order: her
// typed answers, or the room she just picked.
//
// PostgREST cannot set one jsonb key without an RPC, and an RPC is a migration
// this slice does not carry, so every write goes through here and is guarded.
// `design_briefs` has a `before update` trigger that stamps `updated_at`
// (initial schema, line 290), so a write guarded on the value it read matches
// zero rows the moment anyone else has written; then it reads again, merges
// onto THEIR version, and tries once more.
//
// A first version guarded only the confirmation, which closed one ordering and
// left the other wide open: the save action could still write a stale document
// over a confirmation that had just landed. The guard belongs to the column,
// not to one of its writers.

export const BRIEF_WRITE_ATTEMPTS = 3;

export type StructuredBriefDocument = ReturnType<typeof structuredBriefJson>;

export type BriefColumns = Omit<
  Database["public"]["Tables"]["design_briefs"]["Update"],
  "structured_json" | "room_id" | "id"
>;

export async function writeBriefDocument(
  supabase: UserSupabaseClient,
  roomId: string,
  {
    columns = {},
    // Called with whatever is in the column RIGHT NOW, on every attempt, so a
    // retry merges onto the winner's document rather than replaying a stale
    // one. It must be pure: it is called more than once.
    merge
  }: {
    columns?: BriefColumns;
    merge: (current: StructuredBriefDocument) => StructuredBriefDocument;
  }
): Promise<{ id: string }> {
  for (let attempt = 0; attempt < BRIEF_WRITE_ATTEMPTS; attempt += 1) {
    const { data: row, error: readError } = await supabase
      .from("design_briefs")
      .select("id, structured_json, updated_at")
      .eq("room_id", roomId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (readError) {
      throw new Error(readError.message);
    }

    const existing = row as { id?: string; structured_json?: unknown; updated_at?: string } | null;
    const structuredJson = merge(structuredBriefJson(existing?.structured_json));
    const payload = structuredJson as Database["public"]["Tables"]["design_briefs"]["Update"]["structured_json"];

    if (!existing?.id) {
      const { data, error } = await supabase
        .from("design_briefs")
        .insert({ ...columns, room_id: roomId, structured_json: payload })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? "The brief could not be created.");
      }
      return { id: (data as { id: string }).id };
    }

    const { data, error } = await supabase
      .from("design_briefs")
      .update({ ...columns, structured_json: payload })
      .eq("id", existing.id)
      .eq("updated_at", existing.updated_at ?? "")
      .select("id");

    if (error) {
      throw new Error(error.message);
    }
    const written = (data ?? []) as { id: string }[];
    if (written.length > 0) {
      return { id: written[0].id };
    }
  }

  // Three collisions in a row is not contention, it is something wrong. Better
  // a write that fails and says so than one that silently drops an answer.
  throw new Error("Your brief was being saved from two places at once. Try that again.");
}
