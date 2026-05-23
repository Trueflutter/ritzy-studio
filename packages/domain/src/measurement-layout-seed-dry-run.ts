import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type MeasurementLayoutSeedAlias,
  type MeasurementLayoutSeedDataset,
  type MeasurementLayoutSeedLayout,
  measurementLayoutSeedDatasetSchema,
  normalizedMeasurementLayoutSeedAliases
} from "./measurement-layout-seed";
import { normalizeLayoutAlias } from "./measurement-intelligence";

export type MeasurementLayoutSeedDryRunIssueSeverity = "error" | "warning";

export type MeasurementLayoutSeedDryRunIssue = {
  severity: MeasurementLayoutSeedDryRunIssueSeverity;
  code: string;
  path: string;
  message: string;
};

export type MeasurementLayoutSeedDryRunValidationResult =
  | {
      success: true;
      dataset: MeasurementLayoutSeedDataset;
      issues: MeasurementLayoutSeedDryRunIssue[];
    }
  | {
      success: false;
      issues: MeasurementLayoutSeedDryRunIssue[];
    };

export type MeasurementLayoutSeedDryRunInput = {
  current?: unknown;
  proposed: unknown;
  currentLabel?: string;
  proposedLabel?: string;
};

export type MeasurementLayoutSeedDryRunResult = {
  current: MeasurementLayoutSeedDryRunValidationResult | null;
  proposed: MeasurementLayoutSeedDryRunValidationResult;
  report: string;
};

type LayoutDiff = {
  id: string;
  status: "added" | "removed" | "changed" | "unchanged";
  aliasChanges: ChangeSet;
  roomChanges: ChangeSet;
  sourceChanges: ChangeSet;
};

type ChangeSet = {
  added: string[];
  removed: string[];
  changed: string[];
};

const EMPTY_CHANGE_SET: ChangeSet = {
  added: [],
  removed: [],
  changed: []
};

export function validateMeasurementLayoutSeedDryRunDataset(value: unknown): MeasurementLayoutSeedDryRunValidationResult {
  const parsed = measurementLayoutSeedDatasetSchema.safeParse(value);
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        severity: "error",
        code: "schema_invalid",
        path: formatIssuePath(issue.path),
        message: issue.message
      }))
    };
  }

  const issues = validateDryRunSemantics(parsed.data);
  if (issues.some((issue) => issue.severity === "error")) {
    return {
      success: false,
      issues
    };
  }

  return {
    success: true,
    dataset: parsed.data,
    issues
  };
}

export function createMeasurementLayoutSeedDryRun(input: MeasurementLayoutSeedDryRunInput): MeasurementLayoutSeedDryRunResult {
  const current = input.current === undefined ? null : validateMeasurementLayoutSeedDryRunDataset(input.current);
  const proposed = validateMeasurementLayoutSeedDryRunDataset(input.proposed);
  const currentLabel = input.currentLabel ?? (input.current === undefined ? "empty baseline" : "current");
  const proposedLabel = input.proposedLabel ?? "proposed";

  if ((current && !current.success) || !proposed.success) {
    return {
      current,
      proposed,
      report: renderValidationFailureReport(current, proposed, currentLabel, proposedLabel)
    };
  }

  const currentDataset = current?.dataset ?? emptyMeasurementLayoutSeedDataset();
  const layoutDiffs = diffLayouts(currentDataset, proposed.dataset);

  return {
    current,
    proposed,
    report: renderDryRunReport({
      currentLabel,
      proposedLabel,
      currentDataset,
      proposedDataset: proposed.dataset,
      currentWarnings: current?.issues ?? [],
      proposedWarnings: proposed.issues,
      layoutDiffs
    })
  };
}

export function formatMeasurementLayoutSeedDryRunIssues(issues: MeasurementLayoutSeedDryRunIssue[]) {
  return [...issues]
    .sort(compareIssues)
    .map((issue) => `- ${issue.severity.toUpperCase()} ${issue.code} at ${issue.path}: ${issue.message}`)
    .join("\n");
}

function validateDryRunSemantics(dataset: MeasurementLayoutSeedDataset) {
  const issues: MeasurementLayoutSeedDryRunIssue[] = [];

  for (const [layoutIndex, layout] of dataset.layouts.entries()) {
    issues.push(...duplicateExplicitAliasIssues(layout, layoutIndex));
    issues.push(...duplicateRoomIssues(layout, layoutIndex));
  }

  return issues.sort(compareIssues);
}

