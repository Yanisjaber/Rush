# Connexion Strava : déployer les Edge Functions

Tu fais ça **une seule fois** (puis à chaque modif du code des fonctions). Ensuite tout tourne sur Supabase, 24h/24.

## Comment ça marche (pour comprendre)

1. Dans l'app, tu touches « Connecter Strava ». Le site appelle `oauth-start` (avec ta session) : la fonction crée un **`state` aléatoire à usage unique** (table `oauth_states`, valable 10 minutes) lié à ton compte. Aucun JWT ne circule dans l'adresse.
2. Le site t'envoie chez Strava avec ce `state`.
3. Strava te renvoie vers `strava-oauth-callback` avec un `code` et le `state`.
4. La fonction consomme le `state` (il disparaît), échange le `code` contre les jetons (avec le `client_secret`, qui reste côté serveur), enregistre la connexion dans `connexions_app` et **chiffre les jetons dans Vault**, puis te ramène sur l'app avec `?strava_connected=1`.

Deux fonctions : **`oauth-start`** (avec JWT) et **`strava-oauth-callback`** (sans JWT : Strava n'en envoie pas, l'identité vient du `state`).

## 1. Installer la CLI Supabase et se connecter

```bash
brew install supabase/tap/supabase
supabase login
cd ~/Developer/coachia
supabase link --project-ref gfavgstyyaaidkpadkxz
```

(Le mot de passe de la base est demandé au `link` ; il se réinitialise dans Supabase › Settings › Database.)

## 2. Définir les secrets

```bash
supabase secrets set STRAVA_CLIENT_ID=248376
supabase secrets set STRAVA_CLIENT_SECRET=<TON_STRAVA_CLIENT_SECRET>
supabase secrets set APP_REDIRECT_URL=https://yanisjaber.github.io/Rush/
```

- Le `client_secret` est dans ton `.env` local (ignoré par git). **Jamais** dans un commit, une réponse ou un log. S'il fuite : https://www.strava.com/settings/api › « Reset Client Secret ».
- `APP_REDIRECT_URL` est l'adresse de repli ; les retours autorisés sont une liste blanche exacte dans `supabase/functions/_shared/oauth-state.ts` (site en ligne + `http://localhost:5173/`).
- Vérifier : `supabase secrets list`.

## 3. Déployer

```bash
supabase functions deploy oauth-start
supabase functions deploy strava-oauth-callback --no-verify-jwt
```

`--no-verify-jwt` uniquement pour le callback (Strava appelle sans en-tête d'authentification).

## 4. Déclarer le domaine chez Strava

https://www.strava.com/settings/api › **Authorization Callback Domain** :

```
gfavgstyyaaidkpadkxz.supabase.co
```

(juste le domaine, sans `https://` ni chemin.)

## 5. Tester

1. Lance le site en local (`cd app && npm run dev`) et connecte-toi avec un compte de test.
2. Paramètres › Connexions › **Connecter Strava**, autorise sur Strava.
3. Tu reviens sur l'app avec un message de succès.
4. Vérifie en base (Supabase › SQL Editor) :
   ```sql
   SELECT app, external_id, athlete_name, expires_at
   FROM connexions_app WHERE app = 'strava';
   ```
   Tu dois voir la connexion. Il n'y a **aucune colonne de jeton** : ils sont dans Vault (`docs/db/JETONS_VAULT.md`).

Pas de connexion Strava depuis l'app mobile : on passe par le site.

## Quelles fonctions existent

`oauth-start`, `strava-oauth-callback`, `strava-ingest`, `strava-webhook`, `strava-streams`, `strava-laps`, `disconnect-integration`, `delete-account`, `opendossard`. Elles sont dans `supabase/functions/` ; les parties communes dans `_shared/`.

`--no-verify-jwt` : seulement pour `strava-oauth-callback` et `strava-webhook` (appelées par Strava, sans JWT). Les autres se déploient sans ce drapeau.

## Mettre à jour une fonction après modif

```bash
supabase functions deploy <nom>            # ajoute --no-verify-jwt pour strava-oauth-callback et strava-webhook
```

## Logs (debug)

```bash
supabase functions logs <nom>
```

Ou Supabase › Edge Functions › la fonction › Logs.

## Désactiver une fonction

```bash
supabase functions delete <nom>
```
