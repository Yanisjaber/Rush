# Proposition : base de données V2

> Réponse à l'[audit du 13/10/2026](AUDIT_2026-10-13.md). **Rien n'est appliqué** : tout est dans `supabase/proposals/db-v2/` et a été **testé sur un Postgres 17 local jetable** (jamais sur ta vraie base).
> Résultat des tests : schéma valide, **bascule complète en une transaction**, **50 vérifications automatiques vertes**, **retour arrière validé**.

## 1. L'idée en cinq phrases

1. Une table = un sujet. `activities` (71 colonnes, 4 sujets mélangés) devient un noyau de 33 colonnes entouré de petites tables (mesures, courbes, retouches, résultats).
2. Les **gros objets** (courbes) et les **secrets** (jetons) sortent des tables que l'appli lit en permanence.
3. Chaque lien entre deux objets est une **clé étrangère**, et la clé est **composite** `(id, user_id)` : impossible de rattacher une ligne à l'objet d'un autre compte.
4. Chaque valeur a un **type précis, une unité dans son nom, et des bornes** vérifiées par la base.
5. Ce qui est **calculé** (forme, records) est recalculé par la base, jamais saisi, et **de façon incrémentale**.

## 2. Avant / après

| | Aujourd'hui | V2 | Pourquoi |
|---|---:|---:|---|
| Tables (`public` + `private`) | 25 | **31 + 2** | plus de tables, mais étroites et mono-sujet |
| Colonnes de `activities` | **71** | **33** | le reste est dans des tables annexes ou supprimé |
| Colonnes vides à 100 % | **30** | **0** | on ne crée que ce qui sert |
| Clés étrangères | 31 | **49** | dont les liens métier manquants, tous composites |
| Contraintes CHECK | 27 | **159** | types fermés, bornes, longueurs, tailles de JSON |
| Contraintes UNIQUE | 3 | **17** | clés naturelles : `(compte, fournisseur, id externe)`… |
| Policies RLS | 50 (hétérogènes) | **35, uniformes** | une seule fabrique : `private.protect()` |
| Droits excessifs | 6 tables | **0** | `TRUNCATE`/`TRIGGER`/`REFERENCES` jamais accordés |
| Secrets lisibles en table | oui | **non** | Vault + wrappers réservés à `service_role` |
| Taille estimée | 327 Mo | **≈ 205 Mo** (−37 %) | courbes en binaire (−65 Mo), forme sans gaspillage (−35 Mo) |
| Taille si courbes en Storage | — | **≈ 12 Mo** | option, voir § 7 |
| Recalcul de la forme | tout l'historique, à chaque changement | **à partir du jour modifié** | `daily_metrics` : 29 Mo pour 0,6 Mo utile |

## 3. Les 12 décisions de conception

