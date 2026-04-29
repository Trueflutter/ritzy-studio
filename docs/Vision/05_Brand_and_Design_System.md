# 05 · Brand & Design System

**Source of truth — Ritzy Studio.** This document is the canonical visual and interaction specification. Every Codex implementation agent must build against this file. Ambiguity is failure; deviation requires explicit human approval. Out of scope: dark mode, multi-theme support, alternative palettes.

Direction: **Quiet Gallery** (locked).
Type: **Cormorant Garamond × DM Sans** (locked).
Surface: **Bone (`#F2EDE4`) on Paper (`#FBF8F2`)** with **Ochre (`#B58E5A`)** as the single warm accent (locked).
Geometry: **square corners, 1px hairlines, no shadows above elevation 1** (locked).

---

## 1 · Design North Star

Ritzy Studio is a working tool that feels like a high-end residential design studio rendered in software. The interface is editorial-quiet: square corners, hairline rules, generous breathing room, a serif that holds the hand-drafted feel of an architect's notebook, a sans that keeps captions and prices clear. The room is the subject. The interface steps aside. AI assists — it does not perform.

**It must feel like:** turning a page in a private portfolio · reading hand-set type · using a calm, confident tool that has been considered, not assembled.

**It must not feel like:** a consumer AI toy (no purple gradients, glow orbs, sparkle icons, "magic" copy) · a SaaS dashboard (no rounded blue buttons, KPI tiles, gauge charts, card-soup) · a retail site (no carousels, badges, stars, urgency banners, "Add to Cart") · a marketing landing page (no oversized hero copy on operational screens) · a generic Figma template (no Inter, no `#FAFAFA`, no flat blue icons).

---

## 2 · Brand Attributes

Each attribute below is operational. If a screen does not visibly enforce these, it is not a Ritzy screen.

1. **Editorial.** Cormorant Garamond on every heading. Italic for accent words, never for whole sentences of body. Drop cap on the lede paragraph of any narrative section. Hairline rules between rows and columns. Section labels prefixed with `N°` and a numeric index.
2. **Quiet.** Maximum one accent colour per screen. No shadow above elevation 1 (a single 1px hairline halo, opacity ≤ 0.06). No card inside a card. No decorative gradient behind data. All transitions ≥ 220ms.
3. **Precise.** All hairlines are 1px — never 2px. All numerals (prices, dimensions, counts, totals) use `font-feature-settings: "tnum", "lnum"`. Spacing snaps to the 4px scale only — no off-grid values. No soft pastels.
4. **Architectural.** Square corners on cards, buttons, inputs, modals (`border-radius: 0`). Pill radius (`9999px`) is allowed only on chips, total labels, and focus pills. 12-column grid on desktop. Type hierarchy is structural (display / heading / body / caption); decorative tiers are forbidden.
5. **Considered.** Every label has a counterpart: every price has a currency label; every dimension has a unit; every product has a retailer; every AI render has a confidence note. Orphaned data is forbidden.
6. **Reverent of the room.** Concept and room images dominate the viewport in review screens (≥ 60% width on desktop). UI chrome dims when an image is being inspected. Text never overlays the architectural region of a room photo (top one-third minimum kept clean).
7. **Truthful.** AI uncertainty is shown as visible italic notes, never hover-only tooltips. SKU verification appears on every product line. Price-stale-as-of timestamps are required when retailer data is older than 7 days.

---

## 3 · Visual References / Archetypes

Five archetypes guide every screen. For each, the rule is what to borrow and what to refuse.

### 3.1 Luxury interior studio presentation board
- **Borrow:** hand-drafted feel, hairline rules, italic captions, sparse layouts, generous margins, the discipline of a curated spread.
- **Avoid:** photographic flourish, watercolour textures, mood-board chaos, signature handwriting fonts.

### 3.2 Architectural project management dashboard
- **Borrow:** dense data legibility, tabular numerals, monolithic grid, structural information hierarchy, reliable density when needed.
- **Avoid:** chart-junk, gauges, oversized KPI tiles, brutalist Figma aesthetics, pastel categorical colour systems.

### 3.3 Premium editorial catalogue (Architectural Digest, Cereal, Apartamento)
- **Borrow:** drop caps on intros, image-first layouts, italic emphasis, numbered sections, breathable column widths (≤ 66ch body).
- **Avoid:** masthead-style logos, photo collages, multi-column flowing text, oversized pull quotes on operational screens.

### 3.4 Calm AI creative workspace (Linear, Cron-era, restrained Notion)
- **Borrow:** keyboard-first interactions, command palette mentality, layouts that don't shift on hover, quiet status indicators.
- **Avoid:** AI-tool clichés (sparkles, gradients, glowing borders, "magic" purple, aurora backgrounds, robot icons).

### 3.5 Considered retail surface (Aesop, Hermès digital)
- **Borrow:** serif-sans pairings, hairline-only borders, monochrome with single accent, slow reveal pacing.
- **Avoid:** e-commerce conventions (carousels, "Add to Cart", star ratings, urgency banners, promotional badges).

---

## 4 · Colour System

All product UI uses tokens. Hex values below are canonical.

### 4.1 Tokens

| Token | Hex / Value | Usage | Forbidden |
|---|---|---|---|
| `--rs-page` | `#F2EDE4` | App canvas background. Body element. | Never as elevated surface (cards, modals). |
| `--rs-surface` | `#FBF8F2` | Cards, modals, drawers, toolbars, tables. | Never as page background. |
| `--rs-surface-subtle` | `#EBE3D4` | Hovered list rows, inline highlights, secondary tab fill. | Never as a primary surface; never under text. |
| `--rs-border` | `rgba(31, 31, 29, 0.08)` | Hairline dividers between rows/columns. | Never thicker than 1px. |
| `--rs-border-strong` | `rgba(31, 31, 29, 0.16)` | Inputs at rest, dividers between sections, total-row top border. | Never thicker than 1px. |
| `--rs-text` | `#1F1F1D` | Headlines, primary body, prices, table values. | Never use `#000000`. |
| `--rs-text-secondary` | `#36352F` | Descriptions, helper text, secondary body. | |
| `--rs-text-muted` | `#6F6963` | Captions, retailer names, table secondary columns, form labels. AA-compliant on bone. | Never on `--rs-surface-subtle` (insufficient contrast). |
| `--rs-text-subtle` | `#8A8175` | Decorative italic captions ≥ 18px only (e.g., right-aligned section flourishes). | Never on text below 18px — fails WCAG AA. |
| `--rs-text-disabled` | `#B5AC9C` | Disabled control labels, placeholder text. | Never for active interactive labels. |
| `--rs-primary` | `#1F1F1D` | Filled primary buttons, totals bar background, active chip background. | Never use accent ochre as a primary button. |
| `--rs-primary-hover` | `#36352F` | Primary button hover state. | |
| `--rs-secondary` | transparent + `--rs-border-strong` | Outline (secondary) buttons, segmented control rest state. | Never colour-fill a secondary button. |
| `--rs-destructive` | `#7E3326` | Destructive button border + text only. | Never as a button background fill. |
| `--rs-accent` | `#B58E5A` | Italic emphasis text colour, drop caps, link arrow, AI/concept accent, price currency label, "Concept" badge text. **Italic emphasis must be ≥ 17px** to meet AA Large (3:1). | Never as a button background. Never on more than 5% of pixel area per viewport. Never inside body sentences outside `<em>`. |
| `--rs-accent-deep` | `#8C6A3E` | Hovered accent, link hover, focused input underline, AA-compliant on bone (~5.1:1). | |
| `--rs-accent-tint` | `rgba(181, 142, 90, 0.10)` | Active chip wash, drag-over upload background, focus-ring fill. | Never under body-grade text. |
| `--rs-success` | `#4D6840` | Verified-SKU indicator, "in stock". | Never bright green. |
| `--rs-warning` | `#8C6A28` | Stale price, dimension uncertainty caption. | Must remain warm; never red-orange. |
| `--rs-error` | `#7E3326` | Out-of-stock, broken retailer link, validation error. | Never bright red. |
| `--rs-focus-ring` | `rgba(181, 142, 90, 0.40)` | 2px outline-offset focus ring, square corners. | Never `outline: none` without an alternative. |

### 4.2 Reserved pairings
- **Price duo:** numerals = `--rs-text` (Cormorant); currency label `AED` = `--rs-text-muted` (DM Sans caption uppercase). Never colour the numeral itself.
- **Total bar duo:** background `--rs-primary` + numeral `--rs-accent` (italic Cormorant). Mirrors logo's grey-on-champagne composition.

### 4.3 Gradients
- One gradient is permitted in the entire system: the empty-concept-slot placeholder, vertical fade `#E8DECB → #C9B690`. Used only on not-yet-generated concept frames and empty room placeholders.
- Decorative gradients on backgrounds, buttons, headers, or behind data are **forbidden**.

### 4.4 Pure black / pure white
- `#000000` is forbidden everywhere. Use `--rs-text` (`#1F1F1D`).
- `#FFFFFF` is forbidden everywhere. Use `--rs-surface` (`#FBF8F2`).

### 4.5 Accent budget
- Maximum **one** accent colour per screen. `--rs-accent` and `--rs-accent-tint` count as one (same family).
- `--rs-success`, `--rs-warning`, `--rs-error` may co-exist with the accent because they convey state, not decoration. Each may appear at most twice per viewport.

### 4.6 Contrast rules
- Body text: minimum **4.5:1** (WCAG AA).
- Caption / UI text: minimum **4.5:1** (treated as body for accessibility).
- Disabled text: minimum **3:1** (decorative).
- Italic accent emphasis (`--rs-accent`): minimum size **17px** to meet AA Large (3:1).

---

## 5 · Typography

### 5.1 Font families

| Role | Stack |
|---|---|
| Display | `"Cormorant Garamond", "Cormorant", "EB Garamond", "Times New Roman", serif` |
| Body / UI | `"DM Sans", "Söhne", -apple-system, "Segoe UI", "Helvetica Neue", sans-serif` |
| Mono (data tables, optional) | `"DM Mono", ui-monospace, Menlo, monospace` |

