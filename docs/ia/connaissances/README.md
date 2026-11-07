# Base de connaissances du coach

Fiches courtes, sourcées, que le coach IA pourra aller chercher (outil `chercher_connaissance`, étape 3 du plan `docs/ia/PLAN_COACH_COMPLET.md`). Rien n'est collé en entier dans le contexte du modèle : on cherche, on lui donne les deux ou trois fiches les plus proches.

**Recherche faite le 7 nov. 2026** par recherche web. Honnêteté sur la qualité : je n'ai lu, pour la plupart des études, que des **résumés et des extraits**, pas les textes complets. Chaque fiche signale ce qui est **non vérifié à la source**. Les chiffres tirés de blogs ne sont repris que s'ils sont marqués comme tels.

## Niveaux de preuve (champ `preuve`)

| Valeur | Sens |
|---|---|
| `etabli` | Consensus officiel ou méta-analyses qui concordent |
| `probable` | Indices cohérents mais limités (petites études, peu de recul) |
| `debattu` | Les sources se contredisent ou la preuve directe manque |
| `pratique` | Usage de terrain, pas d'essai contrôlé trouvé |

## Format d'une fiche

Un fichier `.md` avec un en-tête : `id`, `titre`, `sports`, `mots_cles` (pour la recherche), `preuve`, `maj`. Puis cinq parties : **L'essentiel**, **Ce que dit la recherche**, **Règles pour le coach**, **Pièges**, **Sources**. Les liens entre fiches s'écrivent `[[id]]`.

## Règles d'écriture

- Le coach **n'invente aucun chiffre** : les fiches donnent des repères de méthode, pas des calculs. Les chiffres de l'utilisateur viennent toujours de l'application.
- Les « Règles pour le coach » ne doivent jamais contredire le **garde-fou santé** et le **validateur** : ceux-ci ont toujours le dernier mot.
- Pas de diagnostic, pas de traitement, pas de régime. Santé, blessure, alimentation à risque : orienter vers un professionnel.
- Une affirmation sans source solide est marquée comme **pratique** ou **non vérifiée**, jamais présentée comme un fait.

## Fiches (46)

**Intensité et méthodes** : [intensite-distribution](intensite-distribution.md) · [zone-2](zone-2.md) · [intervalles-haute-intensite](intervalles-haute-intensite.md) · [methode-norvegienne](methode-norvegienne.md)
**Organisation** : [periodisation](periodisation.md) · [affutage](affutage.md) · [allure-course-marathon](allure-course-marathon.md) · [progression-charge-blessures](progression-charge-blessures.md) · [reprise-apres-arret](reprise-apres-arret.md)
**Charge et suivi** : [charge-forme-fraicheur](charge-forme-fraicheur.md) · [hrv-suivi-recuperation](hrv-suivi-recuperation.md) · [sommeil](sommeil.md) · [surentrainement-fatigue](surentrainement-fatigue.md)
**Nutrition et santé** : [energie-reds](energie-reds.md) · [nutrition-glucides](nutrition-glucides.md) · [proteines-cafeine](proteines-cafeine.md) · [chaleur-altitude](chaleur-altitude.md)
**Force** : [force-pour-endurants](force-pour-endurants.md) · [entrainement-concurrent](entrainement-concurrent.md) · [musculation-bases](musculation-bases.md)
**Course à pied (21 fiches, recherche du 9 nov. 2026)** : [course-principes-generaux](course-principes-generaux.md) · [course-vdot-allures](course-vdot-allures.md) · [course-tests-terrain](course-tests-terrain.md) · [course-5k-10k-plans](course-5k-10k-plans.md) · [course-semi-marathon](course-semi-marathon.md) · [course-marathon-methodes](course-marathon-methodes.md) · [course-ecoles-coaching](course-ecoles-coaching.md) · [course-distribution-intensite](course-distribution-intensite.md) · [course-vo2max-intervalles](course-vo2max-intervalles.md) · [course-seuil-tempo](course-seuil-tempo.md) · [course-seuil-norvegien](course-seuil-norvegien.md) · [course-vitesse-courte-distance](course-vitesse-courte-distance.md) · [course-trail-ultra](course-trail-ultra.md) · [course-force-economie](course-force-economie.md) · [course-chaussures-cadence](course-chaussures-cadence.md) · [course-blessures-progression](course-blessures-progression.md) · [course-reprise-debutants](course-reprise-debutants.md) · [course-pacing-course](course-pacing-course.md) · [course-nutrition-hydratation](course-nutrition-hydratation.md) · [course-periodisation-recuperation](course-periodisation-recuperation.md) · [course-monotonie-variation](course-monotonie-variation.md)
**Sports et profils** : [velo-zones-ftp](velo-zones-ftp.md) · [natation-css](natation-css.md) · [hyrox](hyrox.md) · [cycle-menstruel](cycle-menstruel.md) · [veterans](veterans.md)

