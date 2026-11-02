#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : le volume de l'année (heures, jours actifs, jours couverts) de rpc_piliers_annuels.
# Usage : bash supabase/tests/sql/charge_volume.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../../.."
H=${LOCAL_PG:-supabase/tests/sql/local_pg.sh}
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.activities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text, sport text, start_date_local timestamptz, power_curve jsonb, merged_into uuid,
  np integer, avg_watts integer, avg_heartrate integer, excl_power boolean, excl_hr boolean, moving_time integer, excl_duration boolean
);
create table public.daily_metrics (user_id uuid not null references auth.users(id) on delete cascade, iso_date date not null, ctl numeric, duration_min numeric, activity_count integer, primary key (user_id, iso_date));
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t');

-- Compte A :
--   2024 (année complète, 366 jours) : 10 jours actifs de 2 h (120 min) et le reste au repos : 20 h, 10 jours actifs, 366 jours couverts
--   2025 (série qui ne couvre que 30 jours, du 1er au 30 juin) : 4 jours actifs de 90 min, 1 jour avec 2 sorties (activity_count 2, 60 min) : 7 h, 5 jours actifs, 30 jours couverts
insert into public.daily_metrics (user_id, iso_date, ctl, duration_min, activity_count)
select '00000000-0000-4000-8000-00000000000a', d::date, 50,
       case when extract(doy from d) <= 10 then 120 else 0 end,
       case when extract(doy from d) <= 10 then 1 else 0 end
from generate_series(date '2024-01-01', date '2024-12-31', interval '1 day') d;
insert into public.daily_metrics (user_id, iso_date, ctl, duration_min, activity_count)
select '00000000-0000-4000-8000-00000000000a', d::date, 60,
       case when extract(day from d) <= 4 then 90 when extract(day from d) = 5 then 60 else 0 end,
       case when extract(day from d) <= 4 then 1 when extract(day from d) = 5 then 2 else 0 end
from generate_series(date '2025-06-01', date '2025-06-30', interval '1 day') d;
-- Compte B : jamais mélangé
insert into public.daily_metrics (user_id, iso_date, ctl, duration_min, activity_count) values ('00000000-0000-4000-8000-00000000000b', '2025-06-01', 99, 6000, 3);
grant select on public.activities, public.daily_metrics to authenticated;
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_charge_volume.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_charge_volume.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
\pset tuples_only on
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select controle, ok from (
select 1 as n, 'deux années : 2024 et 2025' as controle, (select array_agg(an order by an) from rpc_piliers_annuels()) = array[2024, 2025] as ok
union all select 2, '2024 : 20 h, 10 jours actifs, 366 jours couverts (année bissextile complète)', (select (heures, jours_actifs, jours_couverts) = (20.0, 10, 366) from rpc_piliers_annuels() where an = 2024)
union all select 3, '2025 : 7 h, 5 jours actifs (même avec 2 sorties le même jour), 30 jours couverts seulement', (select (heures, jours_actifs, jours_couverts) = (7.0, 5, 30) from rpc_piliers_annuels() where an = 2025)
union all select 4, 'la charge moyenne et le pic sont toujours rendus (2024 : 50 et 50 ; 2025 : 60)', (select (select (ctl_max, ctl_moy) = (50, 50.0) from rpc_piliers_annuels() where an = 2024) and (select ctl_moy = 60.0 from rpc_piliers_annuels() where an = 2025))
union all select 5, 'les colonnes de volume sont les dernières', (select pg_get_function_result('public.rpc_piliers_annuels()'::regprocedure) ~ 'ctl_moy numeric, heures numeric, jours_actifs integer, jours_couverts integer\)$')
) t order by n;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000b';
select 'compte B : son propre volume (100 h, 1 jour actif), jamais celui de A' as controle, (select (heures, jours_actifs, jours_couverts) = (100.0, 1, 1) from rpc_piliers_annuels() where an = 2025) as ok;
set request.jwt.claim.sub = '';
select 'sans connexion : aucune ligne' as controle, (select count(*) from rpc_piliers_annuels()) = 0 as ok;
reset role;
set role anon;
select 'anon refusé' as controle, not has_function_privilege('anon', 'public.rpc_piliers_annuels()', 'execute') as ok;
SQL
bash $H stop >/dev/null 2>&1 || true
echo "--- test terminé : toutes les lignes ci-dessus doivent afficher « t »"
