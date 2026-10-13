-- Sports choisis par l'utilisateur (onboarding et Paramètres › Préférences), dans `user_preferences` (13/10/2026). Idempotente.
-- `sports` = tableau JSON de clés (course, velo, natation, muscu, hyrox, autre) ; null = jamais demandé, [] = demandé sans rien choisi.
-- La RLS existante suffit : chaque utilisateur ne lit et n'écrit que sa propre ligne. Le contenu est re-nettoyé côté appli à chaque lecture.
alter table public.user_preferences add column if not exists sports jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.user_preferences'::regclass and conname = 'user_preferences_sports_valeur') then
    alter table public.user_preferences add constraint user_preferences_sports_valeur
      check (sports is null or (jsonb_typeof(sports) = 'array' and jsonb_array_length(sports) <= 6 and pg_column_size(sports) < 512));
  end if;
end $$;
