create type public.user_intended_mode as enum ('homeowner', 'designer', 'both', 'unknown');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled', 'expired', 'incomplete');
create type public.room_unlock_status as enum ('pending', 'active', 'refunded', 'expired', 'revoked');
create type public.entitlement_event_type as enum (
  'user_mode_set',
  'room_unlock_created',
  'room_unlock_activated',
  'room_unlock_refunded',
  'room_unlock_revoked',
  'subscription_created',
  'subscription_activated',
  'subscription_cancelled',
  'subscription_expired',
  'admin_adjustment'
);

create table public.user_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  display_name text,
  intended_mode public.user_intended_mode not null default 'unknown',
  onboarding_completed_at timestamptz,
  country text,
  currency_preference text not null default 'AED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.designer_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  business_name text,
  billing_customer_id text,
  subscription_status public.subscription_status not null default 'incomplete',
  plan_key text not null default 'designer_monthly_usd_99',
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  designer_account_id uuid references public.designer_accounts(id) on delete cascade,
  provider text not null,
  provider_customer_id text,
  provider_subscription_id text,
  plan_key text not null,
  status public.subscription_status not null default 'incomplete',
  amount_usd numeric(12, 2) not null default 99,
  billing_interval text not null default 'month',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);

create table public.room_unlocks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status public.room_unlock_status not null default 'pending',
  price_aed numeric(12, 2) not null default 100,
  billing_provider text,
  billing_checkout_id text,
  billing_payment_id text,
  unlocked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table public.entitlement_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  room_unlock_id uuid references public.room_unlocks(id) on delete set null,
  event_type public.entitlement_event_type not null,
  source text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index user_profiles_intended_mode_idx on public.user_profiles(intended_mode);
create index designer_accounts_owner_user_id_idx on public.designer_accounts(owner_user_id);
create index subscriptions_user_status_idx on public.subscriptions(user_id, status);
create index subscriptions_designer_account_id_idx on public.subscriptions(designer_account_id);
create index room_unlocks_room_user_status_idx on public.room_unlocks(room_id, user_id, status);
create index room_unlocks_user_status_idx on public.room_unlocks(user_id, status);
create index entitlement_events_user_created_idx on public.entitlement_events(user_id, created_at desc);
create index entitlement_events_room_created_idx on public.entitlement_events(room_id, created_at desc);

create trigger user_profiles_set_updated_at before update on public.user_profiles for each row execute function public.set_updated_at();
create trigger designer_accounts_set_updated_at before update on public.designer_accounts for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger room_unlocks_set_updated_at before update on public.room_unlocks for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (new.id, coalesce(new.email, ''), new.raw_user_meta_data ->> 'name')
  on conflict (id) do nothing;

  insert into public.user_profiles (user_id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'name')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

insert into public.user_profiles (user_id, display_name, intended_mode)
select id, name, 'designer'
from public.users
on conflict (user_id) do nothing;

create or replace function public.has_active_designer_subscription(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = has_active_designer_subscription.user_id
      and s.plan_key = 'designer_monthly_usd_99'
      and s.status in ('trialing', 'active')
      and (
        s.current_period_end is null
        or s.current_period_end > now()
      )
  );
$$;

create or replace function public.has_active_room_unlock(room_id uuid, user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.room_unlocks u
    where u.room_id = has_active_room_unlock.room_id
      and u.user_id = has_active_room_unlock.user_id
      and u.status = 'active'
      and (
        u.expires_at is null
        or u.expires_at > now()
      )
  );
$$;

create or replace function public.can_access_room_commerce(room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
  or (
    public.is_room_owner(room_id)
    and (
      public.has_active_room_unlock(room_id, auth.uid())
      or public.has_active_designer_subscription(auth.uid())
    )
  );
$$;

alter table public.user_profiles enable row level security;
alter table public.designer_accounts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.room_unlocks enable row level security;
alter table public.entitlement_events enable row level security;

create policy "users manage own v2 profile" on public.user_profiles
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users read own designer account" on public.designer_accounts
for select
using (owner_user_id = auth.uid());

create policy "users create own designer account" on public.designer_accounts
for insert
with check (owner_user_id = auth.uid());

create policy "users update own designer account" on public.designer_accounts
for update
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy "users read own subscriptions" on public.subscriptions
for select
using (user_id = auth.uid());

create policy "users read own room unlocks" on public.room_unlocks
for select
using (user_id = auth.uid() and public.is_room_owner(room_id));

create policy "users read own entitlement events" on public.entitlement_events
for select
using (user_id = auth.uid());

create policy "service role manages designer accounts" on public.designer_accounts
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages subscriptions" on public.subscriptions
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages room unlocks" on public.room_unlocks
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages entitlement events" on public.entitlement_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
