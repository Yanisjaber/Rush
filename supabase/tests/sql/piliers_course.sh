#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : les mesures par année du niveau global de la course (rpc_piliers_course).
# Usage : bash supabase/tests/sql/piliers_course.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../../.."
H=supabase/tests/sql/local_pg.sh
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.activities (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text, sport text, start_date_local timestamptz, signal_curves jsonb, merged_into uuid);
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t');
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-04_rpc_piliers_course.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-04_rpc_piliers_course.sql   # relançable
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
insert into public.activities (user_id, name, sport, start_date_local, signal_curves, merged_into) values
 ('00000000-0000-4000-8000-00000000000a', '2025 a', 'Run', '2025-03-01 09:00+00', '{"v":10,"pace":{"1000":260.0,"5000":1400.0},"dis":{"300":1100,"3600":11000}}', null),
 ('00000000-0000-4000-8000-00000000000a', '2025 b', 'Run', '2025-06-01 09:00+00', '{"v":10,"pace":{"1000":250.5,"5000":1450.0,"10000":3000.0},"dis":{"300":1150,"3600":11500}}', null),
 ('00000000-0000-4000-8000-00000000000a', '2025 trail', 'TrailRun', '2025-09-10 09:00+00', '{"v":10,"pace":{"1000":300.0},"dis":{"300":1000}}', null),
 ('00000000-0000-4000-8000-00000000000a', '2026', 'Run', '2026-02-01 09:00+00', '{"v":10,"pace":{"1000":240.0}}', null),
 ('00000000-0000-4000-8000-00000000000a', '2026 courbe vide', 'Run', '2026-02-05 09:00+00', '{"v":10}', null),
 ('00000000-0000-4000-8000-00000000000a', 'sans courbe', 'Run', '2026-02-06 09:00+00', null, null),
 ('00000000-0000-4000-8000-00000000000a', 'vélo', 'Ride', '2025-03-05 09:00+00', '{"v":6,"pace":{"1000":1.0}}', null),
 ('00000000-0000-4000-8000-00000000000a', 'fusionnée', 'Run', '2025-03-07 09:00+00', '{"v":10,"pace":{"1000":100.0}}', gen_random_uuid()),
 ('00000000-0000-4000-8000-00000000000b', 'B', 'Run', '2025-03-01 09:00+00', '{"v":10,"pace":{"1000":1.0}}', null);
grant select on public.activities to authenticated;
SQL
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select '2 années : 2025 et 2026' as controle, (select array_agg(an order by an) from rpc_piliers_course()) = array[2025, 2026] as ok
union all select '2025 : le plus PETIT temps au 1 km (250,5)', (select t1000 from rpc_piliers_course() where an = 2025) = 250.5
union all select '2025 : 5 km = 1400', (select t5000 from rpc_piliers_course() where an = 2025) = 1400
union all select '2025 : 10 km = 3000 (une seule course l''a fait)', (select t10000 from rpc_piliers_course() where an = 2025) = 3000
union all select '2025 : la plus GRANDE distance en 5 min (1150) et en 1 h (11500)', (select d300 || '/' || d3600 from rpc_piliers_course() where an = 2025) = '1150/11500'
union all select '2025 : 3 courses avec courbes (le trail compte, ni le vélo, ni la fusionnée, ni B)', (select n_courbes from rpc_piliers_course() where an = 2025) = 3
union all select '2026 : 1 course avec courbe (la courbe vide et celle sans courbe ne comptent pas)', (select n_courbes from rpc_piliers_course() where an = 2026) = 1
union all select '2026 : pas de 5 km ni de distance : null', (select t5000 is null and d300 is null and d3600 is null from rpc_piliers_course() where an = 2026);
set request.jwt.claim.sub = '';
select 'sans connexion : aucune ligne' as controle, (select count(*) from rpc_piliers_course()) = 0 as ok;
reset role;
set role anon;
select 'anon refusé' as controle, not has_function_privilege('anon', 'public.rpc_piliers_course()', 'execute') as ok;
SQL
bash $H stop >/dev/null 2>&1 || true
