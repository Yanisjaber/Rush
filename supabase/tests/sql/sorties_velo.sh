#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : la fonction des sorties à vélo (records du Bilan).
# Usage : bash supabase/tests/sql/sorties_velo.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../../.."
H=supabase/tests/sql/local_pg.sh
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.activities (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text, sport text, start_date_local timestamptz, distance_km numeric, moving_time integer, total_elevation_gain integer, kj integer, tss integer, max_speed_kmh numeric, power_curve jsonb, merged_into uuid);
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t');
insert into public.activities (user_id, name, sport, start_date_local, distance_km, moving_time, total_elevation_gain, kj, tss, max_speed_kmh, power_curve, merged_into) values
 ('00000000-0000-4000-8000-00000000000a', 'sortie A1', 'Ride', '2026-03-01 09:00+00', 80.5, 10800, 900, 1500, 77, 62.3, '{"1": 900, "5": 874.6, "60": 600, "300": 380, "1200": 290, "3600": 250, "v": 5}', null),
 ('00000000-0000-4000-8000-00000000000a', 'sans courbe', 'Ride', '2026-03-02 09:00+00', 20, 3600, 100, null, 77, 40, null, null),
 ('00000000-0000-4000-8000-00000000000a', 'courbe courte', 'GravelRide', '2026-03-03 09:00+00', 30, 3600, 200, 700, 77, 50, '{"5": 700, "60": 500, "v": 5}', null),
 ('00000000-0000-4000-8000-00000000000a', 'virtuel', 'VirtualRide', '2026-03-04 09:00+00', 40, 3600, 300, 800, 77, 45, '{"5": 600}', null),
 ('00000000-0000-4000-8000-00000000000a', 'course', 'Run', '2026-03-05 09:00+00', 10, 3000, 50, null, 77, 15, '{"5": 400}', null),
 ('00000000-0000-4000-8000-00000000000a', 'vélo électrique', 'EBikeRide', '2026-03-06 09:00+00', 40, 3600, 100, 100, 77, 30, '{"5": 300}', null),
 ('00000000-0000-4000-8000-00000000000a', 'étape fusionnée', 'Ride', '2026-03-07 09:00+00', 40, 3600, 100, 100, 77, 30, '{"5": 300}', gen_random_uuid()),
 ('00000000-0000-4000-8000-00000000000b', 'sortie de B', 'Ride', '2026-03-01 09:00+00', 99, 9999, 999, 999, 77, 99, '{"5": 9999}', null);
grant select on public.activities to authenticated;
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-28_rpc_sorties_velo.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-28_rpc_sorties_velo.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select 'compte A : 3 sorties (Ride, Ride sans courbe, Gravel) + 1 virtuel = 4' as controle, (select count(*) from rpc_sorties_velo()) = 4 as ok
union all select 'jamais la sortie de B', not exists (select 1 from rpc_sorties_velo() where name = 'sortie de B')
union all select 'ni la course, ni le vélo électrique, ni l''étape fusionnée', not exists (select 1 from rpc_sorties_velo() where name in ('course', 'vélo électrique', 'étape fusionnée'))
union all select 'la charge (TSS) est renvoyée', (select tss from rpc_sorties_velo() where name = 'sortie A1') = 77
union all select 'triées par date', (select array_agg(name order by start_date_local) from rpc_sorties_velo()) = (select array_agg(name) from rpc_sorties_velo());
set request.jwt.claim.sub = '';
select 'sans connexion : aucune ligne' as controle, (select count(*) from rpc_sorties_velo()) = 0 as ok;
reset role;
set role anon;
select 'anon refusé' as controle, not has_function_privilege('anon', 'public.rpc_sorties_velo()', 'execute') as ok;
SQL
bash $H stop >/dev/null 2>&1 || true
