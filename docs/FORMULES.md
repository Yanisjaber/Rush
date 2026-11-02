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

**2. Cardio** (sinon, y compris pour la course, le vélo électrique et les watts estimés) :

```
TSS = 100 × hr_sq / ( LTHR² × 3600 )      // seconde par seconde : moyenne de (FC / LTHR)² × heures × 100
```

- `hr_sq` = somme des carrés des fréquences cardiaques, seconde par seconde, et `hr_s` = nombre de secondes avec un cardio (`supabase/functions/_shared/cardio.ts`, rangés dans `power_curve`). Seules les FC entre 40 et 230 comptent.
- Utilisé quand le flux cardio couvre **au moins 80 %** de la sortie. Sinon : `TSS = durée_h × (FC moyenne / LTHR)² × 100`.
- `LTHR` : celle du profil, sinon 92 % de la FC max. Pourquoi seconde par seconde : la moyenne des carrés est plus grande que le carré de la moyenne, une sortie par intervalles paraissait trop facile avec la FC moyenne.

**3. Sans rien** (affichage dans l'app, `chargeSeance` dans `native/src/data/bilan/synthese.ts`) : TSS enregistré s'il existe, sinon `durée_h × 45` si la FC moyenne est connue, sinon `durée_h × 35`. Estimation grossière, arrondie.

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
FTP d'une sortie = 95 % × meilleur 20 min (clé '1200' de power_curve) des sorties à vrai capteur situées dans les 45 jours avant ET après elle
```

- Si la fenêtre ne contient aucun 20 min, elle s'élargit à ±90 puis ±180 jours. Sans rien, la sortie garde sa FTP d'avant.
- Sur les **90 derniers jours**, la FTP saisie dans le profil (`user_profiles.ftp`) l'emporte sur l'estimation.
- Ignorés pour estimer : watts estimés par Strava, puissances écartées, étapes fusionnées, sports qui ne sont pas du vélo, vélo électrique.
- Seules les sorties vélo avec vrai capteur et NP voient leur `ftp_at_time` et leur TSS mis à jour.
- Le **widget FTP** de l'app trace la dernière FTP de chaque semaine (sorties avec capteur seulement, 26 semaines) ; « aujourd'hui » est la FTP du profil si elle est renseignée.

---

## 4. Niveau global à vélo : 5 piliers, notés de 0 à 100

Code : `native/src/data/bilan/piliers-niveau.ts`. Les mesures par année viennent de la fonction SQL `rpc_piliers_annuels` ; les notes sont calculées dans l'app. **Score global = moyenne des 5 piliers**, arrondie.

**Échelles** (une note linéaire entre deux bornes, bornée à 0 et 100) :

| Échelle | 0 | 100 | Sert pour |
|---|---|---|---|
| `noteDe` | 70 % du meilleur | le meilleur | durabilité, régularité de la répétabilité, niveau par année, records |
| puissance | 80 % du meilleur | le meilleur | pilier Puissance (plus exigeante) |
| hauteur | 50 % du record | le record | hauteur des efforts répétés |
| charge | 40 % de la meilleure année | la meilleure année | pilier Capacité de charge (plus douce) |

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
D = clamp( (ratio_dur − 0,85) / (0,97 − 0,85), 0, 1 )             // puissance après fatigue

Endurance = 100 × ( 0,30·F + 0,25·H + 0,30·C + 0,15·D )
```

| Ingrédient | Définition |
|---|---|
| `FTP_année` | `0,95 × meilleur 20 min de l'année`. |
| Sorties de référence | Plus de 2 h (durée non écartée), puissance (normalisée, sinon moyenne) à **±10 %** de `P_ref`. On garde les **10 plus récentes** de l'année (celles qui ont une FC moyenne pour `FC_ref`, celles qui ont un `drift` pour le découplage). |
| `FC_ref` | **Médiane** de la FC moyenne des sorties de référence. `FC_min` = la plus basse `FC_ref` de toutes les années (années à ≥ 3 sorties de référence avec FC). Pas de % de LTHR : le profil n'en a pas toujours. |
| `drift` | `(EF_1ère_moitié − EF_2ème_moitié) / EF_1ère_moitié × 100`, avec `EF = puissance normalisée / FC moyenne`, échauffement de 10 min mis à part (`_shared/derive.ts`). **Médiane** sur les sorties de référence. Une 2e moitié plus efficace (drift négatif) est plafonnée à 1. |
| `ratio_dur` | `meilleur 20 min après fatigue (de l'année) / meilleur 20 min frais de TOUS LES TEMPS`. « Après fatigue » = une fois **30 kJ/kg** de travail cumulé (2100 kJ pour 70 kg ; poids du profil, 70 kg si absent), calculé seconde par seconde ; la fenêtre démarre après ce seuil (`_shared/fatigue.ts`, clé `fat20`). On compare en watts : un bon ratio sur une année plus faible ne rapporte rien. |

Poids : facilité (F) 30 %, fraîcheur (C) 30 %, coût cardio (H) 25 %, fatigue (D) 15 %.

Preuves : chaque lettre demande 3 sorties (3 sorties de référence avec FC, 3 avec découplage, 3 après fatigue, 3 avec capteur pour la FTP de l'année) et vaut au prorata si moins. Une lettre sans mesure vaut 0, et sa part de preuve aussi.

Exemple (compte de test, `P_ref` = 174 W) : 174 W vaut 82 % de la FTP en 2019, 70 % en 2026 ; FC moyenne à 174 W : 143 bpm en 2019, 127 en 2026 → endurance ≈ 42 en 2019, ≈ 87 en 2026.

Cas limites :
- Peu de sorties de référence une année (par exemple 5 en 2022) : la note est réduite d'autant (preuve).
- `FC_ref` se compare aux autres années du même compte : avec une seule année, H vaut 100 par définition.
- Le découplage dépend de la FC : sans sangle cardio propre, C et H valent peu (le cardio écarté par l'utilisateur retire la FC et le `drift` de la sortie).
- Les clés `fat20` et `drift` s'écrivent à l'import (`strava-streams`, version des courbes 8) ; les anciennes sorties les reçoivent au recalcul des courbes (écran Synchro).

Les bornes sont des estimations, pas une norme scientifique : à recaler sur de vraies sorties.

### 4.3 Durabilité

```
ratio = moyenne( meilleur 5 min tardif ÷ meilleur 5 min de l'année ; meilleur 20 min tardif ÷ meilleur 20 min de l'année )
Durabilité = noteDe( min(1, ratio) ) × preuve
```

- « Tardif » : la fenêtre démarre **après 2 h 30** de sortie (clés `late_300`, `late_1200`). 100 = aucune perte, 0 = 30 % de perte.
- Preuve : `sorties longues de l'année ÷ 3`.

### 4.4 Répétabilité

Sur les sorties qui ont **trois vrais efforts de 5 min** (le 3e effort vaut au moins 50 % de ton meilleur 5 min de tous les temps) :

```
régularité = noteDe( min(1, 3e effort ÷ 1er effort) )                    // médiane des sorties de l'année
hauteur    = noteLinéaire( 3e effort médian ÷ meilleur 5 min de toujours ; 0,50 → 0 ; 1,00 → 100 )
Répétabilité = moyenne( régularité ; hauteur ) × preuve
```

- Sans la hauteur (base pas à jour), la régularité fait seule la note. Preuve : `sorties valides ÷ 3`.

### 4.5 Capacité de charge

```
Charge = noteLinéaire( CTL max de l'année ÷ meilleur CTL max ; 0,40 → 0 ; 1,00 → 100 )
```

- Preuve : 1 dès que l'année a une charge. Plus douce que les autres : la charge est une quantité d'entraînement, pas un niveau de performance.

---

## Historique

- 2026-11-02 : création, ajout du TSS, du CTL/ATL/TSB, du score d'endurance et d'une proposition de score de puissance.
- 2026-11-02 : TSS aligné sur le code (vrai capteur seulement, cardio seconde par seconde), FTP glissante, série de forme jusqu'à aujourd'hui.
- 2026-11-02 : pilier Puissance sur une échelle plus exigeante (0 à 20 % sous le meilleur).
- 2026-11-03 : endurance refaite à puissance fixe (F facilité, H coût cardio, C fraîcheur à 2 h 30, D fatigue) : la même puissance en watts pour toutes les années.
- 2026-11-03 : endurance : D et R comparés en watts au meilleur 20 min de tous les temps (plus à celui de l'année).
- 2026-11-03 : endurance mise en code (D sur 20 min après 30 kJ/kg, R sur le meilleur 2 h 30 de l'année, C sur les 10 sorties de plus de 2 h à la plus haute puissance normalisée de l'année) ; durabilité, répétabilité et charge ajoutées au recueil ; CTL/ATL décrits tels que la base les calcule.
