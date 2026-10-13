-- ============================================================
-- SCHÉMA DE LA BASE À L'ÉPOQUE DE LA v1 (état du dépôt au commit 16859a3, 12 octobre 2026)
-- = supabase/schema.sql de l'époque, puis les 53 migrations rejouées dans l'ordre (le « journal officiel » du schéma).
-- Ce n'est PAS un export de la base : AUCUNE DONNÉE (le dépôt est public, les données sont celles de vrais utilisateurs).
-- Les données se récupèrent depuis les sauvegardes de Supabase. Pour rejouer : base vierge Supabase, puis ce fichier.
-- ============================================================

-- ########## supabase/schema.sql ##########
-- ============================================================
-- Coach IA — Schema Supabase
-- À exécuter dans Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================
-- Convention :
--   - Chaque table a une colonne user_id qui référence auth.users
--   - RLS (Row Level Security) activé sur toutes les tables
--   - Politique : un user ne peut lire/écrire que SES propres lignes
--   - updated_at est mis à jour automatiquement via trigger
-- ============================================================

-- ============================================================
-- 1. PROFIL UTILISATEUR (préférences générales)
-- ============================================================
create table if not exists public.user_profiles (
  user_id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 2. COMPÉTITIONS
-- ============================================================
create table if not exists public.competitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  client_id text, -- ID local (pour migration et tracking)
  name text not null,
  date date not null,
  sport text,
  priority text check (priority in ('principal', 'secondaire', 'A', 'B', 'C') or priority is null),
  km numeric,
  d_plus integer,
  d_minus integer,
  target text, -- temps cible "5h30"
  laps integer,
  notes text,
  gpx_name text,
  gpx_content text,
  stages jsonb, -- [{name, date, time, sport, type, km, dplus, target, laps, notes, gpxName, gpxContent}, ...]
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_competitions_user_date on public.competitions(user_id, date);

-- ============================================================
-- 3. ENTRAÎNEMENTS (prévus + réalisés)
-- ============================================================
create table if not exists public.trainings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  client_id text,
  name text not null,
  date date not null,
  sport text,
  type text, -- endurance / tempo / seuil / vo2 / recup / rest / force / mobilite / natation
  duration integer, -- en minutes
  tss integer,
  notes text,
  mode text not null check (mode in ('prevu', 'realise')),
  structure jsonb, -- [{dur, target, reps}, ...]
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_trainings_user_date_mode on public.trainings(user_id, date, mode);

-- ============================================================
-- 4. WELLNESS (saisies quotidiennes : poids, mood, fatigue, etc.)
-- ============================================================
create table if not exists public.wellness_days (
  user_id uuid references auth.users(id) on delete cascade not null,
  iso_date date not null,
  weight numeric,
  mood integer check (mood between 1 and 5),
  fatigue integer check (fatigue between 1 and 5),
  soreness integer check (soreness between 1 and 5),
  motivation integer check (motivation between 1 and 5),
  notes text,
  updated_at timestamptz default now(),
  primary key (user_id, iso_date)
);

-- ============================================================
-- 5. NOTES PAR JOUR
-- ============================================================
create table if not exists public.day_notes (
  user_id uuid references auth.users(id) on delete cascade not null,
  iso_date date not null,
  note text not null,
  updated_at timestamptz default now(),
  primary key (user_id, iso_date)
);

-- ============================================================
-- 6. PHASES D'ENTRAÎNEMENT (cycles)
-- ============================================================
create table if not exists public.training_phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  client_id text,
  phase text not null check (phase in ('base', 'build', 'peak', 'taper', 'recup')),
  from_date date not null,
  to_date date not null,
  name text,
  created_at timestamptz default now()
);
create index if not exists idx_phases_user_range on public.training_phases(user_id, from_date, to_date);

-- ============================================================
-- 7. OBJECTIFS ANNUELS
-- ============================================================
create table if not exists public.yearly_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  client_id text,
  year integer not null,
  sport text not null,
  template text not null,
  target numeric not null,
  current_manual numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_goals_user_year on public.yearly_goals(user_id, year);

-- ============================================================
-- 8. SNAPSHOTS DU PLAN PRÉVU (pour archive historique)
-- ============================================================
create table if not exists public.plan_snapshots (
  user_id uuid references auth.users(id) on delete cascade not null,
  iso_date date not null,
  proposal jsonb not null,
  updated_at timestamptz default now(),
  primary key (user_id, iso_date)
);

-- ============================================================
-- 9. JOURS FORCÉS EN REPOS (override du template AI)
-- ============================================================
create table if not exists public.template_rest_days (
  user_id uuid references auth.users(id) on delete cascade not null,
  iso_date date not null,
  primary key (user_id, iso_date)
);

-- ============================================================
-- 10. ACTIVITÉS STRAVA MASQUÉES (suppression locale)
-- ============================================================
create table if not exists public.strava_ignored (
  user_id uuid references auth.users(id) on delete cascade not null,
  activity_id text not null,
  primary key (user_id, activity_id)
);

-- ============================================================
-- 11. PRÉFÉRENCES GÉNÉRIQUES (clé / valeur JSON)
-- ============================================================
create table if not exists public.preferences (
  user_id uuid references auth.users(id) on delete cascade not null,
  key text not null,
  value jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, key)
);

-- ============================================================
-- TRIGGER : updated_at auto sur les tables qui l'ont
-- ============================================================
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'user_profiles', 'competitions', 'trainings',
      'wellness_days', 'day_notes', 'yearly_goals',
      'plan_snapshots', 'preferences'
    ])
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end$$;

-- ============================================================
-- ROW LEVEL SECURITY : chaque user ne voit que SES données
-- ============================================================
alter table public.user_profiles enable row level security;
alter table public.competitions enable row level security;
alter table public.trainings enable row level security;
alter table public.wellness_days enable row level security;
alter table public.day_notes enable row level security;
alter table public.training_phases enable row level security;
alter table public.yearly_goals enable row level security;
alter table public.plan_snapshots enable row level security;
alter table public.template_rest_days enable row level security;
alter table public.strava_ignored enable row level security;
alter table public.preferences enable row level security;

-- Politique générique : user_id = auth.uid()
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'user_profiles', 'competitions', 'trainings',
      'wellness_days', 'day_notes', 'training_phases',
      'yearly_goals', 'plan_snapshots', 'template_rest_days',
      'strava_ignored', 'preferences'
    ])
  loop
    execute format('drop policy if exists "Users can manage their own %I" on public.%I', t, t);
    execute format(
      'create policy "Users can manage their own %I" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t, t
    );
  end loop;
end$$;

-- ============================================================
-- TRIGGER : créer automatiquement un user_profiles à l'inscription
-- ============================================================
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.user_profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- FIN
-- ============================================================
-- Pour vérifier que tout est OK :
--   select tablename from pg_tables where schemaname = 'public';
-- Doit lister les 11 tables ci-dessus.

-- ########## 2026-06-01_activity_overrides.sql ##########
-- ============================================================
-- Coach IA — Calque de modifications d'activités
-- Les activités Strava sont en lecture seule (re-synchronisées). Ce calque stocke
-- les modifs manuelles (nom/type/sport/durée/distance/TSS/notes) et les masquages
-- de métriques (puissance/cardio/distance) par activité, réappliqués après synchro.
-- À exécuter dans Supabase → SQL Editor. Idempotent.
-- ============================================================

create table if not exists public.activity_overrides (
  user_id uuid references auth.users(id) on delete cascade not null,
  activity_id text not null,          -- strava_id de l'activité
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, activity_id)
);

-- updated_at auto
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_activity_overrides_updated_at on public.activity_overrides;
create trigger trg_activity_overrides_updated_at
  before update on public.activity_overrides
  for each row execute function public.set_updated_at();

-- RLS
alter table public.activity_overrides enable row level security;
drop policy if exists "Users can manage their own activity_overrides" on public.activity_overrides;
create policy "Users can manage their own activity_overrides"
  on public.activity_overrides for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ########## 2026-06-01_competition_priority.sql ##########
-- ============================================================
-- Coach IA — Priorité de compétition : nouvelles valeurs
-- L'ancienne contrainte n'autorisait que 'A','B','C'. On passe à
-- 'principal' / 'secondaire' (libellés affichés : Objectif / Préparation).
-- On garde A/B/C tolérés pour les anciennes lignes.
-- À exécuter dans Supabase → SQL Editor. Idempotent.
-- ============================================================

alter table public.competitions
  drop constraint if exists competitions_priority_check;

alter table public.competitions
  add constraint competitions_priority_check
  check (priority in ('principal', 'secondaire', 'A', 'B', 'C') or priority is null);

-- (Optionnel) normaliser les anciennes valeurs existantes :
update public.competitions set priority = 'principal'  where priority = 'A';
update public.competitions set priority = 'secondaire' where priority in ('B', 'C');

-- Vérif :
--   select distinct priority from public.competitions;

-- ########## 2026-06-01_day_annotations.sql ##########
-- ============================================================
-- Coach IA — Notes typées sur plage de dates (maladie / blessure / texte)
-- Remplace l'usage de day_notes (texte par jour) par des notes avec type,
-- couleur et plage de dates. À exécuter dans Supabase → SQL Editor.
-- Idempotent : ne casse rien si déjà appliqué.
-- ============================================================

create table if not exists public.day_annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  client_id text,                       -- id local (tracking)
  type text not null check (type in ('maladie', 'blessure', 'texte')),
  text text,
  color text,                           -- couleur hex choisie (#rrggbb)
  from_date date not null,
  to_date date not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_day_annotations_user_range
  on public.day_annotations(user_id, from_date, to_date);

-- updated_at auto
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_day_annotations_updated_at on public.day_annotations;
create trigger trg_day_annotations_updated_at
  before update on public.day_annotations
  for each row execute function public.set_updated_at();

-- RLS : chaque user ne voit que ses notes
alter table public.day_annotations enable row level security;
drop policy if exists "Users can manage their own day_annotations" on public.day_annotations;
create policy "Users can manage their own day_annotations"
  on public.day_annotations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Vérif :
--   select * from public.day_annotations where user_id = auth.uid();

-- ########## 2026-06-01_supabase_only.sql ##########
-- ============================================================
-- 2026-06-01_supabase_only.sql
-- Migration "Supabase-only" — sécurité + colonnes pour streams & power profile.
--
-- À appliquer dans Supabase : SQL Editor → coller → Run.
-- Idempotent : peut être relancé sans danger.
--
-- Ce que fait cette migration :
--   1. SÉCURITÉ : les tokens OAuth (Strava/Whoop) ne sont plus jamais
--      lisibles côté navigateur. Le client n'a accès qu'aux colonnes "safe".
--      Les edge functions (service_role) gardent l'accès complet.
--   2. STREAMS : nouvelles colonnes pour stocker les streams compressés
--      (gzip+base64 dans une colonne texte, portable et sans piège bytea).
--   3. POWER PROFILE : colonne power_curve par activité (MMP), base du
--      recalcul des agrégats alltime / 90 jours.
--   4. RLS : garantit des policies "own rows" sur les tables Whoop si absentes.
-- ============================================================

begin;

-- ============================================================
-- 1) NOUVELLES COLONNES sur activities
-- ============================================================
alter table public.activities
  add column if not exists streams_gz       text,          -- base64(gzip(JSON [{type,data}]))
  add column if not exists streams_synced_at timestamptz,   -- null = streams pas encore récupérés
  add column if not exists power_curve       jsonb;         -- {"60":320,"300":280,...} MMP de CETTE activité

