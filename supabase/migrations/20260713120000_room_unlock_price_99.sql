-- Beta pricing (2026-07-13): room unlock drops from AED 500 to AED 99. The checkout action
-- writes price_aed explicitly on every unlock; this default only covers rows created outside
-- that path, kept in sync for consistency.
alter table public.room_unlocks
  alter column price_aed set default 99;
