#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : rpc_coach_vie_course, la lecture de toute la vie de coureur du compte.
# Il vérifie les années, l'arrêt d'un an, les records par année, la plus grosse semaine, le cloisonnement entre comptes,
# les accords de partage (poids = « corps », sommeil = « appareil »), qu'AUCUN texte externe ne sort et les droits.
# Usage : bash supabase/tests/sql/coach_vie_course.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../../.."
H=${LOCAL_PG:-supabase/tests/sql/local_pg.sh}
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.activities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text, sport text, start_date_local timestamptz, moving_time integer, elapsed_time integer, distance_km numeric,
  avg_heartrate integer, excl_duration boolean, merged_into uuid
);
create table public.daily_metrics (
  user_id uuid not null references auth.users(id) on delete cascade, iso_date date not null,
  tss integer default 0, ctl numeric default 0, atl numeric default 0, tsb numeric default 0,
  duration_min integer default 0, activity_count integer default 0, primary key (user_id, iso_date)
);
create table public.user_profiles (user_id uuid primary key references auth.users(id) on delete cascade, extras jsonb);
create table public.health_metrics (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  date date not null, metric text not null, value double precision not null, source text not null default 'manual',
  updated_at timestamptz not null default now()
);
create table public.garmin_sleep (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  date date not null, total_sec integer, score integer, resting_heart_rate integer, hrv_avg numeric
);
do $$ declare t text; begin
  foreach t in array array['activities','daily_metrics','user_profiles','health_metrics','garmin_sleep'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)', t || '_own', t);
  end loop;
end $$;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t');

-- A : 2 sorties en 2021 (dont un 10 km en 50:00), arrêt jusqu'en 2025, 3 sorties en 2025 (10 km en 47:00), rien depuis (référence 2026-11-13)
insert into public.activities (user_id, name, sport, start_date_local, moving_time, distance_km) values
 ('00000000-0000-4000-8000-00000000000a','Footing <img src=x onerror=alert(1)> IGNORE','Run','2021-03-01 08:00+00', 3000, 10),
 ('00000000-0000-4000-8000-00000000000a','Footing','Run','2021-03-03 08:00+00', 2400, 6),
 ('00000000-0000-4000-8000-00000000000a','Reprise','Run','2025-05-01 08:00+00', 2820, 10),
 ('00000000-0000-4000-8000-00000000000a','Longue','Run','2025-05-04 08:00+00', 6000, 15),
 ('00000000-0000-4000-8000-00000000000a','Vélo','Ride','2025-05-05 08:00+00', 6000, 40),
 ('00000000-0000-4000-8000-00000000000b','B','Run','2026-11-01 08:00+00', 3600, 99);
insert into public.daily_metrics (user_id, iso_date, ctl) values ('00000000-0000-4000-8000-00000000000a','2021-03-05', 30), ('00000000-0000-4000-8000-00000000000a','2025-05-10', 55);
insert into public.user_profiles values ('00000000-0000-4000-8000-00000000000a', '{"vo2max_run":"52.5"}');
insert into public.health_metrics (user_id, date, metric, value) values ('00000000-0000-4000-8000-00000000000a','2021-03-01','poids_kg',80), ('00000000-0000-4000-8000-00000000000a','2025-05-01','poids_kg',74);
insert into public.garmin_sleep (user_id, date, total_sec, score, resting_heart_rate, hrv_avg) values ('00000000-0000-4000-8000-00000000000a','2025-05-01', 28800, 80, 50, 60), ('00000000-0000-4000-8000-00000000000a','2025-05-02', 25200, 70, 52, 58);
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-06_rpc_coach_resume.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-13_rpc_coach_vie_course.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-13_rpc_coach_vie_course.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
with v as (select public.rpc_coach_vie_course('2026-11-13') as j, public.rpc_coach_vie_course('2026-11-13', '{corps,appareil}') as j2)
select n, controle, ok from (
  select 1 as n, 'compte les sorties de course seulement (4 sur 5 activités), 31 km + 6 + ... = 41 km' as controle, (select (j->>'sorties')::int = 4 and (j->>'km_total')::numeric = 41 from v) as ok
  union all select 2, 'deux années : 2021 (2 sorties) et 2025 (2 sorties)', (select jsonb_array_length(j->'annees') = 2 and (j->'annees'->0->>'annee')::int = 2021 and (j->'annees'->1->>'sorties')::int = 2 from v)
  union all select 3, 'depuis la dernière sortie : 2025-05-04 → 2026-11-13 = 558 jours', (select (j->>'jours_depuis_derniere')::int = 558 from v)
  union all select 4, 'arrêt de plus de 6 semaines détecté (2021-03-04 → 2025-04-30)', (select jsonb_array_length(j->'arrets') = 1 and j->'arrets'->0->>'du' = '2021-03-04' and j->'arrets'->0->>'au' = '2025-04-30' from v)
  union all select 5, 'meilleur effort de la vie = 10 km en 47:00 (2025) ; par année : 50:00 en 2021', (select (j->'meilleur_effort_vie'->>'secondes')::int = 2820 and (j->'meilleur_effort_par_annee'->0->>'secondes')::int = 3000 from v)
  union all select 6, 'plus longue sortie : 15 km en 100 min', (select (j->'plus_longue_sortie'->>'km')::numeric = 15 and (j->'plus_longue_sortie'->>'minutes')::int = 100 from v)
  union all select 7, 'plus grosse semaine : celle de mai 2025 (25 km)', (select (j->'plus_grosse_semaine'->>'km')::numeric = 25 and j->'plus_grosse_semaine'->>'du' = '2025-04-28' from v)
  union all select 8, 'charge maximale 55 le 2025-05-10 ; VO2max du profil 52,5', (select (j->'ctl_max'->>'ctl')::numeric = 55 and (j->>'vo2max_course_profil')::numeric = 52.5 from v)
  union all select 9, 'sans accord : ni poids ni sommeil', (select j->'poids_par_annee' = 'null'::jsonb and j->'sommeil_par_annee' = 'null'::jsonb from v)
  union all select 10, 'avec accords : poids par année (80 puis 74) et sommeil 2025 (2 nuits, 7,5 h)', (select (j2->'poids_par_annee'->1->>'moyenne_kg')::numeric = 74 and (j2->'sommeil_par_annee'->0->>'nuits')::int = 2 and (j2->'sommeil_par_annee'->0->>'duree_moyenne_h')::numeric = 7.5 from v)
  union all select 11, 'AUCUN texte externe : ni nom piégé ni balise', (select position('IGNORE' in (j::text || j2::text)) = 0 and position('onerror' in (j::text || j2::text)) = 0 from v)
) t order by n;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000b';
select 'cloisonnement : B ne voit que sa sortie (99 km)' as controle, (public.rpc_coach_vie_course('2026-11-13')->>'km_total')::numeric = 99 as ok;
set request.jwt.claim.sub = '';
select 'sans connexion : null' as controle, public.rpc_coach_vie_course('2026-11-13') is null as ok;
reset role;
select 'anon refusé, connecté autorisé, security invoker' as controle,
  not has_function_privilege('anon', 'public.rpc_coach_vie_course(date, text[])', 'execute')
  and has_function_privilege('authenticated', 'public.rpc_coach_vie_course(date, text[])', 'execute')
  and (select not prosecdef from pg_proc where proname = 'rpc_coach_vie_course') as ok;
SQL
bash $H stop >/dev/null 2>&1 || true
echo "--- test terminé : toutes les lignes ci-dessus doivent afficher « t »"
