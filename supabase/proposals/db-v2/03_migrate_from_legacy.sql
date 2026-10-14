-- =====================================================================================================================
-- Rush — Base V2 : MIGRATION des données de `legacy` vers `public` (PROPOSITION, jamais appliquée)
--
-- Prérequis : les anciennes tables sont dans le schéma `legacy`, 01_schema.sql et 02_seed_reference.sql sont appliqués.
-- Principes :
--   * les identifiants (uuid) des activités, séances prévues, exercices perso… sont CONSERVÉS : liens et adresses restent valables ;
--   * toute valeur hors bornes ou illisible est neutralisée (NULL) au lieu de bloquer la migration ; les rejets sont comptés en fin de script ;
--   * les données dérivées (forme, records de puissance) ne sont pas recopiées : elles sont RECALCULÉES par les fonctions de la V2 ;
--   * rien n'est supprimé de `legacy` : c'est le filet de sécurité (à supprimer après une période de recul).
-- À exécuter dans UNE transaction, en fenêtre de maintenance (les anciens clients ne doivent plus écrire).
-- =====================================================================================================================

-- ---------------------------------------------------------------------------------------------------------------------
-- 0. Outils de conversion « sûrs » (valeur illisible ou hors bornes → NULL)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function pg_temp.num(p text, p_lo numeric, p_hi numeric) returns numeric language plpgsql immutable as $$
declare v numeric;
begin
  if p is null or p !~ '^\s*-?[0-9]+([.,][0-9]+)?\s*$' then return null; end if;
  v := replace(trim(p), ',', '.')::numeric;
  if v < p_lo or v > p_hi then return null; end if;
  return v;
end $$;
create or replace function pg_temp.clamp(p numeric, p_lo numeric, p_hi numeric) returns numeric language sql immutable as $$
  select case when p between p_lo and p_hi then p end $$;
create or replace function pg_temp.sport(p_raw text) returns text language sql stable as $$
  select coalesce(
    (select sport_code from public.sport_aliases where provider in ('strava', 'app', 'legacy') and lower(raw) = lower(p_raw) order by case provider when 'strava' then 0 when 'app' then 1 else 2 end limit 1),
    (select code from public.sports where code = lower(p_raw)),
    'other') $$;
create or replace function pg_temp.group_en(p text) returns text language sql immutable as $$
  select case p when 'pectoraux' then 'chest' when 'dos' then 'back' when 'jambes' then 'legs' when 'epaules' then 'shoulders' when 'bras' then 'arms' else 'core' end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Profils, seuils, réglages
