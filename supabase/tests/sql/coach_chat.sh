#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : les tables du chat Coach (migration 2026-11-06_coach_chat.sql).
# Il vérifie ce que chaque rôle peut lire et écrire (le compte, un autre compte, anon, l'Edge Function), les bornes,
# le plafond de messages, et les quotas atomiques.
# Usage : bash supabase/tests/sql/coach_chat.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../../.."
H=${LOCAL_PG:-supabase/tests/sql/local_pg.sh}
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t');
-- Outil de test : renvoie true si la commande échoue (avec les droits du rôle courant)
create function public.echoue(cmd text) returns boolean language plpgsql as $$
begin execute cmd; return false; exception when others then return true; end $$;
grant execute on function public.echoue(text) to anon, authenticated, service_role;
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-06_coach_chat.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-06_coach_chat.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
\pset tuples_only on
-- Le décor, écrit avec les droits de l'Edge Function (service role)
set role service_role;
insert into public.coach_acces (user_id) values ('00000000-0000-4000-8000-00000000000a');
insert into public.chat_messages (user_id, role, contenu, cartes) values
  ('00000000-0000-4000-8000-00000000000a', 'user', 'Je pars en vacances', null),
  ('00000000-0000-4000-8000-00000000000a', 'assistant', 'Une sortie facile dimanche ?', '[{"id":"c1","etat":"proposee"}]'),
  ('00000000-0000-4000-8000-00000000000b', 'user', 'message de B', null);
insert into public.coach_memoire (user_id, resume, jusqua) values ('00000000-0000-4000-8000-00000000000a', 'Il prépare un marathon.', now());
reset role;

select controle, ok from (
          select  1 as n, 'RLS activée sur les 6 tables' as controle,
                  (select count(*) = 6 from pg_class where relname in ('coach_acces','coach_reglages','chat_messages','coach_memoire','coach_usage','coach_depense') and relrowsecurity) as ok
union all select  2, 'anon n''a aucun droit sur les 6 tables',
                  (select not exists (select 1 from unnest(array['coach_acces','coach_reglages','chat_messages','coach_memoire','coach_usage','coach_depense']) t where has_table_privilege('anon', 'public.' || t, 'select')))
) x order by n;

-- ===== Le compte A =====
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select controle, ok from (
          select  3 as n, 'A voit son accès (liste blanche) et pas celui des autres' as controle, (select count(*) = 1 from public.coach_acces) as ok
union all select  4, 'A ne peut pas s''ajouter ni se retirer de la liste blanche', public.echoue('insert into public.coach_acces (user_id) values (''00000000-0000-4000-8000-00000000000b'')') and public.echoue('delete from public.coach_acces')
union all select  5, 'A lit ses 2 messages, jamais ceux de B', (select count(*) = 2 and bool_and(user_id = '00000000-0000-4000-8000-00000000000a') from public.chat_messages)
union all select  6, 'A ne peut ni écrire ni modifier un message (seule l''Edge Function écrit)',
                  public.echoue('insert into public.chat_messages (user_id, role, contenu) values (auth.uid(), ''assistant'', ''faux message du coach'')') and public.echoue('update public.chat_messages set contenu = ''x''')
union all select  7, 'A lit sa mémoire mais ne peut pas l''écrire', (select count(*) = 1 from public.coach_memoire) and public.echoue('insert into public.coach_memoire (user_id, resume, jusqua) values (auth.uid(), ''x'', now())') and public.echoue('update public.coach_memoire set resume = ''x''')
union all select  8, 'A ne peut ni lire ni écrire la dépense globale', public.echoue('select * from public.coach_depense') and public.echoue('insert into public.coach_depense (mois, micro_usd) values (current_date, 1)')
union all select  9, 'A ne peut pas appeler coach_reserver ni coach_compter',
                  public.echoue('select public.coach_reserver(auth.uid(), current_date, 30)') and public.echoue('select public.coach_compter(auth.uid(), current_date, 1, 1, 1)')
                  and public.echoue('select public.coach_carte_etat(auth.uid(), ''c1'', null, null)')
union all select 10, 'A ne peut pas écrire son propre usage (il ne peut pas remettre le compteur à zéro)', public.echoue('insert into public.coach_usage (user_id, jour) values (auth.uid(), current_date)')
) x order by n;

-- Réglages : A écrit les siens, avec des catégories connues
select controle, ok from (
          select 11 as n, 'A enregistre son accord et ses réglages' as controle,
                 not public.echoue('insert into public.coach_reglages (user_id, accord_donnees, accord_le, sante_categories, seuils) values (auth.uid(), true, now(), array[''ressenti'',''corps''], ''{"hausseHebdoMaxPct": 15}'')') as ok
union all select 12, 'une catégorie de santé inconnue est refusée', public.echoue('update public.coach_reglages set sante_categories = array[''ressenti'',''tout_le_dossier'']')
union all select 13, 'des seuils qui ne sont pas un objet, ou trop gros, sont refusés',
                  public.echoue('update public.coach_reglages set seuils = ''[1,2]''::jsonb') and public.echoue('update public.coach_reglages set seuils = jsonb_build_object(''x'', repeat(''a'', 3000))')
union all select 14, 'A ne peut pas écrire les réglages de B', public.echoue('insert into public.coach_reglages (user_id) values (''00000000-0000-4000-8000-00000000000b'')')
) x order by n;

