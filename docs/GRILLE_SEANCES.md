# Grille des écrans de séance : type × sport (14 nov. 2026)

État réel de l'app mobile, relevé dans le code (`app/seance.tsx`, `app/prevue.tsx`, `app/(ajouts)/*`, `data/calendrier/*`).
Légende : **Complet** = écran pensé pour ce sport. **Générique** = l'écran existe mais c'est le même pour tous les sports, sans rien de propre à celui-ci. **Manque** = rien.

## Comment ça marche aujourd'hui

- **Séance réalisée** : un seul écran pour tous les sports (`seance.tsx`), en pages qu'on balaie : 1) carte (ou dossard sans GPS), 4 chiffres, profil d'altitude ; 2) courbes synchronisées, zones, tours ; 3) analyse du coach (course et vélo seulement) ; 4) détails, records (course et vélo seulement), notes, supprimer. Seul le **ski** a un morceau à lui (journal des descentes). Les 4 chiffres changent selon le sport (`quatre-chiffres.ts`).
- **Séance prévue et compétition** : un seul écran (`prevue.tsx`) : carte du GPX ou dessin du sport, 4 chiffres, blocs de la séance. Les blocs (échauffement, intervalles…) n'existent que pour le **vélo, la course et la natation**. La compétition a un compte à rebours J−n et ses 4 chiffres (cible, distance, allure, D+).
- **Formulaires** : séance prévue, compétition, activité faite à la main, import de fichier. Le triathlon et le duathlon ont un format (XS à XL) dans le formulaire de compétition, rien d'autre de propre.

## La grille

| | Course | Vélo | Natation | Muscu | Hyrox | Triathlon / Duathlon |
|---|---|---|---|---|---|---|
| **Réalisée** | Complet : 4 pages, analyse du coach, records | Complet : 4 pages, analyse du coach, records | Générique : 3 pages, pas d'analyse ni de records ; tours = longueurs | **Manque l'essentiel** : dossard, durée, cœur, charge. Aucun exercice, aucune série | **Manque l'essentiel** : durée, distance, allure, cœur. Les 16 segments (8 courses et 8 stations) ne sont pas affichés | **Manque l'essentiel** : une sortie comme une autre, sans ses étapes (nage, vélo, course) ni ses transitions |
| **Prévue** | Complet : blocs, profil des blocs, GPX | Complet : blocs, profil des blocs, GPX | Complet : blocs, profil des blocs | **Manque** : seulement des chiffres, pas d'exercices ni de séries prévus | **Manque** : seulement des chiffres, pas de structure par segment | **Manque** : pas de structure par discipline |
| **Compétition** | Générique : cible, distance, allure, D+, J−n, GPX | Générique : idem | Générique : idem | Sans objet | Générique : sans lien avec l'objectif Hyrox ni ses 16 segments | **Manque** : le format (XS à XL) se saisit mais l'écran ne montre ni étapes, ni transitions, ni objectifs par étape |

Autres cas déjà couverts : ski (journal des descentes), activités sans GPS (dossard du sport).

## Les écrans à créer ou à refaire

Chacun commence par **8 maquettes** (ta règle), puis le code. Durées en jours, maquettes comprises.

| # | Écran | Pourquoi | Importance | Durée |
|---|---|---|---|---|
| 1 | Réalisée · Triathlon et duathlon : les étapes | Le plus gros trou : une séance de triathlon est 3 sports | 8/10 | 2,5 |
| 2 | Compétition · Triathlon : étapes, transitions, objectifs par étape | Lié au précédent (déjà dans A_FAIRE, Calendrier) | 8/10 | 2,5 |
| 3 | Réalisée · Muscu : exercices, séries, charges | Les données existent (carnet de force), rien à l'écran | 7/10 | 2,5 |
| 4 | Réalisée · Hyrox : les 16 segments | Les données existent en base, l'app ne les lit pas | 7/10 | 2,5 |
| 5 | Prévue · Muscu : le programme (exercices, séries) | Les programmes existent déjà en base | 7/10 | 2,5 |
| 6 | Réalisée · Natation : longueurs, allure au 100 m | Écran adapté plutôt que refait | 6/10 | 1,5 |
| 7 | Prévue · Hyrox : structure par segment | Après le 4 | 5/10 | 1,5 |

Reste à décider avec toi : l'ordre, et si certains écrans fusionnent (par exemple 3 et 5 : un seul écran muscu, prévu ou réalisé).
