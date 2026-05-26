# Landing Alignment Brief

**Author:** the instance that shipped PR #126 (integration) and PR #127 (production promotion) of the marketing landing.
**Audience:** the next two instances — one bringing the app's operational screens into alignment, one bringing the separate Ritzy Interiors brochure repo into alignment.
**Production reference:** `main` at merge commit `bf1290928fe337e4ccccbec306aa5352580eed5a`. Marketing landing lives at `/login`.

---

## Why this doc exists

The marketing landing at `/login` shipped to production on 2026-05-25. It introduces a confident, photographic, editorial design language scoped to "marketing surfaces" via the §17.3 brand-spec amendment. Sam (founder) now wants:

1. The Ritzy Studio **app's operational screens** selectively brought into alignment with the landing's voice — without redesigning the working tool into a brochure.
2. The separate **Ritzy Interiors brochure website** (different repo) to share the same design language end-to-end.

This doc is the source of truth for both efforts. It is **not** a brief for changing the landing itself — that work is done.

---

## Significance assessment

The change is **moderate**, not radical. Specifically:

- The landing follows every locked brand rule from `docs/Vision/05_Brand_and_Design_System.md` §1–§9.
- It introduces **opt-in additive tokens** scoped to marketing surfaces via the new §17.3 amendment (`--rs-text-display-marketing`, `--rs-text-button-l`, `--rs-shadow-marketing-float`). Locked-rule tokens are untouched.
- It introduces **five new presentational components** in `packages/ui/src/`: `MarketingDisplay`, `DecorativeRule`, `SectionEyebrow`, `MarketingPanel`, `Reveal` (plus the `useRevealOnScroll` hook).
- It introduces **new visual patterns** at page-composition level (section-eyebrow + decorative-rule + display-H2 rhythm, floating overlay panels on hero imagery, image-led card grids, hairline-divided step columns, retailer trust bar, pricing toggle, full-bleed cinematic CTA).

The app's operational chrome and forms should NOT be redesigned to match the landing. The landing is editorial; the app is a working tool. Alignment means **selectively borrowing landing patterns** where they earn their place — not blanket-applying them.

The brochure website is much closer in spirit to the landing — same audience, same goal (build confidence + drive conversion). It should adopt the landing's language wholesale: same tokens, same components, same macro-rhythm.

---

## What the landing introduced

### §17.3 tokens (added to `apps/web/app/globals.css`)

```css
:root {
  /* §17.3 Marketing surfaces (opt-in) — scoped to /login + future marketing routes. */
  --rs-text-display-marketing: clamp(56px, 8vw, 96px);
  --rs-text-button-l: 14px;
  --rs-shadow-marketing-float: 0 1px 2px rgba(31, 31, 29, 0.06), 0 18px 42px rgba(31, 31, 29, 0.08);
}

@theme inline {
  --text-display-marketing: var(--rs-text-display-marketing);
  --text-button-l: var(--rs-text-button-l);
  --shadow-marketing-float: var(--rs-shadow-marketing-float);
}
```

Plus a reveal-on-scroll CSS pair:

