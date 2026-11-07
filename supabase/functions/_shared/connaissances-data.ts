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
    "id": "course-5k-10k-plans",
    "titre": "Course à pied : préparer un 5 km ou un 10 km",
    "sports": [
      "course"
    ],
    "motsCles": [
      "5 km",
      "10 km",
      "plan 10 km",
      "plan 5 km",
      "préparer un 10 km",
      "objectif chrono",
      "fractionné",
      "VMA",
      "allure de course",
      "tempo",
      "sortie longue",
      "semaine type",
      "séances clés"
    ],
    "preuve": "pratique",
    "maj": "2026-11-09",
    "essentiel": "- Un 10 km se situe **entre la vitesse du 5 km et l'endurance du marathon** : le plan doit développer les deux. Il tient en 4 ingrédients : **footings faciles**, **une séance de vitesse/VO2max**, **une séance de seuil ou d'allure de course**, **une sortie longue**.\n- Phases classiques : **base** (endurance, lignes droites, fartlek), **développement** (VMA, tempo), **spécifique** (répétitions à l'allure de course), **affûtage** (volume réduit, un rappel d'allure).\n- Durée utile d'un plan : 8 à 12 semaines pour un coureur déjà régulier ; moins de 6 semaines suffisent seulement à **améliorer l'exécution**, pas à changer de niveau.\n- Les gains réalistes sont de **l'ordre de 0,5 % par semaine**, jamais des minutes en quelques semaines : le moteur de l'application utilise 0,6 % par semaine (8 % au plus) pour dire si un objectif est jouable.",
    "recherche": "- Les plans de 10 km de coachs et de plateformes (Active.com, TrainingPeaks, Runna) partagent la même structure : 3 à 5 jours de course, un tempo environ **10 à 15 s/mile plus lent que l'allure de course** (soit 6 à 9 s/km), des intervalles à l'allure du 5 km, des footings à 60 à 90 s/mile plus lents que l'allure visée, une sortie longue hebdomadaire. Ce sont des conventions de coachs, pas des résultats d'essais.\n- Séances de référence chez les coureurs de classe mondiale (Haugen et al., 2022) : **intervalles de seuil** de 3 à 15 min autour de l'allure semi (par exemple 10 à 12 × 1000 m avec 1 min de récupération), **intervalles de VO2max** de 2 à 4 min à l'allure 3 à 10 km avec 2 à 3 min de récupération (4 à 7 × 800–1000 m), **côtes** de 30 s à 4 min, **sprints** de 5 à 15 s avec récupération complète. Les amateurs en réduisent le volume proportionnellement.\n- Étude de coureurs récréatifs (Festa et al., 2019, 38 coureurs, 8 semaines) : un modèle polarisé (77 % / 3 % / 20 %, 4 séances par semaine) et un modèle centré sur le moyen (40 / 50 / 10, 3 séances) ont donné des **progrès équivalents** sur un test de 2 km (+3,5 % et +3,0 % de vitesse) ; le second avec 17 % de temps d'entraînement en moins. À court terme et sur ce niveau, les deux marchent.\n- Analyse de 92 plans de marathon : ≈ 5 à 8 % du volume en zones 4 et 5, le reste dominé par la zone 2 : même les plans ambitieux restent très « faciles ».",
    "regles": "(Les dosages ci-dessous sont des **repères de coach** et les choix du moteur de l'application, pas des résultats d'études.)\n- Semaine type à 3 séances : un footing (avec lignes droites en base), **une séance de qualité** (la nature suit la phase), une **sortie longue** (45 à 65 min, plafonnée à ≈ 1,6 × la durée de la course) ; à 4 séances, ajouter une seconde qualité (tempo) dès la phase de développement ; à 5 séances, un footing de plus.\n- Qualité par phase : base = fartlek court ; développement = 400 à 800 m à l'allure VMA (6 à 8 × 400 m, 5 à 6 × 600 m, 4 à 5 × 800 m) et tempo en blocs de 8 à 15 min ; spécifique = 1000 à 2000 m à l'allure de course (4 à 5 × 1000 m, 3 à 4 × 1600 m) et tempo continu de 15 à 25 min ; affûtage = rappel d'allure court (3 × 1000 m).\n- Volume : départ un peu au-dessus de ce que la personne fait déjà, +10 % par semaine environ, semaine plus légère toutes les 4 semaines, dernière semaine allégée à ≈ 55 % et avant-dernière à ≈ 75 %. Ce sont des habitudes de coach, pas des limites.\n- Jour de la course : aucune séance ; veille : rien de dur, footing léger de 20 min au plus.\n- Toujours écrire le but de la séance et l'allure chiffrée.",
    "pieges": "- Viser un chrono sans tenir compte du niveau actuel : voir [[course-vdot-allures]] et [[course-tests-terrain]].\n- Remplir la semaine de séances dures : sur un plan court, la fatigue masque le gain.\n- Négliger la sortie longue sous prétexte que « c'est un 10 km ».",
    "sources": [
      {
        "titre": "Effects of Different Training Intensity Distribution in Recreational Runners (Festa et al., 2019)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7739641/"
      },
      {
        "titre": "The Training Characteristics of World-Class Distance Runners (Haugen et al., 2022)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/"
      },
      {
        "titre": "10K Intermediate Training Plan, 10 weeks (Active.com, plan de coach)",
        "url": "https://www.active.com/running/articles/10k-intermediate-training-plan-10-weeks"
      },
      {
        "titre": "Quantitative Analysis of 92 12-Week Sub-elite Marathon Training Plans",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11065819/"
      }
    ],
    "voirAussi": [
      "course-vdot-allures",
      "course-tests-terrain"
    ]
  },
  {
    "id": "course-blessures-progression",
    "titre": "Course à pied : blessures, règle des 10 %, progression de la charge, prévention",
    "sports": [
      "course"
    ],
    "motsCles": [
      "blessure",
      "10 pour cent",
      "progression",
      "volume hebdomadaire",
      "pic de charge",
      "Nielsen",
      "Buist",
      "prévention",
      "renforcement",
      "étirements",
      "première blessure",
      "pic d'une séance",
      "ACWR",
      "périostite",
      "tendinopathie"
    ],
    "preuve": "debattu",
    "maj": "2026-11-09",
    "essentiel": "- La **règle des 10 %** (ne pas augmenter le volume de plus de 10 % par semaine) est une **convention**, pas un seuil démontré. L'essai le plus connu n'a trouvé **aucune différence de blessures** entre +10,5 % et +23,7 % par semaine chez des débutants.\n- Ce qui semble plus lié aux blessures : un **gros saut dans une seule séance** (une sortie nettement plus longue que la plus longue des 30 derniers jours), **avoir déjà été blessé**, et chez les débutants un **programme improvisé** plutôt que structuré.\n- La **force** réduit nettement les blessures sportives en général (risque environ divisé par 3 pour les blessures de sport, presque par 2 pour les blessures de surcharge), les **étirements** n'ont pas montré de bénéfice. Chez les **coureurs**, les essais sont peu nombreux.\n- Le coach **ne diagnostique ni ne soigne** : toute douleur qui persiste est renvoyée vers un professionnel.",
    "recherche": "- **Buist et al. (2008)** : essai randomisé sur des débutants, progression +10,5 % par semaine contre +23,7 % : taux de blessures **semblables** (rapporté de seconde main).\n- **Nielsen et al.** : chez les débutants, le **volume hebdomadaire** n'est pas lié à la blessure ; le risque vient des **hausses de plus de 10 % sur une seule sortie** par rapport à la plus longue des 30 jours précédents (rapporté de seconde main).\n- **Marathoniens amateurs** : ni le volume ni la sortie longue ne sont associés à plus de blessures (étude néerlandaise). **Premiers marathoniens de New York** : le risque pendant l'entraînement est associé à l'absence d'expérience de semi et à **4 sorties ou plus par semaine** ; des sorties longues plus longues vont avec moins de blessures le jour de la course.\n- **Débutants (Royaume-Uni)** : ceux qui s'entraînent selon un programme **improvisé** se blessent plus que ceux qui suivent un programme structuré ; une blessure antérieure multiplie par ≈ 7,6 le risque d'une nouvelle blessure dans un programme « Couch to 5K » ; seuls 27 % le terminent.\n- **Ultras** : un volume faible va avec plus de blessures (Comrades, 106 coureurs) ; la **fréquence** d'entraînement pèse plus que les variations de charge.\n- **Prévention** : méta-analyse de **Lauersen et al.** (2014) : la **force** réduit les blessures de sport de plus des deux tiers (RR ≈ 0,32) et les blessures de surcharge de presque la moitié ; les étirements : pas de bénéfice. Une méta-analyse de 2024 sur les coureurs d'endurance trouve une certitude modérée à élevée mais un **risque de biais élevé**, et seulement quatre études à contenu de force.\n- Revue des paramètres d'entraînement et blessures de course : conclusions **hétérogènes** ; aucune règle chiffrée simple (je n'ai pas pu lire le texte complet).",
    "regles": "- Progression : **monter environ 5 à 10 % par semaine**, avec une semaine plus légère toutes les 3–4 semaines, mais **ne jamais allonger la plus longue sortie de plus de 10 % d'un coup** par rapport à celle des 30 derniers jours.\n- Avertir si la personne a déjà été blessée (réduire la montée, plus de force, plus de jours faciles).\n- Après un arrêt ou une blessure : voir [[reprise-apres-arret]] et [[course-reprise-debutants]].\n- **Douleur** : arrêter la séance, ne jamais « courir à travers » ; si elle persiste plus de quelques jours, orienter vers un professionnel (garde-fou santé).\n- Ne jamais présenter la règle des 10 % comme une loi.",
    "pieges": "- Appliquer 10 % mécaniquement à de très petits volumes (10 % de 10 km, c'est 1 km, mais un saut de 5 km en une sortie est un pic).\n- Croire que stretching ou « bonne foulée » protègent des blessures.",
    "sources": [
      {
        "titre": "The 10% Rule : does it hold true? (PogoPhysio, synthèse de l'essai de Buist)",
        "url": "https://www.pogophysio.com.au/blog/the-10-rule-does-it-hold-true/"
      },
      {
        "titre": "The 10% rule in running (Marathon Handbook, synthèse de Nielsen)",
        "url": "https://marathonhandbook.com/the-10-rule-new-study-suggests-weve-been-doing-it-wrong-this-whole-time/"
      },
      {
        "titre": "The effectiveness of exercise interventions to prevent sports injuries (Lauersen et al., 2014)",
        "url": "https://pubmed.ncbi.nlm.nih.gov/24100287/"
      },
      {
        "titre": "Do Exercise-Based Prevention Programs Reduce Injury in Endurance Runners? (2024)",
        "url": "https://link.springer.com/article/10.1007/s40279-024-01993-7"
      },
      {
        "titre": "Factors associated with injuries in first-time marathon runners (New York City)",
        "url": "https://pubmed.ncbi.nlm.nih.gov/33750264"
      },
      {
        "titre": "Running with injury : UK novice and recreational runners",
        "url": "https://pubmed.ncbi.nlm.nih.gov/29853263/"
      },
      {
        "titre": "Couch-to-5k or Couch to Ouch : who takes part and non-completion",
        "url": "https://pubmed.ncbi.nlm.nih.gov/37681822/"
      },
      {
        "titre": "Training for a (half-)marathon : volume and longest run related to performance and injuries",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7496388/"
      }
    ],
    "voirAussi": [
      "reprise-apres-arret",
      "course-reprise-debutants"
    ]
  },
  {
    "id": "course-chaussures-cadence",
    "titre": "Course à pied : chaussures à plaque carbone, cadence, foulée",
    "sports": [
      "course"
    ],
    "motsCles": [
      "chaussures",
      "plaque carbone",
      "super shoes",
      "cadence",
      "fréquence de foulée",
      "foulée",
      "attaque du pied",
      "talon",
      "avant-pied",
      "économie de course",
      "technologie des chaussures",
      "usure"
    ],
    "preuve": "probable",
    "maj": "2026-11-09",
    "essentiel": "- Les **chaussures à plaque carbone et mousse très amortissante** réduisent le coût de la course d'environ **2 à 3 %** en moyenne (méta-analyse d'essais croisés), donc améliorent un peu le chrono à effort égal. La part due à la plaque seule est **incertaine** (la mousse y contribue).\n- La **cadence** (pas par minute) : l'augmenter de **5 à 10 %** réduit les forces à chaque appui, mais **rien ne prouve** que cela diminue les blessures ; il n'y a **pas de cadence idéale universelle**.\n- La technique de foulée (talon ou avant-pied) n'est **pas** un facteur prouvé de performance ou de blessure : ne pas la changer sans raison.",
    "recherche": "- **Chaussures** (méta-analyse de 2026, essais croisés) : coût métabolique réduit de **2,75 % en moyenne** (de −0,99 % à −4,47 %) avec plaque carbone ; les auteurs notent que d'autres caractéristiques (mousse, géométrie) contribuent et que la causalité ne peut pas être attribuée à la seule plaque. Pour la **course en montagne**, aucun bénéfice clair ; sur trail, des chaussures rigides ont même un peu augmenté le coût en montée.\n- **Cadence** (méta-analyse de 2022 sur la modification du nombre de pas) : augmenter la cadence **réduit les charges** à la cheville, au genou et à la hanche ; la preuve est **insuffisante** pour conclure sur les **blessures** et la **performance**, et la plupart des études ne portent que sur l'effet immédiat. Une revue de 2025 indique que la hausse de 5–10 % **n'augmente pas** le coût métabolique et le réduit parfois ; une revue narrative de 2026 conteste l'idée qu'augmenter la cadence à vitesse fixe réduit systématiquement les blessures.\n- La cadence **augmente avec la vitesse** de façon naturelle ; chez les amateurs, 160 à 190 pas par minute selon la vitesse et la taille (repère de terrain, pas un critère).",
    "regles": "- Chaussures : dire que les modèles à plaque carbone donnent un **petit avantage** en course sur route ; qu'elles se choisissent surtout au **confort** ; qu'aucune chaussure ne remplace la progressivité de la charge.\n- Cadence : si la personne se plaint de douleurs d'impact et court avec une foulée très longue, **tester +5 %** en séances faciles, sans en faire une obligation ; sinon, ne pas toucher à la foulée.\n- Ne jamais promettre qu'un changement de foulée ou de chaussure « évite les blessures ».\n- Pour un diagnostic ou une douleur qui persiste : orienter vers un kinésithérapeute ou un médecin du sport.",
    "pieges": "- Passer d'un coup à des chaussures très différentes (drop, amorti) sur une sortie longue.\n- Corriger la foulée au lieu de la charge d'entraînement quand une blessure survient.",
    "sources": [
      {
        "titre": "Metabolic effects of carbon-plated running shoes : systematic review and meta-analysis",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12827780/"
      },
      {
        "titre": "What is the Effect of Changing Running Step Rate on Injury, Performance and Biomechanics? Systematic review and meta-analysis",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9441414/"
      },
      {
        "titre": "The Influence of Running Cadence on Biomechanics and Injury Prevention : systematic review (2025)",
        "url": "https://pubmed.ncbi.nlm.nih.gov/40964543/"
      },
      {
        "titre": "A review of uphill and downhill running (Frontiers, 2025)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12592170/"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "course-distribution-intensite",
    "titre": "Course à pied : répartition de l'intensité (polarisé, pyramidal, seuil) chez les coureurs",
    "sports": [
      "course"
    ],
    "motsCles": [
      "polarisé",
      "pyramidal",
      "80/20",
      "distribution d'intensité",
      "zones",
      "seuil",
      "séances dures par semaine",
      "coureurs",
      "Seiler",
      "Esteve-Lanao",
      "temps facile",
      "intensité modérée"
    ],
    "preuve": "probable",
    "maj": "2026-11-09",
    "essentiel": "- Chez les coureurs de demi-fond et de fond, les modèles **polarisé** (≈ 80 % facile, ≈ 20 % dur, peu de moyen) et **pyramidal** (beaucoup de facile, un peu de moyen, un peu de dur) donnent en général de **meilleurs gains** que le modèle centré sur le **seuil**.\n- Aucun essai ne tranche clairement entre polarisé et pyramidal. Pour un amateur, ce qui compte : **beaucoup de facile, 1 à 3 séances de qualité** par semaine selon le volume, et ne pas passer toutes les sorties dans la zone « moyenne ».\n- Les coureurs d'élite font **au moins 80 % de leur volume à intensité faible** toute l'année ; le modèle des 1500 m est plutôt pyramidal (≈ 90/10), celui des 800 m plus polarisé.",
    "recherche": "- **Esteve-Lanao et al. (2007)** : 12 coureurs de bon niveau, 5 mois, modèle polarisé (≈ 75–80 % facile) contre modèle centré sur le seuil : le groupe polarisé a mieux progressé sur 10 km (environ −2,6 min contre −2,0 min dans le tableau d'une revue ; petits groupes, chiffres à vérifier dans l'article).\n- **Revue systématique de 2018** (16 études) : les modèles pyramidal et polarisé sont plus efficaces que le seuil, même si certains marathoniens de haut niveau s'entraînent plutôt au seuil. Zones à définir par rapport à l'allure de course.\n- **Revue de 2022** (demi-fond et fond) : un volume élevé à intensité faible (≈ 70 %) avec un volume faible de seuil et de haute intensité (≈ 30 %) est nécessaire pour optimiser les adaptations ; les études à plus fort volume facile obtiennent de plus gros gains. D'autres revues rapportent que l'avantage du polarisé pourrait se limiter aux interventions courtes et aux athlètes très entraînés (méta-analyse de 2024 citée de seconde main, non vérifiée).\n- **Coureurs récréatifs (Festa et al., 2019)** : modèle polarisé (4 séances) et modèle centré sur l'intensité moyenne (3 séances) ont donné des gains **équivalents** sur 2 km en 8 semaines ; le second demandait 17 % de temps en moins. Les auteurs ne peuvent pas recommander un modèle plutôt qu'un autre pour les amateurs.\n- **Marathoniens et coureurs sous-élite** : environ 65 % du volume en zone 2 et 5 à 8 % en zones 4–5 (analyse de 92 plans) : très loin d'un « 80/20 » strict, tout en restant dominés par le facile.\n- **Seiler** : le 80/20 décrit l'entraînement d'athlètes qui s'entraînent 10 à 13 fois par semaine (observationnel) ; il n'est pas une prescription pour un amateur qui court 3 fois.",
    "regles": "- À 3 séances par semaine : **1 séance de qualité**, le reste facile ; à 4–5 : jusqu'à **2 séances de qualité**, dont une peut être au seuil ; jamais deux séances dures la veille de la suivante.\n- Le temps « moyen » (tempo) a sa place, surtout en phase spécifique, mais il ne remplace pas le facile.\n- Si la personne dit « je cours toujours à fond » ou « toujours tranquille », proposer d'introduire ou de limiter la qualité, avec la raison.\n- Voir aussi [[intensite-distribution]], [[zone-2]], [[methode-norvegienne]].",
    "pieges": "- Prendre un pourcentage « 80/20 » en temps ou en séances comme une règle absolue.\n- Sous-estimer le facile : il est ce qui permet de faire la qualité sans se blesser.\n- Mesurer les zones sur la fréquence cardiaque en côte ou par chaleur (la FC dérive).",
    "sources": [
      {
        "titre": "Impact of training intensity distribution on performance in endurance athletes (Esteve-Lanao et al., 2007)",
        "url": "https://pubmed.ncbi.nlm.nih.gov/17685689/"
      },
      {
        "titre": "Training-intensity distribution in middle- and long-distance runners: a systematic review (2018)",
        "url": "https://pubmed.ncbi.nlm.nih.gov/29182410/"
      },
      {
        "titre": "Training-intensity distribution on middle- and long-distance runners: a systematic review (2022)",
        "url": "https://lida.sport-iat.de/ta/Record/4075045"
      },
      {
        "titre": "Effects of Different Training Intensity Distribution in Recreational Runners (Festa et al.)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7739641/"
      },
      {
        "titre": "Training Intensity Distribution in Endurance Sports (Loughborough)",
        "url": "https://www.lboro.ac.uk/sport/news/2020/may/training-intensity-distribution"
      }
    ],
    "voirAussi": [
      "intensite-distribution",
      "zone-2",
      "methode-norvegienne"
    ]
  },
  {
    "id": "course-ecoles-coaching",
    "titre": "Course à pied : les grandes écoles (Lydiard, Canova, Norvégiens, Daniels, Hansons) et ce qu'elles ont en commun",
    "sports": [
      "course"
    ],
    "motsCles": [
      "Lydiard",
      "Canova",
      "blocs spéciaux",
      "endurance spécifique",
      "périodisation",
      "base aérobie",
      "pyramide",
      "école de coaching",
      "Pfitzinger",
      "Hansons",
      "Daniels",
      "méthode norvégienne",
      "seuil double"
    ],
    "preuve": "pratique",
    "maj": "2026-11-09",
    "essentiel": "- **Lydiard** (Nouvelle-Zélande, années 1960) : une **pyramide construite à reculons depuis la course** : d'abord une longue **base aérobie**, puis des **côtes**, puis du travail **anaérobie**, puis la **coordination** (rythme de course), puis l'**affûtage**. Les sources secondaires s'accordent sur l'ordre, pas sur la durée des phases.\n- **Canova** (Italie) : on travaille **la spécificité à l'envers** : au lieu de monter le volume à l'allure de course, on varie autour d'elle (≈ 90 % et 110 % de l'allure marathon pendant la phase « spéciale »), avec tous les 3 à 4 semaines un **bloc spécial** très chargé suivi de 5 à 7 jours sans qualité.\n- **Norvégiens** (Bakken, Ingebrigtsen) : beaucoup de volume facile, **3 à 4 séances de seuil par semaine** pilotées à la **lactatémie** (2 à 4,5 mmol/L), en intervalles courts, plus une séance de VO2max : voir [[course-seuil-norvegien]] et [[methode-norvegienne]].\n- **Daniels** : tout est calé sur le VDOT, avec cinq allures et deux séances de qualité par semaine ([[course-vdot-allures]]). **Hansons** : fatigue cumulée, trois séances clés par semaine, sortie longue plafonnée ([[course-marathon-methodes]]).\n- Point commun : **majorité facile, un peu de qualité bien dosée, une progressivité de la spécificité, un affûtage**.",
    "recherche": "- Ces écoles sont des **systèmes de coaching** : aucune n'a été comparée aux autres dans un essai contrôlé. Les revues scientifiques décrivent surtout leurs points communs (volume facile dominant, 15 à 20 % de travail au seuil et plus intense).\n- La revue de l'élite (Haugen et al., 2022) note que les séances de seuil et de VO2max des champions ressemblent à celles de Daniels et des Norvégiens, et que les plans de marathon avancent soit en allongeant la durée à l'allure d'objectif, soit en augmentant le volume intense puis en accélérant lentement.\n- Les sources trouvées sur Lydiard et Canova sont des **sites de coachs et des blogs** ; les livres d'origine (Lydiard ; Arcelli et Canova, *Marathon Training: A Scientific Approach*, 1999) n'ont pas été lus. Les chiffres (100 miles par semaine chez Lydiard, 45 à 60 km par jour en bloc chez Canova) sont **à prendre avec prudence**.",
    "regles": "- Si la personne parle d'une méthode, **la nommer correctement** et dire qu'elle est un cadre de coach, pas une preuve.\n- Pour les amateurs, **piocher les idées** plutôt que d'appliquer une école entière : base facile (Lydiard), travail à l'allure de course par morceaux (Canova, Hansons), seuil en intervalles (Norvégiens), allures calculées (Daniels).\n- Ne jamais promettre qu'une méthode « garantit » un chrono.",
    "pieges": "- Mélanger deux écoles dans la même semaine sans voir la charge totale.\n- Appliquer les volumes d'un champion (160 à 220 km par semaine) à un amateur.",
    "sources": [
      {
        "titre": "Lydiard Foundation : principes",
        "url": "https://www.lydiardfoundation.org/about"
      },
      {
        "titre": "Les bases de l'entraînement à la Lydiard : phases de la pyramide (Athletics Illustrated)",
        "url": "https://athleticsillustrated.com/the-basics-of-training-the-arthur-lydiard-way-phases-of-the-pyramid/"
      },
      {
        "titre": "Canova's Special Block Training (RunnersConnect, blog de coach)",
        "url": "https://runnersconnect.net/special-block-training/"
      },
      {
        "titre": "Building Special Blocks (FastRunning, source secondaire)",
        "url": "https://fastrunning.com/training/marathon-training/building-special-blocks/33861"
      },
      {
        "titre": "The Training Characteristics of World-Class Distance Runners (Haugen et al., 2022)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/"
      }
    ],
    "voirAussi": [
      "course-seuil-norvegien",
      "methode-norvegienne",
      "course-vdot-allures",
      "course-marathon-methodes"
    ]
  },
  {
    "id": "course-force-economie",
    "titre": "Course à pied : musculation, pliométrie et économie de course",
    "sports": [
      "course"
    ],
    "motsCles": [
      "musculation coureur",
      "pliométrie",
      "économie de course",
      "charges lourdes",
      "squat",
      "sauts",
      "force maximale",
      "1RM",
      "renforcement",
      "step-down",
      "excentrique",
      "séances de force",
      "coureurs"
    ],
    "preuve": "probable",
    "maj": "2026-11-09",
    "essentiel": "- La **force** améliore la **performance sur chrono** des coureurs de demi-fond et de fond, surtout avec des **charges lourdes** (≥ 80 % du 1RM) ou une **combinaison de méthodes**. Elle améliore aussi l'**économie de course** (environ 5 % dans des études courtes).\n- Les gains **ne viennent pas** d'une hausse de VO2max : les méta-analyses la trouvent trivialement modifiée.\n- **2 séances par semaine** en préparation, **0 à 1** en période de compétition : c'est ce que font les élites (Haugen et al., 2022) ; les durées de programme étudiées vont de 6 à 40 semaines.",
    "recherche": "- **Méta-analyse de 2024** (Llanos-Lagos et al., 38 études, 894 coureurs, 6 à 40 semaines, 1 à 4 séances par semaine) : charges lourdes **g = −0,47** (modéré), méthodes combinées **g = −1,04** (grand), pliométrie seule **−0,21** (non significatif) sur la performance (chrono ou temps limite) ; pas d'effet sur VO2max, vVO2max, vitesse de sprint. Niveau de preuve **très faible à modéré** (GRADE).\n- **Méta-analyse de 2023** : charges lourdes, pliométrie et méthodes combinées améliorent toutes l'économie de course par rapport au contrôle ; la **pliométrie** semble mieux aux **vitesses lentes** (≤ 12 km/h), les **charges lourdes** mieux chez les coureurs à VO2max élevée et à vitesse plus haute.\n- **Charges lourdes contre pliométrie** (méta-analyse de 2022) : les charges **proches du maximum** (≥ 90 % du 1RM ou ≤ 4RM) et les programmes de **≥ 10 semaines** semblent les plus efficaces.\n- Les revues d'**élite** rapportent 2 séances par semaine de force et de pliométrie (sauts, bonds, circuits au poids du corps) en début et milieu de préparation ; la charge de ces séances est mal décrite.\n- **Prévention** : la force est la forme d'exercice qui réduit le plus les blessures de sport en général (voir [[course-blessures-progression]]), mais peu d'essais concernent des coureurs.",
    "regles": "- Proposer **2 séances de force de 20 à 40 min** par semaine en base et développement, **1 séance de maintien** en phase spécifique, **aucune lourde** la semaine avant la course.\n- Contenu type : squat ou fentes, soulevé de terre jambes tendues, montées sur banc, mollets, gainage ; en pliométrie : sauts sur place, bonds, escalier. Charges **progressives**, techniques propres d'abord.\n- Les séances de force ne remplacent pas une séance de course et ne se font pas la veille d'une séance de qualité.\n- Voir [[force-pour-endurants]], [[entrainement-concurrent]], [[musculation-bases]].",
    "pieges": "- Séances lourdes juste avant une course ou un test.\n- Croire que la force « augmente la VMA » : elle améliore plutôt l'économie et la tolérance à l'effort.\n- Négliger la technique avec des charges proches du maximum, sans coach.",
    "sources": [
      {
        "titre": "Effect of Strength Training Methods on Middle- and Long-Distance Runners' Performance : systematic review with meta-analysis (2024)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11258194/"
      },
      {
        "titre": "Effect of Strength Training Programs on Running Economy at Different Speeds : meta-analysis (2023)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11052887/"
      },
      {
        "titre": "Heavy Resistance Training Versus Plyometric Training for Improving Running Economy and Time Trial Performance (2022)",
        "url": "https://link.springer.com/article/10.1186/s40798-022-00511-1"
      },
      {
        "titre": "The Training Characteristics of World-Class Distance Runners (Haugen et al., 2022)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/"
      }
    ],
    "voirAussi": [
      "course-blessures-progression",
      "force-pour-endurants",
      "entrainement-concurrent",
      "musculation-bases"
    ]
  },
  {
    "id": "course-marathon-methodes",
    "titre": "Course à pied : préparer un marathon (volumes, sortie longue, méthodes)",
    "sports": [
      "course"
    ],
    "motsCles": [
      "marathon",
      "plan marathon",
      "Pfitzinger",
      "Hansons",
      "Daniels",
      "sortie longue marathon",
      "32 km",
      "volume hebdomadaire marathon",
      "allure marathon",
      "semaines de préparation",
      "premier marathon"
    ],
    "preuve": "probable",
    "maj": "2026-11-09",
    "essentiel": "- Le marathon se joue sur le **volume**, la **sortie longue** et l'**allure spécifique**. Les études sur marathoniens amateurs associent un volume plus élevé et une sortie longue de 30 à 35 km à de meilleurs chronos ; au-delà de 35 km, aucun bénéfice net.\n- Les trois grandes méthodes de terrain : **Pfitzinger** (volume élevé, sortie « moyenne-longue » en milieu de semaine, séances au seuil), **Hansons** (fatigue cumulée : trois séances clés par semaine, sortie longue plafonnée à 16 miles), **Daniels** (allures VDOT, deux séances de qualité par semaine).\n- Pour un premier marathon, l'objectif est de **finir en bonne santé** : régularité, progression lente, sortie longue qui monte à 28–32 km au plus.",
    "recherche": "- Analyse de **92 plans de marathon de 12 semaines** de niveau sous-élite (2024), par volume de pointe : fort (> 90 km, cible médiane 3:15), moyen (65–90 km, 3:52), faible (< 65 km, 4:30). Moyennes sur les 12 dernières semaines : 107,7 / 58,5 / 42,9 km par semaine ; **4,1 à 6,8 séances par semaine** ; sortie longue moyenne 27,4 / 23,0 / 19,9 km ; sortie la plus longue du plan 35,2 / 32,5 / 30,9 km ; jours de repos 0,1 / 1,3 / 2,0 par semaine. Montée de **3 km par semaine** environ (+5 à 9 %), pic **3,6 à 4,4 semaines avant la course**, baisse de 22 à 31 % entre le pic et la semaine précédant la course, puis **−46 à −54 %** la dernière semaine. Répartition d'intensité : zone 2 ≈ 63 à 68 %, zone 3 ≈ 10 à 18 %, zones 4 et 5 ≈ 5 à 8 %.\n- Cohorte néerlandaise : au marathon, **moins de 40 km/semaine** = environ 6 min plus lent, **plus de 65 km** = environ 14 min plus rapide que 40–65 km ; sortie longue **sous 25 km** = environ 13 min plus lent que 30–35 km ; **au-delà de 35 km, pas de gain**. Pas d'association avec les blessures.\n- Marathoniens amateurs : la vitesse de course corrèle avec le seuil lactique et avec le nombre de séances par semaine (étude sur 97 coureurs, 2017) ; ≈ 158 000 marathoniens : un **affûtage strict de 3 semaines** va avec environ 5,5 min de gain médian par rapport à un affûtage minimal (observationnel).\n- Pfitzinger (sources secondaires) : séance de seuil hebdomadaire, sortie longue de 22 à 35 km avec segments à allure marathon, sortie moyenne-longue de 21 à 27 km **facile**, 40 à 70 miles par semaine selon le plan, affûtage de 3 semaines. Hansons (blogs de coachs) : trois séances « de substance » (vitesse, tempo à l'allure marathon, sortie longue), la sortie longue plafonnée à 16 miles (≈ 26 km) et faite sur jambes fatiguées, volume de 60 à 63 miles par semaine dans les semaines de pointe ; le plafond de 16 miles est justifié par l'idée qu'au-delà de 3 h l'épuisement du glycogène fait plus de mal que de bien (argument de terrain).",
    "regles": "- Premier marathon : 3 à 4 séances par semaine, volume de pointe adapté à l'historique (jamais un gros saut), sortie longue maximale de 28 à 32 km, 3 semaines d'affûtage (voir [[affutage]]).\n- Marathon visé en moins de 4 h : 4 à 5 séances, 50 à 65 km par semaine en pointe, un tempo ou une séance à l'allure marathon par semaine.\n- Les 12 semaines avant la course : montée de **5 à 10 % par semaine**, semaine plus légère toutes les 3 à 4 semaines, sortie longue maximale environ 4 semaines avant la course.\n- Rappeler qu'aucune méthode n'est prouvée supérieure et expliquer pourquoi celle-ci est choisie.\n- Voir aussi [[allure-course-marathon]] (allure et stratégie de course) et [[nutrition-glucides]].",
    "pieges": "- Courir des sorties de plus de 35 km « pour être sûr » : la recherche n'y voit pas de bénéfice.\n- Copier le volume d'un plan « fort » avec un historique de 30 km par semaine.\n- Comparer les méthodes entre elles : les données viennent de plans et de cohortes, pas d'essais comparatifs.",
    "sources": [
      {
        "titre": "Quantitative Analysis of 92 12-Week Sub-elite Marathon Training Plans",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11065819/"
      },
      {
        "titre": "Training for a (half-)marathon: training volume and longest endurance run related to performance and running injuries",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7496388/"
      },
      {
        "titre": "Physiological and training characteristics of recreational marathon runners",
        "url": "https://pubmed.ncbi.nlm.nih.gov/29200895/"
      },
      {
        "titre": "Training-related determinants and taper in recreational marathoners (Frontiers, 2021)",
        "url": "https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2021.735220/full"
      },
      {
        "titre": "Pfitzinger Marathon Plan : points forts et limites (blog, source secondaire)",
        "url": "https://runningwithrock.com/pfitzinger-marathon-plan/"
      },
      {
        "titre": "Hansons Marathon Method : la sortie de 16 miles (blog de coach, source secondaire)",
        "url": "https://lukehumphreyrunning.com/hansons-marathon-method-the-16-miler/"
      }
    ],
    "voirAussi": [
      "affutage",
      "allure-course-marathon",
      "nutrition-glucides"
    ]
  },
  {
    "id": "course-monotonie-variation",
    "titre": "Course à pied : monotonie, variété du plan et fenêtres de 7 jours glissants",
    "sports": [
      "course"
    ],
    "motsCles": [
      "monotonie",
      "Foster",
      "variété",
      "plan répétitif",
      "même séance chaque semaine",
      "mêmes jours",
      "ondulé",
      "linéaire",
      "variabilité de la charge",
      "7 jours glissants",
      "fenêtre glissante",
      "semaine glissante",
      "tension"
    ],
    "preuve": "debattu",
    "maj": "2026-11-09",
    "essentiel": "- La **monotonie** de Foster est le rapport entre la charge moyenne quotidienne et son écart-type sur une semaine : plus on fait des jours tous semblables, plus elle monte. La **tension** est la monotonie multipliée par la charge de la semaine.\n- Dans l'étude d'origine (Foster, 1998), une monotonie et une tension élevées allaient avec plus d'**infections bénignes** et de surentraînement. Les **revues récentes** jugent le lien **faible et contradictoire** : les indicateurs de variation de la charge aiguë et de la charge chronique sont mieux soutenus que la monotonie. Le seuil de 2,0 souvent cité est une **convention**, pas un résultat.\n- Le **signal le mieux établi** sur les blessures de course est ailleurs : une **séance isolée** bien plus longue que la plus longue des 30 derniers jours (voir [[course-blessures-progression]]).\n- **Varier** la charge n'est pas une règle prouvée, mais un petit essai sur des coureurs récréatifs favorise une charge **ondulée** (jours durs et jours faciles, baisse de volume toutes les quelques semaines). Un plan où toutes les semaines sont identiques ne donne **aucun stimulus nouveau** et ne ressemble pas à ce que font les coachs.\n- Les **fenêtres glissantes de 7 jours** sont ce qu'utilise la recherche sur la charge (une semaine calendrier est arbitraire) : Rush compte les semaines du plan à partir du **premier jour du plan**, et calcule le volume de départ sur les **7 derniers jours glissants**.",
    "recherche": "- **Foster (1998)**, rapporté par les revues : la charge d'entraînement (moyenne glissante sur 6 semaines), la monotonie (moyenne quotidienne divisée par l'écart-type) et la tension étaient associées aux infections bénignes (mesure de charge : séance × effort perçu).\n- **Revue systématique d'études longitudinales** (*Sports Medicine*, 2016) : une seule étude antérieure associe monotonie et tension à la maladie ; ses auteurs écrivent que les résultats montrent des preuves **contradictoires** et que le rôle de ces indicateurs n'est **pas soutenu** par la littérature pour surveiller les blessures ; les variations de charge aiguë et chronique sont mieux soutenues.\n- **Jeunes athlètes** (synthèse des meilleures preuves) : peu d'études, estimation de monotonie et maladie non significative (OR 2,52, IC 0,79 à 8,08).\n- **Coureurs de trail** (petite étude) : les coureurs blessés montraient, dans les 3 semaines avant la blessure, des hausses de charge aiguë, de ratio aigu/chronique, de monotonie et de tension, avec une grande variabilité d'un coureur à l'autre.\n- **5 200 coureurs** : pas d'association (voire association inverse) entre le ratio aigu/chronique ou les changements hebdomadaires progressifs et la blessure ; le facteur de risque est une **séance d'au moins 10 % plus longue que la plus longue des 30 derniers jours**.\n- **Ultramarathoniens** : un volume plus faible et une fréquence d'entraînement plus faible vont avec plus de blessures ; les variations brutales de charge pèsent peu.\n- **Charge ondulée contre linéaire** (essai randomisé, hommes coureurs récréatifs) : la charge **ondulée au jour le jour** a donné de meilleurs gains aérobies ; la charge linéaire est associée à de moins bons marqueurs de récupération ; les marqueurs de lésion musculaire étaient plus bas avec des baisses de volume toutes les 4 semaines. Ce n'est **pas** une mesure de blessure réelle. Une méta-analyse en musculation ne trouve **aucune différence** entre linéaire et ondulé pour la force, avec l'idée que la **nouveauté** aide peut-être. Aucune étude trouvée sur l'**adhésion** ni sur la blessure de course.",
    "regles": "- **Varier sans bricoler** : jours qui changent d'une semaine à l'autre, nombre de séances qui baisse d'une en semaine de récupération (à partir de 4 séances), footings qui alternent (lignes droites, simple, progressif), qualité qui alterne (VMA puis tempo) et qualité légère en semaine de récupération, sortie longue qui finit plus vite une semaine sur deux, sortie longue le week-end en alternant samedi et dimanche.\n- **Jamais deux séances dures collées**, même d'une fenêtre de 7 jours à la suivante.\n- Dire honnêtement que la monotonie de Foster est un indicateur **discuté** : on s'en sert comme idée (alterner jour dur et jour facile), pas comme alarme.\n- Une personne qui préfère toujours **les mêmes jours** (travail, famille) : le lui permettre. La régularité du rythme aide sans doute l'adhésion (aucune étude trouvée) ; on peut garder les mêmes jours et varier **le contenu**.\n- Pour une semaine **glissante** : toujours les 7 derniers jours à partir d'aujourd'hui, jamais « depuis lundi ».\n- Voir [[periodisation]], [[charge-forme-fraicheur]], [[course-periodisation-recuperation]].",
    "pieges": "- Présenter la monotonie ou le ratio aigu/chronique comme un test de risque de blessure.\n- Varier pour varier : changer l'allure ou le volume d'un coup est plus risqué que de répéter une séance.\n- Confondre « jours différents » et « charge différente » : la variété qui compte est celle de **l'effort**, pas du calendrier.",
    "sources": [
      {
        "titre": "Training Load and Fatigue Marker Associations with Injury and Illness : systematic review of longitudinal studies",
        "url": "https://link.springer.com/article/10.1007/s40279-016-0619-5"
      },
      {
        "titre": "Methods of Monitoring Internal and External Loads and Their Relationships with Injury or Illness in Adolescent Athletes",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10356657/"
      },
      {
        "titre": "Variations of Workload Indices Prior to Injuries : a study in trail runners",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7312824/"
      },
      {
        "titre": "How much running is too much? Identifying high-risk running sessions in a 5200-person cohort study",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12421110/"
      },
      {
        "titre": "Assessing the relationship between training load and injury in ultramarathon runners",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12327882/"
      },
      {
        "titre": "Effects of undulatory, staggered and linear load manipulations in aerobic training in male recreational runners (essai randomisé)",
        "url": "https://link.springer.com/article/10.1186/s40798-019-0200-5"
      },
      {
        "titre": "Comparison of linear and undulating periodization resistance training : systematic review and meta-analysis",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12999919/"
      }
    ],
    "voirAussi": [
      "course-blessures-progression",
      "periodisation",
      "charge-forme-fraicheur",
      "course-periodisation-recuperation"
    ]
  },
  {
    "id": "course-nutrition-hydratation",
    "titre": "Course à pied : glucides pendant l'effort, hydratation, sodium (semi, marathon, ultra)",
    "sports": [
      "course"
    ],
    "motsCles": [
      "glucides",
      "gels",
      "60 g par heure",
      "90 g par heure",
      "entraînement de l'intestin",
      "hydratation",
      "boire à la soif",
      "hyponatrémie",
      "sodium",
      "ravitaillement",
      "marathon",
      "ultra",
      "carburant"
    ],
    "preuve": "probable",
    "maj": "2026-11-09",
    "essentiel": "- **Glucides pendant l'effort** : vers **30 à 60 g par heure** au-delà d'une heure ; **jusqu'à 90 g par heure** au-delà de 2 h 30 à 3 h (mélange glucose et fructose, environ 2:1), avec **entraînement de l'intestin** à l'entraînement. Au-dessus de 90 g par heure, on est dans l'**expérimental**.\n- **Boire à la soif** : le consensus international sur l'hyponatrémie à l'effort recommande de boire **selon la soif**, ni plus ni moins, et non un volume fixe ; **boire le plus possible** est un facteur de risque.\n- La plupart des marathoniens **sous-alimentent** : en moyenne **35 g par heure** dans une étude ; ceux qui restent dans 60–90 g par heure sont plus souvent sous 3 h.",
    "recherche": "- **Recommandations** (ACSM et revues) : 30–60 g/h pour un effort de plus d'une heure ; 60 g/h les 2 h 30 premières, jusqu'à 90 g/h au-delà ; **ratio glucose/fructose ≈ 2:1** pour dépasser 60 g/h.\n- **Entraînement de l'intestin** : les preuves sont surtout **anecdotiques** ; boire des glucides régulièrement augmente peut-être la capacité d'absorption.\n- **Trail marathon** (coureurs d'élite déjà habitués) : **120 g/h** a donné **moins de lésions musculaires** et une meilleure récupération que 60–90 g/h (petite étude préliminaire). Sur 120 km d'ultra, l'apport allait de 22 à 63 g/h : les auteurs insistent sur l'individualisation.\n- **Hyponatrémie** : facteurs de risque = boire plus de 3 à 3,5 L pendant la course, gain de poids pendant l'effort, durée longue, sexe féminin, indice de masse corporelle extrême, anti-inflammatoires ; **5 à 15 %** des marathoniens peuvent en présenter un degré dans certaines séries. Sur un trail et un Ironman, le boire à la soif avec ravitaillements bien placés a presque supprimé l'hyponatrémie sans effet sur le temps. Les règlements de course peuvent imposer un schéma de boisson.\n- Les résultats sur le **sodium ajouté** n'ont pas été couverts par cette recherche.",
    "regles": "- Pour un semi : un gel ou 30 g de glucides vers 45 min si l'objectif dépasse 1 h 30, à tester à l'entraînement ; pour un marathon : **60 g/h** à tester en séances longues, jusqu'à 90 g/h pour les plus de 3 h ; pour un ultra : individualiser, commencer tôt et à intervalles réguliers.\n- Tester **le produit, la quantité et le rythme** sur les sorties longues, **jamais le jour de la course**.\n- **Boire à la soif**, sans forcer ; ne pas conseiller de boire « le plus possible ». Voir [[nutrition-glucides]] et [[chaleur-altitude]].\n- Pas de plan alimentaire détaillé, pas de régime, pas de conseil médical : orienter vers un diététicien du sport si besoin ([[energie-reds]]).",
    "pieges": "- Nouvelle boisson ou gel le jour de l'objectif.\n- Suivre « 500 mL par heure » à la lettre quand on est lent et qu'il fait frais.\n- Compter sur la seule soif pour manger : la sensation de faim arrive tard, la prise de glucides doit être **planifiée**.",
    "sources": [
      {
        "titre": "A Step Towards Personalized Sports Nutrition : Carbohydrate Intake During Exercise",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC4008807/"
      },
      {
        "titre": "Nutritional Intake and Timing of Marathon Runners : Influence on Finishing Time",
        "url": "https://link.springer.com/article/10.1186/s40798-024-00801-w"
      },
      {
        "titre": "Effects of 120 vs. 60 and 90 g/h Carbohydrate Intake during a Trail Marathon",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7400827/"
      },
      {
        "titre": "Exercise-Induced Hyponatremia : international hydration recommendations (Gran Trail de Peñalara, Ironman)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8898836/"
      },
      {
        "titre": "Exercise-Associated Hyponatremia in Marathon Runners",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9699060/"
      }
    ],
    "voirAussi": [
      "nutrition-glucides",
      "chaleur-altitude",
      "energie-reds"
    ]
  },
  {
    "id": "course-pacing-course",
    "titre": "Course à pied : stratégie d'allure en course (5 km, 10 km, semi, marathon, cross)",
    "sports": [
      "course"
    ],
    "motsCles": [
      "allure de course",
      "pacing",
      "départ trop rapide",
      "négative split",
      "allure régulière",
      "final",
      "record du monde",
      "5 km",
      "10 km",
      "stratégie de course",
      "première moitié",
      "cross-country"
    ],
    "preuve": "probable",
    "maj": "2026-11-09",
    "essentiel": "- Sur **5 000 m et 10 000 m**, les records du monde sont courus à **allure presque régulière**, avec un **premier et un dernier kilomètre un peu plus rapides** que le milieu (profil en « U »). Les auteurs lisent la fin rapide comme une **réserve gardée** en milieu de course.\n- En **championnat**, les courses sont plutôt **tactiques** (allure variable, finale rapide) ; en **cross**, l'allure est surtout **décroissante**.\n- Au **marathon**, la quasi-totalité des amateurs ralentissent (**perte d'allure de ≈ 25 %** chez les marathoniens néerlandais étudiés, ≈ 11 % au semi) : partir **un peu trop lentement** coûte moins que partir trop vite.",
    "recherche": "- **Analyse des records du monde masculins** (32 records du 5000 m, 34 du 10 000 m, 1920–2004) : le premier et le dernier kilomètre sont plus rapides que le milieu ; la fin de course est un « sprint » issu d'une réserve.\n- **Revues récentes** : la forme en U apparaît en 1500 m, 5000 m et 10 000 m dans les meetings ; en championnat, un pacing **négatif** avec petites variations ; en cross, positif. La plupart des analyses de records sont **anciennes** ; les records récents peuvent suivre un profil différent.\n- **Marathon** : une analyse de très grandes séries de temps intermédiaires étudie les profils d'allure et leurs effets sur le résultat (je n'ai lu que le résumé) ; cohortes d'amateurs : perte d'allure forte, associée à un volume et une sortie longue plus faibles.",
    "regles": "- **10 km** : départ **à l'allure visée**, jamais plus vite sur le 1ᵉʳ km ; garder un peu de marge jusqu'au km 7 ; accélérer sur les 2 derniers km si les jambes répondent. Prévoir **±3 à 5 s/km** de variation selon le vent et les côtes.\n- **5 km** : départ **légèrement plus rapide** (de 2 à 3 s/km) puis régulier ; finir à fond.\n- **Semi et marathon** : allure régulière ; premier quart **légèrement plus lent** que l'allure visée ; voir [[allure-course-marathon]].\n- Rappeler que **chaleur, vent et côtes** font perdre du temps : adapter l'objectif plutôt que forcer.\n- Donner à l'utilisateur **une phrase de plan de course** (allure de départ, repère au km 5, repère au km 8) calculée à partir de l'objectif du plan.",
    "pieges": "- Partir « porté par la foule » trop vite : le temps perdu à la fin est supérieur au temps gagné au départ.\n- Se fier à la montre en côte : l'allure se juge à l'effort dans les côtes.",
    "sources": [
      {
        "titre": "An analysis of pacing strategies during men's world-record performances in track athletics",
        "url": "https://pubmed.ncbi.nlm.nih.gov/19116437/"
      },
      {
        "titre": "Pacing profiles and tactical behaviors of elite runners",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8500812/"
      },
      {
        "titre": "Pacing strategy patterns and performance outcomes in marathon running : large-scale analysis of split time data",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC13379030/"
      },
      {
        "titre": "Training for a (half-)marathon : volume and longest endurance run",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7496388/"
      }
    ],
    "voirAussi": [
      "allure-course-marathon"
    ]
  },
  {
    "id": "course-periodisation-recuperation",
    "titre": "Course à pied : périodisation d'une saison, montée du volume, semaines de récupération, calendrier de courses",
    "sports": [
      "course"
    ],
    "motsCles": [
      "périodisation",
      "saison",
      "macrocycle",
      "mésocycle",
      "montée du volume",
      "semaine de récupération",
      "semaine allégée",
      "double périodisation",
      "transition",
      "calendrier de courses",
      "courses préparatoires",
      "récupération après un marathon"
    ],
    "preuve": "pratique",
    "maj": "2026-11-09",
    "essentiel": "- Les coureurs d'élite font en général **une périodisation simple** (piste) ou **double** (deux marathons par an) ; la préparation générale (volume) précède la préparation spécifique (allure de course), et le volume **ne s'effondre pas** pendant la saison.\n- **Montée du volume** (élite) : la première semaine à **40–60 % du pic**, puis **+5 à +15 km par semaine** sur 8 à 12 semaines, d'abord en ajoutant des séances, puis en les allongeant.\n- **Transition** : 1 à 2 semaines de repos ou de footing facile (jusqu'à 4 semaines chez certains) après la saison ; **après un marathon**, 7 à 14 jours de repos complet ou très facile.\n- L'idée d'une **semaine allégée toutes les 3–4 semaines** est une **pratique de coachs**, pas une règle prouvée (aucune étude trouvée) ; elle reste un bon repère pour un amateur.",
    "recherche": "- **Haugen et al. (2022)** : les coureurs de piste font 9 ± 3 courses par an, les marathoniens 6 ± 2 dont 2 ± 1 marathons espacés d'au moins 3 mois ; la dernière course avant l'objectif est 4 ± 2 semaines (piste) ou 10 ± 5 semaines (marathon) avant ; l'affûtage commence **7 à 10 jours** avant l'objectif. Le **pic de volume** peut atteindre 20–30 km de plus que la moyenne, pendant 2–3 semaines seulement ; certains marathoniens utilisent un modèle linéaire inversé (pic de volume tard dans la préparation).\n- **Plans de marathon (92)** : montée d'environ 3 km par semaine (+5 à 9 %), pic 3,6 à 4,4 semaines avant la course, baisse de 22 à 31 % jusqu'à la semaine de course puis −46 à −54 % la dernière semaine.\n- **Affûtage** : voir [[affutage]] ; méta-analyse de Bosquet (2007) : 2 semaines, baisse de 41 à 60 % du volume, intensité inchangée ; une analyse de plus de 158 000 marathoniens amateurs va dans le sens d'un affûtage de **3 semaines**.\n- **Récupération entre séances** : on n'a pas trouvé d'étude sur l'espacement optimal des séances dures ; les courbatures disparaissent **avant** le retour complet de la fonction musculaire après un effort long ; les **footings de récupération** n'ont **aucune preuve** d'accélérer la récupération (leur intérêt est de ne pas gêner la récupération) ; massage, immersion en eau froide, récupération active : **preuves faibles**.\n- **Aucune étude** n'a testé « 3 semaines de charge, 1 allégée » comme règle ; le coach doit nuancer.",
    "regles": "- Structure d'un plan : **base → développement → spécifique → affûtage** ; sur 12 semaines : 2 à 3 semaines de base, 5 à 6 de développement, 2 à 3 de spécifique, 1 à 2 d'affûtage ; plus court : base écourtée.\n- **Une semaine plus légère** (≈ 80 % du volume) toutes les 4 semaines pour un amateur, jamais pendant la dernière phase ; la dire comme une habitude de coach.\n- Ne **jamais placer deux séances dures** à moins de 48 h, ni de séance dure la veille d'une course ; la veille : footing léger ou repos.\n- Après un marathon : **1 à 2 semaines** de repos et de footing facile ; après un 10 km : 2 à 5 jours faciles.\n- Voir aussi [[periodisation]] et [[surentrainement-fatigue]].",
    "pieges": "- Remplir toutes les semaines à 100 % sans respiration.\n- Utiliser un plan d'élite (11 à 14 séances par semaine) comme modèle pour un amateur.\n- Promettre qu'un massage ou un bain froid « fait récupérer plus vite ».",
    "sources": [
      {
        "titre": "The Training Characteristics of World-Class Distance Runners (Haugen et al., 2022)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/"
      },
      {
        "titre": "Quantitative Analysis of 92 12-Week Sub-elite Marathon Training Plans",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11065819/"
      },
      {
        "titre": "Effects of tapering on performance : a meta-analysis (Bosquet et al., 2007)",
        "url": "https://pubmed.ncbi.nlm.nih.gov/17762369/"
      },
      {
        "titre": "Effects of tapering on performance in endurance athletes : systematic review and meta-analysis (2023)",
        "url": "https://pubmed.ncbi.nlm.nih.gov/37163550/"
      },
      {
        "titre": "Effects of different recovery strategies following a half-marathon on fatigue markers in recreational runners",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC6226207/"
      }
    ],
    "voirAussi": [
      "affutage",
      "periodisation",
      "surentrainement-fatigue"
    ]
  },
  {
    "id": "course-principes-generaux",
    "titre": "Course à pied : les principes qui tiennent d'un plan à l'autre",
    "sports": [
      "course"
    ],
    "motsCles": [
      "course à pied",
      "plan d'entraînement",
      "principes",
      "endurance",
      "80/20",
      "progressivité",
      "sortie longue",
      "qualité",
      "régularité",
      "comment s'entraîner",
      "5 km",
      "10 km",
      "semi",
      "marathon",
      "trail"
    ],
    "preuve": "probable",
    "maj": "2026-11-09",
    "essentiel": "- Tous les plans sérieux (Daniels, Pfitzinger, Hansons, Lydiard, Canova, Norvégiens) reposent sur les **mêmes briques** : beaucoup de course **facile**, **une ou deux séances de qualité** par semaine (seuil, VO2max, allure de course), **une sortie longue**, une **montée progressive** de la charge, des **semaines plus légères**, un **affûtage** avant l'objectif.\n- Ce qui change d'une école à l'autre, c'est surtout le **dosage** (volume, nombre de séances dures, place de l'allure de course) et la **spécificité** à mesure que la course approche. Aucune école n'a été prouvée supérieure aux autres par des essais comparatifs.\n- Chez les coureurs d'élite, **au moins 80 % du volume** est à intensité faible, toute l'année (Haugen et al., 2022). Chez les amateurs, la règle utile est la même : la majorité du temps facile, une minorité de qualité bien choisie.\n- La **régularité** compte plus que la séance parfaite : les études sur marathoniens amateurs associent un volume hebdomadaire plus élevé et une sortie longue de 30 à 35 km à de meilleurs chronos, sans lien net avec les blessures (voir [[course-marathon-methodes]]).",
    "recherche": "- Revue des coureurs de classe mondiale (800 m à marathon) : 11 à 14 séances par semaine, 80 % ou plus du volume à intensité faible, 5 à 15 % de séances à l'allure seuil, le reste à haute intensité ; la structure change peu au fil de l'année, c'est la **proportion de travail spécifique** qui augmente (Haugen et al., 2022, revue de la littérature et de la pratique).\n- Revues systématiques sur la distribution d'intensité chez les coureurs de demi-fond et de fond : les approches **polarisée** et **pyramidale** donnent de meilleurs gains que la distribution centrée sur le seuil ; la combinaison « 70 % de volume faible, 30 % de seuil et de haute intensité » est jugée nécessaire (revues de 2018 et 2022). Voir [[course-distribution-intensite]].\n- Les plans de marathon de niveau sous-élite montrent aussi une très grande part de zone 2 (environ 65 % du volume) et seulement 5 à 8 % en zones 4 et 5 (analyse de 92 plans, 2024).",
    "regles": "- Construire tout plan avec : une base facile dominante, une séance de qualité (deux à partir de 4 séances par semaine et hors phase de base), une sortie longue, au moins un jour sans séance par semaine, un affûtage avant la course.\n- Adapter les chiffres au **niveau réel** de la personne (ses sorties récentes), jamais à un plan tout fait : le moteur de l'application calcule les allures, le coach explique.\n- Expliquer le **but** de chaque séance en une phrase (endurance, vitesse, allure de course, solidité).\n- Si une demande va contre ces principes (par exemple enchaîner des séances dures chaque jour), le dire franchement avec la raison, puis faire ce que la personne décide.",
    "pieges": "- Croire qu'une méthode « prouvée » existe : les écoles sont des cadres de coaching, pas des résultats d'essais contrôlés.\n- Copier le volume d'un plan d'élite : 130 à 220 km par semaine chez l'élite ne se transpose pas.\n- Faire toutes les sorties à la même allure moyenne (ni facile, ni dure).",
    "sources": [
      {
        "titre": "The Training Characteristics of World-Class Distance Runners (Haugen et al., 2022)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/"
      },
      {
        "titre": "Training-intensity distribution in middle- and long-distance runners: a systematic review (2018)",
        "url": "https://pubmed.ncbi.nlm.nih.gov/29182410/"
      },
      {
        "titre": "Training-intensity distribution on middle- and long-distance runners: a systematic review (2022)",
        "url": "https://lida.sport-iat.de/ta/Record/4075045"
      },
      {
        "titre": "Quantitative Analysis of 92 12-Week Sub-elite Marathon Training Plans",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11065819/"
      }
    ],
    "voirAussi": [
      "course-marathon-methodes",
      "course-distribution-intensite"
    ]
  },
  {
    "id": "course-reprise-debutants",
    "titre": "Course à pied : débutants, reprise après arrêt, désentraînement et réentraînement",
    "sports": [
      "course"
    ],
    "motsCles": [
      "débutant",
      "couch to 5k",
      "alterner marche et course",
      "reprise",
      "arrêt",
      "désentraînement",
      "perte de niveau",
      "retrouver son niveau",
      "blessé",
      "aqua jogging",
      "vélo",
      "vétérans",
      "masters",
      "premier 5 km"
    ],
    "preuve": "probable",
    "maj": "2026-11-09",
    "essentiel": "- **Débutant** : commencer par **alterner marche et course**, 3 séances par semaine, avec une **progression lente** ; les programmes structurés protègent mieux que le « je fais ce que je sens ». Moins d'un tiers des participants à un programme de type « Couch to 5K » le terminent ; avoir déjà été blessé multiplie le risque.\n- **Désentraînement** : la VO2max baisse en quelques jours à semaines (≈ **−7 % en 12 jours**, ≈ **−10 % à 5 semaines**, ≈ **−20 % à 2 mois**), surtout par baisse du volume sanguin ; l'**endurance** (temps jusqu'à l'épuisement) baisse vite aussi (≈ −9 % en 2 semaines). L'**économie de course** baisse moins vite.\n- **Réentraînement** : on récupère **plus vite qu'on ne perd**, souvent en un temps comparable à la durée de l'arrêt chez des athlètes entraînés ; l'économie de course et la masse musculaire reviennent plus lentement.\n- **Partir du principe que le niveau a baissé** : un vieux record ne sert pas de référence.",
    "recherche": "- **Revue sur le désentraînement** (41 études) : VO2max −7 % à 12 jours, −4,7 % à 14 jours, −10,1 % à 5 semaines, ≈ −20 % à 2 mois (long terme > 4 semaines). Le volume sanguin baisse de ≈ 9 % en 2 à 4 semaines d'inactivité complète ; le volume d'éjection baisse (≈ −4 % à 2 semaines, ≈ −14 % à 56 jours) ; la fréquence cardiaque maximale monte de 2 à 9 bpm. L'enzyme mitochondriale (citrate synthase) baisse de 5 % après 6 jours et de ≈ 29 % après 10 jours. **Entraînement réduit** : quatre semaines à faible volume et intensité modérée à élevée maintiennent la VO2max ; **une séance intense par semaine** pendant un arrêt de 8 semaines la préserve, **pas** l'entraînement facile seul ; mais l'endurance peut quand même baisser (−21 % du temps jusqu'à l'épuisement dans un cas).\n- **Athlètes vétérans** : 3 mois d'arrêt = environ **10 % de VO2max perdu**, soit l'équivalent d'un vieillissement d'environ 15 ans ; ces athlètes peuvent retrouver leur VO2max en un temps comparable à la durée de l'arrêt.\n- **Aqua-jogging** (course en eau profonde) : 6 semaines **maintiennent la VO2max** de coureurs entraînés (essai de 16 hommes) ; la VO2max mesurée en eau est de ≈ 75 % de celle sur tapis ; **le vélo** et l'aqua-jogging maintiennent le temps sur 2 miles malgré une petite perte de VO2max (étude de 1993).\n- **Débutants** : les coureurs qui improvisent se blessent plus que ceux qui suivent un programme structuré (étude britannique, observationnelle) ; un programme de graduation seul n'a pas réduit les blessures dans un essai sur des débutants (cité sans texte complet).",
    "regles": "- **Reprise après arrêt** (repères de terrain, non validés par des essais) : si moins de 2 semaines d'arrêt, reprendre à 80–90 % du volume précédent ; **2 à 8 semaines**, reprendre à 60 % et remonter de 10 % par semaine ; plus de 8 semaines, traiter comme un nouveau départ progressif et **utiliser une sortie test**. Jamais d'intensité la première semaine de reprise ; une séance de qualité légère à partir de la 2ᵉ–3ᵉ semaine (voir [[reprise-apres-arret]]).\n- **Débutant** : 3 séances, 20 à 30 min, alternance course/marche (par exemple 1 min de course et 2 min de marche, puis 2/1, 3/1…), un jour de repos entre deux séances, objectif **finir** un 5 km avant de chercher un chrono.\n- Blessé : proposer vélo ou aqua-jogging pour **maintenir la forme**, sans présenter ça comme un équivalent, et **orienter vers un professionnel**.\n- Vétérans et reprise : garder au moins **une séance d'intensité** par semaine dès que la douleur le permet.",
    "pieges": "- Reprendre au volume d'avant l'arrêt.\n- Calibrer un plan sur un chrono ancien (voir [[course-tests-terrain]]).\n- Croire qu'un bon test récent prouve que la forme d'endurance est intacte.",
    "sources": [
      {
        "titre": "Cardiorespiratory and metabolic consequences of detraining in endurance athletes",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10853933/"
      },
      {
        "titre": "The Impact of Training on the Loss of Cardiorespiratory Fitness in Aging Masters Endurance Athletes",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9517884/"
      },
      {
        "titre": "Influence of water run training on the maintenance of aerobic performance",
        "url": "https://pubmed.ncbi.nlm.nih.gov/8871917"
      },
      {
        "titre": "Effect of water running and cycling on maximum oxygen consumption and 2-mile run performance",
        "url": "https://pubmed.ncbi.nlm.nih.gov/8427367/"
      },
      {
        "titre": "Couch-to-5k or Couch to Ouch : non-completion and musculoskeletal injury",
        "url": "https://pubmed.ncbi.nlm.nih.gov/37681822/"
      },
      {
        "titre": "Running with injury : UK novice and recreational runners",
        "url": "https://pubmed.ncbi.nlm.nih.gov/29853263/"
      }
    ],
    "voirAussi": [
      "reprise-apres-arret",
      "course-tests-terrain"
    ]
  },
  {
    "id": "course-semi-marathon",
    "titre": "Course à pied : préparer un semi-marathon",
    "sports": [
      "course"
    ],
    "motsCles": [
      "semi-marathon",
      "semi",
      "21 km",
      "21",
      "1 km",
      "plan semi",
      "sortie longue semi",
      "volume hebdomadaire",
      "allure semi",
      "seuil"
    ],
    "preuve": "probable",
    "maj": "2026-11-09",
    "essentiel": "- Le semi se prépare comme un 10 km **plus endurant** : sortie longue qui dépasse la distance de la course, du travail au **seuil** (autour de l'allure semi) et à l'allure de course, un volume hebdomadaire plus haut.\n- Chez des coureurs amateurs, un **volume hebdomadaire supérieur à 32 km** et une **sortie longue de plus de 21 km** vont avec un chrono plus rapide et une moindre perte d'allure, **sans plus de blessures** dans cette étude observationnelle.\n- L'allure d'entraînement moyenne compte aussi : s'entraîner plus vite en moyenne va avec un meilleur chrono.",
    "recherche": "- Étude néerlandaise (cohorte INSPIRE, 556 semi-marathoniens et 441 marathoniens, entraînement déclaré 2 à 6 semaines avant la course) : au semi, courir plus de 32 km par semaine = environ **4,2 min plus vite** que 20–32 km ; une sortie longue de plus de 21 km = environ **3,9 min plus vite** que 15–21 km ; une allure d'entraînement sous 5:15/km = environ **13,6 min plus vite** qu'une allure autour de 5:15–6:00/km. Aucune de ces habitudes n'a été associée à plus de blessures (48 % de blessés au semi pendant le suivi, 55 % au marathon, tous profils confondus).\n- Limites : données déclarées, pas de mesure d'intensité, coureurs plus expérimentés que les exclus ; ce sont des associations, pas des causes (les coureurs plus rapides s'entraînent aussi plus).\n- Séances types de l'élite pour le demi-fond long (Haugen et al., 2022) : tempo de 20 à 50 min autour de l'allure semi, intervalles de seuil (10–12 × 1000 m récup 1 min), sortie longue progressive de 45 à 90 min qui finit à l'allure semi.",
    "regles": "- Semaine type (3 à 5 séances) : footing, séance de **seuil** (tempo continu de 20 à 35 min ou blocs de 3 × 10 min), séance d'**allure de course** (par exemple 3 × 3 km), sortie longue de 60 à 100 min progressive.\n- Sortie longue : viser autour de la distance de la course (jusqu'à 21 km environ) sans l'imposer à un débutant ; elle ne dépasse pas ≈ 30 à 40 % du volume hebdomadaire (repère de coach, non prouvé).\n- Affûtage de 7 à 10 jours : volume ≈ −40 à −60 %, intensité et fréquence maintenues (voir [[affutage]]).\n- Si la personne court moins de 20 km par semaine, le plan vise d'abord le **finir** et la régularité, pas un chrono.",
    "pieges": "- Interpréter l'étude néerlandaise comme « courir plus vite en entraînement rend plus rapide » : c'est une association.\n- Allonger la sortie longue d'un coup (voir [[course-blessures-progression]] : les pics de séance comptent plus que le total hebdomadaire).",
    "sources": [
      {
        "titre": "Training for a (half-)marathon: training volume and longest endurance run related to performance and running injuries",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7496388/"
      },
      {
        "titre": "The Training Characteristics of World-Class Distance Runners (Haugen et al., 2022)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/"
      }
    ],
    "voirAussi": [
      "affutage",
      "course-blessures-progression"
    ]
  },
  {
    "id": "course-seuil-norvegien",
    "titre": "Course à pied : le modèle norvégien (intervalles de seuil guidés par la lactatémie) pour les coureurs",
    "sports": [
      "course"
    ],
    "motsCles": [
      "norvégien",
      "Bakken",
      "Ingebrigtsen",
      "lactate",
      "2 à 4 mmol",
      "double seuil",
      "intervalles de seuil",
      "400 m",
      "1000 m",
      "lactatémie",
      "haut volume faible intensité"
    ],
    "preuve": "debattu",
    "maj": "2026-11-09",
    "essentiel": "- Modèle de coachs norvégiens (Bakken, famille Ingebrigtsen) : **beaucoup de volume facile** (jusqu'à 150–180 km par semaine) et **3 à 4 séances de seuil par semaine** en **intervalles courts**, pilotées par la **lactatémie** (≈ 2 à 4,5 mmol/L), plus **une séance de VO2max**.\n- L'idée : en courant des répétitions courtes (400–1000 m, ou 2000–3000 m) à une allure légèrement plus rapide que le seuil continu, avec une récupération brève (20 s à 1,5 min), on accumule **beaucoup de travail près du seuil avec peu de fatigue**.\n- Ce modèle n'est **pas démontré** : les auteurs eux-mêmes disent qu'aucun essai contrôlé ne l'a testé. Il ne convient pas à un amateur sans suivi de lactate.",
    "recherche": "- Revue de Casado, Foster, Bakken et Tjelta (2023), dont deux auteurs sont liés au modèle : observations de cas et de coachs. Exemples : 20–25 × 400 m en moyenne 64 s avec 30 s de récupération (≈ allure 5000 m à 13:20), 20 × 400 m en 62 s avec 60 s de récupération ; la lactatémie reste sous 4 mmol/L. Sessions de 8 à 12 km au total.\n- Distribution : **pyramidale en préparation, plus polarisée en période de compétition**, avec 2 séances de seuil retirées et une séance sur piste à l'allure de course.\n- Seule donnée expérimentale proche : 8 coureurs de demi-fond, 8 semaines d'un test hebdomadaire de 20 min à 4 mmol/L ; progrès plus grands chez ceux qui gardaient une lactatémie stable (échantillon minuscule).\n- Limites : échantillons de 1500 m et 5000 m, applicabilité au marathon incertaine, risque accru de blessure et de surcharge avec plus de séances intenses.",
    "regles": "- À un amateur : présenter l'idée **sans** l'imposer. On peut s'en inspirer ainsi : **intervalles de seuil courts** (par exemple 6 × 1000 m à l'allure seuil avec 60 s de trot, ou 10 × 400 m avec 30–40 s de trot) à la place d'un tempo continu quand la personne se fatigue trop vite.\n- Sans mesure de lactate, piloter à l'**effort** : « dur mais tenable », jamais à fond ; surveiller que la 10ᵉ répétition ressemble à la première.\n- Ne pas passer à 3–4 séances de seuil par semaine : le dosage d'élite n'est pas transposable.\n- Voir [[methode-norvegienne]] (fiche générale) et [[course-seuil-tempo]].",
    "pieges": "- Copier les volumes de l'élite : le modèle suppose 150–180 km par semaine de facile.\n- Croire à une méthode « prouvée » parce qu'elle a produit des champions (génétique, encadrement et reste de l'entraînement ne sont pas séparables).",
    "sources": [
      {
        "titre": "Lactate-guided threshold interval training within a high-volume low-intensity approach (Casado et al., 2023)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10000870/"
      },
      {
        "titre": "The Training Characteristics of World-Class Distance Runners (Haugen et al., 2022)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/"
      }
    ],
    "voirAussi": [
      "methode-norvegienne",
      "course-seuil-tempo"
    ]
  },
  {
    "id": "course-seuil-tempo",
    "titre": "Course à pied : le seuil et le tempo (continu ou par intervalles)",
    "sports": [
      "course"
    ],
    "motsCles": [
      "seuil",
      "tempo",
      "allure seuil",
      "seuil lactique",
      "tempo continu",
      "cruise intervals",
      "intervalles de seuil",
      "allure semi",
      "lactate",
      "20 minutes",
      "séance de seuil"
    ],
    "preuve": "probable",
    "maj": "2026-11-09",
    "essentiel": "- Le **tempo / seuil** est un effort **soutenu mais contrôlé**, à peu près à l'allure d'un **semi-marathon** pour un coureur entraîné (allure que l'on tiendrait environ une heure). Il repousse le moment où l'on s'essouffle.\n- Deux façons de le faire : **continu** (20 à 40 min d'une traite) ou par **intervalles** (par exemple 3 × 10 min, 4 × 8 min, ou des répétitions plus courtes avec 30 à 90 s de récupération).\n- Chez les coureurs d'élite, le seuil est **fréquent** : de 5 à 15 % du volume d'une préparation, des séances de 30 à 75 min cumulées ; chez les Kényans étudiés, le tempo représenterait environ 20 % du volume annuel.",
    "recherche": "- **Elite** (Haugen et al., 2022) : **tempo continu** autour de l'allure semi, 20 à 50 min, sans fatigue excessive ; **intervalles de seuil** de 3 à 15 min (10–12 × 1000 m avec 1 min de récupération, 4 × 5000 m avec 1000 m de trot), 30 à 75 min au total.\n- **Continu contre intervalles** : sur de courts essais chez des coureurs récréatifs, les deux modes produisent des adaptations et une dépense d'oxygène **semblables** ; le continu couvre environ 10 % de distance en plus sur 20 min. Je n'ai pas trouvé d'essai long comparant l'effet sur le seuil lui-même.\n- **Intervalles de seuil guidés par la lactatémie** (Casado et al., 2023) : des répétitions courtes (400–1000 m, ou 2000–3000 m) permettent de courir **plus vite qu'en continu** avec une lactatémie contenue (2–4 mmol/L), donc d'ajouter des séances sans trop de fatigue ; modèle issu de coachs norvégiens, **aucun essai contrôlé** sur lui : voir [[course-seuil-norvegien]].\n- **Individualisation** : à lactatémie fixe de 2 mmol/L, les réponses individuelles de %VO2max, de FC et d'effort perçu varient beaucoup : les coureurs au seuil élevé doivent choisir leur intensité plus prudemment.",
    "regles": "- Seuil continu dès **15 à 20 min** en phase de développement, jusqu'à **25 à 35 min** en phase spécifique ; par intervalles pour la **première approche** (2 × 8 min, 3 × 8–10 min avec 2 min de récupération trottinée).\n- L'allure seuil est donnée par l'application (≈ 1,04 × l'allure de course dans le moteur de Rush) ; le **tempo** est un peu plus lent (≈ 1,07 ×). Si la personne n'arrive pas à tenir, **ralentir de 5 à 10 s/km** plutôt que raccourcir.\n- Une séance de seuil par semaine (deux au-delà de 4 séances de course), éloignée d'au moins 48 h d'une séance de VO2max.\n- Jamais le dernier jour avant une course.",
    "pieges": "- Courir le tempo trop vite : il devient une séance de VO2max en continu, très fatigante.\n- Croire que le seuil se « mesure » à la sensation seule : un test de terrain (voir [[course-tests-terrain]]) aide à fixer l'allure.\n- Appliquer à un amateur le volume de seuil d'un élite.",
    "sources": [
      {
        "titre": "The Training Characteristics of World-Class Distance Runners (Haugen et al., 2022)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/"
      },
      {
        "titre": "Lactate-guided threshold interval training within a high-volume low-intensity approach (Casado et al., 2023)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10000870/"
      },
      {
        "titre": "From incremental test to continuous running at fixed lactate thresholds",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10611166/"
      },
      {
        "titre": "Oxygen uptake in maximal effort constant rate and interval running",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC3826314/"
      }
    ],
    "voirAussi": [
      "course-seuil-norvegien",
      "course-tests-terrain"
    ]
  },
  {
    "id": "course-tests-terrain",
    "titre": "Course à pied : tests de terrain (3 km, 30 minutes, vitesse critique) et calibrage d'un plan",
    "sports": [
      "course"
    ],
    "motsCles": [
      "test",
      "sortie test",
      "3 km chrono",
      "test 30 minutes",
      "vitesse critique",
      "VMA",
      "vitesse maximale aérobie",
      "3000 m",
      "calibrer",
      "niveau",
      "chrono récent",
      "estimer son niveau",
      "5 km test",
      "Riegel"
    ],
    "preuve": "probable",
    "maj": "2026-11-09",
    "essentiel": "- Quand le niveau n'est pas connu (pas de chrono récent), la **bonne méthode** est un **test court** avant de fixer les allures du plan : **3 km chrono** (équivalent de la vitesse maximale aérobie, ≈ 10 à 15 min d'effort) ou **30 minutes à fond régulier** (équivalent du seuil lactique).\n- On convertit ensuite le résultat sur la distance de la course avec la formule de **Riegel** (T2 = T1 × (D2/D1)^1,06) ; elle est **optimiste** pour passer d'un court effort à un 10 km ou plus chez quelqu'un qui manque d'endurance.\n- **Dans Rush** : sans donnée récente, la première séance du plan est un **3 km chrono** ; la personne donne son temps, le coach recalibre **toutes les allures**. Avec des sorties récentes, pas de test.",
    "recherche": "- **Test de 30 min** : sur 27 coureurs et triathlètes, la vitesse moyenne d'un 30 min à fond estimait la vitesse au seuil lactique **sans écart significatif** avec le critère de laboratoire (erreur standard 0,21 m/s), mieux que la méthode VDOT (0,41 m/s).\n- **3000 m** : chez des coureurs universitaires, la vitesse moyenne d'un 3000 m **approchait la vitesse aérobie maximale** mesurée au test progressif (sous-estimation de 0,46 %) : étude unique, un groupe d'athlètes.\n- **Test 9/3 min** (9 min puis 3 min à fond) et **test de 3 min « tout-out »** : méthodes de **vitesse critique** ; le 3 min en dehors du laboratoire **n'estime pas fiablement** le seuil quand le coureur voit le temps et gère son allure. L'estimation de la vitesse critique **dépend de la méthode d'ajustement** : garder la même méthode au fil d'une saison. Les modèles sont moins précis pour des efforts très courts (> 150 % de la vitesse critique).\n- Un 4 min chrono est fiable pour mesurer la performance mais peut **sous-estimer** la VO2max.\n- Aucun test de 3 km n'a été validé **directement** comme estimation du seuil : n'en déduire qu'une **vitesse aérobie**.",
    "regles": "- **Protocole de la sortie test (3 km)** : 12 min d'échauffement facile + 4 lignes droites, **3 km sur piste ou terrain plat**, **départ prudent puis régulier** (viser un 2ᵉ km égal au 1ᵉʳ, finir en accélérant), 10 min de retour au calme. Conditions : en forme, bien reposé, pas par grosse chaleur, pas la veille d'une séance dure.\n- Après le test : demander le **temps exact** (mm:ss), le **ressenti** (RPE sur 10) et les conditions (vent, côte). Convertir avec Riegel ; **ne jamais prendre le chrono d'un test raté** (départ trop rapide, blessure) pour le niveau.\n- Si le chrono est **bien meilleur ou bien plus mauvais** que l'estimation, recalibrer **tout le plan** et le dire.\n- Un test tous les 6 à 8 semaines suffit à recaler les allures ; ne pas en faire plus.\n- Un test n'est **pas** une obligation : si la personne refuse, partir de ses sorties récentes ou d'un temps visé, en le disant.",
    "pieges": "- Test fait fatigué, après une séance dure ou en côte.\n- Départ trop rapide : le 3ᵉ kilomètre s'effondre.\n- Comparer un test de piste à un test de route avec vent.",
    "sources": [
      {
        "titre": "A comparison of methods for estimating the lactate threshold (30 min, VDOT, 3200 m, Conconi)",
        "url": "https://pubmed.ncbi.nlm.nih.gov/16095403/"
      },
      {
        "titre": "3000 m time trial as estimate of maximal aerobic speed in collegiate runners (Frontiers, 2022)",
        "url": "https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2022.1005259/full"
      },
      {
        "titre": "The 9/3 Min Running Test : estimate critical and maximal aerobic power",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11770271/"
      },
      {
        "titre": "A three-minute all-out test performed in a remote setting does not provide a valid estimate of the maximum metabolic steady state",
        "url": "https://link.springer.com/article/10.1007/s00421-022-05020-3"
      },
      {
        "titre": "Applying the Critical Speed Concept to Racing Strategy and Interval Training Prescription",
        "url": "https://pubmed.ncbi.nlm.nih.gov/27197057/"
      },
      {
        "titre": "The Measurement and Application of Critical Speed and D' in Running : a scoping review",
        "url": "https://link.springer.com/article/10.1007/s40279-026-02410-x"
      },
      {
        "titre": "The Reliability and Validity of a Four-Minute Running Time-Trial",
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5413511/"
      }
    ],
    "voirAussi": []
  },
  {
    "id": "course-trail-ultra",
    "titre": "Trail et ultra : dénivelé, descentes, sorties enchaînées, volume, blessures",
    "sports": [
      "course"
    ],
    "motsCles": [
      "trail",
      "ultra",
      "ultra-trail",
      "dénivelé",
      "D+",
      "descente",
      "excentrique",
      "marche rapide",
      "sorties enchaînées",
      "back-to-back",
      "temps sur les jambes",
      "bâtons",
      "50 km",
      "100 km",
      "UTMB",
      "montagne"
    ],
    "preuve": "pratique",
    "maj": "2026-11-09",
    "essentiel": "- En trail, **la pente change le coût de la course** : il augmente à peu près **linéairement en montée** ; **en descente**, il baisse jusqu'à environ **−10 % à −20 %** de pente puis remonte. La descente est aussi une **charge excentrique** (les muscles freinent), qui provoque des courbatures et des pertes de force.\n- La **descente se prépare** : une exposition préalable protège les séances suivantes (**effet de répétition**, jusqu'à plusieurs semaines) ; les coachs recommandent un peu de descente dans la sortie longue et du renfort excentrique si on vit sur du plat.\n- Pour les ultras, **le volume et le temps sur les jambes** comptent, avec des **sorties enchaînées** (deux jours de suite) et du **dénivelé** cumulé ; mais la preuve scientifique directe est **mince**.",
    "recherche": "- **Montée et descente** (revue de 2025, *Frontiers*) : coût énergétique en montée croissant avec la pente ; en descente, minimum autour de −10 à −20 % ; la fréquence cardiaque est un **mauvais guide** en descente (elle monte près du maximum à ≈ 70 % de VO2max). Après une descente, la force des extenseurs du genou chute de 14 à 55 % et celle des fléchisseurs plantaires de 15 à 25 %, jusqu'à **48 h**. L'effet de répétition réduit courbatures et perte de force aux séances suivantes.\n- **Cadence** : une cadence plus haute réduit la charge à chaque pas en montée comme en descente ; **chaussures** : les chaussures à plaque carbone réduisent le coût de la course sur plat, en montée et en descente, avec des résultats variables ; les chaussures de trail très rigides n'ont pas amélioré l'économie à plat et ont légèrement augmenté le coût en montée (≈ 2 %).\n- **Blessures en trail** : environ **10,7 à 19,6 blessures pour 1000 heures d'entraînement**, contre 2,5 à 5,8 sur route (même revue), avec des charges verticales plus fortes en descente.\n- **Ultra** : étude de 106 coureurs préparant les Comrades : un volume faible (moins de 100 km par semaine) va avec **plus** de blessures, un volume d'environ 150 km avec le risque le plus bas ; la **fréquence** d'entraînement compte plus que les variations brutales de charge ; les variations de charge (ACWR) ont peu d'effet (observationnel). Pour les 24 h, les caractéristiques d'entraînement prédisent peu la performance (revue narrative).\n- **Pratique de coachs** (blogs, aucune étude) : 20 à 30 min de descente cumulée dans une séance, 5 à 8 descentes d'1 min en fin de sortie longue, 1500–2000 pieds (≈ 450–600 m) de D+ par jour en moyenne sur de nombreuses semaines pour un ultra de montagne, un stage de 2–3 jours en montagne 4 à 6 semaines avant ; dernière séance excentrique dure environ **2 semaines** avant la course.",
    "regles": "- Préparation trail : monter progressivement le **D+ hebdomadaire** (+10 % environ), faire de la **marche rapide en montée** quand la pente dépasse ce qu'on peut courir sans dépasser l'allure facile ; s'entraîner à la descente à intensité faible d'abord.\n- Sorties enchaînées (samedi + dimanche) **seulement** pour des coureurs expérimentés qui préparent 50 km ou plus, en gardant la 2ᵉ sortie facile.\n- Prévoir des séances de **force** (fentes, step-downs, montées sur banc) : voir [[course-force-economie]] et [[force-pour-endurants]].\n- Pour les ultras : la nutrition fait partie de l'entraînement (voir [[course-nutrition-hydratation]]) ; la chaleur et l'altitude : [[chaleur-altitude]].\n- Ne jamais donner de volume ou de dénivelé inventé : partir de l'historique de la personne.",
    "pieges": "- Chercher le dénivelé et la descente trop vite : courbatures longues, tendinopathies.\n- Mesurer l'intensité à la fréquence cardiaque dans les descentes.\n- Copier un plan d'ultra de coureur d'élite.",
    "sources": [
      {
        "titre": "A review of uphill and downhill running : biomechanics, physiology and modulating factors (Frontiers, 2025)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12592170/"
      },
      {
        "titre": "Biomechanics and Physiology of Uphill and Downhill Running (Sports Medicine, 2017)",
        "url": "https://link.springer.com/article/10.1007/s40279-016-0605-y"
      },
      {
        "titre": "Assessing the relationship between training load and injury in ultramarathon runners",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12327882/"
      },
      {
        "titre": "24-Hour Ultra-Marathon Running : a narrative review of performance factors",
        "url": "https://link.springer.com/article/10.1186/s40798-026-00997-z"
      },
      {
        "titre": "Downhill running training (TrainRight, blog de coach)",
        "url": "https://trainright.com/downhill-running-training-go-faster-hurt-less/"
      },
      {
        "titre": "Maximizing vert (Ultrarunning, article de coach)",
        "url": "https://ultrarunning.com/featured/maximizing-vert/"
      }
    ],
    "voirAussi": [
      "course-force-economie",
      "force-pour-endurants",
      "course-nutrition-hydratation",
      "chaleur-altitude"
    ]
  },
  {
    "id": "course-vdot-allures",
    "titre": "Course à pied : niveau, VDOT, équivalences de chrono et allures d'entraînement",
    "sports": [
      "course"
    ],
    "motsCles": [
      "VDOT",
      "Daniels",
      "allures d'entraînement",
      "allure seuil",
      "allure tempo",
      "allure facile",
      "allure d'intervalle",
      "Riegel",
      "équivalence de temps",
      "prédiction de chrono",
      "VMA",
      "vVO2max",
      "pace",
      "min/km"
    ],
    "preuve": "pratique",
    "maj": "2026-11-09",
    "essentiel": "- Le **VDOT** de Jack Daniels est une « note de forme » déduite d'un chrono récent : elle sert à en déduire des **allures d'entraînement** (facile, marathon, seuil, intervalle, répétition) et des **équivalences** entre distances.\n- Les allures d'entraînement sont des **fractions fixes** d'une vitesse liée au VDOT. Les calculateurs en ligne donnent des pourcentages un peu différents : retenir des **ordres de grandeur**, pas des chiffres au centième.\n- Pour passer d'une distance à l'autre, la formule la plus simple est celle de **Riegel** : T2 = T1 × (D2 / D1)^1,06. Elle est correcte pour des coureurs bien entraînés sur ces distances, et **optimiste** quand on convertit un court effort en 10 km chez quelqu'un qui manque d'endurance.\n- **Dans Rush**, le niveau est estimé avec la formule de Riegel à partir des sorties **récentes** (jamais d'un vieux record), puis les allures sont des **multiples de l'allure de course visée** (voir plus bas). Le coach explique, il ne recalcule pas lui-même.",
    "recherche": "- Base du VDOT : Daniels et Gilbert, *Oxygen Power* (1979) : le coût en oxygène de la course est une fonction de la vitesse, et la fraction de VO2max soutenable dépend de la durée de l'effort. Les calculateurs en ligne reprennent ce modèle ; les coefficients du second terme (fraction de VO2max selon la durée) **diffèrent selon les sources** et je n'ai pas pu les vérifier dans le livre. Le VDOT est jugé fiable pour des efforts d'environ 1,5 à 50 km sur parcours plat.\n- Intensités données par un calculateur (à vérifier dans le livre) : facile ≈ 70 % de la vitesse VDOT, marathon ≈ 80 %, seuil ≈ 88 %, intervalle ≈ 98 %. D'autres sources donnent facile autour de 59 à 74 % et marathon 79 à 84 % : les bornes varient.\n- Rôle des zones (Daniels, tel que repris par les sources secondaires) : **facile** = récupération et endurance, **marathon** = allure de la course, **seuil** = effort « confortablement dur » qui élève le seuil lactique, **intervalle** = effort aérobie rapide qui développe la VO2max, **répétition** = vitesse et économie, avec beaucoup de récupération.\n- Validation d'un test de terrain : une étude sur 27 coureurs a trouvé que la méthode VDOT estime la vitesse au seuil lactique sans écart significatif avec la mesure en laboratoire, mais avec une erreur plus grande (0,41 m/s) que le test de 30 minutes (0,21 m/s) : voir [[course-tests-terrain]].",
    "regles": "- Dire que les allures sont des **repères calculés** à partir du niveau actuel, pas des vérités : après quelques séances, on les ajuste (l'utilisateur peut demander plus doux ou plus vite, et le coach recalcule).\n- Chiffres du moteur de l'application (choix de conception, pas résultats d'étude) : par rapport à l'allure de course visée, VMA ≈ 0,935 ×, allure 5 km ≈ 0,97 ×, seuil ≈ 1,04 ×, tempo ≈ 1,07 ×, footing facile ≈ 1,27 ×, sortie longue ≈ 1,30 × ; le footing est plafonné à l'allure facile réellement courue (+3 %).\n- Sans chrono récent, ne jamais s'appuyer sur un vieux record : proposer une **sortie test** (voir [[course-tests-terrain]]).\n- Ne pas promettre un chrono parce que la formule le « permet » : l'écart entre le niveau actuel et l'objectif doit être dit.",
    "pieges": "- Convertir un 5 km en 10 km (ou en marathon) sans tenir compte de l'endurance : la prédiction est optimiste.\n- Prendre une allure facile calculée plus lente que ce que la personne court vraiment : le plan lui demande alors de ralentir sans raison.\n- Utiliser un chrono couru en côte, par chaleur ou en groupe comme référence.",
    "sources": [
      {
        "titre": "VDOT : méthode et pourcentages (calculateur, source secondaire)",
        "url": "https://runcalcs.pages.dev/training/jack-daniels-vdot-calculator/"
      },
      {
        "titre": "Script de calcul du VDOT, coefficients discutés (forum intervals.icu)",
        "url": "https://forum.intervals.icu/t/script-for-calculating-jack-daniels-vdot/131024"
      },
      {
        "titre": "A comparison of methods for estimating the lactate threshold",
        "url": "https://pubmed.ncbi.nlm.nih.gov/16095403/"
      }
    ],
    "voirAussi": [
      "course-tests-terrain"
    ]
  },
  {
    "id": "course-vitesse-courte-distance",
    "titre": "Course à pied : courte distance (800 m, 1500 m, 3000 m, 5000 m) : vitesse, lactate, côtes, lignes droites",
    "sports": [
      "course"
    ],
    "motsCles": [
      "800 m",
      "1500 m",
      "3000 m",
      "5000 m",
      "demi-fond",
      "vitesse",
      "lignes droites",
      "côtes",
      "sprints",
      "tolérance au lactate",
      "réserve anaérobie",
      "vitesse maximale",
      "spécifique",
      "piste"
    ],
    "preuve": "probable",
    "maj": "2026-11-09",
    "essentiel": "- Le demi-fond (800–1500 m) demande une **VO2max élevée**, de la **capacité anaérobie** et de la **vitesse** : l'entraînement du **800 m** est plus intense et plus court que celui du **1500 m**, qui reste plutôt pyramidal avec beaucoup de facile.\n- Le **5000 m** ajoute 1 à 2 séances par semaine de **tolérance au lactate** (150 à 600 m à l'allure 800–1500 m avec 1 à 3 min de récupération) en période spécifique.\n- Pour un amateur sur 5 km : **lignes droites** après des footings, **côtes courtes**, une séance de **VMA** et une séance de **seuil**, sans aller chercher les séances d'élite de vitesse maximale.\n- Les **lignes droites** (5 à 15 s à grande vitesse, récupération complète) entretiennent la vitesse sans fatigue ; la recherche directe sur leur effet sur l'économie de course est **absente**.",
    "recherche": "- **Revue des 800/1500 m de classe mondiale** (« Crossing the Golden Training Divide », 2021) : volume en préparation avancée de **70 à 120 km/sem (800 m)** et **120 à 170 km/sem (1500 m)** ; sortie longue de 5–10 km (800 m) et 13–17 km (1500 m) ; 500 à 600 h par an. Les 1500 m font **8 à 11 séances faciles par semaine**, les 800 m 3 à 5. Séances types : seuil (8–12 × 800–1000 m), VO2max (4–7 × 800–1000 m), **tolérance au lactate** (10–16 × 200 m), **production de lactate** (5–7 × 300 m avec 3–5 min de récupération), **côtes** de 15 s à 4 min.\n- **Réserve de vitesse anaérobie** (Sandford) : l'écart entre la vitesse aérobie maximale (MAS) et la vitesse maximale de sprint (MSS) ; le rapport MSS/MAS distingue les profils (800 m ≈ 1,47 à 1,57, 800–1500 m ≈ 1,36 à 1,47). Utile pour choisir le dosage vitesse/endurance : à tester, pas validé pour les amateurs.\n- **Côtes** : un essai randomisé sur des demi-fondeurs montre qu'un entraînement en côte, surtout à pente forte, améliore la vitesse maximale et la performance ; pas d'essai équivalent chez les fondeurs.\n- Aucune étude retrouvée ne montre de gain d'économie de course avec des lignes droites seules ; les gains d'économie viennent de la **force** (voir [[course-force-economie]]).\n- **Détail 5000 m (élite)** : intervalles de seuil, VO2max et lactate tolérance, 10 à 20 km par semaine en zones 5–6 avant les championnats.",
    "regles": "- 5 km amateur : base → développement (VMA 6 à 8 × 400 m, 5 × 600 m) → spécifique (4 à 6 × 1000 m à l'allure 5 km, 3 × 1600 m) → affûtage ; 6 lignes droites de 20 s après un footing en phase de base.\n- Ne proposer de la production de lactate (très rapide, récupération complète) qu'à un coureur expérimenté, en piste ou sur terrain plat sûr, une fois par semaine au plus.\n- Les 800/1500 m amateurs : plus de force et de vitesse, sorties longues plus courtes que sur 10 km.",
    "pieges": "- Séances de vitesse sans échauffement suffisant.\n- Chercher la « vitesse » en négligeant la base d'endurance.\n- Prendre une revue d'élite comme un programme : ces volumes sont inatteignables et dangereux pour un amateur.",
    "sources": [
      {
        "titre": "Crossing the Golden Training Divide : Training 800- and 1500-m Runners",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8363530/"
      },
      {
        "titre": "The Training Characteristics of World-Class Distance Runners (Haugen et al., 2022)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/"
      },
      {
        "titre": "The effects of uphill training on the maximal velocity and performance of middle-distance runners (essai randomisé)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12214983/"
      },
      {
        "titre": "Neuromuscular factors determining 5 km running performance and running economy",
        "url": "https://link.springer.com/article/10.1007/s00421-006-0147-3"
      }
    ],
    "voirAussi": [
      "course-force-economie"
    ]
  },
  {
    "id": "course-vo2max-intervalles",
    "titre": "Course à pied : séances de VO2max (VMA) : longueur des répétitions, récupération, dosage",
    "sports": [
      "course"
    ],
    "motsCles": [
      "VO2max",
      "VMA",
      "vVO2max",
      "intervalles",
      "30-30",
      "400 m",
      "800 m",
      "1000 m",
      "3 minutes",
      "temps passé près de la VO2max",
      "récupération",
      "fractionné"
    ],
    "preuve": "probable",
    "maj": "2026-11-09",
    "essentiel": "- Une séance de VO2max vise à passer **le plus de temps possible à haute intensité aérobie** (au-dessus de 90 % de VO2max). Les répétitions de **3 minutes** font mieux que les 30 s intensifiées sur ce critère chez des coureurs de demi-fond bien entraînés.\n- Formats classiques d'élite : **2 à 4 min** à l'allure 3 à 10 km avec 2 à 3 min de récupération (4 à 7 × 800–1000 m, ou 2 × 6 × 400 m), soit environ **15 à 20 min** de travail.\n- Pour un amateur : **6 à 8 × 400 m**, **5 à 6 × 600 m**, **4 à 5 × 800 m** à l'allure de VMA, récupération trottinée proche de la durée de l'effort ou un peu plus, **une séance par semaine** au maximum.",
    "recherche": "- **12 coureurs de demi-fond très entraînés** (étude *Frontiers*, 2024) : 24 × 30 s à vVO2max s'est montré **inférieur** à 4 × 3 min à 95 % de vVO2max pour le temps passé au-dessus de 90 % de VO2max, malgré une fréquence cardiaque plus élevée avec les courtes répétitions ; courir à 105 % de vVO2max avec 30 s/30 s double presque le temps passé près du maximum par rapport à 100 %.\n- **Méta-analyse récente** : temps ≥ 90 % de VO2max d'environ 555 ± 234 s en HIIT à longues répétitions contre 336 ± 273 s en HIIT à courtes répétitions. Pour les adaptations réelles, un essai à vélo montre pourtant un gain de VO2max plus grand avec les courtes répétitions (+6,3 % contre +3,3 %) : **le temps passé près du maximum n'est pas le seul critère**.\n- **Midgley et McNaughton (2006)** : pour maximiser le temps près de VO2max, répétitions de 15 à 30 s à 90–105 % de vVO2max avec récupération de 15–30 s. Les travaux de Billat (30-30 à 100 % de vVO2max, récupération à 50 %) vont dans le même sens, mais ils n'ont pas été retrouvés dans cette recherche.\n- **Revue de l'élite** : les séances de VO2max sont **plus spécifiques aux coureurs de piste** ; les marathoniens en font moins ; les séances de « lactate tolérance » à 150–600 m (par exemple 10 × 200 m, récupération 1 min) concernent surtout les 5000 m.",
    "regles": "- Choisir la durée des répétitions selon l'objectif : **3 à 5 min** pour un 10 km ou un semi ; **400 à 800 m** pour un 5 km ; des 30-30 comme variante amusante pour un débutant (pas plus efficaces que les répétitions de 3 min d'après l'étude de 2024).\n- Une seule séance de VO2max par semaine, jamais en semaine d'affûtage final (remplacée par un rappel court), jamais la veille d'une course.\n- Allure : celle de la VMA donnée par l'application (≈ 0,935 × l'allure de course dans le moteur de Rush). Si la personne ne finit pas les répétitions, **raccourcir ou ralentir** plutôt que d'abandonner la séance.\n- Voir [[intervalles-haute-intensite]] pour les principes généraux.",
    "pieges": "- Courir les premières répétitions trop vite : l'allure doit rester la même de la première à la dernière.\n- Récupération trop courte : la qualité des dernières répétitions s'effondre.\n- Utiliser la fréquence cardiaque pour juger l'intensité sur de courtes répétitions : elle monte trop lentement.",
    "sources": [
      {
        "titre": "Faster intervals, faster recoveries : intensified short VO2max running intervals are inferior to traditional long intervals (Frontiers, 2024)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11743937/"
      },
      {
        "titre": "Time spent at or near VO2max during high-intensity interval training : systematic review and meta-analysis",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC13480085/"
      },
      {
        "titre": "The Training Characteristics of World-Class Distance Runners (Haugen et al., 2022)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/"
      },
      {
        "titre": "vVO2max (BrianMac, source secondaire)",
        "url": "https://brianmac.co.uk/vvo2max.htm"
      }
    ],
    "voirAussi": [
      "intervalles-haute-intensite"
    ]
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
