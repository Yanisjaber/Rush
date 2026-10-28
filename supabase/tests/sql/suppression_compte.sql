-- Test LOCAL (base jetable : supabase/tests/sql/local_pg.sh) de la suppression d'un gros compte.
-- Usage : cat supabase/tests/sql/suppression_compte_decor.sql <(cat defs) ... voir suppression_compte.sh
\set ON_ERROR_STOP on
\timing off
\echo '== A. AVANT la migration : suppression directe d un compte de 3000 activités'
begin;
do $$ declare t0 timestamptz := clock_timestamp(); begin
  delete from auth.users where id = '00000000-0000-4000-8000-000000000001';
  raise notice 'suppression directe : % ms', round(extract(epoch from clock_timestamp()-t0)*1000);
end $$;
rollback;

\echo '== B. APRÈS la migration : suppression par lots puis du compte'
\i supabase/migrations/2026-10-14_suppression_compte_par_lots.sql
do $$
declare t0 timestamptz := clock_timestamp(); r jsonb; tours int := 0; restant int; ok_tail boolean;
begin
  loop
    r := public.rpc_purge_compte('00000000-0000-4000-8000-000000000001', 500);
    tours := tours + 1;
    exit when (r->>'total')::int = 0;
    if tours > 100 then raise exception 'trop de tours'; end if;
  end loop;
  raise notice 'purge par lots : % tours, % ms', tours, round(extract(epoch from clock_timestamp()-t0)*1000);
  t0 := clock_timestamp();
  delete from auth.users where id = '00000000-0000-4000-8000-000000000001';
  raise notice 'suppression du compte après purge : % ms', round(extract(epoch from clock_timestamp()-t0)*1000);
end $$;

\echo '== C. Vérifications'
select 'compte supprimé' as controle, (select count(*) from auth.users where id='00000000-0000-4000-8000-000000000001') = 0 as ok
union all select 'activités du compte effacées', (select count(*) from public.activities where user_id='00000000-0000-4000-8000-000000000001') = 0
union all select 'métriques du compte effacées', (select count(*) from public.daily_metrics where user_id='00000000-0000-4000-8000-000000000001') = 0
union all select 'courbes du compte effacées', (select count(*) from public.power_profile where user_id='00000000-0000-4000-8000-000000000001') = 0
union all select 'AUTRE compte intact (activités)', (select count(*) from public.activities where user_id='00000000-0000-4000-8000-000000000002') = 50
union all select 'AUTRE compte intact (métriques > 0)', (select count(*) from public.daily_metrics where user_id='00000000-0000-4000-8000-000000000002') > 0
union all select 'rpc_purge_compte refusée à authenticated', not has_function_privilege('authenticated','public.rpc_purge_compte(uuid,integer)','execute')
union all select 'rpc_purge_compte refusée à anon', not has_function_privilege('anon','public.rpc_purge_compte(uuid,integer)','execute');
