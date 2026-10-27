# Calendrier natif : ce qui reste à faire

Liste tenue à jour avec Yanis (écran `native/app/(onglets)/calendrier.tsx`). Dernière mise à jour : 27 octobre 2026.

## Fait récemment

- **Rouvrir une séance prévue ou une compétition** (27 octobre) : toucher la ligne ouvre une fiche en lecture (`app/prevue.tsx` : chiffres, profil et blocs, parcours GPX avec carte, notes) avec **Modifier** (le formulaire de création, déjà rempli, `?id=`) et **Supprimer** (avec confirmation). Marche aussi dans la démo (en mémoire). Pas encore vu à l'écran.

- **Légende et « Réessayer »** (27 octobre) : une petite phrase sous la grille (« Que signifient les points ? ») qui ouvre le détail de toutes les marques ; 4 points au plus par jour, sinon 3 et « +N » ; le message d'erreur a un bouton « Réessayer ». Le football est dans le catalogue (type `Soccer`, groupe « Raquettes et balles ») ; les autres sports collectifs (rugby, basket…) restent « Autre sport ».
- **Bulle de la semaine** (27 octobre) : toucher la colonne « Sem. » ouvre une bulle accrochée à la colonne (temps, charge, séances, km, sept barres). Aussi : menu du « + » en liste à trois groupes avec glissement pour fermer, bouton « + Ajouter » en verre liquide (iOS 26), repos (lune dans la case, ligne « Jour de repos · Retirer » dans le détail), logo du sport dans la ligne de détail d'une séance, « 0h00 » pour une semaine vide, et accueil d'un compte neuf (« Rien encore. Normal. »).
- **Colonne « Sem. »** (27 octobre, décidé avec Yanis) : elle montre la semaine entière, même quand elle déborde sur le mois voisin ; les pastilles du haut, elles, ne comptent que le mois. On garde ça.
- **Fait et prévu dans les totaux** (27 octobre, décidé avec Yanis) : le temps et les kilomètres (ou séries) d'une semaine et de la carte du sport ne comptent que le fait ; une semaine pas encore commencée montre le prévu. Les petites barres de la colonne gardent le fait et le prévu (prévu en pâle).

- **Notes de santé détaillées** (24 octobre) : quatre types (Note, Maladie, Blessure, Indisponible) avec des menus déroulants propres à chacun (nom de la maladie, symptômes à cocher, gravité ; zone du corps avec silhouette, côté, nature, douleur ; motif, lieu), une feuille calendrier pour la période, et un petit logo par type sur les jours du calendrier (deux au plus par case). Toucher une note ouvre une fenêtre de détail. Code : `src/data/sante-notes.ts`, `ChampsNote.tsx`, `ChampPeriode.tsx`, `LogoNote.tsx`. Migration `2026-10-24_day_notes_details.sql` (colonne `details`, type `indisponible`) appliquée sur la vraie base le 24 octobre. Pas fait : la blessure « en cours » sans date de fin.
- **Import d'une activité depuis un fichier** (24 octobre) : « Importer » remplace « Modèle » dans le « + ». Un fichier `.fit`, `.gpx` ou `.tcx` s'ouvre dans un pop-up (carte Apple, profil d'altitude, six chiffres) avec Enregistrer, Modifier ou Annuler. Les flux (gzip), la trace GPX, les tours (colonne `lap_details`, migration appliquée) et les chiffres de résumé partent avec l'activité. Code : `src/data/import-activite.ts`, `apercu-import.ts`, `app/ajout-import.tsx`, `ApercuImport.tsx`. L'écran Modèles existe toujours mais n'a plus d'entrée.
- **Compétition refaite** (24 octobre) : dossard qui se remplit en haut, trois onglets (Épreuve, Parcours, Objectif) avec heure de départ, fédération, niveau, format de triathlon, temps cible, GPX, charge, effort, notes. Logique : `src/data/competition.ts`.
- **Durée à roues, charge et clavier** (24 octobre) : la durée se choisit sur les roues d'Apple (activité déjà faite et séance prévue), « Charge (pts) » existe sur l'activité déjà faite, le sport s'ouvre sur celui de la barre du haut, toucher hors d'un champ ferme le clavier.
- **Migration des cycles appliquée** (24 octobre) sur la vraie base (testée en local avant).

- **Le « + » refait** (23 octobre) : un menu (séance prévue, sortie déjà faite, modèle, compétition, note, cycle, repos) et un écran par ajout : `ajout-seance` (avec blocs, profil par zones, durée et charge calculées), `ajout-sortie` (écrite dans `activities` en source manuelle), `ajout-modeles` (liste, recherche, filtre par sport, pose sur le jour), `ajout-competition`, `ajout-note`, et l'écran Cycle. Le repos se pose d'un toucher depuis le menu. Calcul des blocs porté du site : `src/data/structure.ts`.

- **Notes et repos** (23 octobre) : toucher une note ouvre une feuille pour la modifier ou la supprimer (`FeuilleNote.tsx`) ; le bouton « Repos » du détail du jour pose ou retire un jour de repos d'un toucher. Démo en mémoire, compte dans `day_notes` et `rest_day`.

## Reste à faire (pas encore tranché)

- **Le thème clair** : jamais vérifié sur le calendrier (bandes teintées, colonne « Sem. », pastilles, jours des mois voisins).

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

- Rien en attente : l'écran qui relit les séances prévues (lecture, modification) existe depuis le 27 octobre (`app/prevue.tsx`).
