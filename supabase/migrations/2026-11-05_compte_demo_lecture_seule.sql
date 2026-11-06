-- ============================================================
-- Compte de démo en LECTURE SEULE (Yanis, 5 nov. 2026).
--
-- La démo de l'app est un vrai compte (demo@rush-demo.app) rempli de séances simulées par supabase/seed-demo/semer-demo.mts ; n'importe qui peut s'y connecter par le bouton
-- « Essayer la démo » (Edge Function demo-session). Pour que personne ne puisse y écrire, chaque table qui a une colonne `user_id` reçoit trois règles RESTRICTIVES
-- (ajout, modification, suppression) qui refusent tout ce que ferait ce compte-là. Les règles normales (`auth.uid() = user_id`) ne changent pas pour les autres comptes ;
-- le service (Edge Functions, script de remplissage) n'est pas concerné par la RLS.
--
-- À relancer quand une NOUVELLE table avec `user_id` est créée (la boucle l'attrape). Relançable sans risque : chaque règle est supprimée puis recréée.
-- Aucun accès `anon` n'est ajouté. L'identifiant du compte est fixe : voir ID_DEMO dans semer-demo.mts.
-- ============================================================

do $$
declare
  t text;
  demo constant uuid := '7b0e2f4a-5d3c-4e8a-9a61-2c4f8d1e6b90';
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'user_id'
  loop
    execute format('drop policy if exists demo_lecture_seule_ajout on public.%I', t);
    execute format('drop policy if exists demo_lecture_seule_modif on public.%I', t);
    execute format('drop policy if exists demo_lecture_seule_suppr on public.%I', t);
    execute format('create policy demo_lecture_seule_ajout on public.%I as restrictive for insert to authenticated with check (auth.uid() is distinct from %L::uuid)', t, demo);
    execute format('create policy demo_lecture_seule_modif on public.%I as restrictive for update to authenticated using (auth.uid() is distinct from %L::uuid) with check (auth.uid() is distinct from %L::uuid)', t, demo, demo);
    execute format('create policy demo_lecture_seule_suppr on public.%I as restrictive for delete to authenticated using (auth.uid() is distinct from %L::uuid)', t, demo);
  end loop;
end $$;
