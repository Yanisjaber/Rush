-- =====================================================================================================================
-- Coach IA — RETOUR ARRIÈRE de la bascule V2 (PROPOSITION, jamais appliquée)
-- Remet l'ancienne base à sa place. ATTENTION : tout ce qui a été écrit dans la V2 APRÈS la bascule est perdu (à utiliser dans les premières heures).
-- Utilisable seulement tant que le schéma `legacy` existe (on le supprime après une période de recul).
-- =====================================================================================================================
begin;
do $$
declare t record; f record;
begin
  if not exists (select 1 from pg_namespace where nspname = 'legacy') then raise exception 'Pas de schéma legacy : retour arrière impossible'; end if;
  -- 1. on retire les déclencheurs d'inscription de la V2
  drop trigger if exists on_auth_user_created_v2 on auth.users;
  -- 2. on supprime tout ce que la V2 a créé
  for t in select tablename from pg_tables where schemaname = 'public' loop execute format('drop table public.%I cascade', t.tablename); end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' loop execute format('drop function %s cascade', f.sig); end loop;
  drop schema if exists private cascade;
  -- 3. on remet les anciennes tables et fonctions
  for t in select tablename from pg_tables where schemaname = 'legacy' loop execute format('alter table legacy.%I set schema public', t.tablename); end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'legacy' loop execute format('alter function %s set schema public', f.sig); end loop;
  alter table public.activities enable trigger user;
end $$;
-- 4. déclencheurs d'inscription d'origine
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create trigger trg_auth_user_created after insert on auth.users for each row execute function public.handle_new_profile();
drop schema legacy;
commit;
