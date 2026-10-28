-- =====================================================================================================================
-- Audit complet de la base — requêtes de LECTURE SEULE (aucune ne lit de donnée personnelle : comptes, tailles, configuration).
-- À coller UNE PAR UNE dans l'éditeur SQL de Supabase (ou : supabase db query --linked "<requête>").
-- Résultats de référence du 13/10/2026 : docs/db/AUDIT_2026-10-13.md
-- =====================================================================================================================

-- 1. Tables : lignes, tailles (données / gros objets / index), RLS
select c.relname as table_, s.n_live_tup as lignes, c.relrowsecurity as rls,
       pg_size_pretty(pg_total_relation_size(c.oid)) as total, pg_size_pretty(pg_relation_size(c.oid)) as donnees,
       pg_size_pretty(coalesce(pg_total_relation_size(c.reltoastrelid), 0)) as gros_objets, pg_size_pretty(pg_indexes_size(c.oid)) as index_
from pg_class c join pg_namespace n on n.oid = c.relnamespace left join pg_stat_user_tables s on s.relid = c.oid
where n.nspname = 'public' and c.relkind in ('r', 'p') order by pg_total_relation_size(c.oid) desc;

-- 2. Colonnes vides ou presque vides (statistiques du planificateur : rapide, sans lire les tables)
select tablename as table_, attname as colonne, round((null_frac * 100)::numeric) as pct_vide
from pg_stats where schemaname = 'public' and null_frac >= 0.95 order by null_frac desc, tablename, attname;

-- 3. Index : usage et taille (0 lecture = candidat à la suppression ; surveiller après un redémarrage des statistiques)
select s.relname as table_, s.indexrelname as index_, s.idx_scan as lectures, pg_size_pretty(pg_relation_size(s.indexrelid)) as taille
from pg_stat_user_indexes s where s.schemaname = 'public' order by s.idx_scan, pg_relation_size(s.indexrelid) desc;

-- 4. Contraintes : types et clés étrangères
select cl.relname as table_, co.contype as type, pg_get_constraintdef(co.oid) as definition
from pg_constraint co join pg_class cl on cl.oid = co.conrelid join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public' order by 1, 2;

-- 5. Droits par table (écart au moindre privilège : TRUNCATE, TRIGGER, REFERENCES ne devraient jamais apparaître pour authenticated)
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as droits
from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated') group by 1, 2 order by 1, 2;

-- 6. Policies RLS
select tablename as table_, policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2;

-- 7. Fonctions SECURITY DEFINER exécutables par les rôles de l'API
select p.proname, pg_get_function_arguments(p.oid) as args,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_peut, has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_peut
from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.prosecdef order by 1;

-- 8. Qualité des données d'activités (comptes uniquement)
select count(*) as activites,
       count(*) filter (where source is null) as sans_source, count(*) filter (where category is null) as sans_categorie,
       count(*) filter (where avg_heartrate > 230 or max_heartrate > 250) as fc_aberrante,
       count(*) filter (where start_date_local > now() + interval '1 day') as dans_le_futur,
       count(*) filter (where extract(timezone from start_date_local) <> 0) as avec_decalage_horaire
from public.activities;

-- 9. Doublons probables d'activités (même compte, même minute, même sport, même durée)
select count(*) as groupes, coalesce(sum(n), 0) as lignes_concernees
from (select count(*) as n from public.activities group by user_id, date_trunc('minute', start_date_local), sport, moving_time having count(*) > 1) x;

-- 10. Gonflement de daily_metrics : taille du fichier vs taille utile estimée
select pg_size_pretty(pg_relation_size('public.daily_metrics')) as taille_fichier, pg_size_pretty((count(*) * 60)::bigint) as taille_utile_estimee, count(*) as lignes from public.daily_metrics;

-- 11. Poids des courbes
select count(*) filter (where streams_gz is not null) as courbes, pg_size_pretty(sum(length(streams_gz))) as base64, pg_size_pretty((sum(length(streams_gz)) * 0.75)::bigint) as en_binaire from public.activities;

-- 12. Comptes d'authentification (agrégats)
select count(*) as comptes, count(*) filter (where email_confirmed_at is null) as non_confirmes, count(*) filter (where is_anonymous) as anonymes, max(last_sign_in_at)::date as derniere_connexion from auth.users;

-- 13. Clés du JSON de profil et leur nombre d'occurrences (aucune valeur)
select k as cle, count(*) as comptes from public.user_profiles, jsonb_object_keys(extras) k group by 1 order by 2 desc, 1;
