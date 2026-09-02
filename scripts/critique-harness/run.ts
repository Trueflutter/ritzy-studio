// Critique harness v1 (S2 step 10): judges pipeline outputs against
// scripts/critique-harness/checklist.md for the rooms in rooms/manifest.json.
//
// Dependency-free by design (plain fetch against OpenAI and Supabase REST), so
// it runs from the repo root with npx tsx and no workspace resolution:
//
//   npx tsx scripts/critique-harness/run.ts                 # all manifest rooms
//   npx tsx scripts/critique-harness/run.ts --room <uuid>   # one room by id
//   npx tsx scripts/critique-harness/run.ts --model gpt-5.1 # production model
//   npx tsx scripts/critique-harness/run.ts --out results.json
//
// Env: reads OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// from the environment, falling back to ./.env.local at the repo root. Dev model
// default is gpt-5-mini; gate evidence runs with --model on the production model.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

type ManifestRoom = {
  key: string;
  roomId: string | null;
  label: string;
  register: string;
  expectations: string;
};

type CheckVerdict = {
  check: string;
  verdict: "pass" | "fail" | "not_applicable";
  notes: string;
};

const CHECKS = [
  "spatial_plausibility",
  "brief_adherence",
  "revision_delta",
  "size_correctness",
  "view_coverage",
  "palette_register"
] as const;

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !(match[1] in process.env)) {
        process.env[match[1]] = match[2].replace(/^"|"$/g, "");
      }
    }
  }
  const required = ["OPENAI_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing ${key} (set it or provide .env.local at the repo root).`);
      process.exit(1);
    }
  }
}

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

async function supabaseGet(pathAndQuery: string): Promise<unknown[]> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  if (!response.ok) {
    throw new Error(`Supabase GET ${pathAndQuery} failed: HTTP ${response.status}`);
  }
  return (await response.json()) as unknown[];
}

async function storageDataUrl(bucket: string, storagePath: string): Promise<string | null> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${storagePath}`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );
  if (!response.ok) {
    return null;
  }
  const contentType = response.headers.get("content-type") ?? "image/png";
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

const HARNESS_SYSTEM = [
  "You are Ritzy Studio's critique harness, judging interior design pipeline outputs.",
  "Judge each requested check strictly against the definitions given in the user message.",
  "Return one verdict per requested check: pass, fail, or not_applicable, with one or two sentences of notes naming concrete evidence in the images.",
  "Architecture drift (walls, windows, doors, openings changed vs the source) is always a failure where the check covers it.",
  "The palette_register check is not anti-beige: a warm-neutral brief with a deliberate warm-neutral register passes; a cool, dark, saturated, or bold brief answered with generic beige-brown fails."
].join("\n");

async function judgeRoom({
  model,
  room,
  brief,
  measurements,
  conceptImage,
  previousImage,
  viewImages,
  spec
}: {
  model: string;
  room: ManifestRoom;
  brief: Record<string, unknown> | null;
  measurements: Record<string, unknown> | null;
  conceptImage: string;
  previousImage: string | null;
  viewImages: string[];
  spec: Record<string, unknown> | null;
}): Promise<CheckVerdict[]> {
  const checklist = readFileSync(path.join(process.cwd(), "scripts/critique-harness/checklist.md"), "utf8");
  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: JSON.stringify({
        room: { label: room.label, register: room.register, expectations: room.expectations },
        brief,
        measurements,
        spec,
        checksRequested: CHECKS,
        checklistDefinitions: checklist
      })
    },
    { type: "input_text", text: "Image 1: the current concept (hero)." },
    { type: "input_image", image_url: conceptImage, detail: "high" }
  ];
  if (previousImage) {
    content.push(
      { type: "input_text", text: "Image 2: the PREVIOUS concept this one revised. Judge revision_delta against it." },
      { type: "input_image", image_url: previousImage, detail: "high" }
    );
  }
  viewImages.forEach((view, index) => {
    content.push(
      { type: "input_text", text: `Additional view ${index + 1} of the same concept. Judge view_coverage across all views.` },
      { type: "input_image", image_url: view, detail: "low" }
    );
  });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_output_tokens: 6000,
      input: [
        { role: "system", content: HARNESS_SYSTEM },
        { role: "user", content }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "critique_harness_verdicts",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              verdicts: {
                type: "array",
                minItems: CHECKS.length,
                maxItems: CHECKS.length,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    check: { type: "string", enum: [...CHECKS] },
                    verdict: { type: "string", enum: ["pass", "fail", "not_applicable"] },
                    notes: { type: "string", minLength: 4, maxLength: 500 }
                  },
                  required: ["check", "verdict", "notes"]
                }
              }
            },
            required: ["verdicts"]
          }
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI harness call failed: HTTP ${response.status} ${await response.text()}`);
  }
  const payload = (await response.json()) as {
    output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>;
  };
  const text = payload.output
    ?.flatMap((item) => item.content ?? [])
    .find((part) => part.type === "output_text")?.text;
  if (!text) {
    throw new Error("OpenAI harness call returned no output text.");
  }
  return (JSON.parse(text) as { verdicts: CheckVerdict[] }).verdicts;
}

