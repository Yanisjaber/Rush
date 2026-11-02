#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : la FTP glissante (recalc_ftp_tss) et la série de forme jusqu'à aujourd'hui.
# Usage : bash supabase/tests/sql/ftp_glissante.sh      (prérequis : brew install postgresql@17)
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
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t'), ('00000000-0000-4000-8000-00000000000c','c@t');
insert into public.user_profiles (user_id, ftp) values ('00000000-0000-4000-8000-00000000000b', 260);

-- Utilisateur A, sans FTP au profil. Toutes les sorties partent avec la FTP « du jour » (300) et un TSS bidon (50).
-- Efforts qui servent à estimer : D-1000 (20 min à 200 W → FTP 190), D-400 (250 W → 238), D-150 (300 W → 285).
insert into public.activities (user_id, name, sport, start_date_local, device_watts, power_curve, np, moving_time, ftp_at_time, tss, merged_into) values
 ('00000000-0000-4000-8000-00000000000a', 'effort 1', 'Ride', current_date - 1000, true, '{"1200": 200}', null, 3600, 300, 50, null),
 ('00000000-0000-4000-8000-00000000000a', 'effort 2', 'GravelRide', current_date - 400, true, '{"1200": 250}', null, 3600, 300, 50, null),
 ('00000000-0000-4000-8000-00000000000a', 'effort 3', 'Ride', current_date - 150, true, '{"1200": 300}', null, 3600, 300, 50, null),
 -- ce qui ne doit JAMAIS servir à estimer : watts estimés par Strava, puissance écartée, course, vélo électrique, étape fusionnée
 ('00000000-0000-4000-8000-00000000000a', 'watts estimés', 'Ride', current_date - 130, false, '{"1200": 400}', null, 3600, 300, 50, null),
 ('00000000-0000-4000-8000-00000000000a', 'puissance écartée', 'Ride', current_date - 125, true, '{"1200": 400}', null, 3600, 300, 50, null),
 ('00000000-0000-4000-8000-00000000000a', 'course', 'Run', current_date - 128, true, '{"1200": 500}', null, 3600, 300, 50, null),
 ('00000000-0000-4000-8000-00000000000a', 'vélo électrique', 'EBikeRide', current_date - 127, true, '{"1200": 450}', null, 3600, 300, 50, null),
 ('00000000-0000-4000-8000-00000000000a', 'étape fusionnée', 'Ride', current_date - 126, true, '{"1200": 450}', null, 3600, 300, 50, gen_random_uuid());
update public.activities set excl_power = true where name = 'puissance écartée';
-- Un effort d'un AUTRE compte, très fort, au même moment : il ne doit pas fuiter chez A
insert into public.activities (user_id, name, sport, start_date_local, device_watts, power_curve, np, moving_time, ftp_at_time, tss) values
 ('00000000-0000-4000-8000-00000000000c', 'effort du compte C', 'Ride', current_date - 120, true, '{"1200": 1000}', null, 3600, 300, 50);
-- Les sorties à recalculer (NP, 1 h)
insert into public.activities (user_id, name, sport, start_date_local, device_watts, np, moving_time, ftp_at_time, tss) values
 ('00000000-0000-4000-8000-00000000000a', 'r1 dans la fenêtre de l''effort 1', 'Ride', current_date - 990, true, 190, 3600, 300, 50),
 ('00000000-0000-4000-8000-00000000000a', 'r2 dans la fenêtre de l''effort 2', 'Ride', current_date - 430, true, 238, 3600, 300, 50),
 ('00000000-0000-4000-8000-00000000000a', 'r3 aucun effort à moins de 180 j', 'Ride', current_date - 700, true, 200, 3600, 300, 50),
 ('00000000-0000-4000-8000-00000000000a', 'r4 à 80 j de l''effort 1 (fenêtre ±90)', 'Ride', current_date - 920, true, 190, 3600, 300, 50),
 ('00000000-0000-4000-8000-00000000000a', 'r5 à 100 et 150 j (fenêtre ±180, le plus fort)', 'Ride', current_date - 300, true, 285, 3600, 300, 50),
 ('00000000-0000-4000-8000-00000000000a', 'r6 près de l''effort 3', 'VirtualRide', current_date - 120, true, 285, 3600, 300, 50);
