# Nettoyage de la base à faire quand la v1 (`/v1/`) sera retirée

Rédigé le 2026-10-13. **Rien de ceci n'est fait** : la v1 sert encore de secours et lit certaines de ces données.
Chaque ligne dit quoi retirer, pourquoi, et ce qu'il faut vérifier avant. Toujours : tester en local (`supabase/proposals/db-v2/tests/local_pg.sh`),
sauvegarder ce qui est supprimé hors dépôt, appliquer en production seulement sur demande de Yanis.

Déjà fait le 13/10/2026 : fusion de `profiles` dans `user_profiles`, retrait des colonnes de jetons en clair de `connexions_app`,
`user_dashboard` devenu `user_preferences` (avec le thème), clés `null` de `user_profiles.extras` retirées.

## 1. Doublons de nom dans `user_profiles`
| Quoi | Pourquoi | À vérifier avant |
|---|---|---|
| colonne `display_name` | le même prénom existe dans `extras.first_name` ; la v1 et l'accueil v2 lisent `display_name` | faire lire `first_name` à l'accueil (`Accueil.svelte` ligne ~113) et à `auth.svelte.js` (inscription) ; retirer l'écriture dans `data/profil.js` ligne ~188 |
| `extras.full_name` | prénom + nom, calculable à l'affichage | v1 (`profile-modal.js`) et `lirePrenom` dans `data/profil.js` |

## 2. Tables lues seulement par la v1
| Table | Lignes (13/10) | Contenu | Quand la retirer |
|---|---|---|---|
| `preferences` | 0 | clé/valeur générique (`storage-adapter.js` de la v1) | dès que la v1 est retirée ; sinon rien à perdre |
| `od_prefs` | 1 | réglages Open Dossard de la v1 (`overrides`, `hidden`) | vérifier que la v2 n'en a pas besoin (elle ne la lit pas aujourd'hui) ; sinon fusionner dans `user_preferences` |

## 3. `strava_athlete_id` dans `user_profiles`
Doublon de `connexions_app.external_id`. Lu par 3 Edge Functions : `strava-oauth-callback`, `strava-webhook`, `disconnect-integration`.
Plan : faire lire `external_id` à ces trois fonctions, les redéployer, tester avec une vraie synchro et un événement du webhook, puis retirer la colonne.

## 4. Tables et colonnes d'anciens systèmes
À re-vérifier à ce moment-là (lignes et lecteurs) : `garmin_sync_requests` (inutilisée depuis le retrait du Raspberry Pi), `garmin_sleep` (18 nuits importées :
à garder tant que l'accès officiel Garmin n'est pas là), anciennes tables de connexions (`strava_connections`, `whoop_connections`) si elles existent encore.

## 5. Ce qui ne bouge pas
`ftp`, `hr_max`, `lthr`, `weight` restent des colonnes de `user_profiles` (utilisées partout). La grande séparation « identité / physiologie / connexions »
de la base V2 (voir `PROPOSITION_V2.md`) est un chantier à part, à décider après le retrait de la v1.
