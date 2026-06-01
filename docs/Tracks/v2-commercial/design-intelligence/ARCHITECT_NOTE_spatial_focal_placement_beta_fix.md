# ARCHITECT_NOTE

PR Review Agent: please perform a strict review of the spatial focal-placement beta fix.

This PR is a beta-safe prompt/blueprint patch only. It narrows the living-room language around Sam's observed sofa-under-TV failure by requiring the primary sofa to sit on a different wall or zone from the TV/media wall or declared focal point and face it across the rug/coffee-table zone.

Review scope:

- Confirm the change is living-room-only.
- Confirm the PR does not implement structured focal-point capture, full spatial QA, vision QA, schema/generated type changes, UI flow changes, Product Matching changes, catalog changes, provider/runtime image-generation code changes, production/deploy settings, or live actions.
- Confirm the final grounded render prompt path includes the new placement constraints.
- Confirm the docs note accurately frames this as a placement-language patch, not a complete spatial solver.
