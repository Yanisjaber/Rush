-- Photo de profil : un bucket PRIVÉ « avatars », un seul fichier par compte, rangé dans un dossier à l'id de l'utilisateur.
-- Qui peut lire ou modifier ça ? Seulement le propriétaire (dossier = auth.uid()). Aucun accès anon. Idempotent.
-- Le chemin du fichier est gardé dans user_profiles.extras.avatar_path (pas de nouvelle colonne).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists avatars_lire on storage.objects;
drop policy if exists avatars_ajouter on storage.objects;
drop policy if exists avatars_modifier on storage.objects;
drop policy if exists avatars_supprimer on storage.objects;

create policy avatars_lire on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_ajouter on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_modifier on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_supprimer on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
