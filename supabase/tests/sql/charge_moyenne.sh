#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : la charge chronique moyenne de l'année (ctl_moy) et le pic (ctl_max) de rpc_piliers_annuels.
# Usage : bash supabase/tests/sql/charge_moyenne.sh      (prérequis : brew install postgresql@17)
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
create table public.daily_metrics (user_id uuid not null references auth.users(id) on delete cascade, iso_date date not null, ctl numeric, primary key (user_id, iso_date));
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t'), ('00000000-0000-4000-8000-00000000000c','c@t');

-- Compte A, sans capteur de puissance (la charge existe quand même) :
--   2024 : CTL 40, 60, 80 → pic 80, moyenne 60 ; 2025 : CTL 100 pendant 3 jours puis 20 → pic 100, moyenne (300 + 20) / 4 = 80
insert into public.daily_metrics (user_id, iso_date, ctl) values
 ('00000000-0000-4000-8000-00000000000a', '2024-03-01', 40), ('00000000-0000-4000-8000-00000000000a', '2024-03-02', 60), ('00000000-0000-4000-8000-00000000000a', '2024-03-03', 80),
 ('00000000-0000-4000-8000-00000000000a', '2025-03-01', 100), ('00000000-0000-4000-8000-00000000000a', '2025-03-02', 100), ('00000000-0000-4000-8000-00000000000a', '2025-03-03', 100), ('00000000-0000-4000-8000-00000000000a', '2025-03-04', 20),
 -- le compte B : jamais mélangé à A
 ('00000000-0000-4000-8000-00000000000b', '2025-03-01', 500);
-- Compte C : une sortie avec courbe mais aucune charge calculée : ctl_moy et ctl_max vides
insert into public.activities (user_id, name, sport, start_date_local, power_curve, moving_time) values
 ('00000000-0000-4000-8000-00000000000c', 'C', 'Ride', '2025-03-01 09:00+00', '{"300": 300, "1200": 250}', 3600);
grant select on public.activities, public.daily_metrics to authenticated;
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_charge_moyenne.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_charge_moyenne.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
\pset tuples_only on
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select controle, ok from (
select 1 as n, 'deux années : 2024 et 2025, rendues sans capteur de puissance' as controle, (select array_agg(an order by an) from rpc_piliers_annuels()) = array[2024, 2025] as ok
union all select 2, '2024 : pic 80, moyenne 60', (select (ctl_max, ctl_moy) = (80, 60.0) from rpc_piliers_annuels() where an = 2024)
union all select 3, '2025 : pic 100, moyenne 80 (le pic seul cacherait que la charge est retombée à 20)', (select (ctl_max, ctl_moy) = (100, 80.0) from rpc_piliers_annuels() where an = 2025)
union all select 4, 'les colonnes d''avant sont toujours là (p_ref, fc_ref, n_fc, rep_n, fat20) et ctl_moy est la dernière', (select pg_get_function_result('public.rpc_piliers_annuels()'::regprocedure) ~ 'p_ref integer, fc_ref integer, n_fc integer, ctl_moy numeric\)$')
) t order by n;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000b';
select 'compte B : sa propre charge (500), jamais celle de A' as controle, (select (ctl_max, ctl_moy) = (500, 500.0) from rpc_piliers_annuels() where an = 2025) as ok;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000c';
select 'compte C : une sortie avec capteur, aucune charge calculée : ctl_max et ctl_moy vides' as controle, (select ctl_max is null and ctl_moy is null from rpc_piliers_annuels() where an = 2025) as ok;
set request.jwt.claim.sub = '';
select 'sans connexion : aucune ligne' as controle, (select count(*) from rpc_piliers_annuels()) = 0 as ok;
reset role;
set role anon;
select 'anon refusé' as controle, not has_function_privilege('anon', 'public.rpc_piliers_annuels()', 'execute') as ok;
SQL
bash $H stop >/dev/null 2>&1 || true
echo "--- test terminé : toutes les lignes ci-dessus doivent afficher « t »"
