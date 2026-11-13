#!/bin/bash
# Test LOCAL (Postgres jetable) de la migration 2026-11-14_dossards.sql : numéros dans l'ordre d'inscription, RLS, cascade.
set -e
cd "$(dirname "$0")/../../.."
H=supabase/tests/sql/local_pg.sh
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users (id, email, created_at) values
  ('00000000-0000-4000-8000-000000000002','b@test', '2026-02-01'),
  ('00000000-0000-4000-8000-000000000001','a@test', '2026-01-01');
SQL
echo "== migration deux fois (idempotente)"
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-14_dossards.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-14_dossards.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users (id, email, created_at) values ('00000000-0000-4000-8000-000000000003','c@test', '2026-03-01');
SQL
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
select 'les anciens comptes sont numérotés dans l''ordre d''inscription' as controle,
  (select numero from public.dossards where user_id='00000000-0000-4000-8000-000000000001') = 1
  and (select numero from public.dossards where user_id='00000000-0000-4000-8000-000000000002') = 2 as ok
union all select 'un nouveau compte reçoit le numéro suivant', (select numero from public.dossards where user_id='00000000-0000-4000-8000-000000000003') = 3
union all select 'RLS activée', (select relrowsecurity from pg_class where relname='dossards')
union all select 'anon ne peut rien lire', not has_table_privilege('anon', 'public.dossards', 'select')
union all select 'authenticated ne peut pas écrire', not has_table_privilege('authenticated', 'public.dossards', 'insert') and not has_table_privilege('authenticated', 'public.dossards', 'update') and not has_table_privilege('authenticated', 'public.dossards', 'delete');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
select 'B ne voit que son numéro' as controle, (select count(*) = 1 and min(numero) = 2 from public.dossards) as ok;
reset role;
delete from auth.users where id='00000000-0000-4000-8000-000000000003';
insert into auth.users (id, email, created_at) values ('00000000-0000-4000-8000-000000000004','d@test', '2026-04-01');
select 'après une suppression, le numéro n''est pas réattribué' as controle, (select numero from public.dossards where user_id='00000000-0000-4000-8000-000000000004') = 4 as ok;
SQL
