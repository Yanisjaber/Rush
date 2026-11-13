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
| `activities` | Séances réalisées (Strava, fichier importé ou saisie manuelle) ; `streams_gz` (streams compressés), `power_curve`, `signal_curves` (FC, cadence, couple, vitesse, VAM et descente par durée, vélo seulement), `lap_details` (tours), `tss`, `category`, `discipline`, `merged_into` (étapes d'un triathlon fusionné)… |
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
| `coach_acces` | Ancienne liste blanche du chat Coach IA, plus lue depuis le 13 nov. 2026 (le Coach est ouvert à tout compte connecté). Une ligne = ce compte avait droit au Coach. Le compte lit sa ligne, personne ne l'écrit depuis l'app (insertion à la main en SQL) |
| `coach_reglages` | Accord de partage des données avec l'IA (`accord_donnees`, une case par catégorie de santé dans `sante_categories`) et seuils choisis par l'utilisateur (`seuils`, JSON de 1 Ko au plus). Le compte les écrit lui-même |
| `chat_messages` | LA conversation du Coach (une par compte), avec les cartes de séance proposées (`cartes`, états `proposee`, `en_cours`, `ajoutee`, `refusee`, `annulee`). Le compte lit et efface ; seule l'Edge Function `coach-chat` écrit. 5000 messages au plus par compte |
| `coach_memoire` | Résumé glissant de la conversation (la mémoire du coach, 4000 caractères au plus). Le compte lit et efface ; l'Edge Function écrit |
| `coach_usage` | Messages et tokens du jour par compte (plafond quotidien). Le compte lit ; seules les fonctions `coach_reserver` et `coach_compter` écrivent |
| `coach_depense` | Dépense du mois pour tous les comptes (coupe-circuit global). Aucun accès depuis l'app |

## Fonctions SQL appelées par l'app
| Fonction | Rôle |
|---|---|
| `rpc_sorties_velo()` | Les sorties à vélo du compte connecté (Ride, VirtualRide, GravelRide, MountainBikeRide ; ni vélo électrique, ni étapes fusionnées) avec durée, distance, dénivelé, énergie (kJ), charge (TSS), puissance moyenne (seulement mesurée par un capteur) et fréquence cardiaque moyenne. Sert aux records basiques du Bilan. `security invoker` : la RLS s'applique ; réservée à `authenticated` |
| `rpc_courbe_puissance(p_debut, p_fin)` | Pour 44 durées (de 1 s à 5 h), les trois meilleures puissances moyennes du compte connecté, lues dans `power_curve`, avec la séance qui les a faites ; sur une période, ou sur tout l'historique sans dates. Mêmes sports et mêmes droits que `rpc_sorties_velo`. À ne pas confondre avec `power_profile`, qui mélange tous les sports (la course à pied avec capteur y fait des records) |
| `rpc_courbe_signal(p_signal, p_debut, p_fin)` | Comme `rpc_courbe_puissance`, pour un autre signal du vélo : `fc` (bpm), `cad` (tr/min), `cou` (N·m), `vit` (km/h), `vam` et `des` (m/h). Lu dans `signal_curves`, rempli par l'Edge Function `strava-streams` (calcul dans `_shared/signaux.ts`). La vitesse, la VAM et la descente ignorent le vélo virtuel. Un nom de signal inconnu ne renvoie rien |
| `rpc_piliers_annuels()` | Les mesures par année du niveau global de l'athlète (vélo) : meilleures puissances 5 s / 5 min / 20 min / 60 min, durabilité (`late_300` et `late_1200` de `power_curve` : meilleure puissance 5 et 20 min après 2 h 30), répétabilité (médiane de `rep_3` / `rep_1` : le 3e des trois meilleurs efforts de 5 min d'une sortie contre le 1er, sur les sorties dont le 3e effort fait au moins 75 % du meilleur 5 min de l'année) et charge chronique (CTL) maximale de l'année (`daily_metrics`). Calculées par `strava-streams` (`_shared/repetabilite.ts`) ; les notes de 0 à 100 sont calculées côté application |
| `rpc_courbe_course(p_signal, p_debut, p_fin, p_cle, p_n)` | Les courbes de la course à pied du compte connecté (Bilan › Records › Course) : `pace` (le meilleur TEMPS en secondes par distance : 400, 1000, 1609, 3000, 5000, 10000, 15000, 20000, 21097, 30000, 42195 m ; le plus petit gagne), `dis` (la meilleure distance en mètres par durée de 1 min à 3 h) et `fc` (la meilleure FC moyenne par durée). Lues dans `signal_curves` des séances Run, TrailRun et VirtualRun (version 11, calcul : `supabase/functions/_shared/signaux-course.ts`, rempli par `strava-streams`). `p_cle` : une seule distance ou durée (le classement), `p_n` : le nombre de séances (3 par défaut, 100 au plus). Même droits que `rpc_courbe_signal` |
| `rpc_piliers_course()` | Les mesures par année du niveau global de la course : meilleurs temps de l'année sur 1 km, 5 km et 10 km, meilleures distances en 5 min et en 1 h, nombre de courses avec courbes. Les notes sont calculées côté application (`native/src/data/bilan/piliers-course.ts`) |
| `rpc_coach_resume(p_date, p_sante)` | Le résumé JSON que lit le Coach IA (≈ 3 Ko) : forme, charge sur 7 jours, volume par sport, 14 derniers jours, dernières séances, prévues, compétitions, indisponibilités, repos, cycles, objectifs, santé, bloc « qualité ». `security invoker`, ne lit que `auth.uid()`. **Aucun texte externe n'en sort** (ni nom d'activité, ni note) ; la santé ne sort que pour les catégories de `p_sante`. Détail : `docs/ia/CADRAGE_IA.md` |
| `coach_famille_sport`, `coach_categorie_sante` | Aides pures de `rpc_coach_resume` (famille d'un type Strava ; catégorie de santé d'une mesure) |
| `coach_reserver`, `coach_compter`, `coach_carte_etat` | Réservées au service role (Edge Function `coach-chat`) : plafond de messages du jour (atomique), comptage des tokens et du coût, lecture et changement d'état d'une carte de séance (atomique : évite un double « Ajouter ») |

## Règles
- Toute nouvelle table : RLS activée, policies limitées à `auth.uid() = user_id`.
- Les secrets (tokens OAuth) ne sont lus que par les Edge Functions via `service_role`.
- Un fichier par évolution dans `supabase/migrations/` (`AAAA-MM-JJ_nom.sql`), relançable sans risque.
