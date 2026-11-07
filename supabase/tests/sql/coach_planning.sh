#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : coach_appliquer_plan, coach_annuler_plan et coach_carte_inverse
# (migration 2026-11-07_coach_planning.sql). Il vérifie l'effet de chaque opération, la transaction (tout ou rien),
# le cloisonnement entre comptes, les bornes, l'annulation, et les droits de chaque rôle.
# Usage : bash supabase/tests/sql/coach_planning.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../../.."
H=${LOCAL_PG:-supabase/tests/sql/local_pg.sh}
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t');
-- Les deux tables du calendrier, avec les colonnes et la RLS de la vraie base (supabase/baseline)
create table public.activity_planned (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, client_id text,
  category text not null default 'entrainement', name text, date date not null, sport text, duration integer, tss integer, notes text,
  structure jsonb, gpx_content text, created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by_ia boolean not null default false, start_date_local timestamptz
);
create table public.day_notes (
  user_id uuid not null references auth.users(id) on delete cascade, iso_date date, text text, updated_at timestamptz default now(),
  id uuid primary key default gen_random_uuid(), client_id text, type text, color text, from_date date, to_date date,
  created_by_ia boolean not null default false, details jsonb,
  constraint day_notes_type_check check (type = any (array['texte','maladie','blessure','indisponible']))
);
do $$ declare t text; begin
  foreach t in array array['activity_planned','day_notes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_own', t);
  end loop;
end $$;
create table public.rest_day (user_id uuid not null references auth.users(id) on delete cascade, iso_date date not null, created_by_ia boolean not null default false, primary key (user_id, iso_date));
alter table public.rest_day enable row level security;
create policy rest_day_own on public.rest_day to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create function public.echoue(cmd text) returns boolean language plpgsql as $$
begin execute cmd; return false; exception when others then return true; end $$;
grant execute on function public.echoue(text) to anon, authenticated, service_role;

insert into public.rest_day (user_id, iso_date, created_by_ia) values ('00000000-0000-4000-8000-00000000000a', '2026-11-25', false), ('00000000-0000-4000-8000-00000000000b', '2026-11-26', false);
insert into public.activity_planned (id, user_id, category, name, date, start_date_local, sport, duration, tss, notes, created_by_ia) values
 ('11111111-1111-4111-8111-000000000001','00000000-0000-4000-8000-00000000000a','entrainement','Course · Footing','2026-11-07','2026-11-07 07:30+00','Run',60,50,'ma note', false),
 ('11111111-1111-4111-8111-000000000002','00000000-0000-4000-8000-00000000000a','entrainement','Vélo · Sortie','2026-11-08','2026-11-08 09:00+00','Ride',120,100,null, false),
 ('11111111-1111-4111-8111-000000000003','00000000-0000-4000-8000-00000000000a','competition','Marathon','2026-11-20',null,'Run',null,null,null, false),
 ('11111111-1111-4111-8111-000000000004','00000000-0000-4000-8000-00000000000b','entrainement','Séance de B','2026-11-07','2026-11-07 09:00+00','Ride',90,70,null, false);
insert into public.activity_planned (id, user_id, category, name, date, sport, duration, tss, gpx_content) values
 ('11111111-1111-4111-8111-000000000005','00000000-0000-4000-8000-00000000000a','entrainement','Séance avec GPX','2026-11-09','Run',60,50, repeat('x', 6000));
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-06_coach_chat.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-07_coach_planning.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-07_coach_planning.sql   # relançable
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-08_coach_repos.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-08_coach_repos.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
\pset tuples_only on
\set A '00000000-0000-4000-8000-00000000000a'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';

