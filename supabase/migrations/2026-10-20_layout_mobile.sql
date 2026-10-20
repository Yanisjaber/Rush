-- ============================================================
-- Disposition de l'accueil propre à l'app mobile (20/10/2026).
--
-- Pourquoi : le site et l'app mobile n'ont pas les mêmes tailles de widgets (le site : S, M, L, XL ; le mobile : XS, S, M, L, avec des
-- hauteurs fixes). Ils écrivaient dans la même colonne `layout` et se gênaient : une disposition réglée sur le téléphone remettait des
-- tailles par défaut sur le site, et l'inverse.
-- Après : le site garde `layout`, l'app mobile écrit dans `layout_mobile`. Aucune donnée n'est copiée ni supprimée.
--
-- Idempotente. RLS inchangée : les règles de `user_preferences` portent sur la ligne (auth.uid() = user_id), elles couvrent la nouvelle colonne.
-- ============================================================

alter table public.user_preferences add column if not exists layout_mobile jsonb;

-- Même plafond que `layout` : une disposition reste petite
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.user_preferences'::regclass and conname = 'user_preferences_layout_mobile_taille') then
    alter table public.user_preferences add constraint user_preferences_layout_mobile_taille check (pg_column_size(layout_mobile) < 16384);
  end if;
end $$;

comment on column public.user_preferences.layout is 'Disposition de l''accueil du SITE (JSON : widgets et tailles S, M, L, XL).';
comment on column public.user_preferences.layout_mobile is 'Disposition de l''accueil de l''APP MOBILE (JSON : widgets et tailles XS, S, M, L). Null = composition automatique.';
