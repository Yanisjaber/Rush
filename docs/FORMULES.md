# Formules de Rush

Le recueil de toutes les formules de calcul de l'app, au même endroit. On l'enrichit à chaque nouvelle formule validée.
Les formules marquées **à valider** sont des propositions : les bornes sont des estimations à recaler sur de vraies données.

Code de référence : `native/src/data/` (calculs de l'app), `supabase/functions/_shared/` (calculs à l'import) et `supabase/migrations/` (calculs de la base). Le web `app/` est gelé, on ne le touche pas.
Détails et historique des décisions du niveau global : `docs/native/PROGRESSION_NIVEAU.md`.

---

## 1. TSS (Training Stress Score) : la charge d'une séance

Le TSS dit « combien cette séance a coûté », en points. **100 points = 1 h pile à la FTP** (puissance) ou **à la LTHR** (cardio) : les deux sont sur la même échelle, donc on peut mélanger des sorties avec et sans capteur dans la même courbe de charge.

**1. Puissance** : seulement sur un **vélo non électrique** (`Ride`, `VirtualRide`, `GravelRide`, `MountainBikeRide`), avec un **vrai capteur** de puissance (`device_watts`) et une puissance normalisée. Les watts estimés par Strava et la simple puissance moyenne ne comptent pas.

```
IF  = NP / FTP                      // facteur d'intensité (NP = puissance normalisée, FTP de l'époque de la sortie, voir §3)
TSS = durée_h × IF² × 100
```

- `NP` : la puissance moyenne lissée sur 30 s, élevée à la puissance 4, moyennée puis racine 4e. Elle vient de Strava (`weighted_average_watts`, colonne `np`).
- `durée_h` : le temps en mouvement, sinon le temps total.
- Les **watts estimés par Strava** (sortie sans capteur de puissance, `device_watts` faux) ne comptent nulle part et ne sont pas affichés dans l'app (3 nov. 2026, voir `docs/native/DONNEES_ECARTEES.md`).

**2. Cardio** (sinon, y compris pour la course, le vélo électrique et les watts estimés) :

```
TSS = 100 × hr_sq / ( LTHR² × 3600 )      // seconde par seconde : moyenne de (FC / LTHR)² × heures × 100
```

- `hr_sq` = somme des carrés des fréquences cardiaques, seconde par seconde, et `hr_s` = nombre de secondes avec un cardio (`supabase/functions/_shared/cardio.ts`, rangés dans `power_curve`). Seules les FC entre 40 et 230 comptent.
- Utilisé quand le flux cardio couvre **au moins 80 %** de la sortie. Sinon : `TSS = durée_h × (FC moyenne / LTHR)² × 100`.
- `LTHR` : celle du profil, sinon 92 % de la FC max du profil, **sinon déduite des sorties** (3 nov. 2026) : 92 % du 98e centile des FC max des sorties (entre 120 et 230 bpm, pour ignorer les capteurs qui déraillent ; il faut au moins 20 sorties avec une FC max). Sans ça, une sortie sans capteur de puissance gardait un TSS tiré de ses watts estimés par Strava, faux et trop haut. Compte de test : LTHR déduite de 181 bpm ; les sorties sans capteur passent de 79 à 61 points par heure en 2022 et de 83 à 64 en 2021, comme les sorties à capteur (57 à 65). C'est la base qui la déduit (`recalc_ftp_tss`, à la migration puis chaque nuit) ; à l'import, `charge.ts` n'a que celle du profil. Pourquoi seconde par seconde : la moyenne des carrés est plus grande que le carré de la moyenne, une sortie par intervalles paraissait trop facile avec la FC moyenne.

