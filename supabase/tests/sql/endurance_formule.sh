#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : les mesures annuelles de la nouvelle formule d'endurance (rpc_piliers_annuels).
# Usage : bash supabase/tests/sql/endurance_formule.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../../.."
H=${LOCAL_PG:-supabase/tests/sql/local_pg.sh}
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.activities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text, sport text, start_date_local timestamptz, power_curve jsonb, merged_into uuid,
  np integer, avg_watts integer, excl_power boolean, excl_hr boolean
);
create table public.daily_metrics (user_id uuid not null references auth.users(id) on delete cascade, iso_date date not null, ctl numeric, primary key (user_id, iso_date));
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t');

-- Compte A, 2025 : meilleur 20 min frais 250 → FTP 237,5 → Z2 = 130,6 à 178,1 W (sortie jugée sur sa puissance normalisée, sinon moyenne)
insert into public.activities (user_id, name, sport, start_date_local, power_curve, np, avg_watts, excl_hr) values
 ('00000000-0000-4000-8000-00000000000a', 'frais 1', 'Ride', '2025-03-01 09:00+00', '{"5": 1000, "300": 300, "1200": 250, "3600": 210}', 200, null, null),
 ('00000000-0000-4000-8000-00000000000a', 'frais 2', 'Ride', '2025-03-08 09:00+00', '{"300": 290, "1200": 240}', 200, null, null),
 ('00000000-0000-4000-8000-00000000000a', 'frais 3', 'Ride', '2025-03-15 09:00+00', '{"300": 280, "1200": 235}', 200, null, null),
 -- longues avec fatigue et 2 h 30 : le meilleur fat20 est 220, le meilleur 2 h 30 est 165
 ('00000000-0000-4000-8000-00000000000a', 'longue 1', 'Ride', '2025-06-01 08:00+00', '{"1200": 230, "9000": 160, "fat20": 210, "drift": 4.0}', 150, null, null),
 ('00000000-0000-4000-8000-00000000000a', 'longue 2', 'GravelRide', '2025-06-08 08:00+00', '{"1200": 225, "9000": 165, "fat20": 220, "drift": 6.0}', null, 160, null),
 -- trop appuyée pour du Z2 (200 W > 178) : son drift ne compte pas
 ('00000000-0000-4000-8000-00000000000a', 'longue appuyée', 'Ride', '2025-06-15 08:00+00', '{"1200": 240, "fat20": 205, "drift": 30.0}', 200, null, null),
 -- trop douce (100 W < 130,6) : ne compte pas non plus
 ('00000000-0000-4000-8000-00000000000a', 'longue douce', 'Ride', '2025-06-22 08:00+00', '{"1200": 200, "drift": 25.0}', 100, null, null),
 -- cardio écarté par l'utilisateur : le drift est retiré, le fat20 reste
 ('00000000-0000-4000-8000-00000000000a', 'longue cardio écarté', 'Ride', '2025-06-29 08:00+00', '{"1200": 225, "fat20": 200, "drift": 50.0}', 150, null, true),
 -- ce qui ne compte jamais : course, vélo électrique, étape fusionnée
 ('00000000-0000-4000-8000-00000000000a', 'course', 'Run', '2025-07-01 08:00+00', '{"1200": 900, "9000": 900, "fat20": 900, "drift": 1.0}', 150, null, null),
 ('00000000-0000-4000-8000-00000000000a', 'vélo électrique', 'EBikeRide', '2025-07-02 08:00+00', '{"1200": 900, "9000": 900, "fat20": 900, "drift": 1.0}', 150, null, null);
insert into public.activities (user_id, name, sport, start_date_local, power_curve, np, merged_into) values
 ('00000000-0000-4000-8000-00000000000a', 'étape fusionnée', 'Ride', '2025-07-03 08:00+00', '{"1200": 900, "9000": 900, "fat20": 900, "drift": 1.0}', 150, gen_random_uuid());

