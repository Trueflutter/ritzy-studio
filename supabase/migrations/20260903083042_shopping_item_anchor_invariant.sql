-- M3c (security review, S3b): the anchor claim cannot outlive the piece.
--
-- shopping_list_items.is_anchor says "the render was built from photographs of
-- this product". The swap path updates product_id in place, so without this the
-- claim survived the one mutation that falsifies it: a shopper swapping an
-- anchored sofa for a cheaper one left a row asserting the new sofa was in a
-- render it never appeared in.
--
-- What this flag is NOT: an authority. shopping_list_items carries a "for all"
-- policy to the list's owner and the app writes these rows through the user's
-- client, so the flag is display metadata a client can also set, and this
-- trigger removes the one way it could go stale without anyone touching it. The
-- authoritative record of what a render was built from is concept_anchors,
-- which is server-written and owner-readable, and that is what the design gate
-- reads.
--
-- Additive: one trigger, no data rewritten.

create or replace function public.clear_anchor_on_product_change()
returns trigger
language plpgsql
as $$
begin
  if new.product_id is distinct from old.product_id then
    new.is_anchor := false;
  end if;
  return new;
end;
$$;

create trigger shopping_list_items_anchor_invariant
  before update on public.shopping_list_items
  for each row execute function public.clear_anchor_on_product_change();
