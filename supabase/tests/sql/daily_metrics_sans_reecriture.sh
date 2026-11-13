#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) de la migration 2026-11-14_daily_metrics_sans_reecriture.sql :
#   - le calcul est INCHANGÉ (mêmes valeurs qu'avec l'ancienne fonction) ;
#   - recalculer sans rien changer ne réécrit aucune ligne ;
#   - ajouter une séance d'aujourd'hui ne réécrit que les derniers jours, pas toute la série.
# Usage : bash supabase/tests/sql/daily_metrics_sans_reecriture.sh      (prérequis : brew install postgresql@17)
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
# 120 jours de séances (la fonction actuelle de la prod), puis recalcul avec l'ANCIENNE fonction : la référence
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
insert into public.activities (user_id, name, sport, start_date_local, moving_time, tss, np, avg_watts, avg_heartrate)
select '00000000-0000-4000-8000-00000000000a', 's' || g, 'Ride', (current_date - g) + time '09:00', 3600, 40 + (g % 7) * 10, 180, 170, 140
from generate_series(1, 120) g where g % 3 <> 0;
select public.recalc_daily_metrics('00000000-0000-4000-8000-00000000000a');
create table reference as select iso_date, tss, ctl, atl, tsb, duration_min, activity_count from public.daily_metrics where user_id = '00000000-0000-4000-8000-00000000000a';
SQL
# La migration, deux fois (relançable), puis recalcul avec la NOUVELLE fonction
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-14_daily_metrics_sans_reecriture.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-14_daily_metrics_sans_reecriture.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
truncate public.daily_metrics;
select public.recalc_daily_metrics('00000000-0000-4000-8000-00000000000a');
-- (la copie de la fonction en base prolonge la série jusqu'à aujourd'hui : on compare jusqu'à la dernière séance)
create table calcul as select not exists (select 1 from reference r full join (select * from public.daily_metrics where user_id = '00000000-0000-4000-8000-00000000000a' and iso_date <= (select max(iso_date) from reference)) d on d.iso_date = r.iso_date
  where (r.tss, r.ctl, r.atl, r.tsb, r.duration_min, r.activity_count) is distinct from (d.tss, d.ctl, d.atl, d.tsb, d.duration_min, d.activity_count)) as ok;
-- xmin = la version de la ligne : elle ne change que si la ligne est réécrite
create table versions as select iso_date, xmin::text as v from public.daily_metrics;
select public.recalc_daily_metrics('00000000-0000-4000-8000-00000000000a');
insert into public.activities (user_id, name, sport, start_date_local, moving_time, tss, np, avg_watts, avg_heartrate)
  values ('00000000-0000-4000-8000-00000000000a', 'aujourd''hui', 'Ride', current_date + time '08:00', 3600, 90, 190, 180, 140);
create table versions_apres_ajout as select iso_date, xmin::text as v from public.daily_metrics;
SQL
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
select 'le calcul est inchangé (mêmes valeurs que l''ancienne fonction)' as controle, (select ok from calcul) as ok
union all select 'recalculer sans rien changer ne réécrit aucune ligne' as controle,
  not exists (select 1 from versions a join public.daily_metrics d on d.iso_date = a.iso_date and d.xmin::text <> a.v) as ok;
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -c "select public.recalc_daily_metrics('00000000-0000-4000-8000-00000000000a')"
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
select 'après l''ajout d''une séance d''aujourd''hui : les jours de plus de 30 jours ne sont pas réécrits' as controle,
  not exists (select 1 from versions a join public.daily_metrics d on d.iso_date = a.iso_date and d.iso_date < current_date - 30 and d.xmin::text <> a.v) as ok
union all select 'et la ligne d''aujourd''hui existe avec la nouvelle charge',
  (select tss from public.daily_metrics where iso_date = current_date and user_id = '00000000-0000-4000-8000-00000000000a') = 90
union all select 'au plus quelques jours sont réécrits (pas toute la série)',
  (select count(*) from versions a join public.daily_metrics d on d.iso_date = a.iso_date and d.xmin::text <> a.v) < 60;
SQL
