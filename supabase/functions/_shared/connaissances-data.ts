// GÉNÉRÉ par supabase/scripts/generer-connaissances.mjs à partir de docs/ia/connaissances/*.md : NE PAS MODIFIER À LA MAIN.
// Pour changer une fiche : modifier le .md puis relancer le script.
import type { Fiche } from './connaissances.ts';

export const FICHES: Fiche[] = [
  {
    "id": "affutage",
    "titre": "Affûtage avant une course",
    "sports": [
      "course",
      "velo",
      "natation",
      "triathlon"
    ],
    "motsCles": [
      "affûtage",
      "taper",
      "avant la course",
      "veille de course",
      "réduire le volume",
      "fraîcheur",
      "jour J",
      "objectif A"
    ],
    "preuve": "etabli",
    "maj": "2026-11-07",
    "essentiel": "- On **baisse le volume** dans les 1 à 2 semaines avant l'objectif, on **garde l'intensité** et la fréquence. Résultat : on arrive plus frais, sans perdre la forme.",
    "recherche": "- Méta-analyse sur les sportifs d'endurance (Wang et al., *PLOS ONE*, 2023) : une **baisse de volume de 41 à 60 %** améliore le contre-la-montre ; **8 à 14 jours** est la durée la plus efficace en cyclisme et en course.\n- Méta-analyse classique (Bosquet et al., 2007) : optimum de **2 semaines**, volume réduit de façon exponentielle de 41 à 60 %, **intensité et fréquence inchangées** (cette méta-analyse inclut des sprinters, d'où la mise à jour de 2023).\n- Revue narrative sur l'élite : fenêtre plus large de 6 à 28 jours, plutôt 6 à 21 (preuve plus faible).\n- Un affûtage mal exécuté peut annuler des gains d'entraînement.",
    "regles": "- Sur un objectif A (marathon, triathlon long) : démarrer l'affûtage environ **14 jours** avant, en réduisant progressivement ; sur un 10 km ou un format court : **7 à 10 jours** (pratique de terrain).\n- Garder deux ou trois séances avec quelques efforts à allure de course, courtes, pour garder le tonus.\n- **Ne pas** ajouter de nouveauté (matériel, nutrition, séance inconnue).\n- Prévenir que se sentir lourd ou nerveux est normal, et que la forme de fond (CTL) baisse légèrement tandis que la fraîcheur (TSB) monte.\n- Ne jamais proposer de séance de « rattrapage » dans les 7 derniers jours.",
    "pieges": "- Arrêter complètement à J-5.\n- Annoncer un gain précis en pourcentage : les chiffres de blogs ne sont pas vérifiés.",
    "sources": [
      {
        "titre": "Effects of tapering on performance in endurance athletes: a systematic review and meta-analysis (PLOS ONE, 2023)",
        "url": "https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0282838"
      },
      {
        "titre": "Effects of Tapering on Performance: a meta-analysis (Bosquet et al., 2007)",
        "url": "https://www.semanticscholar.org/paper/Effects-of-tapering-on-performance:-a-Bosquet-Montpetit/a41517ab5fa06b92568b861e2b1aa32b3003d214"
      },
      {
        "titre": "The Effects of Tapering on Performance in Elite Endurance Runners: A Systematic Review",
        "url": "https://www.academia.edu/35885593/The_Effects_of_Tapering_on_Performance_in_Elite_Endurance_Runners_A_Systematic_Review"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "allure-course-marathon",
    "titre": "Gérer son allure en course (marathon et au-delà)",
    "sports": [
      "course",
      "velo",
      "triathlon"
    ],
    "motsCles": [
      "allure",
      "pacing",
      "negative split",
      "départ trop rapide",
      "marathon",
      "mur",
      "stratégie de course",
      "régularité",
      "jour de course"
    ],
    "preuve": "probable",
    "maj": "2026-11-07",
    "essentiel": "- Une allure **régulière** est associée aux meilleurs temps au marathon, à tous les niveaux.\n- Le « négatif split » (deuxième moitié plus rapide) est rare chez les amateurs et n'est **pas** automatiquement meilleur.",
    "recherche": "- Analyse à grande échelle des temps de passage (*PLOS ONE*, année non vérifiée) : l'allure **régulière** est la plus liée à de bonnes performances sur tout le spectre des participants. Selon la classification utilisée : 24,0 % des coureurs réguliers, 75,6 % qui ralentissent, **0,4 %** qui accélèrent.\n- Les records mondiaux suivent un profil régulier ou légèrement négatif (revue citée par une source secondaire).\n- Études **observationnelles** : l'allure régulière est associée à de bons temps, pas démontrée comme cause. Les définitions de « régulier » diffèrent selon les études.\n- Je n'ai rien trouvé dans cette recherche sur les allures de Daniels, les kilométrages hebdomadaires de Pfitzinger, ni sur la sortie longue (voir README, lacunes).",
    "regles": "- Conseiller un départ **légèrement prudent** (premiers kilomètres un peu plus lents que l'allure visée), puis régulier ; ne pas chercher à « gagner du temps » en début de course.\n- Ajuster l'allure cible à la **chaleur**, au vent et au dénivelé ; éviter de s'accrocher à un objectif chiffré dans des conditions défavorables.\n- Répéter cette allure à l'entraînement dans des séances spécifiques.\n- Ne pas promettre un temps précis : l'application ne prédit pas encore la performance (cadrage de la prédiction avec fourchette).",
    "pieges": "- Partir sur les allures des premiers kilomètres excités.\n- Faire une grosse séance dure la semaine précédente pour « se tester » (voir [[affutage]]).",
    "sources": [
      {
        "titre": "Pacing strategy patterns and performance outcomes in marathon running (PLOS ONE)",
        "url": "https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0352808"
      },
      {
        "titre": "Même étude (PMC)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC13379030/"
      },
      {
        "titre": "The physiology and psychology of negative splits (2025)",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12307312/"
      },
      {
        "titre": "Marathon pacing strategies: Is negative splitting really the holy grail?",
        "url": "https://www.statisticsviews.com/article/marathon-pacing-strategies-is-negative-splitting-really-the-holy-grail/"
      }
    ],
    "voirAussi": [
      "affutage"
    ]
  },
  {
    "id": "chaleur-altitude",
    "titre": "Chaleur et altitude",
    "sports": [
      "course",
      "velo",
      "triathlon",
      "natation"
    ],
    "motsCles": [
      "chaleur",
      "canicule",
      "acclimatation",
      "altitude",
      "stage en altitude",
      "live high train low",
      "sauna",
      "hydratation",
      "coup de chaleur",
      "hypoxie",
      "chaud",
      "chaude",
      "température",
      "soleil",
      "déshydratation"
    ],
    "preuve": "probable",
    "maj": "2026-11-07",
    "essentiel": "- **Chaleur** : s'habituer prend environ **5 à 14 jours** d'expositions régulières. Elle aide surtout à courir **dans** la chaleur.\n- **Altitude** : « vivre haut, s'entraîner bas » peut améliorer la performance au niveau de la mer, avec de grandes différences individuelles, et seulement pour des camps de 3-4 semaines à altitude modérée.",
    "recherche": "- Chaleur : méta-analyse d'essais (Guy et al., 2015) : l'optimum semble à **15 jours ou plus**, mais les gains temps-contre-la-montre les plus nets viennent de deux études de 5 jours. Un protocole court de **7 jours ou moins** suffit à adapter. Chez les femmes, 9 jours ont amélioré la performance mais pas 4. Trois séances en chaleur ont aidé en cyclisme dans la chaleur, sans effet par temps tempéré.\n- Décroissance : au moins 5 jours d'acclimatation donnent des adaptations stables de la FC et de la température centrale ; la sudation demande plus longtemps.\n- Chaleur passive (sauna ou bain chaud après l'effort), méta-analyse 2024 : effets **triviaux**.\n- Altitude : Bonetti et Hopkins (2009) rapportent environ 4 % pour vivre haut/s'entraîner bas ; l'étude de coureurs d'élite américains donne +1,1 % sur 3 000 m après 27 jours à 2 500 m. La dose compte : vivre vers 2 085-2 454 m a donné 2 à 3 % sur 3 km, pas à 1 780 ni 2 800 m. Certains athlètes **se dégradent** malgré le stage.\n- Je n'ai pas pu lire les méta-analyses récentes citées par un blog (2023, 2024).",
    "regles": "- Course en climat chaud : proposer 1 à 2 semaines avant, **séances de 60 à 90 minutes dans la chaleur, 5 à 10 jours** (pratique), à allure et FC réduites, avec boisson régulière.\n- **Sécurité** : nausées, vertiges, confusion, arrêt de la sudation, frissons en pleine chaleur = arrêter, se mettre au frais, appeler les secours si ça ne passe pas.\n- Altitude : ne pas conseiller de stage sans avis médical (fer, santé cardiaque) ; ne pas le recommander aux débutants.\n- Ne pas promettre de gain précis.",
    "pieges": "- « Le sauna remplace l'acclimatation » : les effets mesurés sont triviaux.\n- Boire à l'excès : se limiter à la soif et aux conseils adaptés.",
    "sources": [
      {
        "titre": "Physiological Responses to Heat Acclimation: A Systematic Review and Meta-Analysis of RCTs (JSSM)",
        "url": "https://www.jssm.org/reviewjssm-18-316.xml.xml"
      },
      {
        "titre": "Heat Acclimation Decay and Re-Induction: A Systematic Review and Meta-Analysis",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC5775394/"
      },
      {
        "titre": "Post-exercise heat exposure (passive heat acclimation) – systematic review and meta-analysis (2024)",
        "url": "https://link.springer.com/article/10.1186/s13102-024-01038-6"
      },
      {
        "titre": "Defining the \"dose\" of altitude training (J Appl Physiol, 2014)",
        "url": "https://journals.physiology.org/doi/full/10.1152/japplphysiol.00634.2013"
      },
      {
        "titre": "\"Living High-Training Low\" altitude training improves sea level performance in elite runners",
        "url": "https://pubmed.ncbi.nlm.nih.gov/11509506/"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "charge-forme-fraicheur",
    "titre": "Charge, forme de fond (CTL), fatigue (ATL), fraîcheur (TSB)",
    "sports": [
      "course",
      "velo",
      "natation",
      "triathlon",
      "muscu",
      "hyrox"
    ],
    "motsCles": [
      "CTL",
      "ATL",
      "TSB",
      "TSS",
      "TRIMP",
      "charge",
      "forme",
      "fatigue",
      "fraîcheur",
      "Banister",
      "performance management"
    ],
    "preuve": "probable",
    "maj": "2026-11-07",
    "essentiel": "- **TSS** : la charge d'une séance. **CTL** : forme de fond (moyenne lente de la charge). **ATL** : fatigue récente (moyenne rapide). **TSB** : fraîcheur = CTL − ATL (négatif = fatigué).\n- Ce sont des **repères descriptifs**, utiles pour suivre une tendance. Ce ne sont pas des prédicteurs fiables de la performance ni du risque de blessure.\n- Dans l'application : TSS (puissance) d'abord, sinon TRIMP (cardio), sinon effort ressenti × durée. **Le code calcule ces chiffres, le coach les lit.**",
    "recherche": "- Ces indicateurs viennent du modèle « fitness-fatigue » de Banister. Les critiques sont sérieuses : paramètres difficiles à estimer, statistiques fragiles, et le terme de fatigue n'améliore pas toujours la prédiction par rapport à la seule forme (étude 2025). Le modèle suppose un seul temps de réaction alors que les adaptations (cœur, mitochondries) n'ont pas la même durée.\n- Des défenseurs rappellent que les alternatives (apprentissage automatique) sont moins lisibles.\n- Le TSS corrige certaines limites du TRIMP, car la FC est un marqueur d'intensité imparfait. Il dépend toutefois d'un FTP à jour.\n- Aucune étude trouvée ne valide directement CTL/ATL/TSB comme outil de prédiction de performance.\n- Convention de TrainingPeaks (connaissance générale, non rechargée) : CTL sur environ 42 jours, ATL sur environ 7 jours.",
    "regles": "- Parler de **tendance** : « ta forme de fond monte depuis trois semaines », pas de prédiction : « tu seras prêt le jour J ».\n- TSB : très négatif = fatigue marquée, prudence ; proche de zéro ou positif = frais. Les seuils exacts ne sont pas établis, ne pas les présenter comme des lois.\n- Ne **jamais calculer** ni recalculer un chiffre. Citer seulement ceux du contexte.\n- Si `qualite.peu_de_donnees` est vrai : le dire et rester prudent.\n- Si le TSS d'une séance paraît bizarre (FTP périmé, capteur), le dire plutôt que d'en tirer une conclusion.",
    "pieges": "- Présenter le TSB comme un score de « readiness » médical.\n- Comparer le CTL de deux personnes : il dépend du FTP, du capteur et du sport.",
    "sources": [
      {
        "titre": "The Use of Fitness-Fatigue Models for Sport Performance Modelling (Machine-Learning, 2022)",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8894528/"
      },
      {
        "titre": "Statistical flaws of the fitness-fatigue sports performance prediction model",
        "url": "https://www.researchgate.net/publication/388488104_Statistical_flaws_of_the_fitness-fatigue_sports_performance_prediction_model"
      },
      {
        "titre": "Rationale and resources for teaching the mathematical modeling of athletic training (Advances in Physiology Education)",
        "url": "https://journals.physiology.org/doi/pdf/10.1152/advan.00078.2011"
      },
      {
        "titre": "Bayesian inference of the impulse-response model (SportRxiv)",
        "url": "https://sportrxiv.org/index.php/server/preprint/view/246"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "cycle-menstruel",
    "titre": "Cycle menstruel et entraînement",
    "sports": [
      "course",
      "velo",
      "natation",
      "triathlon",
      "muscu",
      "hyrox"
    ],
    "motsCles": [
      "cycle menstruel",
      "règles",
      "phase lutéale",
      "phase folliculaire",
      "contraception",
      "hormones",
      "syndrome prémenstruel",
      "femmes",
      "aménorrhée",
      "mes règles",
      "menstruations"
    ],
    "preuve": "debattu",
    "maj": "2026-11-07",
    "essentiel": "- Les effets de la phase du cycle sur la performance sont **petits et incohérents** d'une étude à l'autre. Il n'y a **pas de preuve** pour adapter le plan automatiquement à la phase.\n- Le plus utile est de **suivre ses propres symptômes** et d'ajuster selon le ressenti.",
    "recherche": "- Méta-analyses : possibles baisses légères de la performance en **début de phase folliculaire** (règles), preuves de **faible qualité** ; aucune différence nette de VO2max chez des athlètes d'élite entre phases.\n- Force : une revue des revues ne trouve **aucune influence** sur la force aiguë ni les adaptations à la musculation.\n- Les études sont hétérogènes (phases mal confirmées, petits échantillons). Les auteurs réclament de meilleurs protocoles avant toute prescription individualisée.\n- Contraception hormonale : je n'ai pas trouvé de synthèse fiable dans cette recherche.",
    "regles": "- Ne **pas** modifier un plan sur la seule base de la phase du cycle.\n- Si l'utilisatrice suit son cycle et a **autorisé** le partage (catégorie « cycle »), l'utiliser pour **comprendre** ses ressentis : si elle se sent plus fatiguée à certains moments, proposer d'alléger ces jours-là.\n- **Règles absentes ou irrégulières** avec un volume élevé : possible signe d'un manque d'énergie ([[energie-reds]]) : orienter vers un médecin, pas de diagnostic.\n- Douleurs intenses, saignements abondants : avis médical.",
    "pieges": "- « À la phase lutéale, évite l'intensité » : pas démontré.\n- Considérer que toutes les utilisatrices ont un cycle régulier.",
    "sources": [
      {
        "titre": "The Effects of Menstrual Cycle Phase on Elite Athlete Performance: A Critical and Systematic Review",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8170151/"
      },
      {
        "titre": "Menstrual cycle and athletic performance: a systematic review and meta-analysis (Lisbonne)",
        "url": "https://researchportal.ulisboa.pt/en/publications/menstrual-cycle-and-athletic-performance-a-systematic-review-and-/"
      },
      {
        "titre": "The Influence of Menstrual Cycle Phases on Maximal Strength Performance: Systematic Review with Meta-Analysis",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10818650/"
      },
      {
        "titre": "Menstrual Cycle Phases Influence on Cardiorespiratory Response to Exercise in Endurance-Trained Females",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7908534/"
      }
    ],
    "voirAussi": [
      "energie-reds"
    ]
  },
  {
    "id": "energie-reds",
    "titre": "Manque d'énergie chronique (REDs)",
    "sports": [
      "course",
      "velo",
      "natation",
      "triathlon",
      "hyrox"
    ],
    "motsCles": [
      "REDs",
      "RED-S",
      "déficit énergétique",
      "manger assez",
      "perdre du poids",
      "maigrir",
      "régime",
      "fracture de fatigue",
      "règles",
      "aménorrhée",
      "alimentation",
      "restriction"
    ],
    "preuve": "etabli",
    "maj": "2026-11-07",
    "essentiel": "- Quand le corps reçoit **moins d'énergie qu'il n'en dépense** sur la durée (volume élevé, recherche de légèreté), la santé et la performance en pâtissent. Le syndrome s'appelle REDs.\n- C'est un sujet de **sécurité** : le coach n'encourage jamais un déficit calorique pendant un entraînement chargé.",
    "recherche": "- Consensus du CIO (*BJSM*, 2023) : le REDs est un syndrome multifactoriel dû à une faible disponibilité énergétique. L'exposition se situe sur un **continuum** entre adaptable et problématique, avec des effets sur la santé (os, règles, système immunitaire, humeur…) et la performance.\n- En endurance, les causes citées : volumes extrêmes, recherche de rapport poids/puissance, désir de minceur excessive.\n- Nouveautés 2023 : un outil d'évaluation gratuit validé (IOC REDs CAT2), le rôle de la **faible disponibilité en glucides** en plus de l'énergie, le recoupement avec le surentraînement et la santé mentale.\n- Critique : la disponibilité énergétique est **impossible à mesurer précisément** hors laboratoire, donc le diagnostic repose sur les symptômes et les facteurs de risque ; la preuve empirique du modèle est limitée.\n- Je n'ai pas lu le texte complet du consensus, seulement les pages qui le résument.",
    "regles": "- Ne **jamais** donner d'objectif de poids, de calories à couper ni de régime. Pas de conseil de perte de poids rapide pendant un bloc d'entraînement.\n- Signes d'alerte à reconnaître : perte de poids non voulue avec un volume élevé, blessures osseuses répétées, règles absentes ou irrégulières (femmes), fatigue chronique, maladies fréquentes, obsession alimentaire ou culpabilité après avoir mangé.\n- Dans ce cas : **ne pas poser de diagnostic**, parler avec bienveillance, orienter vers un médecin ou un diététicien du sport, et proposer d'alléger la charge.\n- Rappeler que manger avant, pendant et après les grosses séances est normal et utile.",
    "pieges": "- Féliciter une perte de poids rapide.\n- Conseiller de s'entraîner à jeun de manière systématique.",
    "sources": [
      {
        "titre": "2023 IOC consensus statement on Relative Energy Deficiency in Sport (REDs)",
        "url": "https://www.researchgate.net/publication/374201706_2023_International_Olympic_Committee's_IOC_consensus_statement_on_Relative_Energy_Deficiency_in_Sport_REDs"
      },
      {
        "titre": "PDF du CIO",
        "url": "https://stillmed.olympics.com/media/Documents/Athletes/Medical-Scientific/Consensus-Statements/REDs/BJSM-IOC-consensus-statement-on-Relative-Energy-Deficiency-in-Sport-REDs.pdf"
      },
      {
        "titre": "2023 IOC Consensus Statement on REDs: What's new?",
        "url": "https://pinesnutrition.org/2023-ioc-consensus-statement-on-reds-whats-new/"
      },
      {
        "titre": "Does REDs Syndrome Exist? (critique)",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11561064/"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "entrainement-concurrent",
    "titre": "Force et endurance dans la même semaine (entraînement concurrent)",
    "sports": [
      "course",
      "velo",
      "triathlon",
      "hyrox",
      "muscu"
    ],
    "motsCles": [
      "concurrent",
      "interférence",
      "force et cardio",
      "même jour",
      "ordre des séances",
      "hybride",
      "jambes",
      "enchaîner",
      "prise de muscle",
      "cardio gâche"
    ],
    "preuve": "probable",
    "maj": "2026-11-07",
    "essentiel": "- Faire de l'endurance **et** de la force est tout à fait compatible. L'« effet d'interférence » existe mais il est **petit** dans les analyses récentes, et il dépend surtout de l'espacement des séances.",
    "recherche": "- Méta-analyse de Wilson et al. (2012) : enchaîner dans la même séance, surtout avec de la course, réduit un peu les gains de force et de masse par rapport à séparer les séances sur des jours différents.\n- Une méta-analyse indique que les adaptations de force et de puissance sont freinées si moins de **6 heures** séparent les deux séances (citée par une revue secondaire).\n- Ordre dans la séance : faire la **force avant l'endurance** est favorable à la force des jambes, au moins quand l'endurance est de faible intensité.\n- Méta-analyse 2023 (*Sports Medicine*) : petite interférence sur la force des jambes chez les **hommes**, pas chez les **femmes** ; sur la puissance, petite à moyenne interférence chez des sportifs d'endurance entraînés qui débutent la force.\n- D'autres chiffres vus dans des blogs (taille d'effet environ −0,35 chez les entraînés) : non vérifiés.",
    "regles": "- Idéal : séances de force et séances dures d'endurance **sur des jours différents**, ou au moins **6 heures** d'écart.\n- Même séance : **force d'abord**, endurance facile ensuite.\n- Pas de grosse séance de jambes la veille d'une séance de qualité en course ou en vélo.\n- Pour un hybride (Hyrox) : accepter qu'on ne maximise pas chaque qualité, et choisir la priorité du bloc en cours.\n- Cohérent avec [[force-pour-endurants]].",
    "pieges": "- Dire que le cardio « tue les gains » : l'effet est petit et dépend de l'organisation.\n- Placer jambes lourdes et fractionné de course le même matin sans le signaler.",
    "sources": [
      {
        "titre": "Concurrent Training: A Meta-Analysis Examining Interference of Aerobic and Resistance Exercises (Wilson 2012)",
        "url": "https://www.semanticscholar.org/paper/Concurrent-Training:-A-Meta-Analysis-Examining-of-Wilson-Mar%C3%ADn/26fb11d95a94c238a4cd70dd5df04a5bce2aa9ba"
      },
      {
        "titre": "The Role of Intra-Session Exercise Sequence in the Interference Effect (2017)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC5752732/"
      },
      {
        "titre": "Concurrent Strength and Endurance Training: Impact of Sex and Training Status (Sports Medicine, 2023)",
        "url": "https://link.springer.com/article/10.1007/s40279-023-01943-9"
      },
      {
        "titre": "Concurrent training (Hughes, 2022)",
        "url": "https://eprints.glos.ac.uk/10611/9/10611-Hughes-(2022"
      }
    ],
    "voirAussi": [
      "force-pour-endurants"
    ]
  },
  {
    "id": "force-pour-endurants",
    "titre": "Musculation pour les sportifs d'endurance",
    "sports": [
      "course",
      "velo",
      "triathlon",
      "natation",
      "hyrox"
    ],
    "motsCles": [
      "musculation",
      "renforcement",
      "force",
      "charges lourdes",
      "économie de course",
      "gainage",
      "pliométrie",
      "squat",
      "deadlift",
      "pourquoi se muscler"
    ],
    "preuve": "probable",
    "maj": "2026-11-07",
    "essentiel": "- Une à deux séances de **force à charges lourdes** par semaine améliorent l'**économie de course** et des performances de contre-la-montre, **sans** faire grossir ni changer la VO2max.",
    "recherche": "- Coureurs : méta-analyse chez des coureurs très entraînés, effet **grand** sur l'économie de course (SMD environ −1,4). Comparaison charges lourdes contre pliométrie : charges lourdes un peu plus efficaces (g −0,32 contre −0,13). Charges proches du maximum (**90 % du 1RM ou moins de 4 répétitions maximum**) et programmes d'au moins **10 semaines** semblent les meilleurs.\n- Revue plus récente (coureurs de demi-fond et fond) : charges lourdes, pliométrie et méthodes combinées améliorent l'économie ; les charges sous-maximales et les isométriques semblent moins efficaces. Pliométrie plus adaptée aux vitesses basses, charges lourdes aux vitesses élevées.\n- Cyclistes : méta-analyse 2025 : la force lourde améliore le temps jusqu'à épuisement et le contre-la-montre ; les effets sur la physiologie sont petits.\n- Duathlètes (femmes bien entraînées) : la force lourde améliore la course et le vélo après un effort prolongé.\n- Limites : essais petits, peu d'effet démontré sur la VO2max, le lactate et la composition corporelle.",
    "regles": "- **1 à 2 séances par semaine**, exercices de base (squat, fentes, soulevé de terre, tirage/poussée), séries lourdes de **3 à 6 répétitions** pour les confirmés. Débutants : 4 à 6 semaines d'apprentissage de la technique avant les charges lourdes.\n- Placer la séance de force **à distance** des séances dures de course ou de vélo (voir [[entrainement-concurrent]]).\n- Réduire (sans arrêter) pendant l'affûtage ; garder une séance par quinzaine pour entretenir.\n- Rassurer : peu de séries lourdes ne font **pas** de masse en excès.\n- Douleur articulaire, antécédent de blessure : orienter vers un professionnel avant les charges lourdes.",
    "pieges": "- Faire des séries en fatigue extrême à la veille d'une sortie clé.\n- Remplacer la course ou le vélo par de la salle.",
    "sources": [
      {
        "titre": "Effects of Strength Training on Running Economy in Highly Trained Runners (méta-analyse)",
        "url": "https://www.academia.edu/33389784/Effects_of_Strength_Training_on_Running_Economy_in_Highly_Trained_Runners_A_Systematic_Review_With_Meta_Analysis_of_Controlled_Trials"
      },
      {
        "titre": "Heavy Resistance Training Versus Plyometric Training for Improving Running Economy… (Sports Medicine – Open, 2022)",
        "url": "https://link.springer.com/article/10.1186/s40798-022-00511-1"
      },
      {
        "titre": "The Effect of Strength Training Methods on Middle-Distance and Long-Distance Runners' Performance (2024)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11258194/"
      },
      {
        "titre": "Heavy strength training effects on physiological determinants of endurance cyclist performance (2025)",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12881108/"
      },
      {
        "titre": "Heavy strength training improves running and cycling performance following prolonged submaximal work in well-trained female athletes",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5350167/"
      }
    ],
    "voirAussi": [
      "entrainement-concurrent"
    ]
  },
  {
    "id": "hrv-suivi-recuperation",
    "titre": "VFC (HRV), fréquence cardiaque de repos et suivi de la récupération",
    "sports": [
      "course",
      "velo",
      "natation",
      "triathlon"
    ],
    "motsCles": [
      "HRV",
      "VFC",
      "variabilité cardiaque",
      "fréquence cardiaque de repos",
      "récupération",
      "readiness",
      "montre",
      "fatigue",
      "Garmin",
      "Whoop"
    ],
    "preuve": "debattu",
    "maj": "2026-11-07",
    "essentiel": "- La VFC et la FC de repos donnent des **indices** sur la fatigue, surtout en **tendance sur plusieurs jours** par rapport au niveau habituel de la personne.\n- Piloter l'entraînement avec la VFC n'est **pas clairement meilleur** qu'un plan fixe pour la performance.",
    "recherche": "- Düking et al. (*JSAMS*, 2021) : 8 études, 198 participants. L'entraînement guidé par la VFC a un effet **moyen** sur des paramètres physiologiques sous-maximaux, mais un effet **petit et non significatif** sur la performance et la VO2peak.\n- Autre méta-analyse (*IJERPH*, 2020) : effet faible sur la VO2max en faveur de la VFC (taille d'effet environ 0,19).\n- Revue méthodologique (2021) : l'entraînement guidé par la VFC peut mieux préserver la VFC vagale avec moins de réponses négatives, mais les bonnes pratiques de mesure (indice choisi, position, référence) restent à établir.\n- Une revue plus tardive conclut que l'approche n'est pas supérieure pour la VO2max.\n- Je n'ai pas cherché de revue plus récente que 2021.",
    "regles": "- La VFC des montres est **bruitée** : ne jamais conclure sur une seule nuit ni sur une seule valeur.\n- Regarder la **tendance sur 7 jours**, le sommeil et le ressenti ensemble. Une FC de repos qui monte et un sommeil qui se dégrade plaident pour du facile.\n- Le coach n'est pas médecin : pas d'interprétation médicale, pas de diagnostic. Le **garde-fou santé** de l'application a le dernier mot sur les séances proposées, et le coach respecte sa consigne sans la discuter.\n- Si l'utilisateur n'a pas autorisé le partage de la santé, ne pas insister.",
    "pieges": "- « Ta VFC est basse donc tu es en surentraînement » : non.\n- Comparer la VFC de deux personnes ou de deux appareils.",
    "sources": [
      {
        "titre": "Monitoring and adapting endurance training on the basis of HRV monitored by wearable technologies (JSAMS, 2021)",
        "url": "https://www.sciencedirect.com/science/article/pii/S1440244021001080"
      },
      {
        "titre": "HRV-Based Training for Improving VO2max in Endurance Athletes (IJERPH, 2020)",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7663087/"
      },
      {
        "titre": "HRV-Guided Training for Enhancing Cardiac-Vagal Modulation… (méta-analyse méthodologique, 2021)",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8507742/"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "hyrox",
    "titre": "Hyrox : ce qui fait la performance",
    "sports": [
      "hyrox"
    ],
    "motsCles": [
      "Hyrox",
      "traîneau",
      "sled",
      "wall balls",
      "fentes",
      "skierg",
      "rameur",
      "course entre les stations",
      "compromised running",
      "hybride"
    ],
    "preuve": "probable",
    "maj": "2026-11-07",
    "essentiel": "- Hyrox est surtout **une course à pied** entrecoupée de huit stations. Le moteur aérobie et le volume d'endurance pèsent plus lourd que la force maximale.\n- Les données sont **peu nombreuses** et transposées depuis le CrossFit, l'entraînement concurrent et la course.",
    "recherche": "- Étude de simulation (*Frontiers in Physiology*, 2025) : le temps de course et le traîneau expliquent **65 à 70 %** du résultat ; en ajoutant fentes et wall balls, **86 à 88 %**.\n- VO2max plus haute, plus grand volume d'endurance et moins de masse grasse vont avec de meilleurs temps. La force maximale (par exemple la poigne) est **faiblement liée** au temps final.\n- Revue de la NSCA (*Strength & Conditioning Journal*) : capacité aérobie, puissance anaérobie et endurance musculaire locale sont les déterminants clés ; la force maximale est probablement utile (économie, résistance à la fatigue) même si aucune station ne la teste directement.\n- Les auteurs mettent en garde : la mécanique des mouvements, le rapport effort/repos et les charges fixes du traîneau peuvent changer l'importance de chaque facteur.",
    "regles": "- Construire d'abord la **base aérobie** et le volume de course, puis la spécificité.\n- 1 à 2 séances par semaine travaillant les **stations** (traîneau, fentes, wall balls, rameur/skierg), et de temps en temps une séance avec **course entre les stations** (course sur jambes fatiguées).\n- Entretenir la force avec 1 à 2 séances de musculation (voir [[force-pour-endurants]] et [[entrainement-concurrent]]).\n- Mettre l'allure de course avant la vitesse de chaque station : partir trop vite sur les premières stations coûte cher plus tard.\n- Rappel : l'application ne propose pas encore de séances Hyrox générées par le coach.",
    "pieges": "- « Hyrox, c'est de la muscu » : les données disent le contraire.\n- Utiliser des chiffres de CrossFit sans les présenter comme tels.",
    "sources": [
      {
        "titre": "Acute physiological responses and performance determinants in Hyrox (Frontiers, 2025)",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11994925/"
      },
      {
        "titre": "A Performance Analysis of HYROX: A Review of the Physiologic, Mechanical, and Technical Demands (NSCA)",
        "url": "https://www.ovid.com/jnls/nsca-scj/fulltext/10.1519/ssc.0000000000000913~a-performance-analysis-of-hyrox-a-review-of-the-physiologic"
      },
      {
        "titre": "Frontiers in Physiology, 2025 (article lié)",
        "url": "https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2025.1519240/full"
      }
    ],
    "voirAussi": [
      "force-pour-endurants",
      "entrainement-concurrent"
    ]
  },
  {
    "id": "intensite-distribution",
    "titre": "Répartition des intensités (polarisé, pyramidal, seuil)",
    "sports": [
      "course",
      "velo",
      "natation",
      "triathlon"
    ],
    "motsCles": [
      "polarisé",
      "pyramidal",
      "80/20",
      "seuil",
      "zone 3",
      "ventre mou",
      "répartition",
      "intensité",
      "zones",
      "séances dures"
    ],
    "preuve": "probable",
    "maj": "2026-11-07",
    "essentiel": "- Le gros du temps d'entraînement se fait en facile (sous le premier seuil, zones 1-2), un peu de dur, et peu de temps « moyen » (zone 3) sauf entraînement spécifique.\n- Entre « polarisé » (facile + très dur, presque rien au milieu) et « pyramidal » (beaucoup de facile, un peu de moyen, un peu de dur), **la recherche ne désigne pas de gagnant net**.\n- Ce qui est fiable : la régularité, un volume facile solide, et une ou deux séances dures bien placées.",
    "recherche": "- Méta-analyse 2024 (*Sports Medicine*, Oliveira et al.) : le polarisé améliore un peu plus la VO2peak que les autres répartitions (effet petit), surtout sur des périodes de **moins de 12 semaines** et chez les sportifs très entraînés. Au-delà de 12 semaines, la VO2peak progresse de façon similaire. **Aucune supériorité démontrée sur les autres mesures de performance.**\n- Une méta-analyse 2025 sur données individuelles, citée par un site secondaire (non vérifiée à la source), ne trouve **pas de différence significative** entre polarisé et pyramidal.\n- La méta-analyse polarisé contre seuil (Rosenblat et al., 2018) existe, mais je n'en ai vu que le titre : ses chiffres ne sont pas repris ici.\n- Connaissance générale (non rechargée dans cette recherche) : l'idée « environ 80 % du temps en facile, 20 % en dur » vient des observations de Stephen Seiler sur des athlètes d'élite.",
    "regles": "- Par défaut, viser **environ trois quarts à quatre cinquièmes du temps en zones 1-2**. Mesurer en **temps**, pas en nombre de séances.\n- Séances dures par semaine : **1** pour un débutant, **1 à 2** pour un confirmé, **2 à 3 au plus** pour un avancé, jamais deux jours de suite.\n- Si la forme est basse ou la fatigue haute, **remplacer une séance dure par du facile** plutôt que de tout décaler.\n- Si l'utilisateur fait tout « à moitié dur », lui expliquer sans moraliser : trop de zone 3 fatigue sans donner le meilleur de chaque côté.\n- Présenter le polarisé et le pyramidal comme **deux bons choix**, pas comme un dogme.",
    "pieges": "- « Le polarisé est prouvé supérieur » : faux, l'effet est petit et limité.\n- Les zones n'ont pas la même définition partout (3 zones, 5 zones, 7 zones) : toujours préciser de quelle échelle on parle, ou utiliser les zones de l'application.",
    "sources": [
      {
        "titre": "Comparison of Polarized Versus Other Types of Endurance Training Intensity Distribution… (Sports Medicine, 2024)",
        "url": "https://link.springer.com/article/10.1007/s40279-024-02034-z"
      },
      {
        "titre": "Même article, texte intégral (PMC)",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11329428/"
      },
      {
        "titre": "Polarized vs. Threshold Training Intensity Distribution… (Rosenblat et al., titre seulement)",
        "url": "https://www.researchgate.net/publication/325492365_Polarized_vs_Threshold_Training_Intensity_Distribution_on_Endurance_Sport_Performance_A_Systematic_Review_and_Meta-Analysis_of_Randomized_Controlled_Trials"
      },
      {
        "titre": "fitnessgrid",
        "url": "https://fitnessgrid.app/research/polarized-vs-pyramidal-training-distribution-cycling"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "intervalles-haute-intensite",
    "titre": "Intervalles de haute intensité (VO2max)",
    "sports": [
      "course",
      "velo",
      "natation",
      "triathlon"
    ],
    "motsCles": [
      "HIIT",
      "intervalles",
      "4x4",
      "VO2max",
      "fractionné",
      "15/15",
      "sprint",
      "séance dure",
      "VMA"
    ],
    "preuve": "probable",
    "maj": "2026-11-07",
    "essentiel": "- Les intervalles **longs (3 à 5 minutes) à intensité dure mais tenable** sont l'outil le plus étudié pour faire monter la VO2max.\n- Les sprints très courts et très intenses sont plus risqués et pas meilleurs pour la VO2max.",
    "recherche": "- Helgerud et al. (2007) : 4 × 4 minutes à 90-95 % de la FC max, récupération 3 minutes active, a augmenté la VO2max de **7,2 %**, contre 5,5 % pour des 15 s/15 s, et moins pour les groupes modérés. Petite étude, menée par les concepteurs du protocole.\n- Essai 2023 sur **81 femmes bien entraînées** (8 semaines) : seuls les 4 × 4 minutes ont fait monter la VO2max (+7,3 %). Les protocoles de sprint (8 × 20 s, 10 × 30 s) ont moins marché, et les 10 × 30 s ont causé **plus de blessures**.\n- Méta-analyse de Milanović (2013, 37 études) : l'entraînement par intervalles améliore la VO2max ; ma recherche n'a pas confirmé sa conclusion sur la durée idéale des intervalles.\n- Aucune méta-analyse trouvée ne compare directement le 4 × 4 aux autres durées d'intervalles.",
    "regles": "- Séance type : échauffement 10 à 15 minutes, **3 à 5 intervalles de 3 à 5 minutes** à intensité « dure, mais je pourrais encore dire quelques mots », récupération facile de 2 à 3 minutes.\n- **1 à 2 séances dures par semaine au maximum**, jamais deux jours de suite.\n- Ne pas proposer de séance dure pendant une maladie, avec une fatigue très haute ou si le garde-fou a limité la journée.\n- Réserver les sprints courts aux avancés en bonne santé, et en prévenir.\n- Le volume facile reste la base : les intervalles s'ajoutent, ils ne le remplacent pas.",
    "pieges": "- Dire que 4 × 4 minutes est « le meilleur protocole » : les preuves viennent surtout d'un groupe de recherche.\n- Chiffrer l'intensité en % de FC max sans prévenir que la FC max varie d'une personne à l'autre.",
    "sources": [
      {
        "titre": "Aerobic High-Intensity Intervals Improve VO2max More Than Moderate Training (Helgerud 2007)",
        "url": "https://www.researchgate.net/publication/6407035_Aerobic_High-Intensity_Intervals_Improve_VO2max_More_Than_Moderate_Training"
      },
      {
        "titre": "Aerobic high-intensity intervals improve VO2max more than supramaximal sprint intervals in females (2023)",
        "url": "https://pubmed.ncbi.nlm.nih.gov/37608507/"
      },
      {
        "titre": "VO2max Trainability and High Intensity Interval Training in Humans: A Meta-Analysis (2013)",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3774727/"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "methode-norvegienne",
    "titre": "Méthode norvégienne (double seuil)",
    "sports": [
      "course",
      "velo"
    ],
    "motsCles": [
      "norvégienne",
      "double seuil",
      "Ingebrigtsen",
      "lactate",
      "seuil",
      "deux séances par jour",
      "Bakken",
      "LT2"
    ],
    "preuve": "debattu",
    "maj": "2026-11-07",
    "essentiel": "- Beaucoup de volume facile, plus des séances au **seuil, découpées en intervalles** (souvent deux séances le même jour), pilotées par la mesure du lactate.\n- Populaire grâce aux athlètes norvégiens. La preuve scientifique directe reste **mince**.",
    "recherche": "- Il existe une revue systématique de la littérature sur la méthode (2023). Un site de coaching la résume comme « physiologiquement cohérente », je n'ai pas pu vérifier cette formule dans la revue elle-même.\n- Une étude de l'université norvégienne NTNU (petite) : 6 × 10 minutes en une fois contre 2 × 3 × 10 minutes séparées de 6,5 heures. La version séparée donne une FC et un lactate plus bas à la seconde séance, et moins de fatigue le lendemain.\n- La cible lactate rapportée est d'environ **2 à 4 mmol/L** selon les sources.\n- **Aucun grand essai contrôlé** ne compare la méthode au polarisé ou au pyramidal. Les résultats des frères Ingebrigtsen ne prouvent pas la méthode (déductions à partir de l'élite, pas de preuve causale).",
    "regles": "- Ne **jamais** proposer la double journée à un utilisateur loisir sans mesure de lactate : le risque de surcharge est réel.\n- Version accessible : remplacer une séance dure classique par une séance de **seuil en intervalles** (par exemple 4 à 6 × 6 à 10 minutes à intensité « confortablement dure ») une à deux fois par semaine, avec beaucoup de facile autour.\n- Sans lactate, piloter à la sensation et à la fréquence cardiaque, avec marge de prudence.\n- La présenter comme **une méthode de terrain populaire**, pas comme prouvée supérieure.",
    "pieges": "- « La méthode norvégienne a fait les records de Jakob Ingebrigtsen » : c'est une explication parmi d'autres.\n- Les blogs de coaching se contredisent sur qui a conçu quoi.",
    "sources": [
      {
        "titre": "Norwegian double-threshold method in distance running: Systematic literature review (2023)",
        "url": "https://www.researchgate.net/publication/376465773_Norwegian_double-threshold_method_in_distance_running_Systematic_literature_review"
      },
      {
        "titre": "How the \"Norwegian Method\" Is Changing Endurance Training (Outside)",
        "url": "https://www.outsideonline.com/health/training-performance/norwegian-method-jakob-ingebrigtsen/"
      },
      {
        "titre": "From Incremental Test to Continuous Running at Fixed Lactate Thresholds (2023)",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10611166/"
      },
      {
        "titre": "The Science of Double Threshold Workouts (résumé secondaire)",
        "url": "https://runnersconnect.net/the-science-of-double-threshold-workouts/"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "musculation-bases",
    "titre": "Musculation : volume, proximité de l'échec, semaine allégée",
    "sports": [
      "muscu",
      "hyrox",
      "course",
      "velo"
    ],
    "motsCles": [
      "musculation",
      "hypertrophie",
      "séries par semaine",
      "volume",
      "RIR",
      "échec musculaire",
      "répétitions en réserve",
      "fréquence",
      "deload",
      "prise de masse",
      "progression"
    ],
    "preuve": "probable",
    "maj": "2026-11-07",
    "essentiel": "- Pour la masse musculaire : **environ 10 séries et plus par groupe musculaire et par semaine** donnent de meilleurs résultats que moins ; plus de séries aident jusqu'à un certain point.\n- Aller **systématiquement à l'échec** n'est pas nécessaire ; laisser 1 à 3 répétitions en réserve marche très bien.",
    "recherche": "- Méta-régression 2025 (*Sports Medicine*) : relation dose-réponse **positive** entre volume hebdomadaire et gain de force, et aussi pour l'hypertrophie ; les seuils exacts varient selon les sources (9, 10, ou 10 à 20 séries par groupe pour des pratiquants entraînés), ils viennent surtout de Schoenfeld et al. (2017).\n- Fréquence : à volume égal, entraîner un muscle plus souvent aide d'après une méta-analyse, mais une revue des revues ne trouve pas de différence nette. **Les sources se contredisent.**\n- Proximité de l'échec (méta-analyse 2022) : **pas de supériorité de l'échec** sur l'arrêt avant l'échec pour l'hypertrophie. Les répétitions en réserve (RIR) influencent plus l'hypertrophie que la force. Les RIR ont été estimées d'après les descriptions des études.\n- Semaine allégée : un essai (Coleman et al., 2024) ne trouve aucun effet sur l'hypertrophie d'une semaine d'arrêt complet à mi-parcours, avec une petite baisse de force des jambes. Aucune preuve que les semaines allégées planifiées préviennent les blessures.",
    "regles": "- Débutant : 2 séances par semaine de corps entier, 2 à 3 séries par exercice, technique d'abord.\n- Intermédiaire : viser **10 à 20 séries par groupe et par semaine** réparties sur 2 séances ou plus, **1 à 3 RIR** sur la plupart des séries, progression de la charge ou des répétitions. Ces chiffres sont des repères, pas des lois.\n- Fatigue qui s'accumule, charges qui stagnent plusieurs semaines : réduire le **volume** (environ un tiers à la moitié) pendant une semaine plutôt que tout arrêter.\n- Douleur articulaire ou musculaire inhabituelle : arrêter l'exercice et orienter vers un professionnel.",
    "pieges": "- « Il faut aller à l'échec à chaque série ».\n- Prétendre à un nombre de séries « magique » identique pour tout le monde.",
    "sources": [
      {
        "titre": "The Resistance Training Dose-Response: Meta-Regressions… Weekly Volume and Frequency (Sports Medicine, 2025)",
        "url": "https://www.fisiologiadelejercicio.com/wp-content/uploads/2025/12/The-Resistance-Training-Dose-Response.pdf"
      },
      {
        "titre": "Influence of Resistance Training Proximity-to-Failure on Skeletal Muscle Hypertrophy (méta-analyse, 2022)",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9935748/"
      },
      {
        "titre": "Effects of Resistance Training Frequency on Measures of Muscle Hypertrophy (Schoenfeld)",
        "url": "https://paulogentil.com/pdf/Effects%20of%20Resistance%20Training%20Frequency%20on%20Measures%20of%20Muscle%20Hypertrophy%20-%20A%20Systematic%20Review%20and%20Meta-Analysis.pdf"
      },
      {
        "titre": "Gaining more from doing less? One-week deload (Coleman 2024)",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10809978/"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "natation-css",
    "titre": "Natation : vitesse critique (CSS) et intensités",
    "sports": [
      "natation",
      "triathlon"
    ],
    "motsCles": [
      "natation",
      "CSS",
      "vitesse critique",
      "allure au 100 m",
      "400 m 200 m",
      "test",
      "zones",
      "crawl",
      "piscine",
      "eau libre"
    ],
    "preuve": "pratique",
    "maj": "2026-11-07",
    "essentiel": "- La **vitesse critique de nage (CSS)** est une allure repère proche du seuil, mesurée avec deux courses (400 m et 200 m). Elle sert à fixer les allures des séries.\n- Dans l'application, l'allure de natation se lit **au 100 m**.",
    "recherche": "- Études de nageurs entraînés : la CSS sépare l'intensité « lourde » de l'intensité « sévère » ; au-dessus de la CSS, le métabolisme change (moins de lipides, plus de cycle de Krebs). Une intensité **sous la CSS** est nécessaire pour reconstituer la réserve d'effort entre des séries dures.\n- Test classique : deux courses maximales (400 m et 200 m) ; CSS en secondes pour 100 m = (T400 − T200) ÷ 2. Cette formule est donnée par un site de coaching ; je n'ai pas vérifié son origine dans la littérature.\n- La répartition « 70 à 80 % du volume sous la CSS » est une règle de coach, sans essai. Les zones diffèrent d'un guide à l'autre (échelle en % de la vitesse ou de l'allure) : il faut vérifier l'échelle.\n- Peu d'essais sur la natation par rapport à la course et au vélo.",
    "regles": "- Conseiller un test de CSS tous les 6 à 8 semaines, bien échauffé, avec repos complet entre le 400 m et le 200 m (pratique).\n- Séries : surtout sous la CSS, quelques séries à la CSS ou un peu au-dessus. Priorité à la **technique** pour les débutants (volumes courts, repos suffisants).\n- Zones : toujours préciser « allure au 100 m plus lente ou plus rapide que ta CSS ».\n- **Sécurité** : en eau libre, ne jamais nager seul, bouée de sécurité, attention à la température.",
    "pieges": "- Mélanger deux échelles de zones.\n- Augmenter le volume avant d'avoir une technique stable.",
    "sources": [
      {
        "titre": "Critical Swim Speed: Complete Guide (TrainingZones.io)",
        "url": "https://www.trainingzones.io/en/guides/critical-swim-speed"
      },
      {
        "titre": "Modeling the expenditure and reconstitution of distance above critical speed during two swimming interval training sessions",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9549135/"
      },
      {
        "titre": "Acute metabolite responses to swimming exercise of different intensities in highly trained swimmers",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12381355/"
      },
      {
        "titre": "Critical Swim Speed (CSS) Calculator – Top End Sports",
        "url": "https://www.topendsports.com/testing/tests/critical-swim-speed.htm"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "nutrition-glucides",
    "titre": "Glucides pendant l'effort et entraînement « à jeun » (train low)",
    "sports": [
      "course",
      "velo",
      "triathlon",
      "natation",
      "hyrox"
    ],
    "motsCles": [
      "glucides",
      "gel",
      "boisson",
      "90 g/h",
      "glucose fructose",
      "ravitaillement",
      "à jeun",
      "train low",
      "sleep low",
      "glycogène",
      "nutrition course",
      "tolérance digestive"
    ],
    "preuve": "probable",
    "maj": "2026-11-07",
    "essentiel": "- Plus l'effort est long, plus il faut des glucides pendant l'effort. Au-delà d'environ 2 h 30, des apports **jusqu'à 90 g par heure** avec un mélange de deux sucres sont recommandés, à **entraîner à l'avance**.\n- Faire des séances avec peu de glucides (« train low », « sleep low ») **n'améliore pas la performance en général**.",
    "recherche": "- Jeukendrup : un mélange glucose + fructose (environ 2:1) utilise deux transporteurs intestinaux (SGLT1 et GLUT5), permet une oxydation plus rapide (jusqu'à environ 90 g/h) et réduit les troubles digestifs. Bénéfice surtout pour les efforts de 2 h 30 ou plus. L'apport ne dépend pas du poids corporel.\n- La recommandation est passée de 60-70 g/h (2008) à 90 g/h (2012). En pratique, des cyclistes atteignent 90 à 120 g/h ; les valeurs au-delà de 90 g/h sont **une suggestion d'étude, pas une recommandation établie**.\n- Les sources principales viennent d'un même groupe de recherche : il n'existe pas ici de consensus d'un autre organisme.\n- Méta-analyse 2021 (*JISSN*) sur l'entraînement à faible disponibilité en glucides chez des sportifs bien entraînés : **aucun effet global** sur la performance (SMD 0,17 ; IC −0,15 à 0,49). Deux études « sleep low » trouvent environ 3 % de gain, une autre aucun. Les séances étaient jugées plus dures.\n- Connaissance générale (non rechargée ici) : pour les efforts de 1 à 2 h 30, environ 30 à 60 g/h suffisent ; la tolérance digestive s'entraîne.",
    "regles": "- Effort de plus d'environ 1 heure : conseiller de **boire et manger régulièrement**, en testant à l'entraînement.\n- Pas d'apport au-delà de 60 g/h sans l'avoir **testé** plusieurs fois à l'entraînement.\n- Ne pas recommander l'entraînement à jeun ou « train low » pour progresser : au mieux une option pour les séances faciles, avec prudence.\n- Si l'utilisateur est diabétique, a une maladie digestive ou suit un traitement : orienter vers un médecin ou un diététicien du sport.\n- Cohérent avec [[energie-reds]] : ne jamais pousser à manger moins.",
    "pieges": "- « 120 g/h pour tout le monde ».\n- Essayer un nouveau gel le jour de la course.",
    "sources": [
      {
        "titre": "Carbohydrate and exercise performance: the role of multiple transportable carbohydrates (Jeukendrup)",
        "url": "https://www.researchgate.net/publication/44698559_Carbohydrate_and_exercise_performance_The_role_of_multiple_transportable_carbohydrates"
      },
      {
        "titre": "Carbohydrate Ingestion during Exercise (Jeukendrup, 2012)",
        "url": "https://www.fisiologiadelejercicio.com/wp-content/uploads/2018/10/jeukendrup2012.pdf"
      },
      {
        "titre": "Multiple Transportable Carbohydrates and Their Benefits (GSSI)",
        "url": "https://www.gssiweb.org/en/sports-science-exchange/article/sse-108-multiple-transportable-carbohydrates-and-their-benefits"
      },
      {
        "titre": "Performance effects of periodized carbohydrate restriction in endurance trained athletes – a systematic review and meta-analysis (2021)",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8127206/"
      }
    ],
    "voirAussi": [
      "energie-reds"
    ]
  },
  {
    "id": "periodisation",
    "titre": "Périodisation, blocs et semaines allégées",
    "sports": [
      "course",
      "velo",
      "natation",
      "triathlon"
    ],
    "motsCles": [
      "périodisation",
      "bloc",
      "cycle",
      "semaine allégée",
      "décharge",
      "deload",
      "récupération",
      "3 semaines",
      "phase",
      "base",
      "spécifique"
    ],
    "preuve": "probable",
    "maj": "2026-11-07",
    "essentiel": "- Aucun modèle de périodisation n'est prouvé supérieur aux autres. Ce qui marche : une **progression graduelle**, de la **spécificité** à l'approche de l'objectif, et des **périodes de récupération**.\n- Le schéma classique : base (volume facile), construction (qualité), spécifique (allures de course), affûtage.",
    "recherche": "- Méta-analyse de la **périodisation par blocs** (Mølmen et al., 2019, 20 études, 6 dans la méta-analyse) : petits effets favorables au bloc sur la VO2max (SMD 0,40) et la puissance maximale (0,28). La qualité méthodologique est faible, les études sont petites, aucune méta-analyse sur la performance elle-même.\n- Un essai de 12 semaines chez des cyclistes entraînés (Winfield Almquist) ne trouve **aucune différence** entre bloc et traditionnel.\n- **Semaines allégées** : l'unique essai contrôlé trouvé est en musculation (Coleman et al., 2024). Une semaine d'arrêt complet au milieu de 9 semaines n'a pas changé l'hypertrophie, la puissance ni l'endurance musculaire locale, et a un peu baissé la force des jambes. Aucune preuve qu'une semaine allégée planifiée évite les blessures.\n- Le rythme « trois semaines de charge, une semaine allégée » est une pratique de coach courante : je ne l'ai pas trouvé testé dans cette recherche.",
    "regles": "- Structurer en phases selon l'objectif de l'utilisateur (A, B, C) et la date de course connue.\n- Proposer une **semaine allégée** quand la charge a monté pendant 3 à 4 semaines, ou plus tôt si fatigue élevée : **réduire le volume d'environ un tiers, garder quelques efforts d'intensité** (pratique de terrain, pas une loi).\n- Ne pas supprimer toute activité : réduire, pas arrêter.\n- Si l'utilisateur n'a pas d'objectif daté, rester sur une progression douce et régulière.",
    "pieges": "- « La périodisation par blocs est plus efficace » : effets petits et études fragiles.\n- Appliquer un cycle rigide malgré une maladie, un voyage ou un imprévu : la replanification prime.",
    "sources": [
      {
        "titre": "Block periodization of endurance training – a systematic review and meta-analysis (2019)",
        "url": "https://pubmed.ncbi.nlm.nih.gov/31802956"
      },
      {
        "titre": "Gaining more from doing less? One-week deload during resistance training (Coleman et al.)",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10809978/"
      },
      {
        "titre": "Block vs. Traditional Periodization of HIT (ski de fond, étude de cas)",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6460991/"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "progression-charge-blessures",
    "titre": "Augmenter la charge sans se blesser (règle des 10 %, ACWR)",
    "sports": [
      "course",
      "velo",
      "natation",
      "triathlon"
    ],
    "motsCles": [
      "règle des 10%",
      "10 pour cent",
      "augmenter",
      "kilométrage",
      "volume",
      "blessure",
      "progression",
      "ACWR",
      "ratio aigu chronique",
      "trop vite",
      "hausse hebdomadaire"
    ],
    "preuve": "debattu",
    "maj": "2026-11-07",
    "essentiel": "- « Pas plus de 10 % de hausse par semaine » est une **règle de prudence**, pas une loi scientifique. Aucune étude solide ne montre un seuil précis de sécurité.\n- Le ratio aigu/chronique (ACWR) avec sa « zone sûre » de 0,8 à 1,3 est **fortement critiqué** : il ne devrait pas servir à prédire les blessures.",
    "recherche": "- Essai de Buist et al. (2008) sur **532 coureurs débutants** : une progression de ~10 % par semaine n'a **pas réduit** les blessures par rapport à ~24 % (20,8 % contre 20,3 %). Les deux groupes étaient débutants.\n- Nielsen et al. (2014) : pas de différence de risque entre <10 %, 10-30 % et >30 % de hausse hebdomadaire.\n- Revue de Damsted et al. (2018), d'après un résumé secondaire : preuve très limitée pour un seuil de variation hebdomadaire.\n- Une étude de cohorte citée par des blogs suggère que les **pics sur une seule séance** (par exemple une sortie nettement plus longue que d'habitude) comptent plus que le total hebdomadaire. Je n'ai pas pu retrouver l'étude d'origine : à prendre avec précaution.\n- ACWR : Impellizzeri et al. (*IJSPP* 2020, *Sports Medicine* 2021) montrent des artefacts statistiques (couplage mathématique), des tranches arbitraires et l'absence de base solide pour guider la charge ou réduire les blessures. Des charges chroniques tirées au hasard prédisent la blessure presque aussi bien. Il n'y a pas consensus : certains travaux trouvent un risque plus élevé avec un ACWR haut.",
    "regles": "- L'application impose un plafond de hausse hebdomadaire et une limite sur la séance la plus longue : ce sont des **garde-fous de prudence réglables**, pas des vérités scientifiques. Si le validateur refuse une séance, le coach **explique que c'est par prudence** et propose autre chose, sans contourner.\n- Éviter qu'une seule séance dépasse nettement la plus longue des dernières semaines.\n- Débutant : progression douce, jours de repos, et préférer ajouter une séance facile plutôt que d'allonger toutes les autres.\n- Une douleur qui **augmente** pendant l'effort ou qui persiste : alléger, et orienter vers un professionnel de santé.\n- Ne **jamais** citer une « zone sûre ACWR ».",
    "pieges": "- « Tu t'es blessé parce que tu as dépassé 10 % » : on ne peut pas l'affirmer.\n- Utiliser la règle des 10 % comme excuse pour ne pas progresser du tout.",
    "sources": [
      {
        "titre": "The 10% Mileage Rule: Does It Prevent Running Injuries? (résumé de Buist 2008, Nielsen 2014)",
        "url": "https://winsport.us/blog/ten-percent-rule-running-mileage"
      },
      {
        "titre": "Returning to Running After Time Off: The 10% Rule Failed Its One Test (résumé secondaire)",
        "url": "https://medstarsportphysio.ca/journal/returning-to-running-after-time-off"
      },
      {
        "titre": "Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls (Impellizzeri 2020)",
        "url": "https://www.semanticscholar.org/paper/Acute:Chronic-Workload-Ratio:-Conceptual-Issues-and-Impellizzeri-Tenan/ede5743a426fd6429d28f8505500a3f771dbcf8b"
      },
      {
        "titre": "What Role Do Chronic Workloads Play in the ACWR? Time to Dismiss ACWR (Impellizzeri 2021)",
        "url": "https://www.researchgate.net/publication/347442902_What_Role_Do_Chronic_Workloads_Play_in_the_Acute_to_Chronic_Workload_Ratio_Time_to_Dismiss_ACWR_and_Its_Underlying_Theory"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "proteines-cafeine",
    "titre": "Protéines et caféine",
    "sports": [
      "course",
      "velo",
      "natation",
      "triathlon",
      "muscu",
      "hyrox"
    ],
    "motsCles": [
      "protéines",
      "caféine",
      "café",
      "complément",
      "récupération",
      "repas",
      "shake",
      "pré-entraînement",
      "boisson énergisante"
    ],
    "preuve": "etabli",
    "maj": "2026-11-07",
    "essentiel": "- Protéines : environ **1,2 à 2,0 g par kg et par jour** pour les sportifs, la partie haute pour les charges élevées. Les sources alimentaires suffisent à la plupart.\n- Caféine : **3 à 6 mg par kg**, environ une heure avant l'effort, améliore l'endurance en moyenne, avec de grandes différences individuelles.",
    "recherche": "- ISSN (2017) : **1,4 à 2,0 g/kg/j** pour les personnes qui s'entraînent ; en endurance, environ 0,25 g/kg par heure d'effort pour limiter les dégâts musculaires. ACSM, Academy of Nutrition and Dietetics et Dietitians of Canada : 1,2 à 2,0 g/kg/j (résumé secondaire, non vérifié).\n- Études individuelles : chez des élites d'endurance, 1,46 à 1,8 g/kg ; chez des récréatifs, environ 1,0 à 1,1 g/kg suffisait (source secondaire).\n- ISSN (2021) sur la caféine : bénéfice constant de 3 à 6 mg/kg, dose minimale efficace possible vers 2 mg/kg ; pas de gain de plus à 9 mg/kg ou plus ; gains rapportés de 2 à 4 % en endurance, mais **certains répondent mal**. La caféine anhydre serait environ une heure avant, le café est moins constant.\n- Hydratation et sodium : **non couverts par cette recherche** (voir README, lacunes).",
    "regles": "- Protéines : conseiller d'en répartir à chaque repas, sans promouvoir de compléments. Pas de chiffres en grammes pour une personne avec une maladie rénale ou un traitement : orienter vers un médecin.\n- Caféine : proposer de **tester à l'entraînement** (pas pour la première fois en course). Éviter en fin de journée si le sommeil est fragile.\n- Contre-indications à rappeler : grossesse, troubles du rythme cardiaque, anxiété importante, hypertension non contrôlée, mineurs : avis médical.\n- Ne jamais pousser les boissons énergisantes ni les compléments au-delà de ces repères.",
    "pieges": "- Dépasser 400 mg de caféine par jour (repère général de sécurité, non rechargé ici).\n- Promettre un gain chiffré : la réponse est individuelle.",
    "sources": [
      {
        "titre": "ISSN Position Stand: protein and exercise (2017)",
        "url": "https://link.springer.com/article/10.1186/s12970-017-0177-8"
      },
      {
        "titre": "ISSN Position Stand: caffeine and exercise performance (2021)",
        "url": "https://link.springer.com/article/10.1186/s12970-020-00383-4"
      },
      {
        "titre": "How Much Protein Do Athletes Really Need? (Science for Sport, secondaire)",
        "url": "https://www.scienceforsport.com/how-much-protein-do-athletes-really-need/"
      },
      {
        "titre": "Optimal Protein Intake Guide (Examine, secondaire)",
        "url": "https://examine.com/guides/protein-intake/"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "reprise-apres-arret",
    "titre": "Reprendre après un arrêt, une maladie ou une blessure",
    "sports": [
      "course",
      "velo",
      "natation",
      "triathlon",
      "muscu",
      "hyrox"
    ],
    "motsCles": [
      "reprise",
      "retour",
      "arrêt",
      "pause",
      "vacances",
      "blessure",
      "maladie",
      "désentraînement",
      "run walk",
      "reprendre",
      "quelques semaines"
    ],
    "preuve": "pratique",
    "maj": "2026-11-07",
    "essentiel": "- Plus l'arrêt a duré, plus la reprise doit être **progressive**. Il n'existe **pas de critère de retour validé** : les repères ci-dessous viennent de guides de terrain qui ne sont pas d'accord entre eux.\n- Une blessure ou une maladie relève d'un **professionnel de santé**, pas du coach.",
    "recherche": "- Je n'ai pas trouvé d'essai contrôlé sur les durées de reprise. Les guides pratiques concordent à peu près sur :\n  - arrêt de **4 à 7 jours** : reprise du plan là où on s'était arrêté ;\n  - arrêt de **1 à 2 semaines** : séances plus courtes et faciles, sans fractionné ni sortie longue ;\n  - arrêt de **2 à 4 semaines** : repartir vers 50 % du volume d'avant ;\n  - arrêt de **2 à 3 mois** : repartir vers 30 à 40 % ;\n  - la reprise prend souvent **50 à 100 % du temps d'arrêt**.\n- Course : alternance course/marche au début, 24 heures de repos entre deux sorties, vitesse et côtes seulement quand on est revenu à 75-80 % du volume d'avant. Un guide propose de s'arrêter si la douleur dépasse 3 sur 10.\n- Un arrêt prolongé fait baisser la VO2max **plus vite que le vieillissement normal** (revue sur les sportifs vétérans).\n- Les guides sont des blogs ou des sites de cliniques : fiabilité moyenne.",
    "regles": "- D'abord demander **pourquoi** et **depuis combien de temps** l'utilisateur s'est arrêté.\n- Blessure : ne pas fixer de critères de retour, orienter vers un kiné ou un médecin du sport, puis proposer des séances faciles et courtes quand le professionnel valide.\n- Maladie avec fièvre ou symptômes généraux : pas d'entraînement tant que ça n'a pas disparu (le garde-fou de l'application peut aussi limiter les séances).\n- Reprise : volume réduit, **aucune intensité les premières semaines**, hausse prudente. Les cartes proposées passent de toute façon par le validateur.\n- Ne pas promettre un délai de retour au niveau précédent.",
    "pieges": "- Reprendre « là où on s'était arrêté » après plusieurs semaines.\n- Ignorer une douleur qui augmente.",
    "sources": [
      {
        "titre": "Return to Running After Injury: Adjust Your Plan (Marathon Handbook)",
        "url": "https://marathonhandbook.com/adjust-your-training-plan-after-time-off/"
      },
      {
        "titre": "Comeback Training After Injury 2026 (RunBikeCalc)",
        "url": "https://runbikecalc.com/blog/comeback-training-after-injury-complete-guide-2026"
      },
      {
        "titre": "Guidelines for Runners Returning After Injury (Runner World)",
        "url": "https://runner-world.com/guides/guidelines-for-runners-returning-after-injury"
      },
      {
        "titre": "The Impact of Training on the Loss of Cardiorespiratory Fitness in Aging Masters Endurance Athletes",
        "url": "https://www.researchgate.net/publication/363306249_The_Impact_of_Training_on_the_Loss_of_Cardiorespiratory_Fitness_in_Aging_Masters_Endurance_Athletes"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "sommeil",
    "titre": "Sommeil et récupération",
    "sports": [
      "course",
      "velo",
      "natation",
      "triathlon",
      "muscu",
      "hyrox"
    ],
    "motsCles": [
      "sommeil",
      "dormir",
      "insomnie",
      "sieste",
      "fatigue",
      "nuit",
      "récupération",
      "dette de sommeil",
      "couché tard",
      "dors",
      "dort",
      "dormi",
      "nuit blanche",
      "dodo"
    ],
    "preuve": "probable",
    "maj": "2026-11-07",
    "essentiel": "- Dormir **plus de 8 heures** soutient l'endurance ; manquer de sommeil la **dégrade**, et la dette ne se rattrape pas complètement en quelques nuits.\n- Pour le reste (appareils éteints, bains froids, rituels), les effets sont **peu démontrés**.",
    "recherche": "- Revue sur l'extension de sommeil (2020) : dormir 9 à 10 heures (études de 1 à 49 jours, sur des sportifs qui dormaient 6 à 9 heures) aide à maintenir l'endurance, la restriction l'abîme. Recommandation d'endurance : plus de 8 heures par nuit. Les auteurs invitent à la prudence : petites études.\n- Après une restriction de sommeil, la performance peut ne pas revenir à la normale même avec une nuit de récupération.\n- Revue 2023 (*Sports Medicine*) : extension du sommeil et siestes sont les stratégies les plus efficaces ; hygiène du sommeil, retrait des écrans et immersion froide **sans effet démontré** (peu d'études).\n- Méta-analyse 2025 : la **privation totale** de sommeil nuit à l'endurance aérobie, pas à l'endurance anaérobie.\n- Ultra-endurance (revue 2025) : surtout des associations, pas de preuve de causalité.",
    "regles": "- Sommeil court plusieurs jours de suite : **alléger l'intensité**, jamais la compenser par une séance dure.\n- Conseils sûrs : horaires réguliers, viser 7 à 9 heures, éviter la caféine en fin de journée, courte sieste en cas de manque (pratique courante).\n- Ne **pas** prescrire 10 heures de sommeil ni de compléments.\n- Insomnie qui dure, ronflements forts ou somnolence dans la journée : orienter vers un médecin.",
    "pieges": "- Promettre un gain de performance précis grâce au sommeil.\n- Culpabiliser sur une mauvaise nuit : une nuit isolée change peu de chose.",
    "sources": [
      {
        "titre": "Sleep extension in athletes: What we know so far (2020)",
        "url": "https://www.sciencedirect.com/science/article/abs/pii/S1389945720305281"
      },
      {
        "titre": "The Impact of Sleep Interventions on Athletic Performance: A Systematic Review (Sports Medicine – Open, 2023)",
        "url": "https://link.springer.com/article/10.1186/s40798-023-00599-z"
      },
      {
        "titre": "A Narrative Review of the Impact of Sleep on Athletes (2025)",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11779686/"
      },
      {
        "titre": "The Role of Sleep on Physical and Cognitive Performance of Ultra-Endurance Athletes (2026)",
        "url": "https://www.mdpi.com/2077-0383/15/4/1398"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "surentrainement-fatigue",
    "titre": "Surcharge, surentraînement et fatigue qui dure",
    "sports": [
      "course",
      "velo",
      "natation",
      "triathlon",
      "muscu",
      "hyrox"
    ],
    "motsCles": [
      "surentraînement",
      "surcharge",
      "overreaching",
      "OTS",
      "fatigue chronique",
      "performance qui baisse",
      "épuisement",
      "burnout sportif"
    ],
    "preuve": "etabli",
    "maj": "2026-11-07",
    "essentiel": "- Il y a un **continuum** : surcharge fonctionnelle (quelques jours à récupérer), surcharge non fonctionnelle (semaines à mois), syndrome de surentraînement (mois à années). Seule la durée de récupération permet de les distinguer.\n- Le surentraînement est un **diagnostic d'exclusion** : un médecin doit d'abord écarter d'autres causes.",
    "recherche": "- Consensus ECSS/ACSM (Meeusen et al., 2013) : la surcharge se distingue du syndrome de surentraînement par le temps de récupération. Diagnostic posé souvent **après coup**. Il faut écarter carence en fer, anémie, troubles thyroïdiens, dépression, infections, déficit énergétique. Aucun biomarqueur ne suffit à lui seul.\n- Soin : la **réduction de la charge** peut suffire à la surcharge ; pour le syndrome de surentraînement, repos prolongé. \n- Prévalence : environ 10 % chez les sportifs d'endurance (chiffre issu d'un résumé secondaire, non vérifié).\n- Le syndrome de déficit énergétique (REDs) a des symptômes qui se **recoupent** avec le surentraînement.\n- Les pages que j'ai trouvées pour les chiffres de prévalence sont des blogs ; l'article original est dans l'*European Journal of Sport Science* 2013.",
    "regles": "- Signes d'alerte : performance qui baisse malgré du repos, fatigue inhabituelle persistante, sommeil dégradé, humeur irritable, FC de repos qui monte, maladies à répétition.\n- Réponse : **alléger la charge** pendant plusieurs jours à quelques semaines, remplacer l'intensité par du facile, soigner sommeil et alimentation.\n- Si les signes durent **plus de deux à trois semaines**, ou s'accompagnent de signes physiques (vertiges, douleur thoracique, essoufflement inhabituel), orienter vers un médecin.\n- Ne pas poser de diagnostic ni dire « tu es en surentraînement ».\n- Proposer en priorité de **raccourcir** plutôt que de tout supprimer.",
    "pieges": "- « Il faut pousser pour dépasser la fatigue » : non, en cas de baisse persistante.\n- Confondre fatigue d'une semaine chargée et surentraînement.",
    "sources": [
      {
        "titre": "Prevention, diagnosis and treatment of the overtraining syndrome: Joint consensus statement ECSS/ACSM (2013)",
        "url": "https://www.sportgeneeskunde.com/wp-content/uploads/Meeusen-et-al-2013-Overtraining-Consensus-ECSS-ACSM.pdf"
      },
      {
        "titre": "Résumé de l'étude (Luxembourg Institute of Health)",
        "url": "https://researchportal.lih.lu/en/publications/prevention-diagnosis-and-treatment-of-the-overtraining-syndrome-j-2/"
      },
      {
        "titre": "Overtraining Syndrome in the Athlete: Current Clinical Practice",
        "url": "https://www.researchgate.net/publication/259698712_Overtraining_Syndrome_in_the_Athlete_Current_Clinical_Practice"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "velo-zones-ftp",
    "titre": "Vélo : FTP, zones de puissance et « sweet spot »",
    "sports": [
      "velo",
      "triathlon"
    ],
    "motsCles": [
      "FTP",
      "zones de puissance",
      "Coggan",
      "sweet spot",
      "seuil",
      "watts",
      "test de 20 minutes",
      "puissance",
      "home trainer"
    ],
    "preuve": "pratique",
    "maj": "2026-11-07",
    "essentiel": "- Le **FTP** est la puissance qu'on peut tenir environ une heure. Les **zones de Coggan** s'en déduisent en pourcentages. Dans l'application, les zones sont **recalculées à l'affichage** à partir du FTP, jamais stockées.\n- Le « sweet spot » est un usage de terrain populaire, pas une méthode prouvée par des essais comparatifs.",
    "recherche": "- Je n'ai trouvé **aucune étude évaluée par des pairs** sur le sweet spot ; les sources sont des calculateurs, des guides et un podcast.\n- Les zones de Coggan s'accordent à peu près : zone 3 (tempo) ≈ 76 à 90 % du FTP, zone 4 (seuil) ≈ 91 à 105 %.\n- Le sweet spot est donné entre **85 et 94 %** du FTP selon les sources : les définitions se **recouvrent** avec la zone 3 et la zone 4.\n- L'argument : un bon compromis entre bénéfice d'adaptation et fatigue, mais c'est un argument de coach, pas un résultat d'essai.\n- Aucune des sources trouvées ne compare le sweet spot au seuil sur un contre-la-montre.",
    "regles": "- Dire que le sweet spot est **utile et populaire** mais **pas prouvé le plus efficace**.\n- Si le FTP est ancien ou n'a jamais été testé, avertir que les zones peuvent être fausses et proposer un test ou une estimation à partir des meilleures sorties récentes.\n- Programme : volume facile, une à deux séances de qualité (seuil, sweet spot ou VO2max) par semaine selon le niveau.\n- Ne jamais afficher de watts inventés : citer seulement les zones fournies par l'application.",
    "pieges": "- Mélanger des zones de FC et de puissance.\n- Comparer le FTP entre extérieur, home trainer et capteurs différents.",
    "sources": [
      {
        "titre": "Training Zones part 2: Cycling (Scientific Triathlon)",
        "url": "https://scientifictriathlon.com/tts29/"
      },
      {
        "titre": "Cycling Power Zones: The 7-Zone Model Explained",
        "url": "https://movementrebels.com/guides/cycling-power-zones"
      },
      {
        "titre": "Sweet spot (sports) – Wikipédia",
        "url": "https://en.wikipedia.org/wiki/Sweet_spot_(sports"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "veterans",
    "titre": "Sportifs vétérans (la quarantaine et au-delà)",
    "sports": [
      "course",
      "velo",
      "natation",
      "triathlon",
      "muscu",
      "hyrox"
    ],
    "motsCles": [
      "vétéran",
      "master",
      "âge",
      "40 ans",
      "50 ans",
      "60 ans",
      "vieillissement",
      "récupération plus lente",
      "déclin",
      "cœur d'athlète"
    ],
    "preuve": "probable",
    "maj": "2026-11-07",
    "essentiel": "- La baisse de performance avec l'âge est en grande partie liée à la **baisse de volume et d'intensité** de l'entraînement. Continuer à s'entraîner, **y compris en intensité**, ralentit nettement le déclin.\n- La récupération est un peu plus longue pour certains, mais l'effet de l'âge est peut-être **plus petit qu'on le croit**.",
    "recherche": "- Revues narratives (pas de revue systématique trouvée) : le déclin d'endurance chez les vétérans est surtout médié par la réduction de la vitesse et du volume de l'entraînement. Maintenir intensité et volume peut ralentir la baisse de VO2max.\n- Récupération (Borges et al., 2016) : l'effet de l'âge sur la récupération serait **plus faible qu'on le pensait** ; la sédentarité jouerait un rôle important. Recherche limitée.\n- L'**arrêt** de l'entraînement fait baisser la VO2max plus vite que l'âge seul.\n- Cœur : le remodelage cardiaque lié aux années de gros volume est un sujet **débattu** (revue 2025).",
    "regles": "- Garder **une à deux séances d'intensité** par semaine si la santé le permet, avec **plus de jours faciles** entre deux séances dures si le ressenti le demande.\n- Ajouter 1 à 2 séances de **force** par semaine (maintien musculaire et osseux, connaissance générale non rechargée ici).\n- Plus on est âgé ou sédentaire avant de commencer, plus l'**avis médical** est important avant une reprise intensive (examen cardiovasculaire conseillé). \n- Douleur thoracique, essoufflement anormal, malaise, palpitations : arrêter, consulter, ne pas insister.\n- Ne pas parler de « trop vieux pour progresser ».",
    "pieges": "- Stéréotyper selon l'âge : se baser sur les données de l'utilisateur.\n- Réduire l'intensité à zéro « par précaution ».",
    "sources": [
      {
        "titre": "Age-Related Changes in Performance and Recovery Kinetics in Masters Athletes: A Narrative Review (2016)",
        "url": "https://doi.org/10.1123/japa.2015-0021"
      },
      {
        "titre": "Endurance exercise performance in Masters athletes: age-associated changes and underlying physiological mechanisms",
        "url": "https://www.semanticscholar.org/paper/Endurance-exercise-performance-in-Masters-athletes:-Tanaka-Seals/894f10accaa0bfe9da3744eb99ebe6f6bfe90b1e"
      },
      {
        "titre": "Endurance performance in masters athletes (2008)",
        "url": "https://link.springer.com/article/10.1007/s11556-008-0029-2"
      },
      {
        "titre": "Cardiovascular Remodeling and Potential Controversies in Master Endurance Athletes (2025)",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12300461/"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "zone-2",
    "titre": "La zone 2 (ce qu'on sait et ce qu'on ne sait pas)",
    "sports": [
      "course",
      "velo",
      "natation",
      "triathlon"
    ],
    "motsCles": [
      "zone 2",
      "z2",
      "endurance fondamentale",
      "lactate",
      "LT1",
      "seuil aérobie",
      "mitochondries",
      "longévité",
      "facile",
      "base aérobie"
    ],
    "preuve": "debattu",
    "maj": "2026-11-07",
    "essentiel": "- La zone 2 est l'allure **confortable, sous le premier seuil** (on peut parler en phrases courtes). C'est la base du volume facile de presque tous les plans.\n- Les affirmations très fortes (« la zone 2 est la seule zone qui fait travailler les mitochondries », « 30 minutes à haute intensité valent 60 minutes de zone 2 ») **ne sont pas établies** par des essais contrôlés.",
    "recherche": "- Consensus d'experts (*IJSPP*, 2025) : la zone 2 se place juste sous le premier seuil lactique ou ventilatoire, avec des adaptations variées. Les seuils lactique et ventilatoire s'écartent beaucoup l'un de l'autre : on ne peut pas les échanger.\n- Revue critique (*Sports Medicine*, 2025, « Much Ado About Zone 2 ») : selon un résumé secondaire, les données actuelles **ne prouvent pas** que la zone 2 soit l'intensité optimale pour la capacité mitochondriale ou l'oxydation des graisses. La définition de LT1 varie (environ 1,5 à 2 mmol/L selon les sources).\n- Le débat de fond : l'effet de l'intensité elle-même est difficile à séparer de l'effet du volume total dans les essais chez l'humain.\n- Les thèses de San-Millán sont reprises par des sources populaires, je n'ai pas pu les vérifier dans ses publications.",
    "regles": "- Présenter la zone 2 comme **le socle de volume facile**, pas comme une zone magique.\n- Repère pratique sans test de laboratoire : on peut tenir une conversation, la fréquence cardiaque ne dérive pas fortement en 60 minutes. Sinon utiliser les zones calculées par l'application.\n- Ne **jamais** promettre des bénéfices précis (longévité, mitochondries, graisse) comme des faits.\n- Si l'utilisateur ne fait que de la zone 2, lui dire que c'est un bon socle, et que des séances dures dosées apportent autre chose.",
    "pieges": "- Confondre une zone 2 d'un modèle à 5 zones avec celle d'un modèle à 7 zones.\n- Un test de lactate ou des seuils ventilatoires ne s'obtiennent pas en lisant une montre : sans mesure, rester sur la sensation et les zones de l'application.",
    "sources": [
      {
        "titre": "What Is \"Zone 2 Training\"? Experts' Viewpoint… (IJSPP, 2025)",
        "url": "https://journals.humankinetics.com/view/journals/ijspp/20/11/article-p1614.xml"
      },
      {
        "titre": "Much Ado About Zone 2 (Sports Medicine, 2025)",
        "url": "https://www.fisiologiadelejercicio.com/wp-content/uploads/2025/06/Much-Ado-About-Zone-2.pdf"
      },
      {
        "titre": "Zone 2 Training Research (résumé secondaire)",
        "url": "https://getfitcraft.com/science/zone-2-training-research"
      }
    ],
    "voirAussi": []
  }
];
