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

## Fiches (25)

**Intensité et méthodes** : [intensite-distribution](intensite-distribution.md) · [zone-2](zone-2.md) · [intervalles-haute-intensite](intervalles-haute-intensite.md) · [methode-norvegienne](methode-norvegienne.md)
**Organisation** : [periodisation](periodisation.md) · [affutage](affutage.md) · [allure-course-marathon](allure-course-marathon.md) · [progression-charge-blessures](progression-charge-blessures.md) · [reprise-apres-arret](reprise-apres-arret.md)
**Charge et suivi** : [charge-forme-fraicheur](charge-forme-fraicheur.md) · [hrv-suivi-recuperation](hrv-suivi-recuperation.md) · [sommeil](sommeil.md) · [surentrainement-fatigue](surentrainement-fatigue.md)
**Nutrition et santé** : [energie-reds](energie-reds.md) · [nutrition-glucides](nutrition-glucides.md) · [proteines-cafeine](proteines-cafeine.md) · [chaleur-altitude](chaleur-altitude.md)
**Force** : [force-pour-endurants](force-pour-endurants.md) · [entrainement-concurrent](entrainement-concurrent.md) · [musculation-bases](musculation-bases.md)
**Sports et profils** : [velo-zones-ftp](velo-zones-ftp.md) · [natation-css](natation-css.md) · [hyrox](hyrox.md) · [cycle-menstruel](cycle-menstruel.md) · [veterans](veterans.md)

## Lacunes à combler (non couvert par cette recherche)

- **Triathlon** : enchaînements vélo-course, transitions, répartition des trois disciplines.
- **Course à pied** : allures de Daniels (VDOT), kilométrages hebdomadaires et sortie longue de Pfitzinger, plans 5 km / 10 km / semi / marathon, cadence, chaussures.
- **Hydratation et sodium** (recommandation ACSM sur les liquides), pertes de sueur.
- **Rythme « 3 semaines de charge, 1 allégée »** et **monotonie/tension de Foster** : cherchés sans résultat probant.
- **Récupération** : bains froids, massage, étirements, compression.
- **Blessures fréquentes** : tendinopathies, périostite, syndrome de l'essuie-glace, fractures de fatigue (côté prévention et orientation, pas soin).
- **Débutants** (du canapé au premier 5 km), enfants et adolescents, grossesse.
- **Échauffement**, **chaussures et matériel**, **entraînement en salle (home trainer)**.
- **Musculation** : sujets au-delà du volume (choix d'exercices, périodisation de la force, sécurité des mouvements).

## À relire

Yanis relit en priorité les fiches `debattu` (zone-2, methode-norvegienne, progression-charge-blessures, hrv-suivi-recuperation, cycle-menstruel) : elles sont celles où le coach doit le plus nuancer.