function duplicateExplicitAliasIssues(layout: MeasurementLayoutSeedLayout, layoutIndex: number) {
  const issues: MeasurementLayoutSeedDryRunIssue[] = [];
  const aliases = collectExplicitAliases(layout, layoutIndex);
  const seen = new Map<string, string>();

  for (const alias of aliases) {
    const firstPath = seen.get(alias.normalized);
    if (firstPath) {
      issues.push({
        severity: "error",
        code: "duplicate_alias",
        path: alias.path,
        message: `Duplicate normalized alias "${alias.normalized}" also appears at ${firstPath}.`
      });
      continue;
    }

    seen.set(alias.normalized, alias.path);
  }

  for (const alias of aliases) {
    if (alias.normalized.length === 0) {
      issues.push({
        severity: "error",
        code: "empty_normalized_alias",
        path: alias.path,
        message: "Alias must contain searchable characters after normalization."
      });
    }
  }

  const unitTypeCode = layout.unitTypeCode?.trim();
  if (unitTypeCode !== null && unitTypeCode !== undefined && unitTypeCode.length === 0) {
    issues.push({
      severity: "error",
      code: "empty_unit_type_code",
      path: `layouts.${layoutIndex}.unitTypeCode`,
      message: "Unit type code must be null or contain searchable characters."
    });
  }

  return issues;
}

function duplicateRoomIssues(layout: MeasurementLayoutSeedLayout, layoutIndex: number) {
  const issues: MeasurementLayoutSeedDryRunIssue[] = [];
  const seenRoomIds = new Map<string, string>();
  const seenRoomLabels = new Map<string, string>();

  for (const [roomIndex, room] of layout.rooms.entries()) {
    const idPath = `layouts.${layoutIndex}.rooms.${roomIndex}.id`;
    const firstIdPath = seenRoomIds.get(room.id);
    if (firstIdPath) {
      issues.push({
        severity: "error",
        code: "duplicate_room_id",
        path: idPath,
        message: `Duplicate room id "${room.id}" also appears at ${firstIdPath}.`
      });
    } else {
      seenRoomIds.set(room.id, idPath);
    }

    const roomLabelKey = `${room.floorLevel}:${room.normalizedRoomType}:${room.name.trim().toLowerCase()}`;
    const labelPath = `layouts.${layoutIndex}.rooms.${roomIndex}.name`;
    const firstLabelPath = seenRoomLabels.get(roomLabelKey);
    if (firstLabelPath) {
      issues.push({
        severity: "error",
        code: "duplicate_room_label",
        path: labelPath,
        message: `Duplicate room label "${room.name}" on ${room.floorLevel} floor also appears at ${firstLabelPath}.`
      });
    } else {
      seenRoomLabels.set(roomLabelKey, labelPath);
    }
  }

  return issues;
}

function diffLayouts(currentDataset: MeasurementLayoutSeedDataset, proposedDataset: MeasurementLayoutSeedDataset) {
  const currentLayouts = mapById(currentDataset.layouts);
  const proposedLayouts = mapById(proposedDataset.layouts);
  const layoutIds = sortedUnique([...currentLayouts.keys(), ...proposedLayouts.keys()]);
  const diffs: LayoutDiff[] = [];

  for (const id of layoutIds) {
    const current = currentLayouts.get(id);
    const proposed = proposedLayouts.get(id);

    if (!current && proposed) {
      diffs.push({
        id,
        status: "added",
        aliasChanges: diffKeyedSets([], layoutAliasKeys(proposed)),
        roomChanges: diffKeyedRecords([], layoutRoomRecords(proposed)),
        sourceChanges: diffKeyedRecords([], layoutSourceRecords(proposed))
      });
      continue;
    }

    if (current && !proposed) {
      diffs.push({
        id,
        status: "removed",
        aliasChanges: diffKeyedSets(layoutAliasKeys(current), []),
        roomChanges: diffKeyedRecords(layoutRoomRecords(current), []),
        sourceChanges: diffKeyedRecords(layoutSourceRecords(current), [])
      });
      continue;
    }

    if (current && proposed) {
      const aliasChanges = diffKeyedSets(layoutAliasKeys(current), layoutAliasKeys(proposed));
      const roomChanges = diffKeyedRecords(layoutRoomRecords(current), layoutRoomRecords(proposed));
      const sourceChanges = diffKeyedRecords(layoutSourceRecords(current), layoutSourceRecords(proposed));
      const status =
        stableStringify(current) === stableStringify(proposed) ? "unchanged" : ("changed" as const);

      diffs.push({
        id,
        status,
        aliasChanges,
        roomChanges,
        sourceChanges
      });
    }
  }

  return diffs;
}

