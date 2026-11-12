# IA Coach : ce qui reste à faire (10 nov. 2026)

Principe posé par Yanis : **chaque règle du plan vient d'études ou de la personne, pas de chiffres fixes inventés**, et **plus le coach a de données (historique, temps disponible, blessures…), plus le plan est juste**. Voir `FONDEMENTS_PLAN_COURSE.md` (chaque paramètre face à la recherche) et `PLAN_COACH_COMPLET.md`.

## Fait le 10 nov. (mergé en local, pas poussé)
- Footings variés dans une même semaine, plus longs ; fréquence gardée si l'historique est déjà à 4 séances ; bilan écrit en « tu ».
- Gain d'objectif réaliste : 0,4 %/semaine, 6 % au plus (études : 3 à 6 % sur 10-15 semaines).
- Affûtage de 2 semaines dès 6 semaines de plan (Bosquet 2007).
- Durées à l'échelle de la personne avec historique (`reperesPersonnels`) : footing mini, longue mini, footing maxi, volume max tirés de ses sorties.
- Table `coach_profil` (disponibilités, ancienneté, pic hebdo, blessures, préférences ; listes fermées, RLS) + module serveur `profil-coureur.ts`. Appliquée en vraie base.

## CHANTIER EN COURS : le coach lit lui-même les données et ses plans gagnent en qualité (13 nov. 2026)

**L'idée (Yanis, 13 nov.)** : le coach a accès à TOUTE la base de son athlète, en lecture, et répond tout seul à ses propres questions au lieu de les renvoyer à l'utilisateur ; plus il connaît la personne, plus le plan est juste. Règle de fond : chaque règle d'un plan vient d'une étude ou de la personne, jamais d'un chiffre inventé (quand c'est une hypothèse à nous, on le dit dans le bilan).

