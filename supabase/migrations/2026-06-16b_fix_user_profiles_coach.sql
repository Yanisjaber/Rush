-- Rush - Correctif handle_new_user + Etape 4 (lecture coach).
-- A executer dans Supabase SQL Editor apres 2026-06-16_multi_user_profiles.sql.
-- Idempotent.

-- 1. Repare la creation auto de user_profiles a l'inscription.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name',
                           split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Creation de profiles via une fonction au nom distinct.
create or replace function public.handle_new_profile() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',
                           new.raw_user_meta_data->>'name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_profile();

-- 3. Supprime athlete_settings (doublon de user_profiles, jamais branchee).
drop table if exists public.athlete_settings;

-- 4. Etape 4 : le coach lie et actif peut LIRE le profil de ses athletes.
--    L'ecriture reste reservee a l'athlete (policy historique inchangee).
drop policy if exists "user_profiles_coach_read" on public.user_profiles;
create policy "user_profiles_coach_read" on public.user_profiles
  for select using (public.is_coach_of(user_id));
