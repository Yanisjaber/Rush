# Progrès : le niveau année après année

Code : `native/src/data/bilan/niveau-annees.ts` (calcul), `niveau-annees-affichage.ts` (positions, axe, textes), écran `ProgresNiveau.tsx` et `CourbeNiveau.tsx`. Tests : `native/tests/bilan/niveau-annees.test.ts`.
S'appuie sur la même régression que la comparaison de deux périodes : voir `PROGRESSION_VELO.md` et `PROGRESSION_COURSE.md`.

## Ce que l'écran montre

Plus de choix « 4 sem. / 3 mois / 1 an » dans l'onglet Progrès. Pour le vélo et la course :
- le **dossard** : le score de l'année en cours sur 100 (100 = ton meilleur niveau mesuré) ;
- la **courbe** du score trimestre par trimestre (semestre par semestre en course), avec la zone de marge d'erreur, la ligne des 100 et le meilleur niveau cerclé. Elle montre les **3 dernières années** ; une flèche en haut à droite du bloc (visible s'il y a plus de 3 ans d'historique) ouvre tout l'historique depuis la première année, et une seconde touche revient aux 3 ans. Si ton meilleur niveau est avant la fenêtre, une phrase sous la courbe le dit ;
- la liste **Par année** : le niveau, sa marge d'erreur, le nombre de sorties et le score ;
- un **sélecteur** (vélo) : Sprint (meilleur 5 secondes de chaque année), 5 min, 20 min, 60 min, puis Endurance (le niveau à cardio égal) en dernier ;
- le bouton **Comment c'est calculé** : la preuve de la comparaison des 12 derniers mois aux 12 mois d'avant (verdict, fourchette, nuage de sorties, cascade).

La natation et la musculation gardent leur écran : leur comparaison est fixée à 12 mois contre 12 mois d'avant.

## Le niveau global de l'athlète (vélo)

Un 5 min ou un 20 min isolé ne dit pas qui est le coureur. Sur le vélo, la page Progrès ouvre sur le **niveau global**, quatre cartes qu'on fait glisser (code : `NiveauGlobalVelo.tsx`, `PagerCartes.tsx` ; calcul : `piliers-niveau.ts`) :
1. **Score global** : le dossard (score de l'année, variation depuis l'an dernier, écart au meilleur) et la courbe du score par année ;
2. **Composition** : les blocs de chaque pilier dans chaque année, et la note de chaque pilier cette année ;
3. **Ce qui a bougé** : l'évolution de chaque pilier depuis l'année d'avant ;
4. **Détail par durée** : la page décrite plus haut (Sprint, 5, 20, 60 min, Endurance, preuve du calcul).

Le score global est la **moyenne des piliers mesurés** (au moins 2). Chaque pilier va de 0 à 100 :

