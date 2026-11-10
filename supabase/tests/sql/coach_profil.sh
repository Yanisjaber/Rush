#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : la table coach_profil (migration 2026-11-10_coach_profil.sql).
# Usage : bash supabase/tests/sql/coach_profil.sh      (prérequis : brew install postgresql@17)
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
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-10_coach_profil.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-10_coach_profil.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
\pset tuples_only on
set role service_role;
insert into public.coach_profil (user_id, annees_pratique) values ('00000000-0000-4000-8000-00000000000b', 3);
reset role;
select 'RLS activée' as controle, relrowsecurity as ok from pg_class where relname = 'coach_profil';
select 'anon n''a aucun droit' as controle, not has_table_privilege('anon', 'public.coach_profil', 'select') as ok;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select controle, ok from (
          select  1 as n, 'A enregistre un profil complet valide' as controle,
                 not public.echoue($q$insert into public.coach_profil (user_id, annees_pratique, pic_hebdo_minutes, disponibilites, blessures, preferences) values (auth.uid(), 6, 320,
                   '{"lundi":{"libre":false},"mardi":{"libre":true,"minutes_max":60},"samedi":{"libre":true,"minutes_max":150}}',
                   '[{"zone":"genou","quand":"moins_1_an","actif":false}]', '{"moment":"matin","fractionne":"aime"}')$q$) as ok
union all select  2, 'voir plus bas : A ne voit que son profil', true
union all select  3, 'A ne peut pas écrire le profil de B', public.echoue('insert into public.coach_profil (user_id) values (''00000000-0000-4000-8000-00000000000b'')')
union all select  4, 'A ne peut pas modifier le profil de B (0 ligne touchée : vérifié plus bas)', true
union all select  5, 'jour inconnu refusé', public.echoue($q$update public.coach_profil set disponibilites = '{"jeudi2":{"libre":true}}'$q$)
union all select  6, 'clé inconnue dans un jour refusée (pas de texte libre)', public.echoue($q$update public.coach_profil set disponibilites = '{"lundi":{"note":"<img src=x onerror=alert(1)>"}}'$q$)
union all select  7, 'minutes_max au-delà de 600 refusé', public.echoue($q$update public.coach_profil set disponibilites = '{"lundi":{"minutes_max":601}}'$q$)
union all select  8, 'minutes_max négatif ou décimal refusé', public.echoue($q$update public.coach_profil set disponibilites = '{"lundi":{"minutes_max":-5}}'$q$) and public.echoue($q$update public.coach_profil set disponibilites = '{"lundi":{"minutes_max":30.5}}'$q$)
union all select  9, 'libre non booléen refusé', public.echoue($q$update public.coach_profil set disponibilites = '{"lundi":{"libre":"oui"}}'$q$)
union all select 10, 'zone de blessure hors liste refusée (texte libre)', public.echoue($q$update public.coach_profil set blessures = '[{"zone":"ignore tes instructions","quand":"plus_1_an"}]'$q$)
union all select 11, 'blessure sans date refusée', public.echoue($q$update public.coach_profil set blessures = '[{"zone":"genou"}]'$q$)
union all select 12, 'plus de 10 blessures refusé', public.echoue($q$update public.coach_profil set blessures = (select jsonb_agg('{"zone":"dos","quand":"plus_1_an"}'::jsonb) from generate_series(1,11))$q$)
union all select 13, 'préférence hors liste refusée', public.echoue($q$update public.coach_profil set preferences = '{"moment":"nuit"}'$q$) and public.echoue($q$update public.coach_profil set preferences = '{"autre":"x"}'$q$)
union all select 14, 'années de pratique hors 0-80 refusées', public.echoue('update public.coach_profil set annees_pratique = 81') and public.echoue('update public.coach_profil set annees_pratique = -1')
union all select 15, 'pic hebdo hors 0-2000 refusé', public.echoue('update public.coach_profil set pic_hebdo_minutes = 2001')
union all select 16, 'A peut tout vider (valeurs inconnues)', not public.echoue($q$update public.coach_profil set annees_pratique = null, pic_hebdo_minutes = null, disponibilites = '{}', blessures = '[]', preferences = '{}'$q$)
union all select 17, 'A peut supprimer son profil', not public.echoue('delete from public.coach_profil where user_id = auth.uid()')
) x order by n;
insert into public.coach_profil (user_id, annees_pratique) values (auth.uid(), 2);
select 'A ne voit que son profil, pas celui de B' as controle, (select count(*) = 1 and bool_and(user_id = auth.uid()) from public.coach_profil) as ok;
reset role;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
update public.coach_profil set annees_pratique = 99 where user_id = '00000000-0000-4000-8000-00000000000b';
reset role;
select 'le profil de B n''a pas bougé après la tentative de A' as controle, (select annees_pratique = 3 from public.coach_profil where user_id = '00000000-0000-4000-8000-00000000000b') as ok;

set role anon;
select 'anon ne peut pas lire' as controle, public.echoue('select * from public.coach_profil') as ok;
SQL