**Forbidden as primary fonts:** Inter, Roboto, Arial, Helvetica (raw), `system-ui`, `sans-serif` (raw), Open Sans, Lato, Montserrat, Poppins.

### 5.2 Scale

| Token | Size | Line | Tracking | Family / Weight | Use |
|---|---|---|---|---|---|
| `display-xl` | 84px | 0.95 | -0.020em | Cormorant 300 | Empty state hero, auth pages only. **Forbidden on operational screens.** |
| `display-l` | 56px | 1.00 | -0.015em | Cormorant 300 | Page title (project name, dashboard heading). |
| `display-m` | 44px | 1.05 | -0.015em | Cormorant 300 | Section title in narrative areas. |
| `display-s` | 32px | 1.10 | -0.010em | Cormorant 300 | Card title (concept, room, project). Modal title. List header. |
| `display-xs` | 24px | 1.10 | 0 | Cormorant 300 italic | Italic input prompts (search, brief), accent words inside a heading. |
| `body-l` | 17px | 1.70 | 0 | DM Sans 400 | Lede paragraphs, briefs. |
| `body-m` | 15px | 1.65 | 0 | DM Sans 400 | Default body, descriptions, table cells. |
| `body-s` | 13.5px | 1.55 | 0 | DM Sans 400 | Helper text, secondary body. |
| `caption` | 11px | 1.50 | 0.36em uppercase | DM Sans 500 | Section labels, retailer names, metadata, form labels. |
| `caption-tight` | 10.5px | 1.40 | 0.32em uppercase | DM Sans 500 | Pill labels, badges. |
| `button` | 12.5px | 1.00 | 0.18em uppercase | DM Sans 500 | Primary, secondary buttons. |
| `button-quiet` | 15px | 1.00 | 0 | Cormorant 400 italic | Link-style "view shopping list" buttons. |

### 5.3 Letter-spacing rules
- Display: tight (-0.02em to -0.01em).
- Body: 0.
- Caption uppercase: 0.32em – 0.42em.
- Button uppercase: 0.18em.
- Italic accent: 0 (do not track italics).

### 5.4 Weights permitted
- Cormorant: 300 (default display), 300 italic (accent), 400 (heading body, prices), 500 (table headers).
- DM Sans: 400 (body), 500 (caption, button, label), 600 (table column headers, totals labels).
- No 700+ weights anywhere.

### 5.5 Numeric / tabular rules
- Every numeric value uses `font-feature-settings: "tnum", "lnum"` (tabular lining figures). Locked.
- **Prices.** Format `AED 38,400`. `AED` is `caption` DM Sans 500 uppercase 0.32em `--rs-accent-deep`. The numeric portion is Cormorant 400 tabular at the contextual size (18px in lists, 28–32px in totals, italic in totals only).
- **Dimensions.** Format `240 × 98 cm`. DM Sans 13.5px tabular. The multiplication sign is U+00D7 (`×`), not the letter `x`, with hairspace U+200A on each side.
- **Quantities.** DM Sans 500 tabular, 14px.
- **Counts.** DM Sans 500 tabular, caption-sized; e.g., `12 pieces`.

### 5.6 Element-by-element specification

| Element | Token | Family / Weight | Notes |
|---|---|---|---|
| Page title | `display-l` | Cormorant 300 | One per page. Italic permitted on accent word only. |
| Section title | `display-m` | Cormorant 300 (italic if narrative; roman if functional) | Maximum 1 italic accent word per title. |
| Card title (concept / product / project / room) | `display-s` | Cormorant 300 | Italic permitted on accent word only. |
| Form label | `caption` | DM Sans 500 uppercase | Colour `--rs-text-muted`. Always above the input. |
| Input text — narrative (search, brief, project name) | `display-xs` | Cormorant 300 italic | Placeholder uses same style at `--rs-text-disabled`. |
| Input text — functional (filters, dimensions, numbers) | `body-m` | DM Sans 400 | Tabular if numeric. |
| Body copy | `body-m` | DM Sans 400 | Max 66ch line length. |
| Metadata | `caption` | DM Sans 500 uppercase | Colour `--rs-text-muted`. |
| Table value (text) | `body-s` | DM Sans 400 | |
| Table value (numeric) | 18px | Cormorant 400 tabular | Right-aligned. |
| Total — line items | 18px | Cormorant 400 tabular | Right-aligned. |
| Total — grand total | 32px | Cormorant 400 italic tabular | Inside total bar; colour `--rs-accent`. |
| Button label | `button` | DM Sans 500 uppercase | |
| Quiet link | `button-quiet` | Cormorant 400 italic | With ` →` arrow appended in `--rs-accent-deep`. |

### 5.7 Where large display type is permitted

- **Permitted:** auth pages, project-dashboard empty state, presentation export cover.
- **Forbidden:** operational screens (room upload, brief, concept gallery, critique, product matching, product substitution, final render review, settings).

---

## 6 · Spacing System

### 6.1 Base scale

Base unit **4px**. Allowed values are scale steps below — no off-scale spacing.

| Step | Value |
|---|---|
| 0 | 0 |
| 1 | 4px |
| 2 | 8px |
| 3 | 12px |
| 4 | 16px |
| 5 | 20px |
| 6 | 24px |
| 8 | 32px |
| 10 | 40px |
| 12 | 48px |
| 16 | 64px |
| 20 | 80px |
| 24 | 96px |
| 32 | 128px |

### 6.2 Page gutters

| Breakpoint | Gutter |
|---|---|
| Desktop wide (≥ 1440) | 64 (step 16) |
| Desktop standard (1024–1439) | 48 (step 12); 64 on hero/auth |
| Tablet (768–1023) | 32 (step 8) |
| Mobile (< 768) | 20 (step 5) |

### 6.3 Section spacing
- Narrative pages (auth, dashboard empty state, presentation): 96px above and below each section.
- Operational pages: 48px above and below.
- Inside a card body: 32px between blocks.

### 6.4 Card internal padding
- Concept card body: 36px top, 32px right/left, 32px bottom. Image inset 14px from card edge on all sides.
- Product card body: 20px all sides. Image inset 14px.
- Project card body: 24px all sides.
- Modal: 32px padding; 48px for the title row.

### 6.5 Form spacing
- Label → input: 14px (between bottom of label and top of input).
- Field block bottom margin: 28px.
- Inline field gap (e.g., date range): 16px.

### 6.6 Grid gaps
- Concept gallery (3 col): 24px gap.
- Product grid (4 col): 16px gap.
- Project grid (3 col): 24px gap.
- Shopping list rows: 0px gap, 1px hairline divider.
- Comparison view (2 col): 0px gap, 1px vertical hairline divider.
- Toolbar groups: 16px between groups, 8px between buttons within a group.

### 6.7 Sidebar / inspector padding
- Left navigation: 24px horizontal, 16px between items.
- Right inspector: 32px horizontal, 24px between sections.
- Drawer: 32px horizontal, 24px between blocks.

### 6.8 Image-to-text spacing
- Card image bottom → title: 20px.
- Inline figure → caption: 12px.
- Hero image → lede: 56px on narrative; 32px on operational.

### 6.9 Density classes
- **Dense operational** (product matching, shopping list edit, comparison): use only steps 2–8.
- **Image-heavy** (concept review, render): use steps 6–24.
- **Empty state**: use steps 12–24.
- **Mobile stacking**: vertical gap between stacked blocks equals the desktop horizontal gap (e.g., 24px → 24px).

---

## 7 · Layout System

### 7.1 Max content widths
- Operational app shell: full viewport, content max 1440px centered with current breakpoint gutters.
- Narrative content (briefs, presentation export, auth): max 1180px.
- Single-column reading content: max 720px.

### 7.2 Sidebar widths
- Left navigation: 240px (collapsed: 72px). Visible on lg+ only.
- Right inspector panel: 360px on lg, 480px on xl. Becomes drawer on md and below.

### 7.3 Grid columns

| Breakpoint | Cols | Outer | Gap |
|---|---|---|---|
| Desktop wide (≥ 1440) | 12 | 80px | 24px |
| Desktop (1024–1439) | 12 | 64px | 24px |
| Tablet (768–1023) | 8 | 32px | 16px |
| Mobile (< 768) | 4 | 20px | 16px |

### 7.4 Image aspect ratios

| Subject | Ratio | Notes |
|---|---|---|
| Room photo | 4:3 | Locked. Letterbox if user uploads a different ratio. |
| Concept render | 4:3 | Locked. Must match room ratio for before/after overlay. |
| Product image | 1:1 | Square. Square-crop from the source if needed. |
| Retailer logo | free, max 32×120px bounding box | Monochrome. |
| Hero / cover (presentation only) | 16:9 | |
| Hero illustration on empty state | 4:5 | |

### 7.5 Concept gallery layout
- Desktop: 3 columns equal width, 24px gap. Image 4:3, caption block 32px padding, 1px hairline top border between image and caption.
- Tablet: 2 columns, 16px gap.
- Mobile: 1 column, full width, 24px between cards.

### 7.6 Product card layout
- Image 1:1 top with 14px inset frame (1px hairline border around image).
- Body 20px padding: name (`body-m`), retailer (`caption`, `--rs-text-muted`), dimensions (`caption` tabular, `--rs-text-muted`), price right-aligned (Cormorant 400 18px tabular), Swap link (`button-quiet`) bottom right.
- Hover: card surface fills `--rs-surface-subtle` over 240ms.

### 7.7 Shopping list / table layout
- Roman numeral first column (28px, italic Cormorant `--rs-accent-deep`).
- Item name + retailer/dimension subline (flexible).
- Price right-aligned (Cormorant 400 18px tabular).
- Quantity stepper (DM Sans 14px tabular, 64px wide).
- 1px hairline divider between rows.
- Total row: 1px solid `--rs-text` top border, 22px row height. Below the table, a full-width total bar (`--rs-primary` background, italic Cormorant 32px `--rs-accent` numeral, `caption` lab on the left).