comment on column public.activities.streams_gz is
  'Streams (watts/hr/cadence/altitude/distance) en JSON gzip+base64. Format dans streams_format.';
comment on column public.activities.power_curve is
  'Mean Maximal Power par durée pour cette activité. Sert à recalculer power_profile.';

-- Index pour le backfill : retrouver vite les activités sans streams
create index if not exists idx_activities_streams_todo
  on public.activities (user_id, start_date_local desc)
  where streams_synced_at is null;

-- ============================================================
-- 2) SÉCURITÉ : verrouillage des colonnes sensibles (tokens)
-- ------------------------------------------------------------
-- Principe : on RÉVOQUE le SELECT global sur les tables de connexion,
-- puis on RE-GRANT uniquement les colonnes non sensibles au rôle
-- 'authenticated'. Résultat : un select('*') côté client échouera,
-- et access_token / refresh_token ne peuvent JAMAIS sortir.
-- Les edge functions utilisent la service_role_key qui ignore ces grants.
-- ============================================================

-- --- strava_connections ---
revoke select on public.strava_connections from anon, authenticated;
grant  select (
  user_id, strava_athlete_id, athlete_name, scope,
  first_connected_at, last_sync_at, last_sync_status,
  last_sync_error, total_activities_synced
) on public.strava_connections to authenticated;

-- --- whoop_connections ---
revoke select on public.whoop_connections from anon, authenticated;
grant  select (
  user_id, whoop_user_id,
  first_connected_at, last_sync_at, last_sync_status, last_sync_error
) on public.whoop_connections to authenticated;

-- Le client n'écrit jamais dans ces tables (seules les edge functions le font).
-- On retire donc aussi insert/update/delete au cas où.
revoke insert, update, delete on public.strava_connections from anon, authenticated;
revoke insert, update, delete on public.whoop_connections  from anon, authenticated;

-- ============================================================
-- 3) RLS sur les tables Whoop (idempotent, n'écrase pas l'existant)
-- ============================================================
alter table public.whoop_data        enable row level security;
alter table public.whoop_connections  enable row level security;

-- whoop_data : lecture de ses propres lignes uniquement.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'whoop_data' and cmd = 'SELECT'
  ) then
    create policy whoop_data_select_own on public.whoop_data
      for select to authenticated using (auth.uid() = user_id);
  end if;
end $$;

-- whoop_connections : lecture de sa propre ligne (les colonnes tokens
-- restent masquées par les grants ci-dessus, donc invisibles même ici).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'whoop_connections' and cmd = 'SELECT'
  ) then
    create policy whoop_connections_select_own on public.whoop_connections
      for select to authenticated using (auth.uid() = user_id);
  end if;
end $$;

commit;

-- ============================================================
-- VÉRIFICATIONS (à lancer après le commit, lecture seule) :
--
--   -- les colonnes existent ?
--   select column_name from information_schema.columns
--   where table_name='activities' and column_name in
--     ('streams_gz','streams_synced_at','power_curve');
--
--   -- 'authenticated' ne voit plus les tokens ?
--   select grantee, privilege_type, column_name
--   from information_schema.column_privileges
--   where table_name='strava_connections' and grantee='authenticated'
--   order by column_name;
--   -- access_token / refresh_token NE DOIVENT PAS apparaître.
-- ============================================================

-- ########## 2026-06-02_activity_template.sql ##########
-- Bibliothèque de séances : modèles réutilisables, glissés-déposés dans le calendrier.
-- Cohérent avec le schéma activity_* (activity_planned, activity_edits).

create table if not exists public.activity_template (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  client_id    text,                -- id local (mapping localStorage ↔ cloud)
  sport        text,                -- catégorie : cyclisme, course, natation, musculation, autre…
  name         text not null,
  duration_min integer,
  tss          integer,
  description  text,
  sort_order   integer default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists activity_template_user_idx on public.activity_template (user_id);

alter table public.activity_template enable row level security;

create policy "tpl_select_own" on public.activity_template
  for select using (auth.uid() = user_id);
create policy "tpl_insert_own" on public.activity_template
  for insert with check (auth.uid() = user_id);
create policy "tpl_update_own" on public.activity_template
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tpl_delete_own" on public.activity_template
  for delete using (auth.uid() = user_id);

-- ########## 2026-06-02_cleanup_daily_metrics.sql ##########
-- Nettoie daily_metrics : supprime les lignes antérieures à la première VRAIE
-- activité de chaque user (élimine la série aberrante remontant jusqu'en 1970).
-- À exécuter dans le SQL Editor de Supabase.

-- 1) (Diagnostic facultatif) repérer les activités à date aberrante :
-- select id, name, start_date_local, source
-- from public.activities
-- where start_date_local::date < '2000-01-01';

-- 2) Supprimer les activités à date aberrante (ex. epoch 1970), toutes sources.
delete from public.activities
where start_date_local::date < '2000-01-01';

-- 3) Purge des daily_metrics antérieurs à la 1ʳᵉ activité restante :
delete from public.daily_metrics dm
where dm.iso_date < (
  select min(a.start_date_local::date)
  from public.activities a
  where a.user_id = dm.user_id
);

-- ########## 2026-06-02_connexions_app.sql ##########
-- ============================================================
--  Mutualise strava_connections + whoop_connections dans une
--  table unique connexions_app (1 ligne par user + app).
--  Ajouter une app plus tard = une nouvelle valeur de `app`,
--  sans nouvelle table.
--  À exécuter dans le SQL Editor de Supabase.
--  ⚠ Redéployer les 7 edge functions AVANT/AVEC cette migration.
-- ============================================================

create table if not exists public.connexions_app (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  app                     text not null check (app in ('strava', 'whoop')),
  external_id             text,           -- athlete_id Strava / user_id Whoop
  athlete_name            text,
  access_token            text not null,
  refresh_token           text not null,
  expires_at              timestamptz not null,
  scope                   text,
  first_connected_at      timestamptz not null default now(),
  last_sync_at            timestamptz,
  last_sync_status        text,
  last_sync_error         text,
  total_activities_synced integer,
  unique (user_id, app)
);

create index if not exists idx_connexions_app_user    on public.connexions_app(user_id);
create index if not exists idx_connexions_app_app_ext  on public.connexions_app(app, external_id);

alter table public.connexions_app enable row level security;

drop policy if exists "connexions_app_select_own" on public.connexions_app;
create policy "connexions_app_select_own" on public.connexions_app
  for select using (auth.uid() = user_id);

-- Écritures réservées au service_role (edge functions).
revoke insert, update, delete on public.connexions_app from anon, authenticated;
-- Tokens jamais exposés au client : select limité aux colonnes non sensibles.
revoke select on public.connexions_app from anon, authenticated;
grant  select (id, user_id, app, external_id, athlete_name, scope,
               first_connected_at, last_sync_at, last_sync_status,
               last_sync_error, total_activities_synced)
  on public.connexions_app to authenticated;

-- ---------- Copie des données existantes ----------
insert into public.connexions_app
  (user_id, app, external_id, athlete_name, access_token,
   refresh_token, expires_at, scope, first_connected_at, last_sync_at,
   last_sync_status, last_sync_error, total_activities_synced)
select user_id, 'strava', strava_athlete_id::text, athlete_name,
       access_token, refresh_token, expires_at, scope, first_connected_at,
       last_sync_at, last_sync_status, last_sync_error, total_activities_synced
from public.strava_connections
on conflict (user_id, app) do nothing;

insert into public.connexions_app
  (user_id, app, external_id, athlete_name, access_token, refresh_token,
   expires_at, first_connected_at, last_sync_at, last_sync_status, last_sync_error)
select user_id, 'whoop', whoop_user_id, athlete_name, access_token, refresh_token,
       expires_at, first_connected_at, last_sync_at, last_sync_status, last_sync_error
from public.whoop_connections
on conflict (user_id, app) do nothing;

-- ---------- À lancer SEULEMENT après avoir vérifié que la synchro
--            Strava ET Whoop fonctionne (fonctions redéployées) : ----------
-- drop table if exists public.strava_connections;
-- drop table if exists public.whoop_connections;

-- ########## 2026-06-02_drop_session_type.sql ##########
-- Supprime la colonne `type` (type de séance auto-classé : endurance/vo2/seuil…)
-- des tables activities et planned_sessions. Hors périmètre actuel — sera
-- réimplémenté plus tard si besoin.
-- NB : ne touche PAS day_notes.type (maladie/blessure/texte), ni les colonnes
--      Strava de sport (sport / sport_raw).
-- À exécuter dans le SQL Editor de Supabase AVANT de pousser le front.

-- La vue recent_days dépendait de activities.type et n'est utilisée nulle part
-- dans l'app → on la supprime définitivement (non recréée).
drop view if exists public.recent_days;

alter table if exists public.activities       drop column if exists type;
alter table if exists public.planned_sessions drop column if exists type;

-- ########## 2026-06-02_drop_wellness.sql ##########
-- Supprime la fonctionnalité « bien-être / forme du jour » (saisies subjectives).
-- Plus utilisée dans l'app. À exécuter dans le SQL Editor de Supabase.

drop table if exists public.wellness_days;

-- ########## 2026-06-02_merge_strava_ignored.sql ##########
-- Mutualise strava_ignored dans activity_edits : « masquer une activité » devient
-- un drapeau hidden:true dans la colonne JSONB data (aucune nouvelle colonne).
-- À exécuter dans le SQL Editor de Supabase.

