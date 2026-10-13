-- =====================================================================================================================
-- Coach IA — Base de données V2 : SCHÉMA (PROPOSITION, jamais appliquée)
--
-- Se lit avec docs/db/PROPOSITION_V2.md. Conçu pour être exécuté sur une base où les anciennes tables ont été déplacées
-- dans le schéma `legacy` (voir 03_migrate_from_legacy.sql) ; il crée tout dans `public` (exposé à l'API) et `private`
-- (jamais exposé : secrets, états OAuth, fonctions internes).
--
-- Conventions
--   noms          : anglais, snake_case, tables au pluriel, clé primaire `id uuid`, clé étrangère `<table_singulier>_id`
--   unités        : suffixe obligatoire (_s secondes, _m mètres, _w watts, _bpm, _kg, _j joules, _pct…) ; entiers partout
--   dates/heures  : `started_at timestamptz` = vrai instant UTC ; `local_date date` = jour civil vu par l'athlète
--   propriétaire  : colonne `user_id uuid not null default auth.uid()` + clé étrangère vers auth.users ON DELETE CASCADE
--   sécurité      : RLS sur toute table de `public` (private.protect), aucun droit pour `anon`, aucun TRUNCATE/TRIGGER/REFERENCES
--   intégrité     : clés étrangères partout, CHECK sur les valeurs fermées et les bornes, UNIQUE sur les clés naturelles
--   tables liées  : clé étrangère composite (parent_id, user_id) → impossible de rattacher une ligne à l'objet d'un autre
-- =====================================================================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 0. Outils internes
-- ---------------------------------------------------------------------------------------------------------------------

-- Met à jour updated_at à chaque modification
create or replace function private.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Protège une table de `public` de façon uniforme. Modes :
--   rw          : l'utilisateur lit et écrit SES lignes
--   ro          : l'utilisateur lit SES lignes (écriture réservée au serveur : service_role)
--   insert_read : l'utilisateur lit et ajoute SES lignes (jamais de modification)
--   ref         : donnée de référence lisible par tout utilisateur connecté, écriture réservée au serveur
create or replace function private.protect(p_table regclass, p_mode text default 'rw', p_owner text default 'user_id')
returns void language plpgsql as $$
declare
  v_pred text := format('(select auth.uid()) = %I', p_owner);
begin
  execute format('alter table %s enable row level security', p_table);
  -- Supabase accorde par défaut tous les droits à `authenticated` : on repart de zéro pour ne donner que le nécessaire
  execute format('revoke all on %s from public, anon, authenticated', p_table);
  if p_mode = 'rw' then
    execute format('grant select, insert, update, delete on %s to authenticated', p_table);
    execute format('create policy own_rows on %s for all to authenticated using (%s) with check (%s)', p_table, v_pred, v_pred);
  elsif p_mode = 'ro' then
    execute format('grant select on %s to authenticated', p_table);
    execute format('create policy own_rows_read on %s for select to authenticated using (%s)', p_table, v_pred);
  elsif p_mode = 'insert_read' then
    execute format('grant select, insert on %s to authenticated', p_table);
    execute format('create policy own_rows_read on %s for select to authenticated using (%s)', p_table, v_pred);
    execute format('create policy own_rows_insert on %s for insert to authenticated with check (%s)', p_table, v_pred);
  elsif p_mode = 'ref' then
    execute format('grant select on %s to authenticated', p_table);
    execute format('create policy read_all on %s for select to authenticated using (true)', p_table);
  else
    raise exception 'private.protect : mode inconnu %', p_mode;
  end if;
end $$;

-- Pose le déclencheur updated_at sur une table
create or replace function private.touch(p_table regclass) returns void language plpgsql as $$
begin
  execute format('create trigger set_updated_at before update on %s for each row execute function private.set_updated_at()', p_table);
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Référentiels (sports)
-- ---------------------------------------------------------------------------------------------------------------------

create table public.sports (
  code   text primary key check (code ~ '^[a-z][a-z0-9_]*$'),
  label  text not null,
  family text not null check (family in ('run', 'ride', 'swim', 'strength', 'hybrid', 'other')),
  sort   smallint not null default 100
);
comment on table public.sports is 'Sports connus de l''app. `family` pilote la couleur et les regroupements (course, vélo, natation, muscu, hybride).';

create table public.sport_aliases (
  provider   text not null check (provider in ('strava', 'garmin', 'app', 'legacy')),
  raw        text not null,
  sport_code text not null references public.sports (code),
  primary key (provider, raw)
);
comment on table public.sport_aliases is 'Traduit le type de sport brut d''un fournisseur (ex. Strava « TrailRun ») en code interne.';

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Profil et réglages
-- ---------------------------------------------------------------------------------------------------------------------

-- Identité (une ligne par utilisateur ; créée automatiquement à l'inscription)
create table public.profiles (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  first_name   text check (char_length(first_name) <= 80),
  last_name    text check (char_length(last_name) <= 80),
  avatar_url   text check (char_length(avatar_url) <= 500),
  locale       text not null default 'fr' check (locale in ('fr', 'en')),
  timezone     text not null default 'Europe/Paris' check (char_length(timezone) between 3 and 64),
  birth_date   date check (birth_date between date '1900-01-01' and current_date),
  sex          text check (sex in ('f', 'm')),
  height_cm    smallint check (height_cm between 80 and 250),
  city         text check (char_length(city) <= 80),
  country      text check (char_length(country) <= 80),
  club         text check (char_length(club) <= 120),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Seuils physiologiques HISTORISÉS : le FTP d'il y a un an n'est pas celui d'aujourd'hui. La valeur courante = la plus récente.
create table public.athlete_thresholds (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  valid_from    date not null default current_date,
  ftp_w         smallint check (ftp_w between 30 and 700),
  cp_w          smallint check (cp_w between 30 and 700),
  w_prime_j     integer check (w_prime_j between 1000 and 100000),
  pmax_w        smallint check (pmax_w between 100 and 3000),
  hr_max_bpm    smallint check (hr_max_bpm between 100 and 250),
  hr_rest_bpm   smallint check (hr_rest_bpm between 25 and 120),
  lthr_bpm      smallint check (lthr_bpm between 80 and 230),
  weight_kg     numeric(4, 1) check (weight_kg between 25 and 250),
  vma_kmh       numeric(3, 1) check (vma_kmh between 5 and 30),
  vo2max_run    numeric(3, 1) check (vo2max_run between 15 and 95),
  vo2max_bike   numeric(3, 1) check (vo2max_bike between 15 and 95),
  css_s_per_100m smallint check (css_s_per_100m between 40 and 300),
  extra         jsonb not null default '{}'::jsonb check (jsonb_typeof(extra) = 'object' and pg_column_size(extra) < 8192),
  created_at    timestamptz not null default now(),
  unique (user_id, valid_from)
);
comment on column public.athlete_thresholds.extra is 'Valeurs de référence rarement utilisées (allures de référence 5 km/10 km…), objet JSON plafonné.';

-- Réglages d'interface (une ligne par utilisateur) : fusion de preferences + user_dashboard + od_prefs
create table public.user_settings (
  user_id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  ui               jsonb not null default '{}'::jsonb check (jsonb_typeof(ui) = 'object' and pg_column_size(ui) < 8192),
  dashboard_layout jsonb check (dashboard_layout is null or (jsonb_typeof(dashboard_layout) = 'object' and pg_column_size(dashboard_layout) < 16384)),
  opendossard      jsonb not null default '{}'::jsonb check (jsonb_typeof(opendossard) = 'object' and pg_column_size(opendossard) < 16384),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Connexions aux services (Strava, Garmin) — les secrets ne sont JAMAIS dans une table lisible par le navigateur
-- ---------------------------------------------------------------------------------------------------------------------

create table public.connections (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider          text not null check (provider in ('strava', 'garmin')),
  external_user_id  text,
  display_name      text,
  scopes            text[] not null default '{}',
  status            text not null default 'connected' check (status in ('connected', 'error', 'revoked')),
  connected_at      timestamptz not null default now(),
  last_sync_at      timestamptz,
  last_sync_status  text check (last_sync_status in ('running', 'ok', 'error')),
  last_sync_error   text check (char_length(last_sync_error) <= 500),
  activities_synced integer not null default 0 check (activities_synced >= 0),
  updated_at        timestamptz not null default now(),
  unique (user_id, provider),
  unique (id, user_id)
);
create index connections_provider_external_idx on public.connections (provider, external_user_id);
comment on table public.connections is 'État PUBLIC d''une connexion (aucun secret). Les jetons sont dans private.connection_secrets (chiffrés par Vault).';

-- Les jetons : un pointeur vers Supabase Vault (chiffré au repos), lisible uniquement par le serveur
create table private.connection_secrets (
  connection_id   uuid primary key references public.connections (id) on delete cascade,
  vault_secret_id uuid not null,
  expires_at      timestamptz,
  updated_at      timestamptz not null default now()
);
comment on table private.connection_secrets is 'Pointeur vers vault.secrets (JSON des jetons du fournisseur). Jamais exposé par l''API.';

-- États OAuth à usage unique (anti-CSRF)
create table private.oauth_states (
  state      text primary key check (char_length(state) >= 32),
  user_id    uuid not null references auth.users (id) on delete cascade,
  provider   text not null check (provider in ('strava', 'garmin')),
  return_url text not null,
  created_at timestamptz not null default now()
);
create index oauth_states_created_idx on private.oauth_states (created_at);

-- Demandes de synchronisation (bouton « Synchroniser » → Raspberry Pi) ; une seule demande active par utilisateur et service
create table public.sync_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider     text not null default 'garmin' check (provider in ('garmin', 'strava')),
  status       text not null default 'pending' check (status in ('pending', 'running', 'done', 'error')),
  requested_at timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz,
  items_synced integer check (items_synced >= 0),
  error        text check (char_length(error) <= 300)
);
create unique index sync_requests_one_active on public.sync_requests (user_id, provider) where status in ('pending', 'running');
create index sync_requests_user_idx on public.sync_requests (user_id, requested_at desc);

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Parcours (GPX), événements (compétitions) et séances prévues
-- ---------------------------------------------------------------------------------------------------------------------

create table public.routes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 200),
  gpx               text not null check (char_length(gpx) <= 5000000),
  distance_m        integer check (distance_m >= 0),
  elevation_gain_m  integer check (elevation_gain_m >= 0),
  created_at        timestamptz not null default now(),
  unique (id, user_id)
);

create table public.events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 200),
  event_date        date not null,
  start_time        time,
  sport_code        text not null references public.sports (code),
  priority          char(1) check (priority in ('A', 'B', 'C')),
  kind              text check (char_length(kind) <= 60),
  distance_m        integer check (distance_m >= 0),
  elevation_gain_m  integer check (elevation_gain_m >= 0),
  target_duration_s integer check (target_duration_s > 0),
  route_id          uuid,
  notes             text check (char_length(notes) <= 2000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, user_id),
  foreign key (route_id, user_id) references public.routes (id, user_id) on delete set null (route_id)
);
create index events_user_date_idx on public.events (user_id, event_date);
comment on table public.events is 'Compétitions et objectifs datés. La course réalisée est une activité qui pointe vers l''événement (activities.event_id).';

