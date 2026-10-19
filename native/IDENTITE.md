# Rush — identité de l'app native

Charte de référence pour `native/`. Elle pousse l'identité existante (`app/src/lib/design/tokens.css`) sans la renier.
Décisions du 19 oct : direction **Dossard**, barre du bas **native Apple (Liquid Glass)**, couleurs de sport **conservées**, **nouvelle icône**.

## 1. Le type d'app

App d'entraînement et de récupération **multisport** (course, vélo, natation, muscu, hybride), pas de sports collectifs.
Mobile d'abord, usage quotidien d'une main, souvent en salle ou en sortie (lumière variable, mains occupées).
Accueil = widgets composables selon les sports de l'utilisateur. Sombre par défaut, clair en option (suit le compte).
Ton : sportif et sobre, une app d'athlète, pas un réseau social ni un tableau de bord d'entreprise.

## 2. Principe central

> **La couleur désigne le sport, jamais le profil ni la décoration.**

Un écran, un widget ou un graphe lié à un sport utilise la couleur de CE sport, partout, tout le temps.
Tout le reste (fonds, textes, traits) est neutre, pour que la couleur de sport soit toujours un signal.

## 3. Signature visuelle : le dossard

Le dossard est un bloc clair avec quatre points d'attache. Il porte **la donnée héros** d'un écran ou d'un widget (une distance, un temps, une charge).

- Fond : `dossardFond` (clair en thème sombre, inversé en thème clair). Texte : `dossardTexte`.
- Rayon : 6 px. Pas d'ombre portée (le contraste du fond suffit).
- **Quatre points d'attache** : cercles de 8 px, couleur du fond de page (ils « percent » le dossard), à 10 px de chaque coin.
- **Liseré de sport** : bande de 4 px collée en haut, couleur du sport concerné. Sans sport (ex. Sommeil) : `sportNeutre`.
- Contenu : étiquette en micro-capitales en haut, chiffre héros en Bricolage 800 (`display`), unité en `petit`.
- Règle d'usage : **un dossard par widget au maximum**, et jamais de dossard dans un dossard. Le reste de l'écran reste plat.

## 4. Couleurs

Valeurs dans `src/theme/couleurs.ts` (copie de `tokens.css`). Contrastes mesurés (WCAG, ratio texte/fond) :

| Sport | Sombre : sur fond / sur surface | Clair : sur fond / sur blanc | Texte sur l'aplat |
|---|---|---|---|
| Course `#ff7a33` / `#e85d0c` | 7,5 / 7,0 | 3,2 / 3,5 | 7,5 (sombre), 6,0 (clair) |
| Vélo `#4f8cff` / `#2f6fe8` | 6,0 / 5,6 | 4,2 / 4,6 | 6,0 / 4,6 |
| Natation `#22d3ee` / `#0788a0` | 10,8 / 10,0 | 3,8 / 4,2 | 10,8 / 5,0 |
| Muscu `#ff5a4f` / `#e63b30` | 6,3 / 5,9 | 3,8 / 4,2 | 6,3 / 5,0 |
| Hybride `#ffd60a` / `#c99a00` | 13,8 / 12,8 | **2,4 / 2,6** | 13,8 / 8,1 |

Texte courant : `texte` 17:1, `texteDoux` 7,5:1, `texteMuet` 5,8:1 (sombre) et 4,9:1 (clair). Tous passent AA (4,5:1).

**Deux règles issues de cette mesure :**
1. **Thème clair : jamais la couleur de sport en petit texte.** Course, natation, muscu et hybride restent sous 4,5:1 sur le fond clair. On les réserve aux aplats, liserés, graphes et gros chiffres (≥ 24 px, seuil 3:1). Pour un texte coloré en clair, on utilise `sportHybrideTexte` (hybride) ou on écrit en `texte` avec un repère de couleur à côté.
2. **Traits d'interface** (`trait` / `traitFort`) : 1,5 à 1,9:1, donc **décoratifs seulement**. Les contours de champs de saisie et de boutons doivent atteindre 3:1 : on ajoute un jeton `contourChamp` (sombre `#6b7280`, clair `#7a7f8a`, à valider à l'écran) au moment de faire les formulaires.

États : `ok`, `alerte`, `danger` ne se lisent **jamais seuls** : toujours accompagnés d'une icône ou d'un mot (daltonisme).

## 5. Typographie

| Rôle | Police | Graisse |
|---|---|---|
| Titres, chiffres héros, étiquettes de dossard | **Bricolage Grotesque** | 600, 700, 800 |
| Texte courant, boutons, formulaires | **Instrument Sans** | 400, 500, 600 |

