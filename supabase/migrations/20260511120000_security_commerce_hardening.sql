create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  stripe_created_at timestamptz,
  processing_started_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

alter table public.stripe_webhook_events add column if not exists processing_started_at timestamptz not null default now();
alter table public.stripe_webhook_events alter column processed_at drop not null;
alter table public.stripe_webhook_events alter column processed_at drop default;
alter table public.stripe_webhook_events add column if not exists processing_error text;

alter table public.stripe_webhook_events enable row level security;

drop policy if exists "service role manages stripe webhook events" on public.stripe_webhook_events;
create policy "service role manages stripe webhook events"
on public.stripe_webhook_events for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

alter table public.ai_jobs add column if not exists user_id uuid references public.users(id) on delete cascade;
alter table public.ai_jobs add column if not exists room_id uuid references public.rooms(id) on delete cascade;

create index if not exists ai_jobs_user_created_idx on public.ai_jobs(user_id, created_at desc);
create index if not exists ai_jobs_room_created_idx on public.ai_jobs(room_id, created_at desc);

drop policy if exists "authenticated users read own ai jobs" on public.ai_jobs;
create policy "authenticated users read own ai jobs"
on public.ai_jobs for select to authenticated
using (
  user_id = auth.uid()
  or (room_id is not null and public.is_room_owner(room_id))
);

create or replace function public.prevent_user_role_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and new.role is distinct from old.role then
    raise exception 'Only service role can update user role';
  end if;

  return new;
end;
$$;

drop trigger if exists users_prevent_role_self_update on public.users;
create trigger users_prevent_role_self_update
before update on public.users
for each row execute function public.prevent_user_role_self_update();

create or replace function public.prevent_designer_billing_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and (
    new.billing_customer_id is distinct from old.billing_customer_id
    or new.subscription_status is distinct from old.subscription_status
    or new.plan_key is distinct from old.plan_key
    or new.current_period_start is distinct from old.current_period_start
    or new.current_period_end is distinct from old.current_period_end
    or new.trial_ends_at is distinct from old.trial_ends_at
    or new.cancel_at is distinct from old.cancel_at
  ) then
    raise exception 'Only service role can update designer billing fields';
  end if;

  return new;
end;
$$;

drop trigger if exists designer_accounts_prevent_billing_self_update on public.designer_accounts;
create trigger designer_accounts_prevent_billing_self_update
before update on public.designer_accounts
for each row execute function public.prevent_designer_billing_self_update();

revoke select (canonical_url) on public.products from anon, authenticated;

revoke execute on function public.has_active_designer_subscription(uuid) from public, anon, authenticated;
revoke execute on function public.has_active_room_unlock(uuid, uuid) from public, anon, authenticated;
grant execute on function public.can_access_room_commerce(uuid) to authenticated;

drop policy if exists "users read own generated renders" on storage.objects;

drop policy if exists "users read own room assets" on storage.objects;
drop policy if exists "users upload own room assets" on storage.objects;
drop policy if exists "users update own room assets" on storage.objects;
drop policy if exists "users delete own room assets" on storage.objects;

create or replace function public.storage_object_room_id(object_name text)
returns uuid
language plpgsql
stable
as $$
declare
  maybe_room_id text;
begin
  maybe_room_id := (storage.foldername(object_name))[2];
  return maybe_room_id::uuid;
exception
  when others then
    return null;
end;
$$;

create policy "users read own room assets"
on storage.objects for select to authenticated
using (
  bucket_id = 'room-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_room_owner(public.storage_object_room_id(name))
);

create policy "users upload own room assets"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'room-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_room_owner(public.storage_object_room_id(name))
);

create policy "users update own room assets"
on storage.objects for update to authenticated
using (
  bucket_id = 'room-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_room_owner(public.storage_object_room_id(name))
)
with check (
  bucket_id = 'room-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_room_owner(public.storage_object_room_id(name))
);

create policy "users delete own room assets"
on storage.objects for delete to authenticated
using (
  bucket_id = 'room-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_room_owner(public.storage_object_room_id(name))
);