-- 1) Reporter chaque activité ignorée en activity_edits.data.hidden = true,
--    en fusionnant avec un éventuel override existant.
insert into public.activity_edits (user_id, activity_id, data)
select si.user_id, si.activity_id::text, jsonb_build_object('hidden', true)
from public.strava_ignored si
on conflict (user_id, activity_id) do update
  set data = public.activity_edits.data || jsonb_build_object('hidden', true);

-- 2) Supprimer l'ancienne table.
drop table if exists public.strava_ignored;

-- ########## 2026-06-02_power_profile_sport.sql ##########
-- Power profile au format LARGE, une ligne par (user_id, sport).
-- Une colonne par durée, nommée par son libellé : "1s", "45s", "1min", "1h30"…
-- ⚠ Ces noms commencent par un chiffre → ils DOIVENT être cités entre guillemets
--   doubles dans toute requête SQL : select "1h" from ...  (PostgREST/supabase-js
--   gèrent ça automatiquement quand on passe le nom exact).
-- Plafonné à 8h (colonnes SQL non dynamiques). Valeurs = meilleurs watts (MMP) all-time.
-- (Colonnes "récent 90j" / dates ajoutées plus tard si besoin.)
-- À exécuter dans le SQL Editor de Supabase.

create table if not exists public.power_profile_sport (
  user_id uuid not null references auth.users(id) on delete cascade,
  sport   text not null,

  -- 1s → 15s (chaque seconde)
  "1s" int, "2s" int, "3s" int, "4s" int, "5s" int, "6s" int, "7s" int, "8s" int,
  "9s" int, "10s" int, "11s" int, "12s" int, "13s" int, "14s" int, "15s" int,
  -- paliers courts
  "20s" int, "25s" int, "30s" int, "45s" int,
  -- 1min → 10min
  "1min" int, "2min" int, "3min" int, "4min" int, "5min" int,
  "6min" int, "7min" int, "8min" int, "9min" int, "10min" int,
  -- 12 / 15 / 20 / 25 / 30 / 35 / 40 / 45 min
  "12min" int, "15min" int, "20min" int, "25min" int, "30min" int,
  "35min" int, "40min" int, "45min" int,
  -- 1h → 5h (par demi-heure)
  "1h" int, "1h30" int, "2h" int, "2h30" int, "3h" int,
  "3h30" int, "4h" int, "4h30" int, "5h" int,
  -- 6h / 7h / 8h
  "6h" int, "7h" int, "8h" int,

  -- Métadonnées par durée (date, 90j, activité) sans exploser le nombre de colonnes :
  -- details = { "1h": { "w90": 250, "date": "2025-04-18", "activity_id": "..." }, ... }
  details jsonb not null default '{}'::jsonb,

  -- Infos de niveau ligne
  activities_count   integer,     -- nb d'activités du sport prises en compte
  longest_activity_s integer,     -- durée de la plus longue activité (sens des colonnes)
  ftp                integer,     -- FTP au moment du calcul (pour W/kg, %FTP…)
  weight             numeric,     -- poids (kg) au moment du calcul

  updated_at timestamptz not null default now(),
  primary key (user_id, sport)
);

alter table public.power_profile_sport enable row level security;

drop policy if exists "power_profile_sport_select_own" on public.power_profile_sport;
create policy "power_profile_sport_select_own" on public.power_profile_sport
  for select using (auth.uid() = user_id);

-- Écritures réservées au service_role (edge function de recalcul).
revoke insert, update, delete on public.power_profile_sport from anon, authenticated;

-- ########## 2026-06-02_rename_activity_overrides.sql ##########
-- Renomme activity_overrides → activity_edits (nom plus explicite).
-- À exécuter dans le SQL Editor de Supabase.
-- Le trigger et la policy restent attachés automatiquement ; on les renomme
-- juste pour la cohérence (sans échouer si déjà absents).

alter table if exists public.activity_overrides rename to activity_edits;

do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgname = 'trg_activity_overrides_updated_at'
      and tgrelid = 'public.activity_edits'::regclass
  ) then
    alter trigger trg_activity_overrides_updated_at on public.activity_edits
      rename to trg_activity_edits_updated_at;
  end if;
exception when undefined_table then null;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'activity_edits'
      and policyname = 'Users can manage their own activity_overrides'
  ) then
    alter policy "Users can manage their own activity_overrides" on public.activity_edits
      rename to "Users can manage their own activity_edits";
  end if;
end $$;

-- ########## 2026-06-02_rename_planned_sessions.sql ##########
-- Renomme planned_sessions → activity_planned (aligné sur activities / activity_edits).
-- À exécuter dans le SQL Editor de Supabase.
-- NB : lancer APRÈS 2026-06-02_drop_session_type.sql (qui référence encore
--      planned_sessions sous son ancien nom).

alter table if exists public.planned_sessions rename to activity_planned;

alter index if exists public.idx_planned_user_date rename to idx_activity_planned_user_date;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'activity_planned'
      and policyname = 'Users manage own planned_sessions'
  ) then
    alter policy "Users manage own planned_sessions" on public.activity_planned
      rename to "Users manage own activity_planned";
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgname = 'trg_planned_updated_at'
      and tgrelid = 'public.activity_planned'::regclass
  ) then
    alter trigger trg_planned_updated_at on public.activity_planned
      rename to trg_activity_planned_updated_at;
  end if;
exception when undefined_table then null;
end $$;

-- ########## 2026-06-02_rename_rest_day.sql ##########
-- Renomme template_rest_days → rest_day.
-- Le statut passé/prévu n'est PAS stocké (il deviendrait faux en vieillissant) :
-- il est DÉRIVÉ de la date à l'affichage (iso_date < aujourd'hui → passé).
-- À exécuter dans le SQL Editor de Supabase.

alter table if exists public.template_rest_days rename to rest_day;

-- Si une version précédente avait ajouté une colonne kind figée, on l'enlève.
alter table public.rest_day drop column if exists kind;

-- Cohérence des objets liés (sans échouer si absents).
alter index if exists public.idx_template_rest_days_user rename to idx_rest_day_user;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rest_day'
      and policyname = 'template_rest_days_all_own'
  ) then
    alter policy "template_rest_days_all_own" on public.rest_day
      rename to "rest_day_all_own";
  end if;
end $$;

-- ########## 2026-06-02_unified_model.sql ##########
-- ============================================================
-- Coach IA — Modèle unifié activités / prévus
-- 1) activities = TOUTES les activités réalisées (Strava + manuelles),
--    chacune avec source (strava|manual) et category (entrainement|competition).
-- 2) planned_sessions = séances prévues, category (entrainement|competition).
--
-- ⚠️ Migration ADDITIVE : aucune table supprimée (trainings/competitions gardées
--    en backup). À exécuter dans Supabase → SQL Editor. Réexécutable.
--
-- NB : la table activities utilise les noms natifs Strava (start_date_local,
-- moving_time [secondes], distance_km, user_notes…). Pas de colonne date/duration_min.
-- ============================================================

-- ---------- 1. Étendre activities ----------
alter table public.activities alter column strava_id drop not null;     -- manuelles : pas d'id Strava
alter table public.activities add column if not exists category text;   -- 'entrainement' | 'competition'
alter table public.activities add column if not exists source text;     -- 'strava' | 'manual'
alter table public.activities add column if not exists client_id text;  -- id local (manuelles)
alter table public.activities add column if not exists priority text;   -- compétition
alter table public.activities add column if not exists target text;     -- objectif de temps
alter table public.activities add column if not exists course_dplus integer; -- D+ de l'épreuve
alter table public.activities add column if not exists laps integer;
alter table public.activities add column if not exists gpx_name text;
alter table public.activities add column if not exists gpx_content text;
alter table public.activities add column if not exists stages jsonb;

update public.activities set source = 'strava' where source is null;
update public.activities set category = 'entrainement' where category is null;

-- ---------- 2. Table planned_sessions (prévus) ----------
create table if not exists public.planned_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  category text not null default 'entrainement' check (category in ('entrainement', 'competition')),
  name text,
  date date not null,
  sport text,
  type text,
  duration integer,        -- minutes
  tss integer,
  notes text,
  structure jsonb,
  priority text,
  target text,
  km numeric,
  d_plus integer,
  laps integer,
  gpx_name text,
  gpx_content text,
  stages jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_planned_user_date on public.planned_sessions(user_id, date);

alter table public.planned_sessions enable row level security;
drop policy if exists "Users manage own planned_sessions" on public.planned_sessions;
create policy "Users manage own planned_sessions" on public.planned_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists trg_planned_updated_at on public.planned_sessions;
create trigger trg_planned_updated_at before update on public.planned_sessions
  for each row execute function public.set_updated_at();

-- ---------- 3. Migration des données ----------

-- a) Entraînements RÉALISÉS → activities (manual / entrainement)
insert into public.activities (user_id, source, category, client_id, start_date_local, name, sport, type, moving_time, tss, user_notes)
select t.user_id, 'manual', 'entrainement', t.client_id, (t.date::timestamp + interval '12 hours'), t.name, t.sport, t.type, coalesce(t.duration, 0) * 60, t.tss, t.notes
from public.trainings t
where t.mode = 'realise'
  and not exists (select 1 from public.activities a where a.source = 'manual' and a.client_id = t.client_id and a.start_date_local::date = t.date);

-- b) Entraînements PRÉVUS → planned_sessions (entrainement)
insert into public.planned_sessions (user_id, category, client_id, name, date, sport, type, duration, tss, notes, structure)
select t.user_id, 'entrainement', t.client_id, t.name, t.date, t.sport, t.type, t.duration, t.tss, t.notes, t.structure
from public.trainings t
where t.mode = 'prevu'
  and not exists (select 1 from public.planned_sessions p where p.client_id = t.client_id and p.date = t.date);

-- c) Compétitions PASSÉES → activities (manual / competition)
insert into public.activities (user_id, source, category, client_id, start_date_local, name, sport, distance_km, user_notes, priority, target, course_dplus, laps, gpx_name, gpx_content, stages)
select c.user_id, 'manual', 'competition', c.client_id, (c.date::timestamp + interval '12 hours'), c.name, c.sport, c.km, c.notes, c.priority, c.target, c.d_plus, c.laps, c.gpx_name, c.gpx_content, c.stages
from public.competitions c
where c.date <= current_date
  and not exists (select 1 from public.activities a where a.category = 'competition' and a.client_id = c.client_id and a.start_date_local::date = c.date);

