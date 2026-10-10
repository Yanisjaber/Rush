# Coach IA — Modèle de données (Supabase)

Application **mono-utilisateur** : chaque ligne appartient à un compte (`user_id` → `auth.users`)
et n'est lisible/modifiable que par lui (RLS `auth.uid() = user_id`). Le système de coaching
humain (coach ↔ athlète, messagerie) a été supprimé le 2026-10-11 ; le rôle `anon` n'a accès
à aucune table. Le schéma exact est dans `supabase/migrations/` (journal daté).

## Tables

| Table | Rôle |
|---|---|
| `profiles` | Identité de base créée à l'inscription (`display_name`, `locale`…) |
| `user_profiles` | Réglages physiologiques : `ftp`, `hr_max`, `lthr`, `weight` ; le reste (FC repos, VMA, allures, équipement…) dans la colonne JSONB `extras`. Les zones sont recalculées à l'affichage, jamais stockées |
| `activities` | Séances réalisées (Strava, Garmin ou manuelles) ; `streams_gz` (streams compressés), `power_curve`, `tss`, `category`… |
| `activity_edits` | Calque de retouches utilisateur sur les activités |
| `activity_planned` | Séances prévues (dont celles générées par l'IA) |
| `activity_template` | Bibliothèque de séances réutilisables |
| `rest_day`, `training_phases`, `day_notes`, `yearly_goals`, `preferences` | Jours de repos, périodisation, notes de jour, objectifs annuels, préférences |
| `daily_metrics` | Charge calculée par jour (CTL/ATL/TSB), recalculée par trigger |
| `power_profile`, `power_profile_sport` | Records de puissance par durée (global et par sport) |
| `garmin_sleep` | Nuits de sommeil Garmin (phases, score, HRV, stress, FC nocturne) |
| `od_prefs` | Préférences Open Dossard |
| `connexions_app` | Connexions OAuth (Strava, Garmin) ; `access_token`/`refresh_token` masqués au navigateur par révocation de colonnes |
| `oauth_states` | État OAuth à usage unique (créé par `oauth-start`, consommé par les callbacks) ; aucun accès client |

## Règles
- Toute nouvelle table : RLS activée, policies limitées à `auth.uid() = user_id`.
- Les secrets (tokens OAuth) ne sont lus que par les Edge Functions via `service_role`.
- Un fichier par évolution dans `supabase/migrations/` (`AAAA-MM-JJ_nom.sql`), relançable sans risque.