```css
[data-reveal] {
  opacity: 0;
  transform: translateY(24px);
  transition:
    opacity var(--rs-duration-reveal) var(--rs-ease-standard),
    transform var(--rs-duration-reveal) var(--rs-ease-standard);
}

[data-reveal][data-revealed="true"] {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  [data-reveal] {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

Allowed routes per brand spec §17.3: `/login` and any future marketing route (`/about`, `/pricing`, `/for-designers`). Not used inside the authenticated app's operational chrome unless explicitly opted in per this brief.

### Components (in `packages/ui/src/`)

- `marketing-display.tsx` — `MarketingDisplay` (Cormorant Light H1/H2 at the marketing tier), `DecorativeRule` (4px-wide ochre hairline), `SectionEyebrow` (uppercase ochre kicker).
- `marketing-panel.tsx` — `MarketingPanel` with `tone="paper" | "subtle" | "ink"` and `elevation="flat" | "float"`. Ritzy's translation of the purchased Aura template's "premium-panel" pattern: hairline border, 4px corners, optional float shadow. **Not** to be confused with the existing `Card` / `Panel` primitives — those stay for operational chrome.
- `reveal.tsx` — `Reveal` wrapper that flips `[data-revealed]` via IntersectionObserver. Supports `as` prop ("div" | "section" | "article" | "header" | "footer" | "aside") and `delay` (0/100/200/300/500/700ms).
- `use-reveal-on-scroll.tsx` — bare hook if raw ref access is needed.

All five exports are public via `packages/ui/src/index.ts`.

### Patterns at the page level (in `apps/web/app/login/sections/`)

- **Hero** — H1 + DecorativeRule + body + dual CTAs + metric strip + image with floating overlay panels.
- **Section heads** — `SectionEyebrow` + `DecorativeRule` + `MarketingDisplay as="h2"` + body, repeated across every section.
- **Trust bar** — full-bleed hairline-bounded band with six retailer names in DM Sans uppercase tracked.
- **Quote card** — oversized opening quote glyph + italic display body + caption attribution inside a `MarketingPanel`.
- **Image-led card grid** — large card + small card asymmetry; image fills card top, copy + chevron sit below.
- **Step column with hairline divider** — number/title/body/visual stacked vertically; hairlines between columns at lg+.
- **Pricing toggle** — two-mode toggle (Homeowners / Designers) with an elevated `MarketingPanel`.
- **Full-bleed cinematic CTA** — image background + gradient overlay + centred `MarketingPanel`.
- **Footer** — 4-column structure with brand + product links + audience links + newsletter placeholder.

---

## App alignment strategy

### High-confidence applications (apply landing patterns here)

- **`/` dashboard empty state.** Today: a dashed-border centered block. Replace with: `SectionEyebrow` + `DecorativeRule` + `MarketingDisplay as="h2"` + body + CTA. Same brand DNA, just leveled up.
- **`/onboarding`** (persona selection). Two persona cards become `MarketingPanel`-style with image headers, hairline borders, ochre accent on selected state. Add a `SectionEyebrow` above the headline.
- **`/projects/new`** (project creation). Use `MarketingPanel` for the form container, `SectionEyebrow` + `DecorativeRule` above the heading.
- **`/projects/[projectId]/rooms/new`** (room creation). Same pattern as project creation. Image preview of the room type, hairline `MarketingPanel`.
- **`/projects/[projectId]/rooms/[roomId]/brief/style`** (style picker). Image-led card grid pattern from the landing's style library — exact same component shape, just with the full 6-style taxonomy (Modern, Contemporary, Scandinavian, Industrial, Traditional, Bohemian) instead of the landing's 4.
- **`/projects/[projectId]/rooms/[roomId]/brief/inspiration`** (inspiration picker). Same image-led card grid.
- **`/projects/[projectId]/rooms/[roomId]/presentation`** (client presentation/export). This is the client-facing artifact — adopt the landing's marketing aesthetic in full. `SectionEyebrow` + `DecorativeRule` + `MarketingDisplay` headings; `MarketingPanel` for room summary cards; floating overlay treatment on the hero room image; retailer-grouped shopping list with the trust-bar treatment.

### Medium-confidence (consider, but don't force)

- **`/projects/[projectId]/rooms/[roomId]/photos`** (photo upload). The dropzone could borrow the floating overlay treatment from the landing hero. `SectionEyebrow` + display heading helps anchor the screen.
- **`/projects/[projectId]/rooms/[roomId]/concepts`** (concept gallery). Floating overlay panels on the selected concept image (Before/After style). `DecorativeRule` between concept variants. Don't introduce the marketing display tier here unless empty state.
- **Account / settings / sign-out** screens if/when they exist.

### No-go zones (do NOT redesign)

- **`/projects/[projectId]/rooms/[roomId]/product-matching`** (sourcing UI) — operational, data-dense. Keep current treatment.
- **`/projects/[projectId]/rooms/[roomId]/shopping-list`** (unlocked shopping list) — operational, data-dense. Keep current treatment.
- **`/projects/[projectId]/rooms/[roomId]/brief/details`** and **`/brief/questions/[index]`** (form-heavy brief steps) — the marketing display tier is wrong here. Use existing `display-s` / `display-m`. `SectionEyebrow` may be fine; full marketing aesthetic is not. Sam called out forms as a pain point — that's a separate workstream.
- **App header / nav chrome** — operational. Keep the `Ri / Ritzy Studio` wordmark + caption-uppercase nav as today.
- **Any payment / Stripe-touching surface** — operational; not in scope for this alignment work without explicit user direction.

### Working conventions

- **One screen per PR.** Sam reviews UI hands-on, screen by screen. (See user-collab memory.)
- Every PR description must include a `## NOT in this PR` section listing deferred items.
- Branch + PR work routes through the **Chief Architect** (paste your readiness message in chat; Sam relays).
- Working branches: `polish/<descriptive-name>` for visual changes, `brand/<descriptive-name>` for spec changes.
- Stage files by name — never `git add .` — the working tree carries untracked scratch.
- Lint + typecheck via workspace-local binaries: `apps/web/node_modules/.bin/tsc -p tsconfig.json --noEmit` and `apps/web/node_modules/.bin/eslint .` Both must be clean before pushing.
- Commit trailer required: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- Open PRs with `gh pr create --base codex/v2-commercial-testing` unless promoting straight to `main` (which requires Chief Architect routing).