-- Étapes (course par étapes) ou disciplines (triathlon) d'un événement
create table public.event_segments (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null,
  user_id           uuid not null default auth.uid(),
  position          smallint not null check (position between 1 and 50),
  kind              text not null check (kind in ('stage', 'leg')),
  name              text check (char_length(name) <= 120),
  segment_date      date,
  sport_code        text references public.sports (code),
  distance_m        integer check (distance_m >= 0),
  elevation_gain_m  integer check (elevation_gain_m >= 0),
  target_duration_s integer check (target_duration_s > 0),
  unique (event_id, position),
  foreign key (event_id, user_id) references public.events (id, user_id) on delete cascade
);

create table public.workout_templates (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 120),
  sport_code        text not null references public.sports (code),
  duration_s        integer check (duration_s > 0),
  target_load       numeric(6, 1) check (target_load >= 0),
  rpe               numeric(3, 1) check (rpe between 1 and 10),
  distance_m        integer check (distance_m >= 0),
  elevation_gain_m  integer check (elevation_gain_m >= 0),
  description       text check (char_length(description) <= 2000),
  structure         jsonb check (structure is null or (jsonb_typeof(structure) = 'array' and pg_column_size(structure) < 65536)),
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, user_id)
);

create table public.planned_workouts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  planned_on        date not null,
  start_time        time,
  name              text not null check (char_length(name) between 1 and 200),
  sport_code        text not null references public.sports (code),
  duration_s        integer check (duration_s > 0),
  target_load       numeric(6, 1) check (target_load >= 0),
  rpe               numeric(3, 1) check (rpe between 1 and 10),
  distance_m        integer check (distance_m >= 0),
  elevation_gain_m  integer check (elevation_gain_m >= 0),
  notes             text check (char_length(notes) <= 2000),
  structure         jsonb check (structure is null or (jsonb_typeof(structure) = 'array' and pg_column_size(structure) < 65536)),
  route_id          uuid,
  template_id       uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, user_id),
  foreign key (route_id, user_id) references public.routes (id, user_id) on delete set null (route_id),
  foreign key (template_id, user_id) references public.workout_templates (id, user_id) on delete set null (template_id)
);
create index planned_workouts_user_date_idx on public.planned_workouts (user_id, planned_on);

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Activités réalisées (cœur) et leurs tables annexes
-- ---------------------------------------------------------------------------------------------------------------------

