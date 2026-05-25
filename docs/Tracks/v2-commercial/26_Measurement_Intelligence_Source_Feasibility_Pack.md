# 26 Measurement Intelligence Source Feasibility Pack

## Purpose

This is a docs-only placeholder for the first real Measurement Intelligence source-feasibility pack after PR #102.

The goal is to identify rights-safe, reviewable Dubai layout sources that could later become structured seed facts. This file does not approve database migrations, generated DB type changes, Supabase writes, runtime wiring, UI changes, external parsers, or publication of raw floor-plan images.

## Questions To Answer

- Which 3-5 Dubai villa/townhouse communities or developments are highest value for first seed candidates?
- What public or partner-accessible sources exist for each candidate?
- Can the team extract structured facts without storing or displaying copyrighted raw plan images?
- What aliases, unit type codes, bedroom counts, floor levels, and room labels are likely available?
- Are room-level measurements visible, approximate, missing, or only derivable from scaled plans?
- What rights status should each source receive: public reference only, structured facts only, partner licensed, rights-cleared internal, user uploaded private, or do not use?
- What confidence should any future seed rows carry before user/designer confirmation?

## Required Output For The Feasibility PR

- candidate list and selection rationale
- source surfaces and rights posture for each candidate
- proposed community/development/layout aliases
- expected structured fields and known gaps
- privacy/copyright risks and stop rules
- recommendation matrix for next action
- explicit confirmation that no DB/schema/runtime/write/parser/raw-asset stop rule was crossed

## Stop Rules

Stop and recommend deferral if the next step requires:

- storing or displaying raw copyrighted plan images without rights clearance
- private/user floor-plan assets without consent and scoped access
- Supabase migrations or generated DB type changes
- Supabase seed writes or write-capable importers
- runtime app/UI wiring
- external vendor/parser integrations
- Product Matching or Catalog-First runtime coupling
- production flags or deploys
