-- Sous-disciplines des sports choisis (aujourd'hui les disciplines de l'athlétisme), dans `user_preferences.disciplines` (13/10/2026). Idempotente.
-- Un objet { sport: [clés] }, ex. {"athletisme": ["100m", "hauteur"]} ; null = jamais renseigné. Le contenu est re-nettoyé côté appli à chaque lecture.
-- La RLS existante suffit : chaque utilisateur ne lit et n'écrit que sa propre ligne.
alter table public.user_preferences add column if not exists disciplines jsonb;
alter table public.user_preferences drop constraint if exists user_preferences_disciplines_valeur;
alter table public.user_preferences add constraint user_preferences_disciplines_valeur
  check (disciplines is null or (jsonb_typeof(disciplines) = 'object' and pg_column_size(disciplines) < 2048));
