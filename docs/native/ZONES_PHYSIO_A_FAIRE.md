# Zones et physiologie : ce qui reste à faire

But : que les graphes de la sortie (page 2 : allure, cœur, altitude, cadence, puissance) marquent des repères utiles. Point de départ : audit du 10 nov. 2026 sur le compte de Yanis (lecture seule, rien modifié en base).

## Ce qui existe déjà

- Réglages : `app/parametres/zones.tsx`, champs FTP, FC max, LTHR, FC repos, VMA (`src/data/reglages/profil.ts`).
- Calcul : `calculerZones` (puissance 7 zones, cardio 7, allure 5), recalculé à l'affichage, jamais stocké. LTHR estimée à 92 % de la FC max sans valeur saisie.
- Graphes : seul le cœur a des bandes (Z3, Z4, Z5a, une teinte de rouge) via `seuilsCoeur` dans `GraphesSynchro.tsx`, alimenté par `app/seance.tsx`.
- Un temps par zone existe déjà côté calcul (`tempsParZone`, `zonesCardioTemps`), à vérifier à l'écran.

## Constat de l'audit (compte de Yanis)

- **FC max** : 190 dans le profil, mais 99 % des sorties restent sous 205 bpm (251 sorties au-dessus de 195). Le 233 en base est un parasite de capteur. Zones hautes décalées d'environ 15 bpm.
- **LTHR** : 174 saisie, non vérifiable (pas de cardio sur le meilleur 20 min). À garder si elle vient d'un test, sinon 92 % de 205 = 189.
- **FTP** : vide dans le profil. Meilleur 20 min sur 90 jours = 246 W, soit environ 234 W. Strava donne 246 W sur les dernières sorties. Record de tous les temps = 300 W (285 W de FTP), trop ancien pour représenter la forme actuelle.
- `estimerFtp` (`profil.ts`) prend `watts_alltime` : il donne 285 W. Utilisé seulement dans les tests pour l'instant.

## À FINIR (12 nov. 2026) : écran Zones et coach

Ce qui est codé et commité en local, mais **pas encore vu à l'écran ni validé** par Yanis :
- [ ] **Écran Paramètres › Zones** (`app/parametres/zones.tsx`, `components/reglages/`) : 3 onglets, barre avec noms et valeurs sous chaque limite (Z1 et dernière zone figées à 9 %), réglage par − / + (qui répètent) ou au clavier, sans limite, bouton « Enregistrer mes zones ». À tester dans le simulateur : glisser / maintenir les flèches, saisie « 450 » ou « 5:30 », cardio sur 5 zones, lecture après enregistrement dans une sortie.
- [ ] **« Faire calculer mes zones par le coach »** : fonction `coach-zones` déployée mais **jamais appelée pour de vrai** (il faut le jeton de Yanis). Vérifier : accès coach et accord de partage OK sur son compte, carte de proposition, « Appliquer » qui enregistre, cas « aucune limite ne change », messages d'erreur.
- [ ] **Plafond de 10 points** (`ECART_MAX_POINTS` dans `_shared/coach-zones.ts`) et **écart minimal de 2 points** entre limites : choisis par Claude, à faire valider par Yanis.
- [ ] Le **Bilan** (progrès course et vélo : `sports/course.ts`, `sports/velo.ts`) garde ses zones fixes et ne lit pas encore les zones perso. Les courbes, le temps par zone et l'analyse de séance les lisent déjà.
- [ ] Les zones perso sont stockées en % de la référence (`extras.zones_perso` du profil) : vérifier le comportement quand la FTP ou la LTHR change.
- [ ] Plus de lien vers la physiologie sur l'écran Zones quand la référence existe (seulement « Renseigner … » quand elle manque) : voir si Yanis veut un accès ailleurs.
- [ ] Brancher `estimerFtp` et `estimerFcMax` (écrites, testées) à un écran ou au coach (le coach ne les utilise pas : il lit la courbe de puissance et la FC max observée).
- [ ] Pousser : rien n'est poussé (attendre le mot « yallah »).

## Fait (11 nov. 2026)

- Profil de Yanis en base : FC max 200, FTP 200 W, LTHR 189, vitesse seuil 11,5 km/h.
- `estimerFtp` corrigée (95 % du meilleur 20 min sur 90 jours, test ajouté) et `estimerFcMax` créée (ignore les FC hors 100–220 bpm).
- Bandes de zones derrière les courbes de puissance (6), cœur (5) et allure (5, course seulement), couleur du sport, ligne blanche.
- Temps par zone (page 2) accordé aux bandes : mêmes zones et mêmes teintes.

## Reste (optionnel)

- Vérifier à l'écran que la sortie vélo prend la FTP de Strava quand le profil n'en a pas.
- Repères sur les courbes (pic de puissance, FC max, dérive cardiaque, efforts marquants) : **abandonnés** par Yanis le 11 nov. (maquettes 7 et 8 de l'Artifact si on y revient).
- Réglages : zones personnalisées, estimation proposée depuis les sorties (`estimerFcMax`, `estimerFtp` ne sont pas encore branchées à un écran).

## Données Strava à récupérer en plus (décisions du 11 nov. 2026)

- **Fait (11 nov.)** : `avg_temp` (température moyenne, seulement si l'appareil la mesure) et `workout_type` (1 et 11 = compétition, 2 = sortie longue, 3 et 12 = entraînement) rangés dans `activities` (migration `2026-11-11_temperature_type_seance.sql`, `strava-ingest` et `strava-webhook` déployées, historique rattrapé), affichés dans les données de la sortie. La courbe de température (stream `temp`) : plus tard.
- **Plus tard** : pente (`grade_smooth`) : profil d'altitude coloré, allure ou puissance selon la pente. Ressenti saisi dans Strava (`perceived_exertion`) : chantier à voir.
- **Plus tard (pas le moment, 11 nov.)** : marquer à la main une sortie comme compétition. Le tag existe déjà (`activities.category`, 101 sorties, la synchro ne l'écrase pas) ; il manque seulement le bouton. 8 maquettes faites : https://claude.ai/artifact/A4EguSn5tMuXSrsA96ieGb (conseil : sélecteur en page 2 ou menu « ··· », plus un écran « courses à classer » pour l'historique). Tes 3 courses à pied taguées sur Strava ne sont qu'une petite partie de tes courses réelles.
- **Écartés** : records de course et splits (déjà calculés chez nous).

## Règles pour la suite

- Tout changement d'aspect de la page de la sortie ou des réglages : **8 maquettes d'abord** (Artifact privé), puis code.
- On corrige côté `native/` seulement (`app/` est gelé).
- Les écritures dans le vrai profil de Yanis (FC max, FTP, LTHR) passent par son accord sur les chiffres.
