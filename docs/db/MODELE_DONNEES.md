# Rush — Modèle de données (Supabase)

Application **mono-utilisateur** : chaque ligne appartient à un compte (`user_id` → `auth.users`)
et n'est lisible/modifiable que par lui (RLS `auth.uid() = user_id`). Le système de coaching
humain (coach ↔ athlète, messagerie) a été supprimé le 2026-10-11 ; le rôle `anon` n'a accès
à aucune table. Le schéma exact est dans `supabase/migrations/` (journal daté).

## Tables

| Table | Rôle |
|---|---|
| `user_profiles` | Profil de l'athlète : `ftp`, `hr_max`, `lthr`, `weight` en colonnes ; prénom et nom (`first_name`, `last_name`) et  le reste (FC repos, VMA, allures, équipement…) dans la colonne JSONB `extras`. Les zones sont recalculées à l'affichage, jamais stockées |
| `user_preferences` | Préférences d'un compte (une ligne par utilisateur, RLS `auth.uid() = user_id`) : `layout` = disposition de l'accueil du site (JSON, widgets et tailles S, M, L, XL), `layout_mobile` = disposition de l'accueil de l'app mobile (JSON, tailles XS, S, M, L ; null = composition automatique), `theme` = `sombre` ou `clair`. Ancien nom : `user_dashboard` |
| `activities` | Séances réalisées (Strava, fichier importé ou saisie manuelle) ; `streams_gz` (streams compressés), `power_curve`, `lap_details` (tours), `tss`, `category`, `discipline`, `merged_into` (étapes d'un triathlon fusionné)… |
| `activity_edits` | Calque de retouches utilisateur sur les activités |
| `activity_planned` | Séances prévues (dont celles générées par l'IA) |
| `activity_template` | Bibliothèque de séances réutilisables |
| `rest_day`, `training_phases`, `day_notes`, `yearly_goals` | Jours de repos, périodisation, notes de jour (note, maladie, blessure, indisponible, avec détails en JSON), objectifs annuels |
| `daily_metrics` | Charge calculée par jour (CTL/ATL/TSB), recalculée par trigger |
| `power_profile`, `power_profile_sport` | Records de puissance par durée (global et par sport) |
| `health_metrics` | Données de santé d'un compte, une ligne par jour, mesure et source (`manual`, `garmin`, `apple_sante`, `strava`) : ressenti du matin, événements (malade, blessé, alcool, voyage), corps, nutrition, cycle, mesures d'appareils. Données **sensibles** : RLS `auth.uid() = user_id`, aucun accès anonyme, plafond de 50 000 lignes par compte, supprimées avec le compte (cascade). Le catalogue des mesures est dans `native/src/data/sante/sante-catalogue.ts` |
| `garmin_sleep` | Nuits de sommeil Garmin (phases, score, HRV, stress, FC nocturne) |
| `strength_exercises`, `strength_programs`, `strength_sets` | Carnet de force : exercices perso, programmes (séances types, exercices en JSONB) et séries réalisées (rattachées à une ligne `activities`, supprimées avec elle). La bibliothèque d'exercices de base est dans le code de l'app |
| `hyrox_tests`, `hyrox_objectif` | Hyrox : tests et courses en 16 segments (8 runs + 8 stations, en secondes) et objectif de temps (une ligne par utilisateur) |
| `hyrox_efforts` | Hyrox : le détail d'un entraînement, un tour de montre par ligne (run, une des 8 stations, exercice libre ou repos), avec durée, distance, charge et répétitions facultatives, et un indicateur « simulation ». Rattaché à une séance (`activities`, supprimé avec elle, la politique vérifie que la séance est bien à l'utilisateur) ou saisi sans séance |
| `training_cycles` | Cycles d'entraînement : des périodes que l'utilisateur nomme et colore (nom, dates de début et de fin, couleur #rrggbb), affichées en bandes sous les jours du calendrier. Au plus deux cycles le même jour (imposé par un déclencheur de la base), 366 jours au plus |
| `connexions_app` | Connexions OAuth (Strava ; Garmin à venir). **Aucune colonne de jeton** : les jetons sont chiffrés dans Supabase Vault (colonne `secret_id`) et ne sont lus que par les Edge Functions (service role), via `rpc_connection_secrets`. Le navigateur ne voit que le statut (`external_id`, `athlete_name`, dates de synchro) |
| `oauth_states` | État OAuth à usage unique (créé par `oauth-start`, consommé par les callbacks) ; aucun accès client |

## Règles
- Toute nouvelle table : RLS activée, policies limitées à `auth.uid() = user_id`.
- Les secrets (tokens OAuth) ne sont lus que par les Edge Functions via `service_role`.
- Un fichier par évolution dans `supabase/migrations/` (`AAAA-MM-JJ_nom.sql`), relançable sans risque.