## Lacunes à combler (non couvert par cette recherche)

- **Triathlon** : enchaînements vélo-course, transitions, répartition des trois disciplines.
- **Course à pied** (recherche du 9 nov. 2026, voir les 20 fiches `course-*`) : encore manquants : **échauffement**, **entraînement des femmes et grossesse**, **enfants et adolescents**, **cross-country**, **course sur tapis**, **course en groupe**, **sodium ajouté pendant l'effort**, **chaussures : choix selon le pied**, les **livres d'origine** (Daniels, Pfitzinger, Lydiard, Canova, Magness, Hansons) lus de première main, la **vitesse critique** appliquée à l'entraînement (peu d'essais en course).
- **Hydratation et sodium** (recommandation ACSM sur les liquides), pertes de sueur.
- **Rythme « 3 semaines de charge, 1 allégée »** : toujours aucune étude directe ; **monotonie/tension de Foster** : couverte par la fiche `course-monotonie-variation` (preuve faible et contradictoire).
- **Récupération** : bains froids, massage, étirements, compression.
- **Blessures fréquentes** : tendinopathies, périostite, syndrome de l'essuie-glace, fractures de fatigue (côté prévention et orientation, pas soin).
- **Débutants** (du canapé au premier 5 km), enfants et adolescents, grossesse.
- **Échauffement**, **chaussures et matériel**, **entraînement en salle (home trainer)**.
- **Musculation** : sujets au-delà du volume (choix d'exercices, périodisation de la force, sécurité des mouvements).

## À relire

Yanis relit en priorité les fiches `debattu` (zone-2, methode-norvegienne, progression-charge-blessures, hrv-suivi-recuperation, cycle-menstruel) : elles sont celles où le coach doit le plus nuancer.

## Honnêteté sur la recherche course à pied (9 nov. 2026)

- **Environ 40 requêtes web** et **7 articles lus en texte intégral** via Europe PMC (Haugen et al. 2022 sur l'élite, la revue 800/1500 m, 92 plans de marathon, Festa et al. sur les coureurs récréatifs, l'étude néerlandaise semi/marathon, la revue sur le désentraînement, la revue montée/descente). Le reste vient de résumés, d'extraits et de **sites de coachs** : chaque fiche le signale. Les sources `pratique` sont des usages de terrain, pas des essais.
- Les **livres d'origine** (Daniels, Pfitzinger, Hansons, Lydiard, Canova) n'ont pas été lus : les méthodes sont décrites par des blogs de coachs et des sites secondaires. Les **coefficients exacts du VDOT** sont à vérifier dans le livre.
- Plusieurs articles de PubMed Central n'étaient pas lisibles automatiquement (contrôle anti-robot) ; ils ont été lus par Europe PMC ou résumés à partir des pages de recherche.
- Les valeurs du **moteur de plan de course** de l'application (allures en multiples de l'allure de course, +10 % par semaine, semaine allégée toutes les 4 semaines, affûtage à 75 % puis 55 %, sortie test de 3 km) sont des **choix de conception** inspirés de ces fiches, pas des résultats d'études.
- Fiches à relire en priorité par Yanis : `course-blessures-progression` (débattue), `course-seuil-norvegien` (débattue), `course-vdot-allures`, `course-tests-terrain`, `course-reprise-debutants`.
