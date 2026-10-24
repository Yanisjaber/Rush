# Calendrier natif : ce qui reste à faire

Liste tenue à jour avec Yanis (écran `native/app/(onglets)/calendrier.tsx`). Dernière mise à jour : 24 octobre 2026.

## Repoussé à plus tard (décidé avec Yanis)

1. **Ouvrir une séance prévue** : la lire, la modifier, la supprimer. Aujourd'hui elle affiche « Bientôt ». Le site montre aussi ses blocs (structure) et son parcours GPX (`VuePrevue.svelte`, `PanneauPrevue.svelte`).
2. **Ouvrir une compétition** : voir son détail, la modifier, la supprimer. Elle s'affiche dans le détail du jour mais n'est pas touchable (le site : `PanneauCompetition.svelte`, route Compétitions).

## Fait récemment

- **Import d'une activité depuis un fichier** (24 octobre) : « Importer » remplace « Modèle » dans le « + ». Un fichier `.fit`, `.gpx` ou `.tcx` s'ouvre dans un pop-up (carte Apple, profil d'altitude, six chiffres) avec Enregistrer, Modifier ou Annuler. Les flux (gzip), la trace GPX, les tours (colonne `lap_details`, migration appliquée) et les chiffres de résumé partent avec l'activité. Code : `src/data/import-activite.ts`, `apercu-import.ts`, `app/ajout-import.tsx`, `ApercuImport.tsx`. L'écran Modèles existe toujours mais n'a plus d'entrée.
- **Compétition refaite** (24 octobre) : dossard qui se remplit en haut, trois onglets (Épreuve, Parcours, Objectif) avec heure de départ, fédération, niveau, format de triathlon, temps cible, GPX, charge, effort, notes. Logique : `src/data/competition.ts`.
- **Durée à roues, charge et clavier** (24 octobre) : la durée se choisit sur les roues d'Apple (activité déjà faite et séance prévue), « Charge (pts) » existe sur l'activité déjà faite, le sport s'ouvre sur celui de la barre du haut, toucher hors d'un champ ferme le clavier.
- **Migration des cycles appliquée** (24 octobre) sur la vraie base (testée en local avant).

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

## À débloquer côté base

Rien en attente : les migrations `2026-10-22_training_cycles.sql` et `2026-10-23_lap_details.sql` sont appliquées.

## Import et compétition : la suite

- **Compétition : course par étapes et segments du triathlon** (onglets Natation, T1, Vélo, T2, Course). Deux gros chantiers à part (données par étape dans la colonne JSON `stages`).
- **Ouvrir une activité importée** : le détail d'une séance n'affiche pas encore les flux, la trace sur carte ni les tours enregistrés. Le calcul de la courbe de puissance (`power_curve`) n'est pas fait pour les imports.
- **Charge d'un import** : le TSS reste estimé (durée et effort 5) ; avec la puissance normalisée et la FTP on pourrait le calculer juste.
- **Retrouver ce qui manque** : Yanis a signalé que des sorties manquent à l'écran, sans préciser où ni lesquelles (Strava ou saisies ?). À reprendre : écran concerné, filtre de sport, fenêtre de dates, limite de chargement.
- **Connexion** : la saisie ne passait plus dans le simulateur (touches qui sélectionnent le texte, piste : modificateur coincé du clavier Mac). Pas confirmé. À surveiller ; l'AutoFill iOS est actif.
- **Vérifier le thème clair** sur le pop-up d'import, la compétition et le dossard.
- **Sur Android** : la carte demande une clé Google Maps (sur iPhone, Apple Plans, rien à régler). Le choix de durée passe par l'horloge d'Android.
- **Petits points** : roues de durée plafonnées à 23 h 59 ; durée de l'import arrondie à la minute ; renommer les fichiers `ajout-sortie` en « activité » ; sauter automatiquement sur l'onglet de l'erreur dans Compétition ; photo de fond fondue dans le bandeau du pop-up (idée en attente d'une photo) ; vélo « épais » partout si on l'aime (il n'est que dans le pop-up).

## Autres chantiers ouverts (hors calendrier)

- **Étiquetage des tours Hyrox** (table `hyrox_efforts` prête) : un tour par run et par station, ou aussi les repos ? le nom seul, ou aussi la charge et les répétitions ?
- **Où mettre l'accès aux écrans de cycles** : l'écran `cycles` (liste) n'a plus de bouton depuis la refonte de l'en-tête ; on y accède seulement en touchant un cycle dans le détail d'un jour. Les créations passent par le « + ».

## À reconstruire (une fois, par Yanis)

- **Le simulateur est reconstruit** (24 octobre) avec les paquets natifs `@react-native-community/datetimepicker` 9.2.1, `expo-document-picker` 58.0.4 et `react-native-maps` 1.29.11. **Le téléphone reste à reconstruire** (`npx expo run:ios --device`) : sans ça, la carte retombe sur une trace sans fond de carte et les sélecteurs sur leurs secours. Rappel de ce qui se passe tant que l'app de développement n'est pas reconstruite (`npx expo run:ios`, sur le téléphone : `npx expo run:ios --device`), les écrans retombent sur les sélecteurs de secours (date en calendrier maison, heure saisie à la main, GPX : message « nouvelle version nécessaire »). Pour Android (Samsung) : le code est prêt, il reste à générer le dossier `android/` (`npx expo run:android`) et à fixer le nom de paquet, aujourd'hui provisoire (`TODO.rush`).

## Ménage à faire (demande d'accord de Yanis)

- Les séances prévues créées avec des blocs gardent leur structure ; l'écran qui les relit (lecture, modification) reste à faire (ligne 1 de « Repoussé »).