---

## Brochure-site alignment strategy

Different repo. Same design language end-to-end. The brochure is image-heavy and brochure-shaped (multiple pages, lots of photography), so it can adopt the landing's voice wholesale rather than selectively.

### Tokens to bring over

Copy the `:root` block, the `@theme inline` block, and the `[data-reveal]` CSS from `apps/web/app/globals.css` of this repo at commit `bf12909` verbatim. Includes the §17.3 marketing tokens.

### Components to bring over

Recommended: recreate the five components verbatim in the brochure repo. They are ~20–60 lines each with no external dependencies beyond a tiny `cx` helper.

Files to copy from `packages/ui/src/`:
- `marketing-display.tsx`
- `marketing-panel.tsx`
- `reveal.tsx`
- `use-reveal-on-scroll.tsx`
- `utils.ts` (contains `cx`)

A later option: publish `packages/ui` as a private npm package and consume it from the brochure. Heavier setup; defer until the brochure has grown.

### Fonts

Load via `next/font/google` (or equivalent if the brochure isn't Next.js):
- Cormorant Garamond — weights `300`, `400`, `500`; styles `normal` and `italic`.
- DM Sans — weights `400`, `500`, `600`.

Variable bindings (used by token CSS): `--font-cormorant`, `--font-dm-sans`.

See `apps/web/app/layout.tsx` for the exact `next/font/google` setup that drives the token-level font fallbacks.

### Page composition for a brochure

Each page follows the landing's section rhythm with substitutions appropriate to the page type:

- **Home (/)** — Hero (display H1 + photographic image with floating overlays) → philosophy section → showcase grid (instead of style library, show portfolio thumbnails) → process section (instead of "how it works", show service stages) → CTA → footer.
- **About (/about)** — Hero with founder portrait → philosophy/story section → team grid (`MarketingPanel` cards with portraits) → CTA → footer.
- **Services (/services)** — Hero → service cards (`MarketingPanel` grid) → process section → CTA → footer.
- **Portfolio (/portfolio)** — Hero → image-led card grid → individual project detail pages → CTA → footer.
- **Project detail (/portfolio/[slug])** — Hero photo full-bleed → photo gallery (full-width, hairline borders) → philosophy quote → spec table → next-project arrow.
- **Contact (/contact)** — Hero → form section in `MarketingPanel` → location info → footer.

### Image treatment

- All images: hairline border, no rounded corners (or 4px max — use `rounded-card`).
- Gradients overlaid for legibility when text sits on imagery (see hero overlay in `apps/web/app/login/sections/hero.tsx`).
- Floating overlay panels on hero imagery use `MarketingPanel elevation="float"`.
- Aspect ratios: 5:6 for portraits, 4:5 or 5:2 for room photography, 1:1 for project tile thumbnails.

### Motion discipline

Use `Reveal` for first-paint fade-up only. **No** scroll-tied animations, parallax, marquees, or scroll-jacking. Always respect `prefers-reduced-motion: reduce` (the shipped CSS already does this).

### Brand voice (from spec §1 + §2)

- Editorial. Quiet. Precise. Architectural. Considered. Reverent. Truthful.
- Must NOT feel like: consumer AI toy (no glow orbs / sparkle copy), SaaS dashboard, retail site (no carousels / urgency banners), generic Figma template.
- Acceptable neighborhood: Architectural Digest, Aesop, Apartamento, Cereal, Hermès digital.

### Brochure-website voice tweaks (vs the app)

- Permitted to lean MORE photographic. The brochure is a portfolio piece.
- Permitted to use longer body copy than the app — readers expect to spend time.
- Still no fabricated metrics. No fake testimonials. No invented user counts. If you don't have real numbers, omit them or use the labelled placeholder pattern. The landing follows this rule (gate 56 of the hallmark slop test).

---

## Reference materials

- **Brand spec:** `docs/Vision/05_Brand_and_Design_System.md`. §17.3 amendment is the marketing-surface opt-in.
- **Landing-page source:** `apps/web/app/login/page.tsx` + every file in `apps/web/app/login/sections/`. As of merge commit `bf12909`.
- **UI primitives:** `packages/ui/src/marketing-display.tsx`, `marketing-panel.tsx`, `reveal.tsx`, `use-reveal-on-scroll.tsx`, `utils.ts`.
- **Tokens:** `apps/web/app/globals.css` (full `:root` block including §17.3 additions).
- **Production deploy:** check Vercel for the live `main` deploy. The marketing landing is at `/login`.

---

## Boundaries to honor across both efforts

- **Square corners on buttons. Always.** > 0px is forbidden.
- **Card radii capped** at `--rs-radius-2` (4px) on refined cards, `--rs-radius-3` (6px) on feature dark cards. > 8px is forbidden.
- **Hairlines as the default border treatment.**
- **One subtle elevation** (`--rs-shadow-2`). Marketing surfaces get one additional step (`--rs-shadow-marketing-float`); no more.
- **No Manrope, no Newsreader.** Cormorant Garamond display + DM Sans body, exclusively.
- **No purple gradients, glow orbs, sparkle icons, magic copy.**
- **No fabricated metrics. No fake testimonials. No invented user counts.**
- **Real photography or hand-built imagery.** No stock photo placeholders that pretend to be final assets. If a real image isn't yet available, use the structural-placeholder pattern (greyed block, "asset to confirm" caption).
- **One-screen-per-PR convention** on the app side. `NOT in this PR` section in every PR body.
- **Route branch / PR creation through the Chief Architect** on the app repo.

---

## Open questions deferred to Sam

Items to surface back to Sam when they come up, rather than guessing:

- Whether the AED 99 / AED 199 traction prices remain stable, or whether marketing copy should re-align to the AED 500 paywall once the data + marketing positions reconcile.
- Whether the brochure repo wants a separate visual identity from the studio app (e.g. a different accent for the brochure) or stays 1:1.
- Whether `Faten Ibrahim` (testimonial signature on the landing's final CTA) has additional voices Sam wants surfaced on the brochure portfolio detail pages.
- Whether the "upload photos, then ask to register" flow Sam mentioned changes the auth section's placement on the landing (currently lives in `apps/web/app/login/sections/access.tsx`).
