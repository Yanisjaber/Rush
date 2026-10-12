-- Carnet de force (exercices perso, programmes, séries) et Hyrox (tests course par course, objectif) pour la v2.
-- Relançable sans risque. À appliquer à la main : supabase db query --linked -f supabase/migrations/2026-10-13_force_hyrox.sql
--
-- Sécurité :
--   - RLS activée sur chaque table : chacun ne lit et n'écrit que ses propres lignes (auth.uid() = user_id).
--   - Aucun accès anonyme (revoke sur public et anon).
--   - Tailles bornées (texte, JSON, nombres) : pas de stockage détourné.
--   - Le contenu n'est jamais exécuté : le front l'affiche en texte (Svelte échappe le HTML).
--
-- Les séries sont rattachées à une séance réalisée (table activities) : si la séance est supprimée, ses séries le sont aussi.

-- 1) Exercices ajoutés par l'utilisateur (la bibliothèque de base est dans le code de l'app) ---------------------------------
create table if not exists public.strength_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  muscle_group text not null check (muscle_group in ('pectoraux', 'dos', 'jambes', 'epaules', 'bras', 'tronc')),
  created_at timestamptz not null default now()
);
create index if not exists strength_exercises_user_idx on public.strength_exercises (user_id);

-- 2) Programmes (séances types : PUSH, PULL, LEGS…) --------------------------------------------------------------------------
-- exercises : [{ key, name, group, sets, reps, weight }] (plafonné à 16 Ko)
create table if not exists public.strength_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  exercises jsonb not null default '[]'::jsonb,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strength_programs_taille check (pg_column_size(exercises) < 16384)
);
create index if not exists strength_programs_user_idx on public.strength_programs (user_id);

-- 3) Séries réalisées ---------------------------------------------------------------------------------------------------------
create table if not exists public.strength_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  date date not null,
  exercise_key text not null check (char_length(exercise_key) between 1 and 80),
  exercise_name text not null check (char_length(exercise_name) between 1 and 80),
  muscle_group text not null check (muscle_group in ('pectoraux', 'dos', 'jambes', 'epaules', 'bras', 'tronc')),
  position smallint not null default 0 check (position between 0 and 99),
  set_no smallint not null default 1 check (set_no between 1 and 60),
  reps smallint not null check (reps between 0 and 1000),
  weight_kg numeric(6, 1) not null default 0 check (weight_kg between 0 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists strength_sets_user_date_idx on public.strength_sets (user_id, date desc);
create index if not exists strength_sets_activity_idx on public.strength_sets (activity_id);

-- 4) Hyrox : un test ou une course = 16 segments (8 runs d'1 km + 8 stations), en secondes -------------------------------
-- segments : [secondes × 16] dans l'ordre run 1, SkiErg, run 2, Sled Push, … run 8, Wall Balls (plafonné)
create table if not exists public.hyrox_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  label text not null default 'Test' check (char_length(label) between 1 and 80),
  kind text not null default 'test' check (kind in ('test', 'course')),
  segments jsonb not null,
  total_s integer not null check (total_s between 0 and 36000),
  source text not null default 'manuel' check (source in ('manuel', 'strava', 'garmin')),
  activity_id uuid references public.activities(id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  constraint hyrox_tests_segments check (jsonb_typeof(segments) = 'array' and jsonb_array_length(segments) = 16 and pg_column_size(segments) < 2048)
);
create index if not exists hyrox_tests_user_date_idx on public.hyrox_tests (user_id, date desc);

-- 5) Hyrox : objectif de temps (une ligne par utilisateur), total et, si voulu, temps visé par segment ----------------------
create table if not exists public.hyrox_objectif (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_s integer not null check (total_s between 600 and 36000),
  segments jsonb check (segments is null or (jsonb_typeof(segments) = 'array' and jsonb_array_length(segments) = 16 and pg_column_size(segments) < 2048)),
  updated_at timestamptz not null default now()
);

-- RLS : même schéma pour les cinq tables ---------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['strength_exercises', 'strength_programs', 'strength_sets', 'hyrox_tests', 'hyrox_objectif'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)', t || '_delete_own', t);
    execute format('revoke all on public.%I from public, anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
