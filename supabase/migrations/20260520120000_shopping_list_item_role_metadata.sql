-- PR B: shopping_list_items become a pool of ranked options per room role.
-- `status` marks which option is the chosen one; the `role_*` columns carry
-- the role each option fills (sourced from sourceProductsFromConcept.needs[]).
alter table public.shopping_list_items
  add column status text not null default 'option'
    check (status in ('option', 'selected', 'rejected')),
  add column role_label text not null default '',
  add column role_visual_brief text,
  add column role_priority text not null default 'supporting'
    check (role_priority in ('required', 'supporting')),
  add column role_quantity integer not null default 1 check (role_quantity > 0),
  add column option_rank integer not null default 0;

-- Existing lists were a single composed set — every row was the chosen item.
-- Backfill so they still render: each row stays selected and becomes its own
-- role's sole option, with role metadata derived from its category.
update public.shopping_list_items
set
  status = 'selected',
  role_label = replace(category, '_', ' '),
  role_quantity = quantity,
  option_rank = sort_order;

create index shopping_list_items_status_idx
  on public.shopping_list_items (shopping_list_id, status);
