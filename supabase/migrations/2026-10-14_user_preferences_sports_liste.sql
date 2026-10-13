-- Les sports qu'on peut cocher passent de 6 à 15 (liste complète des sports de performance) : la contrainte de `user_preferences.sports`
-- accepte maintenant jusqu'à 20 entrées (marge pour de futurs sports), 1 Ko au plus. Idempotente (remplace la contrainte de la migration précédente).
alter table public.user_preferences drop constraint if exists user_preferences_sports_valeur;
alter table public.user_preferences add constraint user_preferences_sports_valeur
  check (sports is null or (jsonb_typeof(sports) = 'array' and jsonb_array_length(sports) <= 20 and pg_column_size(sports) < 1024));
