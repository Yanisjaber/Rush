-- =====================================================================================================================
-- Rush — Base V2 : ÉTAPE 0 DE LA BASCULE — mise à l'abri de l'ancienne base (PROPOSITION, jamais appliquée)
-- Déplace TOUTES les anciennes tables et fonctions de `public` vers le schéma `legacy` (non exposé par l'API) : rien n'est copié ni
-- supprimé, c'est instantané (changement d'étiquette). `public` est alors libre pour la V2. À exécuter dans la même transaction que 01-03.
-- =====================================================================================================================
create schema if not exists legacy;
revoke all on schema legacy from public, anon, authenticated;

do $$
declare t record; f record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I set schema legacy', t.tablename);
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('recalc_daily_metrics', 'trg_recalc_daily_metrics', 'handle_new_user', 'handle_new_profile', 'set_updated_at') loop
    execute format('alter function %s set schema legacy', f.sig);
  end loop;
end $$;

-- Les anciens déclencheurs de légacy.activities appelaient des fonctions pensées pour `public` : on les coupe (les anciennes données sont figées)
alter table legacy.activities disable trigger user;
