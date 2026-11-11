# IA Coach : ce qui reste à faire (10 nov. 2026)

Principe posé par Yanis : **chaque règle du plan vient d'études ou de la personne, pas de chiffres fixes inventés**, et **plus le coach a de données (historique, temps disponible, blessures…), plus le plan est juste**. Voir `FONDEMENTS_PLAN_COURSE.md` (chaque paramètre face à la recherche) et `PLAN_COACH_COMPLET.md`.

## Fait le 10 nov. (mergé en local, pas poussé)
- Footings variés dans une même semaine, plus longs ; fréquence gardée si l'historique est déjà à 4 séances ; bilan écrit en « tu ».
- Gain d'objectif réaliste : 0,4 %/semaine, 6 % au plus (études : 3 à 6 % sur 10-15 semaines).
- Affûtage de 2 semaines dès 6 semaines de plan (Bosquet 2007).
- Durées à l'échelle de la personne avec historique (`reperesPersonnels`) : footing mini, longue mini, footing maxi, volume max tirés de ses sorties.
- Table `coach_profil` (disponibilités, ancienneté, pic hebdo, blessures, préférences ; listes fermées, RLS) + module serveur `profil-coureur.ts`. Appliquée en vraie base.

## 1. Profil du coureur : le brancher (prochaine étape)
- [x] **Décision (12 nov., Yanis)** : le profil s'écrit **automatiquement, sans carte** : le coach retient ce qu'on lui dit (`retenir_profil`, niveau `ecriture`, seule exception à « toujours une carte ») et dit en une phrase ce qu'il a noté pour qu'on le corrige.
- [x] Outils `lire_profil` (connu + ce qui manque) et `retenir_profil` (écrit tout de suite) ; consigne dans le prompt : 1 ou 2 questions à la fois, dans l'ordre. Déployé (coach-chat), tests serveur.
- [x] Mémorisation : au tap, `ecrireProfil` fusionne (jour par jour, préférence par préférence) et écrit dans `coach_profil` avec les droits de l'utilisateur.
- [x] Branché dans `plan-course.ts` (`reglesDuProfil`) : jours pas disponibles, durée max par jour, plafond de volume (plus grosse semaine), prudence selon blessures / débutant / « évite le fractionné ». Le bilan dit ce que le profil a changé. Déployé. Détail et sources : `FONDEMENTS_PLAN_COURSE.md`.
- [x] Profil aussi dans `planifier_semaine` et `planifier_periode` (12 nov.), pour vélo, course et natation : jours pas disponibles, durée max par jour, blessure encore là = que du facile, blessure des 12 derniers mois = pas de qualité en plus de la sortie longue, évite le fractionné = pas de séance au seuil en natation, plus grosse semaine de COURSE plafonne le volume de course (jamais sous ses habitudes). Le retour du code dit « Ton profil a changé… ». Non branchés ici : ancienneté (propre à la course à pied), moment de la journée.
- [x] Blessures = données de santé : lues et retenues seulement avec l'accord de la catégorie « evenement » (testé côté base et côté serveur).
- [x] `rpc_coach_resume` : bloc `profil` ajouté (migration `2026-11-12_rpc_coach_resume_profil.sql`, testée en local, appliquée en base).
- [ ] Écran de profil dans l'app (voir plus bas, 8 maquettes d'abord).

## 2. Niveau de confiance affiché dans la carte
- Abandonné (décision de Yanis, 12 nov.) : pas de niveau de confiance dans la carte.

## 3. Cas sans historique (vrai débutant, nouveau compte) : fait le 12 nov.
- [x] Fiches `course-reprise-debutants`, `reprise-apres-arret` et `course-tests-terrain` lues. `estDebutant` : aucune donnée de course ET 0 an d'ancienneté (ou inconnue). **Sans rien (ni sortie, ni temps visé) : plan ENTIER sur des allures provisoires (5 km en 40 min converti), test en toute première séance, tout recalibré dès le résultat** (décision de Yanis, 12 nov. : on ne demande jamais un temps « au pif »). **Test selon l'objectif** : 3 km chrono jusqu'à 6 km, 30 minutes à fond régulier au-delà (seuil de 6 km = notre convention). Débutant : puis 3 séances de 20-30 min en course/marche (1/2, 2/1, 3/1) pendant 6 semaines, un jour de repos entre deux séances, aucune autre intensité, montée de 5 %, but = finir. Déployé.
- [x] Reprise après un long arrêt (ancienneté, plus grosse semaine connue, aucune sortie depuis 90 jours) : départ à 35 % de la plus grosse semaine (fiche : 30 à 40 % pour un arrêt de 2 à 3 mois).
- [x] Les valeurs 30 / 45 / 38 / 360 ne servent plus qu'au cas « ancienneté inconnue mais données partielles » (jamais un vrai débutant ni une reprise avec pic connu).
- [ ] Conventions à nous, à valider : étapes toutes les 2 semaines, retour au footing continu après 6 semaines, marche affichée à 1,7 × l'allure facile.
- [x] Plus de temps demandé à un débutant : le test sert à régler les allures.

