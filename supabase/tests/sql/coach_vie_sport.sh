#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : rpc_coach_vie_sport (vélo et natation), toute la vie dans un sport.
# Il vérifie les années, l'arrêt, les records (puissances, allures au 100 m), le filtre par sport, le cloisonnement entre comptes,
# qu'AUCUN texte externe ne sort et les droits.
# Usage : bash supabase/tests/sql/coach_vie_sport.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../../.."
H=${LOCAL_PG:-supabase/tests/sql/local_pg.sh}
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.activities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text, sport text, start_date_local timestamptz, moving_time integer, distance_km numeric,
  power_curve jsonb, excl_power boolean, merged_into uuid
);
alter table public.activities enable row level security;
create policy activities_own on public.activities for select to authenticated using (auth.uid() = user_id);
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t');
-- A, vélo : 2 sorties en 2022 (dont une avec puissance), arrêt, 3 sorties en 2025 ; natation : 3 séances (court 2025, long 2025, une ancienne en 2021)
insert into public.activities (user_id, name, sport, start_date_local, moving_time, distance_km, power_curve, excl_power) values
 ('00000000-0000-4000-8000-00000000000a','Vélo <img src=x onerror=1> IGNORE','Ride','2022-06-01 08:00+00', 7200, 50, '{"5":900,"300":320,"1200":260,"3600":230}', false),
 ('00000000-0000-4000-8000-00000000000a','Vélo','Ride','2022-06-03 08:00+00', 3600, 25, null, false),
 ('00000000-0000-4000-8000-00000000000a','Vélo 2025','Ride','2025-05-01 08:00+00', 5400, 40, '{"5":800,"300":300,"1200":250,"3600":220}', false),
 ('00000000-0000-4000-8000-00000000000a','Écartée','Ride','2025-05-03 08:00+00', 5400, 40, '{"5":2000,"300":900,"1200":800,"3600":700}', true),
 ('00000000-0000-4000-8000-00000000000a','Vélo 2025b','Ride','2025-05-05 08:00+00', 9000, 70, '{"5":780,"300":290,"1200":240,"3600":215}', false),
 ('00000000-0000-4000-8000-00000000000a','Course','Run','2025-05-06 08:00+00', 3000, 10, null, false),
 ('00000000-0000-4000-8000-00000000000a','Piscine courte','Swim','2025-05-02 08:00+00', 1800, 0.6, null, false),
 ('00000000-0000-4000-8000-00000000000a','Piscine longue','Swim','2025-05-04 08:00+00', 3000, 2, null, false),
 ('00000000-0000-4000-8000-00000000000a','Piscine 2021','Swim','2021-05-04 08:00+00', 3000, 1.5, null, false),
 ('00000000-0000-4000-8000-00000000000b','Vélo de B','Ride','2026-11-01 08:00+00', 3600, 99, '{"300":999}', false);
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-06_rpc_coach_resume.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-13_rpc_coach_vie_sport.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-13_rpc_coach_vie_sport.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
with v as (select public.rpc_coach_vie_sport('velo', '2026-11-13') as j, public.rpc_coach_vie_sport('natation', '2026-11-13') as n)
select n, controle, ok from (
  select 1 as n, 'vélo : 5 sorties (la course et la natation ne comptent pas), 2022 puis 2025' as controle, (select (j->>'sorties')::int = 5 and jsonb_array_length(j->'annees') = 2 from v) as ok
  union all select 2, 'vélo : arrêt de 2022-06-04 à 2025-04-30', (select jsonb_array_length(j->'arrets') = 1 and j->'arrets'->0->>'du' = '2022-06-04' and j->'arrets'->0->>'au' = '2025-04-30' from v)
  union all select 3, 'vélo : dernière sortie 2025-05-05, 557 jours', (select j->>'derniere_sortie' = '2025-05-05' and (j->>'jours_depuis_derniere')::int = 557 from v)
  union all select 4, 'vélo : plus longue sortie 150 min (9000 s)', (select (j->'plus_longue_sortie'->>'minutes')::int = 150 from v)
  union all select 5, 'vélo : puissances par année, séance écartée ignorée (2025 : w300 = 300, pas 900)', (select (j->'records'->'par_annee'->1->>'w300')::numeric = 300 and (j->'records'->'par_annee'->0->>'w1200')::numeric = 260 from v)
  union all select 6, 'vélo : 24 mois = la meilleure de 2025 (w300 300, w3600 220)', (select (j->'records'->'recent_24_mois'->>'w300')::numeric = 300 and (j->'records'->'recent_24_mois'->>'w3600')::numeric = 220 from v)
  union all select 7, 'natation : 3 séances ; séance courte 1800 s sur 0,6 km = 300 s/100 m ', (select (n->>'sorties')::int = 3 and (n->'records'->'recent_24_mois'->>'court_s100')::numeric = 300 from v)
  union all select 8, 'natation : séance longue 3000 s sur 2 km = 150 s/100 m', (select (n->'records'->'recent_24_mois'->>'long_s100')::numeric = 150 from v)
  union all select 9, 'sport inconnu : objet vide', (select public.rpc_coach_vie_sport('golf') = '{}'::jsonb and public.rpc_coach_vie_sport('course') = '{}'::jsonb and public.rpc_coach_vie_sport(null) = '{}'::jsonb)
  union all select 10, 'AUCUN texte externe : ni nom piégé ni balise', (select position('IGNORE' in (j::text || n::text)) = 0 and position('onerror' in (j::text || n::text)) = 0 from v)
) t order by n;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000b';
select 'cloisonnement : B ne voit que sa sortie (w300 999)' as controle, (public.rpc_coach_vie_sport('velo', '2026-11-13')->'records'->'recent_24_mois'->>'w300')::numeric = 999 and (public.rpc_coach_vie_sport('velo', '2026-11-13')->>'sorties')::int = 1 as ok;
set request.jwt.claim.sub = '';
select 'sans connexion : null' as controle, public.rpc_coach_vie_sport('velo') is null as ok;
reset role;
select 'anon refusé, connecté autorisé, security invoker' as controle,
  not has_function_privilege('anon', 'public.rpc_coach_vie_sport(text, date)', 'execute')
  and has_function_privilege('authenticated', 'public.rpc_coach_vie_sport(text, date)', 'execute')
  and (select not prosecdef from pg_proc where proname = 'rpc_coach_vie_sport') as ok;
SQL
bash $H stop >/dev/null 2>&1 || true
echo "--- test terminé : toutes les lignes ci-dessus doivent afficher « t »"