-- d) Compétitions FUTURES → planned_sessions (competition)
insert into public.planned_sessions (user_id, category, client_id, name, date, sport, km, notes, priority, target, d_plus, laps, gpx_name, gpx_content, stages)
select c.user_id, 'competition', c.client_id, c.name, c.date, c.sport, c.km, c.notes, c.priority, c.target, c.d_plus, c.laps, c.gpx_name, c.gpx_content, c.stages
from public.competitions c
where c.date > current_date
  and not exists (select 1 from public.planned_sessions p where p.category = 'competition' and p.client_id = c.client_id and p.date = c.date);

-- ---------- 4. Vérifications ----------
-- select source, category, count(*) from public.activities group by 1,2;
-- select category, count(*) from public.planned_sessions group by 1;

-- ########## 2026-06-03_created_by_ia.sql ##########
-- Séparation des deux mondes de planification (Manuel vs IA).
-- Drapeau posé à l'écriture : false = créé manuellement, true = créé par l'IA.
-- Le rendu filtre selon le mode courant (Manuel n'affiche que false, IA que true).
-- Les activités RÉALISÉES (table activities) ne sont PAS concernées : toujours visibles.

alter table public.activity_planned  add column if not exists created_by_ia boolean not null default false;
alter table public.rest_day          add column if not exists created_by_ia boolean not null default false;
alter table public.day_notes         add column if not exists created_by_ia boolean not null default false;
alter table public.training_phases   add column if not exists created_by_ia boolean not null default false;

-- ########## 2026-06-16_multi_user_profiles.sql ##########
-- ============================================================
--  Coach IA — Étape 1 du passage multi-utilisateur (cf. MODELE_DONNEES.md)
--
--  Crée 3 tables : profiles, coach_athlete (pivot), athlete_settings.
--  + 1 helper SQL réutilisable : public.is_coach_of(athlete uuid)
--
--  INVISIBLE pour l'usage solo actuel : chaque utilisateur devient son
--  propre coach (ligne coach_athlete où coach_id = athlete_id). Rien ne
--  change dans l'app tant qu'on n'invite pas un vrai 2e utilisateur.
--
--  À exécuter dans Supabase → SQL Editor. Idempotent (relançable sans risque).
-- ============================================================

-- ---------- Fonction utilitaire updated_at (peut déjà exister) ----------
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- ============================================================
-- ① profiles — prolonge auth.users avec les infos applicatives
-- ============================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'both' check (role in ('athlete', 'coach', 'both')),
  display_name text,
  avatar_url   text,
  locale       text default 'fr',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Remplit profiles depuis les comptes existants
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email)
from auth.users
on conflict (id) do nothing;

-- Crée automatiquement un profil à chaque nouvelle inscription
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',
                           new.raw_user_meta_data->>'name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- ② coach_athlete — pivot central coach ↔ athlètes
-- ============================================================
create table if not exists public.coach_athlete (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles(id) on delete cascade,
  athlete_id  uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'active' check (status in ('pending', 'active', 'revoked')),
  invited_at  timestamptz not null default now(),
  accepted_at timestamptz,
  unique (coach_id, athlete_id)
);

create index if not exists idx_coach_athlete_coach   on public.coach_athlete(coach_id);
create index if not exists idx_coach_athlete_athlete on public.coach_athlete(athlete_id);

-- Chaque utilisateur existant devient son propre coach (lien neutre)
insert into public.coach_athlete (coach_id, athlete_id, status, accepted_at)
select id, id, 'active', now() from public.profiles
on conflict (coach_id, athlete_id) do nothing;


-- ============================================================
--  Helper : auth.uid() est-il coach actif de _athlete ?
--  security definer => contourne la RLS pour éviter toute récursion.
--  Réutilisé par les policies de toutes les tables de données.
-- ============================================================
create or replace function public.is_coach_of(_athlete uuid)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.coach_athlete
    where coach_id = auth.uid()
      and athlete_id = _athlete
      and status = 'active'
  );
$$;


-- ============================================================
-- ③ athlete_settings — réglages physiologiques (1 par athlète)
-- ============================================================
create table if not exists public.athlete_settings (
  athlete_id      uuid primary key references public.profiles(id) on delete cascade,
  sport_principal text,
  ftp             integer,
  hr_max          integer,
  hr_rest         integer,
  weight_kg       numeric,
  zones           jsonb,
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_athlete_settings_updated_at on public.athlete_settings;
create trigger trg_athlete_settings_updated_at
  before update on public.athlete_settings
  for each row execute function public.set_updated_at();

-- Crée une ligne de réglages vide pour chaque athlète existant
insert into public.athlete_settings (athlete_id)
select id from public.profiles
on conflict (athlete_id) do nothing;


-- ============================================================
--  Row Level Security
-- ============================================================

-- ---- profiles : je vois mon profil + ceux liés (mes athlètes / mes coachs)
alter table public.profiles enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select using (
  id = auth.uid()
  or public.is_coach_of(id)
  or exists (
    select 1 from public.coach_athlete
    where athlete_id = auth.uid() and coach_id = profiles.id and status = 'active'
  )
);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- (pas de policy insert : géré par le trigger handle_new_user en security definer)


-- ---- coach_athlete : je vois/gère les liens où je suis impliqué
alter table public.coach_athlete enable row level security;

drop policy if exists "coach_athlete_select" on public.coach_athlete;
create policy "coach_athlete_select" on public.coach_athlete for select
  using (coach_id = auth.uid() or athlete_id = auth.uid());

-- Un coach crée une invitation (il est coach_id) ; l'athlète pourra l'accepter.
drop policy if exists "coach_athlete_insert" on public.coach_athlete;
create policy "coach_athlete_insert" on public.coach_athlete for insert
  with check (coach_id = auth.uid() or athlete_id = auth.uid());

drop policy if exists "coach_athlete_update" on public.coach_athlete;
create policy "coach_athlete_update" on public.coach_athlete for update
  using (coach_id = auth.uid() or athlete_id = auth.uid())
  with check (coach_id = auth.uid() or athlete_id = auth.uid());

drop policy if exists "coach_athlete_delete" on public.coach_athlete;
create policy "coach_athlete_delete" on public.coach_athlete for delete
  using (coach_id = auth.uid() or athlete_id = auth.uid());


-- ---- athlete_settings : l'athlète gère ; le coach lit
alter table public.athlete_settings enable row level security;

drop policy if exists "athlete_settings_select" on public.athlete_settings;
create policy "athlete_settings_select" on public.athlete_settings for select
  using (athlete_id = auth.uid() or public.is_coach_of(athlete_id));

drop policy if exists "athlete_settings_modify" on public.athlete_settings;
create policy "athlete_settings_modify" on public.athlete_settings for all
  using (athlete_id = auth.uid() or public.is_coach_of(athlete_id))
  with check (athlete_id = auth.uid() or public.is_coach_of(athlete_id));


-- ============================================================
--  Vérifications (à lancer après la migration) :
--    select count(*) from public.profiles;          -- = nb de comptes
--    select count(*) from public.coach_athlete;      -- idem (self-liens)
--    select count(*) from public.athlete_settings;   -- idem
--    select * from public.profiles where id = auth.uid();
-- ============================================================

-- ########## 2026-06-16b_fix_user_profiles_coach.sql ##########
-- Coach IA - Correctif handle_new_user + Etape 4 (lecture coach).
-- A executer dans Supabase SQL Editor apres 2026-06-16_multi_user_profiles.sql.
-- Idempotent.

-- 1. Repare la creation auto de user_profiles a l'inscription.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name',
                           split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Creation de profiles via une fonction au nom distinct.
create or replace function public.handle_new_profile() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',
                           new.raw_user_meta_data->>'name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_profile();

-- 3. Supprime athlete_settings (doublon de user_profiles, jamais branchee).
drop table if exists public.athlete_settings;

-- 4. Etape 4 : le coach lie et actif peut LIRE le profil de ses athletes.
--    L'ecriture reste reservee a l'athlete (policy historique inchangee).
drop policy if exists "user_profiles_coach_read" on public.user_profiles;
create policy "user_profiles_coach_read" on public.user_profiles
  for select using (public.is_coach_of(user_id));

-- ########## 2026-06-16c_coach_read_training.sql ##########
-- Coach IA - Etape 3 : lecture coach sur les donnees d'entrainement.
-- Pour chaque table d'entrainement appartenant a un athlete (colonne user_id),
-- ajoute une policy SELECT autorisant le coach lie et actif (is_coach_of).
-- L'ecriture reste reservee a l'athlete (policies "manage own" inchangees).
-- Exclut les tables sensibles (tokens OAuth) et systeme.
-- A executer dans Supabase SQL Editor apres 2026-06-16b. Idempotent.

do $$
declare
  t text;
  tables text[] := array[
    'activities',
    'activity_planned',
    'activity_edits',
    'activity_template',
    'competitions',
    'trainings',
    'rest_day',
    'day_notes',
    'day_annotations',
    'wellness_days',
    'training_phases',
    'yearly_goals',
    'plan_snapshots',
    'strava_ignored',
    'daily_metrics',
    'power_profile',
    'power_profile_sport',
    'whoop_data'
  ];
begin
  foreach t in array tables loop
    -- la table existe ?
    if to_regclass('public.' || t) is null then
      raise notice 'skip % : table absente', t;
      continue;
    end if;
    -- la table a bien une colonne user_id ?
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'user_id'
    ) then
      raise notice 'skip % : pas de colonne user_id', t;
      continue;
    end if;
    -- RLS active (au cas ou) + policy de lecture coach (idempotent)
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_coach_read', t);
    execute format(
      'create policy %I on public.%I for select using (public.is_coach_of(user_id))',
      t || '_coach_read', t
    );
    raise notice 'policy coach_read creee sur %', t;
  end loop;
end$$;

-- Verification :
--   select tablename, policyname from pg_policies
--   where policyname like '%_coach_read' order by tablename;

-- ########## 2026-06-16d_add_athlete_rpc.sql ##########
-- Coach IA - RPC : ajouter un athlete par email (modele lien direct).
-- Un client ne peut pas lire auth.users ; cette fonction security definer
-- resout l'email -> user et cree le lien coach_athlete actif.
-- A executer dans Supabase SQL Editor. Idempotent.

create or replace function public.add_athlete_by_email(_email text)
  returns table(athlete_id uuid, display_name text)
  language plpgsql security definer set search_path = public, auth as $$
#variable_conflict use_column
declare
  _coach   uuid := auth.uid();
  _athlete uuid;
