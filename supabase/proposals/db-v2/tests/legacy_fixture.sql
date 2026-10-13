-- Données SYNTHÉTIQUES pour tester la migration (aucune donnée réelle). Suppose le schéma `legacy` créé à l'identique de la prod.
-- Elles contiennent volontairement des cas piégeux : valeurs aberrantes, anciens formats, orphelins, clés inconnues.
select setseed(0.42);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'athlete1@test.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'athlete2@test.invalid'),
  ('33333333-3333-4333-8333-333333333333', 'athlete3@test.invalid');

-- --- Activités : compte 1 (Strava, 300 séances) -----------------------------------------------------------------------
insert into legacy.activities (id, user_id, strava_id, name, sport, start_date_local, elapsed_time, moving_time, distance_km, total_elevation_gain,
  avg_speed_kmh, max_speed_kmh, avg_heartrate, max_heartrate, avg_watts, max_watts, np, ftp_at_time, avg_cadence, kj, calories, tss, source, category,
  category_set_by_user, metrics, power_curve, streams_gz, streams_format, streams_synced_at, rpe, user_notes)
select gen_random_uuid(), '11111111-1111-4111-8111-111111111111', 9000000 + i,
  'Sortie ' || i,
  (array['Ride','Ride','Ride','Run','Run','TrailRun','WeightTraining','Swim','VirtualRide','Soccer','Workout','Hike'])[1 + (i % 12)],
  timestamptz '2025-01-01 07:30:00+00' + (i * interval '1 day 3 hours'),
  4000 + (i % 50) * 60, 3600 + (i % 40) * 60,
  case when i % 7 = 0 then null else round((20 + (i % 60))::numeric, 2) end,
  (i % 9) * 40,
  round((24 + (i % 9))::numeric, 1), round((45 + (i % 9))::numeric, 1),
  130 + (i % 40), 160 + (i % 30),
  case when i % 3 = 0 then 180 + (i % 60) end, case when i % 3 = 0 then 420 + (i % 90) end, case when i % 3 = 0 then 190 + (i % 50) end,
  case when i % 3 = 0 then 250 end, case when i % 4 = 0 then 85 + (i % 10) end,
  500 + i, 600 + i, 30 + (i % 120),
  'strava',
  case when i % 25 = 0 then 'competition' when i % 5 = 0 then 'entrainement' end,
  (i % 25 = 0),
  case when i % 3 = 0 then jsonb_build_object('_v', 2, 'np', 190 + (i % 50), 'if_pct', 80 + (i % 15), 'tss', 30 + (i % 120), 'trimp', 50 + (i % 70), 'hrrc', 20 + (i % 15),
       'pmax', 800 + i, 'cp', 240, 'w_prime', 19000, 'eftp', 245, 'wbal_kj', 11.5, 'cho_g', 120 + (i % 50), 'work_over_ftp_kj', 12.3, 'pol_index', 0.4, 'pol_class', 'Pyramidal') end,
  case when i % 3 = 0 then jsonb_build_object('v', 5, '_v', 3, '5', 900 + i, '60', 450 + i, '300', 320 + (i % 30), '1200', 270 + (i % 20), '3600', 210, 'late_300', 300) end,
  encode(decode(md5(i::text) || md5((i * 7)::text), 'hex'), 'base64'), 'gzip+base64+json-array', now(), case when i % 11 = 0 then 6.5 end, case when i % 13 = 0 then 'note ' || i end
from generate_series(1, 300) i;