-- Ce qui ne doit PAS changer : sans NP (cardio), course avec watts, vélo électrique, étape fusionnée
insert into public.activities (user_id, name, sport, start_date_local, device_watts, np, avg_heartrate, moving_time, ftp_at_time, tss, merged_into) values
 ('00000000-0000-4000-8000-00000000000a', 'cardio seul', 'Ride', current_date - 990, false, null, 140, 3600, 300, 77, null),
 ('00000000-0000-4000-8000-00000000000a', 'course avec watts', 'Run', current_date - 990, true, 250, null, 3600, 300, 50, null),
 ('00000000-0000-4000-8000-00000000000a', 'vélo électrique avec NP', 'EBikeRide', current_date - 990, true, 150, null, 3600, 300, 50, null),
 ('00000000-0000-4000-8000-00000000000a', 'étape fusionnée avec NP', 'Ride', current_date - 990, true, 200, null, 3600, 300, 50, gen_random_uuid());

-- Utilisateur B, FTP au profil = 260. Un seul effort : D-200 (240 W → 228).
insert into public.activities (user_id, name, sport, start_date_local, device_watts, power_curve, np, moving_time, ftp_at_time, tss) values
 ('00000000-0000-4000-8000-00000000000b', 'effort B', 'Ride', current_date - 200, true, '{"1200": 240}', null, 3600, 300, 50);
insert into public.activities (user_id, name, sport, start_date_local, device_watts, np, moving_time, ftp_at_time, tss) values
 ('00000000-0000-4000-8000-00000000000b', 'b1 il y a 30 j (profil)', 'Ride', current_date - 30, true, 260, 3600, 300, 50),
 ('00000000-0000-4000-8000-00000000000b', 'b2 il y a 85 j (profil)', 'Ride', current_date - 85, true, 260, 3600, 300, 50),
 ('00000000-0000-4000-8000-00000000000b', 'b3 il y a 95 j (estimation ±180)', 'Ride', current_date - 95, true, 228, 3600, 300, 50),
 ('00000000-0000-4000-8000-00000000000b', 'b4 près de l''effort B (estimation ±45)', 'Ride', current_date - 190, true, 228, 3600, 300, 50);
-- Toutes les sorties viennent de Strava (la règle ne touche que celles-là)
update public.activities a set strava_id = s.rn from (select id, 1000000 + row_number() over () as rn from public.activities) s where a.id = s.id;
grant select on public.activities, public.daily_metrics to authenticated;

-- Le déclencheur de prod (2026-07-08) : toute modification de `activities` relance la charge, une fois par instruction
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

# tss_retenu vient de la migration de la durée écartable ; les deux migrations du jour, deux fois chacune (relançable)
sed -n '/^create or replace function public.tss_retenu/,/^\$\$;/p' supabase/migrations/2026-11-02_duree_ecartable.sql > /tmp/tss_retenu_test.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f /tmp/tss_retenu_test.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-02_forme_jusqua_aujourdhui.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-02_forme_jusqua_aujourdhui.sql   # relançable
# Les sorties ont toujours la FTP du jour (300) avant la migration FTP ? Le backfill de la première migration n'y touche pas.
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-02_ftp_glissante.sql   # le backfill de la migration fait le travail
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-02_ftp_glissante.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
\pset tuples_only on
with ctl_dernier as (select ctl from public.daily_metrics where user_id = '00000000-0000-4000-8000-00000000000a' and iso_date = (select max(start_date_local)::date from public.activities where user_id = '00000000-0000-4000-8000-00000000000a' and np > 0)),
     ctl_auj as (select ctl from public.daily_metrics where user_id = '00000000-0000-4000-8000-00000000000a' and iso_date = current_date)