-- A efface sa conversation : ses 2 messages et sa mémoire partent, ceux de B restent
delete from public.chat_messages;
delete from public.coach_memoire;
select 'A efface sa conversation et sa mémoire' as controle, (select count(*) = 0 from public.chat_messages) and (select count(*) = 0 from public.coach_memoire) as ok;
reset role;
select 'le message de B est intact' as controle, (select count(*) = 1 from public.chat_messages where user_id = '00000000-0000-4000-8000-00000000000b') as ok;

-- ===== Le compte B : ne voit rien de A =====
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000b';
select 'B n''a pas d''accès Coach (liste blanche vide pour lui)' as controle, (select count(*) = 0 from public.coach_acces) as ok;
select 'B ne voit pas les réglages de A' as controle, (select count(*) = 0 from public.coach_reglages) as ok;
reset role;

-- ===== anon =====
set role anon;
select 'anon ne peut rien lire' as controle, public.echoue('select * from public.chat_messages') and public.echoue('select * from public.coach_acces') and public.echoue('select * from public.coach_reglages') as ok;
reset role;

-- ===== Bornes des messages (écrits par l'Edge Function) =====
set role service_role;
select controle, ok from (
          select 15 as n, 'un message vide, trop long ou avec un rôle inconnu est refusé' as controle,
                 public.echoue('insert into public.chat_messages (user_id, role, contenu) values (''00000000-0000-4000-8000-00000000000a'', ''user'', '''')')
                 and public.echoue('insert into public.chat_messages (user_id, role, contenu) values (''00000000-0000-4000-8000-00000000000a'', ''user'', repeat(''a'', 8001))')
                 and public.echoue('insert into public.chat_messages (user_id, role, contenu) values (''00000000-0000-4000-8000-00000000000a'', ''system'', ''x'')') as ok
union all select 16, 'au plus 3 cartes par message, et des cartes qui sont bien une liste',
                 public.echoue('insert into public.chat_messages (user_id, role, contenu, cartes) values (''00000000-0000-4000-8000-00000000000a'', ''assistant'', ''x'', ''[1,2,3,4]'')')
                 and public.echoue('insert into public.chat_messages (user_id, role, contenu, cartes) values (''00000000-0000-4000-8000-00000000000a'', ''assistant'', ''x'', ''{"a":1}'')')
union all select 17, 'résumé de plus de 4000 caractères refusé', public.echoue('insert into public.coach_memoire (user_id, resume, jusqua) values (''00000000-0000-4000-8000-00000000000a'', repeat(''a'', 4001), now())')
) x order by n;

-- ===== Cartes : changement d'état atomique =====
insert into public.chat_messages (user_id, role, contenu, cartes) values
  ('00000000-0000-4000-8000-00000000000b', 'assistant', 'Une sortie ?', '[{"id":"c9","etat":"proposee","proposition":{"minutes":90}},{"id":"c10","etat":"proposee"}]');
select 'carte : lecture seule (p_vers null) renvoie la carte telle quelle' as controle,
       (public.coach_carte_etat('00000000-0000-4000-8000-00000000000b', 'c9', null, null)->'carte'->>'etat') = 'proposee' as ok;
select public.coach_carte_etat('00000000-0000-4000-8000-00000000000b', 'c9', 'proposee', 'en_cours') is not null as passe_1;
select 'carte : proposee vers en_cours une seule fois (le 2e tap trouve déjà « en_cours » et n''obtient rien)' as controle,
       public.coach_carte_etat('00000000-0000-4000-8000-00000000000b', 'c9', 'proposee', 'en_cours') is null as ok;
select public.coach_carte_etat('00000000-0000-4000-8000-00000000000b', 'c9', 'en_cours', 'ajoutee', null, '11111111-1111-4111-8111-111111111111') is not null as passe_2;
select 'carte : état « ajoutee » et identifiant de la séance gardés, proposition et autre carte intactes' as controle,
       (select cartes->0->>'etat' = 'ajoutee' and cartes->0->>'seance_id' = '11111111-1111-4111-8111-111111111111' and cartes->0->'proposition'->>'minutes' = '90' and cartes->1->>'etat' = 'proposee'
        from public.chat_messages where user_id = '00000000-0000-4000-8000-00000000000b' and cartes is not null) as ok;
select 'carte : motif de refus gardé (300 caractères au plus)' as controle,
       (public.coach_carte_etat('00000000-0000-4000-8000-00000000000b', 'c10', 'proposee', 'refusee', repeat('x', 500))->'carte'->>'motif') = repeat('x', 300) as ok;
select 'carte : inconnue, état invalide, ou carte d''un autre compte = null' as controle,
       public.coach_carte_etat('00000000-0000-4000-8000-00000000000b', 'nope', null, null) is null
       and public.coach_carte_etat('00000000-0000-4000-8000-00000000000b', 'c10', null, 'envolee') is null
       and public.coach_carte_etat('00000000-0000-4000-8000-00000000000a', 'c9', null, null) is null as ok;

-- Plafond de 5000 messages par compte (le décor en a déjà 0 pour A, 1 pour B)
insert into public.chat_messages (user_id, role, contenu) select '00000000-0000-4000-8000-00000000000a', 'user', 'm' || g from generate_series(1, 5000) g;
select 'le 5001e message d''un compte est refusé (plafond), un autre compte n''est pas touché' as controle,
       public.echoue('insert into public.chat_messages (user_id, role, contenu) values (''00000000-0000-4000-8000-00000000000a'', ''user'', ''de trop'')')
       and not public.echoue('insert into public.chat_messages (user_id, role, contenu) values (''00000000-0000-4000-8000-00000000000b'', ''user'', ''B peut encore'')') as ok;

-- ===== Quotas =====
-- (une requête par étape : une même requête ne voit pas ce que les fonctions viennent d'y écrire)
select 'coach_reserver : 3 messages passent avec un plafond de 3, le 4e est refusé' as controle,
       public.coach_reserver('00000000-0000-4000-8000-00000000000a', '2026-11-06', 3) and public.coach_reserver('00000000-0000-4000-8000-00000000000a', '2026-11-06', 3)
       and public.coach_reserver('00000000-0000-4000-8000-00000000000a', '2026-11-06', 3) and not public.coach_reserver('00000000-0000-4000-8000-00000000000a', '2026-11-06', 3) as ok;
select 'le refus ne compte pas : le compteur reste à 3' as controle, (select messages = 3 from public.coach_usage where user_id = '00000000-0000-4000-8000-00000000000a' and jour = '2026-11-06') as ok;
select 'un autre compte, ou un autre jour, a son propre compteur' as controle,
       public.coach_reserver('00000000-0000-4000-8000-00000000000b', '2026-11-06', 3) and public.coach_reserver('00000000-0000-4000-8000-00000000000a', '2026-11-07', 3) as ok;
select 'plafond invalide (0, négatif, null) : refusé sans erreur' as controle,
       not public.coach_reserver('00000000-0000-4000-8000-00000000000a', '2026-11-08', 0) and not public.coach_reserver('00000000-0000-4000-8000-00000000000a', '2026-11-08', -5) and not public.coach_reserver('00000000-0000-4000-8000-00000000000a', '2026-11-08', null) as ok;

select public.coach_compter('00000000-0000-4000-8000-00000000000a', '2026-11-06', 1000, 200, 200) is not distinct from null as appel_a;
select public.coach_compter('00000000-0000-4000-8000-00000000000b', '2026-11-20', 500, 100, 100) is not distinct from null as appel_b;
select 'coach_compter : tokens et coût ajoutés au jour du compte (sans toucher aux messages) et au mois global (deux comptes cumulés : 300)' as controle,
       (select (messages, tokens_entree, tokens_sortie, micro_usd) = (3, 1000, 200, 200) from public.coach_usage where user_id = '00000000-0000-4000-8000-00000000000a' and jour = '2026-11-06')
       and (select micro_usd = 300 from public.coach_depense where mois = '2026-11-01') as ok;
select 'coach_compter refuse les valeurs négatives' as controle, public.echoue('select public.coach_compter(''00000000-0000-4000-8000-00000000000a'', ''2026-11-06'', -1, 0, 0)') as ok;
reset role;

select 'les droits : l''Edge Function (service role) peut appeler les deux fonctions, ni anon ni un compte connecté' as controle,
       has_function_privilege('service_role', 'public.coach_reserver(uuid, date, integer)', 'execute') and has_function_privilege('service_role', 'public.coach_compter(uuid, date, bigint, bigint, bigint)', 'execute')
       and not has_function_privilege('anon', 'public.coach_reserver(uuid, date, integer)', 'execute') and not has_function_privilege('authenticated', 'public.coach_reserver(uuid, date, integer)', 'execute')
       and not has_function_privilege('anon', 'public.coach_compter(uuid, date, bigint, bigint, bigint)', 'execute') and not has_function_privilege('authenticated', 'public.coach_compter(uuid, date, bigint, bigint, bigint)', 'execute') as ok;
SQL
bash $H stop >/dev/null 2>&1 || true
echo "--- test terminé : toutes les lignes ci-dessus doivent afficher « t »"