begin
  if _coach is null then
    raise exception 'Non authentifie';
  end if;

  select id into _athlete
  from auth.users
  where lower(email) = lower(trim(_email))
  limit 1;

  if _athlete is null then
    raise exception 'Aucun compte avec cet email';
  end if;
  if _athlete = _coach then
    raise exception 'Vous ne pouvez pas vous ajouter vous-meme';
  end if;

  -- garantit l'existence des profils (au cas ou)
  insert into public.profiles (id) values (_coach)   on conflict (id) do nothing;
  insert into public.profiles (id) values (_athlete) on conflict (id) do nothing;

  insert into public.coach_athlete (coach_id, athlete_id, status, accepted_at)
  values (_coach, _athlete, 'active', now())
  on conflict (coach_id, athlete_id)
    do update set status = 'active', accepted_at = now();

  return query
    select p.id, coalesce(p.display_name, _email)
    from public.profiles p
    where p.id = _athlete;
end;
$$;

-- PUBLIC couvre tous les roles (dont anon) : on retire l'execution par defaut
-- puis on l'accorde uniquement aux comptes connectes.
revoke all on function public.add_athlete_by_email(text) from public;
grant execute on function public.add_athlete_by_email(text) to authenticated;

-- ########## 2026-06-16e_messages.sql ##########
-- Coach IA - Messagerie coach <-> athlete.
-- Un fil par athlete ; le coach lie et l'athlete peuvent lire et ecrire.
-- A executer dans Supabase SQL Editor apres les migrations precedentes. Idempotent.

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists idx_messages_athlete on public.messages(athlete_id, created_at);

alter table public.messages enable row level security;

-- Lecture : l'athlete concerne OU son coach actif.
drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages for select using (
  athlete_id = auth.uid() or public.is_coach_of(athlete_id)
);

-- Ecriture : l'auteur est soi-meme, et participe au fil (athlete ou coach lie).
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages for insert with check (
  author_id = auth.uid()
  and (athlete_id = auth.uid() or public.is_coach_of(athlete_id))
);

-- Marquer lu (update read_at) : par un participant du fil.
drop policy if exists "messages_update" on public.messages;
create policy "messages_update" on public.messages for update using (
  athlete_id = auth.uid() or public.is_coach_of(athlete_id)
) with check (
  athlete_id = auth.uid() or public.is_coach_of(athlete_id)
);

-- ########## 2026-06-16f_coach_plan_write.sql ##########
-- Coach IA - Le coach peut PLANIFIER pour ses athletes (ecriture sur les
-- tables de planification uniquement). Les activites realisees, la forme,
-- le profil, etc. restent en lecture seule cote coach.
-- A executer dans Supabase SQL Editor apres les migrations precedentes. Idempotent.

do $$
declare
  t text;
  tables text[] := array[
    'activity_planned',
    'rest_day',
    'training_phases',
    'activity_template',
    'competitions'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      raise notice 'skip % : table absente', t;
      continue;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'user_id'
    ) then
      raise notice 'skip % : pas de colonne user_id', t;
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', t || '_coach_ins', t);
    execute format('create policy %I on public.%I for insert with check (public.is_coach_of(user_id))', t || '_coach_ins', t);

    execute format('drop policy if exists %I on public.%I', t || '_coach_upd', t);
    execute format('create policy %I on public.%I for update using (public.is_coach_of(user_id)) with check (public.is_coach_of(user_id))', t || '_coach_upd', t);

    execute format('drop policy if exists %I on public.%I', t || '_coach_del', t);
    execute format('create policy %I on public.%I for delete using (public.is_coach_of(user_id))', t || '_coach_del', t);

    raise notice 'policies coach write creees sur %', t;
  end loop;
end$$;

-- ########## 2026-06-16g_invites.sql ##########
-- Coach IA - Invitations avec acceptation + surnom coach.
-- - coach_label : surnom donne par le coach a l'athlete.
-- - add_athlete_by_email cree desormais un lien 'pending' (en attente) et
--   retourne l'id du lien (pour construire le lien d'invitation).
-- - my_pending_invites : invitations recues par l'athlete connecte.
-- A executer dans Supabase SQL Editor apres les migrations precedentes. Idempotent.

alter table public.coach_athlete add column if not exists coach_label text;
alter table public.coach_athlete add column if not exists invited_email text;

-- ---- Inviter par email : cree un lien EN ATTENTE ----
-- DROP requis : le type de retour change (ajout invite_id / link_status).
drop function if exists public.add_athlete_by_email(text);
create or replace function public.add_athlete_by_email(_email text)
  returns table(athlete_id uuid, display_name text, invite_id uuid, link_status text)
  language plpgsql security definer set search_path = public, auth as $$
#variable_conflict use_column
declare
  _coach   uuid := auth.uid();
  _athlete uuid;
  _id      uuid;
  _st      text;
begin
  if _coach is null then raise exception 'Non authentifie'; end if;

  select id into _athlete from auth.users where lower(email) = lower(trim(_email)) limit 1;
  if _athlete is null then raise exception 'Aucun compte avec cet email'; end if;
  if _athlete = _coach then raise exception 'Vous ne pouvez pas vous ajouter vous-meme'; end if;

  insert into public.profiles (id) values (_coach)   on conflict (id) do nothing;
  insert into public.profiles (id) values (_athlete) on conflict (id) do nothing;

  -- Nouveau lien => 'pending'. Si un lien existe deja, on NE retrograde PAS un
  -- lien actif ; un lien revoque/absent repasse en 'pending' (re-invitation).
  insert into public.coach_athlete (coach_id, athlete_id, status, invited_at, invited_email)
  values (_coach, _athlete, 'pending', now(), lower(trim(_email)))
  on conflict (coach_id, athlete_id) do update
    set status = case when public.coach_athlete.status = 'active' then 'active' else 'pending' end,
        invited_at = now(),
        invited_email = lower(trim(_email))
  returning id, status into _id, _st;

  return query
    select p.id, coalesce(p.display_name, _email), _id, _st
    from public.profiles p where p.id = _athlete;
end;
$$;
revoke all on function public.add_athlete_by_email(text) from public;
grant execute on function public.add_athlete_by_email(text) to authenticated;

-- ---- Invitations recues par l'athlete connecte (avec infos du coach) ----
drop function if exists public.my_pending_invites();
create or replace function public.my_pending_invites()
  returns table(invite_id uuid, coach_id uuid, coach_name text, coach_email text, invited_at timestamptz)
  language sql security definer set search_path = public, auth as $$
  select ca.id, ca.coach_id,
         coalesce(p.display_name, u.email),
         u.email,
         ca.invited_at
  from public.coach_athlete ca
  join auth.users u on u.id = ca.coach_id
  left join public.profiles p on p.id = ca.coach_id
  where ca.athlete_id = auth.uid() and ca.status = 'pending';
$$;
revoke all on function public.my_pending_invites() from public;
grant execute on function public.my_pending_invites() to authenticated;

-- ########## 2026-06-18_add_rpe.sql ##########
-- Ajoute la colonne RPE (ressenti percu, 1-10) aux seances planifiees et realisees.
-- En prevu : RPE estime/cible ; en realise : RPE ressenti.
alter table if exists public.activity_planned add column if not exists rpe numeric;
alter table if exists public.activities add column if not exists rpe numeric;

-- ########## 2026-06-18_comp_duration.sql ##########
-- Unifie le temps cible des competitions sur la colonne duration (minutes), comme les entrainements.
-- La colonne target (texte) reste pour compat ; le code lit duration en priorite et retombe sur target.
alter table if exists public.competitions add column if not exists duration integer;
-- activity_planned a deja la colonne duration.

-- ########## 2026-06-18_db_single_source.sql ##########
-- ============================================================
-- Bascule "base = source unique" pour les seances manuelles realisees.
-- La table activities porte TOUS les parametres d'un entrainement :
--   date, sport, type, duree, tss, rpe, distance, denivele, gpx, notes, structure,
--   + drapeaux de masquage des donnees (watt / fc / distance).
--
-- + Simplification sport : UNE seule colonne `sport` = le type exact (Ride, TrailRun,
--   Swim, WeightTraining...). La categorie (cyclisme/course/...) est derivee a la volee
--   cote app. On supprime sport_raw.
--
-- Idempotent. ORDRE : deployer le code (web + edge functions strava-ingest/webhook)
-- AVANT d'executer ce script (le code n'utilise plus sport_raw ; le drop est la derniere etape).
-- ============================================================

-- Infos seance
alter table if exists public.activities       add column if not exists structure     jsonb;
alter table if exists public.activities       add column if not exists rpe           numeric;
alter table if exists public.activities       add column if not exists type          text;

-- Drapeaux "retirer des records & statistiques"
alter table if exists public.activities       add column if not exists excl_power     boolean;
alter table if exists public.activities       add column if not exists excl_hr        boolean;
alter table if exists public.activities       add column if not exists excl_distance  boolean;

-- Cote planifie (prevu)
alter table if exists public.activity_planned add column if not exists rpe           numeric;
alter table if exists public.activity_planned add column if not exists structure     jsonb;

-- Sport : une seule colonne = type exact. On bascule sport_raw -> sport puis on drop sport_raw.
update public.activities set sport = sport_raw
  where sport_raw is not null and btrim(sport_raw) <> '';
alter table if exists public.activities drop column if exists sport_raw;

-- ########## 2026-06-18_drop_comp_target.sql ##########
-- ============================================================
-- Supprime definitivement la colonne `target` (texte) des competitions :
--  1) backfill `duration` (minutes) depuis l'ancien `target` texte
--     ("2h" -> 120, "1h40" -> 100, "5h30" -> 330, "90" -> 90)
--  2) drop de la colonne `target`
-- A executer APRES 2026-06-18_comp_duration.sql.
-- ============================================================

-- competitions (compet passees)
update public.competitions
set duration = case
  when target ~ '^\s*\d+\s*h' then
    (regexp_replace(target, '^\s*(\d+)\s*h.*$', '\1'))::int * 60
    + coalesce(nullif(regexp_replace(target, '^\s*\d+\s*h\s*(\d*).*$', '\1'), ''), '0')::int
  when target ~ '^\s*\d+\s*$' then trim(target)::int
  else duration
end
where duration is null and target is not null and btrim(target) <> '';

alter table if exists public.competitions drop column if exists target;

-- activity_planned (compet futures ; les entrainements ont target NULL)
update public.activity_planned
set duration = case
  when target ~ '^\s*\d+\s*h' then
    (regexp_replace(target, '^\s*(\d+)\s*h.*$', '\1'))::int * 60
    + coalesce(nullif(regexp_replace(target, '^\s*\d+\s*h\s*(\d*).*$', '\1'), ''), '0')::int
  when target ~ '^\s*\d+\s*$' then trim(target)::int
  else duration
