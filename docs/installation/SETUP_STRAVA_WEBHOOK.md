# Webhook Strava : recevoir les activités en temps réel

Avec le webhook, Strava prévient Rush **dès qu'une activité est créée, modifiée ou supprimée**, au lieu d'attendre une synchro. Tu finis ta sortie, ta montre envoie à Strava, et l'activité apparaît dans Rush en quelques secondes.

## Architecture

```
Ta montre → Strava → POST → Edge Function strava-webhook → Supabase
                                          └→ récupère l'activité, l'écrit dans activities
                                             (le trigger SQL recalcule daily_metrics)
```

Le compte concerné est retrouvé grâce à l'identifiant d'athlète Strava (`connexions_app.external_id`). Les jetons sont lus dans Vault (`docs/db/JETONS_VAULT.md`).

## Pré-requis

La connexion Strava marche déjà (`DEPLOY_EDGE_FUNCTION.md`) : `STRAVA_CLIENT_ID` et `STRAVA_CLIENT_SECRET` sont donc définis.

## Étapes

### 1. Générer un `verify_token`

Une chaîne aléatoire, partagée entre Strava et la fonction :

```bash
openssl rand -hex 16
```

Garde-la : tu l'utilises aux étapes 2 et 4.

### 2. L'ajouter aux secrets Supabase

```bash
supabase secrets set STRAVA_WEBHOOK_VERIFY_TOKEN=<TA_CHAINE>
```

Sans ce secret, la fonction refuse la validation de Strava.

### 3. Déployer la fonction

```bash
supabase functions deploy strava-webhook --no-verify-jwt
```

`--no-verify-jwt` est obligatoire : Strava n'envoie pas de JWT.

### 4. Créer l'abonnement (UNE SEULE FOIS)

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=248376 \
  -F client_secret=<TON_STRAVA_CLIENT_SECRET> \
  -F callback_url=https://gfavgstyyaaidkpadkxz.supabase.co/functions/v1/strava-webhook \
  -F verify_token=<TA_CHAINE>
```

Strava fait alors un `GET` sur l'URL avec `hub.challenge` et `hub.verify_token` ; la fonction répond `{"hub.challenge": "..."}` si le token correspond. Strava te renvoie `{"id": <subscription_id>}` : **note cet id**.

### 5. Enregistrer l'id de l'abonnement (OBLIGATOIRE)

Strava ne signe pas ses events : la fonction ne traite que ceux qui portent **ton** `subscription_id`.

```bash
supabase secrets set STRAVA_WEBHOOK_SUBSCRIPTION_ID=<SUBSCRIPTION_ID>
```

**Sans ce secret, aucun event n'est traité** (ils sont ignorés et un message d'erreur est journalisé). Ce n'est plus optionnel : sinon n'importe qui pourrait envoyer de faux events et déclencher des appels à Strava.

Pour retrouver l'id plus tard :

```bash
curl -G https://www.strava.com/api/v3/push_subscriptions \
  -d client_id=248376 -d client_secret=<TON_STRAVA_CLIENT_SECRET>
```

### 6. Tester

Fais une petite activité sur Strava (ou modifie-en une depuis l'app Strava), puis vérifie :

- Supabase › Edge Functions › `strava-webhook` › Logs : un event reçu (le journal ne garde que le type et l'identifiant, rien de personnel) ;
- la ligne dans la table `activities` ;
- l'activité dans Rush, après un rafraîchissement.

## Que fait la fonction pour chaque event ?

| object_type | aspect_type | Action |
|---|---|---|
| activity | create | récupère l'activité, l'insère |
| activity | update | récupère l'activité, la met à jour (la charge peut changer) |
| activity | delete | supprime l'activité (seulement si Strava répond 404 pour elle) |
| athlete | update, `authorized = false` | supprime la connexion (après vérification auprès de Strava) |

La forme (CTL/ATL/TSB) est recalculée par le trigger SQL de la base.

## Se désabonner (si besoin)

```bash
curl -X DELETE \
  "https://www.strava.com/api/v3/push_subscriptions/<SUBSCRIPTION_ID>?client_id=248376&client_secret=<TON_STRAVA_CLIENT_SECRET>"
```

## Limites de Strava

- **Un seul abonnement actif par `client_id`.** Pour en recréer un, supprime d'abord l'ancien (puis mets à jour `STRAVA_WEBHOOK_SUBSCRIPTION_ID`).
- L'URL de rappel doit être en **HTTPS** (Supabase l'est).
- Strava attend une réponse en **moins de 2 secondes**, sinon il réessaie : la fonction répond tout de suite et travaille en arrière-plan.
- Les events arrivent pour **tous les utilisateurs** qui ont autorisé ton app Strava ; la fonction retrouve le bon compte par l'identifiant d'athlète.
- Un event perdu (par exemple pendant une panne) est rattrapé à la synchro suivante.