-- ---------------------------------------------------------------------------------------------------------------------
-- Un profil pour chaque compte (même ceux qui n'avaient aucune ligne), puis enrichi depuis l'ancien profil
insert into public.profiles (user_id, display_name)
select u.id, left(coalesce(up.display_name, p.display_name, split_part(u.email, '@', 1)), 80)
from auth.users u
left join legacy.user_profiles up on up.user_id = u.id
left join legacy.profiles p on p.id = u.id
on conflict (user_id) do nothing;

update public.profiles pr set
  first_name = left(nullif(trim(up.display_name), ''), 80),
  last_name  = left(nullif(trim(regexp_replace(coalesce(up.extras ->> 'full_name', ''), '^\S+\s*', '')), ''), 80),
  avatar_url = case when length(up.extras ->> 'avatar_url') <= 500 then nullif(up.extras ->> 'avatar_url', '') end,
  birth_date = case when up.extras ->> 'birth_date' ~ '^\d{4}-\d{2}-\d{2}$'
                     and (up.extras ->> 'birth_date')::date between date '1900-01-01' and current_date then (up.extras ->> 'birth_date')::date end,
  sex        = case lower(left(up.extras ->> 'sex', 1)) when 'f' then 'f' when 'm' then 'm' when 'h' then 'm' end,
  height_cm  = pg_temp.num(up.extras ->> 'height', 80, 250)::smallint,
  city       = left(nullif(up.extras ->> 'city', ''), 80),
  country    = left(nullif(up.extras ->> 'country', ''), 80),
  club       = left(nullif(up.extras ->> 'club', ''), 120),
  locale     = coalesce((select case p.locale when 'en' then 'en' else 'fr' end from legacy.profiles p where p.id = pr.user_id), 'fr'),
  created_at = coalesce(up.created_at, pr.created_at)
from legacy.user_profiles up where up.user_id = pr.user_id;

-- Seuils : une ligne datée du jour de création du profil, seulement s'il y a au moins une valeur
insert into public.athlete_thresholds (user_id, valid_from, ftp_w, cp_w, w_prime_j, pmax_w, hr_max_bpm, hr_rest_bpm, lthr_bpm, weight_kg, vma_kmh, vo2max_run, vo2max_bike, css_s_per_100m, extra)
select up.user_id, coalesce(up.created_at::date, current_date),
  pg_temp.clamp(up.ftp, 30, 700), pg_temp.num(up.extras ->> 'cp', 30, 700)::smallint,
  (pg_temp.num(up.extras ->> 'wprime', 1, 100000) * case when pg_temp.num(up.extras ->> 'wprime', 1, 100000) < 100 then 1000 else 1 end)::integer,
  pg_temp.num(up.extras ->> 'pmax', 100, 3000)::smallint,
  pg_temp.clamp(up.hr_max, 100, 250), pg_temp.num(up.extras ->> 'rhr', 25, 120)::smallint, pg_temp.clamp(up.lthr, 80, 230),
  pg_temp.clamp(up.weight, 25, 250), pg_temp.num(up.extras ->> 'vma', 5, 30), pg_temp.num(up.extras ->> 'vo2max_run', 15, 95), pg_temp.num(up.extras ->> 'vo2max_bike', 15, 95),
  pg_temp.num(up.extras ->> 'css', 40, 300)::smallint,
  jsonb_strip_nulls(jsonb_build_object('pace_5k', up.extras -> 'pace_5k', 'pace_10k', up.extras -> 'pace_10k', 'pace_half', up.extras -> 'pace_half', 'pace_marathon', up.extras -> 'pace_marathon',
    'swim_100', up.extras -> 'swim_100', 'swim_400', up.extras -> 'swim_400', 'swim_1500', up.extras -> 'swim_1500', 'swim_3800', up.extras -> 'swim_3800', 'swim_level', up.extras -> 'swim_level',
    'swolf', up.extras -> 'swolf', 'threshold_speed', up.extras -> 'threshold_speed', 'hrv_baseline', up.extras -> 'hrv_baseline', 'cardiac_drift', up.extras -> 'cardiac_drift',
    'last_ftp_test', up.extras -> 'last_ftp_test', 'ftp_test_type', up.extras -> 'ftp_test_type', 'hrmax_method', up.extras -> 'hrmax_method'))
from legacy.user_profiles up
where up.ftp is not null or up.hr_max is not null or up.lthr is not null or up.weight is not null or up.extras ?| array['cp', 'wprime', 'pmax', 'rhr', 'vma', 'vo2max_run', 'vo2max_bike', 'css'];

-- Réglages : preferences + disposition de l'accueil + préférences Open Dossard fusionnés en une ligne par utilisateur
insert into public.user_settings (user_id, ui, dashboard_layout, opendossard)
select u.id,
  coalesce((select jsonb_object_agg(pf.key, pf.value) from legacy.preferences pf where pf.user_id = u.id), '{}'::jsonb),
  (select d.layout from legacy.user_dashboard d where d.user_id = u.id),
  coalesce((select jsonb_build_object('overrides', o.overrides, 'hidden', o.hidden) from legacy.od_prefs o where o.user_id = u.id), '{}'::jsonb)
from auth.users u
on conflict (user_id) do update set ui = excluded.ui, dashboard_layout = excluded.dashboard_layout, opendossard = excluded.opendossard;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Connexions : l'état est public, les JETONS partent dans Vault (chiffrés). Whoop (abandonné) n'est pas migré.
-- ---------------------------------------------------------------------------------------------------------------------
insert into public.connections (id, user_id, provider, external_user_id, display_name, scopes, status, connected_at, last_sync_at, last_sync_status, last_sync_error, activities_synced)
select c.id, c.user_id, c.app, c.external_id, c.athlete_name, coalesce(string_to_array(c.scope, ','), '{}'),
  case when c.last_sync_status = 'error' then 'error' else 'connected' end,
  c.first_connected_at, c.last_sync_at, case when c.last_sync_status in ('running', 'ok', 'error') then c.last_sync_status end, left(c.last_sync_error, 500), coalesce(c.total_activities_synced, 0)
from legacy.connexions_app c where c.app in ('strava', 'garmin');

insert into private.connection_secrets (connection_id, vault_secret_id, expires_at)
select c.id,
  vault.create_secret(jsonb_strip_nulls(jsonb_build_object('access_token', c.access_token, 'refresh_token', c.refresh_token, 'expires_at', c.expires_at,
                      'oauth1_token', c.oauth1_token, 'oauth1_secret', c.oauth1_secret))::text, 'connection:' || c.id::text, 'Jetons ' || c.app || ' migrés'),
  c.expires_at
from legacy.connexions_app c where c.app in ('strava', 'garmin');

insert into public.sync_requests (id, user_id, provider, status, requested_at, finished_at, items_synced, error)
select id, user_id, 'garmin', status, requested_at, finished_at, nights, left(error, 300) from legacy.garmin_sync_requests;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Parcours GPX, événements (compétitions), modèles, séances prévues
-- ---------------------------------------------------------------------------------------------------------------------
-- Un parcours par séance prévue / compétition qui portait un GPX (id du parcours = id de la ligne d'origine)
insert into public.routes (id, user_id, name, gpx)
select ap.id, ap.user_id, left(coalesce(nullif(ap.gpx_name, ''), ap.name, 'Parcours'), 200), ap.gpx_content
from legacy.activity_planned ap where ap.gpx_content is not null and ap.gpx_content <> '' and length(ap.gpx_content) <= 5000000;

insert into public.events (id, user_id, name, event_date, start_time, sport_code, priority, kind, distance_m, elevation_gain_m, target_duration_s, route_id, notes, created_at, updated_at)
select ap.id, ap.user_id, left(coalesce(nullif(trim(ap.name), ''), 'Compétition'), 200), ap.date,
  case when ap.start_date_local::time <> time '00:00' then ap.start_date_local::time end,
  pg_temp.sport(ap.sport), case upper(left(ap.priority, 1)) when 'A' then 'A' when 'B' then 'B' when 'C' then 'C' end, left(ap.type, 60),
  pg_temp.num((ap.km * 1000)::text, 0, 1000000)::integer, pg_temp.clamp(ap.d_plus, 0, 100000), case when ap.duration > 0 then ap.duration * 60 end,
  (select r.id from public.routes r where r.id = ap.id), left(ap.notes, 2000), coalesce(ap.created_at, now()), coalesce(ap.updated_at, now())
from legacy.activity_planned ap where ap.category = 'competition';

insert into public.workout_templates (id, user_id, name, sport_code, duration_s, target_load, rpe, distance_m, elevation_gain_m, description, structure, sort_order, created_at, updated_at)
select t.id, t.user_id, left(coalesce(nullif(trim(t.name), ''), 'Modèle'), 120), pg_temp.sport(coalesce(t.sport_raw, t.sport)),
  case when t.duration_min > 0 then t.duration_min * 60 end, pg_temp.clamp(t.tss, 0, 9999), pg_temp.clamp(t.rpe, 1, 10),
  pg_temp.num((t.distance_km * 1000)::text, 0, 1000000)::integer, pg_temp.clamp(t.dplus, 0, 100000), left(t.description, 2000),
  case when jsonb_typeof(t.structure) = 'array' then t.structure end, coalesce(t.sort_order, 0), coalesce(t.created_at, now()), coalesce(t.updated_at, now())
from legacy.activity_template t;

insert into public.planned_workouts (id, user_id, planned_on, start_time, name, sport_code, duration_s, target_load, rpe, distance_m, elevation_gain_m, notes, structure, route_id, created_at, updated_at)
select ap.id, ap.user_id, ap.date, case when ap.start_date_local::time <> time '00:00' then ap.start_date_local::time end,
  left(coalesce(nullif(trim(ap.name), ''), 'Séance'), 200), pg_temp.sport(ap.sport),
  case when ap.duration > 0 then ap.duration * 60 end, pg_temp.clamp(ap.tss, 0, 9999), pg_temp.clamp(ap.rpe, 1, 10),
  pg_temp.num((ap.km * 1000)::text, 0, 1000000)::integer, pg_temp.clamp(ap.d_plus, 0, 100000), left(ap.notes, 2000),
  case when jsonb_typeof(ap.structure) = 'array' then ap.structure end, (select r.id from public.routes r where r.id = ap.id),
  coalesce(ap.created_at, now()), coalesce(ap.updated_at, now())
from legacy.activity_planned ap where ap.category is distinct from 'competition';

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Activités. Les déclencheurs de charge sont coupés pendant la copie, puis la forme est recalculée UNE fois par utilisateur.
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.activities disable trigger activities_load_ins;
alter table public.activities disable trigger activities_load_upd;
alter table public.activities disable trigger activities_load_del;

insert into public.activities (id, user_id, source, external_id, sport_code, sport_raw, name, started_at, utc_offset_min, duration_s, elapsed_s, distance_m, elevation_gain_m, max_speed_ms,
  hr_avg_bpm, hr_max_bpm, power_avg_w, power_max_w, cadence_avg_rpm, energy_kj, calories, training_load, ftp_w_at_time, rpe, notes, planned_workout_id, is_race, is_race_user_set, created_at, updated_at)
select a.id, a.user_id,
  case when a.source in ('strava', 'manual') then a.source else 'import' end,
  case when a.strava_id is not null then a.strava_id::text end,
  pg_temp.sport(a.sport), left(a.sport, 60),
  left(coalesce(nullif(trim(a.name), ''), 'Sans titre'), 200),
  a.start_date_local,          -- ancien « local » stocké comme UTC : on garde la valeur telle quelle ; le décalage réel est inconnu (NULL)
  null,
  pg_temp.clamp(a.moving_time, 0, 2000000), pg_temp.clamp(a.elapsed_time, 0, 2000000),
  pg_temp.num((a.distance_km * 1000)::text, 0, 100000000)::integer, pg_temp.clamp(a.total_elevation_gain, 0, 100000),
  pg_temp.clamp(round(a.max_speed_kmh / 3.6, 2), 0, 999),
  pg_temp.clamp(a.avg_heartrate, 20, 230), pg_temp.clamp(a.max_heartrate, 20, 255),  -- une moyenne au-dessus de 230 est forcément une erreur de capteur
  pg_temp.clamp(a.avg_watts, 0, 3000), pg_temp.clamp(a.max_watts, 0, 4000), pg_temp.clamp(a.avg_cadence, 0, 300),
  pg_temp.clamp(a.kj, 0, 100000000), pg_temp.clamp(a.calories, 0, 100000000), pg_temp.clamp(a.tss, 0, 9999), pg_temp.clamp(a.ftp_at_time, 30, 700), pg_temp.clamp(a.rpe, 1, 10),
  left(a.user_notes, 4000),
  (select pw.id from public.planned_workouts pw where a.planned_id ~ '^[0-9a-fA-F-]{36}$' and pw.id::text = lower(a.planned_id) and pw.user_id = a.user_id),
  coalesce(a.category = 'competition', false), coalesce(a.category_set_by_user, false),
  coalesce(a.created_at, now()), coalesce(a.updated_at, now())
from legacy.activities a
where a.start_date_local is not null and a.start_date_local::date >= date '2000-01-01';

-- Métriques dérivées (typées) + courbe de puissance sans les marqueurs de version
insert into public.activity_metrics (activity_id, user_id, engine_version, np_w, if_ratio, tss, trimp, hrr_bpm, pmax_w, cp_w, w_prime_j, eftp_w, wbal_used_kj, cho_g, work_over_ftp_kj, polarization_index, polarization_class, power_curve)
select a.id, a.user_id, coalesce(pg_temp.num(a.metrics ->> '_v', 1, 99)::smallint, 1),
  pg_temp.num(a.metrics ->> 'np', 0, 3000)::smallint, pg_temp.num((pg_temp.num(a.metrics ->> 'if_pct', 0, 500) / 100)::text, 0, 5),
  pg_temp.num(a.metrics ->> 'tss', 0, 9999), pg_temp.num(a.metrics ->> 'trimp', 0, 9999)::smallint, pg_temp.num(a.metrics ->> 'hrrc', 0, 250)::smallint,
  pg_temp.num(a.metrics ->> 'pmax', 0, 5000)::smallint, pg_temp.num(a.metrics ->> 'cp', 0, 3000)::smallint, pg_temp.num(a.metrics ->> 'w_prime', 0, 200000)::integer,
  pg_temp.num(a.metrics ->> 'eftp', 0, 3000)::smallint, pg_temp.num(a.metrics ->> 'wbal_kj', 0, 9999), pg_temp.num(a.metrics ->> 'cho_g', 0, 9999)::smallint,
  pg_temp.num(a.metrics ->> 'work_over_ftp_kj', 0, 99999), pg_temp.num(a.metrics ->> 'pol_index', -99, 99), left(a.metrics ->> 'pol_class', 40),
  case when jsonb_typeof(a.power_curve) = 'object' then (a.power_curve - 'v' - '_v') end
from legacy.activities a join public.activities n on n.id = a.id
where a.metrics is not null or a.power_curve is not null;

-- Courbes : base64 → binaire (25 % de place en moins). Seuls les formats connus sont repris.
insert into public.activity_streams (activity_id, user_id, payload, synced_at)
select a.id, a.user_id, decode(a.streams_gz, 'base64'), coalesce(a.streams_synced_at, now())
from legacy.activities a join public.activities n on n.id = a.id
where a.streams_gz is not null and a.streams_gz <> '' and a.streams_format = 'gzip+base64+json-array';

-- Retouches : rattachées à l'activité par (compte, strava_id) ; celles dont l'activité n'existe plus sont écartées et comptées
insert into public.activity_overrides (activity_id, user_id, name, sport_code, duration_s, distance_m, elevation_gain_m, training_load, rpe, notes, updated_at)
select n.id, e.user_id, left(nullif(trim(e.data ->> 'name'), ''), 200),
  case when e.data ? 'sport' then pg_temp.sport(e.data ->> 'sport') end,
  (pg_temp.num(e.data ->> 'duration', 0, 40000) * 60)::integer, (pg_temp.num(e.data ->> 'distance_km', 0, 100000) * 1000)::integer,
  pg_temp.num(e.data ->> 'elevation_gain', 0, 100000)::integer, pg_temp.num(e.data ->> 'tss', 0, 9999), pg_temp.num(e.data ->> 'rpe', 1, 10), left(e.data ->> 'notes', 4000),
  coalesce(e.updated_at, now())
from legacy.activity_edits e
join public.activities n on n.user_id = e.user_id and n.source = 'strava' and n.external_id = e.activity_id;

-- Résultats de course
insert into public.race_results (activity_id, user_id, place, total, category, url)
select a.id, a.user_id, a.result_place, a.result_total, left(a.result_catev, 30), left(a.result_url, 500)
from legacy.activities a join public.activities n on n.id = a.id
where (a.result_place > 0 or a.result_total > 0 or a.result_catev is not null or a.result_url is not null)
  and (a.result_place is null or a.result_total is null or a.result_place <= a.result_total);

-- Triathlon : l'ancien JSON `tri` d'une activité devient un événement avec ses disciplines
with tri as (
  select a.id as activity_id, a.user_id, a.name, n.local_date, a.tri
  from legacy.activities a join public.activities n on n.id = a.id where a.tri is not null and jsonb_typeof(a.tri) = 'object'
), ev as (
  insert into public.events (user_id, name, event_date, sport_code, kind)
  select user_id, left(name, 200), local_date, 'triathlon', 'Triathlon' from tri returning id, user_id, name, event_date
), liens as (
  select t.activity_id, t.tri, e.id as event_id, e.user_id from tri t join ev e on e.user_id = t.user_id and e.name = left(t.name, 200) and e.event_date = t.local_date
), seg as (
  insert into public.event_segments (event_id, user_id, position, kind, name, sport_code, distance_m, elevation_gain_m, target_duration_s)
  select l.event_id, l.user_id, p.pos, 'leg', p.disc, p.sport, pg_temp.num((l.tri -> p.disc ->> 'dist_km'), 0, 100000)::numeric * 1000,
         pg_temp.num(l.tri -> p.disc ->> 'dplus', 0, 100000)::integer, (pg_temp.num(l.tri -> p.disc ->> 'min', 0, 100000) * 60)::integer
  from liens l cross join (values (1, 'swim', 'swim'), (2, 'bike', 'ride'), (3, 'run', 'run')) as p(pos, disc, sport)
  where l.tri ? p.disc
  returning event_id
)
update public.activities a set event_id = l.event_id from liens l where a.id = l.activity_id;

alter table public.activities enable trigger activities_load_ins;
alter table public.activities enable trigger activities_load_upd;
alter table public.activities enable trigger activities_load_del;

-- Forme et records : RECALCULÉS (jamais recopiés) par les fonctions de la V2
select private.refresh_daily_load(u.user_id, null) from (select distinct user_id from public.activities) u;
select private.rebuild_power_bests(u.user_id) from (select distinct user_id from public.activities) u;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Calendrier, objectifs, sommeil
-- ---------------------------------------------------------------------------------------------------------------------
insert into public.calendar_notes (id, user_id, kind, from_date, to_date, body, color, updated_at)
select n.id, n.user_id,
  case n.type when 'maladie' then 'illness' when 'blessure' then 'injury' else 'note' end,
  f.d, least(greatest(f.d, coalesce(n.to_date, f.d)), f.d + 366), left(n.text, 500),
  case when n.color ~ '^#[0-9a-fA-F]{6}$' then n.color end, coalesce(n.updated_at, now())
from legacy.day_notes n cross join lateral (select coalesce(n.from_date, n.iso_date) as d) f
where f.d is not null and coalesce(n.type, 'texte') <> 'repos';

insert into public.rest_days (user_id, day)
select user_id, iso_date from legacy.rest_day
union
select user_id, d::date from legacy.day_notes n, generate_series(n.from_date, least(coalesce(n.to_date, n.from_date), n.from_date + 366), interval '1 day') d where n.type = 'repos' and n.from_date is not null
on conflict do nothing;

insert into public.training_phases (id, user_id, phase, name, from_date, to_date)
select id, user_id, case phase when 'recup' then 'recovery' else phase end, left(name, 120), from_date, greatest(to_date, from_date) from legacy.training_phases;

insert into public.yearly_goals (id, user_id, year, sport_code, metric, target, current_manual, created_at, updated_at)
select id, user_id, year, pg_temp.sport(sport), left(template, 60), target, current_manual, coalesce(created_at, now()), coalesce(updated_at, now())
from legacy.yearly_goals where target > 0
on conflict (user_id, year, sport_code, metric) do nothing;

-- Sommeil : les heures de coucher/lever étaient du texte « AAAA-MM-JJ HH:MM » en heure locale → vrais instants (fuseau du profil)
insert into public.sleep_nights (id, user_id, night_date, bedtime_at, wake_at, total_s, deep_s, light_s, rem_s, awake_s, awake_count, restless_count, stress_avg, hr_avg_bpm, hr_rest_bpm,
  body_battery_delta, respiration_avg, respiration_min, respiration_max, spo2_avg, spo2_min, hrv_avg_ms, hrv_status, provider_score, provider_score_label, updated_at)
select s.id, s.user_id, s.date,
  case when s.bedtime ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$' then (s.bedtime::timestamp at time zone pr.timezone) end,
  case when s.wake_time ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$' then (s.wake_time::timestamp at time zone pr.timezone) end,
  pg_temp.clamp(s.total_sec, 0, 86400), pg_temp.clamp(s.deep_sec, 0, 86400), pg_temp.clamp(s.light_sec, 0, 86400), pg_temp.clamp(s.rem_sec, 0, 86400), pg_temp.clamp(s.awake_sec, 0, 86400),
  pg_temp.clamp(s.awake_count, 0, 32000), pg_temp.clamp(s.restless_count, 0, 32000), pg_temp.clamp(s.avg_stress, 0, 999), pg_temp.clamp(s.avg_heart_rate, 0, 999), pg_temp.clamp(s.resting_heart_rate, 0, 300),
  pg_temp.clamp(s.body_battery_change, -300, 300), pg_temp.clamp(s.resp_avg, 0, 999), pg_temp.clamp(s.resp_min, 0, 999), pg_temp.clamp(s.resp_max, 0, 999),
  pg_temp.clamp(s.spo2_avg, 0, 100), pg_temp.clamp(s.spo2_min, 0, 100), pg_temp.clamp(s.hrv_avg, 0, 9999), s.hrv_status, pg_temp.clamp(s.score, 0, 100), s.score_qualifier, coalesce(s.updated_at, now())
from legacy.garmin_sleep s join public.profiles pr on pr.user_id = s.user_id;

insert into public.sleep_night_details (night_id, user_id, score_detail, segments, hr_stream)
select s.id, s.user_id, s.score_detail, s.segments, s.hr_stream from legacy.garmin_sleep s join public.sleep_nights n on n.id = s.id
where s.score_detail is not null or s.segments is not null or s.hr_stream is not null;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Musculation et Hyrox
-- ---------------------------------------------------------------------------------------------------------------------
-- Exercices perso (même identifiant) + exercices « disparus » référencés par un programme ou une série : recréés en perso pour ne rien perdre
insert into public.exercises (id, user_id, name, muscle_group)
select e.id, e.user_id, left(e.name, 80), pg_temp.group_en(e.muscle_group) from legacy.strength_exercises e;

create temp table _clef_exo on commit drop as
select distinct user_id, key, first_value(nom) over (partition by user_id, key order by nom) as nom, first_value(grp) over (partition by user_id, key order by nom) as grp from (
  select p.user_id, i ->> 'key' as key, i ->> 'name' as nom, i ->> 'group' as grp from legacy.strength_programs p, jsonb_array_elements(case when jsonb_typeof(p.exercises) = 'array' then p.exercises else '[]'::jsonb end) i
  union all select s.user_id, s.exercise_key, s.exercise_name, s.muscle_group from legacy.strength_sets s) k
where key is not null;

insert into public.exercises (user_id, name, muscle_group)
select k.user_id, left(coalesce(nullif(k.nom, ''), k.key), 80), pg_temp.group_en(k.grp)
from _clef_exo k
where not exists (select 1 from public.exercises g where g.user_id is null and g.slug = k.key)
  and not (k.key like 'perso-%' and exists (select 1 from public.exercises x where x.id::text = substr(k.key, 7)))
on conflict do nothing;

-- Résolution d'une clé d'exercice (bibliothèque, perso par identifiant, ou recréé par nom) → identifiant
create or replace function pg_temp.exo(p_user uuid, p_key text, p_name text) returns uuid language sql stable as $$
  select coalesce(
    (select id from public.exercises where user_id is null and slug = p_key),
    (select id from public.exercises where p_key like 'perso-%' and id::text = substr(p_key, 7) and user_id = p_user),
    (select id from public.exercises where user_id = p_user and lower(name) = lower(left(coalesce(nullif(p_name, ''), p_key), 80)) and archived_at is null limit 1)) $$;

insert into public.strength_programs (id, user_id, name, notes, created_at, updated_at)
select p.id, p.user_id, left(p.name, 60), left(p.notes, 500), coalesce(p.created_at, now()), coalesce(p.updated_at, now()) from legacy.strength_programs p;

insert into public.strength_program_items (program_id, user_id, position, exercise_id, sets, reps, weight_kg)
select p.id, p.user_id, row_number() over (partition by p.id order by o)::smallint, ex.id,
  least(greatest(coalesce(pg_temp.num(i ->> 'sets', 1, 20), 3), 1), 20)::smallint, least(greatest(coalesce(pg_temp.num(i ->> 'reps', 1, 100), 8), 1), 100)::smallint,
  coalesce(pg_temp.num(i ->> 'weight', 0, 1000), 0)
from legacy.strength_programs p
cross join lateral jsonb_array_elements(case when jsonb_typeof(p.exercises) = 'array' then p.exercises else '[]'::jsonb end) with ordinality as t(i, o)
cross join lateral (select pg_temp.exo(p.user_id, t.i ->> 'key', t.i ->> 'name') as id) ex
where ex.id is not null;

insert into public.strength_sets (id, activity_id, user_id, exercise_id, position, set_no, reps, weight_kg)
select s.id, s.activity_id, s.user_id, ex.id, least(s.position + 1, 60), s.set_no, s.reps, s.weight_kg  -- l'ancienne numérotation commençait à 0
from legacy.strength_sets s join public.activities a on a.id = s.activity_id and a.user_id = s.user_id
cross join lateral (select pg_temp.exo(s.user_id, s.exercise_key, s.exercise_name) as id) ex
where ex.id is not null
on conflict do nothing;

insert into public.hyrox_attempts (id, user_id, performed_on, label, kind, source, activity_id, splits_s, total_s, notes, created_at)
select h.id, h.user_id, h.date, left(h.label, 80), case h.kind when 'course' then 'race' else 'test' end,
  case h.source when 'manuel' then 'manual' else h.source end,
  (select a.id from public.activities a where a.id = h.activity_id), h.segments, h.total_s, left(h.notes, 500), coalesce(h.created_at, now())
from legacy.hyrox_tests h;
insert into public.hyrox_goals (user_id, target_total_s, target_splits_s, updated_at)
select user_id, total_s, segments, coalesce(updated_at, now()) from legacy.hyrox_objectif;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. Déclencheurs d'inscription : on remplace les anciens (profiles/user_profiles) par celui de la V2
-- ---------------------------------------------------------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select tg.tgname from pg_trigger tg join pg_class c on c.oid = tg.tgrelid join pg_namespace n on n.oid = c.relnamespace
           join pg_proc p on p.oid = tg.tgfoid join pg_namespace pn on pn.oid = p.pronamespace
           where n.nspname = 'auth' and c.relname = 'users' and not tg.tgisinternal and pn.nspname in ('public', 'legacy') and p.proname in ('handle_new_user', 'handle_new_profile')
  loop
    execute format('drop trigger %I on auth.users', t.tgname);
  end loop;
end $$;
drop trigger if exists on_auth_user_created_v2 on auth.users;
create trigger on_auth_user_created_v2 after insert on auth.users for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. Rapport de migration (comparaison ancien / nouveau)
-- ---------------------------------------------------------------------------------------------------------------------
create temp table migration_report (controle text, ancien bigint, nouveau bigint, ecart bigint generated always as (nouveau - ancien) stored, commentaire text) on commit drop;
insert into migration_report (controle, ancien, nouveau, commentaire) values
  ('activités', (select count(*) from legacy.activities), (select count(*) from public.activities), 'écart attendu = activités sans date valide'),
  ('activités par compte (max écart)', 0, coalesce((select max(abs(x.o - x.n)) from (select u.id, (select count(*) from legacy.activities a where a.user_id = u.id) o, (select count(*) from public.activities a where a.user_id = u.id) n from auth.users u) x), 0), 'doit valoir 0'),
  ('distance totale (m)', (select round(sum(distance_km * 1000)) from legacy.activities), (select sum(distance_m) from public.activities), 'écarts dus aux distances aberrantes neutralisées'),
  ('charge totale (tss)', (select sum(tss) from legacy.activities), (select round(sum(training_load)) from public.activities), 'doit être égal'),
  ('courbes (streams)', (select count(*) from legacy.activities where streams_gz is not null), (select count(*) from public.activity_streams), 'doit être égal'),
  ('séances prévues', (select count(*) from legacy.activity_planned where category is distinct from 'competition'), (select count(*) from public.planned_workouts), 'doit être égal'),
  ('compétitions prévues', (select count(*) from legacy.activity_planned where category = 'competition'), (select count(*) from public.events where id in (select id from legacy.activity_planned)), 'doit être égal'),
  ('parcours GPX', (select count(*) from legacy.activity_planned where gpx_content is not null and gpx_content <> ''), (select count(*) from public.routes), 'doit être égal'),
  ('modèles', (select count(*) from legacy.activity_template), (select count(*) from public.workout_templates), 'doit être égal'),
  ('retouches', (select count(*) from legacy.activity_edits), (select count(*) from public.activity_overrides), 'écart = retouches orphelines écartées'),
  ('jours de forme', (select count(*) from legacy.daily_metrics), (select count(*) from public.daily_load), 'doit être égal'),
  ('connexions (hors Whoop)', (select count(*) from legacy.connexions_app where app <> 'whoop'), (select count(*) from public.connections), 'doit être égal'),
  ('jetons chiffrés', (select count(*) from legacy.connexions_app where app <> 'whoop'), (select count(*) from private.connection_secrets), 'doit être égal'),
  ('nuits de sommeil', (select count(*) from legacy.garmin_sleep), (select count(*) from public.sleep_nights), 'doit être égal'),
  ('séries de force', (select count(*) from legacy.strength_sets), (select count(*) from public.strength_sets), 'doit être égal'),
  ('tests Hyrox', (select count(*) from legacy.hyrox_tests), (select count(*) from public.hyrox_attempts), 'doit être égal'),
  ('notes calendrier', (select count(*) from legacy.day_notes where coalesce(type, 'texte') <> 'repos' and coalesce(from_date, iso_date) is not null), (select count(*) from public.calendar_notes), 'doit être égal'),
  ('jours de repos', (select count(*) from legacy.rest_day), (select count(*) from public.rest_days), 'doit être égal'),
  ('objectifs annuels', (select count(*) from legacy.yearly_goals), (select count(*) from public.yearly_goals), 'écart = doublons métier écartés');
select * from migration_report order by controle;