**Déjà fait**
- [x] Liste blanche de 10 outils de lecture (séances prévues, musculation, Hyrox, objectifs et phases, fiche athlète, santé sur une période, records de course et de vélo, en plus de ceux d'avant). Fonctions SQL en lecture seule avec le jeton de l'utilisateur (RLS), aucun identifiant en paramètre, aucun texte libre en sortie, santé et poids seulement avec les accords de partage. Migration `2026-11-12_rpc_coach_lecture_athlete.sql`, tests `supabase/tests/sql/coach_lecture_athlete.sh` et `coach-actions.test.mts`. Le prompt dit d'aller chercher la réponse avec un outil.
- [x] Niveau de course : un record de **moins de 12 mois** reste un repère (+5 %, hypothèse à nous) pour un coureur qui a continué à courir ; avant, seules les sorties récentes (surtout des footings) fixaient le niveau et le plan visait trop bas (cas de Yanis : 47:32 au 10 km, plan calé sur 53:40, maintenant 49:54). Au-delà de 12 mois : retour aux sorties récentes. Migration `2026-11-12_rpc_coach_resume_meilleur_12_mois.sql`. La première séance reste un test qui vérifie le niveau.
- [x] Simulateur dédié « Coach test » (`418F9E68-E129-413B-BD79-F2F1DE731EC1`, connecté au compte de Yanis) pour les essais avec Maestro.

**À continuer (dans cet ordre)**
- [ ] **Qualité des séances** : en semaine 2 d'un plan 10 km à 50 min, la séance de qualité est un « Fartlek 6 × 1 min », trop léger pour être spécifique ; il manque du seuil et de l'allure 10 km (par exemple 4 × 1 km, 3 × 8 min), choisis dans les fiches, sans chiffre inventé. À revoir aussi : le contenu détaillé de chaque séance (allure, échauffement, retour au calme).
- [ ] **Volume et nombre de séances** : 3 séances et environ 2 h par semaine même avec tous les jours libres, c'est léger pour viser 50 min au 10 km. Le volume part des 30 derniers jours (+7 % par semaine) : voir si un coureur régulier (1 374 séances) peut avoir plus.
- [ ] **Un 2e plan « divisé par 2 »** : Yanis a vu la charge chuter après avoir retiré ses limites de jours et de durée ; impossible à reproduire (le profil en base est bon, les volumes ne dépendent pas de ces limites). Retrouver la cause avec une capture de ses deux plans.
- [ ] **Deux courses le même jour** (5 km à 9h10 et 10 km à 10h le 13 déc.) : le coach demande « à fond ou en préparation ? » pour le 5 km ; finir cet enchaînement et regarder la semaine de la course (veille facile, jours de course bloqués).
- [ ] Les 18 (puis 13) « séances retirées » du plan de test : vérifier lesquelles avec Yanis avant qu'il valide quoi que ce soit.
- [ ] Autres outils de lecture si besoin : sommeil, détail d'une séance (tours, flux), notes de jour (texte libre : à filtrer).
- [ ] Les tests réels restants de la section 6 (cas débutant, vélo, natation) sur le simulateur « Coach test ».

## Banc d'essai et analyse du coureur (11 nov. 2026, mergé en local, pas poussé)
**Principe (Yanis)** : le plan découle de la personne, jamais d'un calendrier type ; l'IA lit TOUTE la vie du compte (pas 8 semaines), même après un an sans courir.
- [x] `rpc_coach_vie_course` (appliquée en base) + outil `lire_vie_course` : années, plus grosse semaine/longue, arrêts, meilleur effort de vie et par année, meilleurs temps réels sur 5/10/21 km (24 mois), charge max, VO2max du profil (valeur actuelle seulement : aucun historique en base), poids (accord « corps »), sommeil (accord « appareil »). Test : `bash supabase/tests/sql/coach_vie_course.sh`.
- [x] `_shared/analyse-coureur.ts` : portrait (état, régularité, tendance, passé, ce qu'on ne sait pas + la question à poser). **Vitesse ou endurance** lu sur deux records de distances différentes (exposant personnel ; ±0,03 autour de 1,06, 120 jours d'écart max : conventions à nous). Il décide du contenu de la séance de qualité (base et développement).
- [x] Un coureur avec un passé en base n'est jamais un débutant (reprise) ; la reprise part de 35 % de sa plus grosse semaine de VIE ; **pas de test à fond ni de séance dure tant que le volume est sous 75 % de ce pic** (fiche reprise-apres-arret).
- [x] **Banc d'essai** : `node --experimental-strip-types supabase/tests/edge/simulation-coureurs.mts 1000` (variable `MOTIF="regex"` pour afficher un plan fautif). 1 000 coureurs fictifs (débutant, loisir, régulier, gros volume, reprise, irrégulier, en baisse), contrôles : séances dures collées, veille de course, sauts de volume, sortie longue, départ vs habitudes, reprise. A trouvé et fait corriger : sortie longue de récupération qui sautait (57 → 100 min), plafond de longue sous le niveau réel de la personne (98 min → 60), deux séances dures collées juste avant la course, test à fond pour une reprise.
- [ ] **Restent (simulation)** : taper d'un débutant qui a demandé 5 séances plus lourd que le plan avant ; départ trop haut quand le nombre de séances demandé est élevé pour une charge faible (le bilan le dit, le plan ne se limite pas) ; reprise qui atteint 75 % du pic seulement via le volume visé (pas l'effectué).
- [ ] La séance de qualité d'après l'analyse n'agit que sur base et développement ; spécifique et affûtage suivent encore la distance visée (voulu).
- [x] **Vélo et natation (11 nov. 2026)** : `rpc_coach_vie_sport` (appliquée en base, test `bash supabase/tests/sql/coach_vie_sport.sh`) + outil `lire_vie_sport` + `_shared/analyse-sport.ts`. Années, plus grosse semaine, plus longue séance, arrêts, séances des 90 derniers jours ; records vélo (puissances 5 s / 5 min / 20 min / 1 h par année et sur 24 mois) et natation (allure de séance au 100 m, séances courtes et longues). Le planificateur de semaine et de période s'en sert : sans séance sur 28 jours mais avec des séances sur 90 jours, ce sont elles qui font référence ; **reprise après arrêt** = 35 % de la plus grosse semaine passée, +7 % par semaine, que du facile et jamais de sortie longue tant que le volume est sous 75 % (fiche reprise-apres-arret), jamais de séance de moins de 20 min (on réduit le nombre de séances). **Vélo** : le type de qualité suit le rapport puissance 5 min / 20 min sur 24 mois (≥ 1,22 : du seuil ; ≤ 1,08 : VO2max deux semaines sur trois ; entre les deux ou inconnu : tempo et seuil en alternance, jamais de VO2max sans savoir ; 5 courbes de puissance au moins) : seuils = conventions à nous. **Natation** : aucune conclusion sur ce qui limite (l'allure d'une séance contient les repos et les exercices) : le coach demande un test 400 m / 200 m. Banc d'essai : `node --experimental-strip-types supabase/tests/edge/simulation-velo-natation.mts 1000` (1 000 sportifs : débutant, actif, gros volume, reprise, reprise longue ; 0 faute).
- [x] **Préparation d'une course de vélo ou de natation (12 nov. 2026)** : outil `preparer_course_endurance` + `_shared/plan-endurance.ts`. S'appuie sur `planifierPeriode` (jours, reprise, montée de charge, affûtage) et ajoute les phases (base, développement, spécifique, affûtage ; 2 dernières semaines = affûtage) et des séances à blocs chiffrés : vélo en watts (« 3 × 10 min à 262–285 W, récup 4 min », sortie longue avec blocs à allure d'épreuve en spécifique), natation en distances (« 8 × 100 m, repos 15 s »). Calibrage : FTP = 95 % de la meilleure puissance sur 20 min (24 mois, 5 courbes au moins) ou donnée ; allure critique de nage = (t400 − t200)/2 par 100 m. Rien de mesuré : la 1re séance est un TEST (20 min vélo, 400/200 m natation, jamais en reprise), puis le coach rappelle l'outil avec `ftp_watts` / `test_natation` et le plan remplace l'ancien. **Toutes les durées de blocs, % de FTP/CSS et le seuil « épreuve courte » (75 min vélo, 1,5 km natation) sont des conventions à nous**, regroupées en haut du fichier. Banc : `node --experimental-strip-types supabase/tests/edge/simulation-course-endurance.mts 1000` (0 faute). Reste : le test n'a pas été essayé sur le vrai compte ; pas de plan de préparation pour le triathlon (enchaînement des 3 sports) ; allure de nage sans test = estimation depuis les séances courtes.
- [ ] Natation : un test 400 m / 200 m (vitesse critique) donnerait enfin une limite lisible ; le vélo n'a aucun repère si le cycliste n'a pas de capteur de puissance.
- [ ] Suivi du VO2max dans le temps : il n'existe pas en base, il faudrait commencer à le stocker.

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
- [x] `coach-ai` (ancien système) supprimé de Supabase le 13 nov. (OK de Yanis). `garde-fou.ts` **reste** : le coach actuel l'utilise (`coach-chat.ts`, `coach-contexte.ts`, 7 fichiers de tests).

## Analyse de la sortie (page 4) : la développer à la perfection (décision de Yanis, 12 nov.)
Objectif : un compte rendu qui ressemble vraiment à celui d'un coach. Premier jet fait (titre + 3-4 phrases, réactions du cœur, progression : voir `ANALYSE_SORTIE.md`), à pousser beaucoup plus loin.
- [ ] Voir le rendu à l'écran sur plusieurs vraies sorties (footing, sortie longue, fractionné, vélo) et corriger les phrases qui sonnent faux ; chaque cas a son message principal.
- [ ] Réactions du corps plus riches : montée du cœur au départ, récupération après la sortie, lien avec le sommeil et la charge des jours d'avant (fatigue).
- [ ] Progression plus fine : vélo (puissance par battement), fractionnés (même séance refaite), tendance sur plusieurs semaines, pas seulement les 5 dernières sorties.
- [ ] Sourcer les seuils (2,5 % de progrès, 30 % de récupération dégradée, 10 bpm d'écart, 70 % / 25 % de zones…) : aujourd'hui ce sont des conventions de lecture.
- [ ] Phrases plus « coach » (ton, enchaînement) ; l'écart au prévu est encore sec.
- [ ] Autres sports : muscu, natation, Hyrox ; cadence et relief en course.
- [ ] Vérifier la détection des efforts d'un fractionné sur de vraies sorties.

