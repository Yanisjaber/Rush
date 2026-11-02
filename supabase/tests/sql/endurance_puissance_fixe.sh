#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : les mesures d'endurance « à puissance fixe » de rpc_piliers_annuels (p_ref, FC et découplage à la puissance de référence).
# Usage : bash supabase/tests/sql/endurance_puissance_fixe.sh      (prérequis : brew install postgresql@17)
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

-- Compte A, 2025 : meilleur 20 min de toujours = 300 → FTP 285 → puissance de référence 199,5 W (bande 179,55 à 219,45 W)
insert into public.activities (user_id, name, sport, start_date_local, power_curve, np, avg_watts, avg_heartrate, excl_hr, moving_time, excl_duration) values
 ('00000000-0000-4000-8000-00000000000a', 'frais 1', 'Ride', '2025-03-01 09:00+00', '{"5": 1000, "300": 300, "1200": 300, "3600": 210}', 150, null, 130, null, 3600, null),
 ('00000000-0000-4000-8000-00000000000a', 'frais 2', 'Ride', '2025-03-08 09:00+00', '{"300": 290, "1200": 290}', 150, null, 130, null, 3600, null),
 ('00000000-0000-4000-8000-00000000000a', 'frais 3', 'Ride', '2025-03-15 09:00+00', '{"300": 280, "1200": 280}', 150, null, 130, null, 3600, null),
 -- trois sorties de référence (plus de 2 h, puissance dans la bande) : FC 140, 150, 145 → médiane 145 ; drift 4, 6, 5 → médiane 5
 ('00000000-0000-4000-8000-00000000000a', 'réf 1', 'Ride', '2025-06-01 08:00+00', '{"1200": 240, "fat20": 210, "drift": 4.0}', 200, null, 140, null, 9000, null),
 ('00000000-0000-4000-8000-00000000000a', 'réf 2', 'GravelRide', '2025-06-08 08:00+00', '{"1200": 235, "drift": 6.0}', 190, null, 150, null, 9000, null),
 ('00000000-0000-4000-8000-00000000000a', 'réf 3 (puissance moyenne)', 'Ride', '2025-06-15 08:00+00', '{"1200": 230, "drift": 5.0}', null, 205, 145, null, 9000, null),
 -- hors bande : trop appuyée (230 > 219,45), trop douce (170 < 179,55)
 ('00000000-0000-4000-8000-00000000000a', 'trop appuyée', 'Ride', '2025-06-22 08:00+00', '{"1200": 260, "drift": 20.0}', 230, null, 170, null, 9000, null),
 ('00000000-0000-4000-8000-00000000000a', 'trop douce', 'Ride', '2025-06-23 08:00+00', '{"1200": 200, "drift": 1.0}', 170, null, 120, null, 9000, null),
 -- pas plus de 2 h ; durée écartée par l'utilisateur
 ('00000000-0000-4000-8000-00000000000a', 'trop courte', 'Ride', '2025-06-24 08:00+00', '{"1200": 240, "drift": 40.0}', 200, null, 160, null, 6000, null),
 ('00000000-0000-4000-8000-00000000000a', 'durée écartée', 'Ride', '2025-06-25 08:00+00', '{"1200": 240, "drift": 41.0}', 200, null, 161, null, 9000, true),
 -- cardio écarté : ni sa FC ni son découplage
 ('00000000-0000-4000-8000-00000000000a', 'cardio écarté', 'Ride', '2025-06-26 08:00+00', '{"1200": 240, "drift": 30.0}', 200, null, 180, true, 9000, null),
 -- ce qui ne compte jamais : course, vélo électrique
 ('00000000-0000-4000-8000-00000000000a', 'course', 'Run', '2025-07-01 08:00+00', '{"1200": 900, "drift": 1.0}', 200, null, 90, null, 9000, null),
 ('00000000-0000-4000-8000-00000000000a', 'vélo électrique', 'EBikeRide', '2025-07-02 08:00+00', '{"1200": 900, "drift": 1.0}', 200, null, 90, null, 9000, null);
insert into public.activities (user_id, name, sport, start_date_local, power_curve, np, avg_heartrate, merged_into, moving_time) values
 ('00000000-0000-4000-8000-00000000000a', 'étape fusionnée', 'Ride', '2025-07-03 08:00+00', '{"1200": 900, "drift": 1.0}', 200, 90, gen_random_uuid(), 9000);

