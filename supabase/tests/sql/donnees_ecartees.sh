#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : les données écartées d'une activité n'entrent plus dans aucun calcul
# (charge, niveau global, records). Usage : bash supabase/tests/sql/donnees_ecartees.sh      (prérequis : brew install postgresql@17)
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
# Deux fois : la migration est relançable
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-02_donnees_ecartees.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-02_donnees_ecartees.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
-- Charge : un jour par activité (le compte A) ; la charge de chaque jour doit refléter ce qui est écarté
insert into public.activities (user_id, name, sport, start_date_local, moving_time, tss, np, avg_watts, avg_heartrate, excl_power, excl_hr, excl_load) values
 ('00000000-0000-4000-8000-00000000000a', 'j1 puissance écartée', 'Ride', '2026-01-01 09:00+00', 3600, 100, 200, 190, 140, true, null, null),
 ('00000000-0000-4000-8000-00000000000a', 'j2 cardio écarté, course sans puissance', 'Run', '2026-01-02 09:00+00', 3600, 80, null, null, 150, null, true, null),
 ('00000000-0000-4000-8000-00000000000a', 'j3 rien d''écarté', 'Ride', '2026-01-03 09:00+00', 3600, 60, 180, 170, 140, null, null, null),
 ('00000000-0000-4000-8000-00000000000a', 'j4 charge écartée', 'Ride', '2026-01-04 09:00+00', 3600, 50, 150, 140, 130, null, null, true),
 ('00000000-0000-4000-8000-00000000000a', 'j5 cardio écarté mais la charge vient de la puissance', 'Ride', '2026-01-05 09:00+00', 3600, 70, 190, 180, 135, null, true, null),
 ('00000000-0000-4000-8000-00000000000a', 'j6 puissance écartée mais sans puissance : la charge reste', 'Run', '2026-01-06 09:00+00', 3600, 40, null, null, 145, true, null, null);
select public.recalc_daily_metrics('00000000-0000-4000-8000-00000000000a');
SQL
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
select 'tss_retenu : 5 cas' as controle,
  (public.tss_retenu(100, 200, 190, 140, true, null, null) = 0
   and public.tss_retenu(80, null, null, 150, null, true, null) = 0
   and public.tss_retenu(60, 180, 170, 140, null, null, null) = 60
   and public.tss_retenu(50, 150, 140, 130, null, null, true) = 0
   and public.tss_retenu(70, 190, 180, 135, null, true, null) = 70
   and public.tss_retenu(null, null, null, null, null, null, null) = 0) as ok
union all select 'charge : ce qui est écarté ne compte plus, le reste compte (0, 0, 60, 0, 70, 40)',
  (select array_agg(tss order by iso_date) from public.daily_metrics where user_id = '00000000-0000-4000-8000-00000000000a') = array[0, 0, 60, 0, 70, 40]::numeric[]
union all select 'charge : la forme (ctl) du jour 3 vient de la charge retenue (0, 0, 60) : 2/43 × 60 (arrondi) = 2.8',
  (select ctl = 2.8 from public.daily_metrics where user_id = '00000000-0000-4000-8000-00000000000a' and iso_date = '2026-01-03');
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
-- Mesures et records : A a des sorties à vélo, dont certaines avec une donnée écartée
delete from public.activities;
insert into public.activities (user_id, name, sport, start_date_local, moving_time, distance_km, total_elevation_gain, kj, tss, np, avg_watts, device_watts, avg_heartrate, power_curve, signal_curves, excl_power, excl_hr, excl_distance) values
 ('00000000-0000-4000-8000-00000000000a', 'normale', 'Ride', '2025-05-01 09:00+00', 8000, 80, 900, 1500, 77, 210, 200, true, 140,
  '{"5": 800, "300": 300, "1200": 250, "7200": 200, "derive": 5.0, "rep_1": 300, "rep_3": 280}',
  '{"fc": {"60": 150}, "cad": {"60": 100}, "cou": {"60": 50}, "vit": {"60": 50}, "vam": {"300": 1500}, "des": {"60": 70}}', null, null, null),
 ('00000000-0000-4000-8000-00000000000a', 'puissance faussée', 'Ride', '2025-05-02 09:00+00', 8000, 90, 950, 9000, 99, 400, 380, true, 141,
  '{"5": 2500, "300": 900, "1200": 800, "7200": 700, "derive": 1.0, "rep_1": 900, "rep_3": 880}',
  '{"fc": {"60": 160}, "cad": {"60": 110}, "cou": {"60": 99}, "vit": {"60": 60}, "vam": {"300": 1600}, "des": {"60": 80}}', true, null, null),
 ('00000000-0000-4000-8000-00000000000a', 'cardio faussé', 'Ride', '2025-05-03 09:00+00', 8000, 70, 800, 1400, 70, 205, 195, true, 190,
  '{"5": 700, "300": 290, "7200": 195, "derive": 20.0}',
  '{"fc": {"60": 220}, "cad": {"60": 120}}', null, true, null),
 ('00000000-0000-4000-8000-00000000000a', 'distance faussée', 'Ride', '2025-05-04 09:00+00', 8000, 400, 700, 1300, 60, 200, 190, true, 138, '{"5": 600}', '{"vit": {"60": 120}}', null, null, true);