### 7.8 Project dashboard layout
- Top bar 80px height.
- Page title (`display-l`) flush left, 24px below the bar.
- Tabs below ("All / Active / Archived"), 32px below the title.
- Project grid: 3 col desktop, 2 col tablet, 1 col mobile. Each card 4:3 cover image, 24px body padding.

### 7.9 Upload workflow layout
- Centered single-column 720px.
- Stepper across the top (4 steps minimum visible).
- Upload zone 4:3 full column width with 1px dashed `--rs-border-strong`.
- Below: thumbnail strip of 1:1 thumbs, 16px gap, max 6 per row.

### 7.10 Critique / refinement layout
- Two-column 60/40: left 60% concept image, right 40% critique panel.
- Right panel: scrollable critique threads, hairline-divided. Designer prompts roman, AI responses italic Cormorant.
- Sticky brief input at the bottom of the right panel.

### 7.11 Final render screen
- Full-bleed image at the top (max-height 70vh).
- Floating hairline-bordered metadata strip overlaid bottom-left of the image: italic Cormorant concept name + AED total.
- Below the image: the shopping-list table.
- Right: sticky "Approve & build presentation" CTA at the viewport edge (lg+) or as a fixed bottom bar (md and below).

---

## 8 · Component Style Rules

### 8.1 Buttons

**Primary (filled).** Background `--rs-primary`, text `--rs-surface`, border 1px solid `--rs-primary`. Padding 18px 32px. Token `button`. Border-radius 0.
- Hover: background transparent, text `--rs-text`, border retained.
- Disabled: text `--rs-text-disabled`, transparent background, hairline border `--rs-border-strong`.
- One per screen (max two on dashboard).

**Secondary (outline).** Transparent background, text `--rs-text`, 1px border `--rs-text`. Padding 18px 32px.
- Hover: background `--rs-text`, text `--rs-surface`.
- Disabled: same as primary disabled.

**Accent (filled, rare).** Background `--rs-accent`, text `--rs-primary`, border 1px solid `--rs-accent`. Used only on: "Source pieces" CTA after concept approval.
- Hover: background `--rs-accent-deep`.

**Quiet (link).** No border, no background. `button-quiet` token. Cormorant 400 italic 15px. Trailing arrow `→` in `--rs-accent-deep`.
- Hover: text `--rs-accent-deep`; arrow translates +6px over 320ms.

**Destructive.** Outline only. Border + text `--rs-destructive`. Background transparent. Hover: background `--rs-destructive`, text `--rs-surface`.

**Sizing.** One height (52px). No "small" or "large" variants. Compact icon button is a separate component.

**Forbidden.** Rounded buttons (`border-radius` > 0), gradient buttons, ghost buttons with subtle backgrounds, more than 2 primary buttons per screen, lowercase button labels.

### 8.2 Icon buttons
- 40×40px, transparent, 1.5px stroke icon in `--rs-text`. Hairline border `--rs-border` on hover only.
- Forbidden: filled icon backgrounds, coloured icons, drop shadows.

### 8.3 Tabs
- Underline tab style only. Label `button` size, lowercase, 0.16em tracking. DM Sans 500.
- Active: 1px solid `--rs-text` underline, 6px below baseline.
- Inactive: text `--rs-text-muted`, no underline.
- Hover: underline scales from 0 to 1 over 320ms, transform-origin left.
- Forbidden: pill tabs, filled tabs, vertical tabs (except inside the right inspector).
- Maximum 4 tabs per strip; overflow into a "More" dropdown.

### 8.4 Segmented control
- Single hairline-bordered row, equal-width segments, current segment fills with `--rs-primary` (text `--rs-surface`); inactive segments transparent (text `--rs-text`).
- Labels `button` size uppercase 0.18em.
- Maximum 3 segments; if 4+ options exist, use a dropdown.

### 8.5 Cards

| Card type | Surface | Border | Radius | Shadow | Image inset |
|---|---|---|---|---|---|
| Concept | `--rs-surface` | 1px `--rs-border` | 0 | none | 14px |
| Product | `--rs-surface` | 1px `--rs-border` | 0 | none | 14px |
| Project | `--rs-surface` | 1px `--rs-border` | 0 | none | none (cover image flush) |
| Empty placeholder | `--rs-surface` | 1px dashed `--rs-border-strong` | 0 | none | n/a |

**Forbidden:** card-in-card. A card cannot contain another card. Use hairline-divided sections within a single card.
**Forbidden:** shadows on cards. Cards rely on hairlines, not elevation.

### 8.6 Forms / inputs
- Inputs: hairline bottom border only (`1px solid --rs-border-strong`). No box.
- Label `caption` above the input, 14px gap.
- Narrative inputs (search, brief, project name): Cormorant 300 italic 24px (`display-xs`).
- Functional inputs (filters, dimensions, numbers): DM Sans 400 15px (`body-m`).
- Focus: bottom border becomes `--rs-accent-deep`; an extra 1px `--rs-accent` line slides in beneath over 220ms.
- Error: bottom border `--rs-error`; error message below in DM Sans italic 13.5px `--rs-error`.
- Disabled: text `--rs-text-disabled`; border `--rs-border`.
- Placeholder uses input's font and `--rs-text-disabled`.
- Forbidden: filled input backgrounds, rounded input boxes, floating labels.

### 8.7 Textarea
- Same anatomy as input. Min height 96px. Auto-grow to a maximum of 320px before scrolling internally.

### 8.8 Dropdown
- Trigger: matches input style.
- Popover: `--rs-surface` background, 1px `--rs-border` border, no shadow, 4px padding, 8px between items.
- Items: 13.5px DM Sans, 12px vertical padding.
- Selected: 1px `--rs-accent` underline beneath label.
- Forbidden: native `<select>` styling.

### 8.9 Slider
- Single 1px track in `--rs-border-strong`.
- Filled portion `--rs-accent`, 1px tall.
- Thumb: 14px circle, `--rs-text` background, 1px ring `--rs-text`.
- Min/max labels `caption`.
- Used for: budget range, render strength.
- Forbidden: stepped sliders with notch dots, dual-handle range sliders (use two stacked single sliders if two values are needed).

### 8.10 Checkbox / toggle
- Checkbox: 16×16px, 1px `--rs-border-strong` border, no radius. Checked: fill `--rs-text`, checkmark icon `--rs-surface`.
- Toggle: 32×18px hairline rail. Off: thumb `--rs-surface`, 1px ring. On: rail fills `--rs-text`, thumb shifts.
- Forbidden: rounded checkboxes (i.e., `border-radius: 50%`), oversized toggles.

### 8.11 Chips / tags
- Pill (`border-radius: 9999px`) — chips are the one curved exception.
- Padding 10px 18px. Text `body-s` (13.5px) DM Sans 400.
- Inactive: 1px `--rs-border-strong`, transparent.
- Hover: border `--rs-accent-deep`, text `--rs-text`.
- Active: background `--rs-primary`, text `--rs-surface`, border `--rs-primary`.
- Italic word inside chip: optional Cormorant italic for concept-name modifier; e.g., `*quiet* levantine`.

### 8.12 Tables
- Hairline-divided rows (1px `--rs-border`). No zebra striping. No vertical column borders.
- Header row: `caption` DM Sans 500 uppercase 0.36em `--rs-text-muted`.
- Numerals tabular, right-aligned.
- Total row: 1px solid `--rs-text` top border, 22px row height.
- Forbidden: rounded table corners, shaded rows, sticky-coloured header backgrounds.

### 8.13 Modals
- Centered. Max width 640px. 32px padding (48px on the title row). 1px `--rs-border` border. `--rs-surface` background. No shadow.
- Backdrop: `rgba(31, 31, 29, 0.30)` with `backdrop-filter: blur(8px)`.
- Title: Cormorant 300 italic 32px (`display-s`).
- Forbidden: full-screen modals on desktop (use drawers instead).

### 8.14 Drawers / side panels
- Right-side. 480px wide on lg+; full-screen on md and below.
- Slide in over 320ms `--rs-ease-standard`.
- 1px `--rs-border` left border. `--rs-surface` background. No shadow.
- Used for: critique panel, product filters, line item detail, product substitution.

### 8.15 Toast notifications
- Bottom-left. `--rs-surface` background. 1px `--rs-border` border. No radius.
- 16px padding. `body-s` text. Optional 1px `--rs-accent-deep` left border for emphasis (autosave confirmations).
- Auto-dismiss 5s. Manual dismiss `×` icon button on the right.
- Maximum **one** toast at a time.

### 8.16 Progress indicators
- AI generation: 1px hairline horizontal bar at the top of the relevant card or viewport, fills `--rs-accent` left → right over expected duration. Italic Cormorant status text below.
- Forbidden: spinners, animated dots, percentage counters (except export jobs).

### 8.17 Loading skeletons
- Bone-tinted blocks (`--rs-surface-subtle`), 1px `--rs-border` outline matching the final shape.
- Subtle shimmer at most: 1.5s ease-in-out, opacity 0.5 → 0.6.
- Forbidden: full-width sweep gradients, rainbow shimmer, animated bars.

### 8.18 Empty states
- Centered in available area.
- Italic Cormorant prompt 32px (`display-s` italic).
- DM Sans `body-m` subprompt below, max 48ch.
- Single quiet button (e.g., "begin a project →").
- Optional placeholder image: 4:3 hairline-bordered, gradient `#E8DECB → #C9B690`.

### 8.19 Error states
- Inline. 1px `--rs-error` top border on the failed card or section.
- Italic Cormorant 15px `--rs-error` caption stating exactly what failed and the remediation.
- No icons. Never collapse the layout.

### 8.20 Image upload zones
- 4:3 ratio. 1px dashed `--rs-border-strong`.
- Italic Cormorant 24px prompt centered: `place a photograph here`.
- DM Sans `body-s` subhint: `JPG or PNG · up to 10 MB`.
- Hover: border solid `--rs-accent-deep`; prompt text `--rs-accent-deep`.
- Drag-over: background fill `--rs-accent-tint`.

