-- Retrait du système de coaching humain (coach <-> athlète) + durcissement.
-- Relançable sans risque. Ordre important : les policies d'abord, les tables ensuite.
--
-- Contexte : l'audit RLS du 2026-10-11 a montré qu'un utilisateur connecté pouvait
-- s'attribuer le rôle de coach actif de n'importe quel compte (INSERT direct avec
-- status 'active' par défaut, ou UPDATE de 'pending' vers 'active'). Le système est
-- supprimé : chacun ne voit plus que ses propres données.

-- 1) profiles : on garde la lecture de son propre profil, sans passer par le coaching.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- 2) Supprime toutes les policies « coach » restantes (celles qui appellent is_coach_of).
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ilike '%is_coach_of%' or coalesce(with_check, '') ilike '%is_coach_of%')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 3) Tables du coaching.
drop table if exists public.messages;
drop table if exists public.coach_athlete;

-- 4) Fonctions du coaching.
drop function if exists public.is_coach_of(uuid);
drop function if exists public.add_athlete_by_email(text);
drop function if exists public.my_pending_invites();

-- 5) recalc_daily_metrics(uuid) acceptait n'importe quel user_id sans contrôle :
--    réservée aux triggers et à service_role.
revoke execute on function public.recalc_daily_metrics(uuid) from public, anon, authenticated;

-- 6) Droits de table : TRUNCATE / REFERENCES / TRIGGER ne servent à personne côté
--    navigateur (et TRUNCATE ignore la RLS) ; anon n'a besoin d'aucune table.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;
