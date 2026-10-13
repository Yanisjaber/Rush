-- =====================================================================================================================
-- Coach IA — CORRECTIFS RAPIDES de la base ACTUELLE (PROPOSITION, non appliquée)
-- Indépendants de la V2 : ils améliorent la base d'aujourd'hui sans rien casser (v1 et v2 continuent de fonctionner).
-- Relançable sans risque. Les parties B et C modifient des données : à lancer seulement après accord et une sauvegarde.
-- =====================================================================================================================

-- ---------------------------------------------------------------------------------------------------------------------
-- A. SANS RISQUE
-- ---------------------------------------------------------------------------------------------------------------------

-- A1. Droits excessifs : Supabase accorde par défaut TRUNCATE, TRIGGER et REFERENCES au rôle `authenticated` sur les tables récentes.
--     Aucun n'est utile à l'appli (et TRUNCATE ignore la RLS). On les retire partout, y compris pour les futures tables.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;
alter default privileges for role postgres in schema public revoke truncate, trigger, references on tables from anon, authenticated;

-- A2. Index redondant : (user_id, iso_date DESC) double la clé primaire (user_id, iso_date) et pèse 3 Mo pour rien.
drop index if exists public.idx_daily_metrics_user_date;

-- A3. Index jamais utilisés (0 lecture depuis la création) : l'un double la contrainte unique (user_id, app), l'autre n'est lu par aucun code.
drop index if exists public.idx_connexions_app_user;
drop index if exists public.idx_user_profiles_strava;

-- A4. Intégrité : valeurs fermées sur activities (les données actuelles les respectent : vérifié par l'audit du 13/10/2026).
--     NOT VALID puis VALIDATE : posé sans verrou long, puis vérifié sur l'existant.
alter table public.activities drop constraint if exists activities_source_check;
alter table public.activities add constraint activities_source_check check (source is null or source in ('strava', 'manual')) not valid;
alter table public.activities validate constraint activities_source_check;
alter table public.activities drop constraint if exists activities_category_check;
alter table public.activities add constraint activities_category_check check (category is null or category in ('entrainement', 'competition')) not valid;
alter table public.activities validate constraint activities_category_check;
alter table public.activities drop constraint if exists activities_durations_check;
alter table public.activities add constraint activities_durations_check check (coalesce(moving_time, 0) >= 0 and coalesce(elapsed_time, 0) >= 0 and coalesce(distance_km, 0) >= 0) not valid;
alter table public.activities validate constraint activities_durations_check;

-- A5. Restes d'anciens modèles : Whoop est abandonné (le système de coaching aussi).
alter table public.connexions_app drop constraint if exists connexions_app_app_check;
alter table public.connexions_app add constraint connexions_app_app_check check (app in ('strava', 'garmin'));

-- ---------------------------------------------------------------------------------------------------------------------
-- B. MODIFIE DES DONNÉES — à lancer seulement après accord (et un export : Paramètres › Exporter mes données, par compte)
-- ---------------------------------------------------------------------------------------------------------------------

-- B1. 8 retouches orphelines (la sortie Strava correspondante n'existe plus). À examiner avant de supprimer :
--   select e.user_id, e.activity_id, e.data from activity_edits e
--   where not exists (select 1 from activities a where a.user_id = e.user_id and a.strava_id::text = e.activity_id);
--   delete from activity_edits e where not exists (select 1 from activities a where a.user_id = e.user_id and a.strava_id::text = e.activity_id);

-- B2. 9 groupes de doublons probables (même compte, même minute, même sport, même durée) : à trancher À LA MAIN, un par un.
--   select user_id, date_trunc('minute', start_date_local) minute, sport, moving_time, array_agg(id) ids, array_agg(source) sources, count(*)
--   from activities group by 1, 2, 3, 4 having count(*) > 1;

-- B3. 871 activités sans `source` (anciens imports) : on les étiquette pour que la colonne devienne fiable.
--   update activities set source = 'import' where source is null;   -- (après avoir ajouté 'import' à activities_source_check)

-- ---------------------------------------------------------------------------------------------------------------------
-- C. À LANCER SÉPARÉMENT (une instruction VACUUM ne peut pas être dans une transaction) :
--   supabase db query --linked "vacuum full public.daily_metrics"
--   → daily_metrics pèse 29 Mo pour 0,6 Mo de données utiles (rewrites complets à chaque changement de séance). Libère ~28 Mo.
--     Verrou exclusif de quelques secondes sur cette table : à faire hors synchro.
-- ---------------------------------------------------------------------------------------------------------------------