-- Aberrations et cas limites (doivent être NEUTRALISÉS, jamais bloquer la migration)
update legacy.activities set avg_heartrate = 240, max_heartrate = 300 where strava_id = 9000010;
update legacy.activities set avg_watts = 3500, max_watts = 5000 where strava_id = 9000011;
update legacy.activities set name = '' where strava_id = 9000012;
update legacy.activities set moving_time = null, distance_km = null where strava_id = 9000013;
update legacy.activities set avg_cadence = 400 where strava_id = 9000014;
-- Course avec résultat saisi, triathlon, lien vers une séance prévue valide et un lien invalide
update legacy.activities set result_place = 12, result_total = 150, result_catev = 'V1', result_url = 'https://example.org/r' where strava_id = 9000025;
update legacy.activities set tri = '{"swim": {"min": 20, "dist_km": 1.5}, "bike": {"min": 60, "dist_km": 40, "dplus": 300}, "run": {"min": 35, "dist_km": 10}}'::jsonb, name = 'Triathlon test' where strava_id = 9000050;
update legacy.activities set planned_id = 'pas-un-uuid' where strava_id = 9000020;

-- --- Activités : compte 2 (anciens imports, source nulle) + compte 3 (une saisie manuelle) ---------------------------------
insert into legacy.activities (id, user_id, name, sport, start_date_local, moving_time, distance_km, tss, source, category)
select gen_random_uuid(), '22222222-2222-4222-8222-222222222222', 'Import ' || i, (array['Ride','Run','Swim'])[1 + (i % 3)],
  timestamptz '2024-03-01 18:00:00+00' + (i * interval '2 days'), 3000 + i * 10, 20 + (i % 30), 40 + (i % 60), null, null
from generate_series(1, 80) i;
insert into legacy.activities (id, user_id, name, sport, start_date_local, moving_time, tss, source, category, client_id, user_notes)
values (gen_random_uuid(), '33333333-3333-4333-8333-333333333333', 'Séance manuelle', 'WeightTraining', timestamptz '2026-09-15 18:00:00+00', 3600, 45, 'manual', 'entrainement', 'v2-abc', 'ok');
-- doublon exact (même minute, même sport, même durée) : doit migrer tel quel (la déduplication est une décision humaine)
insert into legacy.activities (id, user_id, strava_id, name, sport, start_date_local, moving_time, tss, source)
select gen_random_uuid(), user_id, 8000001, name, sport, start_date_local, moving_time, tss, source from legacy.activities where strava_id = 9000100;