end
where category = 'competition' and duration is null and target is not null and btrim(target) <> '';

alter table if exists public.activity_planned drop column if exists target;

-- ########## 2026-06-19_activity_planned_link.sql ##########
-- ============================================================
-- Lien PRÉVU <-> RÉALISÉ stocké en base.
-- Une colonne `planned_id` sur activities relie une activité réalisée à la
-- séance prévue (activity_planned) qui lui correspond.
-- Valeurs : <uuid de l'activity_planned> = rapproché | 'none' = délié manuellement
--           | NULL = pas encore évalué (l'app tentera un auto-rapprochement).
-- Type texte (et pas uuid) pour autoriser le sentinel 'none'.
--
-- Idempotent. À exécuter après déploiement du code.
-- ============================================================

alter table if exists public.activities
  add column if not exists planned_id text;

-- ########## 2026-06-19_comp_type.sql ##########
-- ============================================================
-- Persistance du "type d'epreuve" des competitions.
-- activities a deja la colonne `type` (ajoutee precedemment).
-- On l'ajoute a activity_planned pour les competitions PREVUES.
-- Idempotent. A lancer avec/avant le deploiement du code.
-- ============================================================
alter table if exists public.activity_planned add column if not exists type text;

-- ########## 2026-06-19_competitions_to_activities.sql ##########
-- ============================================================
-- Refactor competitions : modele unifie.
-- Les competitions REALISEES vivent desormais dans `activities` (category='competition'),
-- comme les entrainements. La table `competitions` n'est plus ecrite par le code.
--
-- Cette migration deplace les competitions SIMPLES (un jour) de `competitions` -> `activities`,
-- puis les retire de `competitions`. Les courses a etapes (stages jsonb) sont LAISSEES dans
-- `competitions` (rares ; toujours lues/affichees par le code en transition).
--
-- Idempotente (not exists). NON destructive sur `activities`.
-- A lancer APRES avoir deploye le code des phases 1 + 2.
-- ============================================================

-- 1) Competitions simples (sans etapes) -> activities
insert into public.activities
  (user_id, source, category, client_id, name, start_date_local, sport, priority,
   distance_km, course_dplus, target, moving_time, laps, user_notes, gpx_name, gpx_content)
select
  c.user_id, 'manual', 'competition', c.client_id, c.name,
  (c.date::text || ' 12:00')::timestamp, c.sport, c.priority,
  c.km, c.d_plus, c.duration, coalesce(c.duration, 0) * 60,
  c.laps, c.notes, c.gpx_name, c.gpx_content
from public.competitions c
where coalesce(jsonb_array_length(c.stages), 0) = 0
  and not exists (
    select 1 from public.activities a
    where a.user_id = c.user_id and a.category = 'competition' and a.client_id = c.client_id
  );

-- 2) Retirer de `competitions` les compets simples (migrees). On garde les courses a etapes.
delete from public.competitions c
where coalesce(jsonb_array_length(c.stages), 0) = 0;

-- ########## 2026-06-19_drop_competitions.sql ##########
-- ============================================================
-- Nettoyage final du refactor competitions.
-- Tout ce qui reste dans `competitions` est deplace vers `activities`
-- (category='competition', stages jsonb preserve), puis on DROPPE la table.
-- Le code ne lit/ecrit plus `competitions`.
-- A LANCER APRES avoir deploye le code (sinon le pull lirait une table absente).
-- Idempotent.
-- ============================================================

insert into public.activities
  (user_id, source, category, client_id, name, start_date_local, sport, priority,
   distance_km, course_dplus, target, moving_time, laps, user_notes, gpx_name, gpx_content, stages)
select
  c.user_id, 'manual', 'competition', c.client_id, c.name,
  (c.date::text || ' 12:00')::timestamp, c.sport, c.priority,
  c.km, c.d_plus, c.duration, coalesce(c.duration, 0) * 60,
  c.laps, c.notes, c.gpx_name, c.gpx_content, c.stages
from public.competitions c
where not exists (
  select 1 from public.activities a
  where a.user_id = c.user_id and a.category = 'competition' and a.client_id = c.client_id
);

drop table if exists public.competitions;

-- ########## 2026-06-19_fix_comp_doublons.sql ##########
-- ============================================================
-- Nettoyage des doublons de competitions cree par la migration drop_competitions.
-- Cause : "Transformer en competition" (ancien modele) creait un REGISTRE separe
--   (client_id = 'act-<id_activite>') pointant vers la vraie activite. La migration
--   a transforme ce registre en une ligne `activities` fantome (0 TSS), en double
--   du vrai ride.
-- Fix : retaguer le vrai ride en competition, puis supprimer les fantomes 'act-%'.
-- Idempotent. NON destructif sur les vraies activites.
-- ============================================================

-- 1) Le vrai ride lie (id = la partie apres 'act-') devient une competition
update public.activities a
set category = 'competition'
from public.activities p
where p.category = 'competition'
  and p.client_id like 'act-%'
  and p.user_id = a.user_id
  and a.id::text = substring(p.client_id, 5);

-- 2) Supprime les lignes fantomes "registre"
delete from public.activities
where category = 'competition' and client_id like 'act-%';

-- ########## 2026-06-19_planned_start_datetime.sql ##########
-- ============================================================
-- Heure d'une seance PREVUE (entrainement manuel).
-- Au lieu d'une colonne texte, on stocke un vrai timestamptz
-- `start_date_local` (date + heure), MEME FORMAT que la table activities.
-- La colonne `date` (jour) reste pour compat ; l'heure se lit dans start_date_local.
--
-- Cote REALISE, l'heure est deja portee par activities.start_date_local
-- (le code la met a la vraie heure au lieu de T12:00:00).
--
-- Idempotent. A executer apres deploiement du code.
-- ============================================================

alter table if exists public.activity_planned
  add column if not exists start_date_local timestamptz;

-- Backfill : seances prevues existantes sans heure -> 12:00 du jour `date`.
update public.activity_planned
   set start_date_local = (date::text || 'T12:00:00')::timestamptz
 where start_date_local is null and date is not null;

-- ########## 2026-06-19_power_curve.sql ##########
-- ============================================================
-- Records de puissance : meilleur effort (W moy) par duree standard, par activite.
-- Stocke une "courbe de puissance" jsonb : { "1":461, "5":442, "10":434, ... }
-- (cles = duree en secondes). Permet de classer chaque effort vs l'historique.
-- Calcule cote client (bouton "Recalculer les records") a partir des streams.
-- Idempotent.
-- ============================================================
alter table if exists public.activities
  add column if not exists power_curve jsonb;

-- ########## 2026-06-24_activity_metrics.sql ##########
-- ============================================================
-- Metriques avancees par activite, calculees cote client a partir des
-- streams (watts + FC) + parametres athlete (FTP, FC max, FC repos).
-- Stocke un jsonb : { "_v":1, "trimp":168, "eftp":220, "cp":228, "w_prime":21600,
--   "pmax":1500, "wbal_kj":14.1, "work_over_ftp_kj":65, "cho_g":190,
--   "pol_index":1.46, "pol_class":"Pyramidal", "hrrc":31 }
-- Une seule colonne jsonb (souple, pas de migration a chaque nouvelle metrique).
-- Idempotent.
-- ============================================================
alter table if exists public.activities
  add column if not exists metrics jsonb;

-- ########## 2026-07-07_activity_template_fields.sql ##########
-- Bibliothèque de séances : le modal réutilise désormais le train-modal.
-- Nouveaux champs des modèles : sport Strava exact, RPE, distance, D+, structure (intervalles).
alter table public.activity_template
  add column if not exists sport_raw   text,      -- sport Strava exact (ex: 'Ride', 'TrailRun')
  add column if not exists rpe         numeric,   -- RPE estimé (1-10)
  add column if not exists distance_km numeric,
  add column if not exists dplus       integer,
  add column if not exists structure   jsonb;     -- structure d'intervalles (même format que activity_planned)

-- ########## 2026-07-08_daily_metrics_auto_recalc.sql ##########
-- ============================================================
-- daily_metrics = vue dérivée AUTOMATIQUE de activities.
--
-- Problème résolu : une activité supprimée/modifiée via l'app laissait
-- sa ligne daily_metrics intacte (« TSS fantôme », ex. 100 TSS le
-- 2026-07-02 après suppression). Seule la fonction Edge strava-ingest
-- recalculait, et uniquement lors d'une synchro Strava.
--
-- Solution : fonction SQL de recalcul (sémantique IDENTIQUE à l'étape 7
-- de strava-ingest : somme TSS/durée par jour, série continue, EWMA
-- alpha = 2/(N+1) avec N=42 (CTL) et N=7 (ATL), TSB = CTL-ATL) +
-- triggers statement-level sur activities -> tout chemin d'écriture
-- (app, webhook, SQL manuel) maintient daily_metrics à jour.
-- ============================================================

-- ---------- 1) Fonction de recalcul pour un utilisateur ----------
create or replace function public.recalc_daily_metrics(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d_first date;
  d_last  date;
  r record;
  v_ctl numeric := 0;
  v_atl numeric := 0;
begin
  select min(start_date_local::date), max(start_date_local::date)
    into d_first, d_last
  from activities
  where user_id = p_user
    and start_date_local is not null
    and start_date_local::date >= date '2000-01-01';  -- ignore dates aberrantes (epoch 1970)

  -- Plus aucune activité : on vide les métriques de l'utilisateur.
  if d_first is null then
    delete from daily_metrics where user_id = p_user;
    return;
  end if;

  -- Purge des lignes hors plage (avant la 1re activité / après la dernière).
  delete from daily_metrics
  where user_id = p_user
    and (iso_date < d_first or iso_date > d_last);

  -- Série continue jour par jour + EWMA (même formule que strava-ingest).
  for r in
    with agg as (
      select start_date_local::date as iso,
             sum(coalesce(tss, 0)) as tss,
             sum(round(coalesce(moving_time, elapsed_time, 0) / 60.0)) as dur,
             count(*) as cnt
      from activities
      where user_id = p_user
        and start_date_local is not null
        and start_date_local::date >= date '2000-01-01'
      group by 1
    )
    select gs::date as iso,
           coalesce(a.tss, 0) as tss,
           coalesce(a.dur, 0) as dur,
           coalesce(a.cnt, 0) as cnt
    from generate_series(d_first, d_last, interval '1 day') gs
    left join agg a on a.iso = gs::date
    order by gs::date
  loop
    v_ctl := v_ctl + (r.tss - v_ctl) * 2 / 43.0;
    v_atl := v_atl + (r.tss - v_atl) * 2 / 8.0;
    insert into daily_metrics (user_id, iso_date, tss, ctl, atl, tsb, duration_min, activity_count)
    values (p_user, r.iso, round(r.tss), round(v_ctl, 1), round(v_atl, 1),
            round(v_ctl - v_atl, 1), r.dur, r.cnt)
    on conflict (user_id, iso_date) do update
      set tss            = excluded.tss,
          ctl            = excluded.ctl,
          atl            = excluded.atl,
          tsb            = excluded.tsb,
          duration_min   = excluded.duration_min,
          activity_count = excluded.activity_count;
  end loop;
end;
$$;

-- ---------- 2) Trigger statement-level (transition tables) ----------
-- Un seul recalcul par statement et par utilisateur touché, même pour
-- les upserts en batch de l'ingest (pas un recalcul par ligne).
create or replace function public.trg_recalc_daily_metrics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid;
begin
  for u in select distinct user_id from changed_rows where user_id is not null loop
    perform public.recalc_daily_metrics(u);
  end loop;
  return null;
