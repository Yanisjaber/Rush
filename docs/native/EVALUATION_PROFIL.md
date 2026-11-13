# Évaluation physiologique (page Profil)

La page Profil est une « planche anatomique » : le mannequin 3D, une règle de hauteur, 8 points numérotés (un par domaine) et leur note, puis le détail de chaque domaine.

- Calcul : `native/src/data/profil/evaluation.ts` (pur, testé dans `native/tests/profil/evaluation.test.ts`).
- Repères et références : `native/src/data/profil/reperes.ts`.
- Données : `native/src/hooks/useEvaluation.ts` (profil, séances, courbes vélo et course de l'année en cours et de la précédente, nuits, mesures de santé).
- Écran : `native/app/parametres/profil.tsx`, `native/src/components/profil/PlancheAnatomique.tsx`, `DetailDomaine.tsx`.

## La règle

- **Note d'un repère** : 100 = le meilleur mondial du même sexe, 0 = 0. Règle de trois : `valeur ÷ référence × 100` (ou `référence ÷ valeur × 100` quand plus bas est mieux), bornée à 0-100.
- **Note d'un domaine** : moyenne des repères qui ont une valeur. Un repère sans valeur ne compte pas (il ne fait pas baisser la note).
- **Niveau global** : moyenne des domaines notés, pondérée : performance ×2 (cardio, endurance, puissance, explosivité, force, endurance musculaire), composition et récupération ×1.
- **Sexe** : `extras.sex` ('M' / 'F'). Non renseigné (ou « Autre ») : comparé aux références hommes, et la page le dit.

## D'où viennent les valeurs (par ordre de priorité)

| Provenance | Exemples |
|---|---|
| tes séances | FTP = 95 % de la meilleure puissance 20 min ; PMA = 5 min ; CP et W' = droite travail/temps sur 3-20 min ; VMA = meilleure vitesse 6 min ; vitesse 1 h ; natation = séance d'au moins 1 km la plus rapide ; régularité = jours actifs sur 28 j |
| ta montre | FC de repos et HRV = médiane des nuits des 30 derniers jours ; sommeil moyen 30 j ; tendance HRV 7 j / 60 j (au moins 14 nuits) |
| saisi | tests physiques (famille « Tests physiques » de l'onglet Santé, clés `test_*`), masse grasse, tour de taille, masse musculaire, et les repères de Physiologie (FTP, VMA, FC repos, CSS…) quand les séances n'en donnent pas |
| estimé | VO2max = max(10,8 × PMA en W/kg + 7, 3,5 × VMA) ; 1RM = formule d'Epley sur le carnet de musculation (1 à 12 répétitions, 2 dernières années) |

Les valeurs en W/kg ou × poids utilisent la dernière pesée de moins de 90 jours, sinon le poids du profil.

## Références

Seules deux références sont **vérifiées** sur une source primaire (VO2max, record de l'heure). Toutes les autres sont des ordres de grandeur **à confirmer** : la page l'affiche à côté de chaque repère. À sourcer en priorité : FC de repos femme, HRV, seuils ventilatoires, table de Coggan (5 s, 1 min, 5 min), force relative.

### Cardio-respiratoire (poids 2)

| Repère | Unité | Sens | 100 homme | 100 femme | Référence | Source | Statut |
|---|---|---|---|---|---|---|---|
| VO2max | ml/kg/min | ↑ | 97.5 | 78.6 | O. Svendsen / J. Benoit | topendsports.com, records de VO2max mesurés | vérifiée |
| FC au repos | bpm | ↓ | 28 | 32 | M. Induráin (28 bpm rapportés) | Polar, BikeRadar ; valeur femme non trouvée | à confirmer |
| HRV (rMSSD) | ms | ↑ | 150 | 150 | Ordre de grandeur d'athlètes d'endurance élites | à sourcer | à confirmer |
| Récupération cardiaque (1 min) | bpm | ↑ | 60 | 60 | Ordre de grandeur d'athlètes d'endurance élites | à sourcer | à confirmer |
| Seuil ventilatoire 1 | % VO2max | ↑ | 80 | 80 | Athlètes élites (SV1 vers 75-80 %) | à sourcer | à confirmer |
| Seuil ventilatoire 2 | % VO2max | ↑ | 92 | 92 | Athlètes élites (SV2 vers 88-92 %) | à sourcer | à confirmer |

### Endurance (poids 2)

| Repère | Unité | Sens | 100 homme | 100 femme | Référence | Source | Statut |
|---|---|---|---|---|---|---|---|
| FTP | W/kg | ↑ | 7 | 5.7 | T. Pogačar (~7 W/kg sur 40 min, 2024) / Coggan « world class » | BikeRadar 2024 ; table de Coggan (reprise par Rouvy) | à confirmer |
| Puissance critique | W/kg | ↑ | 7 | 5.7 | Même référence que la FTP | voir FTP | à confirmer |
| Vitesse sur 1 h (course) | km/h | ↑ | 21.33 | 18.93 | Record de l’heure : M. Farah 21 330 m / S. Hassan 18 930 m (2020) | World Athletics | vérifiée |
| Seuil en % de la FC max | % | ↑ | 93 | 93 | Athlètes élites (seuil vers 90-93 % de la FC max) | à sourcer | à confirmer |
| Allure natation (séance de 1 km et plus) | km/h | ↑ | 6.2 | 5.87 | Record du 1 500 m : B. Wiffen 14:30.67 / K. Ledecky 15:20.48 | World Aquatics | à confirmer |
| Durabilité (bientôt) | % | ↑ | 100 | 100 | Aucune perte de puissance après 2 h | à sourcer | à confirmer |

### Puissance et vitesse (poids 2)

| Repère | Unité | Sens | 100 homme | 100 femme | Référence | Source | Statut |
|---|---|---|---|---|---|---|---|
| PMA (5 min) | W/kg | ↑ | 7.6 | 6.61 | Table de Coggan, « world class » 5 min | Coggan & Allen, Training and Racing with a Power Meter | à confirmer |
| VMA | km/h | ↑ | 24.7 | 22.2 | Record du 3 000 m : J. Ingebrigtsen 7:17.55 / Wang Junxia 8:06.11 | World Athletics | à confirmer |
| Sprint 5 s | W/kg | ↑ | 24 | 19.4 | Table de Coggan, « world class » 5 s | Coggan & Allen | à confirmer |
| Puissance 1 min | W/kg | ↑ | 11.5 | 9.3 | Table de Coggan, « world class » 1 min | Coggan & Allen | à confirmer |
| W’ (réserve anaérobie) | kJ | ↑ | 35 | 25 | Ordre de grandeur de coureurs élites | à sourcer | à confirmer |
| Sprint 30 m | s | ↓ | 3.7 | 4.1 | Sprinteurs mondiaux (passage aux 30 m) | à sourcer | à confirmer |
| 100 m nage libre | s | ↓ | 46.4 | 51.71 | Records du monde : Pan Zhanle 46.40 / S. Sjöström 51.71 | World Aquatics | à confirmer |

### Explosivité (poids 2)

| Repère | Unité | Sens | 100 homme | 100 femme | Référence | Source | Statut |
|---|---|---|---|---|---|---|---|
| Saut vertical (CMJ) | cm | ↑ | 75 | 55 | Athlètes de sports explosifs de haut niveau | à sourcer | à confirmer |
| Saut en longueur sans élan | cm | ↑ | 371 | 300 | A. Tvervaag 3,71 m (1968) ; valeur femme non trouvée | topendsports.com | à confirmer |

### Force (poids 2)

| Repère | Unité | Sens | 100 homme | 100 femme | Référence | Source | Statut |
|---|---|---|---|---|---|---|---|
| Squat (1RM / poids) | × poids | ↑ | 3.5 | 2.8 | Haltérophiles et powerlifters de haut niveau | à sourcer | à confirmer |
| Développé couché (1RM / poids) | × poids | ↑ | 2.3 | 1.4 | Powerlifters de haut niveau | à sourcer | à confirmer |
| Soulevé de terre (1RM / poids) | × poids | ↑ | 4 | 3 | Powerlifters de haut niveau | à sourcer | à confirmer |
| Développé militaire (1RM / poids) | × poids | ↑ | 1.4 | 0.9 | Athlètes de force de haut niveau | à sourcer | à confirmer |
| Tractions (max) | rép. | ↑ | 40 | 20 | Gymnastes et grimpeurs de haut niveau | à sourcer | à confirmer |
| Pompes (max) | rép. | ↑ | 100 | 60 | Ordre de grandeur de très haut niveau | à sourcer | à confirmer |
| Force de préhension | kg | ↑ | 80 | 50 | Athlètes de force de haut niveau | à sourcer | à confirmer |

### Endurance musculaire (poids 2)

| Repère | Unité | Sens | 100 homme | 100 femme | Référence | Source | Statut |
|---|---|---|---|---|---|---|---|
| Gainage (planche) | s | ↑ | 600 | 600 | Plafond fixé à 10 min (les records du monde durent des heures) | choix Rush | à confirmer |
| Squats en 1 min | rép. | ↑ | 60 | 55 | Ordre de grandeur de très haut niveau | à sourcer | à confirmer |

### Composition corporelle (poids 1)

| Repère | Unité | Sens | 100 homme | 100 femme | Référence | Source | Statut |
|---|---|---|---|---|---|---|---|
| Masse grasse | % | ↓ | 6 | 14 | Athlètes d’endurance élites | à sourcer | à confirmer |
| Tour de taille / taille | — | ↓ | 0.4 | 0.4 | Athlètes élites (rapport taille / hauteur vers 0,40) | à sourcer | à confirmer |
| Part de muscle | % | ↑ | 50 | 42 | Athlètes élites | à sourcer | à confirmer |

### Récupération (poids 1)

| Repère | Unité | Sens | 100 homme | 100 femme | Référence | Source | Statut |
|---|---|---|---|---|---|---|---|
| Sommeil moyen (30 j) | h | ↑ | 9 | 9 | Recommandation pour les athlètes : 8 à 10 h | à sourcer | à confirmer |
| Tendance HRV (7 j / 60 j) | % | ↑ | 110 | 110 | Méthode Rush : 10 % au-dessus de ta référence = 100 | choix Rush | à confirmer |
| Régularité (28 j) | jours | ↑ | 24 | 24 | Pros : 6 jours d’entraînement par semaine | à sourcer | à confirmer |

## Pour plus tard

- Classement entre utilisateurs (même règle, même références).
- Durabilité (perte de puissance après 2 h) : demande les flux des longues sorties.
- FC de repos, HRV et VO2max de la montre via Apple Santé.
