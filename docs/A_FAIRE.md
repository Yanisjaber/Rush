# Rush : ce qui reste à faire

Liste unique, tenue par Yanis et Claude. Créée le 13 nov. 2026 à partir des docs et des notes de Claude.

**Comment s'en servir**
- `- [ ]` = à faire, `- [x]` = fait. Coche, ajoute, supprime ou réordonne librement.
- Une ligne qui commence par **(toi)** demande une action ou une réponse de Yanis.
- Claude lit ce fichier au début de chaque session et le met à jour quand il finit ou découvre quelque chose.
- Le détail de certains chantiers reste dans leur doc (lien en tête de section).

---

## Profil (évaluation + avatar 3D)
Détail : `native/EVALUATION_PROFIL.md`, `native/AUDIT_PROFIL.md`

- [ ] **(toi)** Dire ce que tu veux encore changer sur l'écran
- [ ] Trouver des sources pour les références des notes /100 (2 seulement sont vérifiées)
- [ ] 8 maquettes pour un profil « beaucoup plus impressionnant »
- [ ] **(toi)** Tester la 3D sur l'iPhone (le simulateur ne dessine pas la 3D)
- [ ] Retirer les logos de sponsors de la texture de l'avatar avant de pousser (dépôt public)
- [ ] Remettre un moyen de modifier l'identité et la photo (prénom, poids…) : 8 maquettes
- [ ] Remettre les champs retirés (allures 5k/10k/semi/marathon, natation, test FTP, pmax…)
- [ ] **(toi)** OK pour supprimer : `FeuilleAthlete`, `PointsZones`, `zonesProfil`, `CarteBilanAthlete`, `RadarAthlete`, `ModeleAthlete3D`, `scripts/convert_athlete_to_glb.py`
- [ ] Plus tard : classement entre utilisateurs, durabilité, FC repos/HRV/VO2max par Apple Santé, chaussures de l'avatar

## Coach IA
Détail : `ia/IA_A_FAIRE.md`

- [ ] Qualité des séances : le fartlek 6 × 1 min est trop léger, il manque le seuil et l'allure 10 km
- [ ] Volume : 3 séances et ~2 h par semaine, c'est léger pour viser 50 min au 10 km
- [ ] **(toi)** Capture de tes deux plans pour le 2e plan « divisé par 2 »
- [ ] Deux courses le même jour (5 km + 10 km le 13 déc.) : finir ce cas
- [ ] **(toi)** Vérifier les 13-18 « séances retirées » du plan de test
- [ ] Tests réels : débutant, vélo, natation (simulateur « Coach test »)
- [ ] **(toi)** Essai complet sur ton compte (Ronde de Ramonville), puis effacer la conversation de test
- [ ] **(toi)** OK pour supprimer les anciennes séances de test de ton calendrier
- [ ] Plan de préparation triathlon (enchaînement des 3 sports)
- [ ] **(toi)** Valider les conventions de Claude (75/85/90/130 %, bornes 60-110 min, exposant 1,06, étapes du débutant)
- [ ] Lire les études en entier (Bosquet, Nuuttila, Buist, Nielsen, Rosenblat, Daniels)
- [ ] Même travail pour vélo, natation, puis muscu et Hyrox
- [ ] Imprévus (moins de temps, fatigue, compétition qui bouge)
- [ ] Message proactif à l'ouverture de l'onglet Coach ; détecter les allures trop faciles ou trop dures
- [ ] 8 maquettes : écran d'accord de partage + réglages
- [ ] 8 maquettes : carte d'un plan long, édition à la main de la structure
- [ ] Modifier la durée d'une séance ; créer une compétition ou un objectif depuis le coach
- [ ] Comparer Haiku et Sonnet sur 1 000-2 000 cas
- [ ] **(toi)** Révoquer la clé Anthropic collée dans le chat, en recréer une, mettre une limite de dépense
- [ ] Commencer à stocker le VO2max dans le temps
- [ ] Plus tard : « la vraie création d'un coach avec un vrai plan » (à cadrer ensemble)

## Analyse de sortie (page 4)
Détail : `ia/ANALYSE_SORTIE.md`