### 8.21 Before/after comparison
- Default: side-by-side 50/50 with 1px `--rs-border` vertical divider.
- Wipe interaction: optional. Drag handle uses double-arrow cursor; never animates on screen load.
- Captions below: italic Cormorant 14px (`button-quiet` weight). Format `Before · room as captured` / `After · concept 02`.
- Forbidden: animated wipe on load, gradient overlays, "before"/"after" badges with coloured fills.

### 8.22 Shopping list line items
- Anatomy: roman numeral (28px), name + meta block (flex), price (right tabular), quantity stepper.
- Hover: row fills `--rs-surface-subtle` over 240ms.
- Edit: clicking quantity opens an inline 64px-wide stepper. Click "Remove" (quiet link) to drop the row; the row fades out over 240ms.

---

## 9 · Per-Page UX Rules

For every screen below: primary goal, primary CTA, secondary CTAs, **maximum visible CTAs**, tab usage, card usage, what stays above the fold, sidebar/drawer usage, what must never coexist.

### 9.1 Project dashboard
- **Goal:** choose a project, or start a new one.
- **Primary CTA:** `Begin a project` (top-right, primary button).
- **Secondary CTAs:** `Import existing room photos` (quiet), filter dropdown.
- **Max CTAs visible:** 4 in toolbar. Project cards are content, not CTAs.
- **Tabs:** `All / Active / Archived` (underline tabs).
- **Cards:** project cards only.
- **Above the fold:** monogram + nav, page title, primary CTA, first row of project cards.
- **Sidebars:** none.
- **Never together:** hero typography from narrative pages; data-dense tables (this is a card view).

### 9.2 New project flow (modal or single column)
- **Goal:** name the project.
- **Primary CTA:** `Continue` (sticky bottom-right).
- **Secondary CTAs:** `Cancel` (quiet).
- **Max CTAs:** 2.
- **Tabs:** none.
- **Cards:** none.
- **Above the fold:** project name input + Continue button.
- **Sidebars:** none.
- **Never together:** upload zones (uploads belong to the next step).

### 9.3 Room upload screen
- **Goal:** upload at least one room photo.
- **Primary CTA:** `Continue to brief` (sticky, disabled until ≥ 1 image uploaded).
- **Secondary CTAs:** `Skip — I'll add later` (quiet), `Back`.
- **Max CTAs:** 3.
- **Tabs:** none.
- **Cards:** thumbnail cards (1:1) for uploaded photos.
- **Above the fold:** stepper, upload zone.
- **Sidebars:** none.
- **Never together:** brief inputs, concept previews.

### 9.4 Design brief screen
- **Goal:** capture style direction, budget, colour preferences, constraints, optional measurements.
- **Primary CTA:** `Generate concepts` (filled primary, sticky bottom).
- **Secondary CTAs:** `Save and continue later` (quiet), `Back to photos`.
- **Max CTAs:** 3.
- **Tabs:** none. Use a single scrollable form, hairline-divided into sections.
- **Cards:** none. Sections are hairline-divided, not card-encapsulated.
- **Above the fold:** project name (page title), stepper, brief input.
- **Sidebars:** optional right reference panel (image inspirations) — drawer-only.
- **Never together:** generated concepts, product cards.

### 9.5 Concept generation screen
- **Goal:** wait for concepts, observe progress.
- **Primary CTA:** none during generation; `Open concept` once each loads.
- **Max CTAs:** 1 per concept thumbnail.
- **Tabs:** none.
- **Cards:** concept cards (3 across desktop, 4:3 image).
- **Above the fold:** progress hairline at the top, three concept-card placeholders in skeleton state.
- **Sidebars:** none.
- **Never together:** marketing copy, hero typography. This is a working screen.

### 9.6 Concept review / critique screen
- **Goal:** critique a single concept and refine it.
- **Primary CTA:** `Refine concept` (after submitting a critique).
- **Secondary CTAs:** `Source pieces` (advance to product matching), `Open another concept` (back to gallery).
- **Max CTAs in toolbar:** 4.
- **Tabs:** `Critique / Notes / Versions` inside the right panel (underline tabs).
- **Cards:** none in the main canvas; concept image is full-bleed within its 60% column.
- **Above the fold:** concept image (60% width) + critique input.
- **Sidebars:** right inspector (480px on xl, 360px on lg, drawer on md and below).
- **Never together:** shopping list, product cards. Those belong to product matching.

### 9.7 Product matching screen
- **Goal:** match each item from the concept to real SKUs.
- **Primary CTA:** `Lock selections` (sticky bottom-right).
- **Secondary CTAs:** per-item `Swap`, `Open at retailer`, `Filters`.
- **Max CTAs in toolbar:** 4.
- **Tabs:** `All / Furniture / Lighting / Textiles / Decor` (underline tabs, max 5).
- **Cards:** product cards in 4-col grid.
- **Above the fold:** tabs, first row of products, budget summary chip top-right.
- **Sidebars:** right filters drawer (opens on demand only).
- **Never together:** critique threads, concept gallery.

### 9.8 Product substitution screen (drawer)
- **Goal:** pick an alternate product for a single line item.
- **Primary CTA:** `Use this piece`.
- **Secondary CTAs:** `Keep current` (quiet).
- **Max CTAs inside drawer:** 2.
- **Tabs:** `Match style / Match budget / Match dimensions` (segmented control, 3 segments).
- **Cards:** alternates rendered as product cards.
- **Above the fold (drawer):** original piece, three alternates.

### 9.9 Final render screen
- **Goal:** validate the grounded render against the concept and shopping list.
- **Primary CTA:** `Approve & build presentation`.
- **Secondary CTAs:** `Re-render`, `Back to product matching`.
- **Max CTAs:** 3.
- **Tabs:** none.
- **Cards:** none in the image area; shopping list below uses table layout.
- **Above the fold:** render image + metadata pill overlay.
- **Sidebars:** sticky CTA at the right edge (or fixed bottom bar on md and below).
- **Never together:** editing controls; those live in earlier screens.

### 9.10 Client presentation / export screen
- **Goal:** generate an exportable client-ready package.
- **Primary CTA:** `Export PDF`.
- **Secondary CTAs:** `Share link`, `Edit cover`, `Switch to compact layout`.
- **Max CTAs:** 4.
- **Tabs:** none. Use a left/right preview/configuration split.
- **Cards:** preview thumbnails of each spread.
- **Above the fold:** cover preview + export button.
- **Sidebars:** right configuration panel (360px).

### 9.11 Settings / billing
- **Goal:** account, studio, billing, integrations.
- **Primary CTA:** contextual per section (`Save changes`, `Update payment method`).
- **Max CTAs per section:** 2.
- **Tabs:** `Profile / Studio / Billing / Integrations` (underline tabs).
- **Cards:** none. Sections are hairline-divided.
- **Above the fold:** tab strip + first form section.

---

## 10 · Image and Media Rules

### 10.1 Room photos
- Display at 4:3, **never crop**. If the source is a different aspect, letterbox with `--rs-page` bars. Never blur-fill the bars.
- Never overlay text on the architectural region (top one-third minimum kept clear).
- Auto-brightness: maximum +10 lightness adjustment. Saturation adjustment forbidden.
- No drop shadows, no rounded corners.

### 10.2 Concept (generated) images
- 4:3 ratio. Must match the room aspect to permit before/after overlay.
- Always shown with a 1px `--rs-border` border. Never bleed to surface.
- Caption above: italic Cormorant 14px `--rs-accent-deep` — `Concept · 02 of 03`.

### 10.3 Product images
- 1:1, 1px `--rs-border`-bordered, 14px inset frame inside the card.
- If the product image's background varies (lifestyle vs studio), do NOT mix on the same row. Group by background type, or apply a unified `--rs-surface-subtle` backdrop only as a fallback.
- Always show retailer attribution within 16px of the product image.

### 10.4 Retailer logos
- Maximum 32px tall. Monochrome (`--rs-text-muted`). Never use original brand colours.
- Position: under the retailer name caption, or in the source-attribution footer.

### 10.5 Before/after comparison
- Static side-by-side (50/50) is the default.
- Drag-handle wipe interaction is permitted but **never default**.
- Captions below: italic Cormorant 14px.
- Forbidden: animated wipes on load, gradient overlays, coloured "Before"/"After" badges.

### 10.6 Crop rules
- Never crop a room image to remove walls, windows, doors, vents, or built-in fixtures for layout convenience. Always letterbox or constrain the layout.
- Concept images keep the full 4:3 frame.
- Product images may be square-cropped from the source if the source ratio is ambiguous (e.g., 4:5 catalogue shot).

### 10.7 Aspect ratio summary
- Room photo: 4:3 · Concept render: 4:3 · Product: 1:1 · Cover (export only): 16:9 · Empty-state hero: 4:5.

### 10.8 Placeholder rules
- Empty concept slot / not-yet-generated frame: linear gradient `#E8DECB → #C9B690`.
- Empty room: same gradient with italic Cormorant prompt centered.
- **Forbidden placeholder copy:** "Coming soon", "Loading…", "Click here". Use Ritzy's voice: italic lowercase prompts (`place a photograph here`, `concept 03 will appear here`).

### 10.9 Loading states
- Image generation in progress: 1px `--rs-accent` hairline progress bar at the top + italic Cormorant status text. Never replace the placeholder with a spinner.
- Image fade-in on complete: 480ms `--rs-ease-standard`.

### 10.10 Failed image states
- Border becomes 1px `--rs-error`.
- Italic Cormorant 15px `--rs-error` caption: `image could not load`.
- DM Sans 13.5px secondary line: `retry · open original`.
- Never collapse the layout (preserve aspect-ratio frame).
- Never show a broken-image icon glyph.

---

## 11 · Interaction and UX Rules

### 11.1 Navigation model
- Persistent top bar: monogram (left), section nav (center), language toggle + account (right).
- No left sidebar except inside operational screens that need filters/inspectors.
- No collapsible hamburger nav on desktop or tablet.

### 11.2 Project flow
- Linear stepper on creation: `Project → Photos → Brief → Generate → Critique → Match → Render → Export`.
- Steps 1–3 must be completed sequentially.
- From step 4 onward, the user can move freely between concept review, product matching, and rendering.
- Stepper visible on all wizard screens. Current step: 1px `--rs-accent` underline beneath the label. Completed steps: hairline `--rs-accent` dot prefix.

