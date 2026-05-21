# Ritzy Room Blueprint Governance

## Purpose

Ritzy should behave like an opinionated interior designer, not a generic image generator or a room configurator. The system should assume a complete, elegant residential baseline for each room type, then ask the user only for meaningful exceptions.

## UX Governance

- One decision per screen.
- Do not squeeze dense checklists, settings clusters, or many opt-out controls into existing brief/style/concept screens.
- If users must remove default room elements, create a dedicated calm step for that decision.
- Prefer negative exceptions over configuration: "What should we avoid?" is better than "Select everything you want."
- Default to expert assumptions. The user should not have to assemble a complete room manually.
- Do not make the room feel like software settings. The flow should feel like briefing a designer.

## Blueprint Defaults

### Living Room

Default assumption: Dubai living rooms normally include a TV/media layer unless explicitly excluded.

Required by default:
- Sofa or sectional
- Secondary seating
- Coffee table
- Generous rug
- Side tables
- TV/media focal wall
- Media console or built-in media unit
- Layered lighting: floor lamp, table lamp, sconces, picture light, ceiling lighting, or concealed lighting
- Wall art, mirror, or wall treatment
- Cushions, throws, greenery, and edited decor

Opt-out examples:
- No TV
- Keep existing TV wall
- Formal TV-free salon
- No rug
- No plants
- No gold
- No leather

### Dining Room

Required by default:
- Dining table
- Dining chairs with correct quantity
- Pendant or chandelier centered over the table
- Sideboard, credenza, or console where space allows
- Wall art, mirror, or wall treatment
- Restrained table styling
- Warm secondary lighting

Conditional:
- Rug only when chair pull-out clearance and scale remain believable

### Bedroom

Required by default:
- Bed or bed frame
- Considered headboard or bed wall
- Bedside tables where space allows
- Bedside lamps or sconces
- Properly scaled rug
- Curtains or window softness
- Layered bedding
- Wall art or mirror
- Dresser, bench, chair, or storage piece when space supports it

### Home Office

Required by default:
- Desk
- Ergonomic task chair
- Storage, shelving, or credenza
- Task lighting
- Rug or textile layer where appropriate
- Wall art, pinboard, shelves, or styled background
- Cable-conscious, camera-conscious layout

## Implementation Sequence

1. Concept prompts: use blueprint defaults to improve generated room completeness.
2. Sourcing: translate blueprint defaults into product roles and expose catalog gaps.
3. UX: replace repetitive clarifying questions with project-level preferences and room-specific exception steps.

## Non-Goals

- Do not add dense opt-out checklists to existing screens.
- Do not force every blueprint item when the user explicitly rejects it.
- Do not let image-only styling imply purchasable product coverage where catalog sourcing cannot support it.
