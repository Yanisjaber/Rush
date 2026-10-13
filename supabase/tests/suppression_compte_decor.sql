-- Décor LOCAL imitant la production : mêmes tables lourdes, mêmes clés étrangères SANS les nouveaux index,
-- mêmes déclencheurs. Les fonctions de recalcul sont chargées à part (copie exacte de la production).
\set ON_ERROR_STOP on
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date_local timestamp, tss integer, moving_time integer, elapsed_time integer,
  merged_into uuid references public.activities(id) on delete set null,
  streams_synced_at timestamptz
);
create index on public.activities (merged_into) where merged_into is not null;
create index on public.activities (user_id, start_date_local desc);
create table public.daily_metrics (
  user_id uuid not null references auth.users(id) on delete cascade,
  iso_date date not null, tss integer, ctl numeric, atl numeric, tsb numeric, duration_min integer, activity_count integer,
  main_activity_id uuid references public.activities(id) on delete set null,
  calculated_at timestamptz default now()
);
create unique index on public.daily_metrics (user_id, iso_date);
create table public.power_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade, duration_s integer,
  activity_id_alltime uuid references public.activities(id) on delete set null,
  activity_id_90d uuid references public.activities(id) on delete set null
);
create index on public.power_profile (user_id, duration_s);
create table public.hyrox_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null
);
create table public.strength_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete cascade
);
create index on public.strength_sets (activity_id);