Échelle (taille / interligne, en pt). Minimum absolu : 12 pt. Chiffres de données en `tabular-nums` pour que les colonnes s'alignent.

| Nom | Police | Taille / interligne | Graisse | Usage |
|---|---|---|---|---|
| `display` | Bricolage | 56 / 56 | 800 | chiffre héros du dossard |
| `titre1` | Bricolage | 32 / 36 | 700 | titre d'écran |
| `titre2` | Bricolage | 24 / 28 | 700 | titre de section, gros chiffres |
| `titre3` | Bricolage | 18 / 22 | 600 | titre de widget |
| `corps` | Instrument | 16 / 24 | 400 | texte |
| `corpsFort` | Instrument | 16 / 24 | 600 | boutons, valeurs |
| `petit` | Instrument | 14 / 20 | 400 | légendes, unités |
| `micro` | Instrument | 12 / 16 | 600, capitales, +0,08 em | étiquettes (dossard, axes) |

Les polices sont embarquées dans l'app (aucun appel à Google). Le texte suit la taille de police système (accessibilité), avec un plafond de 1,3× sur les chiffres héros pour ne pas casser les dossards.

## 6. Forme, espacement, toucher

- Espacement : échelle de 4 (`e1` 4 → `e7` 48), marges d'écran `e4` (16).
- Rayons : 5 / 6 / 8 px, **jamais plus** (sauf pastilles rondes). Pas de cartes très arrondies avec ombre douce.
- Hiérarchie par **surface et trait fin** (`surface`, `surface2`, `trait`), pas par ombres.
- Cible tactile : **44 pt minimum**, 8 pt d'écart entre cibles voisines.
- Zone de sécurité (encoche, barre d'accueil) respectée partout.

## 7. Navigation

- Barre du bas **native iOS (Liquid Glass)** : cinq onglets comme sur le web : **Accueil, Calendrier, Bilan, Santé, Paramètres**. Le Plan s'ouvre depuis le Calendrier.
- Teinte active = couleur du sport actif (sinon `texte`). Icônes = symboles système SF Symbols sur iOS (une dépendance à valider au moment de la barre).
- En-têtes d'écran sobres : titre en `titre1`, pas de dégradé ni d'image décorative.
- Android : même structure, Material (barre d'onglets système).

## 8. Mouvement et retours

- Animations 150–250 ms, courbe douce, **jamais de rebond gadget**. Elles servent à situer (apparition d'un widget, glisser en mode édition), pas à décorer.
- Respect de « Réduire les animations » du système : on remplace par un fondu.
- Retour tactile (vibration légère) réservé aux actions qui comptent : valider une séance, finir une série.

## 9. Icône de l'app

Fichiers : `assets/icone/icone-rush.svg` (source), `icone-rush-1024.png` (export pour les stores, RVB sans canal alpha), `icone-courbe-sports-monochrome.svg` (variante une couleur).

- Fond `#0c0d10`, plein cadre, sans transparence (exigence de l'App Store). Carré 1024×1024, les coins sont arrondis par le système.
- Au centre, une **courbe de charge en dents de scie** : cinq segments, un par sport, dans l'ordre course `#ff7a33`, vélo `#4f8cff`, natation `#22d3ee`, muscu `#ff5a4f`, hybride `#ffd60a`. Elle met l'idée centrale de l'app en image : la couleur désigne le sport.
- Chaque segment est un polygone ; les jonctions suivent la bissectrice de l'angle (coupure nette, pas de biais).
- Derrière, quatorze fines traînées horizontales `#272b35` de longueurs variées (impression de mouvement). Elles restent derrière la courbe et ne portent aucune information.
- Variante monochrome (icône teintée d'iOS, icône thématique d'Android) : la courbe seule, en blanc sur noir, sans traînées.
- Écran de démarrage : fond `fond`, la courbe seule, rien d'autre.
- Le dossard reste la signature **dans l'app** (§3), pas dans l'icône.

## 10. Interdits (rappel du CLAUDE.md)

Dégradés violet/bleu, cartes arrondies toutes identiques avec ombre douce, emojis décoratifs, hero centré générique, palette « SaaS », couleur utilisée comme décoration au lieu de désigner un sport.

## 11. Accessibilité (non négociable)

Contraste AA vérifié (§4) ; cibles 44 pt ; chaque élément interactif a un libellé lu par VoiceOver ; ordre de lecture logique ; rien n'est porté par la couleur seule ; tailles dynamiques supportées ; mouvement réduit respecté.