- [ ] La regarder sur plusieurs vraies sorties (footing, longue, fractionné, vélo) et corriger les phrases
- [ ] Réactions du corps plus riches (départ, récupération, sommeil, fatigue des jours d'avant)
- [ ] Progression plus fine (vélo, même fractionné refait, tendance sur plusieurs semaines)
- [ ] Sourcer les seuils (2,5 %, 30 %, 10 bpm, 70/25 % de zones…)
- [ ] Phrases plus « coach »
- [ ] Autres sports (muscu, natation, Hyrox), cadence et relief en course
- [ ] **(toi)** As-tu vraiment fait des lignes droites le 10 nov. ? (2 trouvées sur 6)

## Écran d'une sortie
- [ ] **(toi)** Choisir la maquette de la page 2 (courbes et zones)
- [ ] Page 3 : tous les chiffres + records de la sortie
- [ ] Voir la trace Strava (`strava-trace`) à l'écran
- [ ] Séance prévue : remettre le bouton Supprimer
- [ ] **(toi)** Distance saisie (5,0) ou longueur du GPX (5,2) dans la tuile DISTANCE ?

## Zones
Détail : `native/ZONES_PHYSIO_A_FAIRE.md`

- [ ] Voir et valider l'écran Paramètres › Zones dans le simulateur
- [ ] Essayer pour de vrai « Faire calculer mes zones par le coach »
- [ ] **(toi)** Valider le plafond de 10 points et l'écart minimal de 2 points
- [ ] Le Bilan doit lire les zones perso
- [ ] Vérifier les zones perso quand la FTP ou la LTHR change
- [ ] Brancher `estimerFtp` et `estimerFcMax` à un écran
- [ ] Plus tard : pente, ressenti Strava, courbe de température
- [ ] Plus tard : bouton « marquer comme compétition » (8 maquettes déjà faites)

## Calendrier
Détail : `native/CALENDRIER_A_FAIRE.md`

- [ ] Vérifier le thème clair (calendrier, pop-up d'import, compétition, dossard)
- [ ] Compétition : course par étapes et segments du triathlon
- [ ] Ouvrir une activité importée (flux, carte, tours) et calculer son vrai TSS
- [ ] **(toi)** Quelles sorties manquent à l'écran ?
- [ ] **(toi)** Étiquetage des tours Hyrox : quoi mettre ?
- [ ] Où mettre l'accès aux écrans de cycles
- [ ] Blessure « en cours » sans date de fin
- [ ] Petits points : durée plafonnée à 23 h 59, renommer `ajout-sortie` en « activité », sauter sur l'onglet de l'erreur
- [ ] **(toi)** Reconstruire l'app sur le téléphone (`npx expo run:ios --device`)
- [ ] Android : générer `android/`, clé Google Maps

## Bilan
- [ ] Natation et muscu : nouvelle méthode de progrès (comme vélo et course)
- [ ] Widget Progression de l'accueil : retirer son propre sélecteur de période
- [ ] **(toi)** Regarder muscu, triathlon, natation, Hyrox sur tes vraies données
- [ ] Records serveur : natation (100/400/1500 m), muscu (1RM), stations Hyrox
- [ ] Expliquer pourquoi une note est basse (8 maquettes)

## Démo
- [ ] **(toi)** Lancer ou autoriser le script de la démo en vraie base, puis migration, `demo-session`, `recalc_ftp_tss`
- [ ] Semer aussi : séances prévues, notes, cycles, santé, sommeil, tours
- [ ] **(toi)** OK pour retirer l'ancien mode démo en mémoire (`native/src/data/demo/*`)
- [ ] Rafraîchir régulièrement les données de démo
- [ ] Base presque pleine (404/500 Mo) : trouver de la place
- [ ] Streams de démo : piliers vélo inventés, allure de course qui ralentit d'année en année

## Base et sécurité
Détail : `db/AUDIT_2026-10-27_SUIVI.md`

- [ ] `npm audit` de `native/` : refaire le dry-run et décider
- [ ] Export de données et suppression de compte dans l'app mobile
- [ ] Vérifier que `disconnect-integration` est bien redéployée
- [ ] Synchro Strava : tâche serveur planifiée (pg_cron) pour ne plus garder l'écran ouvert

## Ménage
- [ ] **(toi)** OK pour supprimer les ~40 worktrees de `.claude/worktrees/` (presque tous mergés ; `worktree-fiche-athlete` ne l'est pas)
- [ ] **(toi)** OK pour supprimer `FeuilleAjout.tsx` et `useRecordsAnnuels.ts`

## Git
- [ ] **(toi)** Pousser les 4 commits du Profil (après avoir retiré les logos de sponsors)
