#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : les courbes des signaux du vélo (FC, cadence, couple, vitesse, VAM, descente).
# Usage : bash supabase/tests/sql/courbe_signal.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../../.."
H=supabase/tests/sql/local_pg.sh
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.activities (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text, sport text, start_date_local timestamptz, merged_into uuid);
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t');
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-29_rpc_courbe_signal.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-29_rpc_courbe_signal.sql   # relançable
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
insert into public.activities (user_id, name, sport, start_date_local, signal_curves, merged_into) values
 ('00000000-0000-4000-8000-00000000000a', 'A 2025', 'Ride', '2025-06-01 09:00+00', '{"v":1,"fc":{"300":180,"1200":170},"vit":{"300":50.5},"vam":{"600":1500}}', null),
 ('00000000-0000-4000-8000-00000000000a', 'A 2026 mars', 'Ride', '2026-03-01 09:00+00', '{"v":1,"fc":{"300":175,"1200":172},"vit":{"300":48.2},"vam":{"600":1400}}', null),
 ('00000000-0000-4000-8000-00000000000a', 'A 2026 mai', 'GravelRide', '2026-05-10 09:00+00', '{"v":1,"fc":{"300":170}}', null),
 ('00000000-0000-4000-8000-00000000000a', 'A virtuel', 'VirtualRide', '2026-12-31 20:00+00', '{"v":1,"fc":{"300":190},"vit":{"300":60},"vam":{"600":3000}}', null),
 ('00000000-0000-4000-8000-00000000000a', 'A juin', 'Ride', '2026-06-01 09:00+00', '{"v":1,"fc":{"300":165}}', null),
 ('00000000-0000-4000-8000-00000000000a', 'course', 'Run', '2026-03-05 09:00+00', '{"v":1,"fc":{"300":999}}', null),
 ('00000000-0000-4000-8000-00000000000a', 'électrique', 'EBikeRide', '2026-03-06 09:00+00', '{"v":1,"fc":{"300":999}}', null),
 ('00000000-0000-4000-8000-00000000000a', 'fusionnée', 'Ride', '2026-03-07 09:00+00', '{"v":1,"fc":{"300":999}}', gen_random_uuid()),
 ('00000000-0000-4000-8000-00000000000a', 'sans courbe', 'Ride', '2026-03-08 09:00+00', null, null),
 ('00000000-0000-4000-8000-00000000000a', 'courbe vide', 'Ride', '2026-03-09 09:00+00', '{"v":1}', null),
 ('00000000-0000-4000-8000-00000000000b', 'B', 'Ride', '2026-03-01 09:00+00', '{"v":1,"fc":{"300":999}}', null);
grant select on public.activities to authenticated;
SQL
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select 'FC 5 min, tous temps : le podium est 190, 180, 175' as controle, (select array_agg(valeur order by rang) from rpc_courbe_signal('fc') where duree_s = 300) = array[190, 180, 175]::numeric[] as ok
union all select 'jamais la course, le vélo électrique, l''étape fusionnée ni le compte B', not exists (select 1 from rpc_courbe_signal('fc') where valeur >= 999)
union all select 'au plus 3 lignes par durée', (select max(n) from (select count(*) n from rpc_courbe_signal('fc') group by duree_s) z) = 3
union all select 'FC 20 min : 2 séances seulement', (select count(*) from rpc_courbe_signal('fc') where duree_s = 1200) = 2
union all select 'la vitesse ignore le vélo virtuel (60 km/h)', not exists (select 1 from rpc_courbe_signal('vit') where valeur >= 60)
union all select 'la VAM ignore le vélo virtuel (3000 m/h)', not exists (select 1 from rpc_courbe_signal('vam') where valeur >= 3000)
union all select 'la FC compte le vélo virtuel', (select valeur from rpc_courbe_signal('fc') where duree_s = 300 and rang = 1) = 190
union all select 'année 2026 : FC 5 min = 190, 175, 170', (select array_agg(valeur order by rang) from rpc_courbe_signal('fc', '2026-01-01', '2026-12-31') where duree_s = 300) = array[190, 175, 170]::numeric[]
union all select '2025 est exclu de 2026', not exists (select 1 from rpc_courbe_signal('fc', '2026-01-01', '2026-12-31') where name = 'A 2025')
union all select 'un signal inconnu ne renvoie rien', (select count(*) from rpc_courbe_signal('watts')) = 0
union all select 'la séance est renvoyée avec son nom', (select name from rpc_courbe_signal('fc') where duree_s = 1200 and rang = 1) = 'A 2026 mars';
set request.jwt.claim.sub = '';
select 'sans connexion : aucune ligne' as controle, (select count(*) from rpc_courbe_signal('fc')) = 0 as ok;
reset role;
set role anon;
select 'anon refusé' as controle, not has_function_privilege('anon', 'public.rpc_courbe_signal(text,date,date)', 'execute') as ok;
SQL
bash $H stop >/dev/null 2>&1 || true
