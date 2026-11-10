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
- [ ] Brancher aussi le profil dans `planifier_semaine` et `planifier_periode` (autres moteurs : `semaine.ts`, `periode.ts`).
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

## 4. Règles du moteur encore sans source ou débattues
- [ ] Montée de volume de 10 % par semaine : contestée (Buist 2008, Nielsen 2013). Remplacer par un plafond expliqué partant du volume réel, et dire dans la carte qu'il n'y a pas de consensus.
- [ ] Sortie longue : plafond à 42 % du volume (Daniels cité à 25-30 %, de seconde main).
- [ ] Semaine de récupération toutes les 4 semaines, ×0,8 : pratique d'entraîneurs, pas d'essai trouvé.
- [ ] Séances dures espacées, répartition d'intensité (80/20) : débattu, ne pas l'imposer comme un fait.
- [ ] Vieillissement d'un vieux record (1,5 %/mois, 30 % max) : coefficient sans source.
- [ ] Coefficients d'échelle des repères personnels (75, 85, 90, 130 %) : conventions, à valider ou à remplacer.
- [ ] Exposant de conversion entre distances : reste 1,06. Piste : exposant personnel quand il a deux efforts de distances différentes (touche `rpc_coach_resume`).

- [x] **Sorties courtes ignorées (corrigé)** : `rpc_coach_resume` renvoie `meilleur_effort_recent` (sorties d'au moins 3 km sur 90 jours), utilisé par `plan-course.ts` pour le niveau. Le seuil de 4,8 km ne reste que pour `meilleur_effort` (ancien record, dernier recours). Appliqué en base.
- [x] **Deux courses le même jour (12 nov.)** : l'heure de départ des compétitions entre dans `rpc_coach_resume` (champ `heure`). `analyserDouble` : choix de la course prioritaire par la distance demandée, sinon par la priorité A/B/C, sinon le coach demande (aucune carte). Le plan est préparé pour la prioritaire ; le bilan donne au coach une note honnête. Recherche du 12 nov. : **aucune étude** sur un 5 km puis un 10 km le même jour ; travaux voisins en désaccord (un essai cycliste : 2e effort de 4 km plus lent à 40 min d'écart ; d'autres : pas de baisse nette entre 17 et 45 min). Donc **aucun chiffre de récupération** inventé.
- [ ] Double course, encore à faire : séance d'enchaînement dans le plan (rien de sourcé), stratégie de course chiffrée, prise en compte de l'autre course dans l'affûtage. À reprendre si une source apparaît.
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
