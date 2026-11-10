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

## À faire

### 1. Seuils (en attente du feu vert de Yanis sur les chiffres)
- [ ] Écrire dans son profil : FC max 205, FTP 235 (à confirmer).
- [ ] Décider pour la LTHR : garder 174 ou passer à 189.
- [ ] Corriger `estimerFtp` : 95 % du meilleur 20 min sur 90 jours (`watts_90d`), record de tous les temps en secours, plus un test dans `tests/reglages/profil.test.ts`.
- [ ] Filtrer les valeurs de FC aberrantes (au-delà de la FC max plausible) quand on déduit une FC max des sorties.
- [ ] Vérifier à l'écran que la sortie vélo prend bien la FTP de Strava quand le profil n'en a pas.

### 2. Bandes de zones sur les courbes
- [ ] Bandes pour la puissance et l'allure (les zones sont déjà calculées).
- [ ] Cœur : toutes les zones (Z1 à Z5), une couleur et un nom par zone, au lieu de trois teintes de rouge.
- [ ] Légende lisible des zones.

### 3. Temps par zone et repères marquants
- [ ] Résumé du temps passé par zone sur la page 2 de la sortie.
- [ ] Repères sur les courbes : FC max atteinte, pic de puissance, dérive cardiaque, efforts marquants.
- [ ] Réglages : zones personnalisées, estimation proposée depuis les sorties (FC max, FTP).

## Règles pour la suite

- Tout changement d'aspect de la page de la sortie ou des réglages : **8 maquettes d'abord** (Artifact privé), puis code.
- On corrige côté `native/` seulement (`app/` est gelé).
- Les écritures dans le vrai profil de Yanis (FC max, FTP, LTHR) passent par son accord sur les chiffres.