### 11.3 Stepper / wizard rules
- Always show the full sequence.
- Click-jump only to completed steps.
- Forbidden: progress bars, percentages, hidden future steps.

### 11.4 Autosave
- All input fields autosave on blur.
- After each save, display an italic Cormorant `saved` caption in the toolbar for 2s, then fade.
- Manual save buttons forbidden, except for explicit checkpoint actions (`Lock selections`, `Approve & build presentation`).

### 11.5 Confirmation behaviour
- Required only for destructive actions (delete project, delete photo, remove concept).
- Use a modal: italic Cormorant title, DM Sans description, `Confirm` (destructive style) + `Cancel` (quiet) buttons.
- Non-destructive actions never require confirmation.

### 11.6 Critique / refinement interaction
- Designer types into a textarea (italic Cormorant 24px).
- On submit, the AI's response appears as a hairline-divided block beneath. AI text DM Sans roman; subject lines italic Cormorant.
- Designer can append, edit prior prompts, or branch (creating a new concept version).
- Versions appear as a numbered roman strip (`i. ii. iii.`) above the image.

### 11.7 Product swap
- Click `Swap` on a line item → drawer opens from the right with three alternates.
- Each alternate shows price delta from the current selection in italic Cormorant: `+ AED 1,200` or `– AED 800`.
- The currently selected product is shown at the top of the drawer for reference.

### 11.8 Budget adjustment
- Slider at the top of the product matching screen.
- Drag updates suggested products in place; existing selections that are now over budget are flagged with italic `--rs-warning` caption `over budget`. Selections are never silently removed.

### 11.9 Product filtering
- Drawer-only on operational screens. Each filter group hairline-divided.
- Active filter count shown in italic Cormorant inside the drawer-trigger label: `Filters · 3 active`.

### 11.10 Shopping-list edit
- Inline quantity stepper (DM Sans tabular).
- Click `Remove` (quiet, italic Cormorant) to drop a line item; the row fades out over 240ms.
- Strike-through is not used for removed items.

### 11.11 Final approval
- Single primary button `Approve & build presentation`.
- After click, navigate to export screen. No multi-step approval flow.

### 11.12 Keyboard
- All interactive controls reachable via Tab in logical visual order.
- Focus ring: 2px `--rs-focus-ring` outline, 2px outline-offset, square corners.
- `Cmd/Ctrl + S` autosaves.
- `Cmd/Ctrl + K` opens a quick command palette (search projects, concepts, products).
- `Esc` closes the topmost drawer or modal.

### 11.13 Hover / focus / disabled / loading
- Hover transitions ≥ 220ms.
- Disabled controls: no hover effect, `cursor: not-allowed`.
- Loading: `cursor: wait`; control is non-interactive.
- Hover transforms: maximum ±2px translate. No scale, no rotate, no tilt.

### 11.14 Error recovery
- Every error message states the cause and the remediation in one sentence.
- Provide a quiet retry link directly beneath the error message.
- Errors never block the entire screen unless the system is genuinely unrecoverable; prefer inline recovery.

### 11.15 Mobile touch targets
- Minimum 44×44px tap area.
- Quiet links require 16px vertical padding to meet the target.

---

## 12 · AI-Specific UX Rules

### 12.1 Generation states
- **Pending:** italic Cormorant placeholder copy; 1px `--rs-accent` hairline progress bar at the top of the card.
- **In-progress:** ochre bar fills over the expected duration; italic Cormorant status copy underneath.
- **Complete:** image fades in over 480ms; status copy replaced with italic Cormorant concept name + `ready`.
- **Failed:** 1px `--rs-error` border on the card; italic Cormorant `this concept did not render`; DM Sans `retry · adjust brief`.

### 12.2 Progress copy (used verbatim)
Cycle through the lines below in order during generation. After 30s without completion, append the overflow line.
- `preparing the canvas`
- `shaping the room`
- `considering proportions`
- `matching to brief`
- `almost ready`
- (overflow, after 30s) `this is taking longer than usual — feel free to wait or revise the brief.`

Do not improvise alternative copy.

### 12.3 Retry behaviour
- After a failure, replace the progress bar with a `Retry` quiet button.
- The system silently auto-retries once before surfacing failure.

### 12.4 Prompt / critique input
- Textarea, italic Cormorant 24px, hairline bottom border.
- Placeholder italic 24px `--rs-text-disabled`: `tell the room what to change…`.
- No autosuggest. Designer's own words only.

### 12.5 Displaying assumptions
- Each concept exposes an `assumptions` quiet link (italic Cormorant 14px).
- On click, opens a hairline-bordered panel containing a numbered list (DM Sans 14px) of what the AI assumed:
  - `i. ceiling height assumed 3.0 m`
  - `ii. natural light from south wall`
  - `iii. existing fixtures preserved`
- Forbidden: hiding assumptions in tooltips.

### 12.6 Displaying uncertainty
- Any AI-derived value (dimension, count, price match score) is followed by an italic Cormorant caption: `assumed`, `estimated`, or `verified`.
- `verified` may appear only when the value is anchored to a real source (uploaded measurement, retailer SKU lookup).

### 12.7 Explaining product selections
- Each matched product has a `why this piece` quiet link (italic Cormorant 13px).
- Opens a one-sentence prose explanation: e.g., `selected for its bouclé texture and 240 cm length, matching the visual mass of the concept's left wall`.
- Forbidden: percentage match scores. Use prose.

### 12.8 Dimension uncertainty warning
- Italic Cormorant 14px `--rs-warning` caption beneath the line item: `dimensions assumed — confirm before ordering.`
- Required on every line item where the dimension was inferred rather than user-supplied.

### 12.9 SKU rendering disclaimer
- Italic Cormorant 14px `--rs-text-muted` beneath every final render: `this render is a visual approximation; product styling may vary. Refer to the shopping list for verified SKUs.`
- Always present. Never hidden behind interaction.

### 12.10 Concept image vs shopping list (truth separation)
- Concept image is interpretive; shopping list is the source of truth.
- This separation must be visually reinforced: shopping list lives below the render in a hairline-divided table; cells reference verified SKU data.
- The two never overlap visually (no inline product thumbnails inside the concept image overlay).

### 12.11 Strict rules
- Never imply pixel-exact rendering of a specific SKU on a generated image.
- Never hide price or stock uncertainty from the designer.
- Always allow override of any AI product match. The `Swap` affordance must always be visible — never hover-only.
- Always preserve designer authorship. AI is the assistant; the designer's choices are final.

---

## 13 · Data-Dense UI Rules

### 13.1 Prices
- Format `AED 14,200`. `AED` is `caption` DM Sans 500 uppercase 0.32em `--rs-accent-deep`. Numerals are Cormorant 400 18px tabular `--rs-text`.
- Totals: italic Cormorant 32px tabular `--rs-accent` on the `--rs-primary` total bar.
- Discounted prices: original price 1px line-through `--rs-text-muted`, **above** the new price. Never side-by-side. Strike-throughs only on retailer-confirmed discounts; never on AI-suggested alternatives.

### 13.2 Dimensions
- Format `240 × 98 cm`. DM Sans 13.5px tabular. `×` is U+00D7 with hairspace U+200A on each side.
- Always include units. Use cm by default; mm only when the retailer source uses mm.
- AI-estimated dimensions are prefixed with italic Cormorant `approx · ` — e.g., `approx · 240 × 98 cm`.

### 13.3 Retailer names
- Format `Marina Home · 240 × 98 cm`. DM Sans 13.5px caption `--rs-text-muted`. The middle dot is `·` (U+00B7) with regular spaces.

### 13.4 Availability
- `in stock` — `caption` DM Sans 500 uppercase, `--rs-success`.
- `low stock — 2 left` — `caption`, `--rs-warning`.
- `out of stock` — `caption`, `--rs-error`. The line item is rendered with its row text at `--rs-text-muted`; the price cell is **not** struck through.

### 13.5 Confidence
- Forbidden as numerical percentages.
- Express as italic captions: `high confidence` / `estimated` / `assumed` / `verified`.

### 13.6 Budget totals
- Sticky in the top-right of the product matching screen.
- Italic Cormorant 24px total. DM Sans `caption` below: `of AED [budget]`.
- If over budget: caption switches to italic Cormorant `--rs-warning` — `over by AED 1,200`.

### 13.7 Category filters
- Underline tabs at the top of product matching, max 5 visible. Overflow into a `More` dropdown.

### 13.8 Comparison tables
- Maximum 4 columns on desktop. 1px `--rs-border` left hairline between columns.
- The recommended option highlighted with a 1px `--rs-accent` top border across its column.

### 13.9 Product metadata (required per line)
- Required: name, retailer, dimensions, price, source link.
- Optional: SKU, lead time, return policy excerpt.

### 13.10 Tables vs cards
- **Cards:** for selectable entities the designer is choosing among (concept cards, product cards in a grid, project cards).
- **Tables:** for confirmed entities the designer is reviewing or editing (shopping list, presentation export line items, budget breakdown).

### 13.11 Number alignment
- Right-align all numerals in tables and lists.
- All numerals use `font-feature-settings: "tnum", "lnum"`.

### 13.12 Missing data
- Use em-dash `—` `--rs-text-muted`. Never `N/A`. Never blank.

### 13.13 Stale data
- Italic Cormorant caption beneath the value: `as of 14 Apr`.
- Trigger: any retailer data older than 7 days.
- Pricing example: `AED 14,200` over `as of 14 Apr` (italic, smaller, `--rs-text-muted`).

---

## 14 · Motion and Feedback

### 14.1 Durations
- `--rs-duration-micro` = **220ms** (state changes on a single element).
- `--rs-duration-standard` = **320ms** (popover open, drawer slide, tab underline scale).
- `--rs-duration-reveal` = **480ms** (image fade-in, generation complete).
- Forbidden: durations < 200ms (twitchy) or > 600ms (sluggish).

### 14.2 Easing
- `--rs-ease-standard` = `cubic-bezier(0.2, 0.7, 0.2, 1)`.
- `--rs-ease-linear` = `linear` (progress bars only).
- Forbidden: bounce, elastic, spring easings.

