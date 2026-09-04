-- M3f (external review): the claim that a render kept an anchor is recorded
-- where only the server can write it.
--
-- Until now the claim lived on shopping_list_items.is_anchor and on the row
-- being status='selected'. That table carries a "for all" policy to the list's
-- owner, so a client could PATCH either one and assert, without any design
-- check having run, that a piece is in a design it is not in. The critique
-- harness read the same selected state to decide whether the app had claimed an
-- anchor, so the system being gated could move its own gate.
--
-- concept_anchors is already server-written and owner-readable. The verdict
-- belongs on it: sourcing writes verified_similarity after the independent
-- design check confirms the render kept the piece, and nothing else can.
--
-- Additive: two nullable columns.

alter table public.concept_anchors
  add column verified_similarity numeric,
  add column verified_at timestamptz;

comment on column public.concept_anchors.verified_similarity is
  'The independent design check''s score for whether the render kept this anchor. Written by the server after the check; null means not confirmed. This, not shopping_list_items.is_anchor, is the authority for "this piece is in your design".';
