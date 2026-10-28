#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : remplacement atomique des records de puissance.
# Usage : bash supabase/tests/remplacer_power_profile.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../.."
H=supabase/proposals/db-v2/tests/local_pg.sh
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.power_profile (user_id uuid not null references auth.users(id) on delete cascade, duration_s integer not null, watts_alltime integer not null, watts_90d integer, achieved_at_alltime date, achieved_at_90d date, activity_id_alltime uuid, activity_id_90d uuid, updated_at timestamptz default now(), primary key (user_id, duration_s));
create table public.power_profile_sport (user_id uuid not null references auth.users(id) on delete cascade, sport text not null, "5s" int, "20min" int, activities_count int, longest_activity_s int, details jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now(), primary key (user_id, sport));
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t');
insert into public.power_profile (user_id, duration_s, watts_alltime) values ('00000000-0000-4000-8000-00000000000a', 300, 999), ('00000000-0000-4000-8000-00000000000b', 300, 500);
insert into public.power_profile_sport (user_id, sport, "5s") values ('00000000-0000-4000-8000-00000000000a', 'Ride', 1), ('00000000-0000-4000-8000-00000000000b', 'Ride', 2);
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-28_remplacer_power_profile.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-28_remplacer_power_profile.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
-- le user_id imposé est p_user, même si les lignes en annoncent un autre
select public.rpc_remplacer_power_profile('00000000-0000-4000-8000-00000000000a', '[{"user_id":"00000000-0000-4000-8000-00000000000b","duration_s":60,"watts_alltime":400},{"duration_s":300,"watts_alltime":350}]'::jsonb) as lignes_a;
select public.rpc_remplacer_power_profile_sport('00000000-0000-4000-8000-00000000000a', '[{"sport":"Run","5s":7,"details":{"x":1}}]'::jsonb) as lignes_sport_a;
select 'ancien record du compte A supprimé (999 W)' as controle, not exists (select 1 from power_profile where user_id='00000000-0000-4000-8000-00000000000a' and watts_alltime=999) as ok
union all select 'compte A : 2 lignes', (select count(*) from power_profile where user_id='00000000-0000-4000-8000-00000000000a') = 2
union all select 'compte B intact (power_profile)', (select watts_alltime from power_profile where user_id='00000000-0000-4000-8000-00000000000b') = 500
union all select 'compte B intact (par sport)', (select "5s" from power_profile_sport where user_id='00000000-0000-4000-8000-00000000000b' and sport='Ride') = 2
union all select 'sport remplacé (Ride disparu, Run présent) pour A', (select count(*) from power_profile_sport where user_id='00000000-0000-4000-8000-00000000000a' and sport='Run') = 1 and not exists (select 1 from power_profile_sport where user_id='00000000-0000-4000-8000-00000000000a' and sport='Ride')
union all select 'details gardés', (select details->>'x' from power_profile_sport where sport='Run') = '1';
-- liste vide : le compte est vidé sans erreur (appel dans une requête séparée)
select public.rpc_remplacer_power_profile('00000000-0000-4000-8000-00000000000a', '[]'::jsonb) as lignes_apres_vidage;
select 'liste vide : le compte A est vidé' as controle, not exists (select 1 from power_profile where user_id='00000000-0000-4000-8000-00000000000a') as ok;
-- droits : authenticated ne peut pas appeler
set role authenticated;
select 'authenticated refusé' as controle, (select count(*) from (select 1) x where not has_function_privilege('authenticated','public.rpc_remplacer_power_profile(uuid,jsonb)','execute')) = 1 as ok;
SQL
bash $H stop >/dev/null 2>&1 || true