### 14.3 Hover transitions
- Colour / opacity changes: 220ms standard.
- Underline scale-in (tabs, nav links): 320ms standard, transform-origin left.
- Hover translate ≤ ±2px. No scale, rotate, tilt, or 3D transforms.

### 14.4 Loading transitions
- Skeleton fade-in: 240ms.
- Image fade-in on load: 480ms.

### 14.5 Generation progress
- Linear `--rs-accent` progress bar fills over the expected duration.
- If actual time exceeds expected, the easing slows asymptotically — the bar never reaches 100% until actual completion.

### 14.6 Skeletons
- Subtle shimmer at most: 1.5s ease-in-out, opacity 0.5 → 0.6.
- Forbidden: full-width sweep gradient shimmers.

### 14.7 Forbidden animations
- Entrance bounce, scale-in, stagger-from-bottom, parallax, magnetic cursors, animated gradients, hover tilt, glow pulses, particle effects, scroll-triggered reveals (except the documented image fade-in).
- The interface should feel still until something is actively generating.

---

## 15 · Accessibility Rules

### 15.1 Contrast
- Body text: ≥ 4.5:1.
- UI / caption text: ≥ 4.5:1.
- Disabled text: ≥ 3:1.
- Italic accent emphasis (`--rs-accent`): minimum size 17px to meet AA Large (3:1).
- All token pairings declared in §4 are pre-verified.

### 15.2 Focus ring
- 2px outline, `--rs-focus-ring`, 2px outline-offset, square corners.
- Visible on every interactive element when focused via keyboard.
- Never `outline: none` without an alternative focus indicator.

### 15.3 Keyboard navigation
- Logical tab order matches visual order.
- Skip-to-content link in the top bar (visually hidden until focused).
- All drawers and modals trap focus on open and restore focus to the trigger on close.

### 15.4 Touch targets
- Minimum 44×44px on mobile and tablet.
- Quiet links require 16px vertical padding to meet the target.

### 15.5 Readable font sizes
- Body minimum 14px on desktop, 15px on mobile (Ritzy uses 15px universally).
- Caption minimum 11px on desktop, 12px on mobile (promote to 12px on `< 768`).

### 15.6 Reduced motion
- `@media (prefers-reduced-motion: reduce)`: disable all transforms, scaleX, slide-in animations. Keep opacity transitions only at 240ms or less.
- Image generation progress bar continues to fill (informational), without easing curves.

### 15.7 Form errors
- Announced via `aria-describedby` linking to the error message.
- Error message: italic Cormorant 13.5px `--rs-error` beneath the input.
- 1px `--rs-error` border replaces the input's bottom border.

### 15.8 Alt text rules

| Subject | Format |
|---|---|
| Room photo | `[Room type] photographed at [project name]` — e.g., `Living room photographed at Villa Al Barari`. |
| Concept render | `Concept [N] of [M] · [concept name]` — e.g., `Concept 02 of 03 · Quiet Levantine`. |
| Product image | `[Product name] · [retailer]` — e.g., `Bouclé three-seat sofa · Marina Home`. |
| Retailer logo | retailer name. Mark `role="presentation"` if the retailer name is also visible as adjacent text. |
| Decorative gradient / placeholder | `aria-hidden="true"`. |

### 15.9 RTL (Arabic)
- Mirror all directional layouts when `dir="rtl"`. Stepper progresses right-to-left. Right inspector drawer becomes left drawer.
- Italic Cormorant Garamond is **not used for Arabic strings** — substitute body family for Arabic. Arabic does not have italic; never apply `font-style: italic` to Arabic text.
- Numerals stay left-to-right (numbers are not mirrored). `AED 38,400` reads identically in both modes; the order of numeral and unit may swap per locale conventions but the digit grouping stays Western-style.
- The `×` separator in dimensions remains.
- Hairlines, padding, and borders mirror via logical properties (`padding-inline-start`, `border-inline-end`, etc.).

---

## 16 · Responsive Rules

### 16.1 Breakpoints

| Token | Range |
|---|---|
| `xs` | < 480 |
| `sm` | 480–767 (mobile) |
| `md` | 768–1023 (tablet) |
| `lg` | 1024–1439 (desktop standard) |
| `xl` | ≥ 1440 (desktop wide) |

### 16.2 Per-breakpoint behaviour

#### Desktop wide (xl, ≥ 1440)
- 12 col, 80px gutters.
- Top bar full-width with center nav, language toggle right.
- Right inspector at 480px when relevant.
- Concept gallery 3-up. Product grid 4-up. Shopping list full table.

#### Desktop standard (lg, 1024–1439)
- 12 col, 64px gutters.
- Right inspector 360px.
- Concept gallery 3-up. Product grid 4-up. Shopping list full table.

#### Tablet (md, 768–1023)
- 8 col, 32px gutters.
- Top bar collapses language toggle and account into a dropdown; center nav remains visible.
- Right inspector becomes a drawer (open on demand).
- Concept gallery 2-up. Product grid 3-up.
- Shopping list remains a table; hide retailer-logo column (text only).
- Filters: drawer.
- Modals remain centered.

#### Mobile (sm, < 768)
- 4 col, 20px gutters.
- Top bar: monogram left, hamburger right (the only mobile use of hamburger). Center nav becomes a drawer.
- Sidebars and inspectors: full-screen drawers.
- Concept gallery 1-up.
- Product grid 2-up using compact card variant: smaller image, name + price stacked.
- Shopping list switches from table to vertical card list — each row becomes its own hairline-divided block.
- Filters: full-screen drawer.
- Modals: full-screen.
- Wizard stepper collapses to a single italic Cormorant line: `Step 3 of 8 · Brief`.

---

## 17 · Implementation Tokens

### 17.1 CSS variables

```css
:root {
  /* ── Colour ── */
  --rs-page:            #F2EDE4;
  --rs-surface:         #FBF8F2;
  --rs-surface-subtle:  #EBE3D4;

  --rs-border:          rgba(31, 31, 29, 0.08);
  --rs-border-strong:   rgba(31, 31, 29, 0.16);

  --rs-text:            #1F1F1D;
  --rs-text-secondary:  #36352F;
  --rs-text-muted:      #6F6963;
  --rs-text-subtle:     #8A8175;
  --rs-text-disabled:   #B5AC9C;

  --rs-primary:         #1F1F1D;
  --rs-primary-hover:   #36352F;

  --rs-accent:          #B58E5A;
  --rs-accent-deep:     #8C6A3E;
  --rs-accent-tint:     rgba(181, 142, 90, 0.10);

  --rs-success:         #4D6840;
  --rs-warning:         #8C6A28;
  --rs-error:           #7E3326;
  --rs-destructive:     #7E3326;

  --rs-focus-ring:      rgba(181, 142, 90, 0.40);

  --rs-empty-grad-from: #E8DECB;
  --rs-empty-grad-to:   #C9B690;

  /* ── Typography ── */
  --rs-font-display: "Cormorant Garamond", "Cormorant", "EB Garamond", "Times New Roman", serif;
  --rs-font-body:    "DM Sans", "Söhne", -apple-system, "Segoe UI", "Helvetica Neue", sans-serif;
  --rs-font-mono:    "DM Mono", ui-monospace, Menlo, monospace;

  --rs-text-display-xl: 84px;     /* line 0.95 / -0.020em */
  --rs-text-display-l:  56px;     /* 1.00 / -0.015em */
  --rs-text-display-m:  44px;     /* 1.05 / -0.015em */
  --rs-text-display-s:  32px;     /* 1.10 / -0.010em */
  --rs-text-display-xs: 24px;     /* 1.10 / 0em */

  --rs-text-body-l:   17px;       /* 1.70 / 0em */
  --rs-text-body-m:   15px;       /* 1.65 / 0em */
  --rs-text-body-s:   13.5px;     /* 1.55 / 0em */
  --rs-text-caption:  11px;       /* 1.50 / 0.36em uppercase */
  --rs-text-caption-tight: 10.5px;/* 1.40 / 0.32em uppercase */
  --rs-text-button:   12.5px;     /* 1.00 / 0.18em uppercase */
  --rs-text-button-quiet: 15px;   /* 1.00 / 0em italic */

  --rs-weight-display-light:   300;
  --rs-weight-display-regular: 400;
  --rs-weight-display-medium:  500;
  --rs-weight-body:            400;
  --rs-weight-body-medium:     500;
  --rs-weight-body-bold:       600;

  /* ── Spacing (4px base) ── */
  --rs-space-0:  0;
  --rs-space-1:  4px;
  --rs-space-2:  8px;
  --rs-space-3:  12px;
  --rs-space-4:  16px;
  --rs-space-5:  20px;
  --rs-space-6:  24px;
  --rs-space-8:  32px;
  --rs-space-10: 40px;
  --rs-space-12: 48px;
  --rs-space-16: 64px;
  --rs-space-20: 80px;
  --rs-space-24: 96px;
  --rs-space-32: 128px;

  /* ── Radii ── */
  --rs-radius-0:    0;
  --rs-radius-1:    2px;     /* reserved for chip/tag override only */
  --rs-radius-pill: 9999px;  /* chips, total labels, focus pills */

  /* ── Elevation ── */
  --rs-shadow-0: none;
  --rs-shadow-1: 0 0 0 1px rgba(31, 31, 29, 0.06);
  /* No --rs-shadow-2 — elevations 2+ are forbidden. */

  /* ── Z-index ── */
  --rs-z-base:     0;
  --rs-z-toolbar:  20;
  --rs-z-dropdown: 40;
  --rs-z-drawer:   60;
  --rs-z-modal:    80;
  --rs-z-toast:    100;

  /* ── Breakpoints ── */
  --rs-bp-sm: 480px;
  --rs-bp-md: 768px;
  --rs-bp-lg: 1024px;
  --rs-bp-xl: 1440px;

  /* ── Motion ── */
  --rs-duration-micro:    220ms;
  --rs-duration-standard: 320ms;
  --rs-duration-reveal:   480ms;
  --rs-ease-standard:     cubic-bezier(0.2, 0.7, 0.2, 1);
  --rs-ease-linear:       linear;
}
```