## 4. Règles du moteur encore sans source ou débattues (traitées le 12 nov.)
- [x] **Montée de 10 % par semaine** : remplacée par **7 %** (milieu de la fourchette 5-9 % des 92 plans de marathon analysés ; fiche : « environ 5 à 10 % »), **5 %** si prudent (blessure récente, débutant). Le bilan dit que la règle des 10 % n'est pas prouvée et qu'il n'y a pas de consensus. Ce sont des choix dans une fourchette, pas des résultats d'études.
- [x] **Sortie longue** : plafond de 42 % du volume supprimé. Remplacé par deux limites sourcées : jamais plus de **+10 %** d'une semaine à l'autre, en partant de la **plus longue des 30 derniers jours** (fiche course-blessures-progression ; champ `plus_longue_30j_minutes` ajouté au résumé, appliqué en base) ; et au plus 1,6 × la durée de la course (fiche course-5k-10k-plans, structure de plans de coachs). Un footing n'est jamais plus long que la sortie longue (structure, plus de 65 %).
- [x] **Semaine de récupération toutes les 4 semaines, ×0,8** : gardée, présentée dans le bilan comme « habitude de coach, pas d'étude » (fiche periodisation).
- [x] **Séances dures** : jamais deux collées (≥ 48 h) et une seule qualité à 3 séances, jusqu'à deux à 4-5 séances : c'est la règle de la fiche course-distribution-intensite. Le bilan dit qu'aucune répartition (80/20, pyramidale, seuil) n'est prouvée meilleure. Le seuil « CTL ≥ 30 » de `semaine.ts` (sans source) est remplacé par « la personne a un historique dans ce sport ».
- [x] **Vieux record** : le « 1,5 %/mois, 30 % max » (sans source) est remplacé par **× 1,25** (VO2max −20 % après 2 mois d'arrêt, revue sur le désentraînement ; hypothèse à nous : la vitesse suit la VO2max, plutôt pessimiste), pour tout record de plus de 90 jours. Estimation « ancienne », toujours suivie d'une sortie test.
- [ ] **Coefficients d'échelle des repères personnels (75, 85, 90, 130 %)** : restent des conventions (durées qui suivent la personne), non sourcées. À valider ou remplacer.
- [ ] **Longueur maxi de la sortie longue** (`min(110, max(60, 1,6 × durée de la course))`) : le 1,6 vient de la fiche, mais les bornes 60 et 110 min n'ont pas de source.
- [ ] **Exposant de conversion entre distances** : reste 1,06. Piste : exposant personnel quand il a deux efforts de distances différentes (touche `rpc_coach_resume`).

- [ ] Le moteur ne détecte pas les **reprises répétées** (plusieurs « reprise » espacées dans l'historique) pour être plus prudent sur la montée de charge.

## 5. Vérifier les sources
- [ ] Lire les textes complets (je n'ai lu que des résumés) : Bosquet 2007, Nuuttila 2022, Buist 2008, Nielsen 2013, Rosenblat 2019 (lien exact à retrouver).
- [ ] *Daniels' Running Formula* (tables d'allures, exposant 5-10 km, plafond de sortie longue) : nécessite le livre ou un extrait fiable.

## 6. Essais
- [ ] Essai réel complet de `preparer_course` : lire un plan entier (phases, affûtage). Script prêt dans le scratchpad (compte jetable en SQL, supprimé à la fin).
- [ ] Essai sur le vrai compte de Yanis (Ronde de Ramonville 13 déc.), avec son accord ; effacer la conversation de test ensuite.
- [ ] Supprimer les anciennes séances de test du calendrier de Yanis (avec son OK).
- [ ] Revérifier l'écran « Séance prévue » dans le simulateur (le bug `target` est corrigé depuis le 7 nov., jamais revu à l'écran).

## 7. Autres sports
- [ ] Même travail (inventaire des paramètres + recherche) pour **vélo** et **natation**, puis muscu et Hyrox. Gros chantier.

## 8. Reste de l'ancien plan
- [ ] Message proactif à l'ouverture de l'onglet Coach (changement d'app, à discuter) ; détection des écarts d'allure (trop facile ou trop dur).
- [ ] Imprévus (moins de temps, fatigue, compétition qui bouge).
- [ ] Écran d'accord de partage + réglages : **8 maquettes d'abord**.
- [ ] 8 maquettes de la carte d'un plan long et de l'édition à la main de la structure.
- [ ] Modifier la durée d'une séance existante (aujourd'hui : supprimer + ajouter) ; créer une compétition ou un objectif.
- [ ] Comparaison Haiku / Sonnet sur 1 000-2 000 cas générés ; Sonnet pour le chat si Haiku se montre limité.
- [ ] Limite de dépense côté Anthropic ; **révoquer la clé collée dans le chat** et en recréer une.
- [ ] Suppression de `coach-ai` (ancien système, encore déployé) et de `garde-fou.ts` (non appelé) : à valider par Yanis.
