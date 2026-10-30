# Progrès de la course : comment l'algorithme décide

Code : `native/src/data/bilan/progression-course.ts` (calcul), `progression-course-affichage.ts` (cascade et nuage), `progression.ts` (assemblage). Tests : `native/tests/bilan/progression-course*.test.ts`.
C'est la même méthode que le vélo : lis d'abord `PROGRESSION_VELO.md` (pourquoi une régression et une fourchette plutôt qu'une moyenne).

## La question

« À cardio égal, est-ce que je cours plus vite qu'avant ? » On compare la période choisie (4 semaines, 3 mois, 1 an) à la période de même longueur juste avant.

## Ce que les vraies courses ont montré

Mesuré sur 73 courses avec cardio d'un vrai compte (peu : les résultats sont à prendre avec prudence) :
- L'ancienne moyenne ne gardait que les courses entre 60 et 80 % de la FC max : **14 sur 73**. Elle annonçait plus de 1 % d'écart **~100 % du temps** quand on mélange au hasard les courses entre les deux périodes (donc aucun vrai changement).
- Le **dénivelé par km** est le facteur qui compte : l'allure ralentit d'environ 4 s/km pour chaque mètre de dénivelé en plus par km (R² de 0,53 à 0,78 en l'ajoutant au cardio).
- La **durée** de la course améliore un peu le suivi à 6 mois mais fait monter les fausses alertes de ~5 % à 10-16 % : elle n'est pas dans le calcul.
- Corrélation avec ta vraie forme (meilleur temps équivalent 5 km, formule de Riegel) : 0,79 à 3 mois, 0,54 à 6 mois, 0,73 à 1 an ; les courses retenues sont bien plus nombreuses qu'avant (résultat dans 59 fenêtres de 1 an sur 59).

## Les courses retenues

- Course à pied, trail ou course virtuelle (tapis) : **pas** l'elliptique ni la machine d'escalier (pas d'allure) ;
- 3 km minimum, 10 min minimum ;
- données non écartées par l'utilisateur (`excl_hr`, `excl_distance`) ;
- cardio moyen entre 50 et 95 % de la FC max (95 à 185 bpm si elle est inconnue) ;
- dénivelé connu (sauf sur tapis, où il vaut zéro).

## Le calcul

Une régression sur les courses des deux périodes :

`allure = base + pente × (cardio − cardio de référence) + dénivelé × (dénivelé par km − dénivelé de référence) + tapis + période`

- La **pente du cardio** (environ −3 à −4 s/km par bpm) : courir 10 bpm plus haut fait gagner ~35 s/km sans que la forme change.
- Le **dénivelé** n'est corrigé qu'à partir de 8 courses (en dessous, un coefficient de plus se mesurerait n'importe comment).
- Le **tapis** n'est corrigé que s'il y a au moins 3 courses de chaque sorte ; sinon on garde le terrain le plus fréquent. Une période toute sur tapis et l'autre toute sur route : « pas comparable ».
- **période** : l'écart d'allure entre maintenant et avant, à cardio et dénivelé égaux. Son incertitude donne la **fourchette**.

## Le verdict

| Résultat | Condition |
|---|---|
| Pas assez de données | moins de 3 courses retenues dans une des périodes |
| Pas comparable | tapis et route impossibles à séparer |
| **Hausse** / **En retrait** | la fourchette exclut zéro (seuil 2,0 fois l'incertitude) et l'écart dépasse 1 % |
| **Stable** | la fourchette contient zéro et fait moins de ± 5 % |
| **Trop variable pour trancher** | la fourchette contient zéro et elle est plus large que ± 5 % |

Différences avec le vélo : seuil de confiance plus strict (2,0 au lieu de 1,8) et « stable » à ± 5 % (au lieu de ± 4 %), parce qu'il y a moins de courses que de sorties à vélo. Fausses alertes mesurées au test placebo : 4 à 10 %.

## L'écran

La même page que le vélo : le dossard avec le verdict, la fourchette, le nuage de courses (cardio en abscisse, allure en ordonnée, la plus rapide en haut), la cascade de l'écart brut à l'écart à cardio égal (en secondes par km gagnées ou perdues), et les courses retenues.

## Limites

- Validé sur un seul athlète et 73 courses. À refaire quand d'autres comptes auront assez d'historique.
- Pas de météo (chaleur), pas de sommeil, pas de correction du vent.
- À 4 semaines ou 3 mois, avec peu de courses, la plupart des résultats seront « pas assez de données » ou « trop variable pour trancher » : c'est honnête, pas un défaut.
- La natation et la musculation utilisent encore l'ancien calcul (moyenne avec ±1 %).
