-- ============================================================
-- Fusion `profiles` -> `user_profiles` (13/10/2026).
--
-- `profiles` datait du système coach <-> athlète (supprimé le 2026-10-11) : 8 lignes, toutes `role = both`, langue `fr`,
-- aucun avatar, et un « display_name » qui n'était que l'adresse e-mail (déjà dans l'authentification). Aucune table, règle
-- d'accès, vue ni code ne s'en sert : il n'y a rien à transférer, `user_profiles` contient déjà tout ce qui a de la valeur.
--
-- Cette migration (idempotente) :
--   1. supprime le déclencheur et la fonction qui remplissaient `profiles` à l'inscription ;
--      (`on_auth_user_created` / `handle_new_user`, qui remplissent `user_profiles`, ne sont PAS touchés) ;
--   2. supprime la table `profiles` ;
--   3. retire les clés « null » de `user_profiles.extras` (absent et null veulent dire la même chose pour l'appli).
-- ============================================================

drop trigger if exists trg_auth_user_created on auth.users;
drop function if exists public.handle_new_profile();
drop table if exists public.profiles;

update public.user_profiles u
set extras = coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(u.extras) e where e.value <> 'null'::jsonb), '{}'::jsonb)
where exists (select 1 from jsonb_each(u.extras) e where e.value = 'null'::jsonb);
