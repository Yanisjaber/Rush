---
id: charge-forme-fraicheur
titre: Charge, forme de fond (CTL), fatigue (ATL), fraîcheur (TSB)
sports: [course, velo, natation, triathlon, muscu, hyrox]
mots_cles: [CTL, ATL, TSB, TSS, TRIMP, charge, forme, fatigue, fraîcheur, Banister, performance management]
preuve: probable
maj: 2026-11-07
---
## L'essentiel
- **TSS** : la charge d'une séance. **CTL** : forme de fond (moyenne lente de la charge). **ATL** : fatigue récente (moyenne rapide). **TSB** : fraîcheur = CTL − ATL (négatif = fatigué).
- Ce sont des **repères descriptifs**, utiles pour suivre une tendance. Ce ne sont pas des prédicteurs fiables de la performance ni du risque de blessure.
- Dans l'application : TSS (puissance) d'abord, sinon TRIMP (cardio), sinon effort ressenti × durée. **Le code calcule ces chiffres, le coach les lit.**

## Ce que dit la recherche
- Ces indicateurs viennent du modèle « fitness-fatigue » de Banister. Les critiques sont sérieuses : paramètres difficiles à estimer, statistiques fragiles, et le terme de fatigue n'améliore pas toujours la prédiction par rapport à la seule forme (étude 2025). Le modèle suppose un seul temps de réaction alors que les adaptations (cœur, mitochondries) n'ont pas la même durée.
- Des défenseurs rappellent que les alternatives (apprentissage automatique) sont moins lisibles.
- Le TSS corrige certaines limites du TRIMP, car la FC est un marqueur d'intensité imparfait. Il dépend toutefois d'un FTP à jour.
- Aucune étude trouvée ne valide directement CTL/ATL/TSB comme outil de prédiction de performance.
- Convention de TrainingPeaks (connaissance générale, non rechargée) : CTL sur environ 42 jours, ATL sur environ 7 jours.

## Règles pour le coach
- Parler de **tendance** : « ta forme de fond monte depuis trois semaines », pas de prédiction : « tu seras prêt le jour J ».
- TSB : très négatif = fatigue marquée, prudence ; proche de zéro ou positif = frais. Les seuils exacts ne sont pas établis, ne pas les présenter comme des lois.
- Ne **jamais calculer** ni recalculer un chiffre. Citer seulement ceux du contexte.
- Si `qualite.peu_de_donnees` est vrai : le dire et rester prudent.
- Si le TSS d'une séance paraît bizarre (FTP périmé, capteur), le dire plutôt que d'en tirer une conclusion.

## Pièges
- Présenter le TSB comme un score de « readiness » médical.
- Comparer le CTL de deux personnes : il dépend du FTP, du capteur et du sport.

## Sources
- [The Use of Fitness-Fatigue Models for Sport Performance Modelling (Machine-Learning, 2022)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8894528/)
- [Statistical flaws of the fitness-fatigue sports performance prediction model](https://www.researchgate.net/publication/388488104_Statistical_flaws_of_the_fitness-fatigue_sports_performance_prediction_model)
- [Rationale and resources for teaching the mathematical modeling of athletic training (Advances in Physiology Education)](https://journals.physiology.org/doi/pdf/10.1152/advan.00078.2011)
- [Bayesian inference of the impulse-response model (SportRxiv)](https://sportrxiv.org/index.php/server/preprint/view/246)