end;
$$;

drop trigger if exists activities_recalc_metrics_ins on public.activities;
create trigger activities_recalc_metrics_ins
  after insert on public.activities
  referencing new table as changed_rows
  for each statement
  execute function public.trg_recalc_daily_metrics();

drop trigger if exists activities_recalc_metrics_upd on public.activities;
create trigger activities_recalc_metrics_upd
  after update on public.activities
  referencing new table as changed_rows
  for each statement
  execute function public.trg_recalc_daily_metrics();

drop trigger if exists activities_recalc_metrics_del on public.activities;
create trigger activities_recalc_metrics_del
  after delete on public.activities
  referencing old table as changed_rows
  for each statement
  execute function public.trg_recalc_daily_metrics();

-- ---------- 3) Backfill : recalcul immédiat pour tous les utilisateurs ----------
-- (corrige au passage les TSS fantômes existants, ex. 2026-07-02)
do $$
declare
  u uuid;
begin
  for u in select distinct user_id from public.activities loop
    perform public.recalc_daily_metrics(u);
  end loop;
end;
$$;

-- ########## 2026-07-08_tri_segments.sql ##########
-- Triathlon : distances par discipline sur les compétitions/événements.
-- Format jsonb : { "swim_m": 1500, "bike_km": 40, "run_km": 10 }
alter table public.activity_planned add column if not exists tri jsonb;
alter table public.activities       add column if not exists tri jsonb;

-- ########## 2026-07-08b_tri_colonnes_segments.sql ##########
-- ============================================================
-- Triathlon : colonnes PAR SEGMENT, alignées sur le nouveau panneau
-- (onglets Natation / T1 / Vélo / T2 / CAP de la modale compétition).
--
-- Le front écrit tout dans la colonne jsonb `tri` :
--   { swim:{min,dist_m,pace}, t1_min, bike:{min,dist_km,speed,dplus},
--     t2_min, run:{min,dist_km,pace}, swim_m, bike_km, run_km }
--
-- Ces colonnes sont GÉNÉRÉES (generated always ... stored) : elles se
-- remplissent/mettent à jour toutes seules à chaque écriture du jsonb.
-- Zéro changement côté app, données lisibles et requêtables en SQL.
-- ============================================================

-- ---------- activity_planned (compétitions/séances prévues) ----------
alter table public.activity_planned
  add column if not exists tri_swim_min  numeric generated always as ((tri->'swim'->>'min')::numeric) stored,
  add column if not exists tri_swim_m    numeric generated always as (coalesce((tri->'swim'->>'dist_m')::numeric, (tri->>'swim_m')::numeric)) stored,
  add column if not exists tri_swim_pace text    generated always as (tri->'swim'->>'pace') stored,
  add column if not exists tri_t1_min    numeric generated always as ((tri->>'t1_min')::numeric) stored,
  add column if not exists tri_bike_min  numeric generated always as ((tri->'bike'->>'min')::numeric) stored,
  add column if not exists tri_bike_km   numeric generated always as (coalesce((tri->'bike'->>'dist_km')::numeric, (tri->>'bike_km')::numeric)) stored,
  add column if not exists tri_bike_kmh  numeric generated always as ((tri->'bike'->>'speed')::numeric) stored,
  add column if not exists tri_bike_dplus numeric generated always as ((tri->'bike'->>'dplus')::numeric) stored,
  add column if not exists tri_t2_min    numeric generated always as ((tri->>'t2_min')::numeric) stored,
  add column if not exists tri_run_min   numeric generated always as ((tri->'run'->>'min')::numeric) stored,
  add column if not exists tri_run_km    numeric generated always as (coalesce((tri->'run'->>'dist_km')::numeric, (tri->>'run_km')::numeric)) stored,
  add column if not exists tri_run_pace  text    generated always as (tri->'run'->>'pace') stored;

-- ---------- activities (compétitions/événements réalisés) ----------
alter table public.activities
  add column if not exists tri_swim_min  numeric generated always as ((tri->'swim'->>'min')::numeric) stored,
  add column if not exists tri_swim_m    numeric generated always as (coalesce((tri->'swim'->>'dist_m')::numeric, (tri->>'swim_m')::numeric)) stored,
  add column if not exists tri_swim_pace text    generated always as (tri->'swim'->>'pace') stored,
  add column if not exists tri_t1_min    numeric generated always as ((tri->>'t1_min')::numeric) stored,
  add column if not exists tri_bike_min  numeric generated always as ((tri->'bike'->>'min')::numeric) stored,
  add column if not exists tri_bike_km   numeric generated always as (coalesce((tri->'bike'->>'dist_km')::numeric, (tri->>'bike_km')::numeric)) stored,
  add column if not exists tri_bike_kmh  numeric generated always as ((tri->'bike'->>'speed')::numeric) stored,
  add column if not exists tri_bike_dplus numeric generated always as ((tri->'bike'->>'dplus')::numeric) stored,
  add column if not exists tri_t2_min    numeric generated always as ((tri->>'t2_min')::numeric) stored,
  add column if not exists tri_run_min   numeric generated always as ((tri->'run'->>'min')::numeric) stored,
  add column if not exists tri_run_km    numeric generated always as (coalesce((tri->'run'->>'dist_km')::numeric, (tri->>'run_km')::numeric)) stored,
  add column if not exists tri_run_pace  text    generated always as (tri->'run'->>'pace') stored;

-- ########## 2026-07-09_category_set_by_user.sql ##########
-- ============================================================
-- Catégorie choisie par l'utilisateur vs posée automatiquement.
--
-- La synchro Strava peut reclasser en 'competition' les activités
-- marquées « Course » sur Strava (workout_type Ride 11 / Run 1),
-- mais UNIQUEMENT celles dont la catégorie n'a jamais été choisie
-- explicitement par l'utilisateur (transformation manuelle).
--
-- Backfill : les compétitions actuelles sont toutes issues de
-- transformations manuelles -> protégées.
-- ============================================================

alter table public.activities
  add column if not exists category_set_by_user boolean not null default false;

update public.activities
  set category_set_by_user = true
  where category = 'competition' and category_set_by_user = false;

-- ########## 2026-07-09b_results_bdd.sql ##########
-- ============================================================
-- Résultats de course en base (plus seulement en localStorage).
--
-- 1) Résultat saisi MANUELLEMENT : colonnes sur activities
--    (la compétition EST l'activité — modèle source unique).
-- 2) Préférences Open Dossard : associations manuelles
--    compet <-> résultat et résultats masqués, une ligne par user.
-- ============================================================

-- ---------- 1) Résultat manuel sur l'activité ----------
alter table public.activities
  add column if not exists result_place  integer,
  add column if not exists result_total  integer,
  add column if not exists result_catev  text;

-- ---------- 2) Préférences Open Dossard ----------
create table if not exists public.od_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  overrides  jsonb not null default '{}'::jsonb,  -- { compId: odResultId | null }
  hidden     jsonb not null default '[]'::jsonb,  -- [ odResultId, ... ]
  updated_at timestamptz not null default now()
);

alter table public.od_prefs enable row level security;

drop policy if exists "od_prefs_own" on public.od_prefs;
create policy "od_prefs_own" on public.od_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ########## 2026-07-09c_compet_federation.sql ##########
-- ============================================================
-- Compétitions : structuration détaillée pour filtres futurs.
--   federation : FFC / UFOLEP / FSGT / FFA / FFTri / FFN / Autre
--   race_level : niveau/catégorie d'épreuve (Open 1-3, Access 3-4,
--                2e-3e cat UFOLEP, label FFA...)
--   tri_format : XS / S / M / L / XL (triathlon et enchaînements)
-- Sur les deux tables (prévu + réalisé), modèle source unique.
-- ============================================================

alter table public.activity_planned
  add column if not exists federation text,
  add column if not exists race_level text,
  add column if not exists tri_format text;

alter table public.activities
  add column if not exists federation text,
  add column if not exists race_level text,
  add column if not exists tri_format text;

-- ########## 2026-07-10_result_url.sql ##########
-- ============================================================
-- Résultat manuel : lien vers les résultats officiels (page web).
-- Complète result_place / result_total / result_catev (2026-07-09b).
-- ============================================================

alter table public.activities
  add column if not exists result_url text;

-- ########## 2026-07-11_tri_fusion.sql ##########
-- ============================================================
-- Fusion multisport : un triathlon réalisé (3 activités Strava)
-- devient UNE activité. La ligne fusionnée est une activité
-- normale (sport Triathlon, jsonb tri rempli) ; les étapes
-- d'origine restent en base (streams intacts) mais pointent
-- vers leur parent via merged_into et sont exclues de
-- l'affichage et des daily_metrics.
--
-- on delete set null : supprimer la ligne fusionnée refait
-- automatiquement apparaître les 3 étapes.
-- ============================================================

alter table public.activities
  add column if not exists merged_into uuid references public.activities(id) on delete set null;

create index if not exists activities_merged_into_idx
  on public.activities(merged_into) where merged_into is not null;

-- ########## 2026-07-13_planned_est.sql ##########
-- Données dérivées de la structure (ou de temps+distance) d'une séance PRÉVUE.
-- Une colonne par donnée, remplies au save, affichées telles quelles.
-- est_speed est LA colonne vitesse/allure : numérique en km/h pour tous les
-- sports ; l'affichage convertit (min/km course, min/100m natation, km/h vélo).

