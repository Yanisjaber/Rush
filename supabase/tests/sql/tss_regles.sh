#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : la règle complète de la charge d'une sortie (puissance avec vrai capteur, sinon cardio).
# Usage : bash supabase/tests/sql/tss_regles.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../../.."
H=${LOCAL_PG:-supabase/tests/sql/local_pg.sh}
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.activities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  strava_id bigint, name text, sport text, start_date_local timestamptz, merged_into uuid,
  tss integer, np integer, avg_watts integer, avg_heartrate integer, moving_time integer, elapsed_time integer,
  excl_power boolean, excl_hr boolean, excl_load boolean, excl_duration boolean,
  device_watts boolean, power_curve jsonb, ftp_at_time integer, intensity numeric
);
create table public.daily_metrics (user_id uuid not null references auth.users(id) on delete cascade, iso_date date not null, tss numeric, ctl numeric, atl numeric, tsb numeric, duration_min numeric, activity_count integer, primary key (user_id, iso_date));
create table public.user_profiles (user_id uuid primary key references auth.users(id) on delete cascade, ftp integer, hr_max integer, lthr integer);
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t');
-- A : LTHR au profil (170) ; B : pas de LTHR mais une FC max de 190 (→ 175)
insert into public.user_profiles (user_id, ftp, hr_max, lthr) values ('00000000-0000-4000-8000-00000000000a', null, 195, 170), ('00000000-0000-4000-8000-00000000000b', null, 190, null);

-- Un effort de 20 min à 300 W (FTP 285) il y a 100 jours : il sert à estimer la FTP des sorties à moins de 45 jours de lui
insert into public.activities (user_id, strava_id, name, sport, start_date_local, device_watts, power_curve, moving_time, ftp_at_time, tss) values
 ('00000000-0000-4000-8000-00000000000a', 1, 'effort', 'Ride', current_date - 100, true, '{"1200": 300}', 3600, 300, 50),
 ('00000000-0000-4000-8000-00000000000b', 2, 'effort B', 'Ride', current_date - 100, true, '{"1200": 300}', 3600, 300, 50);
