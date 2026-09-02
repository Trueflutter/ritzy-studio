import assert from "node:assert/strict";

import { parseSpecLedgerForm } from "./spec-ledger-form-data";

// The only ingress for user spec edits: the decode is pinned field by field.

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }
  return data;
}

// Happy path: splits, trims, empty-to-null, removed-row skipping.
{
  const result = parseSpecLedgerForm(
    form({
      objectCount: "3",
      "object-0-role": "sofa",
      "object-0-label": "Three-seat sofa",
      "object-0-quantity": "1",
      "object-0-sizeDescriptor": "around 240 cm",
      "object-0-capacity": "",
      "object-0-paletteMaterials": "ivory boucle, walnut legs",
      "object-1-role": "rug",
      "object-1-label": "Area rug",
      "object-1-quantity": "1",
      "object-1-remove": "on",
      "object-2-role": "lamp",
      "object-2-label": "Floor lamp",
      "object-2-quantity": "2",
      "object-2-sizeDescriptor": "L",
      "object-2-paletteMaterials": " brass , x, ",
      mustPreserve: "sliding doors\n\n  marble floor  \nz"
    })
  );
  assert.ok(result.ok);
  assert.equal(result.ok && result.objects.length, 2, "removed row must be skipped");
  const [sofa, lamp] = result.ok ? result.objects : [];
  assert.deepEqual(sofa.paletteMaterials, ["ivory boucle", "walnut legs"]);
  assert.equal(sofa.capacity, null, "empty optional coerces to null");
  assert.equal(lamp.sizeDescriptor, null, "sub-2-char optional coerces to null");
  assert.deepEqual(lamp.paletteMaterials, ["brass"], "sub-2-char palette entries dropped");
  assert.deepEqual(result.ok && result.mustPreserve, ["sliding doors", "marble floor"]);
}

// Row failures name the row/field instead of a generic message.
{
  const missingLabel = parseSpecLedgerForm(
    form({ objectCount: "1", "object-0-role": "sofa", "object-0-label": " ", "object-0-quantity": "1" })
  );
  assert.ok(!missingLabel.ok && /Piece 1 needs a name/.test(missingLabel.message));

  const badQuantity = parseSpecLedgerForm(
    form({ objectCount: "1", "object-0-role": "sofa", "object-0-label": "Sofa", "object-0-quantity": "30" })
  );
  assert.ok(!badQuantity.ok && /"Sofa" needs a quantity between 1 and 24/.test(badQuantity.message));
}

// objectCount is clamped: a crafted huge count cannot spin the loop.
{
  const crafted = form({ objectCount: "1000000000", "object-0-role": "sofa", "object-0-label": "Sofa", "object-0-quantity": "1" });
  const result = parseSpecLedgerForm(crafted);
  assert.ok(result.ok);
  assert.equal(result.ok && result.objects.length, 1);
}

// Removing every row is refused (a spec must commit to something).
{
  const result = parseSpecLedgerForm(
    form({ objectCount: "1", "object-0-role": "sofa", "object-0-label": "Sofa", "object-0-quantity": "1", "object-0-remove": "on" })
  );
  assert.ok(!result.ok && /at least one piece/.test(result.message));
}

// Over-limit free lists are capped and truncated, never fatal.
{
  const result = parseSpecLedgerForm(
    form({
      objectCount: "1",
      "object-0-role": "sofa",
      "object-0-label": "Sofa",
      "object-0-quantity": "1",
      "object-0-paletteMaterials": Array.from({ length: 12 }, (_, i) => `material ${i}`).join(","),
      mustPreserve: Array.from({ length: 20 }, (_, i) => `preserve item ${i}`).join("\n") + "\n" + "x".repeat(400)
    })
  );
  assert.ok(result.ok);
  assert.equal(result.ok && result.objects[0].paletteMaterials.length, 8);
  assert.equal(result.ok && result.mustPreserve.length, 16);
  assert.ok(result.ok && result.mustPreserve.every((entry) => entry.length <= 200));
}

console.log("spec-ledger-form-data tests passed");
