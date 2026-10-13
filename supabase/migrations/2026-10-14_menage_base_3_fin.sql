-- Grand ménage, étape 3 (fin) : retrait des deux doublons de nom. À appliquer APRÈS la mise en ligne de l'app qui ne lit plus
-- `display_name` ni `extras.full_name`. Idempotente.
--   - le déclencheur d'inscription n'écrit plus `display_name` (il garde first_name / last_name dans extras) ;
--   - la colonne `user_profiles.display_name` est supprimée ;
--   - la clé `extras.full_name` est retirée.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.user_profiles (user_id, extras)
  values (
    new.id,
    jsonb_strip_nulls(jsonb_build_object(
      'first_name', nullif(left(btrim(coalesce(m->>'first_name', '')), 60), ''),
      'last_name',  nullif(left(btrim(coalesce(m->>'last_name', '')), 60), '')))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

alter table public.user_profiles drop column if exists display_name;
update public.user_profiles set extras = extras - 'full_name' where extras ? 'full_name';