-- Les sorties de A (toutes d'1 h, TSS bidon 50, FTP « du jour » 300)
insert into public.activities (user_id, strava_id, name, sport, start_date_local, device_watts, np, avg_heartrate, moving_time, elapsed_time, ftp_at_time, intensity, tss) values
 ('00000000-0000-4000-8000-00000000000a', 10, 'a1 capteur, NP, FTP estimée', 'Ride', current_date - 95, true, 285, 150, 3600, 3600, 300, 0.95, 50),
 ('00000000-0000-4000-8000-00000000000a', 11, 'a2 watts estimés par Strava', 'Ride', current_date - 94, false, 200, 150, 3600, 3600, 300, 0.667, 50),
 ('00000000-0000-4000-8000-00000000000a', 12, 'a3 watts estimés, sans cardio', 'Ride', current_date - 93, false, 200, null, 3600, 3600, 300, 0.667, 50),
 ('00000000-0000-4000-8000-00000000000a', 13, 'a4 course avec capteur de foulée', 'Run', current_date - 92, true, 250, 160, 3600, 3600, 300, 0.833, 50),
 ('00000000-0000-4000-8000-00000000000a', 14, 'a5 vélo électrique', 'EBikeRide', current_date - 91, true, 150, 120, 3600, 3600, 300, 0.5, 50),
 ('00000000-0000-4000-8000-00000000000a', 15, 'a6 capteur mais aucun effort à moins de 180 j', 'Ride', current_date - 800, true, 200, 150, 3600, 3600, 300, 0.667, 50),
 ('00000000-0000-4000-8000-00000000000a', 16, 'a7 durée en temps total (pas de temps de déplacement)', 'Run', current_date - 90, true, 250, 170, null, 1800, 300, 0.8, 50);
-- Ce qui ne doit JAMAIS changer : séance saisie à la main (pas de strava_id), sortie sans watts
insert into public.activities (user_id, strava_id, name, sport, start_date_local, device_watts, np, avg_heartrate, moving_time, ftp_at_time, intensity, tss) values
 ('00000000-0000-4000-8000-00000000000a', null, 'a8 saisie à la main avec watts', 'Ride', current_date - 89, false, 200, 150, 3600, 300, 0.667, 50),
 ('00000000-0000-4000-8000-00000000000a', 17, 'a9 sans watts', 'Ride', current_date - 88, false, null, 150, 3600, null, null, 50);
-- Le flux cardio (hr_s secondes, hr_sq somme des carrés) : TSS seconde par seconde
insert into public.activities (user_id, strava_id, name, sport, start_date_local, device_watts, np, avg_heartrate, moving_time, ftp_at_time, intensity, tss, power_curve) values
 -- f1 : 30 min à 120 et 30 min à 180 (moyenne 150) : (120² + 180²) / 2 = 23400 par seconde ; TSS = 100 × 3600 × 23400 / (170² × 3600) = 80,97 → 81 (contre 78 avec la moyenne)
 ('00000000-0000-4000-8000-00000000000a', 30, 'f1 cardio seul avec flux', 'Ride', current_date - 87, false, null, 150, 3600, null, null, 50, jsonb_build_object('hr_s', 3600, 'hr_sq', 1800 * 120 * 120 + 1800 * 180 * 180)),
 -- f2 : le flux ne couvre que 40 % de la sortie (capteur décroché) : on retombe sur la FC moyenne (150 / 170)² = 78
 ('00000000-0000-4000-8000-00000000000a', 31, 'f2 flux incomplet', 'Ride', current_date - 86, false, null, 150, 3600, null, null, 50, jsonb_build_object('hr_s', 1440, 'hr_sq', 1440 * 150 * 150)),
 -- f3 : flux seul, sans FC moyenne enregistrée : 3600 s à 170 = 100
 ('00000000-0000-4000-8000-00000000000a', 32, 'f3 flux sans FC moyenne', 'Run', current_date - 85, false, null, null, 3600, null, null, 50, jsonb_build_object('hr_s', 3600, 'hr_sq', 3600 * 170 * 170)),
 -- f4 : watts estimés mais flux cardio : le flux sert aussi (la sortie n'a pas de capteur) : 30 min à 100 → (100 / 170)² × 50 = 17,3 → 17
 ('00000000-0000-4000-8000-00000000000a', 33, 'f4 watts estimés avec flux', 'Ride', current_date - 84, false, 200, 100, 1800, 300, 0.667, 50, jsonb_build_object('hr_s', 1800, 'hr_sq', 1800 * 100 * 100));
-- Utilisateur B (LTHR = 92 % de 190 = 175) : course avec watts
insert into public.activities (user_id, strava_id, name, sport, start_date_local, device_watts, np, avg_heartrate, moving_time, ftp_at_time, intensity, tss) values
 ('00000000-0000-4000-8000-00000000000b', 20, 'b1 course', 'Run', current_date - 80, true, 250, 175, 3600, 300, 0.833, 50);
grant select on public.activities, public.daily_metrics to authenticated;
create function public.trg_recalc_daily_metrics() returns trigger language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  for u in select distinct user_id from changed_rows where user_id is not null loop
    perform public.recalc_daily_metrics(u);
  end loop;
  return null;
end;
$$;
create trigger activities_recalc_metrics_upd after update on public.activities referencing new table as changed_rows for each statement execute function public.trg_recalc_daily_metrics();
SQL

sed -n '/^create or replace function public.tss_retenu/,/^\$\$;/p' supabase/migrations/2026-11-02_duree_ecartable.sql > /tmp/tss_retenu_test.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f /tmp/tss_retenu_test.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-02_forme_jusqua_aujourdhui.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-02_ftp_glissante.sql   # le backfill de la migration fait le travail
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-02_ftp_glissante.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
\pset tuples_only on
select controle, ok from (
select 1 as n, 'a1 capteur + NP : TSS de puissance avec la FTP estimée (95 % de 300 = 285) : TSS 100, intensité 1' as controle, (select (ftp_at_time, tss, intensity) = (285, 100, 1.000) from public.activities where name like 'a1 %') as ok
union all select 2, 'a2 watts estimés : TSS cardio (150 / 170)² = 78, plus d''intensité, FTP laissée', (select (tss, intensity is null, ftp_at_time) = (78, true, 300) from public.activities where name like 'a2 %')
union all select 3, 'a3 watts estimés sans cardio : rien ne change (TSS 50)', (select (tss, ftp_at_time) = (50, 300) from public.activities where name like 'a3 %')
union all select 4, 'a4 course avec capteur de foulée : TSS cardio (160 / 170)² = 89', (select (tss, intensity is null) = (89, true) from public.activities where name like 'a4 %')
union all select 5, 'a5 vélo électrique : TSS cardio (120 / 170)² = 50', (select (tss, intensity is null) = (50, true) from public.activities where name like 'a5 %')
union all select 6, 'a6 capteur mais aucun effort : garde son TSS et sa FTP', (select (tss, ftp_at_time, intensity) = (50, 300, 0.667) from public.activities where name like 'a6 %')
union all select 7, 'a7 sans temps de déplacement : la durée totale (0,5 h) sert : (170 / 170)² × 50 = 50', (select tss = 50 and intensity is null from public.activities where name like 'a7 %')
union all select 8, 'a8 saisie à la main : jamais touchée (TSS 50)', (select tss = 50 from public.activities where name like 'a8 %')
union all select 8.5, 'a9 sans watts (cardio seul), sans flux : TSS d''après la FC moyenne, (150 / 170)² = 78', (select (tss, intensity is null) = (78, true) from public.activities where name like 'a9 %')
union all select 8.6, 'f1 flux : (120² + 180²) / 2 → TSS 81, plus haut que 78 avec la moyenne', (select tss = 81 from public.activities where name like 'f1 %')
union all select 8.7, 'f2 flux qui couvre 40 % : on retombe sur la FC moyenne (78)', (select tss = 78 from public.activities where name like 'f2 %')
union all select 8.8, 'f3 flux sans FC moyenne : TSS 100', (select tss = 100 from public.activities where name like 'f3 %')
union all select 8.9, 'f4 watts estimés + flux : TSS du flux (17), plus d''intensité', (select (tss, intensity is null) = (17, true) from public.activities where name like 'f4 %')
union all select 9, 'b1 : pas de LTHR au profil → 92 % de la FC max (175) : (175 / 175)² = 100', (select tss = 100 from public.activities where name like 'b1 %')
union all select 10, 'relançable : une 2e passe ne modifie plus rien', (select public.recalc_ftp_tss('00000000-0000-4000-8000-00000000000a') = 0 and public.recalc_ftp_tss('00000000-0000-4000-8000-00000000000b') = 0)
union all select 11, 'la charge suit : le jour de a2, TSS 78 dans daily_metrics', (select tss = 78 from public.daily_metrics where user_id = '00000000-0000-4000-8000-00000000000a' and iso_date = current_date - 94)
union all select 12, 'on peut lancer la fonction deux fois de suite sans erreur et seul le service y a accès', (select not has_function_privilege('authenticated', 'public.recalc_ftp_tss(uuid)', 'execute') and not has_function_privilege('anon', 'public.recalc_ftp_tss(uuid)', 'execute'))
) t order by n;
SQL
echo "--- test terminé : toutes les lignes ci-dessus doivent afficher « t »"
