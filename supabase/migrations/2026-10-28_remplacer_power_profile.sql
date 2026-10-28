-- ============================================================
-- Remplacement ATOMIQUE des records de puissance d'un compte.
--
-- Avant : `strava-streams` faisait « supprimer puis réécrire » en plusieurs requêtes (power_profile_sport) ou
-- seulement « écrire » (power_profile : un record d'une séance supprimée restait pour toujours). Une panne au milieu
-- laissait un compte sans records.
--
-- Maintenant : deux fonctions SQL qui font tout (suppression + insertion) dans UNE transaction, réservées au serveur
-- (service_role). Le `user_id` est imposé par le paramètre p_user, jamais lu dans les lignes envoyées ; `details` et
-- `updated_at` reçoivent leur valeur par défaut s'ils sont absents.
-- Relançable sans risque.
-- ============================================================

create or replace function public.rpc_remplacer_power_profile(p_user uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.power_profile where user_id = p_user;
  insert into public.power_profile
    select (jsonb_populate_record(null::public.power_profile,
              jsonb_build_object('updated_at', now()) || e || jsonb_build_object('user_id', p_user))).*
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) e;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.rpc_remplacer_power_profile_sport(p_user uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.power_profile_sport where user_id = p_user;
  insert into public.power_profile_sport
    select (jsonb_populate_record(null::public.power_profile_sport,
              jsonb_build_object('details', '{}'::jsonb, 'updated_at', now()) || e || jsonb_build_object('user_id', p_user))).*
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) e;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.rpc_remplacer_power_profile(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.rpc_remplacer_power_profile_sport(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.rpc_remplacer_power_profile(uuid, jsonb) to service_role;
grant execute on function public.rpc_remplacer_power_profile_sport(uuid, jsonb) to service_role;