-- 2026 : 12 sorties Z2 avec drift 1 à 12 (une par semaine) + une sortie Z2 plus ancienne à drift 99 : seules les 10 plus récentes comptent (3 à 12 → médiane 7,5)
insert into public.activities (user_id, name, sport, start_date_local, power_curve, np)
select '00000000-0000-4000-8000-00000000000a', 'z2 ' || i, 'Ride', timestamptz '2026-01-01 08:00+00' + (i * interval '7 days'),
       jsonb_build_object('1200', 250, 'drift', i), 150
from generate_series(1, 12) i;
insert into public.activities (user_id, name, sport, start_date_local, power_curve, np) values
 ('00000000-0000-4000-8000-00000000000a', 'z2 ancienne', 'Ride', '2026-01-02 08:00+00', '{"1200": 250, "drift": 99}', 150);

-- Compte B : une seule année, sans sortie à fatigue ni découplage
insert into public.activities (user_id, name, sport, start_date_local, power_curve, np) values
 ('00000000-0000-4000-8000-00000000000b', 'B', 'Ride', '2025-03-01 09:00+00', '{"1200": 300, "9000": 280}', 150);
insert into public.daily_metrics (user_id, iso_date, ctl) values
 ('00000000-0000-4000-8000-00000000000a', '2025-09-01', 80), ('00000000-0000-4000-8000-00000000000b', '2024-05-01', 40);
grant select on public.activities, public.daily_metrics to authenticated;
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_endurance_formule.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_endurance_formule.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
\pset tuples_only on
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select controle, ok from (
select 1 as n, 'deux années : 2025 et 2026' as controle, (select array_agg(an order by an) from rpc_piliers_annuels()) = array[2025, 2026] as ok
union all select 2, '2025 : le meilleur 20 min frais est 250 (la course et le vélo électrique à 900 ne comptent pas)', (select w1200 = 250 from rpc_piliers_annuels() where an = 2025)
union all select 3, '2025 : meilleur 2 h 30 = 165, meilleur après fatigue = 220, sur 4 sorties qui ont un fat20 (la sortie à cardio écarté garde le sien)', (select (w9000, fat20, n_fat) = (165, 220, 4) from rpc_piliers_annuels() where an = 2025)
union all select 4, '2025 : seules les 2 sorties Z2 comptent pour le découplage : médiane de 4 et 6 = 5, ni l''appuyée, ni la douce, ni le cardio écarté', (select (drift_med, n_drift) = (5.0, 2) from rpc_piliers_annuels() where an = 2025)
union all select 5, '2026 : les 10 sorties Z2 les plus récentes (drift 3 à 12) : médiane 7,5, 10 sorties', (select (drift_med, n_drift) = (7.5, 10) from rpc_piliers_annuels() where an = 2026)
union all select 6, '2026 : aucune sortie à 2 h 30 ni à fatigue', (select w9000 is null and fat20 is null and n_fat = 0 from rpc_piliers_annuels() where an = 2026)
union all select 7, 'les anciennes colonnes (w7200, w10800, derive_med, heures_longues) ne sont plus rendues', (select pg_get_function_result('public.rpc_piliers_annuels()'::regprocedure) !~ '(w7200|w10800|derive_med|heures_longues)')
union all select 8, '2025 : charge 80 et puissance toujours rendues (w5 = 1000)', (select (ctl_max, w5) = (80, 1000) from rpc_piliers_annuels() where an = 2025)
) t order by n;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000b';
select 'compte B : jamais les sorties de A, 2 h 30 = 280, ni fatigue ni découplage' as controle, (select (w1200, w9000, n_fat, n_drift) = (300, 280, 0, 0) from rpc_piliers_annuels() where an = 2025) as ok;
set request.jwt.claim.sub = '';
select 'sans connexion : aucune ligne' as controle, (select count(*) from rpc_piliers_annuels()) = 0 as ok;
reset role;
set role anon;
select 'anon refusé' as controle, not has_function_privilege('anon', 'public.rpc_piliers_annuels()', 'execute') as ok;
SQL
bash $H stop >/dev/null 2>&1 || true
echo "--- test terminé : toutes les lignes ci-dessus doivent afficher « t »"