function renderDryRunReport(input: {
  currentLabel: string;
  proposedLabel: string;
  currentDataset: MeasurementLayoutSeedDataset;
  proposedDataset: MeasurementLayoutSeedDataset;
  currentWarnings: MeasurementLayoutSeedDryRunIssue[];
  proposedWarnings: MeasurementLayoutSeedDryRunIssue[];
  layoutDiffs: LayoutDiff[];
}) {
  const layoutCounts = countStatuses(input.layoutDiffs);
  const aliasCounts = countChangeSets(input.layoutDiffs.map((diff) => diff.aliasChanges));
  const roomCounts = countChangeSets(input.layoutDiffs.map((diff) => diff.roomChanges));
  const sourceCounts = countChangeSets(input.layoutDiffs.map((diff) => diff.sourceChanges));
  const lines = [
    "Measurement Layout Seed Dry Run",
    `Current: ${input.currentLabel} (${input.currentDataset.layouts.length} layouts)`,
    `Proposed: ${input.proposedLabel} (${input.proposedDataset.layouts.length} layouts)`,
    "",
    "Validation:",
    validationSummaryLine("current", input.currentWarnings),
    validationSummaryLine("proposed", input.proposedWarnings),
    "",
    "Summary:",
    `- Layouts: +${layoutCounts.added} -${layoutCounts.removed} ~${layoutCounts.changed} =${layoutCounts.unchanged}`,
    `- Aliases: +${aliasCounts.added} -${aliasCounts.removed}`,
    `- Rooms: +${roomCounts.added} -${roomCounts.removed} ~${roomCounts.changed}`,
    `- Sources: +${sourceCounts.added} -${sourceCounts.removed} ~${sourceCounts.changed}`,
    "",
    "Layout changes:"
  ];

  for (const diff of input.layoutDiffs.filter((layoutDiff) => layoutDiff.status !== "unchanged")) {
    lines.push(`- ${diff.status.toUpperCase()} ${diff.id}`);
    pushChangeSetLines(lines, "aliases", diff.aliasChanges);
    pushChangeSetLines(lines, "rooms", diff.roomChanges);
    pushChangeSetLines(lines, "sources", diff.sourceChanges);
  }

  if (lines[lines.length - 1] === "Layout changes:") {
    lines.push("- none");
  }

  return lines.join("\n");
}

function renderValidationFailureReport(
  current: MeasurementLayoutSeedDryRunValidationResult | null,
  proposed: MeasurementLayoutSeedDryRunValidationResult,
  currentLabel: string,
  proposedLabel: string
) {
  const lines = [
    "Measurement Layout Seed Dry Run",
    `Current: ${currentLabel}`,
    `Proposed: ${proposedLabel}`,
    "",
    "Validation:",
    validationSummaryLine("current", current?.issues ?? []),
    validationSummaryLine("proposed", proposed.issues),
    ""
  ];

  if (current && !current.success) {
    lines.push("Current issues:", formatMeasurementLayoutSeedDryRunIssues(current.issues), "");
  }

  if (!proposed.success) {
    lines.push("Proposed issues:", formatMeasurementLayoutSeedDryRunIssues(proposed.issues), "");
  }

  lines.push("Summary:", "- Dry run stopped because validation failed.");
  return lines.join("\n").trimEnd();
}

function validationSummaryLine(label: string, issues: MeasurementLayoutSeedDryRunIssue[]) {
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  return `- ${label}: ${errors === 0 ? "ok" : "failed"} (${errors} errors, ${warnings} warnings)`;
}

function pushChangeSetLines(lines: string[], label: string, changeSet: ChangeSet) {
  const parts = [
    ...changeSet.added.map((value) => `+${value}`),
    ...changeSet.removed.map((value) => `-${value}`),
    ...changeSet.changed.map((value) => `~${value}`)
  ];

  if (parts.length > 0) {
    lines.push(`  ${label}: ${parts.join(", ")}`);
  }
}

function countStatuses(layoutDiffs: LayoutDiff[]) {
  return {
    added: layoutDiffs.filter((diff) => diff.status === "added").length,
    removed: layoutDiffs.filter((diff) => diff.status === "removed").length,
    changed: layoutDiffs.filter((diff) => diff.status === "changed").length,
    unchanged: layoutDiffs.filter((diff) => diff.status === "unchanged").length
  };
}

function countChangeSets(changeSets: ChangeSet[]) {
  return changeSets.reduce(
    (counts, changeSet) => ({
      added: counts.added + changeSet.added.length,
      removed: counts.removed + changeSet.removed.length,
      changed: counts.changed + changeSet.changed.length
    }),
    { added: 0, removed: 0, changed: 0 }
  );
}

function diffKeyedSets(current: string[], proposed: string[]): ChangeSet {
  const currentSet = new Set(current);
  const proposedSet = new Set(proposed);

  return {
    added: proposed.filter((value) => !currentSet.has(value)),
    removed: current.filter((value) => !proposedSet.has(value)),
    changed: []
  };
}