**3. Sans rien** (affichage dans l'app, `chargeSeance` dans `native/src/data/bilan/synthese.ts`) : TSS enregistré s'il existe, sinon `durée_h × 45` si la FC moyenne est connue, sinon `durée_h × 35`. Estimation grossière, arrondie.

**Garde-fou de plausibilité (3 nov. 2026)** : une sortie ne dépasse jamais **200 points par heure** (une heure à 1,4 fois la FTP en fait 196) et une **intensité de plus de 1,5 n'existe pas**. Au-delà, c'est une FTP absurde (4 W) ou une puissance fausse, pas un effort : la règle « puissance » est écartée et on passe au cardio ; sans cardio de référence, une sortie dont le TSS enregistré dépasse 200 par heure reçoit l'estimation générale (45 points par heure avec un cardio, 35 sans, comme `chargeSeance`), et sa FTP enregistrée est effacée. Cas réel du compte de test : 106 sorties de 2011 à 2013 (watts estimés, « FTP » de 4 W à l'import d'origine) avaient jusqu'à 1 176 714 TSS et un CTL de 221 025 en 2013 ; elles sont ramenées à 35 ou 45 par heure. Les 20 min qui servent à estimer la FTP ignorent ceux sous la moitié de ton meilleur de toujours (capteur en panne). Les séances saisies à la main ne sont jamais touchées.

Qui calcule quoi : à l'import, `strava-ingest` et `strava-webhook` (`_shared/charge.ts`) donnent un premier TSS. La base a le dernier mot : `recalc_ftp_tss` (migration `2026-11-02_ftp_glissante.sql`) recalcule les sorties Strava avec la FTP de leur époque et le flux cardio, à la migration puis chaque nuit à 00 h 05 UTC. Les données **écartées** par l'utilisateur (puissance, cardio, charge, durée) sortent du calcul (`tss_retenu`).

---

## 2. CTL, ATL, TSB : condition, fatigue, fraîcheur

Modèle de Banister (popularisé par TrainingPeaks). Calculé par la base, **jour par jour, de la première sortie jusqu'à aujourd'hui** (`recalc_daily_metrics`, table `daily_metrics`) : un jour de repos compte 0, donc la forme redescend quand on ne s'entraîne pas. La charge du jour est la somme des TSS du jour (les étapes fusionnées d'un triathlon ne sont pas comptées deux fois).

```
CTL(j) = CTL(j-1) + ( charge(j) − CTL(j-1) ) × 2 / 43     // condition : moyenne exponentielle sur ~42 jours
ATL(j) = ATL(j-1) + ( charge(j) − ATL(j-1) ) × 2 / 8      // fatigue : idem sur ~7 jours
TSB(j) = CTL(j) − ATL(j)                                  // fraîcheur (forme du jour)
```

- **Départ** : CTL et ATL valent 0 le premier jour.
- Les valeurs sont arrondies (charge au point, CTL / ATL / TSB au dixième).
- La série est recalculée à chaque modification d'une activité (déclencheur sur `activities`) et chaque nuit.

Lecture du TSB : ≥ 25 désentraînement · 5 à 25 frais, prêt à performer · −10 à 5 neutre · en dessous, fatigué.

**ACWR** (risque de blessure, Gabbett 2016) : `ACWR = charge aiguë (7 j) / charge chronique (28 j)`. **Pas encore dans l'app** (idée). Zones : < 0,8 sous-charge · 0,8 à 1,3 optimal · 1,3 à 1,5 vigilance · > 1,5 danger.

---

## 3. FTP glissante : la FTP de l'époque de chaque sortie

Avant, toutes les vieilles sorties recevaient la FTP du jour d'import : la charge des vieilles années était fausse et l'évolution de la FTP plate. Maintenant (`recalc_ftp_tss`, `2026-11-02_ftp_glissante.sql`) :

```
FTP d'une sortie = 95 % × meilleur 20 min (clé '1200' de power_curve) des sorties à vrai capteur situées dans les 90 jours avant ET après elle
```

