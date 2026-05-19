create or replace function public.prevent_unpaid_designer_extra_room()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  intended public.user_intended_mode;
  active_subscription boolean;
  existing_room_count integer;
begin
  select p.owner_user_id
  into owner_id
  from public.projects p
  where p.id = new.project_id;

  if owner_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 0));

  select up.intended_mode
  into intended
  from public.user_profiles up
  where up.user_id = owner_id;

  if intended is distinct from 'designer' and intended is distinct from 'both' then
    return new;
  end if;

  active_subscription := public.has_active_designer_subscription(owner_id);

  if active_subscription then
    return new;
  end if;

  select count(*)
  into existing_room_count
  from public.rooms r
  join public.projects p on p.id = r.project_id
  where p.owner_user_id = owner_id;

  if existing_room_count >= 1 then
    raise exception 'Designer free room limit reached'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists rooms_prevent_unpaid_designer_extra_room on public.rooms;
create trigger rooms_prevent_unpaid_designer_extra_room
before insert on public.rooms
for each row execute function public.prevent_unpaid_designer_extra_room();
