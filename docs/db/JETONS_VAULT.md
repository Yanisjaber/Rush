# Jetons Strava et Garmin : chiffrés dans Supabase Vault

> Réponse à **SEC-1** de l'[audit](AUDIT_2026-10-13.md) : les jetons étaient lisibles en clair dans `connexions_app`.

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
| `supabase/proposals/jetons-vault/2_purge.sql` | **Phase 2** : arrête l'écriture en clair et **efface** le clair (garde-fou : refuse si une connexion n'a pas de secret) |
| `supabase/proposals/jetons-vault/9_retour_arriere.sql` | remet le clair depuis le coffre si la phase 2 doit être annulée |
| `supabase/functions/_shared/jetons.ts` | lecture/écriture des jetons pour les Edge Functions |
| `strava-ingest`, `strava-streams`, `strava-webhook`, `strava-oauth-callback`, `strava-laps`, `delete-account` | modifiées pour utiliser le module (`disconnect-integration` n'a rien à changer : le déclencheur s'en charge) |
| `tools/garmin_sync.py` | le Pi lit/écrit les jetons Garmin via le coffre |

## Ordre de bascule (aucune coupure)

1. **Appliquer la phase 1** (SQL). Les anciennes fonctions continuent de marcher : le clair est toujours là et tenu à jour.
2. **Déployer les 6 Edge Functions** modifiées (`supabase functions deploy <nom>`).
3. **Mettre à jour le Pi** : `git pull` dans le dossier du projet sur le Raspberry Pi.
4. **Vérifier** : une synchro Strava, un import de tours, une synchro Garmin (bouton Synchroniser), la connexion Strava depuis la v2.
5. **Appliquer la phase 2** (`2_purge.sql`) : le clair est effacé. Contrôle : 0 jeton en clair.

Pourquoi deux phases : si on effaçait le clair avant que **toutes** les fonctions et le Pi soient à jour, l'une d'elles lirait un champ vide et casserait (par exemple les notifications Strava).

## Tests

- **Base** (`supabase/tests/jetons_vault.sql`, sur un Postgres local jetable) : 22 contrôles — chiffrement des jetons d'origine, repli en lecture, fusion à l'écriture (un renouvellement Strava ne renvoie pas tous les champs), un seul secret par connexion, suppression du secret avec la connexion et avec le compte, **un utilisateur connecté ou anonyme ne peut ni lire ni écrire les jetons ni lire Vault**, phase 2 (plus de clair, écriture sans clair, garde-fou).
- **Module des fonctions** (`supabase/tests/jetons.test.mts`) : 5 tests avec un faux client, dont « aucune erreur de la base n'est journalisée ».
- **Script du Pi** (`tools/test_garmin_jetons.py`) : 6 tests, dont le repli et le fait qu'une vraie erreur n'est pas avalée.
- Syntaxe des 8 fichiers TypeScript contrôlée.

## Ce qui ne peut pas être testé hors ligne

La chaîne réelle (Vault de production, Strava, Garmin) : d'où la phase de vérification (étape 4) **avant** d'effacer quoi que ce soit.
