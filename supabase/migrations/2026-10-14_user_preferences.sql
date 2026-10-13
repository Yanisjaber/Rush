-- ============================================================
-- `user_dashboard` devient `user_preferences` : un seul endroit pour les préférences d'un compte (13/10/2026).
--
-- Avant : la disposition de l'accueil était dans `user_dashboard` (table vide à ce jour) et le thème clair/sombre seulement
-- dans le navigateur (il ne suivait donc pas le compte d'un appareil à l'autre).
-- Après : `user_preferences` (une ligne par compte) contient `layout` (disposition de l'accueil) et `theme`.
--
-- Idempotente. RLS inchangée : chaque utilisateur ne voit et ne modifie que sa propre ligne (auth.uid() = user_id).
-- ============================================================

do $$
begin
  if to_regclass('public.user_dashboard') is not null and to_regclass('public.user_preferences') is null then
    alter table public.user_dashboard rename to user_preferences;
  end if;
end $$;

-- Les noms des contraintes et des règles suivent le nouveau nom de la table
do $$
declare r record;
begin
  for r in select * from (values
      ('user_dashboard_pkey', 'user_preferences_pkey'),
      ('user_dashboard_user_id_fkey', 'user_preferences_user_id_fkey'),
      ('user_dashboard_layout_taille', 'user_preferences_layout_taille')) as t(ancien, nouveau)
  loop
    if exists (select 1 from pg_constraint where conrelid = 'public.user_preferences'::regclass and conname = r.ancien) then
      execute format('alter table public.user_preferences rename constraint %I to %I', r.ancien, r.nouveau);
    end if;
  end loop;
  for r in select * from (values
      ('user_dashboard_select_own', 'user_preferences_select_own'),
      ('user_dashboard_insert_own', 'user_preferences_insert_own'),
      ('user_dashboard_update_own', 'user_preferences_update_own'),
      ('user_dashboard_delete_own', 'user_preferences_delete_own')) as t(ancien, nouveau)
  loop
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_preferences' and policyname = r.ancien) then
      execute format('alter policy %I on public.user_preferences rename to %I', r.ancien, r.nouveau);
    end if;
  end loop;
end $$;

-- Thème de l'appli (null = pas encore choisi : l'appli garde le choix de l'appareil)
alter table public.user_preferences add column if not exists theme text;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.user_preferences'::regclass and conname = 'user_preferences_theme_valeur') then
    alter table public.user_preferences add constraint user_preferences_theme_valeur check (theme is null or theme in ('sombre', 'clair'));
  end if;
end $$;

comment on table public.user_preferences is 'Préférences d''un compte : layout = disposition de l''accueil (JSON), theme = sombre | clair. Une ligne par utilisateur, RLS auth.uid() = user_id.';
