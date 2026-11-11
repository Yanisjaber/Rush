# Analyse d'une sortie (page 4 de l'écran d'une sortie)

Décision de Yanis (11 nov. 2026) : la page 4 est du **texte court et pertinent**, pas un récit. Chaque ligne apporte un fait qu'on ne lit pas à l'œil sur les autres pages, ou un écart à ce qui était prévu.

**Tout est calculé par le code, dans l'app** (aucun modèle de langage, aucune fonction serveur, aucun coût, instantané). Une première version écrite par l'IA (Haiku) a été essayée puis retirée : elle racontait ce qu'on voit déjà.

## Ce que ça produit
3 à 5 lignes étiquetées, classées par importance, puis une consigne « À faire » quand elle est chiffrée. Exemple (footing du 10 nov. 2026) :
- **Objectif** Footing raté : 41 % du temps en zone 4 ou plus, 23 % en zones 1 et 2.
- **Cœur** Dérive de +12,0 % (au-delà de 10 %), dès le km 2,6.
- **Plan** Footing à 6:28/km : 5'58"/km au lieu de 6'28"/km (30 s/km trop vite).
- **Prévu** Durée 35'42" au lieu de 30'00" (+19 %), charge 50 au lieu de 25 (+100 %).
- **À faire** Au prochain footing, reste sous 169 bpm.

## Les règles (`native/src/data/calendrier/analyse/constats.ts`)
Chaque règle produit un constat avec une priorité ; on garde les 5 plus hauts.
- **Objectif** : le footing (ou la séance « facile » du plan) est tenu si 70 % du temps est en zones 1-2 ; « un cran trop haut » ; « raté » si le quart du temps est en zone 4 ou plus. Tempo : zone 3.
- **Plan** : la sortie est reliée à la séance du calendrier (même jour, même sport, durée la plus proche), puis chaque bloc est mesuré contre sa cible chiffrée (allure, cœur, watts). Si le chrono suit le plan (à 12 % près), on juge par fenêtres de temps ; sinon on **retrouve les efforts dans le flux** (accélérations de la bonne durée) et on juge le reste comme un bloc continu. Une accélération à plus de 8 % de la cible n'est pas une répétition. L'allure écrite dans le nom d'un bloc (« à 6:28/km ») prime sur le calcul depuis le profil.
- **Prévu** : durée, distance et charge contre le prévu (dit à partir de 10 % d'écart).
- **Départ** trop rapide, **tendance** (on ralentit / on accélère), **dérive** et le kilomètre où elle commence, **arrêts**, **allure irrégulière**.
- **Données** : FC max du profil dépassée, zones sur FC max estimée, puissance estimée en course, cœur absent.
- Un footing avec quelques lignes droites reste un footing : un plan n'est « à intervalles » que si le tiers de son temps l'est.

## Fichiers
- Moteur : `native/src/data/calendrier/analyse/{flux,efforts,plan,constats,type-seance}.ts`, tests dans `native/tests/calendrier/analyse/`.
- Écran : `native/src/components/graphes/PageAnalyseSortie.tsx`, branchement dans `native/app/seance.tsx`, séance prévue liée par `native/src/hooks/usePrevueLiee.ts`.

## À savoir
- Les seuils (70 %, 25 %, 4 %, 3 %, 10 %, 8 %…) sont des **conventions de lecture**, pas des normes. Seule la dérive de 5 % (endurance solide) est un repère connu. À sourcer comme les autres règles (voir `IA_A_FAIRE.md`).
- La qualité dépend du profil : FC max, seuil de cœur, vitesse seuil (les allures des plans du coach sont des % de la vitesse seuil). Sans vitesse seuil, la ligne Plan dit ce qui manque au lieu d'inventer.
- Les zones de cœur affichées partout viennent du même calcul (`calculerZones`).

## Reste à faire
- Cadence (pas dans les flux bruts de l'app), relief (allure ajustée à la pente).
- Muscu, natation, Hyrox : autres critères.
- Un retour de Yanis sur la qualité des lignes après quelques sorties.
