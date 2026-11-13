#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) de la migration 2026-11-14_metriques_quotidiennes_fonction.sql :
# la fonction metriques_quotidiennes donne EXACTEMENT les mêmes lignes que l'ancienne table daily_metrics recalculée par recalc_daily_metrics
# (même règles : étapes fusionnées, données écartées, jours sans séance, série jusqu'à aujourd'hui).
# Usage : bash supabase/tests/sql/metriques_quotidiennes.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../../.."
H=supabase/tests/sql/local_pg.sh
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.activities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text, sport text, start_date_local timestamptz,
  moving_time integer, elapsed_time integer, distance_km numeric, total_elevation_gain integer, kj integer, tss integer, np integer, avg_watts integer, device_watts boolean, avg_heartrate integer,
  power_curve jsonb, signal_curves jsonb, merged_into uuid, excl_power boolean, excl_hr boolean, excl_distance boolean);
create table public.daily_metrics (user_id uuid not null references auth.users(id) on delete cascade, iso_date date not null, tss numeric, ctl numeric, atl numeric, tsb numeric, duration_min numeric, activity_count integer, primary key (user_id, iso_date));
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t');
grant select on public.activities, public.daily_metrics to authenticated;
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-02_donnees_ecartees.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-02_duree_ecartable.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-14_metriques_quotidiennes_fonction.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-14_metriques_quotidiennes_fonction.sql   # relançable
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
-- Le compte A : 120 jours de séances, dont une avec une donnée écartée, un triathlon fusionné (parent + étape) et une date aberrante (1970)
insert into public.activities (user_id, name, sport, start_date_local, moving_time, tss, np, avg_watts, avg_heartrate)
select '00000000-0000-4000-8000-00000000000a', 's' || g, 'Ride', (current_date - g) + time '09:00', 3600, 40 + (g % 7) * 10, 180, 170, 140
from generate_series(1, 120) g where g % 3 <> 0;
insert into public.activities (user_id, name, sport, start_date_local, moving_time, tss, np, avg_watts, avg_heartrate, excl_power)
  values ('00000000-0000-4000-8000-00000000000a', 'puissance écartée', 'Ride', (current_date - 3) + time '18:00', 3600, 100, 200, 190, 140, true);
insert into public.activities (id, user_id, name, sport, start_date_local, moving_time, tss) values
  ('b0000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-00000000000a', 'triathlon parent', 'Triathlon', (current_date - 10) + time '07:00', 10800, 200);
insert into public.activities (user_id, name, sport, start_date_local, moving_time, tss, merged_into) values
  ('00000000-0000-4000-8000-00000000000a', 'étape', 'Swim', (current_date - 10) + time '07:00', 1800, 50, 'b0000000-0000-4000-8000-000000000000');
insert into public.activities (user_id, name, sport, start_date_local, moving_time, tss) values ('00000000-0000-4000-8000-00000000000a', 'date aberrante', 'Run', '1970-01-01 00:00', 3600, 80);
-- Le compte B n'a qu'une séance
insert into public.activities (user_id, name, sport, start_date_local, moving_time, tss) values ('00000000-0000-4000-8000-00000000000b', 'b1', 'Run', (current_date - 5) + time '08:00', 3600, 60);
-- La référence : l'ancienne table, recalculée par l'ancienne fonction
select public.recalc_daily_metrics('00000000-0000-4000-8000-00000000000a');
select public.recalc_daily_metrics('00000000-0000-4000-8000-00000000000b');
SQL
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
-- (la copie de l'ancienne fonction s'arrête à la dernière séance : on compare jusqu'à elle ; la nouvelle va, elle, jusqu'à aujourd'hui)
select 'compte A : mêmes lignes que l''ancienne table' as controle,
  not exists (
    select 1 from public.metriques_quotidiennes('00000000-0000-4000-8000-00000000000a') f
    full join (select * from public.daily_metrics where user_id = '00000000-0000-4000-8000-00000000000a') d on d.iso_date = f.iso_date
    where (f.tss, f.ctl, f.atl, f.tsb, f.duration_min, f.activity_count) is distinct from (d.tss::integer, d.ctl, d.atl, d.tsb, d.duration_min::integer, d.activity_count::integer)
      and (f.iso_date <= (select max(iso_date) from public.daily_metrics where user_id = '00000000-0000-4000-8000-00000000000a') or d.iso_date is not null)) as ok
union all select 'compte B : mêmes lignes que l''ancienne table',
  not exists (
    select 1 from public.metriques_quotidiennes('00000000-0000-4000-8000-00000000000b') f
    full join (select * from public.daily_metrics where user_id = '00000000-0000-4000-8000-00000000000b') d on d.iso_date = f.iso_date
    where (f.tss, f.ctl, f.atl, f.tsb, f.duration_min, f.activity_count) is distinct from (d.tss::integer, d.ctl, d.atl, d.tsb, d.duration_min::integer, d.activity_count::integer)
      and (f.iso_date <= (select max(iso_date) from public.daily_metrics where user_id = '00000000-0000-4000-8000-00000000000b') or d.iso_date is not null)) as ok
union all select 'la série va jusqu''à aujourd''hui',
  (select max(iso_date) from public.metriques_quotidiennes('00000000-0000-4000-8000-00000000000a')) = current_date
union all select 'la date de 1970 est ignorée (la série démarre avec la vraie 1re séance)',
  (select min(iso_date) from public.metriques_quotidiennes('00000000-0000-4000-8000-00000000000a')) >= current_date - 120
union all select 'le triathlon fusionné n''est compté qu''une fois (séance du jour 70 + triathlon 200 = 270, et non 320)',
  (select tss from public.metriques_quotidiennes('00000000-0000-4000-8000-00000000000a') where iso_date = current_date - 10) = 270
union all select 'un compte sans séance : aucune ligne',
  (select count(*) from public.metriques_quotidiennes('00000000-0000-4000-8000-0000000000ff')) = 0;
SQL
