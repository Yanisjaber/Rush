#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : la répétabilité se juge sur les 10 meilleures sorties de l'année (rpc_piliers_annuels).
# Usage : bash supabase/tests/sql/repetabilite_top10.sh      (prérequis : brew install postgresql@17)
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
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t');

-- Compte A. Meilleur 5 min de toujours : 400 W (2025, année à 3 sorties avec capteur ou plus) → une sortie valide a un 3e effort d'au moins 200 W.
-- 2025 : 12 sorties valides, 3e effort 210 à 320 W (de 10 en 10), 1er effort = 3e effort ÷ 0,9 (régularité 0,9) pour les 6 plus faibles, ÷ 0,8 pour les 6 plus fortes
--        → les 10 plus fortes sont 230 à 320 W ; médiane du 3e effort = (270 + 280) / 2 = 275 ; régularité : 4 à 0,9 (230 à 260), 6 à 0,8 → médiane 0,8
insert into public.activities (user_id, name, sport, start_date_local, power_curve, moving_time)
select '00000000-0000-4000-8000-00000000000a', 'r ' || i, 'Ride', timestamptz '2025-03-01 09:00+00' + (i * interval '3 days'),
       jsonb_build_object('300', case when i = 12 then 400 else 300 end, 'rep_3', 200 + i * 10, 'rep_1', round((200 + i * 10) / case when i <= 6 then 0.9 else 0.8 end)),
       3600
from generate_series(1, 12) i;
-- ce qui ne compte pas : un 3e effort sous 200 W (pas un vrai effort), la course, le vélo électrique, l'étape fusionnée, la sortie sans capteur ; une sortie à puissance écartée
insert into public.activities (user_id, name, sport, start_date_local, power_curve, merged_into, moving_time, excl_power) values
 ('00000000-0000-4000-8000-00000000000a', 'faible', 'Ride', '2025-08-01 09:00+00', '{"300": 200, "rep_3": 150, "rep_1": 160}', null, 3600, null),
 ('00000000-0000-4000-8000-00000000000a', 'course', 'Run', '2025-08-02 09:00+00', '{"300": 900, "rep_3": 800, "rep_1": 800}', null, 3600, null),
 ('00000000-0000-4000-8000-00000000000a', 'vélo électrique', 'EBikeRide', '2025-08-03 09:00+00', '{"300": 900, "rep_3": 800, "rep_1": 800}', null, 3600, null),
 ('00000000-0000-4000-8000-00000000000a', 'fusionnée', 'Ride', '2025-08-04 09:00+00', '{"300": 900, "rep_3": 800, "rep_1": 800}', gen_random_uuid(), 3600, null),
 ('00000000-0000-4000-8000-00000000000a', 'puissance écartée', 'Ride', '2025-08-05 09:00+00', '{"300": 900, "rep_3": 800, "rep_1": 800}', null, 3600, true);
-- 2026 : 4 sorties valides seulement (3e effort 220, 240, 260, 280 ; régularité 0,9) → les 4 comptent : médiane (240 + 260) / 2 = 250, rep_n = 4
insert into public.activities (user_id, name, sport, start_date_local, power_curve, moving_time)
select '00000000-0000-4000-8000-00000000000a', 'p ' || i, 'Ride', timestamptz '2026-03-01 09:00+00' + (i * interval '3 days'),
       jsonb_build_object('300', 300, 'rep_3', 200 + i * 20, 'rep_1', round((200 + i * 20) / 0.9)), 3600
from generate_series(1, 4) i;

-- Compte B : une sortie à 3e effort fort, jamais mélangée à A
insert into public.activities (user_id, name, sport, start_date_local, power_curve, moving_time) values
 ('00000000-0000-4000-8000-00000000000b', 'B', 'Ride', '2025-03-01 09:00+00', '{"300": 800, "rep_3": 700, "rep_1": 720}', 3600);
grant select on public.activities, public.daily_metrics to authenticated;
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_repetabilite_top10.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_repetabilite_top10.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
\pset tuples_only on
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select controle, ok from (
select 1 as n, 'deux années : 2025 et 2026' as controle, (select array_agg(an order by an) from rpc_piliers_annuels()) = array[2025, 2026] as ok
union all select 2, '2025 : seules les 10 sorties les plus fortes comptent (3e effort 230 à 320 W) : rep_n = 10, 3e effort médian 275 W', (select (rep_n, rep_w3) = (10, 275) from rpc_piliers_annuels() where an = 2025)
union all select 3, '2025 : régularité médiane des 10 gardées (4 à 0,9, 6 à 0,8) = 0,8', (select rep_ratio = 0.8 from rpc_piliers_annuels() where an = 2025)
union all select 4, '2026 : 4 sorties valides, toutes gardées : rep_n = 4, 3e effort médian 250 W, régularité 0,9', (select (rep_n, rep_w3, rep_ratio) = (4, 250, 0.9) from rpc_piliers_annuels() where an = 2026)
union all select 5, 'mêmes colonnes qu''avant : rep_ratio, rep_w3, rep_n et p_ref, fc_ref, drift_med existent toujours', (select pg_get_function_result('public.rpc_piliers_annuels()'::regprocedure) ~ 'rep_ratio numeric, rep_n integer.*rep_w3 integer.*p_ref integer, fc_ref integer, n_fc integer')
) t order by n;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000b';
select 'compte B : jamais les sorties de A ; une seule sortie avec capteur : pas d''année fiable, donc pas de référence et pas de répétabilité (comme avant)' as controle, (select (rep_n, rep_w3 is null) = (0, true) from rpc_piliers_annuels() where an = 2025) as ok;
set request.jwt.claim.sub = '';
select 'sans connexion : aucune ligne' as controle, (select count(*) from rpc_piliers_annuels()) = 0 as ok;
reset role;
set role anon;
select 'anon refusé' as controle, not has_function_privilege('anon', 'public.rpc_piliers_annuels()', 'execute') as ok;
SQL
bash $H stop >/dev/null 2>&1 || true
echo "--- test terminé : toutes les lignes ci-dessus doivent afficher « t »"
