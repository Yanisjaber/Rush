# Documentation Rush

Tous les `.md` du projet sont ici, rangés par thème. Exceptions : `CLAUDE.md` (racine, lu par Claude Code), `supabase/email-templates/README.md` (avec les modèles d'e-mails) et `archive-v1/LISEZMOI.md` (archive).

## À faire
- `A_FAIRE.md` : la liste unique de ce qui reste à faire (cases à cocher, tenue par Yanis et Claude).

## Formules
- `FORMULES.md` : toutes les formules de calcul (TSS, CTL/ATL/TSB, FTP glissante, niveau global à vélo en 4 piliers : puissance, endurance, répétabilité, charge).

## `db/` — base de données
- `MODELE_DONNEES.md` : tables, colonnes, RLS (la référence du schéma).
- `LISEZMOI_MIGRATIONS.md` : comment fonctionne le journal `supabase/migrations/` et ses limites.
- `JETONS_VAULT.md` : jetons OAuth chiffrés dans Supabase Vault.
- `AUDIT_2026-10-13.md` puis `AUDIT_2026-10-27_SUIVI.md` : audits de la base et suivi point par point.

## `ia/` — IA de Rush
- `CADRAGE_IA.md` : décisions sur le chatbot, les cartes de séances, la validation, le modèle et le prix, les erreurs, l'ordre de construction.

## `installation/` — guides pas à pas
- `SETUP_SUPABASE.md` : réglages du projet Supabase (clés, auth, migrations, secrets).
- `DEPLOY_EDGE_FUNCTION.md` : connexion Strava (`oauth-start` et `strava-oauth-callback`).
- `SETUP_STRAVA_WEBHOOK.md` : recevoir les activités Strava en temps réel.

## `ia/` — le coach IA
- `IA_A_FAIRE.md` : tout ce qui reste à faire sur le coach (profil du coureur, règles sans source, sources à vérifier, essais).
- [ia/ANALYSE_SORTIE.md](ia/ANALYSE_SORTIE.md) : la page 4 de la sortie, le retour du coach écrit par l'IA
- `FONDEMENTS_PLAN_COURSE.md` : chaque paramètre du moteur de plan de course face à la recherche.
- `CADRAGE_IA.md`, `PLAN_COACH_COMPLET.md`, `REPLANIFICATION.md` : cadrage et plans du coach.

## `native/` — app mobile
- `IDENTITE.md` : charte visuelle de l'app native.
- `CALENDRIER_A_FAIRE.md` : ce qui reste à faire sur le calendrier natif.
- `PROGRESSION_VELO.md` : comment l'onglet Progrès décide pour le vélo (calcul, tests sur de vraies sorties, limites).
- `PROGRESSION_COURSE.md` : la même chose pour la course (dénivelé, tapis, ce que les vraies courses ont montré).
- `PROGRESSION_NIVEAU.md` : le score de niveau année après année (100 = meilleur niveau), les records, et le bouton « Comment c'est calculé ».
- `EVALUATION_PROFIL.md` : la page Profil en planche anatomique, les 8 domaines, la note sur 100 (meilleur mondial), d'où vient chaque valeur et les références.
- `DONNEES_ECARTEES.md` : les puces « Compte dans mes calculs » d'une activité (puissance, cardio, cadence, distance, dénivelé, charge) et ce que chaque donnée écartée retire des calculs.
- `SYNCHRO_STRAVA.md` : l'écran de synchro des courbes de puissance (calcul par lots, temps de calcul et pauses Strava séparés).