- Si la fenêtre ne contient aucun 20 min, elle s'élargit à ±180 puis ±365 jours. Sans rien, la sortie garde sa FTP d'avant.
- **Pourquoi ±90 jours et pas ±45** (3 nov. 2026) : on ne fait pas un effort maximal de 20 min tous les 45 jours ; quand la fenêtre ne contient que des 20 min tranquilles, la FTP estimée tombe sous la vraie, l'intensité monte et le TSS gonfle. Compte de test, 2022 : FTP médiane 203 W (la meilleure puissance de l'année donne 216 W), 70 points par heure contre 57 à 65 les autres années. Avec ±90 : FTP 219 W et 60 points par heure ; les autres années bougent de 1 à 4 points par heure.
- Sur les **90 derniers jours**, la FTP saisie dans le profil (`user_profiles.ftp`) l'emporte sur l'estimation.
- Ignorés pour estimer : watts estimés par Strava, puissances écartées, étapes fusionnées, sports qui ne sont pas du vélo, vélo électrique.
- Seules les sorties vélo avec vrai capteur et NP voient leur `ftp_at_time` et leur TSS mis à jour.
- Le **widget FTP** de l'app trace la dernière FTP de chaque semaine (sorties avec capteur seulement, 26 semaines) ; « aujourd'hui » est la FTP du profil si elle est renseignée.

---

## 4. Niveau global à vélo : 4 piliers, notés de 0 à 100

Code : `native/src/data/bilan/piliers-niveau.ts`. Les mesures par année viennent de la fonction SQL `rpc_piliers_annuels` ; les notes sont calculées dans l'app. **Score global = moyenne des 4 piliers**, arrondie, **seulement si au moins 3 piliers sur 4 ont toutes leurs preuves** (3 nov. 2026) ; sinon l'année n'a pas de score global (l'écran affiche « — » et dit combien de piliers sont mesurés) et ses piliers restent détaillés. Compte de test : 2016-2018, sans capteur de puissance, affichaient 7 à 11 comme de très mauvaises années alors que deux piliers sur quatre n'étaient pas mesurables. La durabilité a été retirée (voir la fin de cette section).

**Échelles** (une note linéaire entre deux bornes, bornée à 0 et 100) :

| Échelle | 0 | 100 | Sert pour |
|---|---|---|---|
| `noteDe` | 70 % du meilleur | le meilleur | régularité de la répétabilité, niveau par année, records |
| puissance | 80 % du meilleur | le meilleur | pilier Puissance (plus exigeante) |
| hauteur | 50 % du record | le record | hauteur des efforts répétés |
| charge | 40 % de la référence | la référence (moyenne de tes 3 meilleures années) | pilier Capacité de charge : CTL moyen, heures, jours actifs (plus douce) |

**Preuves** : une note est toujours calculée avec ce qui est mesuré, puis multipliée par sa « preuve » (`nombre de sorties ÷ sorties demandées`, entre 0 et 1, les sorties demandées étant 3 pour chaque pilier). Une case à preuve incomplète est en pointillés dans l'écran.

### 4.1 Puissance

```
note(durée) = noteLinéaire( meilleur de l'année ÷ meilleur de toujours ; 0,80 → 0 ; 1,00 → 100 )
Puissance   = moyenne( note(5 s), note(5 min), note(20 min), note(60 min) ) × preuve
```

- « Meilleur de toujours » : sur les années à au moins 3 sorties avec capteur (sinon, sur celles qui en ont au moins une).
- Preuve : `sorties avec capteur de l'année ÷ 3`.

### 4.2 Endurance, à puissance fixe (formule du 3 nov. 2026)

Répond à : « tenir longtemps est-il devenu plus facile ? ». En 2026, 175 W pendant 3 h est bien plus facile qu'en 2019 (moins de % de la FTP, un cœur plus bas, plus frais à 2 h 30). On compare donc toutes les années à la **même puissance en watts**.

```
P_ref  = 0,70 × FTP_toujours          // FTP_toujours = 0,95 × meilleur 20 min de tous les temps (années à ≥ 3 sorties avec capteur)

F = clamp( (P_ref / FTP_année − 0,90) / (0,70 − 0,90), 0, 1 )     // facilité : 70 % de la FTP = 1, 90 % = 0
H = clamp( (FC_ref − (FC_min + 15)) / (FC_min − (FC_min + 15)), 0, 1 )   // coût cardio : ton meilleur (le plus bas) = 1, 15 bpm de plus = 0
C = clamp( (12 − drift) / (12 − 2), 0, 1 )                         // fraîcheur à 2 h 30 : découplage 2 % = 1, 12 % = 0

Endurance = 100 × ( 0,35·F + 0,30·H + 0,35·C )
```