-- 2026 : 12 sorties de référence, FC 131 à 142, drift 1 à 12 (une par semaine) : les 10 plus récentes (3 à 12) → FC médiane 137,5 → 138, drift médian 7,5
insert into public.activities (user_id, name, sport, start_date_local, power_curve, np, avg_heartrate, moving_time)
select '00000000-0000-4000-8000-00000000000a', 'réf ' || i, 'Ride', timestamptz '2026-01-01 08:00+00' + (i * interval '7 days'),
       jsonb_build_object('1200', 250, 'drift', i), 200, 130 + i, 9000
from generate_series(1, 12) i;

-- Compte B : une seule sortie avec courbe (année non fiable) → la référence se lit quand même sur elle : 0,7 × 0,95 × 900 = 598,5 → 599
insert into public.activities (user_id, name, sport, start_date_local, power_curve, np, avg_heartrate, moving_time) values
 ('00000000-0000-4000-8000-00000000000b', 'B', 'Ride', '2025-03-01 09:00+00', '{"1200": 900}', 150, 130, 9000);
insert into public.daily_metrics (user_id, iso_date, ctl) values ('00000000-0000-4000-8000-00000000000a', '2025-09-01', 80);
grant select on public.activities, public.daily_metrics to authenticated;
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_endurance_puissance_fixe.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_endurance_puissance_fixe.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
\pset tuples_only on
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select controle, ok from (
select 1 as n, 'deux années : 2025 et 2026' as controle, (select array_agg(an order by an) from rpc_piliers_annuels()) = array[2025, 2026] as ok
union all select 2, 'puissance de référence : 70 % de 95 % du meilleur 20 min de toujours (300) = 199,5 → 200, la même chaque année', (select bool_and(p_ref = 200) from rpc_piliers_annuels())
union all select 3, '2025 : FC médiane des 3 sorties de référence (140, 150, 145) = 145, sans les hors bande, la courte, la durée écartée, le cardio écarté, la course ni le vélo électrique', (select (fc_ref, n_fc) = (145, 3) from rpc_piliers_annuels() where an = 2025)
union all select 4, '2025 : découplage médian (4, 6, 5) = 5 sur 3 sorties', (select (drift_med, n_drift) = (5.0, 3) from rpc_piliers_annuels() where an = 2025)
union all select 5, '2026 : les 10 plus récentes sorties de référence : FC médiane 137,5 → 138, découplage médian 7,5', (select (fc_ref, n_fc, drift_med, n_drift) = (138, 10, 7.5, 10) from rpc_piliers_annuels() where an = 2026)
union all select 6, '2025 : meilleur 20 min frais 300 et meilleure puissance après fatigue 210 (1 sortie)', (select (w1200, fat20, n_fat) = (300, 210, 1) from rpc_piliers_annuels() where an = 2025)
union all select 7, 'les anciennes colonnes (w9000, w7200, w10800, derive_med, heures_longues) ne sont plus rendues', (select pg_get_function_result('public.rpc_piliers_annuels()'::regprocedure) !~ '(w9000|w7200|w10800|derive_med|heures_longues)')
union all select 8, '2025 : charge 80 et sprint 1000 toujours rendus', (select (ctl_max, w5) = (80, 1000) from rpc_piliers_annuels() where an = 2025)
) t order by n;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000b';
select 'compte B : jamais les sorties de A ; référence lue sur sa seule sortie (599), aucune sortie de référence (150 W < bande)' as controle, (select (p_ref, n_fc, n_drift) = (599, 0, 0) from rpc_piliers_annuels() where an = 2025) as ok;
set request.jwt.claim.sub = '';
select 'sans connexion : aucune ligne' as controle, (select count(*) from rpc_piliers_annuels()) = 0 as ok;
reset role;
set role anon;
select 'anon refusé' as controle, not has_function_privilege('anon', 'public.rpc_piliers_annuels()', 'execute') as ok;
SQL
bash $H stop >/dev/null 2>&1 || true
echo "--- test terminé : toutes les lignes ci-dessus doivent afficher « t »"