create table public.activities (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source            text not null check (source in ('strava', 'garmin', 'manual', 'import')),
  external_id       text check (char_length(external_id) <= 64),
  sport_code        text not null references public.sports (code),
  sport_raw         text check (char_length(sport_raw) <= 60),
  name              text not null check (char_length(name) between 1 and 200),
  started_at        timestamptz not null,
  utc_offset_min    smallint check (utc_offset_min between -840 and 840),
  local_date        date generated always as (((started_at at time zone 'UTC') + make_interval(mins => coalesce(utc_offset_min, 0)))::date) stored,
  duration_s        integer check (duration_s >= 0),
  elapsed_s         integer check (elapsed_s >= 0),
  distance_m        integer check (distance_m >= 0),
  elevation_gain_m  integer check (elevation_gain_m >= 0),
  max_speed_ms      numeric(5, 2) check (max_speed_ms >= 0),
  hr_avg_bpm        smallint check (hr_avg_bpm between 20 and 255),
  hr_max_bpm        smallint check (hr_max_bpm between 20 and 255),
  power_avg_w       smallint check (power_avg_w between 0 and 3000),
  power_max_w       smallint check (power_max_w between 0 and 4000),
  cadence_avg_rpm   smallint check (cadence_avg_rpm between 0 and 300),
  energy_kj         integer check (energy_kj >= 0),
  calories          integer check (calories >= 0),
  training_load     numeric(6, 1) check (training_load >= 0),
  ftp_w_at_time     smallint check (ftp_w_at_time between 30 and 700),
  rpe               numeric(3, 1) check (rpe between 1 and 10),
  notes             text check (char_length(notes) <= 4000),
  event_id          uuid,
  planned_workout_id uuid,
  is_race           boolean not null default false,
  is_race_user_set  boolean not null default false,
  is_hidden         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, user_id),
  foreign key (event_id, user_id) references public.events (id, user_id) on delete set null (event_id),
  foreign key (planned_workout_id, user_id) references public.planned_workouts (id, user_id) on delete set null (planned_workout_id)
);
-- Idempotence de la synchro : une activité d'un fournisseur n'existe qu'une fois par utilisateur
create unique index activities_provider_external_uq on public.activities (user_id, source, external_id) where external_id is not null;
create index activities_user_day_idx on public.activities (user_id, local_date desc);
create index activities_user_sport_idx on public.activities (user_id, sport_code, local_date desc);
create index activities_event_idx on public.activities (event_id) where event_id is not null;
comment on column public.activities.started_at is 'Vrai instant de départ (UTC). Le jour vu par l''athlète est local_date.';
comment on column public.activities.is_hidden is 'Activité masquée par l''utilisateur (remplace strava_ignored) : exclue des calculs et des listes.';

