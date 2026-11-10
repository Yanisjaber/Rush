# Fondements du plan de course : chaque paramètre face à la recherche

Recherche du 10 nov. 2026. **Limite honnête** : je n'ai lu que des résumés et des extraits (recherche web), pas les textes complets. Tout ce qui est marqué « à confirmer à la source » doit être vérifié dans l'article avant d'être codé en dur. Les sites de coaching et de calculateurs ne sont pas des preuves.

Verdicts : **soutenu** (preuve solide) · **débattu** (les sources se contredisent) · **pratique** (usage d'entraîneurs, pas d'essai contrôlé trouvé) · **sans source** (vient de nous, pas de la recherche).

## Les paramètres actuels de `plan-course.ts`

| Paramètre (valeur dans le code) | Ce que dit la recherche | Verdict |
|---|---|---|
| Équivalence entre distances : exposant de Riegel 1,06 (`RIEGEL`) | C'est un ajustement sur les records du monde. Blythe et Király (2016, environ 1,4 million de performances, arXiv 1505.01147) trouvent un exposant **propre à chaque coureur**, médiane autour de **1,12** (chiffre repris d'un résumé secondaire, à confirmer). | **Débattu, laissé à 1,06** (vérifié à la source le 10 nov. : l'article dit bien médiane 1,12 ; percentiles 1,10-1,15 ; Riegel 1,08 élite et 1,06 senior). Mais cette médiane porte sur **toutes les distances (100 m au marathon)**. Les tables de Daniels donnent environ 1,06 entre 5 et 10 km (calculé de mémoire, à vérifier dans le livre). Essayé : avec 1,12, un 3 km en 15:00 donne un 10 km en 58:45, trop lent. Piste : exposant personnel quand il a deux efforts de distances différentes. |
| Gain de 0,6 % par semaine, 8 % au plus (`realiste`) | Nuuttila 2022 : 10 km amélioré de **6,2 %** (charge ajustée sur la récupération) contre **2,9 %** (plan fixe), sur 12 à 15 semaines. Muñoz 2014 : **5,0 %** contre **3,6 %** en 10 semaines. Soit environ 3 à 6 % en 10 à 15 semaines. | **Corrigé le 10 nov.** : 0,4 %/semaine, 6 % au plus (milieu et haut de la fourchette 3-6 %). L'ancien 0,6 %/8 % n'avait pas de source. |
| Vieillissement du niveau : 1,5 %/mois, 30 % au plus (`VIEILLISSEMENT_*`) | Mujika et Padilla (2000) : la perte dépend du niveau d'entraînement et de la durée d'arrêt. Chez des sujets récemment entraînés, VO2max −3,6 à −6 % après 2 à 4 semaines d'arrêt (résumé secondaire). Spiering et coll. (2021) : l'endurance se maintient jusqu'à 15 semaines avec 2 séances par semaine ou −50 % de volume. | **Sans source** pour le chiffre exact. Le principe (un vieux record ne vaut plus rien) est soutenu, pas le coefficient. |
| Allures : VMA ×0,935, 5 km ×0,97, seuil ×1,04, tempo ×1,07, facile ×1,27, longue ×1,3 | Ce sont les cinq allures de **Daniels** (méthode d'entraîneur, pas d'essai contrôlé). Les pourcentages de VO2max varient d'un site à l'autre (seuil 83-92 %, facile 59-79 %). Les tables officielles sont dans *Daniels' Running Formula* (4e éd., 2021). | **Pratique**. À recalculer depuis les tables du livre (VDOT), pas depuis des multiplicateurs maison. |
| Montée de volume de 10 % par semaine (`Math.pow(1.1…)`) | Buist 2008 (essai randomisé, débutants) : un programme progressif selon la règle des 10 % **n'a pas réduit** les blessures. Nielsen 2013 (GPS, 60 débutants) : des hausses **au-delà de 30 %** semblent nocives ; une grande cohorte plus récente évoque un risque qui augmente dès 1 % (résumé de presse, à confirmer). Les revues concluent à très peu de preuve d'un lien simple entre variation de charge et blessure. | **Débattu**. Aucune valeur n'est soutenue. Plafond prudent et expliqué (par exemple ne pas dépasser le volume réellement fait), plutôt qu'un 10 % présenté comme scientifique. |
| Rapport charge aiguë/chronique (ACWR) | Critiques méthodologiques sérieuses (couplage mathématique, Lolli 2019 ; Wang 2021). Revue de Maupin 2020 : zone 0,8-1,3 la moins risquée, mais hétérogène. | **Débattu**. À ne pas utiliser comme règle de blocage. |
| Semaine de récupération toutes les 4 semaines, ×0,8 | Pratique d'entraîneurs. Pas d'essai contrôlé trouvé. | **Pratique**. |
| Affûtage : ×0,75 puis ×0,55 le dernier bloc (`facteur`) | Bosquet 2007 (méta-analyse, 27 études sur 182) : le meilleur affûtage dure **2 semaines**, avec **−41 à −60 %** de volume, **sans toucher à l'intensité ni à la fréquence**. Pour la course à pied, un résumé secondaire parle de −21 à −40 %. Revue sur les affûtages en course longue : **−40 à −80 %** de volume, fréquence **−20 à −50 %**, et pour un 10 km la séance la plus dure **5 à 10 jours avant** la course. Spilsbury 2015 : des élites britanniques réduisaient le volume continu à 53-71 % du normal. | **Soutenu en gros.** Correction de mon analyse initiale : dans un plan de 5 semaines, il n'y a qu'une semaine d'affûtage (la dernière fenêtre, ×0,55, soit −45 %), dans la fourchette. La séance dure (tempo) tombe 5 jours avant la course, conforme ; la séance du 11 déc. est un rappel d'allure court, pas la séance la plus dure. **Seul écart** : la durée. Bosquet donne 2 semaines comme optimum ; le code n'en faisait deux qu'à partir de 8 semaines de plan. **Corrigé : 2 semaines dès 6 semaines de plan.** |
| Sortie longue : +6 min par semaine, jusqu'à 42 % du volume hebdo (`longue`) | Daniels est souvent cité pour **25-30 %** du volume, ou 2 h 30 au plus (chiffres de seconde main, désaccord entre sources, à confirmer dans le livre). Pfitzinger : surtout des distances (marathon). Aucune étude trouvée pour un 10 km. | **Pratique**, et notre plafond de 42 % est plus haut que la norme citée. |
| Footing au plus 65 % de la sortie longue (ajouté ce soir) | Rien. | **Sans source** (à retirer ou remplacer). |
| Jamais deux séances dures collées | Les sources de terrain parlent de 48 à 72 h entre séances VO2max et seuil, et d'au plus 2 séances dures par semaine pour un amateur. Ce sont des blogs de coaching. Je n'ai trouvé aucun essai randomisé. | **Pratique**. |
| Répartition d'intensité (80/20) : tempo seulement avec 3 séances ou plus et CTL ≥ 30 (`semaine.ts`) | Rosenblat 2019 (méta-analyse, 3 études, PEDro 4-5) : effet **modéré** (ES −0,66) en faveur du polarisé, petit échantillon. Muñoz 2014 : 5,0 % contre 3,6 %, **différence non significative**. Oliveira 2024 : polarisé supérieur **seulement pour la VO2peak**, pas pour les autres critères. | **Débattu**. Aucun modèle n'est prouvé meilleur sur 10 km pour tous. Ne pas imposer une répartition ; l'afficher comme un choix. |
| Volume mini 38 min par séance, footing mini 30, longue mini 45, volume hebdo max 360 | Rien. | **Sans source, remplacé le 10 nov. (cas avec historique)** par des repères tirés des sorties de la personne (`reperesPersonnels`) : footing mini = 75 % de sa sortie moyenne, longue mini = 85 % de sa plus longue récente, volume max = 130 % de sa semaine la plus chargée. **Ces coefficients sont des conventions d'échelle, pas des résultats d'études.** Sans historique : anciennes valeurs par défaut, en attendant un départ prudent de débutant (à faire, après lecture des fiches reprise/débutant). |
| Pas de test avec des sorties récentes ; test de 3 km sans données | Nuuttila 2022 : ajuster la charge d'après des marqueurs de récupération donne un meilleur gain que suivre un plan fixe. | **Soutenu pour le principe d'adapter le plan** (ce que fait déjà `suivi-plan.ts`) ; le choix de la sortie test 3 km est une pratique. |

## Ce que le profil du coureur change (12 nov. 2026, `reglesDuProfil`)

| Donnée du profil | Effet dans le plan | Source |
|---|---|---|
| Jour « pas disponible » | Aucune séance ce jour-là | La personne |
| Durée max d'un jour | Aucune séance plus longue ce jour-là (sinon séance abandonnée, avec la raison) | La personne |
| Plus grosse semaine déjà faite | Le volume d'une semaine ne dépasse pas le plus haut entre elle et sa plus grosse semaine récente | Décision « plafond partant du volume réel » (voir plus haut) ; pas une étude |
| Blessure encore là | Aucune séance d'intensité, pas de sortie test | Fiche `course-blessures-progression` : ne jamais courir à travers une douleur |
| Blessure des 12 derniers mois, ou moins d'un an de pratique | Une seule séance dure par semaine, montée de 5 % au lieu de 10 % | Même fiche : avoir déjà été blessé est le facteur le mieux lié à une nouvelle blessure (≈ ×7,6 chez des débutants, seconde main) ; elle conseille de réduire la montée (fourchette 5-10 %) et de garder plus de jours faciles. Le choix précis « 1 séance dure, 5 % » est **notre convention**, pas un résultat d'étude. |
| Évite le fractionné | Une seule séance dure par semaine | La personne |
| Moment de la journée | Aucun effet (le plan donne des jours, pas des heures) | — |

| Aucune donnée ni temps visé | Plan entier sur allures provisoires (5 km en 40 min, chiffre à nous), test en première séance, recalibrage complet au résultat. Test : 3 km chrono (objectif ≤ 6 km) ou 30 min à fond régulier (au-delà) | Fiche `course-tests-terrain` : les deux tests existent et se convertissent par Riegel (optimiste d'un effort court vers 10 km et plus). **Le seuil de 6 km est notre convention.** |
| Aucune donnée de course et 0 an d'ancienneté (débutant) | sortie test 3 km chrono en première séance (choix de Yanis ; sans aucun temps visé c'est la seule séance), puis 3 séances de 20-30 min, course/marche 1/2 → 2/1 → 3/1, un jour de repos entre deux séances, aucune autre intensité, but : finir | Fiches `course-reprise-debutants` et `reprise-apres-arret` (repères de terrain « Couch to 5K », pas des essais contrôlés). **Nos conventions** : étape toutes les 2 semaines, 6 semaines de course/marche, marche affichée à 1,7 × l'allure facile. |
| Ancienneté sans sortie depuis 90 jours, plus grosse semaine connue (reprise) | Volume de départ = 35 % de la plus grosse semaine | Fiche `reprise-apres-arret` : 30 à 40 % pour un arrêt de 2 à 3 mois (guides de terrain, pas d'essai contrôlé) |

Ne sont pas encore branchés : `planifier_semaine`, `planifier_periode` (autres moteurs) et le cas sans historique.

## Ce qui est le mieux soutenu

1. **L'affûtage** : 2 semaines, volume nettement réduit, intensité et fréquence gardées (Bosquet 2007).
2. **Adapter le plan à la réponse de la personne** plutôt que suivre un plan fixe (Nuuttila 2022, un seul essai de taille modeste).
3. **Le maintien de la forme avec peu de séances** (Spiering 2021), utile pour les plans courts ou quand le temps manque.

## Ce qui n'a pas de réponse tranchée

- La bonne vitesse de montée du volume (10 % est contesté, rien d'autre n'est prouvé).
- Le meilleur modèle de répartition d'intensité sur 10 km.
- La proportion idéale de la sortie longue pour un 10 km.
- L'espacement exact des séances dures.

Pour ces points, le code ne doit pas feindre une certitude : soit une fourchette large avec la valeur de la personne comme point de départ, soit une règle supprimée.

## Décisions à prendre (avec Yanis)

- Fait le 10 nov. : affûtage de 2 semaines dès 6 semaines de plan ; gain 0,4 %/semaine, 6 % au plus.
- Exposant : reste 1,06 (sources contradictoires sur 5-10 km) ; piste d'un exposant personnel.
- Retirer ou remplacer les règles marquées « sans source ».
- Vérifier à la source : Bosquet 2007, Nuuttila 2022, Buist 2008, Nielsen 2013, Rosenblat 2019, et les tables de *Daniels' Running Formula*.

## Sources

- Bosquet, Montpetit, Arvisais, Mujika (2007), *Effects of tapering on performance: a meta-analysis*, MSSE : https://pubmed.ncbi.nlm.nih.gov/17762369/
- Spilsbury et coll. (2015), *Tapering strategies in elite British endurance runners*, Eur J Sport Sci ; revue des affûtages en course longue : https://lida.sport-iat.de/ta/Record/4045326?lng=en
- Buist et coll. (2008), essai sur un programme progressif (règle des 10 %) : https://research.rug.nl/en/publications/no-effect-of-a-graded-training-program-on-the-number-of-running-r/
- Nielsen et coll. (2013), GPS et progression du volume chez les débutants : https://research.rug.nl/en/publications/can-gps-be-used-to-detect-deleterious-progression-in-training-vol/
- Maupin et coll. (2020), ACWR et blessures, revue systématique : https://doaj.org/article/809a2d1970a8458b999603e8fcf8cf84
- Blythe et Király (2016), exposant propre à chaque coureur : https://arxiv.org/pdf/1505.01147
- Muñoz et coll. (2014), *Does polarized training improve performance in recreational runners?* : https://pubmed.ncbi.nlm.nih.gov/23752040/
- Nuuttila et coll. (2022), *Individualized endurance training based on recovery and training status in recreational runners* : https://pubmed.ncbi.nlm.nih.gov/35975912/
- Rosenblat et coll. (2019), méta-analyse polarisé contre seuil, J Strength Cond Res (lien exact non vérifié : à chercher sur PubMed).
- Mujika et Padilla (2000), *Detraining: loss of training-induced physiological and performance adaptations*, Sports Med (parties I et II).
- Daniels, *Daniels' Running Formula* (4e éd., 2021) : à consulter directement.
