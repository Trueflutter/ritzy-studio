# Product Matching QA Warning Reporting Improvement

Runtime impact: none. This is a QA-harness-only warning report improvement.

## Scope

This PR implements the `APPROVED_QA_HARNESS_ONLY_WARNING_REPORT_IMPROVEMENT` handoff after PR #148.

The change preserves Product Matching selection behavior, scoring, QA stop rules, runtime defaults, preview configuration, app actions, write boundaries, and allowlists. It only adds a deterministic report helper over existing role-confidence metadata.

## Before

The QA stop-rule summary already exposed blockers, warnings, and aggregate stop-rule counts, but reviewers still had to manually infer several warning classes from individual messages and role metadata:

- dimension warnings were visible, but not grouped into missing structured dimensions, title-derived dimension text, missing room measurements, fit checked, and oversized dimensions;
- catalog evidence warnings listed missing evidence in message text, but not as deterministic field counts;
- product/role grouping was implicit in flat blocker and warning arrays;
- PR #142-shaped warning review required manual counting across the committed evidence note.

## After

`buildProductMatchQaWarningReport` now derives a QA-only report from the existing role confidence and required-role descriptors:

- issue counts by severity, issue code, role, and selected product;
- role reports with role priority, selected product id, status, confidence tier, candidate count, issue codes, dimension group, missing evidence fields, and freshness status;
- dimension groups: `missing_structured_dimensions`, `title_derived_dimensions_present`, `missing_room_measurements`, `fit_checked`, `oversized_dimensions`, and `not_applicable`;
- catalog evidence field groups: `canonical_url`, `image`, `price`, `availability`, `color`, `material`, `style_room`, and `dimension`;
- freshness status counts: `fresh`, `stale`, `missing`, `invalid`, and `not_checked`.

## Fixture Coverage

The focused test adds a static PR #142-shaped fixture with:

- required living anchor seating with missing structured dimensions and partial evidence;
- required living rug with title-derived dimension text and weak evidence;
- required dining chairs with missing room measurements and weak evidence;
- a missing supporting decor role.

The fixture verifies deterministic grouping without invoking app actions, preview execution, live catalog data, or local QA credentials.

## Verification

- `pnpm --filter @ritzy-studio/domain exec tsx src/product-matching-confidence.test.ts`
- `pnpm --filter @ritzy-studio/domain typecheck`

## Stop Rules

No stop rule was crossed. This PR does not run or configure preview, invoke app actions, expand allowlists, create/refresh draft shopping-list or catalog rows, change runtime/env defaults, DB/schema/generated types, UI, prompts, payment/checkout, production flags, deploys, live catalog writes, default-on activation, production rollout, selection/scoring behavior, or Catalog-First runtime coupling.
