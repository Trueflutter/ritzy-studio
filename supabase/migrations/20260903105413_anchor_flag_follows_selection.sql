-- M3e (review round 5): the anchor flag follows the selection, not just the
-- product.
--
-- The earlier invariant cleared is_anchor when a row's product_id changed. It
-- did not fire on the other way a row stops being the piece in the design:
-- selectShoppingItem sets status to 'option' on the previously chosen row
-- without touching its product, so an anchored row that the shopper deselected
-- kept saying it was in the render while no longer being the room's choice.
--
-- Also worth recording plainly: this column is display metadata, not an
-- authority. shopping_list_items is owner-writable and the app writes these
-- rows through the user's client, so a client can set the flag by hand. The
-- authoritative record of what a render was built from is concept_anchors,
-- which is server-written, and that is what the design gate reads. An earlier
-- comment in 20260903083042 claimed the gate read this flag; it does not, and
-- the gate was changed in the same review round so that it cannot.
--
-- Additive: the trigger function is replaced in place.

create or replace function public.clear_anchor_on_product_change()
returns trigger
language plpgsql
as $$
begin
  if new.product_id is distinct from old.product_id or new.status is distinct from 'selected' then
    new.is_anchor := false;
  end if;
  return new;
end;
$$;
