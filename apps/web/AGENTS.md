<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Share components — don't duplicate them

Before building a UI element, check whether one already exists. Reuse beats re-creation.

- Shared, presentational components live in `packages/ui` (exported from `packages/ui/src/index.ts`) — e.g. `Button`, `Card`, `ImageDropzone`. If two screens need the same element, put it there and import it; do not copy markup between routes.
- When you find yourself copying a block of JSX, an SVG icon, or a helper function (`slugFileName`, `readImageSize`, etc.) into a second file, stop and extract it instead. Pure helpers go in `apps/web/lib`; presentational components go in `packages/ui`.
- Keep shared components presentational. Data fetching, Supabase calls, and server actions stay in the consuming screen — the shared component takes props and callbacks.
- Diverging copy or behaviour is a prop, not a fork. Add a prop to the shared component rather than cloning it.

Duplicated UI is how this codebase bloats and drifts out of visual consistency. One source per component.
