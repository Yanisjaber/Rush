# Jetons Strava et Garmin : chiffrés dans Supabase Vault

> Réponse à **SEC-1** de l'[audit](AUDIT_2026-10-13.md) : les jetons étaient lisibles en clair dans `connexions_app`.

> **État actuel (28/10/2026)** : seul Strava est connecté (le Raspberry Pi et Garmin ont été retirés le 13/10), il n'y a plus de « repli en clair » et plus aucune colonne de jeton. Les Edge Functions concernées passent toutes par `_shared/jetons.ts`. Le reste de ce document garde l'historique des phases de la migration : les mentions du Pi, du repli et de l'écriture double sont du passé.

## Ce qui change

| Avant | Après |
|---|---|
| `connexions_app.access_token` / `refresh_token` / `oauth1_*` en clair | un **secret chiffré** dans Vault, pointé par `connexions_app.secret_id` |
| 7 Edge Functions lisent et écrivent la table directement | elles passent par 2 fonctions SQL réservées au serveur : `rpc_connection_secrets`, `rpc_save_connection_secrets` (module `_shared/jetons.ts`) |
| le Pi lit la table | le Pi appelle ces mêmes fonctions (repli automatique sur l'ancien emplacement si la migration n'est pas appliquée) |
| déconnexion / suppression de compte : le secret resterait | un déclencheur **supprime le secret chiffré** avec la connexion |

Le navigateur ne lit toujours **aucun** jeton (droits par colonne inchangés) et ne voit pas `secret_id`.

## Fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/2026-10-14_jetons_vault_1_ajout.sql` | **Phase 1** : ajoute le coffre à côté de l'existant (écriture double, repli en lecture), chiffre les 4 connexions actuelles |
| `supabase/migrations/2026-10-14_jetons_vault_2a_purge_strava.sql` | **Phase 2a (appliquée)** : efface le clair des jetons **Strava** et arrête de l'écrire (garde-fou : refuse si un secret manque) |
| `supabase/migrations/2026-10-14_jetons_vault_2b_fin.sql` | **Phase 2b (appliquée)** : plus aucun clair, pour aucune connexion |
| `9_retour_arriere.sql` (supprimé, récupérable dans l'historique git : `supabase/proposals/jetons-vault/`) | remettait le clair depuis le coffre si la phase 2 devait être annulée |
| `supabase/functions/_shared/jetons.ts` | lecture/écriture des jetons pour les Edge Functions |
| `strava-ingest`, `strava-streams`, `strava-webhook`, `strava-oauth-callback`, `strava-laps`, `delete-account` | modifiées pour utiliser le module (`disconnect-integration` n'a rien à changer : le déclencheur s'en charge) |
| ~~`tools/garmin_sync.py`~~ | supprimé avec l'intégration Garmin (13/10/2026) |

## Ordre de bascule (aucune coupure) et avancement

1. ✅ **Phase 1 appliquée** (13/10/2026) : le coffre est ajouté à côté de l'existant ; les 4 connexions sont chiffrées.
2. ✅ **6 Edge Functions déployées**, vérifiées avec le vrai compte : synchro Strava complète, tours, courbes, `delete-account`.
3. ✅ **Phase 2a appliquée** : le clair Strava est effacé. Vérifié ensuite avec un **renouvellement de jeton forcé** : écriture uniquement dans le coffre, clair toujours effacé, aucun doublon de secret.
4. ✅ **Garmin supprimé** (13/10/2026, décision de Yanis : le Pi ne servait que lui, l'intégration passera par l'accès officiel de Garmin) : connexion, jeton chiffré, demandes de synchro et scripts du Pi retirés. La mise à jour du Pi n'a donc plus lieu d'être.
5. ✅ **Phase 2b appliquée** (`2026-10-14_jetons_vault_2b_fin.sql`) : plus aucun jeton n'est jamais écrit en clair, pour aucune connexion. Contrôle : 0 jeton en clair, 3 secrets (Strava) dans le coffre.
6. ⏳ Observer un événement du webhook Strava (nouvelle activité) et la prochaine connexion Strava : non déclenchables par Claude.

Pourquoi en plusieurs temps : effacer le clair avant que **toutes** les fonctions et le Pi soient à jour ferait lire un champ vide à l'une d'elles. Les jetons Strava n'avaient plus d'ancien lecteur, pas Garmin (le Pi a encore l'ancien code tant qu'il n'a pas fait `git pull`).

## Tests

- **Base** (`supabase/tests/sql/jetons_vault.sql`, sur un Postgres local jetable) : 26 contrôles — chiffrement des jetons d'origine, repli en lecture, fusion à l'écriture (un renouvellement Strava ne renvoie pas tous les champs), un seul secret par connexion, suppression du secret avec la connexion et avec le compte, **un utilisateur connecté ou anonyme ne peut ni lire ni écrire les jetons ni lire Vault**, phases 2a et 2b (clair Strava effacé et Garmin conservé tant que le Pi n'est pas à jour, puis plus aucun clair, écritures sans clair, garde-fou).
- **Module des fonctions** (`supabase/tests/edge/jetons.test.mts`) : 5 tests avec un faux client, dont « aucune erreur de la base n'est journalisée ».
- Syntaxe des 8 fichiers TypeScript contrôlée.

## Ce qui ne peut pas être testé hors ligne

La chaîne réelle (Vault de production, Strava, Garmin) : d'où la phase de vérification (étape 4) **avant** d'effacer quoi que ce soit.

## Étape finale (13/10/2026) : colonnes en clair supprimées
Les colonnes `access_token`, `refresh_token`, `oauth1_token`, `oauth1_secret` de `connexions_app` (vides depuis la phase 2b) ont été supprimées (`supabase/migrations/2026-10-14_jetons_vault_3_colonnes_mortes.sql`, testée en local par `supabase/tests/sql/jetons_colonnes_mortes.sh`). Les deux fonctions `rpc_connection_secrets` / `rpc_save_connection_secrets` ne gardent plus de « repli en clair ». Le retour arrière de la phase 2 (`9_retour_arriere.sql`) n'est plus applicable tel quel.
