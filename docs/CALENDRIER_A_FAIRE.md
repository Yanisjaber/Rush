# Calendrier natif : ce qui reste à faire

Liste tenue à jour avec Yanis (écran `native/app/(onglets)/calendrier.tsx`). Dernière mise à jour : 23 octobre 2026.

## Repoussé à plus tard (décidé avec Yanis)

1. **Ouvrir une séance prévue** : la lire, la modifier, la supprimer. Aujourd'hui elle affiche « Bientôt ». Le site montre aussi ses blocs (structure) et son parcours GPX (`VuePrevue.svelte`, `PanneauPrevue.svelte`).
2. **Ouvrir une compétition** : voir son détail, la modifier, la supprimer. Elle s'affiche dans le détail du jour mais n'est pas touchable (le site : `PanneauCompetition.svelte`, route Compétitions).

## Fait récemment

- **Le « + » refait** (23 octobre) : un menu (séance prévue, sortie déjà faite, modèle, compétition, note, cycle, repos) et un écran par ajout : `ajout-seance` (avec blocs, profil par zones, durée et charge calculées), `ajout-sortie` (écrite dans `activities` en source manuelle), `ajout-modeles` (liste, recherche, filtre par sport, pose sur le jour), `ajout-competition`, `ajout-note`, et l'écran Cycle. Le repos se pose d'un toucher depuis le menu. Calcul des blocs porté du site : `src/data/structure.ts`.

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

- **Appliquer `supabase/migrations/2026-10-22_training_cycles.sql`** : sans elle les cycles ne marchent pas sur un vrai compte (la démo marche). Elle contient aussi la colonne `sport` des cycles (facultative : sans sport, un cycle concerne tous les sports) ; relançable sans risque, y compris si la table existe déjà sans cette colonne (testé sur la base locale jetable). Commande : voir la mémoire « Accès Supabase via .env ».

## Autres chantiers ouverts (hors calendrier)

- **Étiquetage des tours Hyrox** (table `hyrox_efforts` prête) : un tour par run et par station, ou aussi les repos ? le nom seul, ou aussi la charge et les répétitions ?
- **Où mettre l'accès aux écrans de cycles** : l'écran `cycles` (liste) n'a plus de bouton depuis la refonte de l'en-tête ; on y accède seulement en touchant un cycle dans le détail d'un jour. Les créations passent par le « + ».

## À reconstruire (une fois, par Yanis)

- Deux paquets natifs ajoutés le 23 octobre : `@react-native-community/datetimepicker` 9.2.1 (sélecteurs de date et d'heure du système) et `expo-document-picker` 58.0.4 (choix d'un fichier GPX). Tant que l'app de développement n'est pas reconstruite (`npx expo run:ios`, sur le téléphone : `npx expo run:ios --device`), les écrans retombent sur les sélecteurs de secours (date en calendrier maison, heure saisie à la main, GPX : message « nouvelle version nécessaire »). Pour Android (Samsung) : le code est prêt, il reste à générer le dossier `android/` (`npx expo run:android`) et à fixer le nom de paquet, aujourd'hui provisoire (`TODO.rush`).

## Ménage à faire (demande d'accord de Yanis)

- `native/src/components/FeuilleAjout.tsx` (l'ancienne feuille du « + » à onglets) n'est plus utilisée nulle part : à supprimer avec l'accord de Yanis.
- Les séances prévues créées avec des blocs gardent leur structure ; l'écran qui les relit (lecture, modification) reste à faire (ligne 1 de « Repoussé »).
