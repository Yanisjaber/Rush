#!/bin/bash
# Test LOCAL (Postgres jetable) de la fusion profiles -> user_profiles : rien n'est perdu, les inscriptions continuent.
set -e
cd "$(dirname "$0")/../.."
H=supabase/proposals/db-v2/tests/local_pg.sh
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, role text default 'both', display_name text, avatar_url text, locale text default 'fr', created_at timestamptz default now(), updated_at timestamptz default now());
create table public.user_profiles (user_id uuid primary key references auth.users(id) on delete cascade, display_name text, ftp int, extras jsonb default '{}'::jsonb, updated_at timestamptz default now());
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.user_profiles (user_id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1))) on conflict do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create function public.handle_new_profile() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.profiles (id, display_name) values (new.id, new.email) on conflict do nothing; return new; end $$;
create trigger trg_auth_user_created after insert on auth.users for each row execute function public.handle_new_profile();
insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000001','a@test'), ('00000000-0000-4000-8000-000000000002','b@test');
update public.user_profiles set extras = '{"cp":null,"sex":"M","rhr":null,"pace_5k":"4:30","tags":["a",null]}'::jsonb where user_id='00000000-0000-4000-8000-000000000001';
SQL
echo "== migration (deux fois : elle doit être idempotente)"
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-14_fusion_profiles.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-14_fusion_profiles.sql
echo "== une nouvelle inscription après la migration"
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -c "insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000003','c@test');"
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
select 'table profiles supprimée' as controle, to_regclass('public.profiles') is null as ok
union all select 'fonction handle_new_profile supprimée', not exists(select 1 from pg_proc where proname='handle_new_profile')
union all select 'déclencheur profiles supprimé', not exists(select 1 from pg_trigger where tgname='trg_auth_user_created')
union all select 'déclencheur user_profiles conservé', exists(select 1 from pg_trigger where tgname='on_auth_user_created')
union all select 'les 2 profils existants conservés', (select count(*) from public.user_profiles where user_id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002')) = 2
union all select 'nouveau compte : user_profiles créé', exists(select 1 from public.user_profiles where user_id='00000000-0000-4000-8000-000000000003')
union all select 'extras : clés null retirées', (select extras from public.user_profiles where user_id='00000000-0000-4000-8000-000000000001') = '{"sex":"M","pace_5k":"4:30","tags":["a",null]}'::jsonb
union all select 'extras : valeurs utiles intactes', (select extras->>'sex' = 'M' and extras->>'pace_5k' = '4:30' from public.user_profiles where user_id='00000000-0000-4000-8000-000000000001');
SQL
