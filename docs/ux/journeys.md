# Journey Map

Five journeys cover the core loops. Step budgets are contracts: the built journey may not exceed them. Counts assume the target flows approved in `_handoffs/PRODUCT_PLAN.md` §1.

## J1. Homeowner first run: arrival to first direction

Persona: homeowner. Trigger: heard about Ritzy, has phone photos. Goal: a direction that is recognisably her room.
Step budgets (two legs, measured separately by the suite):
- Signup leg (`/login` arrival to authenticated): at most 5 required interactions (name, email, password, confirm link, sign-in).
- Design leg (authenticated first arrival to first direction): at most 8 required interactions and 8 navigation clicks. The current shipped design leg measures 10 interactions and 11 clicks; the combined start screen and name-only project form bring it inside budget.

1. `/login` -> "What is this and can I trust it?" -> creates account, confirms email, signs in (signup leg).
2. `/onboarding` (combined first-run start) -> "Which way am I designing, and what do I call this home?" -> picks Homeowner and names the home on one screen; the project is created for her (`/projects/new` remains for later projects).
3. `/rooms/new` -> "Which room?" -> picks Living Room, continues.
4. `/photos` -> "Did it get my room?" -> adds 2-3 photos, continues.
5. `/brief/style` -> "Does it understand the feel I want?" -> picks a style, writes one feeling sentence, continues.
6. `/brief/details` -> "What else does it need?" -> answers what she knows; measurements and plan are visibly optional; continues.
7. `/brief/questions/[i]` -> "Quick clarifications" -> answers or skips at most 3, last answer starts generation.

Terminal: `/concepts` shows a direction whose architecture is her room, with assumptions listed, within the staged progress promise.

## J2. Homeowner money path: approved direction to trusted purchase

Persona: homeowner with an approved concept. Trigger: "I want this room." Goal: pay in AED and buy with confidence.
Step budget: 6 steps.

1. `/concepts` -> "Is this the room I want?" -> Proceed to sourcing.
2. `/spec` -> "Is this list what I actually approved?" -> reviews objects, fixes quantity if needed, confirms.
3. `/product-matching` -> "Do the pieces belong to my design?" -> swaps anything off, opens shopping list.
4. `/shopping-list` (pre-pay) -> "What will this cost me?" -> sees category labels + prices + freshness, chooses options, generates final render.
5. `/presentation` -> "Is this really my room, finished?" -> reviews hero + planned views, unlocks (plan checkout or Room Pass, AED).
6. `/shopping-list` (post-pay) -> "Where do I buy each piece?" -> opens retailer links, downloads PDF.

Terminal: paid list with per-item "checked last night" freshness; every listed piece appears in the render; no dollar sign anywhere.

## J3. Designer client path: client room to subscription

Persona: designer with a client brief and a whole-floor plan. Trigger: new client. Goal: client-ready room without workarounds.
Step budget: 10 steps to second-room paywall.

1. `/onboarding` -> "Which context?" -> Designer.
2. `/projects/new` -> "Whose home?" -> names project and client, continues.
3. `/rooms/new` -> room type -> continues.
4. `/photos` -> client photos -> continues.
5. `/brief/style` -> direction -> continues.
6. `/brief/details` -> uploads the WHOLE floor plan; the app identifies candidate rooms; she confirms the right one; extracted measurements appear editable; continues.
7. `/brief/questions/[i]` -> professional questions (no bespoke) -> generation.
8. `/concepts` -> reviews with client language, revises freely, approves.
9. `/spec` -> `/product-matching` -> `/shopping-list` -> `/presentation` -> full free room, end to end.
10. `/rooms/new` (second room) -> "Why pay?" -> gate states plainly what the first room already proved; Studio plan checkout in AED.

Terminal: active Studio subscription with credits; second client room open; mode switch visible in the header thereafter.

## J4. Revision loop: change one thing, keep the rest

Persona: either. Trigger: "keep the sofa, change the coffee table." Goal: exactly that.
Step budget: 3 steps per iteration, unlimited iterations within credits.

1. `/concepts` -> "How do I say what to change?" -> writes the critique in her own words, generates revision.
2. `/concepts` (new version) -> "Did it change only that?" -> compares against previous version (kept as quiet history); diff QA note states what changed.
3. Accept, or iterate again; earlier versions restorable.

Terminal: a version where the asked change happened and nothing else moved; the critique is saved on the version record.

## J5. Recovery: generation fails or the catalog cannot deliver

Persona: either. Trigger: a provider failure or an unsourceable role. Goal: never a dead end, never silent loss.
Step budget: 2 steps per recovery.

1. `/concepts` on failure -> "What happened, what now?" -> failed state per §12.1 (no simultaneous progress shimmer), one silent auto-retry already attempted, Retry visible; brief and photos intact and stated so.
2. `/product-matching` with missing roles -> "What could it not find?" -> missing-role rows visible with why and what-to-do (never hidden); list totals reflect only sourced pieces; render proceeds without the missing role and says so.

Terminal: the user always knows what failed, what was kept, and the single next action; no typed input is ever lost on any rejection (details form included).