select controle, ok from (
select 1 as n, 'A r1 : FTP 190 (95 % de 200 W, effort à 10 j), TSS 100' as controle, (select (ftp_at_time, tss, intensity) = (190, 100, 1.000) from public.activities where name like 'r1 %') as ok
union all select 2, 'A r2 : FTP 238 (95 % de 250 W), TSS 100', (select (ftp_at_time, tss) = (238, 100) from public.activities where name like 'r2 %')
union all select 3, 'A r3 : aucun effort à moins de 180 j : rien ne change (FTP 300, TSS 50)', (select (ftp_at_time, tss) = (300, 50) from public.activities where name like 'r3 %')
union all select 4, 'A r4 : effort à 80 j, la fenêtre s''élargit à ±90 : FTP 190', (select ftp_at_time = 190 from public.activities where name like 'r4 %')
union all select 5, 'A r5 : efforts à 100 et 150 j, fenêtre ±180 : on prend le plus fort (300 W → FTP 285), TSS 100', (select (ftp_at_time, tss) = (285, 100) from public.activities where name like 'r5 %')
union all select 6, 'A r6 : FTP 285 malgré les efforts de 400 W estimés / écartés / course / électrique / fusionnés / autre compte', (select (ftp_at_time, tss) = (285, 100) from public.activities where name like 'r6 %')
union all select 7, 'A : cardio seul, course avec watts, vélo électrique, étape fusionnée ne changent pas', (select count(*) = 4 and bool_and(ftp_at_time = 300 and tss in (50, 77)) from public.activities where name in ('cardio seul', 'course avec watts', 'vélo électrique avec NP', 'étape fusionnée avec NP'))
union all select 8, 'B b1 et b2 (moins de 90 j) : FTP du profil (260)', (select bool_and(ftp_at_time = 260) from public.activities where name like 'b1 %' or name like 'b2 %')
union all select 9, 'B b3 (95 j) : estimation ±180 = 228, pas le profil', (select (ftp_at_time, tss) = (228, 100) from public.activities where name like 'b3 %')
union all select 10, 'B b4 : estimation ±45 = 228, TSS 100', (select (ftp_at_time, tss) = (228, 100) from public.activities where name like 'b4 %')
union all select 11, 'relançable : une 2e passe ne modifie plus rien', (select public.recalc_ftp_tss('00000000-0000-4000-8000-00000000000a') = 0 and public.recalc_ftp_tss('00000000-0000-4000-8000-00000000000b') = 0)
union all select 12, 'le compte C (un seul effort, aucune sortie à recalculer) : 0 modification', (select public.recalc_ftp_tss('00000000-0000-4000-8000-00000000000c') = 0)
union all select 13, 'la charge suit le TSS : le jour de r5 (seule sortie du jour), TSS 100 dans daily_metrics', (select (tss, activity_count) = (100, 1) from public.daily_metrics where user_id = '00000000-0000-4000-8000-00000000000a' and iso_date = current_date - 300)
union all select 14, 'la série va jusqu''à aujourd''hui, même sans séance récente', (select max(iso_date) = current_date from public.daily_metrics where user_id = '00000000-0000-4000-8000-00000000000a')
union all select 15, 'et la forme redescend pendant les jours de repos (CTL d''aujourd''hui < CTL du dernier jour roulé)', (select (select ctl from ctl_auj) < (select ctl from ctl_dernier))
union all select 16, 'ni un utilisateur connecté ni anon ne peut lancer le recalcul', (select not has_function_privilege('authenticated', 'public.recalc_ftp_tss(uuid)', 'execute') and not has_function_privilege('anon', 'public.recalc_ftp_tss(uuid)', 'execute') and not has_function_privilege('authenticated', 'public.recalc_daily_metrics(uuid)', 'execute'))
) t order by n;
SQL
echo "--- test terminé : toutes les lignes ci-dessus doivent afficher « t »"
