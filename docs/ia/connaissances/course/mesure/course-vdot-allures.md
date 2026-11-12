---
id: course-vdot-allures
titre: Course à pied : niveau, VDOT, équivalences de chrono et allures d'entraînement
sports: [course]
mots_cles: [VDOT, Daniels, allures d'entraînement, allure seuil, allure tempo, allure facile, allure d'intervalle, Riegel, équivalence de temps, prédiction de chrono, VMA, vVO2max, pace, min/km]
preuve: pratique
maj: 2026-11-09
---
## L'essentiel
- Le **VDOT** de Jack Daniels est une « note de forme » déduite d'un chrono récent : elle sert à en déduire des **allures d'entraînement** (facile, marathon, seuil, intervalle, répétition) et des **équivalences** entre distances.
- Les allures d'entraînement sont des **fractions fixes** d'une vitesse liée au VDOT. Les calculateurs en ligne donnent des pourcentages un peu différents : retenir des **ordres de grandeur**, pas des chiffres au centième.
- Pour passer d'une distance à l'autre, la formule la plus simple est celle de **Riegel** : T2 = T1 × (D2 / D1)^1,06. Elle est correcte pour des coureurs bien entraînés sur ces distances, et **optimiste** quand on convertit un court effort en 10 km chez quelqu'un qui manque d'endurance.
- **Dans Rush**, le niveau est estimé avec la formule de Riegel à partir des sorties **récentes** (jamais d'un vieux record), puis les allures sont des **multiples de l'allure de course visée** (voir plus bas). Le coach explique, il ne recalcule pas lui-même.

## Ce que dit la recherche
- Base du VDOT : Daniels et Gilbert, *Oxygen Power* (1979) : le coût en oxygène de la course est une fonction de la vitesse, et la fraction de VO2max soutenable dépend de la durée de l'effort. Les calculateurs en ligne reprennent ce modèle ; les coefficients du second terme (fraction de VO2max selon la durée) **diffèrent selon les sources** et je n'ai pas pu les vérifier dans le livre. Le VDOT est jugé fiable pour des efforts d'environ 1,5 à 50 km sur parcours plat.
- Intensités données par un calculateur (à vérifier dans le livre) : facile ≈ 70 % de la vitesse VDOT, marathon ≈ 80 %, seuil ≈ 88 %, intervalle ≈ 98 %. D'autres sources donnent facile autour de 59 à 74 % et marathon 79 à 84 % : les bornes varient.
- Rôle des zones (Daniels, tel que repris par les sources secondaires) : **facile** = récupération et endurance, **marathon** = allure de la course, **seuil** = effort « confortablement dur » qui élève le seuil lactique, **intervalle** = effort aérobie rapide qui développe la VO2max, **répétition** = vitesse et économie, avec beaucoup de récupération.
- Validation d'un test de terrain : une étude sur 27 coureurs a trouvé que la méthode VDOT estime la vitesse au seuil lactique sans écart significatif avec la mesure en laboratoire, mais avec une erreur plus grande (0,41 m/s) que le test de 30 minutes (0,21 m/s) : voir [[course-tests-terrain]].

## Règles pour le coach
- Dire que les allures sont des **repères calculés** à partir du niveau actuel, pas des vérités : après quelques séances, on les ajuste (l'utilisateur peut demander plus doux ou plus vite, et le coach recalcule).
- Chiffres du moteur de l'application (choix de conception, pas résultats d'étude) : par rapport à l'allure de course visée, VMA ≈ 0,935 ×, allure 5 km ≈ 0,97 ×, seuil ≈ 1,04 ×, tempo ≈ 1,07 ×, footing facile ≈ 1,27 ×, sortie longue ≈ 1,30 × ; le footing est plafonné à l'allure facile réellement courue (+3 %).
- Sans chrono récent, ne jamais s'appuyer sur un vieux record : proposer une **sortie test** (voir [[course-tests-terrain]]).
- Ne pas promettre un chrono parce que la formule le « permet » : l'écart entre le niveau actuel et l'objectif doit être dit.

## Pièges
- Convertir un 5 km en 10 km (ou en marathon) sans tenir compte de l'endurance : la prédiction est optimiste.
- Prendre une allure facile calculée plus lente que ce que la personne court vraiment : le plan lui demande alors de ralentir sans raison.
- Utiliser un chrono couru en côte, par chaleur ou en groupe comme référence.

## Sources
- [VDOT : méthode et pourcentages (calculateur, source secondaire)](https://runcalcs.pages.dev/training/jack-daniels-vdot-calculator/)
- [Script de calcul du VDOT, coefficients discutés (forum intervals.icu)](https://forum.intervals.icu/t/script-for-calculating-jack-daniels-vdot/131024)
- [A comparison of methods for estimating the lactate threshold](https://pubmed.ncbi.nlm.nih.gov/16095403/)