function diffKeyedRecords(
  current: Array<{ key: string; signature: string }>,
  proposed: Array<{ key: string; signature: string }>
): ChangeSet {
  const currentMap = mapByKey(current);
  const proposedMap = mapByKey(proposed);
  const keys = sortedUnique([...currentMap.keys(), ...proposedMap.keys()]);
  const changes: ChangeSet = {
    added: [],
    removed: [],
    changed: []
  };

  for (const key of keys) {
    const currentRecord = currentMap.get(key);
    const proposedRecord = proposedMap.get(key);
    if (!currentRecord && proposedRecord) {
      changes.added.push(key);
    } else if (currentRecord && !proposedRecord) {
      changes.removed.push(key);
    } else if (currentRecord && proposedRecord && currentRecord.signature !== proposedRecord.signature) {
      changes.changed.push(key);
    }
  }

  return changes;
}

function layoutAliasKeys(layout: MeasurementLayoutSeedLayout) {
  return sortedUnique(normalizedMeasurementLayoutSeedAliases(layout).map((alias) => alias.normalized));
}

function layoutRoomRecords(layout: MeasurementLayoutSeedLayout) {
  return layout.rooms
    .map((room) => ({
      key: room.id,
      signature: stableStringify(room)
    }))
    .sort(compareByKey);
}

function layoutSourceRecords(layout: MeasurementLayoutSeedLayout) {
  return layout.sources
    .map((source) => ({
      key: source.id,
      signature: stableStringify(source)
    }))
    .sort(compareByKey);
}

function collectExplicitAliases(layout: MeasurementLayoutSeedLayout, layoutIndex: number) {
  const aliases: Array<MeasurementLayoutSeedAlias & { path: string; normalized: string }> = [];
  collectAliasesInto(aliases, layout.community.aliases, `layouts.${layoutIndex}.community.aliases`);
  collectAliasesInto(aliases, layout.development.aliases, `layouts.${layoutIndex}.development.aliases`);
  collectAliasesInto(aliases, layout.aliases, `layouts.${layoutIndex}.aliases`);
  return aliases;
}

function collectAliasesInto(
  target: Array<MeasurementLayoutSeedAlias & { path: string; normalized: string }>,
  aliases: MeasurementLayoutSeedAlias[],
  pathPrefix: string
) {
  for (const [index, alias] of aliases.entries()) {
    target.push({
      ...alias,
      path: `${pathPrefix}.${index}.value`,
      normalized: normalizeLayoutAlias(alias.value)
    });
  }
}

function emptyMeasurementLayoutSeedDataset(): MeasurementLayoutSeedDataset {
  return {
    version: 1,
    description: "Empty dry-run baseline.",
    layouts: []
  };
}

function mapById<T extends { id: string }>(values: T[]) {
  return new Map(values.map((value) => [value.id, value] as const));
}

function mapByKey<T extends { key: string }>(values: T[]) {
  return new Map(values.map((value) => [value.key, value] as const));
}

function sortedUnique(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function compareByKey(left: { key: string }, right: { key: string }) {
  return left.key.localeCompare(right.key);
}

function compareIssues(left: MeasurementLayoutSeedDryRunIssue, right: MeasurementLayoutSeedDryRunIssue) {
  return (
    left.path.localeCompare(right.path) ||
    left.code.localeCompare(right.code) ||
    left.message.localeCompare(right.message)
  );
}

function formatIssuePath(path: PropertyKey[]) {
  return path.length === 0 ? "(root)" : path.map((part) => String(part)).join(".");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function readJsonFile(path: string) {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;
}

function parseCliArgs(argv: string[]) {
  const args = new Map<string, string>();
  const normalizedArgv = argv.filter((arg) => arg !== "--");
  for (let index = 0; index < normalizedArgv.length; index += 2) {
    const key = normalizedArgv[index];
    const value = normalizedArgv[index + 1];
    if (!key?.startsWith("--") || !value) {
      throw new Error("Usage: measurement:seed:dry-run --proposed path/to/proposed.json [--current path/to/current.json]");
    }
    args.set(key, value);
  }

  const proposed = args.get("--proposed");
  if (!proposed) {
    throw new Error("Missing required --proposed path.");
  }

  return {
    current: args.get("--current"),
    proposed
  };
}

async function main() {
  try {
    const args = parseCliArgs(process.argv.slice(2));
    const dryRun = createMeasurementLayoutSeedDryRun({
      current: args.current ? readJsonFile(args.current) : undefined,
      proposed: readJsonFile(args.proposed),
      currentLabel: args.current ?? "empty baseline",
      proposedLabel: args.proposed
    });

    console.log(dryRun.report);
    if (!dryRun.proposed.success || (dryRun.current && !dryRun.current.success)) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  void main();
}
