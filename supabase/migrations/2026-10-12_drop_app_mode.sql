-- Retire user_profiles.app_mode : le choix Manuel/IA a été supprimé de l'app
-- (commit d251066), plus aucun code ne lit ni n'écrit cette colonne.
-- Relançable sans risque ; la contrainte check liée à la colonne part avec elle.
alter table public.user_profiles drop column if exists app_mode;