### 17.2 Tailwind config extension

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  theme: {
    extend: {
      colors: {
        page:    '#F2EDE4',
        surface: { DEFAULT: '#FBF8F2', subtle: '#EBE3D4' },
        line:    { DEFAULT: 'rgba(31,31,29,0.08)', strong: 'rgba(31,31,29,0.16)' },
        ink: {
          DEFAULT:   '#1F1F1D',
          secondary: '#36352F',
          muted:     '#6F6963',
          subtle:    '#8A8175',
          disabled:  '#B5AC9C',
        },
        primary: { DEFAULT: '#1F1F1D', hover: '#36352F' },
        accent:  { DEFAULT: '#B58E5A', deep: '#8C6A3E', tint: 'rgba(181,142,90,0.10)' },
        success: '#4D6840',
        warning: '#8C6A28',
        error:   '#7E3326',
        ring:    'rgba(181,142,90,0.40)',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', '"Cormorant"', '"EB Garamond"', 'Times New Roman', 'serif'],
        body:    ['"DM Sans"', '"Söhne"', '-apple-system', '"Segoe UI"', '"Helvetica Neue"', 'sans-serif'],
        mono:    ['"DM Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      fontSize: {
        'display-xl':    ['84px',   { lineHeight: '0.95', letterSpacing: '-0.020em' }],
        'display-l':     ['56px',   { lineHeight: '1.00', letterSpacing: '-0.015em' }],
        'display-m':     ['44px',   { lineHeight: '1.05', letterSpacing: '-0.015em' }],
        'display-s':     ['32px',   { lineHeight: '1.10', letterSpacing: '-0.010em' }],
        'display-xs':    ['24px',   { lineHeight: '1.10' }],
        'body-l':        ['17px',   { lineHeight: '1.70' }],
        'body-m':        ['15px',   { lineHeight: '1.65' }],
        'body-s':        ['13.5px', { lineHeight: '1.55' }],
        'caption':       ['11px',   { lineHeight: '1.50', letterSpacing: '0.36em' }],
        'caption-tight': ['10.5px', { lineHeight: '1.40', letterSpacing: '0.32em' }],
        'button':        ['12.5px', { lineHeight: '1.00', letterSpacing: '0.18em' }],
        'button-quiet':  ['15px',   { lineHeight: '1.00' }],
      },
      spacing: {
        '0': '0', '1': '4px', '2': '8px', '3': '12px', '4': '16px', '5': '20px',
        '6': '24px', '8': '32px', '10': '40px', '12': '48px', '16': '64px',
        '20': '80px', '24': '96px', '32': '128px',
      },
      borderRadius: { 'none': '0', 'tight': '2px', 'pill': '9999px' },
      boxShadow: { 'hairline': '0 0 0 1px rgba(31,31,29,0.06)' },
      transitionDuration: { 'micro': '220ms', 'standard': '320ms', 'reveal': '480ms' },
      transitionTimingFunction: { 'standard': 'cubic-bezier(0.2,0.7,0.2,1)' },
      screens: { sm: '480px', md: '768px', lg: '1024px', xl: '1440px' },
      zIndex: { base: '0', toolbar: '20', dropdown: '40', drawer: '60', modal: '80', toast: '100' },
    },
  },
};

export default config;
```

---

## 18 · Do / Don't Rules

### Do

1. Use Cormorant Garamond on every heading without exception.
2. Use DM Sans on every form label, button, and table cell without exception.
3. Apply tabular numerals (`font-feature-settings: "tnum", "lnum"`) on every price, dimension, total, and count.
4. Pair every price with a `caption`-sized currency label in `--rs-accent-deep`.
5. Show retailer attribution within 16px of every product image.
6. Show the `Swap` affordance on every shopping-list line item, always visible.
7. Show italic Cormorant assumption notes whenever AI-derived data is displayed.
8. Letterbox a non-4:3 room photo with `--rs-page` bars instead of cropping.
9. Use the `#E8DECB → #C9B690` gradient only for empty concept slots and empty rooms.
10. Use square corners (`border-radius: 0`) on cards, buttons, inputs, and modals.
11. Use pill radius (`9999px`) only on chips, total labels, and focus pills.
12. Use 1px hairline borders for every divider.
13. Apply a 2px `--rs-focus-ring` outline on every focusable control.
14. Use `--rs-page` (Bone) as the canvas; never pure white.
15. Use a single accent colour per screen — accent + tint count as one.
16. Show a stale-data caption (`as of [date]`) whenever pricing data exceeds 7 days old.
17. Show `approx ·` italic prefix on every AI-estimated dimension.
18. Default before/after to static side-by-side; require explicit drag for the wipe.
19. Show concept image at minimum 60% of the viewport width during critique on lg+.
20. Place primary CTA bottom-right on wizard screens; top-right on dashboard screens.

### Don't

21. Don't put a card inside a card. Use hairline-divided sections instead.
22. Don't use shadows above elevation 1. No drop shadows on cards.
23. Don't use `display-xl` (84px) on operational screens. It is for empty states and auth only.
24. Don't show AI confidence as a percentage. Use prose: `high confidence` / `estimated` / `assumed` / `verified`.
25. Don't hide dimensions, retailer name, or price behind hover-only interactions.
26. Don't apply gradients behind tables, shopping lists, or any dense product data.
27. Don't use `#000000` or `#FFFFFF` anywhere in the product UI.
28. Don't use Inter, Roboto, Arial, Open Sans, Lato, or `system-ui` as a primary font.
29. Don't use rounded buttons. Buttons are square except chips and total labels.
30. Don't show more than 2 primary buttons on a single screen.
31. Don't use traffic-light reds for destructive actions. Use `--rs-destructive` (`#7E3326`).
32. Don't use spinners. Use the hairline `--rs-accent` progress bar with italic status copy.
33. Don't animate entrance with bounce, scale-in, or stagger-from-bottom.
34. Don't use generic placeholder copy (`Loading…`, `Coming soon`, `Click here`).
35. Don't put hero typography on operational screens (matching, render, list edit, settings).
36. Don't crop room photos to remove walls, windows, vents, or built-in fixtures.
37. Don't display product line items without a verified retailer + price source.
38. Don't strike-through prices as the only indicator of a discount; show the original above the new.
39. Don't display alt-product comparisons with a `% match` score. Use prose.
40. Don't use scroll-triggered reveals or parallax on any operational screen.
41. Don't use animated gradients, glows, sparkles, or "magic" purple anywhere.
42. Don't use carousels. Use a 3-column gallery with arrow-key/Tab navigation.
43. Don't show a save button next to autosaved fields.
44. Don't allow more than 4 underline tabs in a single tab strip; overflow into a `More` dropdown.
45. Don't show a percentage progress counter unless the operation is an export.

---

## 19 · Page Blueprints

Diagrams use ASCII boxes. `[ ]` denotes a region; `▸` denotes content; `◆` denotes the primary CTA.

### 19.1 Project dashboard

**Desktop (lg+).**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Ri  Ritzy · Studio        work  concepts  sourcing  studio          EN · AR │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  N° 01 — Studio                                              ◆ Begin a project│
│                                                                              │
│  Projects, in progress                                                       │
│                                                                              │
│  all   active   archived                                          12 projects│
│  ───                                                                         │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                        │
│  │ [cover 4:3 ] │  │ [cover 4:3 ] │  │ [cover 4:3 ] │                        │
│  │              │  │              │  │              │                        │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤                        │
│  │ Villa al     │  │ Apartment in │  │ Penthouse,   │                        │
│  │  Barari      │  │  Marina      │  │  Downtown    │                        │
│  │ 4 rooms · 12 │  │ 2 rooms · 5  │  │ 6 rooms · 18 │                        │
│  │ pieces       │  │ pieces       │  │ pieces       │                        │
│  └──────────────┘  └──────────────┘  └──────────────┘                        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Mobile.**

```
┌────────────────────────┐
│ Ri  Ritzy · Studio  ☰  │
├────────────────────────┤
│ N° 01 — Studio         │
│ Projects, in progress  │
│                        │
│ ◆ Begin a project      │
│                        │
│ all  active  archived  │
│ ───                    │
│                        │
│ [cover 4:3]            │
│ Villa al Barari        │
│ 4 rooms · 12 pieces    │
│                        │
│ [cover 4:3]            │
│ Apartment in Marina    │
│ 2 rooms · 5 pieces     │
└────────────────────────┘
```

### 19.2 New project

```
┌──────────────────────────────────────────┐
│  N° 02 — New project                     │
│                                          │
│  Name this project                       │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ Villa al Barari                   │   │
│  └──────────────────────────────────┘   │
│  PROJECT NAME                            │
│                                          │
│             ◆ Continue   · cancel        │
└──────────────────────────────────────────┘
```

### 19.3 Room upload

**Desktop.**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Ri  ...                                                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Project ─── Photos ─── Brief ─── Generate ─── Critique ─── Match ─── …      │
│             ───                                                              │
│                                                                              │
│  N° 03 — Photographs                                                         │
│  Place the rooms you'd like to redesign.                                     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐      │
│  │                                                                    │      │
│  │              place a photograph here                               │      │
│  │              JPG or PNG · up to 10 MB                              │      │
│  │                                                                    │      │
│  └────────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  [thumb] [thumb] [thumb] [thumb] [thumb] [thumb]                             │
│                                                                              │
│         · skip — I'll add later        ◆ Continue to brief                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 19.4 Design brief

**Desktop.**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Project ─── Photos ─── Brief ─── …                                          │
│                          ───                                                 │
│                                                                              │
│  N° 04 — Brief                                                               │
│                                                                              │
│  Describe the direction                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐        │
│  │ warm minimal, oak, brushed brass…                                │        │
│  └──────────────────────────────────────────────────────────────────┘        │
│  ───                                                                         │
│                                                                              │
│  Mood                                                                        │
│  ( warm minimal )( quiet levantine )( mid-century )( coastal )( japandi )    │
│                                                                              │
│  Budget                  AED 30,000 ──●────── AED 150,000                    │
│                                                                              │
│  Constraints                                                                 │
│  ┌──────────────────────────────────────────────────────────────────┐        │
│  │ keep existing built-ins, ceiling 3.0m, low TV wall…              │        │
│  └──────────────────────────────────────────────────────────────────┘        │
│                                                                              │
│         · save and continue later        ◆ Generate concepts                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 19.5 Concept generation / review (gallery)