-- ===== Un plan complet : déplacer, supprimer, ajouter, déclarer une blessure =====
select public.coach_appliquer_plan('[
  {"op":"deplacer","seance_id":"11111111-1111-4111-8111-000000000001","vers":"2026-11-18"},
  {"op":"supprimer","seance_id":"11111111-1111-4111-8111-000000000002"},
  {"op":"ajouter","date":"2026-11-19","name":"Course · Footing facile","sport":"Run","duration":30,"tss":25,"notes":"Reprise","start":"2026-11-19T09:00:00","client_id":"coach-c1-3"},
  {"op":"indisponibilite","type":"blessure","du":"2026-11-07","au":"2026-11-16","client_id":"coach-c1-0"}
]'::jsonb) as inv \gset
select controle, ok from (
          select  1 as n, 'plan : renvoie 4 opérations inverses (déplacer, recréer, retirer, retirer_note)' as controle,
                  (select array_agg(e->>'op' order by o) = array['deplacer','recreer','retirer','retirer_note'] from jsonb_array_elements(:'inv'::jsonb) with ordinality t(e, o)) as ok
union all select  2, 'déplacer : le jour change et l''HEURE reste (07:30)',
                  (select date = '2026-11-18' and (start_date_local at time zone 'UTC')::time = '07:30' from public.activity_planned where id = '11111111-1111-4111-8111-000000000001')
union all select  3, 'supprimer : la séance du 08/11 a disparu',
                  (select not exists (select 1 from public.activity_planned where id = '11111111-1111-4111-8111-000000000002'))
union all select  4, 'ajouter : séance créée par l''IA, bons champs, clé stable',
                  (select created_by_ia and category = 'entrainement' and sport = 'Run' and duration = 30 and tss = 25 and client_id = 'coach-c1-3' and date = '2026-11-19' from public.activity_planned where client_id = 'coach-c1-3')
union all select  5, 'blessure : note du 07 au 16/11 en rouge, comme dans l''app, créée par l''IA',
                  (select type = 'blessure' and color = '#f87171' and from_date = '2026-11-07' and to_date = '2026-11-16' and created_by_ia and text is null from public.day_notes where client_id = 'coach-c1-0')
union all select  6, 'la compétition du 20/11 n''a pas bougé',
                  (select date = '2026-11-20' from public.activity_planned where id = '11111111-1111-4111-8111-000000000003')
) t order by n;

