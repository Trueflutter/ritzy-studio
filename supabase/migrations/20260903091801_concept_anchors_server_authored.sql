-- M3d (security review, S3b): concept_anchors is written by the server only.
--
-- The table shipped with a "for all" owner policy, which is right for the rows
-- a shopper owns and wrong for a record of what the SERVER built a render
-- from. Inside their own room, an authenticated writer could POST an anchor row
-- naming any catalogue product and, on the next sourcing run, that product
-- would skip the visual pass, skip the spec role's size and capacity contracts
-- (an anchor is admitted on category alone, because the render is supposed to
-- be evidence enough), be judged at the anchor bar rather than the higher one,
-- and land on the list saying "This piece is in your design: it was chosen
-- first and the room was drawn around it". Deleting the rows had the mirror
-- effect: sourcing re-decided the anchored roles and the list drifted from the
-- render, which is the one defect this slice exists to remove.
--
-- Nothing about that is cross-tenant; the round-1 trigger and the ownership
-- policy already close that path. It is an integrity problem: a claim the app
-- makes by construction should not be one a client can author.
--
-- Owners keep the read, because the app reads these rows through the user's
-- client and relies on the policy to scope them. Writes are service_role only,
-- which bypasses RLS, so no write policy is needed for the app itself.
--
-- Additive: one policy replaced by a narrower one. No data rewritten.

drop policy if exists "room owners manage concept anchors" on public.concept_anchors;

create policy "room owners read concept anchors" on public.concept_anchors
  for select using (public.is_room_owner(room_id));