| Pilier | Ce qui est mesuré | Note |
|---|---|---|
| Puissance | meilleurs sprint (5 s), 5, 20 et 60 min de l'année | moyenne des 4 notes, chacune = meilleur de l'année ÷ meilleur de toujours (100 = le meilleur, 0 = 30 % en dessous) |
| Endurance | niveau à cardio égal (voir plus haut) | son score de l'année |
| Durabilité | meilleur 5 et 20 min **après 2 h 30 de sortie** ÷ meilleur à froid | même échelle (100 = aucune perte, 0 = 30 % de perte) ; au moins 3 sorties longues |
| Répétabilité | dans une sortie, le 3e meilleur effort de 5 min ÷ le 1er (médiane des sorties qui ont trois vrais efforts : le 3e ≥ 75 % du meilleur 5 min de l'année) | même échelle ; au moins 3 sorties |
| Capacité de charge | charge chronique (CTL) maximale de l'année (`daily_metrics`) | CTL max ÷ meilleur CTL max, même échelle |

Les mesures viennent de la fonction SQL `rpc_piliers_annuels` (une seule lecture, qui sert aussi au sélecteur de records). La durabilité (`late_300`, `late_1200`) et la répétabilité (`rep_1..3`) sont calculées par l'Edge Function `strava-streams` (`_shared/repetabilite.ts`) et stockées dans `power_curve` ; les anciennes sorties ont été rattrapées à la main depuis leurs streams.

**La récupération physiologique n'est pas dans le score** : il n'y avait que 18 nuits de sommeil/HRV (du 21 sept. au 12 oct. 2026) et aucune mesure de santé. La capacité de charge est ce qu'on peut dire de l'entraînement encaissé. La vraie récupération (HRV, FC au repos) pourra devenir un sixième pilier quand elle sera mesurée sur plusieurs mois.

Le calcul sur un vrai compte donne : 2022 : 33, 2023 : 73, 2024 : 85, 2025 : 86, 2026 : 60 (la capacité de charge de 2026 est basse : CTL max 70 contre 91, l'année n'est pas finie et l'entraînement a baissé). Les années à moins de 2 piliers mesurés n'ont pas de score global ; l'écran le dit (« Calculé sur N piliers sur 5 »).

## Comment le niveau est calculé

Le **niveau** d'une période, c'est la puissance (vélo) ou l'allure (course) à cardio égal. Une seule régression sur tout l'historique, avec une colonne par année (une autre, séparée, par trimestre ou semestre) :
- le cardio, le home-trainer (vélo) et le dénivelé par km (course) sont corrigés **avec les mêmes coefficients pour toutes les périodes** : c'est ce qui rend les années comparables entre elles ;
- le niveau est donné à un cardio de référence (la médiane de tes sorties, par exemple 149 bpm), sur route, au dénivelé médian en course ;
- chaque niveau a sa **marge d'erreur** (1,8 fois l'incertitude au vélo, 2 en course) ;
- une période a besoin d'au moins **3 sorties** pour avoir un niveau.

Le **score** va de 0 à 100 : **100 = ton meilleur niveau, 0 = un niveau 30 % en dessous du meilleur**, en ligne droite entre les deux (1 % de niveau en moins = 3,3 points ; en course, plus rapide = score plus haut). On a d'abord essayé « niveau ÷ meilleur niveau × 100 » : un vélo qui passe de 138 à 169 W (22 % d'écart) n'y variait que de 82 à 100, tout se tassait entre 70 et 100. Avec l'échelle large, la même évolution va de ~40 à 100. La constante est `RAPPORT_ZERO` (0,7) dans `niveau-annees.ts`. Les records utilisent la même échelle (un record 30 % sous ton meilleur vaut 0).

**Le sommet (100)** est le meilleur niveau parmi les périodes d'au moins **8 sorties** : une période de 3 ou 4 sorties peut sortir très haut par hasard (une sortie en descente), elle ne doit pas fixer le sommet. Son score est alors plafonné à 100 (sa marge d'erreur, elle, peut dépasser).

## Les records

Le sélecteur du vélo lit ton meilleur sprint (5 secondes) et tes meilleurs 5, 20 et 60 minutes de chaque année (fonction SQL `rpc_courbe_puissance`, une lecture par année). Chaque durée a son propre 100 (ta meilleure année sur cette durée). Pas de trimestres ni de marge d'erreur : un record n'est pas assez régulier (il demande un effort maximal ce jour-là).
Les records ne comptent pas dans le score d'endurance : une année sans effort maximal donnerait un mauvais record sans que ta forme ait baissé.

Sur les données du compte qui a servi aux tests (vélo, par année) : l'endurance monte de 82 (2022) à 100 (2025) et les records suivent à peu près (corrélation de 0,77 à 0,91 sur 6 années), mais le 20 min de 2026 retombe au niveau de 2022 alors que l'endurance reste à 97.

## Limites

- Les niveaux d'un trimestre à peu de sorties sont bruités (points creux sous 8 sorties) ; le dernier trimestre incomplet peut sembler creuser.
- En course, les années pèsent peu de courses : les marges d'erreur sont larges et les écarts entre années restent souvent dans le bruit.
- Pas de météo, pas de sommeil.
- L'historique est chargé en entier (par pages de 1000 séances) à la première ouverture de l'onglet.