-- Le dénivelé et la cadence : les colonnes viennent de la migration
update public.activities set excl_elevation = true where name = 'puissance faussée';
update public.activities set excl_cadence = true where name = 'cardio faussé';
SQL
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select 'niveau global : la sortie à puissance écartée ne compte plus (pointes 800/300/250, une dérive, 3 sorties à courbe sur 4)' as controle,
  (select (w5, w300, w1200, w7200, n_courbes) = (800, 300, 250, 200, 3) from rpc_piliers_annuels() where an = 2025) as ok
union all select 'niveau global : la dérive du cardio écarté (20 %) ne compte pas : médiane de la seule sortie normale = 5',
  (select (derive_med, n_derive) = (5.0, 1) from rpc_piliers_annuels() where an = 2025)
union all select 'niveau global : la répétabilité ignore la sortie à puissance écartée', (select rep_n = 1 from rpc_piliers_annuels() where an = 2025)
union all select 'niveau global : les heures de sorties longues ne dépendent que de la durée (4 × 8000 s = 8,9 h)', (select heures_longues = 8.9 from rpc_piliers_annuels() where an = 2025)
union all select 'record de puissance sur 5 s : 800 (pas 2 500, écarté), 700 (la sortie au cardio faussé reste), 600',
  (select array_agg(watts order by rang) from rpc_courbe_puissance(null, null, 5, 5)) = array[800, 700, 600]
union all select 'courbe de cardio : la sortie au cardio écarté (220) n''y est pas, les deux autres y sont',
  (select array_agg(valeur order by rang) from rpc_courbe_signal('fc', null, null, 60, 5)) = array[160, 150]::numeric[]
union all select 'courbe de cadence : la sortie à cadence écartée (120) n''y est pas',
  (select array_agg(valeur order by rang) from rpc_courbe_signal('cad', null, null, 60, 5)) = array[110, 100]::numeric[]
union all select 'courbe de couple : la sortie à puissance écartée (99) n''y est pas', (select array_agg(valeur order by rang) from rpc_courbe_signal('cou', null, null, 60, 5)) = array[50]::numeric[]
union all select 'courbe de vitesse : la sortie à distance écartée (120) n''y est pas', (select array_agg(valeur order by rang) from rpc_courbe_signal('vit', null, null, 60, 5)) = array[60, 50]::numeric[]
union all select 'courbe de montée (vam) : la sortie à dénivelé écarté (1600) n''y est pas', (select array_agg(valeur order by rang) from rpc_courbe_signal('vam', null, null, 300, 5)) = array[1500]::numeric[]
union all select 'courbe de descente (des) : idem', (select array_agg(valeur order by rang) from rpc_courbe_signal('des', null, null, 60, 5)) = array[70]::numeric[]
union all select 'sorties à vélo : les données écartées reviennent vides (kj, puissance, D+ de la puissance faussée ; cardio du cardio faussé ; distance de la distance faussée)',
  (select (kj is null and avg_watts is null and total_elevation_gain is null and distance_km = 90) from rpc_sorties_velo() where name = 'puissance faussée')
  and (select (avg_heartrate is null and avg_watts = 195) from rpc_sorties_velo() where name = 'cardio faussé')
  and (select (distance_km is null and avg_watts = 190) from rpc_sorties_velo() where name = 'distance faussée')
union all select 'sorties à vélo : la sortie normale est inchangée', (select (distance_km, kj, tss, avg_watts, avg_heartrate, total_elevation_gain) = (80, 1500, 77, 200, 140, 900) from rpc_sorties_velo() where name = 'normale')
union all select 'sorties à vélo : la charge (tss) d''une sortie à puissance écartée est vide', (select tss is null from rpc_sorties_velo() where name = 'puissance faussée');
-- Les autres comptes ne voient rien de A
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000b';
select 'compte B : aucune ligne (courbes, mesures, sorties)' as controle, (select count(*) from rpc_piliers_annuels()) = 0 and (select count(*) from rpc_courbe_puissance()) = 0 and (select count(*) from rpc_sorties_velo()) = 0 as ok;
reset role;
set role anon;
select 'anon refusé' as controle, not has_function_privilege('anon', 'public.rpc_sorties_velo()', 'execute') and not has_function_privilege('anon', 'public.tss_retenu(numeric, numeric, numeric, numeric, boolean, boolean, boolean)', 'execute') as ok;
SQL
bash $H stop >/dev/null 2>&1 || true
