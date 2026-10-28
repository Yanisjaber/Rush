-- Audit de sécurité de la base (LECTURE SEULE : ne lit aucune donnée, seulement la configuration).
-- Lancer : supabase db query --linked -f docs/db/audits/2026-10-13_audit_rls.sql
--
-- Comment lire le résultat : chaque ligne est un point à regarder. Un bon résultat ne contient que les lignes « Résumé »
-- (et éventuellement des « Fonction SECURITY DEFINER » que tu connais). Toute autre ligne est à examiner.
with
tables as (
  select c.relname as t, c.relrowsecurity as rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
pol as (select * from pg_policies where schemaname = 'public')
select 1 as ordre, 'Résumé' as controle, 'tables dans public' as objet, count(*)::text as detail from tables
union all
select 2, 'Résumé', 'tables avec RLS activée', count(*)::text from tables where rls
union all
select 10, 'RLS ABSENTE (grave)', t, 'RLS désactivée : la table est lisible par tout rôle qui a un droit dessus' from tables where not rls
union all
select 11, 'RLS sans aucune policy', t, 'RLS active mais aucune policy : seul service_role peut lire (normal pour oauth_states)' from tables
  where rls and not exists (select 1 from pol where pol.tablename = tables.t)
union all
select 20, 'Policy ouverte à anon/public', tablename || ' / ' || policyname, 'rôles : ' || roles::text from pol
  where roles::text ~ '(anon|public)'
union all
select 21, 'Policy sans auth.uid()', tablename || ' / ' || policyname, coalesce(qual, '') || ' | ' || coalesce(with_check, '') from pol
  where strpos(coalesce(qual, '') || coalesce(with_check, ''), 'auth.uid()') = 0 and roles::text !~ 'service_role'
union all
select 30, 'Droit accordé à anon sur une table', table_name, string_agg(privilege_type, ', ') from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon' group by table_name
union all
select 40, 'Colonne secrète lisible par authenticated', 'connexions_app.' || column_name, 'SELECT autorisé : un jeton OAuth serait lisible depuis le navigateur'
  from information_schema.columns
  where table_schema = 'public' and table_name = 'connexions_app' and column_name in ('access_token', 'refresh_token')
    and has_column_privilege('authenticated', 'public.connexions_app', column_name, 'SELECT')
union all
select 50, 'Vue sans security_invoker', c.relname, coalesce(array_to_string(c.reloptions, ','), '(aucune option)')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v' and coalesce(c.reloptions::text, '') !~ 'security_invoker=(true|on)'
union all
select 60, 'Fonction SECURITY DEFINER', p.proname, 'exécutable par anon : ' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
order by 1, 2, 3;
