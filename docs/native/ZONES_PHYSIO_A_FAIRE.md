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

## Fait (11 nov. 2026)

- Profil de Yanis en base : FC max 200, FTP 200 W, LTHR 189, vitesse seuil 11,5 km/h.
- `estimerFtp` corrigée (95 % du meilleur 20 min sur 90 jours, test ajouté) et `estimerFcMax` créée (ignore les FC hors 100–220 bpm).
- Bandes de zones derrière les courbes de puissance (6), cœur (5) et allure (5, course seulement), couleur du sport, ligne blanche.
- Temps par zone (page 2) accordé aux bandes : mêmes zones et mêmes teintes.

## Reste (optionnel)

- Vérifier à l'écran que la sortie vélo prend la FTP de Strava quand le profil n'en a pas.
- Repères sur les courbes (pic de puissance, FC max, dérive cardiaque, efforts marquants) : **abandonnés** par Yanis le 11 nov. (maquettes 7 et 8 de l'Artifact si on y revient).
- Réglages : zones personnalisées, estimation proposée depuis les sorties (`estimerFcMax`, `estimerFtp` ne sont pas encore branchées à un écran).

## Règles pour la suite

- Tout changement d'aspect de la page de la sortie ou des réglages : **8 maquettes d'abord** (Artifact privé), puis code.
- On corrige côté `native/` seulement (`app/` est gelé).
- Les écritures dans le vrai profil de Yanis (FC max, FTP, LTHR) passent par son accord sur les chiffres.