| Ingrédient | Définition |
|---|---|
| `FTP_année` | `0,95 × meilleur 20 min de l'année`. |
| Sorties de référence | Plus de 2 h (durée non écartée), puissance (normalisée, sinon moyenne) à **±10 %** de `P_ref`. On garde les **10 plus récentes** de l'année (celles qui ont une FC moyenne pour `FC_ref`, celles qui ont un `drift` pour le découplage). |
| `FC_ref` | **Médiane** de la FC moyenne des sorties de référence. `FC_min` = la plus basse `FC_ref` de toutes les années (années à ≥ 3 sorties de référence avec FC). Pas de % de LTHR : le profil n'en a pas toujours. |
| `drift` | `(EF_1ère_moitié − EF_2ème_moitié) / EF_1ère_moitié × 100`, avec `EF = puissance normalisée / FC moyenne`, échauffement de 10 min mis à part (`_shared/derive.ts`). **Médiane** sur les sorties de référence. Une 2e moitié plus efficace (drift négatif) est plafonnée à 1. |

Poids : facilité (F) 35 %, fraîcheur (C) 35 %, coût cardio (H) 30 %.

Preuves : chaque lettre demande 3 sorties (3 sorties de référence avec FC, 3 avec découplage, 3 avec capteur pour la FTP de l'année) et vaut au prorata si moins. Une lettre sans mesure vaut 0, et sa part de preuve aussi.

Exemple (compte de test, `P_ref` = 174 W ; chiffres calculés avec l'ancienne formule à 4 lettres, avant le retrait de la fatigue) : 174 W vaut 82 % de la FTP en 2019, 70 % en 2026 ; FC moyenne à 174 W : 143 bpm en 2019, 127 en 2026 → endurance ≈ 42 en 2019, ≈ 87 en 2026.

Cas limites :
- Peu de sorties de référence une année (par exemple 5 en 2022) : la note est réduite d'autant (preuve).
- `FC_ref` se compare aux autres années du même compte : avec une seule année, H vaut 100 par définition.
- Le découplage dépend de la FC : sans sangle cardio propre, C et H valent peu (le cardio écarté par l'utilisateur retire la FC et le `drift` de la sortie).
- La clé `drift` s'écrit à l'import (`strava-streams`, version des courbes 8) ; les anciennes sorties les reçoivent au recalcul des courbes (écran Synchro).

Les bornes sont des estimations, pas une norme scientifique : à recaler sur de vraies sorties.

### 4.3 Répétabilité

Sur les **10 meilleures sorties de l'année** (celles où le 3e effort est le plus fort), parmi les sorties qui ont **trois vrais efforts de 5 min** (le 3e effort vaut au moins 50 % de ton meilleur 5 min de tous les temps). Sur une sortie facile, les « 3 meilleurs efforts » ne sont que trois morceaux un peu plus appuyés : la médiane de toutes les sorties tirait la note vers le bas (3 nov. 2026) :

```
régularité = noteDe( min(1, 3e effort ÷ 1er effort) )                    // médiane des 10 meilleures sorties de l'année
hauteur    = noteLinéaire( 3e effort médian (des 10) ÷ meilleur 5 min de toujours ; 0,50 → 0 ; 1,00 → 100 )
Répétabilité = moyenne( régularité ; hauteur ) × preuve
```

- Sans la hauteur (base pas à jour), la régularité fait seule la note. Preuve : `sorties valides ÷ 3`.

### 4.4 Capacité de charge

```
Référence_x = moyenne des 3 plus hautes valeurs annuelles de x (ou de toutes, s'il y a moins de 3 années)      // x = CTL moyen, heures, jours actifs

note_x  = noteLinéaire( valeur_x de l'année ÷ Référence_x ; 0,40 → 0 ; 1,00 → 100 )
Charge  = 0,60 · note_CTL + 0,25 · note_heures + 0,15 · note_jours
```

- **CTL moyen de l'année** (60 %) : la moyenne des CTL de tous les jours de l'année (`ctl_moy`, rendue par `rpc_piliers_annuels` avec le pic `ctl_max`). C'est la charge tenue **toute l'année** (« encaisser et enchaîner »), pas le pic d'un seul jour.
- **Heures de l'année** (25 %) : somme des minutes de `daily_metrics` en heures (les durées écartées n'y sont déjà pas). **Jours actifs** (15 %) : les jours avec au moins une activité (la régularité : 220 jours actifs et 180 jours actifs ne valent pas pareil à CTL égal).
- **L'année en cours** (et la première) ne couvre pas 365 jours : heures et jours actifs sont ramenés à une année complète, `valeur × 365 ÷ jours couverts`, à partir de 30 jours couverts (en dessous, ils ne comptent pas et le CTL moyen fait seul la note). Sans volume du tout (base pas à jour), le CTL moyen fait seul la note.
- **Référence = les 3 meilleures années** (3 nov. 2026) : une seule année gonflée ne fixe plus le « 100 ». Cas du compte de test : 2022 avait un CTL max de 149 (contre 100 à 110 en 2024-2026) alors que ses heures et ses watts étaient les mêmes ; sa FTP estimée était trop basse (204 W, seulement 51 sorties avec capteur) donc l'intensité médiane valait 0,91 au lieu de 0,80.
- Au-dessus de la référence : plafonné à 100. Preuve : 1 dès que l'année a une charge. Plus douce que les autres échelles : la charge est une quantité d'entraînement, pas un niveau de performance.

Exemple (compte de test) : 2026 ≈ 99, 2025 ≈ 90, 2024 ≈ 89, 2022 ≈ 94, 2019 ≈ 50 (avant le volume : 100, 84, 86, 100, 35).

### Durabilité : retirée (2026-11-02)

Le pilier Durabilité (meilleur 5 et 20 min après 2 h 30 ÷ meilleur à froid) et la lettre D de l'endurance (20 min après 30 kJ/kg) sont retirés. En sorties libres, un ratio bas peut venir de ce qu'on n'a pas osé faire en fin de sortie plutôt que d'un manque de durabilité : la mesure ne prouvait rien quand elle était basse. Nettoyage du 3 nov. 2026 : la fonction `rpc_piliers_annuels` ne rend plus `late300`, `late1200`, `n_longues`, `fat20` ni `n_fat` ; la clé `fat20` n'est plus calculée à l'import (les sorties déjà recalculées la gardent, personne ne la lit) ; les clés `late_300` et `late_1200` restent calculées pour le profil de durabilité du site gelé, l'app ne les lit pas. Détails dans `docs/native/PROGRESSION_NIVEAU.md`.

---

## 5. Niveau global à la course à pied : 4 piliers (4 nov. 2026)

Même mécanique que le vélo (section 4) : chaque pilier est noté de 0 à 100, une note est **réduite de la part de preuve qui manque**, le score global est la moyenne des 4 piliers **seulement si 3 piliers ont toutes leurs preuves** (sinon « — »), et la meilleure année se cherche parmi celles qui ont un score. Code : `native/src/data/bilan/piliers-course.ts` (+ `piliers-sport.ts` pour la mécanique commune).

- **Vitesse** : moyenne des notes de ton meilleur **1 km** et de ta meilleure **distance en 5 minutes** de l'année. Chacune est comparée à ton meilleur de **tous les temps** (rapport = record ÷ temps, ou distance ÷ record) : 100 = ton record, 0 = 25 % moins vite (`COURSE_ZERO = 0,75`).
- **Endurance** : moyenne des notes de ton meilleur **5 km**, **10 km** et de ta meilleure **distance en 1 heure** de l'année, même échelle. Une distance jamais courue cette année-là ne compte pas.
- **Efficacité** : l'allure à cardio égal (et au dénivelé médian) de l'année, c'est-à-dire la note du niveau année après année (`niveau-annees.ts`, 100 = ton meilleur niveau). Courir plus vite avec le même cœur.
- **Volume** : 40 % les kilomètres, 35 % les heures, 25 % les jours actifs de l'année (séances de course seulement), chacun contre la **moyenne de tes 3 meilleures années** ; 100 = cette référence, 0 à 40 % (comme la capacité de charge du vélo). Les totaux de l'année en cours et de la première année sont ramenés à 365 jours (× 365 ÷ jours couverts, à partir de 30 jours).
- **Preuves** : vitesse et endurance demandent **3 courses avec courbes** dans l'année ; l'efficacité a sa preuve dans le niveau (3 courses au moins) ; le volume demande 30 jours de données.
- **Meilleurs temps et distances** : calculés côté serveur depuis les flux (`signal_curves`, version 11, `_shared/signaux-course.ts`) : meilleur temps sur 400 m, 1 km, 1 mile, 3 km, 5 km, 10 km, 15 km, 20 km, semi, 30 km, marathon ; meilleure distance et meilleure FC sur 1 min à 3 h. Les **pauses** (trous de plus de 10 s) sont retirées et les **sauts de GPS** (un pas de plus de 12 m/s : 60 à 70 m en une seconde, vus dans l'historique) sont remplacés par le pas habituel ; sans cela un seul saut donnait « 400 m en 42 secondes ». Plafond de vitesse d'une fenêtre : 9,5 m/s sous 1 km, 8,5 m/s au-delà.
- **Forme par saison** (course) : le même calcul que le vélo (section « Forme par saison » de `docs/native/PROGRESSION_NIVEAU.md`) sur l'allure à cardio égal ; une allure plus basse est un meilleur niveau (rapport = meilleur ÷ allure).

## 6. Niveau global en musculation : 4 piliers (4 nov. 2026)

Mêmes règles de preuve et de score global que la course. Code : `native/src/data/bilan/piliers-muscu.ts`. Données : le carnet de force (`strength_sets` : exercice, groupe musculaire, poids, répétitions) et les séances.

- **Force** : pour tes **5 exercices les plus pratiqués** (au moins 6 séries au carnet), le meilleur **1RM estimé** de l'année (formule d'Epley : poids × (1 + répétitions ÷ 30), séries de 1 à 12 répétitions) contre ton meilleur de tous les temps sur cet exercice ; 100 = ton record, 0 = 30 % en dessous (`FORCE_ZERO = 0,7`) ; moyenne des exercices mesurés. Preuve : 3 exercices mesurés dans l'année.
- **Volume** : 40 % le **tonnage** (poids × répétitions de toutes les séries), 20 % les **séries**, 40 % les **heures de séance**, chacun contre la moyenne de tes 3 meilleures années (échelle 0 à 40 %), annualisé comme la course. Une part sans mesure (pas de carnet cette année-là) ne compte pas.
- **Régularité** : 50 % les **séances par semaine** (3 par semaine = 100) et 50 % la part des **semaines avec au moins une séance**, sur les semaines couvertes de l'année. Preuve : 30 jours de données.
- **Équilibre** : l'**entropie** des séries entre les 6 groupes musculaires (jambes, dos, pectoraux, épaules, bras, tronc), normalisée par ln 6 : 0,5 = 0, 0,95 = 100. Preuve : 30 séries dans l'année.
- Le carnet de force commence au premier import : les années d'avant n'ont ni force ni équilibre prouvés, donc pas de score global (« — »), mais leur volume (heures) et leur régularité restent affichés.
- **Forme par saison** (musculation) : la force semaine par semaine (`forme-force.ts`) : chaque exercice principal donne un point par séance (son meilleur 1RM du jour ÷ son record) ; la force d'une semaine est la moyenne de ces points jusqu'à sa fin, chaque point pesant moitié moins tous les 28 jours ; 100 = ta meilleure semaine, 0 = 30 % en dessous. Peu de séances récentes ramènent la note vers le bas ; après plus de 2 semaines sans séance elle baisse de 5 % par semaine (au plus de moitié) et passe en pointillé. Barres du bas : le **tonnage** de la semaine (en tonnes).

## 7. Niveau global au triathlon et au duathlon (4 nov. 2026)

Même mécanique que la course et la musculation (sections 5 et 6, `piliers-sport.ts`) : une note par pilier, réduite de la part de preuve qui manque, score global seulement si **3 piliers** ont toutes leurs preuves. Code : `native/src/data/bilan/piliers-triathlon.ts`. Les séances du filtre sont celles de la **natation, du vélo et de la course** (un triathlète a presque toutes ses séances dans ces sports, pas dans le type « Triathlon », propre à l'app) ; le duathlon garde le vélo et la course.

- **Natation** (triathlon seulement) : l'allure **médiane** au 100 m des séances de 300 m ou plus de l'année, contre ta meilleure année (100 = ta meilleure, 0 = 25 % plus lent). Preuve : 3 séances de 300 m ou plus dans l'année.
- **Vélo** : le score du niveau global du vélo de l'année (section 4). Sans score cette année-là (moins de 3 piliers mesurés), le pilier n'a pas de preuve.
- **Course** : le score du niveau global de la course de l'année (section 5), même règle.
- **Volume** : 50 % les heures, 25 % les jours actifs, 25 % les **journées multisport** (un jour avec au moins deux disciplines différentes : un enchaînement, ou « brick ») de l'année, contre la moyenne de tes 3 meilleures années (0 à 40 %), ramenés à 365 jours pour l'année en cours et la première (à partir de 30 jours).
- Un triathlète sans natation mesurée a quand même un score avec vélo, course et volume ; un duathlète a 3 piliers et il les faut tous.

## 8. Niveau global à l'Hyrox : 4 piliers (4 nov. 2026)

Même mécanique que les autres sports (`piliers-sport.ts`) : une note par pilier, réduite de la part de preuve qui manque, score global seulement si **3 piliers sur 4** ont toutes leurs preuves. Code : `native/src/data/bilan/hyrox-bilan.ts`. Données : les tests et courses (`hyrox_tests` : 16 segments, 8 runs d'1 km et 8 stations) et les séances de type Hyrox.

- **Temps total** : ton meilleur temps total de l'année contre ton meilleur de **tous les temps** (rapport = record ÷ temps) ; 100 = ton record, 0 = 25 % plus lent (`HYROX_ZERO = 0,75`).
- **Runs** : le temps moyen d'un run (la **médiane** des tests de l'année) contre ton meilleur, même échelle.
- **Stations** : le temps total des stations (médiane des tests de l'année) contre ton meilleur, même échelle.
- **Volume** : 60 % les heures, 25 % les jours actifs de séance Hyrox et 15 % le nombre de tests de l'année, contre la moyenne de tes 3 meilleures années (0 à 40 %), annualisés (à partir de 30 jours couverts).
- **Preuves** : total, runs et stations demandent **2 tests** dans l'année ; le volume demande 30 jours de données.

## 9. Niveau global à la natation : 4 piliers (4 nov. 2026)

Même mécanique que les autres sports (`piliers-sport.ts`) : une note par pilier, réduite de la part de preuve qui manque, score global seulement si **3 piliers sur 4** ont toutes leurs preuves. Code : `native/src/data/bilan/piliers-natation.ts`. Données : la distance et la durée de chaque séance de natation (la piscine n'envoie presque jamais de flux détaillé à Strava : aucune courbe calculée côté serveur).

- **Vitesse** : la moyenne de tes **3 allures au 100 m les plus rapides** de l'année (séances de 300 m ou plus) contre la même mesure dans ta meilleure année ; 100 = ta meilleure année, 0 = 25 % plus lent (`NATATION_ZERO = 0,75`).
- **Endurance** : l'allure **médiane** au 100 m de tes séances de **1 500 m ou plus** de l'année, même échelle.
- **Régularité** : 50 % les séances par semaine (2 par semaine = 100) et 50 % la part des semaines avec au moins une séance, sur les semaines couvertes.
- **Volume** : 50 % les kilomètres, 30 % les heures, 20 % les jours actifs, contre la moyenne de tes 3 meilleures années (0 à 40 %), annualisés (à partir de 30 jours couverts).
- **Preuves** : vitesse et endurance demandent 3 séances (de 300 m ou plus, de 1 500 m ou plus) dans l'année ; régularité et volume 30 jours de données.
- **Records** : pas de flux, donc la « courbe de meilleurs efforts » lit les séances entières : pour chaque distance de séance (300 m, 500 m, 750 m, 1 km, 1,5 km, 2 km … 5 km), ta meilleure allure au 100 m sur une séance d'**au moins** cette distance (`records-natation.ts`) ; une séance de 3 km compte aussi pour 1 km.
- **Forme par saison** : la forme de la musculation (`forme-force.ts`) appliquée à l'allure : chaque séance de 300 m ou plus donne un point (allure record ÷ allure de la séance), mémoire de 28 jours, 100 = ta meilleure semaine ; barres du bas : les kilomètres nagés par semaine.

## Historique

- 2026-11-02 : création, ajout du TSS, du CTL/ATL/TSB, du score d'endurance et d'une proposition de score de puissance.
- 2026-11-02 : TSS aligné sur le code (vrai capteur seulement, cardio seconde par seconde), FTP glissante, série de forme jusqu'à aujourd'hui.
- 2026-11-02 : pilier Puissance sur une échelle plus exigeante (0 à 20 % sous le meilleur).
- 2026-11-03 : pas de score global pour une année où moins de 3 piliers sur 4 sont mesurables (« — » au lieu de 7 à 11 pour les années sans capteur de puissance).
- 2026-11-03 : LTHR déduite des sorties quand le profil n'en a pas : le TSS cardio remplace le TSS tiré des watts estimés (CTL de 2022 : plus gonflé).
- 2026-11-03 : nettoyage serveur : `rpc_piliers_annuels` sans les colonnes de la durabilité et de la fatigue, `fat20` n'est plus calculée.
- 2026-11-03 : FTP glissante : fenêtre de ±90 jours (puis ±180, puis ±365) au lieu de ±45 (puis ±90, puis ±180) : la charge de 2022 n'est plus gonflée par une FTP trop basse.
- 2026-11-03 : les watts estimés par Strava sont retirés de l'app (écartés d'office, rien supprimé en base).
- 2026-11-03 : TSS plausible : jamais plus de 200 points par heure ni d'intensité de plus de 1,5 (106 sorties de 2011-2013 à plus de 1000 TSS réparées).
- 2026-11-03 : capacité de charge : on compte aussi les heures (25 %) et les jours actifs (15 %), annualisés pour l'année en cours ; le CTL moyen fait 60 %.
- 2026-11-03 : capacité de charge : CTL moyen de l'année (au lieu du pic) contre la moyenne des 3 meilleures années (au lieu de la meilleure seule).
- 2026-11-03 : répétabilité jugée sur les 10 meilleures sorties de l'année (le 3e effort le plus fort), plus sur toutes.
- 2026-11-03 : endurance refaite à puissance fixe (F facilité, H coût cardio, C fraîcheur à 2 h 30, D fatigue) : la même puissance en watts pour toutes les années.
- 2026-11-03 : endurance : D et R comparés en watts au meilleur 20 min de tous les temps (plus à celui de l'année).
- 2026-11-03 : endurance mise en code (D sur 20 min après 30 kJ/kg, R sur le meilleur 2 h 30 de l'année, C sur les 10 sorties de plus de 2 h à la plus haute puissance normalisée de l'année) ; durabilité, répétabilité et charge ajoutées au recueil ; CTL/ATL décrits tels que la base les calcule.
- 2026-11-02 : durabilité retirée (pilier et lettre D de l'endurance) ; l'endurance passe à 35 % F, 30 % H, 35 % C ; le niveau global devient la moyenne de 4 piliers.
- 2026-11-04 : niveau global de la course (vitesse, endurance, efficacité, volume) et de la musculation (force, volume, régularité, équilibre) sur le modèle du vélo ; forme par saison de la course (allure à cardio égal) et de la musculation (force) ; courbes de course côté serveur (meilleurs temps par distance, pauses et sauts de GPS écartés).
- 2026-11-04 : Bilan du triathlon et du duathlon (filtre multisport, résumé, rythme, records par discipline, niveau global à 4 piliers) ; allure moyenne au 100 m dans les records de natation.
- 2026-11-04 : Bilan de l'Hyrox (résumé, records par segment, niveau global à 4 piliers, temps total test après test).
- 2026-11-04 : Bilan de la natation (mesures d'allure au 100 m, courbe de meilleurs efforts par distance de séance, niveau global à 4 piliers, forme par saison).