alter table activity_planned add column if not exists est_watts int;
alter table activity_planned add column if not exists est_bpm   int;
alter table activity_planned add column if not exists est_kj    int;
alter table activity_planned add column if not exists est_if    numeric;
alter table activity_planned add column if not exists est_speed numeric;

alter table activity_template add column if not exists est_watts int;
alter table activity_template add column if not exists est_bpm   int;
alter table activity_template add column if not exists est_kj    int;
alter table activity_template add column if not exists est_if    numeric;
alter table activity_template add column if not exists est_speed numeric;

-- unification : est_pace (texte) remplacé par est_speed (km/h numérique)
alter table activity_planned drop column if exists est_pace;
alter table activity_template drop column if exists est_pace;

-- nettoyage d'essais précédents
alter table activity_planned drop column if exists est;
alter table activities drop column if exists est;

-- ########## 2026-09-23_garmin_sleep.sql ##########
-- ============================================================
-- 2026-09-23_garmin_sleep.sql — Intégration Garmin (sommeil)
--
-- Garmin n'a pas de portail OAuth développeur public comme Strava/Whoop :
-- la connexion se fait une fois via un login manuel (garth/garminconnect),
-- puis le refresh du token d'accès se fait par une signature OAuth1
-- HMAC-SHA1 (oauth1_token/oauth1_secret), pas par un refresh_token
-- classique. D'où les deux colonnes dédiées sur connexions_app.
-- ============================================================

-- 1) connexions_app : autoriser 'garmin' dans la contrainte app,
--    quel que soit son nom généré (recherche dynamique par définition).
do $$
declare
  cons record;
begin
  for cons in
    select conname
    from pg_constraint
    where conrelid = 'public.connexions_app'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%app%strava%whoop%'
  loop
    execute format('alter table public.connexions_app drop constraint %I', cons.conname);
  end loop;
end $$;

alter table public.connexions_app
  add constraint connexions_app_app_check check (app in ('strava', 'whoop', 'garmin'));

alter table public.connexions_app add column if not exists oauth1_token text;
alter table public.connexions_app add column if not exists oauth1_secret text;

-- Garmin n'a pas de refresh_token classique (renouvellement via oauth1_token/
-- oauth1_secret à la place) : la colonne reste utilisée par strava/whoop,
-- juste plus obligatoire pour garmin.
alter table public.connexions_app alter column refresh_token drop not null;

-- 2) garmin_sleep : une ligne par nuit, même convention que whoop_data.
create table if not exists public.garmin_sleep (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  bedtime text,
  wake_time text,
  total_sec integer,
  deep_sec integer,
  light_sec integer,
  rem_sec integer,
  awake_sec integer,
  awake_count integer,
  restless_count integer,
  avg_stress numeric,
  avg_heart_rate numeric,
  body_battery_change integer,
  resp_avg numeric,
  resp_min numeric,
  resp_max numeric,
  spo2_avg numeric,
  spo2_min numeric,
  hrv_avg numeric,
  hrv_status text,
  score integer,
  score_qualifier text,
  score_detail jsonb,
  segments jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.garmin_sleep enable row level security;

drop policy if exists "garmin_sleep_select_own" on public.garmin_sleep;
create policy "garmin_sleep_select_own" on public.garmin_sleep
  for select using (auth.uid() = user_id);

drop policy if exists "garmin_sleep_insert_own" on public.garmin_sleep;
create policy "garmin_sleep_insert_own" on public.garmin_sleep
  for insert with check (auth.uid() = user_id);

drop policy if exists "garmin_sleep_update_own" on public.garmin_sleep;
create policy "garmin_sleep_update_own" on public.garmin_sleep
  for update using (auth.uid() = user_id);

drop policy if exists "garmin_sleep_delete_own" on public.garmin_sleep;
create policy "garmin_sleep_delete_own" on public.garmin_sleep
  for delete using (auth.uid() = user_id);

create index if not exists idx_garmin_sleep_user_date on public.garmin_sleep(user_id, date);

-- ########## 2026-09-24_garmin_hr_stream.sql ##########
-- ============================================================
-- 2026-09-24_garmin_hr_stream.sql — stream FC nocturne Garmin
--
-- hr_stream = tableau [minute_depuis_coucher, bpm][], recoupé sur la
-- fenêtre de sommeil réelle (endpoint dailyHeartRate, ~2 min de résolution).
-- Même convention minute-offset que la colonne segments (hypnogramme).
-- ============================================================

alter table public.garmin_sleep add column if not exists hr_stream jsonb;

-- ########## 2026-09-24_garmin_resting_hr.sql ##########
-- ============================================================
-- 2026-09-24_garmin_resting_hr.sql — FC de repos (RHR) Garmin
--
-- avg_heart_rate (déjà en base) = FC moyenne pendant la fenêtre de
-- sommeil (endpoint dailySleepData). resting_heart_rate = FC de repos
-- au sens Garmin (endpoint usersummary/daily, champ restingHeartRate),
-- une métrique distincte — généralement la valeur la plus basse
-- soutenue sur la journée, pas juste la moyenne nocturne.
-- ============================================================

alter table public.garmin_sleep add column if not exists resting_heart_rate integer;

-- ########## 2026-10-10_drop_whoop.sql ##########
-- Retrait de Whoop : la table whoop_data (vide) disparaît et les états OAuth
-- ne concernent plus que Strava.

drop table if exists public.whoop_data;
drop table if exists public.whoop_connections;

delete from public.oauth_states where provider = 'whoop';
delete from public.connexions_app where app = 'whoop';

alter table public.oauth_states drop constraint if exists oauth_states_provider_check;
alter table public.oauth_states add constraint oauth_states_provider_check check (provider in ('strava'));

-- ########## 2026-10-10_oauth_states.sql ##########
-- État OAuth à usage unique (Strava / Whoop).
-- Remplace le JWT Supabase qui voyageait dans le paramètre `state` de l'URL.
-- Écrit par la fonction `oauth-start`, consommé (supprimé) par les callbacks.
-- Aucune policy : seules les Edge Functions (service_role) y accèdent.

create table if not exists public.oauth_states (
  state       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  provider    text not null check (provider in ('strava', 'whoop')),
  return_url  text not null,
  created_at  timestamptz not null default now()
);

create index if not exists oauth_states_created_at_idx on public.oauth_states (created_at);

alter table public.oauth_states enable row level security;

revoke all on public.oauth_states from anon, authenticated;

-- ########## 2026-10-11_remove_coach_system.sql ##########
-- Retrait du système de coaching humain (coach <-> athlète) + durcissement.
-- Relançable sans risque. Ordre important : les policies d'abord, les tables ensuite.
--
-- Contexte : l'audit RLS du 2026-10-11 a montré qu'un utilisateur connecté pouvait
-- s'attribuer le rôle de coach actif de n'importe quel compte (INSERT direct avec
-- status 'active' par défaut, ou UPDATE de 'pending' vers 'active'). Le système est
-- supprimé : chacun ne voit plus que ses propres données.

-- 1) profiles : on garde la lecture de son propre profil, sans passer par le coaching.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- 2) Supprime toutes les policies « coach » restantes (celles qui appellent is_coach_of).
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ilike '%is_coach_of%' or coalesce(with_check, '') ilike '%is_coach_of%')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 3) Tables du coaching.
drop table if exists public.messages;
drop table if exists public.coach_athlete;

-- 4) Fonctions du coaching.
drop function if exists public.is_coach_of(uuid);
drop function if exists public.add_athlete_by_email(text);
drop function if exists public.my_pending_invites();

-- 5) recalc_daily_metrics(uuid) acceptait n'importe quel user_id sans contrôle :
--    réservée aux triggers et à service_role.
revoke execute on function public.recalc_daily_metrics(uuid) from public, anon, authenticated;

-- 6) Droits de table : TRUNCATE / REFERENCES / TRIGGER ne servent à personne côté
--    navigateur (et TRUNCATE ignore la RLS) ; anon n'a besoin d'aucune table.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;

-- ########## 2026-10-12_drop_app_mode.sql ##########
-- Retire user_profiles.app_mode : le choix Manuel/IA a été supprimé de l'app
-- (commit d251066), plus aucun code ne lit ni n'écrit cette colonne.
-- Relançable sans risque ; la contrainte check liée à la colonne part avec elle.
alter table public.user_profiles drop column if exists app_mode;

-- ########## 2026-10-12_garmin_sync_requests.sql ##########
-- Demandes de synchro Garmin « à la demande » (bouton Synchroniser de l'appli).
-- Relançable sans risque.
--
-- Principe : Garmin refuse les serveurs (Supabase, GitHub), donc la synchro tourne
-- sur un Raspberry Pi chez toi. L'appli ne peut pas l'appeler directement : elle
-- écrit une ligne 'pending' ici, le Pi la lit (cron chaque minute, requête sortante
-- uniquement : aucun port ouvert), synchronise, puis marque 'done' ou 'error'.
--
-- Sécurité :
--   - RLS : chacun ne lit et ne crée que ses propres demandes.
--   - Le navigateur ne peut insérer QUE user_id : status, résultat et dates sont
--     posés par la base ou par le Pi (service_role). Pas d'UPDATE ni de DELETE côté
--     navigateur, donc impossible de truquer un résultat.
--   - Une seule demande active par utilisateur (index unique partiel) : pas de spam.

create table if not exists public.garmin_sync_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'error')),
  requested_at timestamptz not null default now(),
  finished_at timestamptz,
  nights integer,
  error text
);

-- Une seule demande en attente ou en cours par utilisateur.
create unique index if not exists uniq_garmin_sync_requests_active
  on public.garmin_sync_requests (user_id)
  where status in ('pending', 'running');

create index if not exists idx_garmin_sync_requests_user
  on public.garmin_sync_requests (user_id, requested_at desc);

alter table public.garmin_sync_requests enable row level security;

drop policy if exists "garmin_sync_requests_select_own" on public.garmin_sync_requests;
create policy "garmin_sync_requests_select_own" on public.garmin_sync_requests
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "garmin_sync_requests_insert_own" on public.garmin_sync_requests;
create policy "garmin_sync_requests_insert_own" on public.garmin_sync_requests
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Droits de table : lecture, et insertion de la seule colonne user_id.
revoke all on public.garmin_sync_requests from public, anon, authenticated;
grant select on public.garmin_sync_requests to authenticated;
grant insert (user_id) on public.garmin_sync_requests to authenticated;

-- Arrêt de l'ancienne synchro horaire (Edge Function garmin-ingest, supprimée du code).
-- Sans effet si pg_cron n'est pas installé ou si le job n'existe plus.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where command ilike '%garmin-ingest%';
  end if;
end $$;
