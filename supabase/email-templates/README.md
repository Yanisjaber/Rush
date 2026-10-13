# Modèles d'e-mails Coach IA (Supabase Auth)

Un fichier HTML par e-mail, au style « Tous tes sports » (bannière `v2/public/_mail/hero-2.png`, servie par le site à
`https://yanisjaber.github.io/coach-ia/_mail/hero-2.png`). L'objet de chaque e-mail est dans `sujets.json`.

À copier dans Supabase : Authentication > Emails > Templates (objet + corps, onglet « Source »).
Les variables `{{ .ConfirmationURL }}` et `{{ .Email }}` sont remplacées par Supabase : ne pas les toucher.
HTML d'e-mail : tableaux et styles écrits sur chaque élément, aucune police personnalisée (Impact / Arial).
