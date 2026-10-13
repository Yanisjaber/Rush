# Nettoyage de la base : ce qui reste à faire

Rédigé le 2026-10-13. L'ancienne version de l'app a été retirée le même jour (archivée dans `archive-v1/`) : plus rien ne lit ces données.
**Rien de ceci n'est encore fait.** Chaque ligne dit quoi retirer, pourquoi, et ce qu'il faut vérifier avant. Toujours : tester en local (`supabase/proposals/db-v2/tests/local_pg.sh`),
sauvegarder ce qui est supprimé hors dépôt, appliquer en production seulement sur demande de Yanis.

Déjà fait le 13/10/2026 : fusion de `profiles` dans `user_profiles`, retrait des colonnes de jetons en clair de `connexions_app`,
`user_dashboard` devenu `user_preferences` (avec le thème), clés `null` de `user_profiles.extras` retirées.

## 1. Doublons de nom dans `user_profiles`
| Quoi | Pourquoi | À vérifier avant |
|---|---|---|
| colonne `display_name` | le même prénom existe dans `extras.first_name` ; seul l'accueil lit encore `display_name` | faire lire `first_name` à l'accueil (`app/src/routes/Accueil.svelte`, ligne ~113) et à `auth.svelte.js` (inscription) ; retirer l'écriture dans `data/profil.js` ligne ~188 |
| `extras.full_name` | prénom + nom, calculable à l'affichage | `lirePrenom` dans `data/profil.js` |

## 2. Anciennes tables que plus aucun code ne lit
| Table | Lignes (13/10) | Contenu | Quand la retirer |
|---|---|---|---|
| `preferences` | 0 | clé/valeur générique de l'ancienne version | maintenant : plus rien ne la lit, aucune donnée à perdre |
| `od_prefs` | 1 | anciens réglages Open Dossard (`overrides`, `hidden`) | maintenant : l'app ne la lit pas ; garder une copie des 1 ligne avant de supprimer, ou la fusionner dans `user_preferences` |

## 3. `strava_athlete_id` dans `user_profiles`
Doublon de `connexions_app.external_id`. Lu par 3 Edge Functions : `strava-oauth-callback`, `strava-webhook`, `disconnect-integration`.
Plan : faire lire `external_id` à ces trois fonctions, les redéployer, tester avec une vraie synchro et un événement du webhook, puis retirer la colonne.

## 4. Tables et colonnes d'anciens systèmes
À re-vérifier à ce moment-là (lignes et lecteurs) : `garmin_sync_requests` (inutilisée depuis le retrait du Raspberry Pi), `garmin_sleep` (18 nuits importées :
à garder tant que l'accès officiel Garmin n'est pas là), anciennes tables de connexions (`strava_connections`, `whoop_connections`) si elles existent encore.

## 5. Ce qui ne bouge pas
`ftp`, `hr_max`, `lthr`, `weight` restent des colonnes de `user_profiles` (utilisées partout). La grande séparation « identité / physiologie / connexions »
décrite dans `PROPOSITION_V2.md` (proposition d'une base remaniée) est un chantier à part, à décider plus tard.
