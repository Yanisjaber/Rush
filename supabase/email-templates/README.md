# Modèles d'e-mails Rush (Supabase Auth)

Un fichier HTML par e-mail, au style « Tous tes sports » (bannière `app/public/_mail/hero-2.png`, servie par le site à
`https://yanisjaber.github.io/Rush/_mail/hero-2.png`). L'objet de chaque e-mail est dans `sujets.json`.

À copier dans Supabase : Authentication > Emails > Templates (objet + corps, onglet « Source »).
Les variables `{{ .ConfirmationURL }}`, `{{ .Token }}` et `{{ .Email }}` sont remplacées par Supabase : ne pas les toucher.

**Confirm signup (changé le 14 nov. 2026)** : l'e-mail contient un **code à 6 chiffres** (`{{ .Token }}`), plus de lien. L'app mobile le demande à l'écran « Créer un compte ». Le code est valable 1 heure (réglage Supabase : Authentication > Sign In / Providers > Email > « Email OTP Expiration », 3600 s ; longueur 6). Garder « Confirm email » activé.
HTML d'e-mail : tableaux et styles écrits sur chaque élément, aucune police personnalisée (Impact / Arial).
