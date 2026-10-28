#!/bin/bash
# Test LOCAL (Postgres jetable) du grand ménage de la base, étapes 1, 2 (déclencheur d'inscription) et 3 (fin).
set -e
cd "$(dirname "$0")/../../.."
H=supabase/tests/sql/local_pg.sh
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.user_profiles (user_id uuid primary key references auth.users(id) on delete cascade, display_name text, created_at timestamptz default now(), updated_at timestamptz default now(),
  ftp int, hr_max int, lthr int, weight numeric, strava_athlete_id bigint, extras jsonb default '{}'::jsonb);
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.user_profiles (user_id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1))) on conflict (user_id) do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create table public.preferences (user_id uuid, key text, value jsonb);
create table public.od_prefs (user_id uuid primary key, overrides jsonb);
create table public.garmin_sync_requests (id uuid primary key default gen_random_uuid(), user_id uuid);
create table public.connexions_app (id uuid primary key default gen_random_uuid(), user_id uuid, app text, external_id text);
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users (id, email) select ('00000000-0000-4000-8000-00000000000'||i)::uuid, 'u'||i||'@test' from generate_series(1,6) i;
-- 1 : first_name et last_name déjà là -> intouchés
update public.user_profiles set display_name='Ancien', extras='{"first_name":"Lea","last_name":"Martin","full_name":"Lea Martin","sex":"F"}' where user_id='00000000-0000-4000-8000-000000000001';
-- 2 : full_name "Jean Dupont" seulement
update public.user_profiles set display_name='jean', extras='{"full_name":"Jean Dupont"}' where user_id='00000000-0000-4000-8000-000000000002';
-- 3 : display_name "Yanis Jaber" seulement
update public.user_profiles set display_name='Yanis Jaber', extras='{}' where user_id='00000000-0000-4000-8000-000000000003';
-- 4 : prénom seul, un seul mot
update public.user_profiles set display_name='Stepahnie', extras='{"cp":250}' where user_id='00000000-0000-4000-8000-000000000004';
-- 5 : first_name présent, last_name absent, full_name "Sam Ben Ali" -> last_name = "Ben Ali"
update public.user_profiles set display_name='Sam', extras='{"first_name":"Sam","full_name":"Sam Ben Ali"}' where user_id='00000000-0000-4000-8000-000000000005';
-- 6 : aucun nom du tout -> rien ne change
update public.user_profiles set display_name=null, extras='{"cp":1}' where user_id='00000000-0000-4000-8000-000000000006';
update public.user_profiles set strava_athlete_id = 123 where user_id='00000000-0000-4000-8000-000000000001';
SQL
echo "== étape 1, deux fois (idempotente)"
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-14_menage_base_1.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-14_menage_base_1.sql
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
create function pg_temp.e(n int) returns jsonb language sql as $$ select extras from public.user_profiles where user_id = ('00000000-0000-4000-8000-00000000000'||n)::uuid $$;
select 'noms déjà présents : intouchés' as controle, (pg_temp.e(1)->>'first_name')='Lea' and (pg_temp.e(1)->>'last_name')='Martin' and pg_temp.e(1)->>'sex'='F' as ok
union all select 'full_name -> prénom et nom', pg_temp.e(2)->>'first_name'='Jean' and pg_temp.e(2)->>'last_name'='Dupont'
union all select 'display_name à deux mots -> prénom et nom', pg_temp.e(3)->>'first_name'='Yanis' and pg_temp.e(3)->>'last_name'='Jaber'
union all select 'prénom seul : pas de nom inventé, autres clés gardées', pg_temp.e(4)->>'first_name'='Stepahnie' and not (pg_temp.e(4) ? 'last_name') and (pg_temp.e(4)->>'cp')='250'
union all select 'first_name présent, last_name complété', pg_temp.e(5)->>'first_name'='Sam' and pg_temp.e(5)->>'last_name'='Ben Ali'
union all select 'aucun nom : rien ne change', pg_temp.e(6) = '{"cp":1}'::jsonb
union all select 'strava_athlete_id supprimé', not exists (select 1 from information_schema.columns where table_name='user_profiles' and column_name='strava_athlete_id')
union all select 'anciennes tables supprimées', to_regclass('public.preferences') is null and to_regclass('public.od_prefs') is null and to_regclass('public.garmin_sync_requests') is null
union all select 'connexions_app conservée', to_regclass('public.connexions_app') is not null
union all select 'display_name toujours là (retiré à l''étape 3)', exists (select 1 from information_schema.columns where table_name='user_profiles' and column_name='display_name');
SQL

echo "== étape 2 (déclencheur d'inscription), deux fois"
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-14_menage_base_2_inscription.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-14_menage_base_2_inscription.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -c "insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-4000-8000-000000000007','nouveau@test','{\"first_name\":\"  Léa \",\"last_name\":\"Martin\",\"display_name\":\"Léa\"}'), ('00000000-0000-4000-8000-000000000008','invite@test', null), ('00000000-0000-4000-8000-000000000009','long@test', jsonb_build_object('first_name', repeat('x', 200)));"
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
select 'inscription : prénom nettoyé et nom dans extras' as controle, (extras->>'first_name')='Léa' and (extras->>'last_name')='Martin' as ok from public.user_profiles where user_id='00000000-0000-4000-8000-000000000007'
union all select 'inscription sans informations (invitation) : profil créé, extras vide', extras = '{}'::jsonb from public.user_profiles where user_id='00000000-0000-4000-8000-000000000008'
union all select 'prénom trop long : coupé à 60 caractères', length(extras->>'first_name') = 60 from public.user_profiles where user_id='00000000-0000-4000-8000-000000000009'
union all select 'display_name encore rempli à l''étape 2', display_name = 'Léa' from public.user_profiles where user_id='00000000-0000-4000-8000-000000000007';
SQL
echo "== étape 3 (fin), deux fois"
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-14_menage_base_3_fin.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-14_menage_base_3_fin.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -c "insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-4000-8000-000000000010','apres@test','{\"first_name\":\"Zoé\",\"last_name\":\"Roy\"}');"
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
select 'colonne display_name supprimée' as controle, not exists (select 1 from information_schema.columns where table_name='user_profiles' and column_name='display_name') as ok
union all select 'full_name retiré de tous les extras', (select count(*) = 0 from public.user_profiles where extras ? 'full_name')
union all select 'les prénoms et noms sont conservés', (select count(*) from public.user_profiles where extras ? 'first_name') >= 6
union all select 'une inscription APRÈS la fin fonctionne (prénom et nom créés)', (select extras->>'first_name' = 'Zoé' and extras->>'last_name' = 'Roy' from public.user_profiles where user_id='00000000-0000-4000-8000-000000000010')
union all select 'les autres clés (sexe, cp…) sont intactes', (select extras->>'sex' = 'F' from public.user_profiles where user_id='00000000-0000-4000-8000-000000000001') and (select (extras->>'cp')::int = 250 from public.user_profiles where user_id='00000000-0000-4000-8000-000000000004');
SQL
