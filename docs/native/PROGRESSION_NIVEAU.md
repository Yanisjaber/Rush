# Progrès : le niveau année après année

Code : `native/src/data/bilan/niveau-annees.ts` (calcul), `niveau-annees-affichage.ts` (positions, axe, textes), écran `ProgresNiveau.tsx` et `CourbeNiveau.tsx`. Tests : `native/tests/bilan/niveau-annees.test.ts`.
S'appuie sur la même régression que la comparaison de deux périodes : voir `PROGRESSION_VELO.md` et `PROGRESSION_COURSE.md`.

## Ce que l'écran montre

Plus de choix « 4 sem. / 3 mois / 1 an » dans l'onglet Progrès. Pour le vélo et la course :
- le **dossard** : le score de l'année en cours sur 100 (100 = ton meilleur niveau mesuré) ;
- la **courbe** du score trimestre par trimestre (semestre par semestre en course), avec la zone de marge d'erreur, la ligne des 100 et le meilleur niveau cerclé. Elle montre les **3 dernières années** ; une flèche en haut à droite du bloc (visible s'il y a plus de 3 ans d'historique) ouvre tout l'historique depuis la première année, et une seconde touche revient aux 3 ans. Si ton meilleur niveau est avant la fenêtre, une phrase sous la courbe le dit ;
- la liste **Par année** : le niveau, sa marge d'erreur, le nombre de sorties et le score ;
- un **sélecteur** (vélo) : Endurance, ou le meilleur 5 min, 20 min, 60 min de chaque année ;
- le bouton **Comment c'est calculé** : la preuve de la comparaison des 12 derniers mois aux 12 mois d'avant (verdict, fourchette, nuage de sorties, cascade).

La natation et la musculation gardent leur écran : leur comparaison est fixée à 12 mois contre 12 mois d'avant.

## Comment le niveau est calculé

Le **niveau** d'une période, c'est la puissance (vélo) ou l'allure (course) à cardio égal. Une seule régression sur tout l'historique, avec une colonne par année (une autre, séparée, par trimestre ou semestre) :
- le cardio, le home-trainer (vélo) et le dénivelé par km (course) sont corrigés **avec les mêmes coefficients pour toutes les périodes** : c'est ce qui rend les années comparables entre elles ;
- le niveau est donné à un cardio de référence (la médiane de tes sorties, par exemple 149 bpm), sur route, au dénivelé médian en course ;
- chaque niveau a sa **marge d'erreur** (1,8 fois l'incertitude au vélo, 2 en course) ;
- une période a besoin d'au moins **3 sorties** pour avoir un niveau.

Le **score** = niveau ÷ meilleur niveau × 100 (en course, plus rapide = score plus haut).

**Le sommet (100)** est le meilleur niveau parmi les périodes d'au moins **8 sorties** : une période de 3 ou 4 sorties peut sortir très haut par hasard (une sortie en descente), elle ne doit pas fixer le sommet. Son score est alors plafonné à 100 (sa marge d'erreur, elle, peut dépasser).

## Les records

Le sélecteur du vélo lit tes meilleurs 5, 20 et 60 minutes de chaque année (fonction SQL `rpc_courbe_puissance`, une lecture par année). Chaque durée a son propre 100 (ta meilleure année sur cette durée). Pas de trimestres ni de marge d'erreur : un record n'est pas assez régulier (il demande un effort maximal ce jour-là).
Les records ne comptent pas dans le score d'endurance : une année sans effort maximal donnerait un mauvais record sans que ta forme ait baissé.

Sur les données du compte qui a servi aux tests (vélo, par année) : l'endurance monte de 82 (2022) à 100 (2025) et les records suivent à peu près (corrélation de 0,77 à 0,91 sur 6 années), mais le 20 min de 2026 retombe au niveau de 2022 alors que l'endurance reste à 97.

## Limites

- Les niveaux d'un trimestre à peu de sorties sont bruités (points creux sous 8 sorties) ; le dernier trimestre incomplet peut sembler creuser.
- En course, les années pèsent peu de courses : les marges d'erreur sont larges et les écarts entre années restent souvent dans le bruit.
- Pas de météo, pas de sommeil.
- L'historique est chargé en entier (par pages de 1000 séances) à la première ouverture de l'onglet.
