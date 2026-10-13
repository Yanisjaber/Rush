-- Grand ménage, étape 2 : à l'inscription, le profil reçoit directement le prénom et le nom (extras.first_name / last_name),
-- pris dans les informations saisies dans le formulaire. `display_name` est encore rempli (il disparaît à l'étape 3).
-- Sans danger pour l'app en ligne. Idempotente.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.user_profiles (user_id, display_name, extras)
  values (
    new.id,
    coalesce(m->>'display_name', split_part(new.email, '@', 1)),
    jsonb_strip_nulls(jsonb_build_object(
      'first_name', nullif(left(btrim(coalesce(m->>'first_name', '')), 60), ''),
      'last_name',  nullif(left(btrim(coalesce(m->>'last_name', '')), 60), '')))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
