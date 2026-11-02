#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : les mesures annuelles du niveau global (durabilité, répétabilité, capacité de charge).
# Usage : bash supabase/tests/sql/piliers_annuels.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../../.."
H=supabase/tests/sql/local_pg.sh
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.activities (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text, sport text, start_date_local timestamptz, power_curve jsonb, signal_curves jsonb, merged_into uuid, moving_time integer);
create table public.daily_metrics (user_id uuid not null references auth.users(id) on delete cascade, iso_date date not null, ctl numeric, primary key (user_id, iso_date));
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t'), ('00000000-0000-4000-8000-00000000000c','c@t');
insert into public.activities (user_id, name, sport, start_date_local, power_curve, merged_into) values
 -- 2025 : le meilleur 5 min est 300 ; deux sorties avec trois vrais efforts (3e ≥ 225), une avec un 3e effort faible (200 < 225), une longue avec durabilité
 ('00000000-0000-4000-8000-00000000000a', 'A 2025 dur 1', 'Ride', '2025-03-01 09:00+00', '{"5": 1000, "300": 300, "1200": 250, "3600": 210, "rep_1": 300, "rep_2": 290, "rep_3": 270}', null),
 ('00000000-0000-4000-8000-00000000000a', 'A 2025 dur 2', 'Ride', '2025-04-01 09:00+00', '{"5": 1100, "300": 290, "1200": 240, "rep_1": 290, "rep_2": 270, "rep_3": 261}', null),
 ('00000000-0000-4000-8000-00000000000a', 'A 2025 facile', 'GravelRide', '2025-05-01 09:00+00', '{"300": 220, "rep_1": 220, "rep_2": 210, "rep_3": 200}', null),
 ('00000000-0000-4000-8000-00000000000a', 'A 2025 longue', 'Ride', '2025-06-01 09:00+00', '{"300": 250, "1200": 200, "late_300": 240, "late_1200": 190, "rep_1": 250, "rep_2": 245, "rep_3": 240}', null),
 ('00000000-0000-4000-8000-00000000000a', 'A 2025 longue 2', 'Ride', '2025-07-01 09:00+00', '{"late_300": 255, "late_1200": 185}', null),
 -- 2026 : pas de répétabilité, pas de sortie longue
 ('00000000-0000-4000-8000-00000000000a', 'A 2026', 'VirtualRide', '2026-12-31 20:00+00', '{"5": 900, "300": 280, "1200": 230, "3600": 200}', null),
 ('00000000-0000-4000-8000-00000000000a', 'course', 'Run', '2026-03-05 09:00+00', '{"5": 9000, "late_300": 9000, "rep_1": 9000, "rep_3": 9000}', null),
 ('00000000-0000-4000-8000-00000000000a', 'vélo électrique', 'EBikeRide', '2026-03-06 09:00+00', '{"5": 9000}', null),
 ('00000000-0000-4000-8000-00000000000a', 'étape fusionnée', 'Ride', '2026-03-07 09:00+00', '{"5": 9000}', gen_random_uuid()),
 ('00000000-0000-4000-8000-00000000000a', 'sans courbe', 'Ride', '2026-03-08 09:00+00', null, null),
 ('00000000-0000-4000-8000-00000000000a', 'sans capteur (marqueur de version seul)', 'Ride', '2026-03-09 09:00+00', '{"v": 6, "_v": 3}', null),
 ('00000000-0000-4000-8000-00000000000b', 'B', 'Ride', '2025-03-01 09:00+00', '{"5": 8000, "300": 800, "rep_1": 800, "rep_3": 790}', null);
-- Endurance : deux sorties longues avec capteur (2 h et 3 h, dérive 4 et 6 %) et une longue sans capteur, en 2025 ; une sortie courte qui ne compte pas
insert into public.activities (user_id, name, sport, start_date_local, power_curve, merged_into, moving_time) values
 ('00000000-0000-4000-8000-00000000000a', 'A 2025 3 h', 'Ride', '2025-08-01 08:00+00', '{"300": 240, "7200": 200, "10800": 185, "derive": 4.0}', null, 11000),
 ('00000000-0000-4000-8000-00000000000a', 'A 2025 2 h', 'GravelRide', '2025-08-08 08:00+00', '{"300": 230, "7200": 210, "derive": 6.0}', null, 8000),
 ('00000000-0000-4000-8000-00000000000a', 'A 2025 longue sans capteur', 'Ride', '2025-08-15 08:00+00', null, null, 9000),
 ('00000000-0000-4000-8000-00000000000a', 'A 2025 courte', 'Ride', '2025-08-16 08:00+00', null, null, 3600),
 ('00000000-0000-4000-8000-00000000000a', 'A 2025 course longue', 'Run', '2025-08-17 08:00+00', '{"7200": 900, "derive": 30}', null, 9000);
