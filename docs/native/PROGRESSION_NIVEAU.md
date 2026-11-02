# Progrès : le niveau année après année

Code : `native/src/data/bilan/niveau-annees.ts` (calcul), `niveau-annees-affichage.ts` (positions, axe, textes), écran `ProgresNiveau.tsx` et `CourbeNiveau.tsx`. Tests : `native/tests/bilan/niveau-annees.test.ts`.
S'appuie sur la même régression que la comparaison de deux périodes : voir `PROGRESSION_VELO.md` et `PROGRESSION_COURSE.md`.

## Ce que l'écran montre

Plus de choix « 4 sem. / 3 mois / 1 an » dans l'onglet Progrès. Pour le vélo et la course :
- le **dossard** : le score de l'année en cours sur 100 (100 = ton meilleur niveau mesuré) ;
- la **courbe** du score trimestre par trimestre (semestre par semestre en course), avec la zone de marge d'erreur, la ligne des 100 et le meilleur niveau cerclé. Elle montre les **5 années qui finissent sur l'année choisie** en haut du Bilan (la dernière par défaut) ; une flèche en haut à droite du bloc (visible s'il y a des années avant la fenêtre) ouvre tout l'historique jusqu'à cette année, et une seconde touche revient aux 5 ans. Si ton meilleur niveau est avant la fenêtre, une phrase sous la courbe le dit ;
- la liste **Par année** : le niveau, sa marge d'erreur, le nombre de sorties et le score ;
- un **sélecteur** (vélo) : Sprint (meilleur 5 secondes de chaque année), 5 min, 20 min, 60 min, puis **Forme** (le niveau à cardio égal, appelé « Endurance » jusqu'au 2 nov. 2026) en dernier ;
- le bouton **Comment c'est calculé** : la preuve de la comparaison des 12 derniers mois aux 12 mois d'avant (verdict, fourchette, nuage de sorties, cascade).

La natation et la musculation gardent leur écran : leur comparaison est fixée à 12 mois contre 12 mois d'avant.

## Le niveau global de l'athlète (vélo)

Un 5 min ou un 20 min isolé ne dit pas qui est le coureur. Sur le vélo, la page Progrès montre le **niveau global** sur une seule page qui défile (code : `NiveauGlobalVelo.tsx` ; calcul : `piliers-niveau.ts`) :
Tout l'écran suit **l'année choisie** en haut du Bilan (le sélecteur est actif sur Progrès quand le niveau global du vélo s'affiche, grisé sinon) :
1. **Le niveau de l’année choisie** en taille normale (« 80 / 100 », « — » si l'année n'a aucune mesure, sans autre texte) ;
2. **Score par année** : la courbe du score global, le score sur chaque point, l'année choisie cerclée ;
3. **Piliers par année** : la **carte de chaleur** (`ChaleurPiliers.tsx`) : une ligne par année (la plus récente en haut), une colonne par pilier (noms abrégés : Puiss., Endur., Répét., Charge), plus la case est bleue plus la note est haute (l'année choisie et les 4 d'avant, « Tout l'historique » pour toutes). Le texte de chaque case est choisi pour rester lisible sur sa teinte (`theme/contraste.ts`) ;
4. **La courbe des niveaux** : le sélecteur Sprint, 5, 20, 60 min, Forme et sa courbe sur les 5 ans qui finissent sur l'année choisie (`ProgresNiveau` en mode `courbeSeule`, sans dossard, liste, calcul ni phrase sous la courbe).

Le score global est la **moyenne des 4 piliers**. Chaque pilier va de 0 à 100 :

| Pilier | Ce qui est mesuré | Note |
|---|---|---|
| Puissance | meilleurs sprint (5 s), 5, 20 et 60 min de l'année | moyenne des 4 notes, chacune = meilleur de l'année ÷ meilleur de toujours (100 = le meilleur, 0 = 30 % en dessous) ; au moins 3 sorties avec capteur (`n_courbes`), sinon l'année n'est pas notée et ne compte pas pour « le meilleur de toujours » |
| Endurance | à **puissance fixe** : facilité (F), coût cardio (H), fraîcheur à 2 h 30 (C) | 100 × (0,35 F + 0,30 H + 0,35 C), voir « L'endurance » plus bas |
| Répétabilité | **moyenne de deux notes** sur les **10 meilleures sorties de l'année** (celles où le 3e effort est le plus fort, parmi celles qui ont trois vrais efforts de 5 min : le 3e ≥ 50 % de ton **meilleur 5 min de tous les temps**, calculé sur les années à 3 sorties avec capteur ou plus) : **la régularité** (3e effort ÷ 1er, médiane des sorties : 100 = aucune perte, 0 = 30 % de perte) et **la hauteur** (3e effort médian, en watts, ÷ ton meilleur 5 min de tous les temps : 0 à 50 %, 100 à 100 %) | au moins 3 sorties (sinon réduite, voir plus bas). Depuis le 2 nov. 2026 : la régularité seule récompensait les efforts faibles (80 W en 2017 donnaient 83), puis ne voyait pas la progression (2021 : 170 W et 72 ; 2025 : 190 W et 61 à cause d'une perte plus grande entre le 1er et le 3e). La barre des vrais efforts est à 50 % du meilleur de toujours (à 75 %, 2022 n'avait aucune sortie valide : meilleur 3e effort 201 W pour un record de 293 W). Sans la hauteur (base pas à jour), la régularité fait seule la note. Depuis le 3 nov. 2026 : la médiane portait sur TOUTES les sorties de l'année (170 en 2026) ; sur une sortie facile les « 3 meilleurs efforts » ne sont que trois morceaux un peu plus appuyés, la régularité restait collée à 0,91 chaque année. Avec les 10 meilleures : 3e effort médian 227 → 265 W, régularité 0,918 → 0,957 en 2026 (compte de test). |
| Capacité de charge | **60 %** charge chronique (CTL) moyenne de l'année (`ctl_moy`), **25 %** heures de l'année (`heures`), **15 %** jours actifs (`jours_actifs`), tous de `daily_metrics` | Chacun ÷ la **moyenne de tes 3 meilleures années**, sur une **échelle plus douce** : 100 = cette référence (ou plus), **0 à 40 %** de la référence (les autres piliers : 0 à 70 %). L'année en cours (et la première) ne couvre pas 365 jours : heures et jours actifs sont ramenés à une année (× 365 ÷ `jours_couverts`, à partir de 30 jours couverts). Depuis le 3 nov. 2026 : le CTL max contre la meilleure année donnait une année aberrante (2022 : CTL max 149, FTP estimée trop basse donc intensité 0,91 au lieu de 0,80) le « 100 » et écrasait les autres ; puis le CTL seul ne voyait ni les heures ni la régularité (220 jours actifs = 180 jours actifs à CTL égal). Sans volume (base pas à jour), le CTL moyen fait seul la note |

Les mesures viennent de la fonction SQL `rpc_piliers_annuels` (une seule lecture, qui sert aussi au sélecteur de records). La répétabilité (`rep_1..3`) est calculée par l'Edge Function `strava-streams` (`_shared/repetabilite.ts`) et stockée dans `power_curve` ; les anciennes sorties ont été rattrapées à la main depuis leurs streams. La base écrit encore `late_300` et `late_1200` (le profil de durabilité du site gelé les lit) ; `fat20` n'est plus calculée et `rpc_piliers_annuels` ne rend plus ces colonnes (voir plus bas).

**La récupération physiologique n'est pas dans le score** : il n'y avait que 18 nuits de sommeil/HRV (du 21 sept. au 12 oct. 2026) et aucune mesure de santé. La capacité de charge est ce qu'on peut dire de l'entraînement encaissé. La vraie récupération (HRV, FC au repos) pourra devenir un sixième pilier quand elle sera mesurée sur plusieurs mois.

Le calcul sur un vrai compte donne : 2022 : 33, 2023 : 73, 2024 : 85, 2025 : 86, 2026 : 60 (la capacité de charge de 2026 est basse : CTL max 70 contre 91, l'année n'est pas finie et l'entraînement a baissé). Ces chiffres datent d'avant la règle des preuves (ci-dessous) et d'avant le retrait de la durabilité.

### Une note à chaque pilier (depuis le 2 nov. 2026)

Une case vide (« — ») ne disait pas pourquoi : 9 000 km dans l'année ne donnent pas de répétabilité sans séances d'intervalles. Maintenant **chaque pilier a toujours une note**, calculée avec ce qui est mesuré puis **réduite de la part qui manque** :

> note affichée = note calculée × preuve, où preuve = sorties disponibles ÷ sorties demandées (au plus 1)

| Pilier | Sorties demandées | Exemple |
|---|---|---|
| Puissance | 3 sorties avec capteur dans l'année | 1 sortie : un tiers de la note ; aucune : 0 |
| Répétabilité | 3 sorties avec 3 vrais efforts | idem |
| Endurance | chaque lettre (F, H, C) a sa preuve (3 sorties) | une lettre sans mesure vaut 0, et sa part de preuve aussi |
| Charge | la charge de l'année | pas de charge mesurée : 0 |

Sans aucune mesure, la note est 0. Le score global est la moyenne des 4 notes, preuves incomplètes comprises, **à condition que 3 piliers sur 4 aient toutes leurs preuves** (`PILIERS_MINI_GLOBAL`, 3 nov. 2026) : une année pauvre en données a un score bas, mais une année où deux piliers ne sont pas mesurables du tout (pas de capteur de puissance : 2016-2018 du compte de test affichaient 7 à 11) n'a **pas de score global** : l'écran affiche « — », dit combien de piliers sont mesurés, et laisse les piliers détaillés. La meilleure année se cherche parmi celles qui ont un score. Ton « meilleur de toujours » (le 100 de chaque durée) se lit toujours sur les années à 3 sorties avec capteur ou plus, pour qu'un capteur qui a menti en une sortie ne fixe pas la barre (sans aucune année fiable, sur celles qui ont au moins une sortie avec capteur). Dans la carte de chaleur, une note à preuve incomplète a un **contour en pointillés** (et VoiceOver dit « peu de mesures »). Le point fort et le point faible ne se disent que sur les piliers à preuve complète.

Pourquoi 3 sorties avec capteur pour la puissance (2 nov. 2026) : sur le compte de test, 2013 n'avait qu'une sortie avec capteur, en panne (1 W sur une heure). Sa puissance notée 0 et sa petite charge notée 0 donnaient un niveau global de 0. Une courbe qui n'a qu'un marqueur de version (`{"v": 6}`, sortie calculée sans capteur) ne compte pas. Le graphique « Score global par année » place chaque point selon son année : une année sans score laisse un trou.

## Comment le niveau est calculé

Le **niveau** d'une période, c'est la puissance (vélo) ou l'allure (course) à cardio égal. Une seule régression sur tout l'historique, avec une colonne par année (une autre, séparée, par trimestre ou semestre) :
- le cardio, le home-trainer (vélo) et le dénivelé par km (course) sont corrigés **avec les mêmes coefficients pour toutes les périodes** : c'est ce qui rend les années comparables entre elles ;
- le niveau est donné à un cardio de référence (la médiane de tes sorties, par exemple 149 bpm), sur route, au dénivelé médian en course ;
- chaque niveau a sa **marge d'erreur** (1,8 fois l'incertitude au vélo, 2 en course) ;
- une période a besoin d'au moins **3 sorties** pour avoir un niveau.

Le **score** va de 0 à 100 : **100 = ton meilleur niveau, 0 = un niveau 30 % en dessous du meilleur**, en ligne droite entre les deux (1 % de niveau en moins = 3,3 points ; en course, plus rapide = score plus haut). On a d'abord essayé « niveau ÷ meilleur niveau × 100 » : un vélo qui passe de 138 à 169 W (22 % d'écart) n'y variait que de 82 à 100, tout se tassait entre 70 et 100. Avec l'échelle large, la même évolution va de ~40 à 100. La constante est `RAPPORT_ZERO` (0,7) dans `niveau-annees.ts`. Les records utilisent la même échelle (un record 30 % sous ton meilleur vaut 0).

**Le sommet (100)** est le meilleur niveau parmi les périodes d'au moins **8 sorties** : une période de 3 ou 4 sorties peut sortir très haut par hasard (une sortie en descente), elle ne doit pas fixer le sommet. Son score est alors plafonné à 100 (sa marge d'erreur, elle, peut dépasser).

## L'endurance (à puissance fixe, 3 nov. 2026)

Les watts à cardio égal mesurent la **forme** (l'efficacité aérobie) : ils restent dans le sélecteur sous le nom « Forme ». Le pilier Endurance répond à une autre question : **« tenir longtemps est-il devenu plus facile ? »**. En 2026, 175 W pendant 3 h est beaucoup plus facile qu'en 2019 (moins de % de la FTP, un cœur plus bas, plus frais à 2 h 30). Pour le voir, on compare toutes les années à la **même puissance en watts**.

**Puissance de référence** : 70 % de ta FTP de **tous les temps** (FTP = 95 % de ton meilleur 20 min de toujours, sur les années à au moins 3 sorties avec capteur ; à défaut, sur celles qui en ont au moins une). Elle est la même pour toutes les années (`p_ref`, rendue par `rpc_piliers_annuels`).
**Sorties de référence d'une année** : plus de 2 h (durée non écartée), puissance (normalisée, sinon moyenne) à **±10 %** de la puissance de référence. On garde les **10 plus récentes** de l'année (pour la FC, celles qui ont une FC moyenne et un cardio non écarté ; pour le découplage, celles qui ont un `drift`).

**note = 100 × (0,35 F + 0,30 H + 0,35 C)**, chaque lettre notée de 0 à 100 :
- **F, facilité (35 %)** : puissance de référence ÷ FTP de l'année (95 % de son meilleur 20 min). 70 % de la FTP (ou moins) = 100, 90 % (ou plus) = 0. Exemple du compte de test : 174 W = 82 % de la FTP en 2019, 70 % en 2026 ;
- **H, coût cardio (30 %)** : FC moyenne médiane des sorties de référence (`fc_ref`) contre ton meilleur (le plus bas) de tous les temps, sur les années à au moins 3 sorties de référence avec FC. 100 au meilleur, 0 à 15 battements de plus. Pas de % de LTHR : le profil n'en a pas toujours ; on compare aux autres années du compte. Exemple : 143 bpm en 2019, 132 en 2026 ;
- **C, fraîcheur à 2 h 30 (35 %)** : découplage cardiaque médian de ces mêmes sorties (`drift_med`, EF = puissance normalisée ÷ FC, 1re contre 2e moitié, voir `_shared/derive.ts`). 12 % = 0, 2 % = 100 (une 2e moitié plus efficace est plafonnée à 100) ;

Preuves : chaque lettre demande 3 sorties (3 sorties de référence avec FC, 3 avec découplage, 3 avec capteur pour la FTP de l'année) et vaut au prorata si moins. Une lettre sans mesure vaut 0 et sa part de preuve aussi. Le volume des sorties longues, le meilleur 2 h / 3 h / 2 h 30 ne comptent plus.
Les mesures viennent de `rpc_piliers_annuels` (migration `2026-11-03_endurance_puissance_fixe.sql` : `p_ref`, `fc_ref`, `n_fc`, `drift_med`, `n_drift`, puis nettoyée par `2026-11-03_rpc_piliers_nettoyage.sql` : plus de `fat20` ni `n_fat`) ; les notes sont calculées dans `piliers-niveau.ts`. La clé `drift` s'écrit à l'import (`strava-streams`, version des courbes 8) ; les anciennes sorties les reçoivent au recalcul des courbes (écran Synchro, voir `SYNCHRO_STRAVA.md`).

## Pourquoi la durabilité a été retirée (2026-11-02)

La durabilité comparait ton meilleur 5 et 20 min **après 2 h 30 de sortie** (et, dans l'endurance, après 30 kJ/kg) à ton meilleur à froid. Avec des sorties libres, ce n'est pas une mesure fiable : le ratio dépend de ce que tu as **osé faire** en fin de sortie (si tu n'as jamais poussé fort après 2 h 30, la note est basse sans que ta durabilité le soit), de la chaleur, de la nourriture et du terrain. Une note haute prouve quelque chose, une note basse ne prouve rien. Yanis a décidé de la retirer.

Ce qui a changé : le pilier Durabilité a disparu (4 piliers, score global = moyenne des 4), et l'endurance a perdu sa lettre D ; ses poids sont passés de 30 / 25 / 30 / 15 à **35 % F, 30 % H, 35 % C** (les trois anciens poids rapportés à 85 %, arrondis). Nettoyage serveur (3 nov. 2026) : `rpc_piliers_annuels` ne rend plus `late300`, `late1200`, `n_longues`, `fat20` ni `n_fat`, et `fat20` n'est plus calculée ; `late_300` et `late_1200` restent calculées pour le site gelé.

## Forme par saison (depuis le 2 nov. 2026)

Sous la courbe des niveaux, le bloc « Forme par saison » (maquette 7 de `claude.ai/artifact/QXW6TvDr57NLowSB28ndjX` ; code : `forme-saison.ts`, `FormeSaison.tsx`) montre l'année civile choisie semaine par semaine :
- **la forme** : pour chaque semaine, les sorties des 6 semaines qui finissent avec elle (au moins 3, sinon la semaine reste vide). Leurs watts sont ramenés au cardio de référence avec la pente et la correction home-trainer d'une régression sur tout l'historique (une colonne par trimestre), puis moyennés. Marge d'erreur = 1,8 × écart-type ÷ √n. Même échelle que la courbe Forme (100 = le meilleur trimestre) ; la meilleure semaine est cerclée ;
- **les heures** de vélo de la semaine en barres (toutes les sorties vélo, hors vélo électrique), sur le même axe des mois.

L'année en cours s'arrête à la semaine d'aujourd'hui. La semaine 1 commence le 1er janvier ; la dernière va jusqu'au 31 décembre.

## Les records

Le sélecteur du vélo lit ton meilleur sprint (5 secondes) et tes meilleurs 5, 20 et 60 minutes de chaque année (fonction SQL `rpc_courbe_puissance`, une lecture par année). Chaque durée a son propre 100 (ta meilleure année sur cette durée). Pas de trimestres ni de marge d'erreur : un record n'est pas assez régulier (il demande un effort maximal ce jour-là).
Les records ne comptent pas dans le score de forme : une année sans effort maximal donnerait un mauvais record sans que ta forme ait baissé.

Sur les données du compte qui a servi aux tests (vélo, par année) : la forme monte de 82 (2022) à 100 (2025) et les records suivent à peu près (corrélation de 0,77 à 0,91 sur 6 années), mais le 20 min de 2026 retombe au niveau de 2022 alors que la forme reste à 97.

## Limites

- Les niveaux d'un trimestre à peu de sorties sont bruités (points creux sous 8 sorties) ; le dernier trimestre incomplet peut sembler creuser.
- En course, les années pèsent peu de courses : les marges d'erreur sont larges et les écarts entre années restent souvent dans le bruit.
- Pas de météo, pas de sommeil.
- L'historique est chargé en entier (par pages de 1000 séances) à la première ouverture de l'onglet.

## L'écran (2 nov. 2026)

Une seule page qui défile, sans cartes à faire glisser ni texte d'explication (demande de Yanis) : en haut, le niveau global de l'année en taille normale (« 80 / 100 », écart avec l'an dernier, meilleur) ; puis la courbe du score global de toutes les années (le score sur chaque point, placés selon l'année) ; la carte de chaleur des quatre piliers par année ; et la courbe des niveaux avec le sélecteur Sprint / 5 / 20 / 60 min / Forme (`ProgresNiveau` en mode `courbeSeule` : ni dossard, ni liste par année, ni calcul). Un essai de « récit » (maquette 8 de `claude.ai/artifact/6Nbst9aEztcDWYa75d6cBc`) a été abandonné le même jour.