-- ===== Tout ou rien =====
select 'transaction : une opération fausse (séance inconnue) annule TOUT le plan, même le déplacement valide d''avant' as controle,
       public.echoue($q$select public.coach_appliquer_plan('[
         {"op":"deplacer","seance_id":"11111111-1111-4111-8111-000000000005","vers":"2026-11-12"},
         {"op":"supprimer","seance_id":"11111111-1111-4111-8111-0000000000ff"}]'::jsonb)$q$)
       and (select date = '2026-11-09' from public.activity_planned where id = '11111111-1111-4111-8111-000000000005') as ok;

-- ===== Cloisonnement et protections =====
select 'cloisonnement : A ne peut ni déplacer ni supprimer la séance de B' as controle,
       public.echoue($q$select public.coach_appliquer_plan('[{"op":"deplacer","seance_id":"11111111-1111-4111-8111-000000000004","vers":"2026-11-12"}]'::jsonb)$q$)
       and public.echoue($q$select public.coach_appliquer_plan('[{"op":"supprimer","seance_id":"11111111-1111-4111-8111-000000000004"}]'::jsonb)$q$) as ok;
select 'une compétition ne se déplace ni ne se supprime par le coach' as controle,
       public.echoue($q$select public.coach_appliquer_plan('[{"op":"supprimer","seance_id":"11111111-1111-4111-8111-000000000003"}]'::jsonb)$q$)
       and public.echoue($q$select public.coach_appliquer_plan('[{"op":"deplacer","seance_id":"11111111-1111-4111-8111-000000000003","vers":"2026-11-25"}]'::jsonb)$q$) as ok;
select 'une séance volumineuse (GPX) n''est jamais supprimée : l''annulation ne pourrait pas la restituer' as controle,
       public.echoue($q$select public.coach_appliquer_plan('[{"op":"supprimer","seance_id":"11111111-1111-4111-8111-000000000005"}]'::jsonb)$q$)
       and exists (select 1 from public.activity_planned where id = '11111111-1111-4111-8111-000000000005') as ok;

-- ===== Bornes =====
select 'bornes : 0 ou 17 opérations, opération inconnue, null, pas un tableau' as controle,
       public.echoue($q$select public.coach_appliquer_plan('[]'::jsonb)$q$)
       and public.echoue($q$select public.coach_appliquer_plan((select jsonb_agg('{"op":"supprimer","seance_id":"11111111-1111-4111-8111-0000000000ff"}'::jsonb) from generate_series(1,17)))$q$)
       and public.echoue($q$select public.coach_appliquer_plan('[{"op":"detruire_tout"}]'::jsonb)$q$)
       and public.echoue($q$select public.coach_appliquer_plan(null)$q$)
       and public.echoue($q$select public.coach_appliquer_plan('{"op":"supprimer"}'::jsonb)$q$) as ok;
select 'ajouter : sport brut hors liste, durée 0 ou 601, charge négative, refusés' as controle,
       public.echoue($q$select public.coach_appliquer_plan('[{"op":"ajouter","date":"2026-11-19","sport":"Walk","duration":30,"tss":25}]'::jsonb)$q$)
       and public.echoue($q$select public.coach_appliquer_plan('[{"op":"ajouter","date":"2026-11-19","sport":"Run","duration":0,"tss":25}]'::jsonb)$q$)
       and public.echoue($q$select public.coach_appliquer_plan('[{"op":"ajouter","date":"2026-11-19","sport":"Run","duration":601,"tss":25}]'::jsonb)$q$)
       and public.echoue($q$select public.coach_appliquer_plan('[{"op":"ajouter","date":"2026-11-19","sport":"Run","duration":30,"tss":-5}]'::jsonb)$q$) as ok;
select 'période : type inconnu, fin avant début, plus de 60 jours, date impossible, refusés' as controle,
       public.echoue($q$select public.coach_appliquer_plan('[{"op":"indisponibilite","type":"vacances","du":"2026-11-07","au":"2026-11-09"}]'::jsonb)$q$)
       and public.echoue($q$select public.coach_appliquer_plan('[{"op":"indisponibilite","type":"blessure","du":"2026-11-09","au":"2026-11-07"}]'::jsonb)$q$)
       and public.echoue($q$select public.coach_appliquer_plan('[{"op":"indisponibilite","type":"blessure","du":"2026-11-01","au":"2027-01-15"}]'::jsonb)$q$)
       and public.echoue($q$select public.coach_appliquer_plan('[{"op":"indisponibilite","type":"blessure","du":"2026-02-31","au":"2026-03-05"}]'::jsonb)$q$) as ok;
select public.coach_appliquer_plan(('[{"op":"ajouter","date":"2026-11-21","name":"' || repeat('a', 300) || '''; drop table public.activity_planned;--","sport":"Ride","duration":40,"tss":30}]')::jsonb) as inj \gset
select 'texte injecté (nom trop long + SQL) : tronqué à 120 caractères, stocké comme simple texte, la table existe toujours' as controle,
       (select length(name) = 120 and name not like '%drop table%' from public.activity_planned where date = '2026-11-21')
       and to_regclass('public.activity_planned') is not null as ok;
select public.coach_annuler_plan(:'inj'::jsonb) as inj2 \gset
select 'texte injecté : l''annulation retire cette séance' as controle, not exists (select 1 from public.activity_planned where date = '2026-11-21') as ok;

-- ===== Annuler =====
select public.coach_annuler_plan(:'inv'::jsonb) as res \gset
select controle, ok from (
          select  1 as n, 'annuler : 4 annulées, 0 ignorée' as controle, (:'res'::jsonb->>'annulees')::int = 4 and (:'res'::jsonb->>'ignorees')::int = 0 as ok
union all select  2, 'annuler : la séance revient au 07/11 à 07:30',
                  (select date = '2026-11-07' and (start_date_local at time zone 'UTC')::time = '07:30' and notes = 'ma note' from public.activity_planned where id = '11111111-1111-4111-8111-000000000001')
union all select  3, 'annuler : la séance supprimée est recréée à l''identique (même id, mêmes champs)',
                  (select name = 'Vélo · Sortie' and date = '2026-11-08' and duration = 120 and tss = 100 and user_id = '00000000-0000-4000-8000-00000000000a' from public.activity_planned where id = '11111111-1111-4111-8111-000000000002')
union all select  4, 'annuler : la séance ajoutée et la note de blessure ont disparu',
                  (select not exists (select 1 from public.activity_planned where client_id = 'coach-c1-3') and not exists (select 1 from public.day_notes where client_id = 'coach-c1-0'))
) t order by n;
select public.coach_annuler_plan(:'inv'::jsonb) as res2 \gset
select 'annuler deux fois : rien n''est dupliqué ; la séance déplacée est remise (idempotent), le reste est « ignoré »' as controle,
       (select count(*) = 1 from public.activity_planned where id = '11111111-1111-4111-8111-000000000002')
       and (:'res2'::jsonb->>'ignorees')::int >= 3 as ok;

-- L'annulation ne supprime jamais ce que l'utilisateur a créé lui-même
insert into public.activity_planned (id, user_id, name, date, sport, created_by_ia) values ('11111111-1111-4111-8111-0000000000aa','00000000-0000-4000-8000-00000000000a','Ma séance','2026-11-22','Run', false);
select 'annuler : « retirer » ne supprime pas une séance créée à la main (created_by_ia = false)' as controle,
       (public.coach_annuler_plan('[{"op":"retirer","seance_id":"11111111-1111-4111-8111-0000000000aa"}]'::jsonb)->>'ignorees')::int = 1
       and exists (select 1 from public.activity_planned where id = '11111111-1111-4111-8111-0000000000aa') as ok;
select 'annuler : ne touche jamais la séance d''un autre compte (recréer une ligne de B échoue ou est ignoré)' as controle,
       (select count(*) from public.activity_planned where user_id = '00000000-0000-4000-8000-00000000000b') = 0 as ok;


-- ===== Les jours de repos =====
select public.coach_appliquer_plan('[
  {"op":"poser_repos","date":"2026-11-23"},
  {"op":"poser_repos","date":"2026-11-25"},
  {"op":"retirer_repos","date":"2026-11-25"}
]'::jsonb) as invr \gset
select controle, ok from (
          select  1 as n, 'repos : un jour posé par le coach (created_by_ia), le jour déjà posé par l''utilisateur est retiré' as controle,
                  (select created_by_ia from public.rest_day where user_id = :'A' and iso_date = '2026-11-23') and not exists (select 1 from public.rest_day where user_id = :'A' and iso_date = '2026-11-25') as ok
union all select  2, 'repos : l''inverse ne garde que ce qui a changé (retirer le 23, remettre le 25 avec son origine « à la main »)',
                  (select jsonb_array_length(:'invr'::jsonb) = 2 and (:'invr'::jsonb->0->>'op') = 'retirer_repos' and (:'invr'::jsonb->1->>'op') = 'remettre_repos' and (:'invr'::jsonb->1->>'ia')::boolean = false)
union all select  3, 'repos : retirer un jour qui n''est pas un repos échoue, et rien d''autre n''est appliqué (tout ou rien)',
                  public.echoue($q$select public.coach_appliquer_plan('[{"op":"poser_repos","date":"2026-11-24"},{"op":"retirer_repos","date":"2026-11-30"}]'::jsonb)$q$) and not exists (select 1 from public.rest_day where iso_date = '2026-11-24')
union all select  4, 'repos : A ne peut pas retirer le repos de B (la RLS le lui cache : « introuvable »)',
                  public.echoue($q$select public.coach_appliquer_plan('[{"op":"retirer_repos","date":"2026-11-26"}]'::jsonb)$q$)
union all select  5, 'repos : poser deux fois le même jour ne fait pas d''erreur ni de doublon (rien à défaire la 2e fois)',
                  (select jsonb_array_length(public.coach_appliquer_plan('[{"op":"poser_repos","date":"2026-11-23"}]'::jsonb)) = 0) and (select count(*) = 1 from public.rest_day where user_id = :'A' and iso_date = '2026-11-23')
) t order by n;
select public.coach_annuler_plan(:'invr'::jsonb) as resr \gset
select controle, ok from (
          select  1 as n, 'annuler un plan de repos : le repos posé par le coach disparaît, celui de l''utilisateur revient « à la main »' as controle,
                  not exists (select 1 from public.rest_day where user_id = :'A' and iso_date = '2026-11-23') and (select not created_by_ia from public.rest_day where user_id = :'A' and iso_date = '2026-11-25') and (:'resr'::jsonb->>'annulees')::int = 2 as ok
) t order by n;
insert into public.rest_day (user_id, iso_date, created_by_ia) values ('00000000-0000-4000-8000-00000000000a', '2026-11-27', false);
select 'annuler : « retirer_repos » ne supprime jamais un repos posé à la main' as controle,
       (public.coach_annuler_plan('[{"op":"retirer_repos","date":"2026-11-27"}]'::jsonb)->>'ignorees')::int = 1 and exists (select 1 from public.rest_day where user_id = :'A' and iso_date = '2026-11-27') as ok;

-- ===== Les droits =====
set request.jwt.claim.sub = '';
select 'sans connexion : exception (appliquer et annuler)' as controle,
       public.echoue($q$select public.coach_appliquer_plan('[{"op":"supprimer","seance_id":"11111111-1111-4111-8111-000000000001"}]'::jsonb)$q$)
       and public.echoue($q$select public.coach_annuler_plan('[{"op":"retirer","seance_id":"11111111-1111-4111-8111-000000000001"}]'::jsonb)$q$) as ok;
reset role;
select 'repos : le repos de B est resté intact après toutes les tentatives de A' as controle, exists (select 1 from public.rest_day where user_id = '00000000-0000-4000-8000-00000000000b' and iso_date = '2026-11-26') as ok;
select 'anon refusé, authenticated autorisé, service_role n''a pas besoin, security invoker' as controle,
       not has_function_privilege('anon', 'public.coach_appliquer_plan(jsonb)', 'execute')
       and not has_function_privilege('anon', 'public.coach_annuler_plan(jsonb)', 'execute')
       and has_function_privilege('authenticated', 'public.coach_appliquer_plan(jsonb)', 'execute')
       and has_function_privilege('authenticated', 'public.coach_annuler_plan(jsonb)', 'execute')
       and (select bool_and(not prosecdef) from pg_proc where proname in ('coach_appliquer_plan', 'coach_annuler_plan')) as ok;

-- ===== coach_carte_inverse et la taille des cartes =====
set role service_role;
insert into public.chat_messages (user_id, role, contenu, cartes) values
  ('00000000-0000-4000-8000-00000000000a', 'assistant', 'Voilà le plan', '[{"id":"p1","genre":"planning","etat":"ajoutee"}]');
select 'carte_inverse : garde l''inverse dans la carte, puis le retire (null)' as controle,
       public.coach_carte_inverse('00000000-0000-4000-8000-00000000000a', 'p1', '[{"op":"retirer","seance_id":"x"}]'::jsonb)
       and (public.coach_carte_etat('00000000-0000-4000-8000-00000000000a', 'p1', null, null)->'carte'->'inverse'->0->>'op') = 'retirer'
       and public.coach_carte_inverse('00000000-0000-4000-8000-00000000000a', 'p1', null)
       and not (public.coach_carte_etat('00000000-0000-4000-8000-00000000000a', 'p1', null, null)->'carte' ? 'inverse') as ok;
select 'carte_inverse : carte inconnue ou compte sans cette carte = faux' as controle,
       not public.coach_carte_inverse('00000000-0000-4000-8000-00000000000a', 'zzz', '[]'::jsonb)
       and not public.coach_carte_inverse('00000000-0000-4000-8000-00000000000b', 'p1', '[]'::jsonb) as ok;
select 'cartes : 20 Ko acceptés (plan + inverse), 30 Ko refusés, 4 cartes refusées' as controle,
       not public.echoue($q$insert into public.chat_messages (user_id, role, contenu, cartes) values ('00000000-0000-4000-8000-00000000000a','assistant','gros', jsonb_build_array(jsonb_build_object('id','g1','texte', repeat('é', 10000))))$q$)
       and public.echoue($q$insert into public.chat_messages (user_id, role, contenu, cartes) values ('00000000-0000-4000-8000-00000000000a','assistant','énorme', jsonb_build_array(jsonb_build_object('id','g2','texte', repeat('é', 15500))))$q$)
       and public.echoue($q$insert into public.chat_messages (user_id, role, contenu, cartes) values ('00000000-0000-4000-8000-00000000000a','assistant','quatre', '[{"id":"a"},{"id":"b"},{"id":"c"},{"id":"d"}]')$q$) as ok;
reset role;
select 'carte_inverse : réservée au service role (ni anon, ni connecté)' as controle,
       not has_function_privilege('anon', 'public.coach_carte_inverse(uuid, text, jsonb)', 'execute')
       and not has_function_privilege('authenticated', 'public.coach_carte_inverse(uuid, text, jsonb)', 'execute')
       and has_function_privilege('service_role', 'public.coach_carte_inverse(uuid, text, jsonb)', 'execute') as ok;
SQL
bash $H stop >/dev/null 2>&1 || true
echo "--- test terminé : toutes les lignes ci-dessus doivent afficher « t »"