insert into public.daily_metrics (user_id, iso_date, ctl) values
 ('00000000-0000-4000-8000-00000000000a', '2025-02-01', 60), ('00000000-0000-4000-8000-00000000000a', '2025-09-01', 88.46), ('00000000-0000-4000-8000-00000000000a', '2026-02-01', 70),
 ('00000000-0000-4000-8000-00000000000b', '2025-09-01', 150),
 -- compte C : de la charge mais aucune courbe de puissance (pas de capteur)
 ('00000000-0000-4000-8000-00000000000c', '2024-05-01', 40), ('00000000-0000-4000-8000-00000000000c', '2025-05-01', 55);
grant select on public.activities, public.daily_metrics to authenticated;
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-30_rpc_piliers_annuels.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-30_rpc_piliers_annuels.sql   # relançable
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-02_rpc_piliers_n_courbes.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-02_rpc_piliers_n_courbes.sql   # relançable
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-02_rpc_piliers_endurance.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-02_rpc_piliers_endurance.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select 'deux années : 2025 et 2026' as controle, (select array_agg(an order by an) from rpc_piliers_annuels()) = array[2025, 2026] as ok
union all select 'jamais la course, le vélo électrique, l''étape fusionnée ni le compte B', not exists (select 1 from rpc_piliers_annuels() where w5 >= 8000 or ctl_max >= 150)
union all select '2025 : les meilleures puissances (sprint 1100, 5 min 300, 20 min 250, 60 min 210)', (select (w5, w300, w1200, w3600) = (1100, 300, 250, 210) from rpc_piliers_annuels() where an = 2025)
union all select '2025 : la durabilité est la meilleure puissance tardive (255 W et 190 W), sur 2 sorties longues', (select (late300, late1200, n_longues) = (255, 190, 2) from rpc_piliers_annuels() where an = 2025)
union all select '2025 : la répétabilité compte les deux sorties à trois vrais efforts, pas la facile : médiane de 0,9 et 0,9', (select rep_n = 3 and rep_ratio = 0.9 from rpc_piliers_annuels() where an = 2025)
union all select '2025 : endurance : meilleurs 2 h (210) et 3 h (185), dérive médiane 5 % sur 2 sorties, 7,8 h de sorties longues (avec la sans-capteur, sans la course ni la courte)', (select (w7200, w10800, derive_med, n_derive, heures_longues) = (210, 185, 5.0, 2, 7.8) from rpc_piliers_annuels() where an = 2025)
union all select '2026 : pas de sortie longue : rien sur 2 h et 3 h, aucune dérive, 0 heure', (select w7200 is null and w10800 is null and derive_med is null and n_derive = 0 and heures_longues = 0 from rpc_piliers_annuels() where an = 2026)
union all select '2025 : charge maximale 88,5 (arrondie à une décimale)', (select ctl_max = 88.5 from rpc_piliers_annuels() where an = 2025)
union all select '2026 : pas de sortie longue, pas de répétabilité, charge 70', (select late300 is null and late1200 is null and n_longues = 0 and rep_ratio is null and rep_n = 0 and ctl_max = 70 from rpc_piliers_annuels() where an = 2026)
union all select '2026 : la sortie virtuelle du 31 décembre est comptée', (select w300 = 280 from rpc_piliers_annuels() where an = 2026)
union all select 'n_courbes : 6 sorties à courbe en 2025 (la « longue 2 » n''a que des valeurs tardives), 1 en 2026 (ni course, ni vélo électrique, ni fusion, ni sortie sans courbe, ni marqueur de version seul)', (select array_agg(n_courbes order by an) from rpc_piliers_annuels()) = array[6, 1];
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000c';
select 'sans capteur de puissance : la charge est quand même rendue (2024 : 40, 2025 : 55)' as controle, (select array_agg(ctl_max order by an) from rpc_piliers_annuels()) = array[40, 55]::numeric[] and (select bool_and(w5 is null and w300 is null and n_courbes = 0) from rpc_piliers_annuels()) as ok;
set request.jwt.claim.sub = '';
select 'sans connexion : aucune ligne' as controle, (select count(*) from rpc_piliers_annuels()) = 0 as ok;
reset role;
set role anon;
select 'anon refusé' as controle, not has_function_privilege('anon', 'public.rpc_piliers_annuels()', 'execute') as ok;
SQL
bash $H stop >/dev/null 2>&1 || true
