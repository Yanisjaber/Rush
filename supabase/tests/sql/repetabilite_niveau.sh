#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : la répétabilité compare les efforts à ton meilleur 5 min de TOUS LES TEMPS.
# Usage : bash supabase/tests/sql/repetabilite_niveau.sh      (prérequis : brew install postgresql@17)
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
-- Compte A
--  2017 : trois sorties très douces (meilleur 5 min 84 W) : avant, leur régularité donnait une note ; maintenant elles ne sont pas de vrais efforts
--  2024 : l'année la plus forte (meilleur 5 min 300 W) : trois sorties à vrais efforts (3e effort ≥ 150 W, la moitié de 300) et une sortie facile (3e effort 140 W)
--  2013 : UNE seule sortie avec un capteur qui a menti (5 min à 900 W) : elle ne doit pas fixer la barre (moins de 3 sorties à capteur cette année-là)
insert into public.activities (user_id, name, sport, start_date_local, power_curve) values
 ('00000000-0000-4000-8000-00000000000a', '2017 a', 'VirtualRide', '2017-09-27 09:00+00', '{"300": 79, "rep_1": 79, "rep_2": 78, "rep_3": 75}'),
 ('00000000-0000-4000-8000-00000000000a', '2017 b', 'VirtualRide', '2017-11-15 09:00+00', '{"300": 84, "rep_1": 84, "rep_2": 81, "rep_3": 80}'),
 ('00000000-0000-4000-8000-00000000000a', '2017 c', 'VirtualRide', '2017-12-02 09:00+00', '{"300": 76, "rep_1": 76, "rep_2": 76, "rep_3": 71}'),
 ('00000000-0000-4000-8000-00000000000a', '2024 dur 1', 'Ride', '2024-03-01 09:00+00', '{"300": 300, "rep_1": 300, "rep_2": 290, "rep_3": 270}'),
 ('00000000-0000-4000-8000-00000000000a', '2024 dur 2', 'Ride', '2024-04-01 09:00+00', '{"300": 290, "rep_1": 290, "rep_2": 270, "rep_3": 261}'),
 ('00000000-0000-4000-8000-00000000000a', '2024 dur 3', 'Ride', '2024-05-01 09:00+00', '{"300": 280, "rep_1": 280, "rep_2": 260, "rep_3": 252}'),
 ('00000000-0000-4000-8000-00000000000a', '2024 facile', 'Ride', '2024-06-01 09:00+00', '{"300": 200, "rep_1": 200, "rep_2": 150, "rep_3": 140}'),
 ('00000000-0000-4000-8000-00000000000a', '2013 capteur fou', 'Ride', '2013-06-01 09:00+00', '{"300": 900, "rep_1": 900, "rep_2": 890, "rep_3": 880}');
SQL
# Les migrations dans l'ordre (la dernière est celle qu'on teste), deux fois : elles sont relançables
for f in 2026-11-02_donnees_ecartees 2026-11-02_duree_ecartable 2026-11-02_repetabilite_niveau; do
  bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/$f.sql
done
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-02_repetabilite_niveau.sql
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select '2017 : des efforts de 75 à 80 W ne sont pas de vrais efforts quand ton meilleur 5 min est de 300 W : aucune sortie, pas de note (75 W et 80 W sont sous la barre de 150 W)' as controle,
  (select rep_n = 0 and rep_ratio is null from rpc_piliers_annuels() where an = 2017) as ok
union all select '2024 : trois vrais efforts comptent (rapports 0,9 / 0,9 / 0,9), la sortie facile (3e effort 140 W < 150 W) non', (select rep_n = 3 and rep_ratio = 0.9 from rpc_piliers_annuels() where an = 2024)
union all select '2013 : la sortie au capteur fou (900 W) n''a qu''une sortie à capteur cette année-là : elle ne fixe pas la barre, donc 2024 compte toujours', (select rep_n = 3 from rpc_piliers_annuels() where an = 2024)
union all select '2013 : sa seule sortie passe la barre (880 W > 150 W) mais ne suffit pas : l''app demande 3 sorties pour noter une année', (select rep_n = 1 from rpc_piliers_annuels() where an = 2013)
union all select 'les meilleures puissances par année sont inchangées (2017 : 84 W, 2024 : 300 W)', (select (select w300 from rpc_piliers_annuels() where an = 2017) = 84 and (select w300 from rpc_piliers_annuels() where an = 2024) = 300);
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000b';
select 'compte B : aucune ligne' as controle, (select count(*) from rpc_piliers_annuels()) = 0 as ok;
reset role;
set role anon;
select 'anon refusé' as controle, not has_function_privilege('anon', 'public.rpc_piliers_annuels()', 'execute') as ok;
SQL
bash $H stop >/dev/null 2>&1 || true