| # | Décision | Ce que ça règle |
|---|---|---|
| D1 | **Lecture légère / gros objets séparés** : `activity_streams` (bytea), `routes` (GPX) | PERF-1, MOD-3 : listes d'activités instantanées, base64 abandonné (−25 %) |
| D2 | **Temps** : `started_at timestamptz` = vrai instant UTC, `utc_offset_min`, `local_date` **colonne générée** | MOD-2 : plus de jour décalé selon le fuseau, voyages possibles |
| D3 | **Noms et unités** : anglais, snake_case, pluriel ; suffixes `_s`, `_m`, `_w`, `_bpm`, `_kg`, `_j`, `_kj`, `_ms` ; entiers partout | MOD-7 : fini minutes/secondes mélangées, `km`/`dplus`/`d_plus` |
| D4 | **Intégrité** : clés composites `(parent_id, user_id)`, `CHECK` partout, `UNIQUE (compte, source, id externe)` | INT-1/2/5, SEC-4 : synchro idempotente, plus de rattachement inter-comptes |
| D5 | **Événements ≠ séances prévues ≠ activités** : `events` (+ `event_segments` pour étapes/triathlon), `planned_workouts`, `activities` reliées par `event_id` / `planned_workout_id` | MOD-4 : une compétition préparée et courue sont enfin liées |
| D6 | **Sports en référentiel** : `sports` + `sport_aliases` (Strava `TrailRun` → `trail_run`, `cyclisme` → `ride`) | MOD-7 : un seul vocabulaire, la famille pilote couleur et regroupements |
| D7 | **Secrets** : `public.connections` (état, sans secret) + `private.connection_secrets` (pointeur Vault) + `rpc_connection_secrets` réservée à `service_role` | SEC-1 |
| D8 | **Forme incrémentale** : `private.refresh_daily_load(user, depuis)` ; valeurs en précision complète | PERF-2 : même résultat **à 0,1 près que l'ancien moteur, jour par jour** |
| D9 | **RLS uniforme** : `private.protect(table, mode)` (`rw`, `ro`, `insert_read`, `ref`) ; `(select auth.uid())` ; zéro droit pour `anon` | SEC-3/6, OPS : un seul endroit à relire |
| D10 | **Profil** : `profiles` (identité) + `athlete_thresholds` **historisés** (FTP d'hier ≠ d'aujourd'hui) + `user_settings` (fusion de 3 tables) ; **données de santé non migrées** | MOD-5, SEC-2 |
| D11 | **Force normalisée** : `exercises` (bibliothèque fournie + perso), `strength_programs` + `strength_program_items`, `strength_sets` liées par identifiant, plus de copie de noms | MOD-8/9 : renommer un exercice ne casse plus l'historique |
| D12 | **JSON borné et typé** : uniquement pour des documents (`structure` d'une séance, `layout`), toujours `jsonb_typeof` + taille plafonnée | MOD-9 |

## 4. Les tables (31 + 2)

| Domaine | Tables | Rôle |
|---|---|---|
| Référentiels | `sports`, `sport_aliases` | sports connus et traduction des types des fournisseurs |
| Profil | `profiles`, `athlete_thresholds`, `user_settings` | identité, seuils datés (FTP, FC max…), réglages d'interface |
| Connexions | `connections`, `sync_requests`, *`private.connection_secrets`*, *`private.oauth_states`* | état public des liaisons, demandes de synchro (une active max), secrets chiffrés |
| Calendrier | `events`, `event_segments`, `planned_workouts`, `workout_templates`, `routes`, `calendar_notes`, `rest_days`, `training_phases`, `yearly_goals` | tout ce qui est prévu ou annoté |
| Réalisé | `activities`, `activity_metrics`, `activity_streams`, `activity_overrides`, `race_results` | noyau + mesures + courbes + retouches + résultat |
| Charge | `daily_load`, `power_bests` | forme (CTL/ATL) et records, **dérivés**, écrits par la base |
| Sommeil | `sleep_nights`, `sleep_night_details` | nuit (typée, heures en vrais instants) + détails lourds à part |
| Force | `exercises`, `strength_programs`, `strength_program_items`, `strength_sets` | |
| Hyrox | `hyrox_attempts`, `hyrox_goals` | 16 temps en secondes, bornés |

### Le noyau `activities` (33 colonnes)
`id`, `user_id`, `source` (`strava`/`garmin`/`manual`/`import`), `external_id`, `sport_code`, `sport_raw`, `name`, `started_at`, `utc_offset_min`, `local_date`*(générée)*, `duration_s`, `elapsed_s`, `distance_m`, `elevation_gain_m`, `max_speed_ms`, `hr_avg_bpm`, `hr_max_bpm`, `power_avg_w`, `power_max_w`, `cadence_avg_rpm`, `energy_kj`, `calories`, `training_load`, `ftp_w_at_time`, `rpe`, `notes`, `event_id`, `planned_workout_id`, `is_race`, `is_race_user_set`, `is_hidden`, `created_at`, `updated_at`.

Tout ce qui était **vide à 100 %** (courbes de zones, `user_tags`, `variability_index`, `max_cadence`…) disparaît ; ce qui était **dérivé** (`np`, `intensity`, `kj`…) va dans `activity_metrics` ; `has_heartrate`/`has_power`/`device_watts` se déduisent de la présence des valeurs.

## 5. Correspondance ancien → nouveau (données migrées)

| Ancien | Nouveau | Transformation |
|---|---|---|
| `activities` | `activities` + `activity_metrics` + `activity_streams` + `race_results` (+ `events` pour le triathlon) | `distance_km`×1000, `max_speed_kmh`÷3,6, `strava_id`→`external_id` texte, `source` nul→`import`, **valeurs aberrantes → vides** (comptées), courbes base64→binaire |
| `activity_planned` (entraînement) | `planned_workouts` | minutes→secondes, `cyclisme`→`ride`, GPX → `routes` |
| `activity_planned` (compétition) | `events` | priorité A/B/C normalisée, durée visée en secondes |
| `activity_edits` (JSON par `strava_id`) | `activity_overrides` (colonnes typées, FK) | **8 orphelines écartées** et comptées |
| `activity_template` | `workout_templates` | |
| `user_profiles` + `profiles` + `extras` | `profiles` + `athlete_thresholds` | 32 clés utilisées reprises et **typées** ; **104 clés inutilisées dont la santé : non migrées** |
| `preferences` + `user_dashboard` + `od_prefs` | `user_settings` (1 ligne) | |
| `connexions_app` | `connections` + `private.connection_secrets` (Vault) | Whoop abandonné ; jetons chiffrés |
| `garmin_sleep` | `sleep_nights` + `sleep_night_details` | heures texte → instants (fuseau du profil, `Europe/Paris` par défaut) |
| `garmin_sync_requests` | `sync_requests` | |
| `daily_metrics` | `daily_load` | **recalculée**, pas recopiée ; `tsb` = `ctl − atl` (non stocké) |
| `power_profile` + `power_profile_sport` (57 col.) | `power_bests` (format long) | **reconstruite** depuis les courbes |
| `day_notes` (+ ancien format `iso_date`) | `calendar_notes` + `rest_days` | `maladie`→`illness`, `blessure`→`injury` |
| `rest_day`, `training_phases`, `yearly_goals` | idem | `recup`→`recovery` ; doublons métier écartés |
| `strength_*` | `exercises`, `strength_programs`, `strength_program_items`, `strength_sets` | clés `squat`/`perso-…` → identifiants ; positions 0→1 ; exercices disparus recréés |
| `hyrox_tests`, `hyrox_objectif` | `hyrox_attempts`, `hyrox_goals` | `manuel`→`manual`, `course`→`race` |
| `oauth_states` | `private.oauth_states` | non migrée (10 minutes de durée de vie) |

**Les identifiants (uuid) des activités, séances prévues, compétitions, exercices perso… sont conservés** : les adresses `#/seance/<id>` et les liens restent valables.

## 6. Ce que prouvent les tests (50 vérifications, toutes vertes)

Données de test **synthétiques et piégeuses** (reconstruites à partir de la structure réelle) : FC de 240/300, 3 500 W, nom vide, lien de séance invalide, profil avec date « pas une date » et taille 9999, avatar de 700 caractères, notes avec fin avant début, ancien format de note, sommeil de 90 000 s, triathlon, clés d'exercice inconnues, retouche orpheline, doublon…

| Famille | Ce qui est vérifié |
|---|---|
| Comptes | toutes les activités migrées, charge totale identique, courbes **identiques octet pour octet** après décodage, GPX intacts |
| Neutralisation | chaque valeur aberrante devient vide **sans bloquer** la migration ; santé non migrée ; W' « 19 » → 19 000 J |
| **Forme** | CTL, ATL et charge **identiques à l'ancien moteur sur 497 jours** (à 0,1 près, comme l'ancienne appli) |
| Records | égaux à un calcul indépendant sur l'ancienne base |
| **Incrémental** | ajouter une activité au milieu de l'historique donne **exactement** le recalcul complet ; la supprimer restaure l'état |
| Sécurité | RLS partout, aucun droit `anon`, `private` fermé, un inconnu ne voit **rien** sur 29 tables, un compte ne peut ni lire ni écrire chez un autre, **rattachement inter-comptes refusé** (clé composite), jetons inaccessibles aux utilisateurs |
| Suppression de compte | **tout disparaît en cascade**, jetons chiffrés compris |
| Bascule | une transaction, puis retour arrière : même nombre de lignes, mêmes 25 tables, mêmes déclencheurs |

**Deux défauts de ma propre conception ont été trouvés par ces tests et corrigés** : (1) la suppression d'un compte échouait quand un exercice perso était encore référencé (référence rendue « différée ») ; (2) le calcul incrémental dérivait d'un dixième à cause de valeurs arrondies stockées la veille (précision complète). **Un défaut de l'ancien modèle** est aussi apparu : le jour d'une séance dépendait du réglage de fuseau de la session.

## 7. Décisions à prendre (avec ma recommandation)

| # | Question | Recommandation |
|---|---|---|
| 1 | **Retirer la v1 au moment de la bascule ?** La v1 lit l'ancien modèle : elle ne fonctionnera plus. | **Oui.** Garder `legacy` 30 jours, puis le supprimer. La v1 en secours (`/v1/`) devient inutile. |
| 2 | **Courbes : en base (binaire) ou dans Storage ?** | **En base d'abord** (−65 Mo, simple, RLS native). Passer à Storage si plus de ~8 comptes actifs : la table `activity_streams` garde la même interface. |
| 3 | **Données de santé de `extras`** (allergies, médicaments, contact d'urgence…) | **Ne pas migrer.** Les exporter vers leurs propriétaires, puis supprimer `legacy` (30 jours). |
| 4 | **Heure exacte des anciennes séances** | Laisser `utc_offset_min` vide (inconnu) pour l'existant ; les nouvelles synchronisations Strava le renseignent (écart `start_date_local − start_date`). Un rattrapage est possible plus tard. |
| 5 | **Langue des noms** | Anglais dans la base (standard, outils), français dans l'interface. |
| 6 | **Quand ?** | Après les quick wins et le test des proches ; fenêtre calme (nuit), ~30 minutes. |

## 8. Ce que ça change dans le code

Bonne nouvelle : l'accès aux données est **déjà centralisé**.

| Composant | Fichiers | Travail |
|---|---|---|
| **v2 (navigateur)** | `data/api.js`, `force-acces.js`, `integrations.js`, `export.js`, stores `disposition`/`profil` | Changer noms de colonnes et de tables. **Recommandé : une couche d'adaptation** qui renvoie aux écrans les mêmes champs qu'aujourd'hui (`moving_time`, `distance_km`…) : les 215 tests de calcul et les écrans ne bougent pas, on migre l'interface plus tard. |
| **Edge Functions** (10 ; `coach-ai` devient inutile) | `strava-ingest` (écrit les activités), `strava-streams` (courbes, mesures, records → `rebuild_power_bests`), `strava-webhook`, `strava-oauth-callback` + `oauth-start` (jetons → `rpc_save_connection_secrets`), `disconnect-integration`, `strava-laps`, `delete-account` (inchangée) | Réécrire les lectures/écritures ; plus de calcul de forme (la base s'en charge). |
| **Raspberry Pi** | `tools/garmin_sync.py` | Jetons via `rpc_connection_secrets`, `garmin_sleep` → `sleep_nights`, `garmin_sync_requests` → `sync_requests`. |
| **Base** | `pg_cron` | Une tâche toutes les 5 min qui passe en erreur les demandes `pending` de plus de 15 min (règle OPS-2). |

Estimation : **3 à 4 jours** de travail répartis (base prête et testée ; reste l'adaptation du code et la répétition générale).

## 9. Plan de bascule

| Phase | Contenu | Réversible ? |
|---|---|---|
| **0. Maintenant** | Appliquer `00_quick_wins_schema_actuel.sql` (§ A), couper les inscriptions, décider du sort des clés de santé | oui |
| **1. Sauvegarde** | « Exporter mes données » pour chaque compte ; `supabase db dump` si Docker disponible | — |
| **2. Adaptation du code** | couche d'adaptation v2, Edge Functions, script du Pi — **sur une branche**, déployés au moment de la bascule | oui (branche) |
| **3. Répétition générale** | exécuter la bascule dans une transaction sur la vraie base **puis `ROLLBACK`** (mesure le temps réel et compte les valeurs écartées, sans rien garder) | oui |
| **4. Bascule** | arrêter le cron du Pi → `cutover_all.sql` (une transaction) → déployer fonctions et v2 → **tests de fumée** → relancer le cron | **oui** : `09_rollback_cutover.sql` tant que `legacy` existe |
| **5. Recul** | 30 jours, puis `drop schema legacy cascade` | non |

Les fichiers :

| Fichier | Rôle | Testé |
|---|---|---|
| `00_quick_wins_schema_actuel.sql` | correctifs de la base actuelle (sans V2) | ✅ deux passages |
| `01_schema.sql` | le schéma V2 | ✅ |
| `02_seed_reference.sql` | sports, alias, 48 exercices fournis | ✅ relançable |
| `03a_move_to_legacy.sql` | met l'ancienne base à l'abri (changement d'étiquette instantané) | ✅ |
| `03_migrate_from_legacy.sql` | copie et nettoie les données | ✅ |
| `tests/build_cutover.sh` → `cutover_all.sql` | tout en **une** transaction | ✅ |
| `tests/04_verify.sql` | 50 vérifications | ✅ 50/50 |
| `09_rollback_cutover.sql` | retour arrière | ✅ |
| `tests/run_cutover.sh` | rejoue tout le cycle (bascule → vérifications → retour) | ✅ |

**Rejouer les tests toi-même** (aucun accès à la vraie base, aucun mot de passe) :

```bash
brew install postgresql@17                       # une fois
cd supabase/proposals/db-v2
tests/local_pg.sh start                          # Postgres jetable, en UTC comme Supabase
tests/run_cutover.sh                             # bascule → 50 vérifications → retour arrière
tests/local_pg.sh stop
```

`tests/legacy_schema.sql` reproduit la **structure** (sans donnée) de la base de production ; `tests/legacy_fixture.sql` fournit les données synthétiques piégeuses.

## 10. Risques et points de vigilance

- **La bascule coupe la v1** (décision 1). Elle est instantanée côté base, mais l'appli et les fonctions doivent être déployées dans la foulée.
- **Les statistiques de production peuvent différer** des données de test : d'où la répétition générale avec `ROLLBACK` (phase 3) avant la vraie bascule. Elle donnera le nombre exact de valeurs écartées.
- **Strava envoie des notifications** (webhook) à tout moment : prévoir qu'une notification perdue pendant la fenêtre sera rattrapée par la synchro suivante.
- **Vault** : les fonctions `rpc_*` s'appuient sur `vault.decrypted_secrets`, à valider sur le vrai projet (le test local utilise une doublure).
- **Un revers** : plus de tables (31) donc plus de jointures ; elles sont toutes indexées sur `(user_id, …)` et la taille des données reste modeste (5 000 activités).
- **Ce n'est pas indispensable maintenant** : les correctifs rapides (§ 0) règlent les sujets de sécurité et de gaspillage. La V2 apporte la **propreté durable** et la place pour grandir.