**Desktop.**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ───── progress hairline (─────────────────────────                  )─────  │
│                                                                              │
│  Concepts · shaping the room…                                                │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                        │
│  │ [render 4:3] │  │ [render 4:3] │  │ [skel 4:3   ]│                        │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤                        │
│  │ 01 / 03      │  │ 02 / 03      │  │ 03 / 03      │                        │
│  │ Quiet        │  │ Quiet        │  │ generating…  │                        │
│  │  Levantine   │  │  Levantine   │  │              │                        │
│  │ AED 38,400   │  │ AED 41,200   │  │ ───          │                        │
│  │ open →       │  │ open →       │  │              │                        │
│  └──────────────┘  └──────────────┘  └──────────────┘                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 19.6 Concept critique / refinement

**Desktop.**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ◀ back to concepts                                                          │
│                                                                              │
│  ┌──────────────────────────────────────┐  ┌────────────────────────────┐    │
│  │                                      │  │  Critique  Notes  Versions │    │
│  │            [concept 4:3]             │  │  ───                       │    │
│  │                                      │  │                            │    │
│  │       Concept · 02 of 03             │  │  i. soften the rug texture │    │
│  │       Quiet Levantine                │  │  ↳ understood — moving to  │    │
│  │                                      │  │    a wool berber.          │    │
│  └──────────────────────────────────────┘  │  ───                       │    │
│  i. ii. iii.   ▸ tell the room what to     │  ii. lift the drape height │    │
│      change…                               │     to ceiling.            │    │
│                                            │  ───                       │    │
│  · open another concept                    │  ▸ tell the room what…    │    │
│                                            │  ◆ Refine concept         │    │
│  ◆ Source pieces →                         │                            │    │
│                                            │                            │    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 19.7 Product matching

**Desktop.**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ◀ back to concept                              budget · AED 38,400 / 50,000│
│                                                                              │
│  all  furniture  lighting  textiles  decor                       · Filters   │
│  ────                                                                        │
│                                                                              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                                 │
│  │[1:1]   │ │[1:1]   │ │[1:1]   │ │[1:1]   │                                 │
│  │bouclé  │ │travert │ │floor   │ │berber  │                                 │
│  │sofa    │ │table   │ │lamp    │ │rug     │                                 │
│  │Marina  │ │Odd Pc  │ │WestElm │ │Pan Em  │                                 │
│  │240×98  │ │⌀ 110   │ │168 cm  │ │240×170 │                                 │
│  │14,200  │ │ 5,900  │ │ 2,750  │ │ 3,400  │                                 │
│  │swap →  │ │swap →  │ │swap →  │ │swap →  │                                 │
│  └────────┘ └────────┘ └────────┘ └────────┘                                 │
│                                                                              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                                 │
│  │ ...    │ │ ...    │ │ ...    │ │ ...    │                                 │
│                                                                              │
│                                                          ◆ Lock selections   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 19.8 Product substitution (drawer)

```
                                         ┌──────────────────────────────────┐
                                         │  ✕                               │
                                         │  Swap a piece                    │
                                         │                                  │
                                         │  Currently selected              │
                                         │  ┌──────────┐                    │
                                         │  │ [1:1]    │ Bouclé sofa         │
                                         │  └──────────┘ AED 14,200          │
                                         │                                  │
                                         │  Match style · budget · dimens.  │
                                         │  ───                             │
                                         │                                  │
                                         │  ┌──────────┐ ┌──────────┐       │
                                         │  │ [1:1]    │ │ [1:1]    │       │
                                         │  │ + 1,200  │ │ – 800    │       │
                                         │  │  why →   │ │  why →   │       │
                                         │  └──────────┘ └──────────┘       │
                                         │                                  │
                                         │  · keep current  ◆ Use this piece│
                                         └──────────────────────────────────┘
```

### 19.9 Final render

**Desktop.**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│         ┌────────────────────────────────────────────────────────────┐      │
│         │                                                            │      │
│         │                  [final render — full bleed]               │      │
│         │                                                            │      │
│         │  Quiet Levantine · 02/03                AED 38,400         │      │
│         └────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  this render is a visual approximation; product styling may vary.            │
│                                                                              │
│  Shopping list — 12 pieces                                                   │
│  ───                                                                         │
│  i.   Bouclé three-seat sofa     Marina Home · 240 × 98       14,200        │
│  ii.  Travertine coffee table    The Odd Piece · ⌀ 110         5,900        │
│  iii. Alabaster floor lamp       West Elm · 168 cm             2,750        │
│  iv.  Wool berber rug            Pan Emirates · 240 × 170      3,400        │
│  ───                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐        │
│  │  Estimated total · AED                          38,400           │        │
│  └──────────────────────────────────────────────────────────────────┘        │
│                                                                              │
│  · re-render   · back to product matching     ◆ Approve & build presentation │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 19.10 Client presentation / export

**Desktop.**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────┐  ┌────────────────────────┐│
│  │                                             │  │ Cover                  ││
│  │           [cover preview 16:9]              │  │ ────                   ││
│  │                                             │  │ Layout: editorial      ││
│  │      Villa al Barari · Quiet Levantine      │  │ Cover image: render 02 ││
│  │                                             │  │ Include shopping list  ││
│  └─────────────────────────────────────────────┘  │  · yes                  ││
│                                                   │ Logo: Ritzy mark        ││
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │                        ││
│  │ p.01 │ │ p.02 │ │ p.03 │ │ p.04 │              │                        ││
│  └──────┘ └──────┘ └──────┘ └──────┘              │ ◆ Export PDF           ││
│                                                   │ · share link            ││
│                                                   └────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 20 · Agent Compliance Checklist

Every implementation agent must complete the checks below before marking a UI slice complete. Failing any item means the slice is not done.

### 20.1 Spacing
- [ ] All margins, paddings, and gaps come from the 4px scale (§6.1). No off-scale values.
- [ ] Page gutter matches the breakpoint table (§6.2).
- [ ] Section spacing matches narrative vs operational rules (§6.3).
- [ ] Card internal padding matches the card type (§6.4).

### 20.2 Typography
- [ ] Every heading uses Cormorant Garamond.
- [ ] Every form label, button, and table cell uses DM Sans.
- [ ] All numerals (prices, dimensions, totals, counts) use `font-feature-settings: "tnum", "lnum"`.
- [ ] Exact size/line/tracking from §5.2 — no improvisation.
- [ ] No use of Inter, Roboto, Arial, or `system-ui` as a primary face.
- [ ] `display-xl` not used on operational screens (§5.7).

### 20.3 Colour
- [ ] No `#000000` or `#FFFFFF` anywhere.
- [ ] One accent colour per screen (`--rs-accent` + tint counts as one).
- [ ] All text/background pairings meet contrast targets (§4.6).
- [ ] `--rs-accent` is used for italic emphasis only, at ≥ 17px.
- [ ] Decorative gradients absent — only the empty-concept-slot gradient is permitted (§4.3).

### 20.4 Component choice
- [ ] Cards used only for selectable entities (§13.10).
- [ ] Tables used only for confirmed/editable entities.
- [ ] No card-in-card.
- [ ] No spinners. Generation uses the hairline ochre progress bar (§8.16, §14.5).
- [ ] All buttons square; chips and total labels are the only pill exceptions.

### 20.5 CTA count
- [ ] Maximum visible CTAs match the per-screen rule (§9).
- [ ] Maximum 2 primary buttons per screen.
- [ ] Primary CTA is positioned per the screen-specific rule.

### 20.6 Responsive behaviour
- [ ] Layout matches §16.2 at sm, md, lg, xl.
- [ ] Sidebars become drawers on md and below.
- [ ] Shopping list switches from table to vertical card list on sm.
- [ ] Wizard stepper collapses to a single italic line on sm.

### 20.7 Accessibility
- [ ] All interactive controls reachable via Tab in logical order.
- [ ] 2px `--rs-focus-ring` visible on keyboard focus.
- [ ] Touch targets ≥ 44×44px on md and below.
- [ ] All images have alt text per §15.8.
- [ ] `prefers-reduced-motion` honoured (§15.6).
- [ ] RTL: layout mirrors via logical properties; italic Cormorant not applied to Arabic strings.

### 20.8 Image handling
- [ ] Room photos are 4:3, never cropped (letterboxed if source ratio differs).
- [ ] Concept renders are 4:3 with 1px hairline border.
- [ ] Product images are 1:1 with retailer attribution within 16px.
- [ ] No drop shadows on any image.
- [ ] Failed images preserve the aspect-ratio frame and use the documented error caption.

### 20.9 AI uncertainty language
- [ ] No percentage confidence scores anywhere.
- [ ] AI-derived dimensions prefixed with italic Cormorant `approx ·`.
- [ ] SKU rendering disclaimer present beneath every final render (§12.9).
- [ ] Dimension uncertainty caption present on every line item where dimension is inferred (§12.8).
- [ ] Generation copy uses only the verbatim phrases in §12.2.

### 20.10 Product-data truthfulness
- [ ] Every product line shows: name, retailer, dimensions, price, source link.
- [ ] Stale prices show `as of [date]` italic caption (§13.13).
- [ ] Out-of-stock styling per §13.4.
- [ ] No silent removal of over-budget selections (§11.8).
- [ ] `Swap` affordance always visible (§12.11).

### 20.11 Visual clutter
- [ ] No card inside a card.
- [ ] No more than 4 underline tabs in a strip.
- [ ] No more than 2 primary buttons on a screen.
- [ ] No drop shadows above elevation 1.
- [ ] No animated gradients, sparkles, glows, or "magic" purple.
- [ ] No carousels.

If every box is checked, the slice may be marked complete.

---

**End of document.**
