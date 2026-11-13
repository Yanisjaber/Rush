# Grille des écrans de séance : type × sport (14 nov. 2026)

État réel de l'app mobile, relevé dans le code (`app/seance.tsx`, `app/prevue.tsx`, `app/(ajouts)/*`, `data/calendrier/*`).
Légende : **Complet** = écran pensé pour ce sport. **Générique** = l'écran existe mais c'est le même pour tous les sports, sans rien de propre à celui-ci. **Manque** = rien.

## Comment ça marche aujourd'hui

- **Séance réalisée** : un seul écran pour tous les sports (`seance.tsx`), en pages qu'on balaie : 1) carte (ou dossard sans GPS), 4 chiffres, profil d'altitude ; 2) courbes synchronisées, zones, tours ; 3) analyse du coach (course et vélo seulement) ; 4) détails, records (course et vélo seulement), notes, supprimer. Seul le **ski** a un morceau à lui (journal des descentes). Les 4 chiffres changent selon le sport (`quatre-chiffres.ts`).
- **Séance prévue et compétition** : un seul écran (`prevue.tsx`) : carte du GPX ou dessin du sport, 4 chiffres, blocs de la séance. Les blocs (échauffement, intervalles…) n'existent que pour le **vélo, la course et la natation**. La compétition a un compte à rebours J−n et ses 4 chiffres (cible, distance, allure, D+).
- **Formulaires** : séance prévue, compétition, activité faite à la main, import de fichier. Le triathlon et le duathlon ont un format (XS à XL) dans le formulaire de compétition, rien d'autre de propre.

## La grille (corrigée avec Yanis, 14 nov.)

Seule la **séance réalisée en course et en vélo** est terminée. Tout le reste est à faire ou à refaire, y compris la prévue et la compétition en course, vélo et natation (elles existent, mais ne sont pas jugées finies).

| | Course | Vélo | Natation | Muscu | Hyrox | Triathlon / Duathlon |
|---|---|---|---|---|---|---|
| **Réalisée** | **Terminé** | **Terminé** | À faire : version générique (3 pages, tours = longueurs) | À faire : aucun exercice ni série affichés | À faire : les 16 segments non affichés | À faire : une sortie comme une autre, sans ses étapes ni transitions |
| **Prévue** | À refaire : existe (blocs, profil, GPX) | À refaire : idem | À refaire : idem | À faire : seulement des chiffres | À faire : seulement des chiffres | À faire : pas de structure par discipline |
| **Compétition** | À refaire : version générique | À refaire : idem | À refaire : idem | Sans objet | À faire : sans lien avec l'objectif Hyrox | À faire : le format XS à XL se saisit, rien d'autre |

Autres cas déjà couverts : ski (journal des descentes), activités sans GPS (dossard du sport).

## Les écrans à créer ou à refaire

Chacun commence par **8 maquettes** (ta règle), puis le code. Durées en jours, maquettes comprises.

| # | Écran | Pourquoi | Importance | Durée |
|---|---|---|---|---|
| 1 | Prévue · Course, vélo, natation | Les sports principaux, l'écran existe mais est à refaire | 8/10 | 2,5 |
| 2 | Compétition · Course, vélo, natation | Idem | 8/10 | 2,5 |
| 3 | Réalisée · Triathlon et duathlon : les étapes | Une séance de triathlon, c'est trois sports | 8/10 | 2,5 |
| 4 | Compétition · Triathlon : étapes, transitions, objectifs | Lié au précédent (déjà dans A_FAIRE, Calendrier) | 8/10 | 2,5 |
| 5 | Réalisée · Muscu : exercices, séries, charges | Les données existent (carnet de force), rien à l'écran | 7/10 | 2,5 |
| 6 | Prévue · Muscu : le programme | Les programmes existent déjà en base | 7/10 | 2,5 |
| 7 | Réalisée · Hyrox : les 16 segments | Les données existent en base, l'app ne les lit pas | 7/10 | 2,5 |
| 8 | Réalisée · Natation : longueurs, allure au 100 m | Écran adapté plutôt que refait | 6/10 | 1,5 |
| 9 | Prévue · Triathlon : structure par discipline | Après le 3 | 6/10 | 2 |
| 10 | Prévue · Hyrox : structure par segment | Après le 7 | 5/10 | 1,5 |
| 11 | Compétition · Hyrox : lien avec l'objectif et les 16 segments | Après le 7 | 5/10 | 2 |

Pistes pour gagner du temps : fusionner 5 et 6 (un seul écran muscu, prévu ou réalisé), et 3, 4 et 9 (un seul écran triathlon avec ses trois états).
