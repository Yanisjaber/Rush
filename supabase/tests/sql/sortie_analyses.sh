#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : la table du cache des analyses de sortie (migration 2026-11-12_sortie_analyses.sql).
# Vérifie ce que chaque rôle peut lire et écrire : le compte (lecture de SES lignes seulement), un autre compte, anon, l'Edge Function.
# Usage : bash supabase/tests/sql/sortie_analyses.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../../.."
H=${LOCAL_PG:-supabase/tests/sql/local_pg.sh}
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t');
create function public.echoue(cmd text) returns boolean language plpgsql as $$
begin execute cmd; return false; exception when others then return true; end $$;
grant execute on function public.echoue(text) to anon, authenticated, service_role;
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-12_sortie_analyses.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-12_sortie_analyses.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
\pset tuples_only on
set role service_role;
insert into public.sortie_analyses (activity_id, user_id, empreinte, contenu, modele) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-00000000000a', 'abcdef0123456789', '{"paragraphes":["Bien."]}', 'claude-haiku-5-5'),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-4000-8000-00000000000b', 'abcdef0123456789', '{"paragraphes":["Autre compte."]}', 'claude-haiku-5-5');
reset role;

select controle, ok from (
          select  1 as n, 'RLS activée' as controle, (select relrowsecurity from pg_class where relname = 'sortie_analyses') as ok
union all select  2, 'anon n''a aucun droit', (select not has_table_privilege('anon', 'public.sortie_analyses', 'select'))
union all select  3, 'service_role peut écrire (les lignes du décor sont là)', (select count(*) = 2 from public.sortie_analyses)
) x order by n;

-- ===== Le compte A =====
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select controle, ok from (
          select  1 as n, 'A lit sa ligne et seulement la sienne' as controle, (select count(*) = 1 and bool_and(user_id = '00000000-0000-4000-8000-00000000000a') from public.sortie_analyses) as ok
union all select  2, 'A ne peut pas écrire', (select public.echoue($$insert into public.sortie_analyses (activity_id, user_id, empreinte, contenu, modele) values ('33333333-3333-4333-8333-333333333333','00000000-0000-4000-8000-00000000000a','abcdef0123456789','{}','m')$$))
union all select  3, 'A ne peut pas modifier', (select public.echoue($$update public.sortie_analyses set contenu = '{}'$$))
union all select  4, 'A ne peut pas effacer', (select public.echoue($$delete from public.sortie_analyses$$))
) x order by n;
reset role;

-- ===== anon =====
set role anon;
select 'anon refusé' as controle, public.echoue($$select * from public.sortie_analyses$$) as ok;
reset role;

-- ===== Les bornes (service role) =====
set role service_role;
select controle, ok from (
          select  1 as n, 'une empreinte trop courte est refusée' as controle, public.echoue($$insert into public.sortie_analyses values ('44444444-4444-4444-8444-444444444444','00000000-0000-4000-8000-00000000000a','abc','{}','m')$$) as ok
union all select  2, 'une analyse qui n''est pas un objet est refusée', public.echoue($$insert into public.sortie_analyses values ('44444444-4444-4444-8444-444444444444','00000000-0000-4000-8000-00000000000a','abcdef0123456789','[]','m')$$)
union all select  3, 'une analyse énorme est refusée', public.echoue($$insert into public.sortie_analyses values ('44444444-4444-4444-8444-444444444444','00000000-0000-4000-8000-00000000000a','abcdef0123456789', jsonb_build_object('x', repeat('a', 9000)),'m')$$)
union all select  4, 'effacer le compte efface son analyse', (select (delete_ok) from (select 1) s, lateral (select (select count(*) from public.sortie_analyses where user_id = '00000000-0000-4000-8000-00000000000b') = 1 as delete_ok) d)
) x order by n;
reset role;
delete from auth.users where id = '00000000-0000-4000-8000-00000000000b';
select 'cascade : l''analyse de B est partie' as controle, (select count(*) = 0 from public.sortie_analyses where user_id = '00000000-0000-4000-8000-00000000000b') as ok;
SQL