-- Mesures dérivées (calculées par le serveur) : typées, versionnées par le moteur
create table public.activity_metrics (
  activity_id   uuid primary key,
  user_id       uuid not null default auth.uid(),
  engine_version smallint not null default 1,
  np_w          smallint,
  if_ratio      numeric(4, 3),
  tss           numeric(6, 1),
  trimp         smallint,
  hrr_bpm       smallint,
  pmax_w        smallint,
  cp_w          smallint,
  w_prime_j     integer,
  eftp_w        smallint,
  wbal_used_kj  numeric(5, 1),
  cho_g         smallint,
  work_over_ftp_kj numeric(6, 1),
  polarization_index numeric(4, 2),
  polarization_class text,
  power_curve   jsonb check (power_curve is null or jsonb_typeof(power_curve) = 'object'),
  updated_at    timestamptz not null default now(),
  foreign key (activity_id, user_id) references public.activities (id, user_id) on delete cascade
);

-- Courbes seconde par seconde : table à part pour que les listes d'activités restent légères (bytea = 25 % plus compact que le base64)
create table public.activity_streams (
  activity_id uuid primary key,
  user_id     uuid not null default auth.uid(),
  encoding    text not null default 'gzip-json-v1' check (encoding in ('gzip-json-v1')),
  payload     bytea not null,
  bytes       integer generated always as (octet_length(payload)) stored,
  synced_at   timestamptz not null default now(),
  foreign key (activity_id, user_id) references public.activities (id, user_id) on delete cascade
);

-- Retouches de l'utilisateur sur une activité synchronisée (la synchro ne les écrase jamais)
create table public.activity_overrides (
  activity_id      uuid primary key,
  user_id          uuid not null default auth.uid(),
  name             text check (char_length(name) between 1 and 200),
  sport_code       text references public.sports (code),
  duration_s       integer check (duration_s >= 0),
  distance_m       integer check (distance_m >= 0),
  elevation_gain_m integer check (elevation_gain_m >= 0),
  training_load    numeric(6, 1) check (training_load >= 0),
  rpe              numeric(3, 1) check (rpe between 1 and 10),
  notes            text check (char_length(notes) <= 4000),
  updated_at       timestamptz not null default now(),
  foreign key (activity_id, user_id) references public.activities (id, user_id) on delete cascade
);

