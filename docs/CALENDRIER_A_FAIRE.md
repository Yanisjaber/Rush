# Calendrier natif : ce qui reste à faire

Liste tenue à jour avec Yanis (écran `native/app/(onglets)/calendrier.tsx`). Dernière mise à jour : 23 octobre 2026.

## Repoussé à plus tard (décidé avec Yanis)

1. **Ouvrir une séance prévue** : la lire, la modifier, la supprimer. Aujourd'hui elle affiche « Bientôt ». Le site montre aussi ses blocs (structure) et son parcours GPX (`VuePrevue.svelte`, `PanneauPrevue.svelte`).
2. **Ouvrir une compétition** : voir son détail, la modifier, la supprimer. Elle s'affiche dans le détail du jour mais n'est pas touchable (le site : `PanneauCompetition.svelte`, route Compétitions).
3. **Les modèles de séance** (table `activity_template`) : poser une séance type sur un jour (le site : `PanneauModeles.svelte`).
4. **Saisir une sortie déjà faite à la main** (« Sortie réalisée » sur le site). L'app ne lit que ce qui vient de Strava.
5. **La feuille du « + »** (séance prévue, compétition, note, cycle), à refaire en entier plus tard. La version actuelle (`FeuilleAjout.tsx`) fonctionne mais n'est pas définitive.

## Fait récemment

- **Notes et repos** (23 octobre) : toucher une note ouvre une feuille pour la modifier ou la supprimer (`FeuilleNote.tsx`) ; le bouton « Repos » du détail du jour pose ou retire un jour de repos d'un toucher. Démo en mémoire, compte dans `day_notes` et `rest_day`.

## Reste à faire (pas encore tranché)

- **Balayer pour changer de mois** : aujourd'hui seulement les flèches et le sélecteur de mois.
- **Une légende des points** : couleur = sport, rond vide = prévu, carré = compétition. Rien ne l'explique à l'écran.
- **Le thème clair** : jamais vérifié sur le calendrier (bandes teintées, colonne « Sem. », pastilles, jours des mois voisins).
- **Un état d'erreur avec « Réessayer »** : on a le tirer-pour-actualiser, mais le message d'erreur seul ne propose rien.
- **Toucher une semaine** (colonne « Sem. ») pour voir son détail jour par jour.
- **La colonne « Sem. » compte aussi les jours des mois voisins** (la dernière semaine d'un mois peut afficher des séances du mois suivant, alors que les pastilles du haut ne comptent que le mois). Choisir : garder ou ne compter que le mois affiché.
- **Les carrés de la carte du sport** (kilomètres ou séries) comptent le fait et le prévu ensemble, alors que « séances » et « de sport » ne comptent que le fait : choisir et aligner.

## À débloquer côté base (Yanis, avec `!`)

- **Appliquer `supabase/migrations/2026-10-22_training_cycles.sql`** : sans elle les cycles ne marchent pas sur un vrai compte (la démo marche). Commande : voir la mémoire « Accès Supabase via .env ».

## Autres chantiers ouverts (hors calendrier)

- **Étiquetage des tours Hyrox** (table `hyrox_efforts` prête) : un tour par run et par station, ou aussi les repos ? le nom seul, ou aussi la charge et les répétitions ?
- **Où mettre l'accès aux écrans de cycles** : l'écran `cycles` (liste) n'a plus de bouton depuis la refonte de l'en-tête ; on y accède seulement en touchant un cycle dans le détail d'un jour. Les créations passent par le « + ».
