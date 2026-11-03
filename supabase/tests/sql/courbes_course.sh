#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : les courbes de la course à pied (meilleurs temps par distance, meilleure distance et FC par durée).
# Usage : bash supabase/tests/sql/courbes_course.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../../.."
H=supabase/tests/sql/local_pg.sh
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.activities (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text, sport text, start_date_local timestamptz, signal_curves jsonb, merged_into uuid);
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t');
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-04_courbes_course.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-04_courbes_course.sql   # relançable
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
insert into public.activities (user_id, name, sport, start_date_local, signal_curves, merged_into) values
 ('00000000-0000-4000-8000-00000000000a', 'Run 2025', 'Run', '2025-06-01 09:00+00', '{"v":10,"pace":{"1000":260.0,"5000":1400.0},"dis":{"600":2500},"fc":{"600":170}}', null),
 ('00000000-0000-4000-8000-00000000000a', 'Run 2026 mars', 'Run', '2026-03-01 09:00+00', '{"v":10,"pace":{"1000":250.5,"5000":1450.0},"dis":{"600":2700},"fc":{"600":175}}', null),
 ('00000000-0000-4000-8000-00000000000a', 'Trail mai', 'TrailRun', '2026-05-10 09:00+00', '{"v":10,"pace":{"1000":300.0},"dis":{"600":2300},"fc":{"600":180}}', null),
 ('00000000-0000-4000-8000-00000000000a', 'Tapis', 'VirtualRun', '2026-06-01 09:00+00', '{"v":10,"pace":{"1000":240.0},"fc":{"600":165}}', null),
 ('00000000-0000-4000-8000-00000000000a', 'Vélo', 'Ride', '2026-03-05 09:00+00', '{"v":6,"pace":{"1000":1.0},"fc":{"600":999}}', null),
 ('00000000-0000-4000-8000-00000000000a', 'fusionnée', 'Run', '2026-03-07 09:00+00', '{"v":10,"pace":{"1000":100.0}}', gen_random_uuid()),
 ('00000000-0000-4000-8000-00000000000a', 'sans courbe', 'Run', '2026-03-08 09:00+00', null, null),
 ('00000000-0000-4000-8000-00000000000a', 'courbe vide', 'Run', '2026-03-09 09:00+00', '{"v":10}', null),
 ('00000000-0000-4000-8000-00000000000a', 'clé étrange', 'Run', '2026-03-10 09:00+00', '{"v":10,"pace":{"abc":1.0}}', null),
 ('00000000-0000-4000-8000-00000000000b', 'B', 'Run', '2026-03-01 09:00+00', '{"v":10,"pace":{"1000":1.0},"fc":{"600":999}}', null);
grant select on public.activities to authenticated;
SQL
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select 'pace 1 km : le plus PETIT temps gagne (240, 250,5, 260, 300)' as controle, (select array_agg(valeur order by rang) from rpc_courbe_course('pace', null, null, 1000, 30)) = array[240, 250.5, 260, 300]::numeric[] as ok
union all select 'pace : au plus 3 lignes par distance par défaut', (select max(n) from (select count(*) n from rpc_courbe_course('pace') group by cle) z) = 3
union all select 'pace 5 km : 2 courses seulement', (select count(*) from rpc_courbe_course('pace') where cle = 5000) = 2
union all select 'dis 10 min : la plus GRANDE distance gagne (2700, 2500, 2300)', (select array_agg(valeur order by rang) from rpc_courbe_course('dis', null, null, 600, 30)) = array[2700, 2500, 2300]::numeric[]
union all select 'fc 10 min : la plus HAUTE gagne (180, 175, 170, 165)', (select array_agg(valeur order by rang) from rpc_courbe_course('fc', null, null, 600, 30)) = array[180, 175, 170, 165]::numeric[]
union all select 'jamais le vélo, l''étape fusionnée, la clé étrange ni le compte B', not exists (select 1 from rpc_courbe_course('fc') where valeur >= 999) and not exists (select 1 from rpc_courbe_course('pace') where valeur < 100)
union all select 'le trail et le tapis comptent', (select count(*) from rpc_courbe_course('pace', null, null, 1000, 30) where name in ('Trail mai', 'Tapis')) = 2
union all select 'année 2026 : pace 1 km = 240, 250,5, 300', (select array_agg(valeur order by rang) from rpc_courbe_course('pace', '2026-01-01', '2026-12-31', 1000, 30)) = array[240, 250.5, 300]::numeric[]
union all select '2025 est exclu de 2026', not exists (select 1 from rpc_courbe_course('pace', '2026-01-01', '2026-12-31') where name = 'Run 2025')
union all select 'un signal inconnu ne renvoie rien', (select count(*) from rpc_courbe_course('watts')) = 0
union all select 'une seule clé : rien d''autre', (select count(distinct cle) from rpc_courbe_course('pace', null, null, 1000, 30)) = 1
union all select 'p_n est borné : au moins 1', (select count(*) from rpc_courbe_course('pace', null, null, 1000, 0)) = 1
union all select 'la séance est renvoyée avec son nom', (select name from rpc_courbe_course('pace') where cle = 1000 and rang = 1) = 'Tapis';
set request.jwt.claim.sub = '';
select 'sans connexion : aucune ligne' as controle, (select count(*) from rpc_courbe_course('pace')) = 0 as ok;
reset role;
set role anon;
select 'anon refusé' as controle, not has_function_privilege('anon', 'public.rpc_courbe_course(text,date,date,integer,integer)', 'execute') as ok;
SQL
bash $H stop >/dev/null 2>&1 || true