async function runRoom(model: string, room: ManifestRoom) {
  if (!room.roomId) {
    return { room: room.key, status: "SKIPPED (no roomId in manifest — pending creation)" as const };
  }

  const concepts = (await supabaseGet(
    `concepts?room_id=eq.${room.roomId}&order=created_at.desc&select=*`
  )) as Array<Record<string, unknown>>;
  const hero =
    concepts.find((concept) => concept.status === "selected") ??
    concepts.find((concept) => concept.status === "generated");
  if (!hero) {
    return { room: room.key, status: "SKIPPED (no concept generated yet)" as const };
  }

  const assetRows = (await supabaseGet(
    `room_assets?id=eq.${hero.primary_image_asset_id}&select=storage_path`
  )) as Array<{ storage_path: string }>;
  const conceptImage = assetRows[0]
    ? await storageDataUrl("generated-renders", assetRows[0].storage_path)
    : null;
  if (!conceptImage) {
    return { room: room.key, status: "SKIPPED (hero image unavailable)" as const };
  }

  let previousImage: string | null = null;
  if (hero.parent_concept_id) {
    const parent = concepts.find((concept) => concept.id === hero.parent_concept_id);
    if (parent?.primary_image_asset_id) {
      const parentAsset = (await supabaseGet(
        `room_assets?id=eq.${parent.primary_image_asset_id}&select=storage_path`
      )) as Array<{ storage_path: string }>;
      previousImage = parentAsset[0]
        ? await storageDataUrl("generated-renders", parentAsset[0].storage_path)
        : null;
    }
  }

  const viewAssets = (await supabaseGet(
    `room_assets?concept_id=eq.${hero.id}&asset_type=eq.concept_render&is_primary=eq.false&select=storage_path`
  )) as Array<{ storage_path: string }>;
  const viewImages = (
    await Promise.all(viewAssets.map((asset) => storageDataUrl("generated-renders", asset.storage_path)))
  ).filter((url): url is string => Boolean(url));

  const briefs = (await supabaseGet(
    `design_briefs?room_id=eq.${room.roomId}&order=updated_at.desc&limit=1&select=style_notes,color_notes,budget_notes,functional_requirements,avoid_notes,inspiration_notes`
  )) as Array<Record<string, unknown>>;
  const measurementsRows = (await supabaseGet(
    `room_measurements?room_id=eq.${room.roomId}&order=created_at.desc&limit=1&select=wall_length_cm,room_depth_cm,ceiling_height_cm`
  )) as Array<Record<string, unknown>>;
  const specs = (await supabaseGet(
    `room_design_specs?room_id=eq.${room.roomId}&concept_id=eq.${hero.id}&select=objects,must_preserve,status`
  )) as Array<Record<string, unknown>>;

  const verdicts = await judgeRoom({
    model,
    room,
    brief: briefs[0] ?? null,
    measurements: measurementsRows[0] ?? null,
    conceptImage,
    previousImage,
    viewImages,
    spec: specs[0] ?? null
  });

  return { room: room.key, status: "JUDGED" as const, conceptId: hero.id, verdicts };
}

async function main() {
  loadEnv();
  const model = arg("model") ?? "gpt-5-mini";
  const onlyRoomId = arg("room");
  const outPath = arg("out");

  const manifest = JSON.parse(
    readFileSync(path.join(process.cwd(), "scripts/critique-harness/rooms/manifest.json"), "utf8")
  ) as { rooms: ManifestRoom[] };

  const rooms = onlyRoomId
    ? [
        manifest.rooms.find((room) => room.roomId === onlyRoomId) ?? {
          key: `adhoc-${onlyRoomId.slice(0, 8)}`,
          roomId: onlyRoomId,
          label: `Ad-hoc room ${onlyRoomId}`,
          register: "per brief",
          expectations: "Judge against the stored brief."
        }
      ]
    : manifest.rooms;

  const results = [];
  for (const room of rooms) {
    process.stdout.write(`\n== ${room.key}: ${room.label}\n`);
    try {
      const result = await runRoom(model, room);
      results.push(result);
      if (result.status !== "JUDGED") {
        console.log(`   ${result.status}`);
        continue;
      }
      for (const verdict of result.verdicts ?? []) {
        console.log(`   ${verdict.verdict.toUpperCase().padEnd(14)} ${verdict.check}: ${verdict.notes}`);
      }
    } catch (error) {
      results.push({ room: room.key, status: `ERROR: ${error instanceof Error ? error.message : String(error)}` });
      console.log(`   ERROR: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const judged = results.filter((result) => result.status === "JUDGED");
  const skipped = results.length - judged.length;
  console.log(`\nHarness complete: ${judged.length} judged, ${skipped} skipped or errored (model ${model}).`);
  if (skipped > 0) {
    console.log("Skipped rooms are reported above, never silently dropped.");
  }

  if (outPath) {
    writeFileSync(outPath, JSON.stringify({ model, generatedAt: new Date().toISOString(), results }, null, 2));
    console.log(`Results written to ${outPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
