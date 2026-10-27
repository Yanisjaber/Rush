-- ============================================================
-- Liens vers une séance : on ne peut rattacher une ligne qu'à SA propre séance (SEC-4 de l'audit).
--
-- Problème : les policies d'écriture de `strength_sets` et `hyrox_tests` vérifient seulement
-- `auth.uid() = user_id`. Un utilisateur pouvait donc écrire l'`activity_id` d'une séance qui
-- appartient à quelqu'un d'autre (la suppression de cette séance effaçait alors sa ligne en cascade).
-- `hyrox_efforts` faisait déjà la bonne vérification (2026-10-22) : on aligne les deux autres.
--
-- Au passage :
--   - plus aucun droit par défaut pour `anon` sur les futures tables (aucun accès anonyme dans Rush) ;
--   - `health_metrics_garde_fous` reçoit un `search_path` fixe (bonne pratique des fonctions de déclencheur).
--
-- Les droits TRUNCATE / REFERENCES / TRIGGER (SEC-3) étaient déjà retirés en production
-- (vérifié le 28/10/2026 : droits par défaut du rôle postgres = arwdm). Rien à refaire.
-- Relançable sans risque. Retour arrière : recréer les policies avec `auth.uid() = user_id` seul.
-- ============================================================

-- strength_sets
drop policy if exists strength_sets_insert_own on public.strength_sets;
create policy strength_sets_insert_own on public.strength_sets for insert to authenticated
  with check (
    auth.uid() = user_id
    and (activity_id is null or exists (select 1 from public.activities a where a.id = activity_id and a.user_id = auth.uid()))
  );
drop policy if exists strength_sets_update_own on public.strength_sets;
create policy strength_sets_update_own on public.strength_sets for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (activity_id is null or exists (select 1 from public.activities a where a.id = activity_id and a.user_id = auth.uid()))
  );

-- hyrox_tests
drop policy if exists hyrox_tests_insert_own on public.hyrox_tests;
create policy hyrox_tests_insert_own on public.hyrox_tests for insert to authenticated
  with check (
    auth.uid() = user_id
    and (activity_id is null or exists (select 1 from public.activities a where a.id = activity_id and a.user_id = auth.uid()))
  );
drop policy if exists hyrox_tests_update_own on public.hyrox_tests;
create policy hyrox_tests_update_own on public.hyrox_tests for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (activity_id is null or exists (select 1 from public.activities a where a.id = activity_id and a.user_id = auth.uid()))
  );

-- Futures tables : rien pour anon
alter default privileges for role postgres in schema public revoke all on tables from anon;

-- search_path fixe pour la fonction de garde-fous de health_metrics (si elle existe)
do $$
begin
  if to_regprocedure('public.health_metrics_garde_fous()') is not null then
    alter function public.health_metrics_garde_fous() set search_path = public;
  end if;
end;
$$;