-- --- Séances prévues et compétitions ------------------------------------------------------------------------------------------
insert into legacy.activity_planned (id, user_id, category, name, date, sport, duration, tss, rpe, km, d_plus, notes, structure, start_date_local, gpx_name, gpx_content, priority, type, est_watts, est_if, created_by_ia)
values
 ('aaaaaaa1-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'entrainement', 'Fractionné', '2026-10-14', 'Run', 55, 70, 7, 9.5, 60, 'n', '[{"name":"Bloc","reps":1,"type":"steady"}]'::jsonb, '2026-10-14T00:00:00+00', null, null, null, null, null, null, false),
 ('aaaaaaa1-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'entrainement', 'Endurance', '2026-10-15', 'cyclisme', 90, 62, null, null, null, null, null, '2026-10-15T09:30:00+00', 't.gpx', '<gpx><trk><trkseg><trkpt lat="1" lon="1"/></trkseg></trk></gpx>', null, null, 180, 0.7, false),
 ('aaaaaaa1-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'entrainement', '', '2026-10-16', null, 0, null, 15, null, null, null, null, null, null, null, null, null, null, null, true),
 ('aaaaaaa1-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'competition', 'Hyrox Open', '2026-11-08', 'Hyrox', 70, null, null, null, null, 'obj', null, '2026-11-08T09:00:00+00', null, null, 'a', 'Hyrox', null, null, false),
 ('aaaaaaa1-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'competition', 'Ronde', '2026-12-13', 'Run', 40, null, null, 10.15, 42, null, null, null, 'ronde.gpx', '<gpx/>', 'B', 'Route', null, null, false);
update legacy.activities set planned_id = 'aaaaaaa1-0000-4000-8000-000000000001' where strava_id = 9000030;

-- --- Modèles, retouches ----------------------------------------------------------------------------------------------------
insert into legacy.activity_template (id, user_id, name, sport, sport_raw, duration_min, tss, rpe, distance_km, dplus, structure, sort_order)
values (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', 'Sweet spot', 'ride', 'Ride', 90, 80, 7, null, null, '[{"name":"SS"}]'::jsonb, 2),
       (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', 'Footing', 'run', 'Run', 45, 35, 4, 8, 40, null, 1),
       (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', 'Inconnu', null, null, null, null, null, null, null, null, 0);
insert into legacy.activity_edits (user_id, activity_id, data) values
  ('11111111-1111-4111-8111-111111111111', '9000005', '{"name": "Renommée", "duration": 75, "distance_km": 30.5, "tss": 66, "rpe": 7, "notes": "retouche", "sport": "Run"}'),
  ('11111111-1111-4111-8111-111111111111', '9000006', '{"name": "Autre"}'),
  ('11111111-1111-4111-8111-111111111111', 'ORPHELINE-999', '{"name": "Fantôme"}');

-- --- Profils ---------------------------------------------------------------------------------------------------------------
insert into legacy.profiles (id, role, display_name, locale) values
  ('11111111-1111-4111-8111-111111111111', 'both', 'Alex', 'fr'), ('22222222-2222-4222-8222-222222222222', 'both', 'Sam', 'fr'), ('33333333-3333-4333-8333-333333333333', 'both', 'Kim', 'en');
insert into legacy.user_profiles (user_id, display_name, ftp, hr_max, lthr, weight, strava_athlete_id, extras) values
 ('11111111-1111-4111-8111-111111111111', 'Alex', 250, 196, 172, 71.5, 123456,
  jsonb_build_object('full_name', 'Alex Martin', 'birth_date', '1998-04-02', 'sex', 'M', 'height', '178', 'city', 'Toulouse', 'country', 'France', 'club', 'TC31',
     'avatar_url', repeat('x', 700), 'cp', '245', 'wprime', '19', 'rhr', '48', 'vma', '18.5', 'vo2max_run', '62', 'css', '85', 'pace_5k', '3:55',
     'allergies', 'pollen', 'medications', 'aucun', 'emergency_phone', '0600000000', 'injury_history', 'genou')),
 ('22222222-2222-4222-8222-222222222222', 'Sam', null, null, null, null, null, jsonb_build_object('birth_date', 'pas une date', 'sex', 'x', 'height', '9999', 'vma', 'abc')),
 ('33333333-3333-4333-8333-333333333333', 'Kim', 200, 185, null, 60, null, '{}'::jsonb);

-- --- Connexions (jetons FICTIFS) ---------------------------------------------------------------------------------------------
insert into legacy.connexions_app (user_id, app, external_id, athlete_name, access_token, refresh_token, expires_at, scope, last_sync_status, total_activities_synced) values
 ('11111111-1111-4111-8111-111111111111', 'strava', '123456', 'Alex M', 'tok_access_fictif', 'tok_refresh_fictif', now() + interval '1 hour', 'read,activity:read_all', 'ok', 300),
 ('22222222-2222-4222-8222-222222222222', 'whoop', 'w1', 'Sam', 'tok_whoop', 'tok_whoop_r', now(), null, null, 0);
insert into legacy.connexions_app (user_id, app, access_token, expires_at, oauth1_token, oauth1_secret, last_sync_status, last_sync_error) values
 ('11111111-1111-4111-8111-111111111111', 'garmin', 'tok_garmin_fictif', now(), 'oauth1_fictif', 'secret_fictif', 'error', repeat('e', 800));

-- --- Sommeil, synchro, calendrier, objectifs ------------------------------------------------------------------------------------
insert into legacy.garmin_sleep (user_id, date, bedtime, wake_time, total_sec, deep_sec, light_sec, rem_sec, awake_sec, avg_stress, avg_heart_rate, resting_heart_rate, hrv_avg, score, score_qualifier, score_detail, segments, hr_stream) values
 ('11111111-1111-4111-8111-111111111111', '2026-10-10', '2026-10-09 23:10', '2026-10-10 07:05', 28500, 5400, 14000, 6000, 3100, 22.5, 52.3, 46, 61.0, 82, 'GOOD', '{"a":1}', '[{"s":1}]', '[1,2,3]'),
 ('11111111-1111-4111-8111-111111111111', '2026-10-11', null, null, 90000, 1, 1, 1, 1, null, null, null, null, 120, null, null, null, null),
 ('11111111-1111-4111-8111-111111111111', '2026-10-12', 'format invalide', '2026-10-12 06:30', 26000, 4000, 15000, 5000, 2000, null, null, null, null, null, null, null, null, null);
insert into legacy.garmin_sync_requests (user_id, status, requested_at, finished_at, nights, error) values
 ('11111111-1111-4111-8111-111111111111', 'done', now() - interval '1 day', now() - interval '1 day', 2, null),
 ('11111111-1111-4111-8111-111111111111', 'pending', now() - interval '1 hour', null, null, null);
insert into legacy.day_notes (user_id, iso_date, text, type, color, from_date, to_date) values
 ('11111111-1111-4111-8111-111111111111', '2026-09-01', 'ancienne note', null, null, null, null),
 ('11111111-1111-4111-8111-111111111111', null, 'maladie', 'maladie', '#60a5fa', '2026-09-10', '2026-09-14'),
 ('11111111-1111-4111-8111-111111111111', null, 'blessure', 'blessure', '#ff0000', '2026-09-20', '2026-09-18'),
 ('11111111-1111-4111-8111-111111111111', null, 'texte', 'texte', 'rouge', '2026-09-25', '2026-09-25');
insert into legacy.rest_day (user_id, iso_date) values ('11111111-1111-4111-8111-111111111111', '2026-09-30'), ('11111111-1111-4111-8111-111111111111', '2026-10-01');
insert into legacy.training_phases (user_id, phase, from_date, to_date, name) values ('11111111-1111-4111-8111-111111111111', 'recup', '2026-10-01', '2026-10-07', 'Récup');
insert into legacy.yearly_goals (user_id, year, sport, template, target, current_manual) values
 ('11111111-1111-4111-8111-111111111111', 2026, 'course', 'distance', 1500, null), ('11111111-1111-4111-8111-111111111111', 2026, 'velo', 'distance', 8000, 120),
 ('11111111-1111-4111-8111-111111111111', 2026, 'velo', 'distance', 9000, null);
insert into legacy.preferences (user_id, key, value) values ('11111111-1111-4111-8111-111111111111', 'theme', '"clair"');
insert into legacy.user_dashboard (user_id, layout) values ('11111111-1111-4111-8111-111111111111', '{"v":1,"auto":false,"widgets":[{"id":"charge","taille":"l"}]}');
insert into legacy.od_prefs (user_id, overrides, hidden) values ('11111111-1111-4111-8111-111111111111', '{"x":{"y":1}}', '["a"]');
insert into legacy.oauth_states (state, user_id, provider, return_url) values (repeat('a', 64), '11111111-1111-4111-8111-111111111111', 'strava', 'https://x/');

-- --- Force et Hyrox ---------------------------------------------------------------------------------------------------------
insert into legacy.strength_exercises (id, user_id, name, muscle_group) values ('eeeeeee1-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Développé Svend', 'pectoraux');
insert into legacy.strength_programs (id, user_id, name, exercises) values
 ('bbbbbbb1-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'PUSH',
  '[{"key":"developpe-couche","name":"Développé couché","group":"pectoraux","sets":4,"reps":8,"weight":82.5},
    {"key":"perso-eeeeeee1-0000-4000-8000-000000000001","name":"Développé Svend","group":"pectoraux","sets":3,"reps":12,"weight":20},
    {"key":"exo-inconnu","name":"Exercice disparu","group":"bras","sets":2,"reps":10,"weight":0}]'::jsonb);
insert into legacy.strength_sets (user_id, activity_id, date, exercise_key, exercise_name, muscle_group, position, set_no, reps, weight_kg)
select '11111111-1111-4111-8111-111111111111', a.id, a.start_date_local::date, k.key, k.nom, k.groupe, k.pos, n, 8, 80 + n
from (select id, start_date_local from legacy.activities where sport = 'WeightTraining' and user_id = '11111111-1111-4111-8111-111111111111' order by start_date_local limit 3) a,
     (values ('squat', 'Squat', 'jambes', 0), ('perso-eeeeeee1-0000-4000-8000-000000000001', 'Développé Svend', 'pectoraux', 1), ('exo-inconnu', 'Exercice disparu', 'bras', 2)) as k(key, nom, groupe, pos),
     generate_series(1, 3) n;
insert into legacy.hyrox_tests (user_id, date, label, kind, segments, total_s, source) values
 ('11111111-1111-4111-8111-111111111111', '2026-10-08', 'Simulation', 'test', (select jsonb_agg(250 + i) from generate_series(1, 16) i), (select sum(250 + i) from generate_series(1, 16) i), 'manuel'),
 ('11111111-1111-4111-8111-111111111111', '2026-09-01', 'Course', 'course', (select jsonb_agg(300 + i) from generate_series(1, 16) i), (select sum(300 + i) from generate_series(1, 16) i), 'strava');
insert into legacy.hyrox_objectif (user_id, total_s, segments) values ('11111111-1111-4111-8111-111111111111', 4200, null);

-- --- Forme attendue : l'ancien moteur, recopié à l'identique (sert de référence pour vérifier le nouveau) ----------------------
create or replace function legacy.recalc_daily_metrics(p_user uuid) returns void language plpgsql as $f$
declare d_first date; d_last date; r record; v_ctl numeric := 0; v_atl numeric := 0;
begin
  select min(start_date_local::date), max(start_date_local::date) into d_first, d_last from legacy.activities
  where user_id = p_user and start_date_local is not null and start_date_local::date >= date '2000-01-01';
  if d_first is null then delete from legacy.daily_metrics where user_id = p_user; return; end if;
  delete from legacy.daily_metrics where user_id = p_user and (iso_date < d_first or iso_date > d_last);
  for r in
    with agg as (select start_date_local::date as iso, sum(coalesce(tss, 0)) as tss, sum(round(coalesce(moving_time, elapsed_time, 0) / 60.0)) as dur, count(*) as cnt
                 from legacy.activities where user_id = p_user and start_date_local is not null and start_date_local::date >= date '2000-01-01' group by 1)
    select gs::date as iso, coalesce(a.tss, 0) as tss, coalesce(a.dur, 0) as dur, coalesce(a.cnt, 0) as cnt
    from generate_series(d_first, d_last, interval '1 day') gs left join agg a on a.iso = gs::date order by gs::date
  loop
    v_ctl := v_ctl + (r.tss - v_ctl) * 2 / 43.0; v_atl := v_atl + (r.tss - v_atl) * 2 / 8.0;
    insert into legacy.daily_metrics (user_id, iso_date, tss, ctl, atl, tsb, duration_min, activity_count)
    values (p_user, r.iso, round(r.tss), round(v_ctl, 1), round(v_atl, 1), round(v_ctl - v_atl, 1), r.dur, r.cnt)
    on conflict (user_id, iso_date) do update set tss = excluded.tss, ctl = excluded.ctl, atl = excluded.atl, tsb = excluded.tsb, duration_min = excluded.duration_min, activity_count = excluded.activity_count;
  end loop;
end $f$;
select legacy.recalc_daily_metrics(u) from (select distinct user_id u from legacy.activities) x;
