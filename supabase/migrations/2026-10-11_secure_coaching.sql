-- Sécurisation du coaching + droits sur les fonctions (audit RLS du 2026-10-11).
-- Relançable sans risque.
--
-- Faille corrigée : n'importe quel utilisateur connecté pouvait se rendre
-- « coach actif » de n'importe quel autre compte (lecture + écriture de ses
-- données) :
--   - INSERT direct sur coach_athlete autorisé avec status 'active' (valeur par
--     défaut) dès que coach_id = auth.uid() ;
--   - UPDATE autorisé au coach, qui pouvait passer une invitation 'pending' à
--     'active' sans l'accord de l'athlète.

-- 1) Plus d'INSERT direct par le navigateur : les invitations passent par la
--    fonction add_athlete_by_email (security definer), les liens « perso »
--    par le trigger de création de compte.
drop policy if exists coach_athlete_insert on public.coach_athlete;

-- 2) Verrouillage des transitions de statut (UPDATE).
--    - l'identité du lien (coach_id / athlete_id) ne change jamais ;
--    - seul l'athlète peut accepter / réactiver ('pending' -> 'active', etc.) ;
--    - le coach peut seulement révoquer ou renommer (coach_label).
--    Les appels internes (fonctions security definer, service_role) ne sont pas
--    concernés : current_user n'y est pas 'authenticated' / 'anon'.
create or replace function public.coach_athlete_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.coach_id is distinct from old.coach_id
     or new.athlete_id is distinct from old.athlete_id then
    raise exception 'Le lien coach/athlète ne peut pas être modifié';
  end if;

  if new.status is distinct from old.status then
    if auth.uid() = old.athlete_id then
      null; -- l'athlète décide (accepter, refuser, révoquer)
    elsif auth.uid() = old.coach_id and new.status = 'revoked' then
      null; -- le coach peut seulement mettre fin au lien
    else
      raise exception 'Changement de statut non autorisé';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists coach_athlete_guard on public.coach_athlete;
create trigger coach_athlete_guard
  before update on public.coach_athlete
  for each row execute function public.coach_athlete_guard();

-- 3) Fonctions security definer : plus appelables par n'importe qui.
--    recalc_daily_metrics(uuid) acceptait n'importe quel user_id sans contrôle.
revoke execute on function public.recalc_daily_metrics(uuid)   from public, anon, authenticated;
revoke execute on function public.handle_new_user()            from public, anon, authenticated;
revoke execute on function public.handle_new_profile()         from public, anon, authenticated;
revoke execute on function public.trg_recalc_daily_metrics()   from public, anon, authenticated;
revoke execute on function public.add_athlete_by_email(text)   from public, anon;
revoke execute on function public.my_pending_invites()         from public, anon;
grant  execute on function public.add_athlete_by_email(text)   to authenticated;
grant  execute on function public.my_pending_invites()         to authenticated;

-- 4) Droits de table : TRUNCATE / REFERENCES / TRIGGER ne servent à personne
--    côté navigateur (et TRUNCATE ignore la RLS) ; et le rôle anon n'a besoin
--    d'aucune table (toute l'app exige une connexion).
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;