-- Résultat d'une course (0 ou 1 par activité de course)
create table public.race_results (
  activity_id uuid primary key,
  user_id     uuid not null default auth.uid(),
  place       integer check (place > 0),
  total       integer check (total > 0),
  category    text check (char_length(category) <= 30),
  url         text check (char_length(url) <= 500),
  updated_at  timestamptz not null default now(),
  check (place is null or total is null or place <= total),
  foreign key (activity_id, user_id) references public.activities (id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Charge et records
-- ---------------------------------------------------------------------------------------------------------------------

-- Une ligne par jour entre la 1re et la dernière activité (la forme se lit avec ctl − atl). Écrite uniquement par le serveur.
create table public.daily_load (
  user_id          uuid not null references auth.users (id) on delete cascade,
  day              date not null,
  load             numeric(6, 1) not null default 0 check (load >= 0),
  duration_s       integer not null default 0 check (duration_s >= 0),
  activities       smallint not null default 0 check (activities >= 0),
  main_activity_id uuid references public.activities (id) on delete set null,
  ctl              numeric not null default 0,   -- précision complète (comme l'ancien moteur) : le calcul incrémental repart de la valeur exacte de la veille
  atl              numeric not null default 0,
  primary key (user_id, day)
);
comment on table public.daily_load is 'Charge du jour et courbes de forme (CTL sur 42 jours, ATL sur 7 jours). Recalculée de façon INCRÉMENTALE par private.refresh_daily_load.';

-- Meilleures puissances : format long (une ligne par sport/durée/fenêtre), à la place de 57 colonnes
create table public.power_bests (
  user_id      uuid not null references auth.users (id) on delete cascade,
  scope        text not null check (scope in ('all', 'run', 'ride', 'swim', 'strength', 'hybrid', 'other')),
  duration_s   integer not null check (duration_s > 0),
  time_window  text not null check (time_window in ('all_time', 'last_90d')),
  watts        smallint not null check (watts > 0),
  activity_id  uuid references public.activities (id) on delete set null,
  achieved_on  date,
  updated_at   timestamptz not null default now(),
  primary key (user_id, scope, duration_s, time_window)
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. Calendrier : notes, repos, phases, objectifs annuels
-- ---------------------------------------------------------------------------------------------------------------------

create table public.calendar_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null default 'note' check (kind in ('note', 'illness', 'injury')),
  from_date  date not null,
  to_date    date not null,
  body       text check (char_length(body) <= 500),
  color      text check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (to_date >= from_date and to_date - from_date <= 366)
);
create index calendar_notes_user_range_idx on public.calendar_notes (user_id, from_date, to_date);

create table public.rest_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);

create table public.training_phases (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  phase     text not null check (phase in ('base', 'build', 'peak', 'taper', 'recovery')),
  name      text check (char_length(name) <= 120),
  from_date date not null,
  to_date   date not null,
  check (to_date >= from_date)
);
create index training_phases_user_range_idx on public.training_phases (user_id, from_date, to_date);

create table public.yearly_goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year           smallint not null check (year between 2000 and 2100),
  sport_code     text not null references public.sports (code),
  metric         text not null check (char_length(metric) between 1 and 60),
  target         numeric(12, 2) not null check (target > 0),
  current_manual numeric(12, 2) check (current_manual >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, year, sport_code, metric)
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. Sommeil (Garmin)
-- ---------------------------------------------------------------------------------------------------------------------

create table public.sleep_nights (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  night_date          date not null,
  bedtime_at          timestamptz,
  wake_at             timestamptz,
  total_s             integer check (total_s between 0 and 86400),
  deep_s              integer check (deep_s between 0 and 86400),
  light_s             integer check (light_s between 0 and 86400),
  rem_s               integer check (rem_s between 0 and 86400),
  awake_s             integer check (awake_s between 0 and 86400),
  awake_count         smallint check (awake_count >= 0),
  restless_count      smallint check (restless_count >= 0),
  stress_avg          numeric(4, 1),
  hr_avg_bpm          numeric(4, 1),
  hr_rest_bpm         smallint,
  body_battery_delta  smallint,
  respiration_avg     numeric(4, 1),
  respiration_min     numeric(4, 1),
  respiration_max     numeric(4, 1),
  spo2_avg            numeric(4, 1),
  spo2_min            numeric(4, 1),
  hrv_avg_ms          numeric(5, 1),
  hrv_status          text,
  provider_score      smallint check (provider_score between 0 and 100),
  provider_score_label text,
  updated_at          timestamptz not null default now(),
  unique (user_id, night_date),
  unique (id, user_id)
);

create table public.sleep_night_details (
  night_id     uuid primary key,
  user_id      uuid not null default auth.uid(),
  score_detail jsonb,
  segments     jsonb,
  hr_stream    jsonb,
  foreign key (night_id, user_id) references public.sleep_nights (id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. Musculation et Hyrox
-- ---------------------------------------------------------------------------------------------------------------------

-- Bibliothèque d'exercices : lignes `user_id is null` = bibliothèque fournie (lecture pour tous), sinon exercice perso
create table public.exercises (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users (id) on delete cascade,
  slug         text check (slug ~ '^[a-z0-9-]+$'),
  name         text not null check (char_length(name) between 1 and 80),
  muscle_group text not null check (muscle_group in ('chest', 'back', 'legs', 'shoulders', 'arms', 'core')),
  is_compound  boolean not null default false,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (id, user_id),
  check ((user_id is null) = (slug is not null))
);
create unique index exercises_slug_uq on public.exercises (slug) where user_id is null;
create unique index exercises_user_name_uq on public.exercises (user_id, lower(name)) where user_id is not null and archived_at is null;

create table public.strength_programs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  notes       text check (char_length(notes) <= 500),
  sort_order  integer not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);

-- NB : les références vers exercises sont « différées » (vérifiées à la fin de la transaction). Sans cela, supprimer un compte échoue :
-- la cascade supprime parfois l'exercice perso avant les lignes qui le référencent.
create table public.strength_program_items (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null,
  user_id     uuid not null default auth.uid(),
  position    smallint not null check (position between 1 and 60),
  exercise_id uuid not null references public.exercises (id) deferrable initially deferred,
  sets        smallint not null check (sets between 1 and 20),
  reps        smallint not null check (reps between 1 and 100),
  weight_kg   numeric(5, 1) not null default 0 check (weight_kg between 0 and 1000),
  unique (program_id, position),
  foreign key (program_id, user_id) references public.strength_programs (id, user_id) on delete cascade
);

create table public.strength_sets (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null,
  user_id     uuid not null default auth.uid(),
  exercise_id uuid not null references public.exercises (id) deferrable initially deferred,
  position    smallint not null check (position between 1 and 60),
  set_no      smallint not null check (set_no between 1 and 60),
  reps        smallint not null check (reps between 0 and 1000),
  weight_kg   numeric(5, 1) not null default 0 check (weight_kg between 0 and 2000),
  rpe         numeric(3, 1) check (rpe between 1 and 10),
  unique (activity_id, position, set_no),
  foreign key (activity_id, user_id) references public.activities (id, user_id) on delete cascade
);
create index strength_sets_user_exercise_idx on public.strength_sets (user_id, exercise_id);

-- Hyrox : un test ou une course = 16 temps (8 runs d'1 km et 8 stations), en secondes
create table public.hyrox_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  performed_on date not null,
  label        text not null default 'Test' check (char_length(label) between 1 and 80),
  kind         text not null default 'test' check (kind in ('test', 'race')),
  source       text not null default 'manual' check (source in ('manual', 'strava', 'garmin')),
  activity_id  uuid,
  splits_s     jsonb not null check (jsonb_typeof(splits_s) = 'array' and jsonb_array_length(splits_s) = 16 and pg_column_size(splits_s) < 2048),
  total_s      integer not null check (total_s between 1 and 36000),
  notes        text check (char_length(notes) <= 500),
  created_at   timestamptz not null default now(),
  unique (id, user_id),
  foreign key (activity_id, user_id) references public.activities (id, user_id) on delete set null (activity_id)
);
create index hyrox_attempts_user_date_idx on public.hyrox_attempts (user_id, performed_on desc);

create table public.hyrox_goals (
  user_id         uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  target_total_s  integer not null check (target_total_s between 600 and 36000),
  target_splits_s jsonb check (target_splits_s is null or (jsonb_typeof(target_splits_s) = 'array' and jsonb_array_length(target_splits_s) = 16)),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 10. Charge quotidienne : calcul INCRÉMENTAL (remplace le recalcul complet à chaque changement)
-- ---------------------------------------------------------------------------------------------------------------------

-- Recalcule la charge et les courbes de forme à partir d'un jour. Même formule que l'ancien moteur :
-- CTL += (charge − CTL) × 2/43 ; ATL += (charge − ATL) × 2/8 ; série continue de la 1re à la dernière activité.
create or replace function private.refresh_daily_load(p_user uuid, p_from date)
returns void language plpgsql security definer set search_path = public, private as $$
declare
  v_first date;
  v_last  date;
  v_ctl numeric := 0;
  v_atl numeric := 0;
  r record;
begin
  select min(a.local_date), max(a.local_date) into v_first, v_last
  from activities a where a.user_id = p_user and not a.is_hidden and a.local_date >= date '2000-01-01';
  if v_first is null then
    delete from daily_load where user_id = p_user;
    return;
  end if;
  delete from daily_load where user_id = p_user and (day < v_first or day > v_last);
  p_from := greatest(coalesce(p_from, v_first), v_first);
  -- On repart de la veille si on la connaît, sinon du tout début
  select d.ctl, d.atl into v_ctl, v_atl from daily_load d where d.user_id = p_user and d.day = p_from - 1;
  if not found then
    p_from := v_first; v_ctl := 0; v_atl := 0;
  end if;
  for r in
    with agg as (
      select a.local_date as day, sum(coalesce(a.training_load, 0)) as load, sum(coalesce(a.duration_s, a.elapsed_s, 0)) as dur,
             count(*) as n, (array_agg(a.id order by coalesce(a.training_load, 0) desc, a.started_at))[1] as main_id
      from activities a
      where a.user_id = p_user and not a.is_hidden and a.local_date >= p_from and a.local_date <= v_last
      group by 1
    )
    select gs::date as day, coalesce(agg.load, 0) as load, coalesce(agg.dur, 0) as dur, coalesce(agg.n, 0) as n, agg.main_id
    from generate_series(p_from, v_last, interval '1 day') gs
    left join agg on agg.day = gs::date
    order by 1
  loop
    -- aucune valeur arrondie en base : le résultat ne dépend pas du point de départ du recalcul (incrémental = complet)
    v_ctl := v_ctl + (r.load - v_ctl) * 2 / 43.0;
    v_atl := v_atl + (r.load - v_atl) * 2 / 8.0;
    insert into daily_load (user_id, day, load, duration_s, activities, main_activity_id, ctl, atl)
    values (p_user, r.day, round(r.load, 1), r.dur, r.n, r.main_id, v_ctl, v_atl)
    on conflict (user_id, day) do update set load = excluded.load, duration_s = excluded.duration_s,
      activities = excluded.activities, main_activity_id = excluded.main_activity_id, ctl = excluded.ctl, atl = excluded.atl;
  end loop;
end $$;
revoke all on function private.refresh_daily_load(uuid, date) from public, anon, authenticated;

-- Déclencheur d'instruction : ne recalcule QUE depuis le premier jour touché, pour chaque utilisateur concerné
create or replace function private.trg_activities_load() returns trigger language plpgsql security definer set search_path = public, private as $$
declare r record;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    for r in select user_id, min(local_date) as d from new_rows group by user_id loop
      perform private.refresh_daily_load(r.user_id, r.d);
    end loop;
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    for r in select user_id, min(local_date) as d from old_rows group by user_id loop
      perform private.refresh_daily_load(r.user_id, r.d);
    end loop;
  end if;
  return null;
end $$;
revoke all on function private.trg_activities_load() from public, anon, authenticated;

create trigger activities_load_ins after insert on public.activities referencing new table as new_rows for each statement execute function private.trg_activities_load();
create trigger activities_load_upd after update on public.activities referencing old table as old_rows new table as new_rows for each statement execute function private.trg_activities_load();
create trigger activities_load_del after delete on public.activities referencing old table as old_rows for each statement execute function private.trg_activities_load();

-- ---------------------------------------------------------------------------------------------------------------------
-- 11. À l'inscription : créer la ligne de profil (et de réglages) de l'utilisateur
-- ---------------------------------------------------------------------------------------------------------------------

create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  insert into profiles (user_id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), 80))
  on conflict (user_id) do nothing;
  insert into user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
-- (le déclencheur sur auth.users est créé par 03_migrate_from_legacy.sql après retrait de l'ancien)


-- ---------------------------------------------------------------------------------------------------------------------
-- 11b. Jetons des connexions : lecture/écriture RÉSERVÉES au serveur (Edge Functions, rôle service_role)
-- ---------------------------------------------------------------------------------------------------------------------

-- Renvoie les jetons déchiffrés d'une connexion (JSON), ou null s'il n'y en a pas
create or replace function public.rpc_connection_secrets(p_user_id uuid, p_provider text) returns jsonb
language plpgsql security definer set search_path = public, private, vault as $$
declare v_secret text;
begin
  select ds.decrypted_secret into v_secret
  from connections c
  join private.connection_secrets cs on cs.connection_id = c.id
  join vault.decrypted_secrets ds on ds.id = cs.vault_secret_id
  where c.user_id = p_user_id and c.provider = p_provider;
  return v_secret::jsonb;
end $$;

-- Enregistre (ou remplace) les jetons chiffrés d'une connexion existante
create or replace function public.rpc_save_connection_secrets(p_user_id uuid, p_provider text, p_payload jsonb, p_expires_at timestamptz default null) returns void
language plpgsql security definer set search_path = public, private, vault as $$
declare v_conn uuid; v_secret uuid;
begin
  select id into v_conn from connections where user_id = p_user_id and provider = p_provider;
  if v_conn is null then raise exception 'connexion inconnue'; end if;
  select vault_secret_id into v_secret from private.connection_secrets where connection_id = v_conn;
  if v_secret is null then
    insert into private.connection_secrets (connection_id, vault_secret_id, expires_at)
    values (v_conn, vault.create_secret(p_payload::text, 'connection:' || v_conn::text, 'Jetons ' || p_provider), p_expires_at);
  else
    perform vault.update_secret(v_secret, p_payload::text);
    update private.connection_secrets set expires_at = p_expires_at, updated_at = now() where connection_id = v_conn;
  end if;
end $$;

revoke all on function public.rpc_connection_secrets(uuid, text) from public, anon, authenticated;
revoke all on function public.rpc_save_connection_secrets(uuid, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.rpc_connection_secrets(uuid, text) to service_role;
grant execute on function public.rpc_save_connection_secrets(uuid, text, jsonb, timestamptz) to service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- 11c. Meilleures puissances : RECONSTRUITES à partir des courbes de puissance des activités (donnée dérivée, jamais saisie)
-- ---------------------------------------------------------------------------------------------------------------------

create or replace function private.rebuild_power_bests(p_user uuid) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  delete from power_bests where user_id = p_user;
  insert into power_bests (user_id, scope, duration_s, time_window, watts, activity_id, achieved_on)
  select user_id, scope, duration_s, time_window, watts, activity_id, local_date
  from (
    select x.*, row_number() over (partition by x.user_id, x.scope, x.duration_s, x.time_window order by x.watts desc, x.local_date desc) as rang
    from (
      select a.user_id, sc.scope, kv.key::int as duration_s, w.time_window, least(kv.value::int, 32767) as watts, a.id as activity_id, a.local_date
      from activities a
      join activity_metrics m on m.activity_id = a.id
      join sports s on s.code = a.sport_code
      cross join lateral jsonb_each_text(m.power_curve) kv
      cross join lateral (values ('all'), (s.family)) as sc(scope)
      cross join lateral (values ('all_time', true), ('last_90d', a.local_date >= current_date - 90)) as w(time_window, eligible)
      where a.user_id = p_user and not a.is_hidden and m.power_curve is not null
        and kv.key ~ '^[0-9]+$' and kv.value ~ '^[0-9]+$' and kv.value::numeric > 0 and w.eligible
    ) x
  ) y
  where rang = 1;
end $$;
revoke all on function private.rebuild_power_bests(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 12. Sécurité uniforme + updated_at
-- ---------------------------------------------------------------------------------------------------------------------

select private.protect('public.sports', 'ref');
select private.protect('public.sport_aliases', 'ref');
select private.protect('public.profiles', 'rw');
select private.protect('public.athlete_thresholds', 'rw');
select private.protect('public.user_settings', 'rw');
select private.protect('public.connections', 'ro');                 -- le navigateur ne fait que LIRE l'état ; la connexion se fait côté serveur
select private.protect('public.sync_requests', 'insert_read');      -- le navigateur dépose une demande, seul le serveur la fait avancer
select private.protect('public.routes', 'rw');
select private.protect('public.events', 'rw');
select private.protect('public.event_segments', 'rw');
select private.protect('public.workout_templates', 'rw');
select private.protect('public.planned_workouts', 'rw');
select private.protect('public.activities', 'rw');
select private.protect('public.activity_metrics', 'ro');
select private.protect('public.activity_streams', 'ro');
select private.protect('public.activity_overrides', 'rw');
select private.protect('public.race_results', 'rw');
select private.protect('public.daily_load', 'ro');
select private.protect('public.power_bests', 'ro');
select private.protect('public.calendar_notes', 'rw');
select private.protect('public.rest_days', 'rw');
select private.protect('public.training_phases', 'rw');
select private.protect('public.yearly_goals', 'rw');
select private.protect('public.sleep_nights', 'ro');
select private.protect('public.sleep_night_details', 'ro');
select private.protect('public.strength_programs', 'rw');
select private.protect('public.strength_program_items', 'rw');
select private.protect('public.strength_sets', 'rw');
select private.protect('public.hyrox_attempts', 'rw');
select private.protect('public.hyrox_goals', 'rw');

-- exercices : bibliothèque fournie lisible par tous, exercices perso modifiables par leur propriétaire
alter table public.exercises enable row level security;
revoke all on public.exercises from public, anon, authenticated;
grant select, insert, update, delete on public.exercises to authenticated;
create policy read_library_and_own on public.exercises for select to authenticated using (user_id is null or (select auth.uid()) = user_id);
create policy write_own on public.exercises for insert to authenticated with check ((select auth.uid()) = user_id);
create policy update_own on public.exercises for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy delete_own on public.exercises for delete to authenticated using ((select auth.uid()) = user_id);

-- Tables du schéma private : aucun accès pour les rôles de l'API
alter table private.connection_secrets enable row level security;
alter table private.oauth_states enable row level security;
revoke all on private.connection_secrets, private.oauth_states from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'user_settings', 'connections', 'events', 'workout_templates', 'planned_workouts', 'activities',
                           'activity_metrics', 'activity_overrides', 'race_results', 'calendar_notes', 'yearly_goals', 'sleep_nights',
                           'strength_programs', 'power_bests'] loop
    perform private.touch(format('public.%I', t)::regclass);
  end loop;
end $$;
