-- Durcissement (facultatif, sans effet visible) suite à l'audit du 2026-10-13. Relançable sans risque.
-- À appliquer à la main : supabase db query --linked -f supabase/migrations/2026-10-13_durcissement_policies.sql
--
-- 1) 23 policies sont écrites « pour tout le monde » (rôle public, qui inclut anon). Elles étaient déjà sans danger
--    (le rôle anon n'a aucun droit sur les tables, et chaque policy exige auth.uid() = user_id), mais on les réserve
--    explicitement aux utilisateurs connectés : double verrou.
-- 2) Les fonctions de déclencheur (trigger) n'ont pas besoin d'être exécutables par le navigateur : on retire ce droit.
--    Les déclencheurs continuent de fonctionner (le droit EXECUTE n'est vérifié qu'à la création du déclencheur).
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and roles = '{public}'
  loop
    execute format('alter policy %I on %I.%I to authenticated', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

revoke execute on function public.handle_new_profile() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.trg_recalc_daily_metrics() from public, anon, authenticated;
