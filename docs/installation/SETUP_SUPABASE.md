# Supabase pour Rush : réglages et mise en route

Le projet Supabase de Rush **existe déjà** (Europe, plan gratuit). Ce guide dit ce qui est réglé, où, et comment s'y reconnecter. Il ne sert pas à recréer la base de zéro : le journal des migrations ne se rejoue pas sur une base vide (voir `docs/db/LISEZMOI_MIGRATIONS.md`).

## 1. Les clés (ce qui est public, ce qui ne l'est pas)

| Clé | Où | Public ? |
|---|---|---|
| URL du projet + clé « publishable » (ex-« anon ») | `app/src/lib/config.js` | **Oui**, par conception : c'est la RLS qui protège les données |
| Clé `service_role` / clé secrète (`sb_secret_…`) | secrets des Edge Functions, jamais ailleurs | **Non, jamais** dans le code, un commit, un log ou une réponse |

Où les retrouver : Supabase › Project Settings › API.

## 2. Authentification

Réglages dans Supabase › Authentication :

- **Inscription ouverte**, avec **confirmation par e-mail** activée.
- **E-mails** envoyés par **Brevo** (SMTP personnalisé). Avec un expéditeur Gmail, ils finissent souvent en spams : un domaine à toi règlerait ça.
- **Modèles d'e-mails** : `supabase/email-templates/` (à copier dans Authentication › Emails › Templates).
- **URL de redirection** : l'adresse du site (`https://yanisjaber.github.io/Rush/`) et `http://localhost:5173/` pour le développement. Si l'adresse du site change, la mettre à jour ici aussi (liste complète dans `CLAUDE.md`).

## 3. Les migrations (le schéma)

- Elles sont dans `supabase/migrations/` (`AAAA-MM-JJ_nom.sql`), relançables sans risque.
- On les applique **à la main**, une par une, dans l'ordre alphabétique :
  ```bash
  supabase db query --linked -f supabase/migrations/<fichier>.sql
  ```
- Avant de toucher à la vraie base, on teste en local sur un Postgres jetable (`supabase/tests/*.sh`, `supabase/proposals/db-v2/tests/local_pg.sh start|reset|psql`).
- Les anciens `schema.sql` et `schema_v2.sql` ont été supprimés (périmés). Le schéma de référence est `supabase/baseline/`.
- La liste des tables est dans `docs/db/MODELE_DONNEES.md`.

## 4. Les Edge Functions et leurs secrets

Les fonctions sont dans `supabase/functions/`. Les secrets (`supabase secrets set NOM=valeur`, vérifier avec `supabase secrets list`) :

| Secret | Pour qui |
|---|---|
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `APP_REDIRECT_URL` | connexion Strava (voir `DEPLOY_EDGE_FUNCTION.md`) |
| `STRAVA_WEBHOOK_VERIFY_TOKEN`, `STRAVA_WEBHOOK_SUBSCRIPTION_ID` | webhook Strava (voir `SETUP_STRAVA_WEBHOOK.md`) |
| `OPENDOSSARD_EMAIL`, `OPENDOSSARD_PASSWORD` | fonction `opendossard` |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement par Supabase.

Les jetons Strava des utilisateurs sont chiffrés dans **Vault** (voir `docs/db/JETONS_VAULT.md`), jamais en colonne.

## 5. Vérifier que ça marche

1. `cd app && npm ci && npm run dev` → http://localhost:5173
2. Connecte-toi (ou crée un compte : tu reçois l'e-mail de confirmation).
3. Ajoute une donnée (une note, une séance prévue) puis regarde Supabase › Table Editor : la ligne doit porter ton `user_id`.
4. Même compte sur l'app mobile (`native/`) : tu retrouves les mêmes données.

## Limites du plan gratuit

- 500 Mo de base : voir l'audit (`docs/db/AUDIT_2026-10-13.md`) pour la place prise par les courbes d'activités.
- Le projet est mis en pause après 7 jours sans activité (il se réveille quand tu reviens).
- 2 projets gratuits maximum par compte.

## Sécurité, en deux lignes

- Chaque utilisateur ne voit que ses lignes (`auth.uid() = user_id`) ; le rôle `anon` n'a accès à rien.
- Toute nouvelle table : RLS activée **dès la création**, avec ces mêmes policies.
