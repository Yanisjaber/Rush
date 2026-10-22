-- Hyrox : le détail d'un entraînement, tour par tour (un « effort » = un tour de montre étiqueté).
-- Relançable sans risque. À appliquer à la main : supabase db query --linked -f supabase/migrations/2026-10-22_hyrox_efforts.sql
--
-- Pourquoi : `hyrox_tests` ne garde que les tests complets (16 segments). Un entraînement Hyrox ne leur ressemble presque jamais :
-- séances de stations seules, demi-simulations, exercices libres. L'utilisateur laps sa montre (Garmin → Strava), puis dit ce que
-- représente chaque tour : un run, une des 8 stations, un exercice libre ou un repos.
--
-- Une ligne = un tour :
--   kind        : 'run', une des 8 stations (ski, push, pull, bbj, row, farm, lunge, wall), 'free' (exercice libre, `name` obligatoire) ou 'rest'
--   position    : l'ordre du tour dans la séance (1 à 100)
--   simulation  : le tour fait partie d'une simulation (run puis station enchaînés), par opposition à un run ou une station travaillés seuls
--   distance_m, weight_kg, reps : facultatifs (la charge d'un sled, les répétitions de wall balls…)
--
-- Sécurité :
--   - RLS activée : chacun ne lit et n'écrit que ses propres lignes (auth.uid() = user_id). Aucun accès anonyme.
--   - Le lien vers la séance (`activity_id`) doit viser une séance DE L'UTILISATEUR : la politique le vérifie à l'écriture
--     (on ne peut pas rattacher ses lignes à la séance d'un autre, ce que l'audit du 2026-10-13 notait pour hyrox_tests).
--   - Tous les nombres et textes sont bornés. Le contenu n'est jamais exécuté : l'app l'affiche en texte.
--   - Les lignes disparaissent avec la séance (on delete cascade) et avec le compte.

create table if not exists public.hyrox_efforts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete cascade,
  date date not null,
  position smallint not null check (position between 1 and 100),
  kind text not null check (kind in ('run', 'ski', 'push', 'pull', 'bbj', 'row', 'farm', 'lunge', 'wall', 'free', 'rest')),
  name text check (name is null or char_length(name) between 1 and 60),
  duration_s integer not null check (duration_s between 1 and 36000),
  distance_m integer check (distance_m is null or distance_m between 0 and 100000),
  weight_kg numeric(6, 1) check (weight_kg is null or weight_kg between 0 and 1000),
  reps smallint check (reps is null or reps between 0 and 10000),
  simulation boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  constraint hyrox_efforts_free_name check (kind <> 'free' or name is not null)
);

-- Un tour par position dans une séance ; cet index sert aussi à la suppression en cascade des tours d'une séance
create unique index if not exists hyrox_efforts_activity_position_idx on public.hyrox_efforts (activity_id, position) where activity_id is not null;
create index if not exists hyrox_efforts_user_date_idx on public.hyrox_efforts (user_id, date desc);

alter table public.hyrox_efforts enable row level security;

drop policy if exists hyrox_efforts_select_own on public.hyrox_efforts;
create policy hyrox_efforts_select_own on public.hyrox_efforts for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists hyrox_efforts_insert_own on public.hyrox_efforts;
create policy hyrox_efforts_insert_own on public.hyrox_efforts for insert to authenticated
  with check (
    auth.uid() = user_id
    and (activity_id is null or exists (select 1 from public.activities a where a.id = activity_id and a.user_id = auth.uid()))
  );

drop policy if exists hyrox_efforts_update_own on public.hyrox_efforts;
create policy hyrox_efforts_update_own on public.hyrox_efforts for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (activity_id is null or exists (select 1 from public.activities a where a.id = activity_id and a.user_id = auth.uid()))
  );

drop policy if exists hyrox_efforts_delete_own on public.hyrox_efforts;
create policy hyrox_efforts_delete_own on public.hyrox_efforts for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.hyrox_efforts from public, anon;
grant select, insert, update, delete on public.hyrox_efforts to authenticated;
