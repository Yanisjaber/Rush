#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : la courbe de puissance des records du Bilan.
# Usage : bash supabase/tests/sql/courbe_puissance.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../../.."
H=supabase/tests/sql/local_pg.sh
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.activities (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text, sport text, start_date_local timestamptz, power_curve jsonb, signal_curves jsonb, merged_into uuid);
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t');
insert into public.activities (user_id, name, sport, start_date_local, power_curve, merged_into) values
 ('00000000-0000-4000-8000-00000000000a', 'A 2025', 'Ride', '2025-06-01 09:00+00', '{"5": 1200, "60": 500, "1200": 280, "3600": 230, "v": 5}', null),
 ('00000000-0000-4000-8000-00000000000a', 'A 2026 mars', 'Ride', '2026-03-01 09:00+00', '{"5": 1100, "60": 480, "1200": 260, "3600": 210}', null),
 ('00000000-0000-4000-8000-00000000000a', 'A 2026 mai', 'GravelRide', '2026-05-10 09:00+00', '{"5": 1000, "60": 470, "1200": 270}', null),
 ('00000000-0000-4000-8000-00000000000a', 'A 2026 virtuel', 'VirtualRide', '2026-12-31 20:00+00', '{"5": 900, "60": 460}', null),
 ('00000000-0000-4000-8000-00000000000a', 'A 2026 juin', 'Ride', '2026-06-01 09:00+00', '{"5": 950, "60": 450, "1200": 250}', null),
 ('00000000-0000-4000-8000-00000000000a', 'course', 'Run', '2026-03-05 09:00+00', '{"5": 9000}', null),
 ('00000000-0000-4000-8000-00000000000a', 'vélo électrique', 'EBikeRide', '2026-03-06 09:00+00', '{"5": 9000}', null),
 ('00000000-0000-4000-8000-00000000000a', 'étape fusionnée', 'Ride', '2026-03-07 09:00+00', '{"5": 9000}', gen_random_uuid()),
 ('00000000-0000-4000-8000-00000000000a', 'sans courbe', 'Ride', '2026-03-08 09:00+00', null, null),
 ('00000000-0000-4000-8000-00000000000b', 'B', 'Ride', '2026-03-01 09:00+00', '{"5": 8000}', null);
grant select on public.activities to authenticated;
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-28_rpc_courbe_puissance.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-28_rpc_courbe_puissance.sql   # relançable
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-29_podium_duree.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-29_podium_duree.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select 'tous temps, 5 s : le podium est 1200, 1100, 1000' as controle, (select array_agg(watts order by rang) from rpc_courbe_puissance() where duree_s = 5) = array[1200, 1100, 1000] as ok
union all select 'jamais la course, le vélo électrique, l''étape fusionnée ni le compte B', not exists (select 1 from rpc_courbe_puissance() where watts >= 8000)
union all select 'au plus 3 lignes par durée', (select max(n) from (select count(*) n from rpc_courbe_puissance() group by duree_s) z) = 3
union all select 'tous temps, 1 h : 2 séances seulement', (select count(*) from rpc_courbe_puissance() where duree_s = 3600) = 2
union all select 'une durée absente partout (3 s) : aucune ligne', not exists (select 1 from rpc_courbe_puissance() where duree_s = 3)
union all select 'année 2026 : le 5 s du podium est 1100, 1000, 950', (select array_agg(watts order by rang) from rpc_courbe_puissance('2026-01-01', '2026-12-31') where duree_s = 5) = array[1100, 1000, 950]
union all select 'le 31 décembre est compris (la sortie virtuelle de 20 h)', (select count(*) from rpc_courbe_puissance('2026-01-01', '2026-12-31') where name = 'A 2026 virtuel') >= 1
union all select '2025 est exclu de 2026', not exists (select 1 from rpc_courbe_puissance('2026-01-01', '2026-12-31') where name = 'A 2025')
union all select 'une durée et 30 places : les 5 séances du 5 s, dans l''ordre', (select array_agg(watts order by rang) from rpc_courbe_puissance(null, null, 5, 30)) = array[1200, 1100, 1000, 950, 900]
union all select 'une seule durée : rien d''autre', (select count(distinct duree_s) from rpc_courbe_puissance(null, null, 5, 30)) = 1
union all select 'la séance est renvoyée avec son nom', (select name from rpc_courbe_puissance() where duree_s = 1200 and rang = 1) = 'A 2025';
set request.jwt.claim.sub = '';
select 'sans connexion : aucune ligne' as controle, (select count(*) from rpc_courbe_puissance()) = 0 as ok;
reset role;
set role anon;
select 'anon refusé' as controle, not has_function_privilege('anon', 'public.rpc_courbe_puissance(date,date,integer,integer)', 'execute') as ok;
SQL
bash $H stop >/dev/null 2>&1 || true
