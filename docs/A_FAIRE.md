# Rush : ce qui reste à faire

Liste unique, tenue par Yanis et Claude. Créée le 13 nov. 2026 à partir des docs et des notes de Claude.
Cette liste évolue en fonction de l'avancement de l'app.

## Comment lire cette liste

Chaque tâche porte une étiquette : `**importance/10 · durée en jours**`.

- **Importance** : 10 = l'app ne peut pas sortir sans, 7-9 = nécessaire pour une bonne première version, 4-6 = utile, 1-3 = confort ou plus tard.
- **Durée** : en « jours de travail » (une journée où on avance sur Rush, le rythme réel depuis le 13 oct. est d'environ 5 jours par semaine). Ce sont des ordres de grandeur, je les affine en cours de route.
- **Version de sortie** = toutes les tâches notées **7/10 ou plus** (hors section « Après la sortie »).
- Quand je termine une tâche : je coche `[x]`, puis je lance `node docs/estimer-a-faire.mjs`, qui recalcule l'estimation ci-dessous. Quand on ajoute une tâche, on lui met son étiquette.

<!-- ESTIMATION:DEBUT -->
## Estimation de la sortie (calculée par `node docs/estimer-a-faire.mjs`)

Mise à jour : **13 novembre 2026**. Rythme supposé : 5 jours de travail par semaine.

- **Version de sortie** (tâches ≥ 7/10) : **60,2 jours** restants (8,1 j déjà faits).
- **Sortie estimée : 6 février 2027** si tout se passe bien.
- **Fourchette prudente : 3 avril 2027** (durées ×1.5 + 14 jours pour Apple, les accès API, le domaine…).
- Le reste (tâches < 7/10) : 56,4 jours, à faire après la sortie ou si on a de la marge. « Après la sortie » : 16 jours.
- Tâches : 65 restantes, 8 faites.

Où part le temps de la version de sortie :

| Thème | Jours restants (≥ 7/10) |
|---|---|
| 4. Accueil et widgets | 11 j |
| 8. Profil, Paramètres et Santé | 11 j |
| 6. Écran d'une sortie | 8,2 j |
| 9. Sources d'activités | 8 j |
| 3. Coach IA | 7,5 j |
| 2. Compte et sécurité | 6,5 j |
| 10. Qualité | 5 j |
| 5. Calendrier | 1,5 j |
| 1. Publication et légal | 1 j |
| 7. Bilan et zones | 0,5 j |

Historique (une ligne par recalcul) :

| Date | Sortie : jours restants | Tout : jours restants | Sortie estimée | Fourchette prudente |
|---|---|---|---|---|
| 2026-11-13 | 60,2 j | 116,6 j | 6 février 2027 | 3 avril 2027 |
<!-- ESTIMATION:FIN -->

## 1. Publication et légal

- [x] **10/10 · 0,5 j** Remplacer `bundleIdentifier` et `package` provisoires (`TODO.rush`) dans `native/app.json` par les vrais identifiants, avant toute publication
- [x] **9/10 · 1 j** Rédiger une vraie politique de confidentialité (le Coach IA lit les données de santé et d'entraînement) et y faire mener « Confidentialité ». Exigée par Apple et Google
- [x] **9/10 · 0,5 j** Faire un point avant de pousser : plusieurs chantiers sont mergés en local sans push (Bilan par sport, Hyrox, natation, coach, avatar…), à sauvegarder sur GitHub (mot `yallah` requis)
- [ ] **8/10 · 0,5 j** E-mails de confirmation : avec un expéditeur Gmail ils finissent souvent en spams. Prendre un domaine à toi pour l'expéditeur (SMTP Brevo, SPF/DKIM)
- [ ] **7/10 · 0,5 j** Suivi des plantages : savoir quand l'app plante chez un utilisateur

## 2. Compte et sécurité

- [x] **10/10 · 0,1 j** **(toi)** Révoquer la clé Anthropic collée dans le chat, en recréer une, mettre une limite de dépense
- [ ] **9/10 · 3 j** Passer toute l'app en ultra sécurisé : audit complet avant la sortie (RLS de chaque table, Edge Functions, stockage des jetons et de la session sur le téléphone, validation des entrées, dépendances, secrets, fuites dans les logs, accès du Coach IA aux données), puis corriger tout ce qu'on trouve. À cadrer : audit par moi seul ou aussi par un outil/une personne extérieure
- [x] **9/10 · 2 j** Créer son compte directement dans l'app : l'écran de connexion renvoie encore vers le site (« Pas encore de compte ? Crée-le sur le site… / Ouvrir le site »). Inscription, confirmation par e-mail et retour dans l'app, sans navigateur. Écran neuf : 8 maquettes
- [ ] **9/10 · 2,5 j** Section « Sécurité et données » des Paramètres : « Changer mon mot de passe », « Exporter mes données » renvoient vers le site (flèche ↗), « Confidentialité » est faite dans l'app (13 nov.). Faire le reste dans l'app, avec la suppression de compte (exigée par Apple) ; 8 maquettes pour les écrans neufs
- [ ] **7/10 · 1 j** Base presque pleine (404/500 Mo) : trouver de la place
- [ ] **6/10 · 0,5 j** `npm audit` de `native/` : refaire le dry-run et décider

## 3. Coach IA

- [x] **9/10 · 1 j** Même app pour tout le monde : selon les comptes, l'app s'affiche sans le Coach IA, ce qui donne l'impression de deux apps et c'est incompréhensible. Trouver pourquoi (accès, réglage ou drapeau par compte) et unifier
- [ ] **9/10 · 3 j** Finir le modèle de réflexion du Coach IA à la perfection (la façon dont il raisonne avant de répondre)
- [ ] **8/10 · 3 j** Faire toutes les fiches de connaissance du Coach IA (une fiche par sujet et par sport). Lister d'abord les fiches à écrire
- [ ] **7/10 · 1,5 j** Tests réels : débutant, vélo, natation (simulateur « Coach test »)
- [ ] **6/10 · 2 j** Onglet Coach : remplacer « Effacer » par un bouton « Préférences » qui permet à l'utilisateur de dicter un peu le comportement de l'IA (ton, niveau de détail…). Où on garde ces préférences et comment elles arrivent au coach, à cadrer ; 8 maquettes. Si « Effacer » reste utile, lui trouver une autre place
- [ ] **6/10 · 2 j** Historique de conversation avec le coach (garder, rouvrir, nouvelle conversation, supprimer). À cadrer ; lié à « Effacer » ; 8 maquettes
- [ ] **6/10 · 2 j** Imprévus (moins de temps, fatigue, compétition qui bouge)
- [ ] **6/10 · 1,5 j** Message proactif à l'ouverture de l'onglet Coach ; détecter les allures trop faciles ou trop dures
- [ ] **6/10 · 1 j** 8 maquettes : écran d'accord de partage + réglages
- [ ] **6/10 · 1 j** La regarder sur plusieurs vraies sorties (footing, longue, fractionné, vélo) et corriger les phrases
- [ ] **5/10 · 2 j** Plan de préparation triathlon (enchaînement des 3 sports)
- [ ] **5/10 · 1,5 j** Modifier la durée d'une séance ; créer une compétition ou un objectif depuis le coach
- [ ] **5/10 · 1 j** Comparer Haiku et Sonnet sur 1 000-2 000 cas
- [ ] **5/10 · 2 j** Réactions du corps plus riches (départ, récupération, sommeil, fatigue des jours d'avant)
- [ ] **5/10 · 2 j** Progression plus fine (vélo, même fractionné refait, tendance sur plusieurs semaines)
- [ ] **5/10 · 1 j** Phrases plus « coach »
- [ ] **4/10 · 1,5 j** 8 maquettes : carte d'un plan long, édition à la main de la structure
- [ ] **4/10 · 0,5 j** Commencer à stocker le VO2max dans le temps
- [ ] **4/10 · 2 j** Autres sports (muscu, natation, Hyrox), cadence et relief en course
- [ ] **4/10 · 5 j** Plus tard : « la vraie création d'un coach avec un vrai plan » (à cadrer ensemble)

## 4. Accueil et widgets

- [ ] **8/10 · 3 j** Refaire l'affichage des écrans d'accueil (la mise en page globale, pas seulement les widgets) : 8 maquettes
- [ ] **8/10 · 4 j** Refaire les widgets avec précision pour qu'ils soient beaux et pertinents (chacun dit quelque chose d'utile au sportif). Widget par widget, tailles XS/S/M/L, 8 maquettes par refonte d'aspect
- [ ] **7/10 · 4 j** Donner de la profondeur aux widgets : chacun mène quelque part, soit un lien direct vers l'écran de ses données, soit une page de détail créée pour lui. Choisir l'option pour chaque widget ; 8 maquettes par page de détail neuve

## 5. Calendrier

- [ ] **8/10 · 1,5 j** Repasser sur tout l'écran Calendrier pour repérer ce qui manque, les bugs et les corrections (parcours complet dans le simulateur, puis lister ici ce qu'on trouve)
- [ ] **6/10 · 1 j** Vérifier le thème clair (calendrier, pop-up d'import, compétition, dossard)
- [ ] **6/10 · 2 j** Ouvrir une activité importée (flux, carte, tours) et calculer son vrai TSS
- [ ] **5/10 · 2 j** Compétition : course par étapes et segments du triathlon
- [ ] **5/10 · 0,5 j** Garder les filtres (bouton filtre en rond) en préférence : ils restent réglés à chaque lancement de l'app
- [ ] **4/10 · 0,5 j** Où mettre l'accès aux écrans de cycles
- [ ] **4/10 · 0,5 j** Blessure « en cours » sans date de fin

## 6. Écran d'une sortie

- [ ] **9/10 · 8 j** Faire et finaliser tous les écrans de séance selon le type (prévue, compétition, réalisée) et selon le sport (course, vélo, natation, muscu, Hyrox, triathlon…). Lister d'abord la grille type × sport (ce qui existe, ce qui manque), puis 8 maquettes pour chaque écran neuf ou refait
- [ ] **7/10 · 0,2 j** Séance prévue : remettre le bouton Supprimer
- [ ] **4/10 · 2 j** Pouvoir bouger la trace de la sortie

## 7. Bilan et zones

- [x] **8/10 · 1 j** Terminer la page Bilan en vue « Tous » : Résumé, Rythme, Records et Niveau (ex-Progrès) sont faits (14 nov.)
- [x] **8/10 · 2 j** Supprimer ou modifier l'onglet Progrès avec des valeurs factuelles plutôt que des formules inventées (14 nov. : courbe de niveau trimestre par trimestre, une courbe par sport ; note du trimestre = moyenne de 3 pourcentages : heures, charge, records posés pendant ces 3 mois, le meilleur trimestre = 100). Records = puissance du vélo (5 s à 2 h), allure de la course et de la natation (1 min à 2 h), plus longue sortie ; top 5 de chaque record, la 1re séance pèse 1 et la 5e 0,2. Le 45 min est remplacé par 40 min (non gardé en base). Reste à ajouter les records de muscu par exercice
- [ ] **5/10 · 1,5 j** Niveau : ajouter les records de musculation par exercice (1RM de chaque exercice du carnet, top 5 avec dates) dans la note du trimestre
- [ ] **4/10 · 1 j** Retirer le code de l'ancien Progrès dans `bilan.tsx` et ses composants (ProgresSport, NiveauGlobalSport, FormeSaison…), désactivé le 14 nov. mais encore là
- [ ] **7/10 · 0,5 j** Voir et valider l'écran Paramètres › Zones dans le simulateur
- [ ] **6/10 · 0,5 j** Essayer pour de vrai « Faire calculer mes zones par le coach »
- [ ] **6/10 · 1 j** Le Bilan doit lire les zones perso
- [ ] **6/10 · 0,5 j** Vérifier les zones perso quand la FTP ou la LTHR change
- [ ] **5/10 · 1 j** Brancher `estimerFtp` et `estimerFcMax` à un écran
- [ ] **4/10 · 0,3 j** Widget Progression de l'accueil : retirer son propre sélecteur de période
- [ ] **3/10 · 1,5 j** Plus tard : bouton « marquer comme compétition » (8 maquettes)
- [ ] **2/10 · 2 j** Plus tard : pente, ressenti Strava, courbe de température

## 8. Profil, Paramètres et Santé

- [ ] **8/10 · 2 j** Remettre un moyen de modifier l'identité et la photo (prénom, poids…) : 8 maquettes
- [ ] **7/10 · 4 j** Faire la page Santé (pas encore faite) : à cadrer ensemble (sommeil, FC repos, HRV, blessures ?), puis 8 maquettes
- [ ] **7/10 · 2 j** Dans les Paramètres : finaliser la page Profil à la perfection
- [ ] **7/10 · 3 j** Finaliser à la perfection chaque page des Paramètres, comme le Profil : Physio, Zones, Mes sports, Connexions, et toutes les autres (repasser l'écran en entier pour n'en oublier aucune)
- [ ] **6/10 · 0,1 j** **(toi)** Dire ce que tu veux encore changer sur l'écran Profil
- [ ] **6/10 · 3 j** Refonte du système de notes du profil

## 9. Sources d'activités

- [ ] **8/10 · 8 j** Brancher les API des montres et des apps de sport (Garmin, Polar, Coros, Suunto, Wahoo, Whoop, Apple Santé…) pour que Strava ne soit plus la seule source. À cadrer : lesquelles d'abord, ce que chaque API autorise (accès à débloquer, GPS, flux), et comment éviter les doublons quand une sortie arrive de deux sources. Garmin est « Bientôt disponible » depuis la décision du 13 oct. Les accès développeur peuvent prendre des semaines : à demander tôt
- [ ] **6/10 · 1,5 j** Synchro Strava : tâche serveur planifiée (pg_cron) pour ne plus garder l'écran ouvert

## 10. Qualité

- [ ] **8/10 · 1,5 j** Premier lancement : écran pour quelqu'un qui n'a aucune donnée (la démo est retirée, cet état vide compte beaucoup) ; 8 maquettes
- [ ] **7/10 · 1,5 j** Mode hors ligne : vérifier ce que l'app affiche sans réseau et le gérer proprement
- [ ] **7/10 · 2 j** Accessibilité : contrastes, texte agrandi, lecteur d'écran (VoiceOver), cibles ≥ 44 px
- [ ] **6/10 · 0,5 j** Voir la muscu sur de vraies données (jamais vue à l'écran)
- [ ] **5/10 · 2 j** Notifications : rappel de séance, message du coach. À cadrer ; 8 maquettes pour les réglages

## 11. Android

- [ ] **5/10 · 2 j** Vérifier qu'il n'y a aucun problème d'affichage sur Android
- [ ] **5/10 · 1 j** Android : générer `android/`, clé Google Maps

## 12. Après la sortie

- [ ] **9/10 · 6 j** **En dernier** : créer l'écran et les fonctions de paiement d'abonnement (offres, achat, gestion et résiliation, accès selon l'offre). À cadrer le moment venu (achats intégrés Apple/Google ou autre, prix, ce qui reste gratuit) ; 8 maquettes
- [ ] **2/10 · 10 j** Plus tard : classement entre utilisateurs, durabilité, FC repos/HRV/VO2max par Apple Santé, chaussures de l'avatar
