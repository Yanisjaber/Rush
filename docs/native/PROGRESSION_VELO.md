# Progrès du vélo : comment l'algorithme décide

Code : `native/src/data/bilan/progression-velo.ts` (calcul), `progression.ts` (assemblage et courbe). Tests : `native/tests/bilan/progression-velo.test.ts`.

## La question

« À cardio égal, est-ce que je produis plus de watts qu'avant ? » On compare la période choisie (4 semaines, 3 mois, 1 an) à la période de même longueur juste avant.

## Pourquoi pas une simple moyenne

Mesuré sur les 1 026 sorties vélo d'un vrai compte :
- Une sortie varie d'environ **12 %** d'un jour à l'autre à cardio égal (sommeil, hydratation, fatigue). C'est bien plus que le progrès qu'on cherche.
- Test « placebo » : on mélange au hasard les sorties entre les deux périodes (donc aucun vrai changement). L'ancienne moyenne annonçait quand même plus de 1 % d'écart **88 % du temps**, plus de 3 % **60 % du temps**.
- À 4 semaines, l'ancienne moyenne ne suivait pas la vraie forme (corrélation 0,05 avec l'évolution du meilleur 20 min). La nouvelle : 0,41. À 3 mois : 0,41 puis 0,62.

## Les sorties retenues

Une sortie compte si :
- c'est du vélo de route, gravel, VTT ou virtuel (**pas** le vélo électrique) ;
- la puissance vient d'un capteur (`device_watts` ; les watts estimés par Strava sont écartés) ;
- l'utilisateur n'a pas écarté ses données (`excl_power`, `excl_hr`) ;
- 20 min minimum, 40 W minimum ;
- cardio moyen entre 50 et 92 % de la FC max (95 à 175 bpm si elle est inconnue).

La puissance utilisée est la **puissance normalisée (NP)**, sinon la moyenne. La NP suit mieux la vraie forme (0,40 contre 0,26 à 4 semaines).

## Le calcul

Une régression sur les sorties des deux périodes :

`watts = base + pente × (cardio − cardio de référence) + intérieur + période`

- La **pente** corrige l'écart de cardio : rouler 10 bpm plus haut donne environ 8 W de plus sans que la forme change.
- **intérieur** : à cardio égal, le home-trainer donne 9 à 14 W de moins (pas d'air, plus de chaleur). Corrigé seulement s'il y a au moins 3 sorties de chaque sorte ; sinon on garde la sorte la plus fréquente. Si une période est toute en salle et l'autre toute dehors, on dit « pas comparable ».
- **période** : l'écart en watts entre maintenant et avant, à cardio égal. Son incertitude donne une **fourchette**.
- Le cardio de référence est la médiane des sorties comparées (affiché : « watts ramenés à 145 bpm »).

## Le verdict

| Résultat | Condition |
|---|---|
| Pas assez de données | moins de 3 sorties retenues dans une des périodes |
| Pas comparable | salle / extérieur impossible à séparer (une période toute en salle, l'autre toute dehors) |
| **Hausse** / **En retrait** | la fourchette exclut zéro et l'écart dépasse 1 % |
| **Stable** | la fourchette inclut zéro et fait moins de ± 4 % |
| **Trop variable pour trancher** | la fourchette inclut zéro et elle est plus large que ± 4 % |

Fausses alertes mesurées au test placebo : environ 10 % (contre 88 %).

## Ce qu'on a testé et laissé de côté

Ces facteurs n'améliorent pas le suivi de la forme sur les vraies données, donc ils ne sont pas dans le calcul :
- durée de la sortie (effet de dérive : −2 W par heure, trop faible) ;
- dénivelé par km ;
- volume de roulage des 7 derniers jours ;
- couper les sorties extrêmes (améliore un peu la corrélation mais rend la fourchette fausse) ;
- mesurer sur les blocs réguliers des flux seconde par seconde : le bruit reste le même (11 %), et seules 154 sorties sur 634 avaient assez de blocs.

La saison existe dans les données (± 15 W entre janvier et octobre) mais elle ressemble plus à la préparation de l'athlète qu'à la météo : on ne la corrige pas, on ne pourrait pas la séparer de la forme.

## Limites

- Le bruit du jour reste : à 4 semaines, la plupart des résultats sont « trop variable pour trancher ». C'est honnête, pas un défaut.
- Aucune donnée météo : la chaleur n'est pas corrigée.
- Les sorties d'après une mauvaise nuit ne sont pas écartées (les nuits sont dans `garmin_sleep`, piste future).
- Validé sur un seul athlète. À refaire quand d'autres comptes auront assez d'historique.
- Course, natation et musculation utilisent encore l'ancien calcul (moyenne avec ±1 %), avec le même défaut.

## Études derrière les choix

Cardio, puissance et efficience : Joyner et Coyle 2008 ; chaleur et déshydratation : Heaps et al. 1994 ; variabilité d'un jour à l'autre : HERITAGE ; arrêt d'entraînement : Mujika et Padilla 2000.
