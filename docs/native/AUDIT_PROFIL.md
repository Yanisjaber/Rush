# Audit de la partie Profil (12 nov. 2026)

État au moment de l'audit : `npm run typecheck` OK, `npm test` 994/994. Tout le chantier avatar 3D est **non commité**, rien n'est poussé. Rien n'a été vérifié visuellement dans le simulateur.

## À régler

1. **Plus aucun moyen de modifier l'identité ni la photo.** `app/parametres/profil.tsx` n'affiche plus que l'avatar 3D. `FormulaireSection id="identite"` (prénom, nom, poids, date de naissance) et `PhotoProfil` ne sont plus utilisés nulle part. Le poids sert pourtant aux calculs (W/kg). Piste : un bouton « Modifier » sur le profil, ou une ligne « Identité » dans Paramètres (nouvel aspect d'écran, donc 8 maquettes d'abord).
2. **Code non branché.** `CarteBilanAthlete`, `RadarAthlete`, `src/data/reglages/bilan-athlete.ts` (sans aucun test) et `ModeleAthlete3D` (449 lignes) ne sont sur aucun écran. À garder si la carte bilan revient, sinon environ 800 lignes à supprimer (accord de Yanis requis avant toute suppression).
3. **Champs retirés de `SECTIONS`** (`pace_5k`, `pace_10k`, `pace_half`, `pace_marathon`, `swim_level`, `swim_100/400/1500/3800`, `last_ftp_test`, `ftp_test_type`, `pmax`, `hrmax_method`, `cardiac_drift`). Les valeurs déjà saisies restent dans `extras`, aucune autre lecture dans `native/` (les `pmax` restants viennent des mesures de séance). Mais elles ne sont plus visibles ni corrigibles. **Décision de Yanis (12 nov.) : retrait temporaire, on les remettra plus tard.**

## Fragile

4. **Deux modèles 3D embarqués** : `athlete.glb` (utilisé) et `athlete.bin` (lu seulement par `format-athlete.ts` et ses tests). `ModeleAthleteRealiste.tsx` remplace temporairement `TextureLoader.prototype.load` et `globalThis.createImageBitmap` (remis dans un `finally`) : deux chargements simultanés peuvent s'écraser. Très dépendant des versions d'Expo et de three.
5. **Nouvelles dépendances** `expo-gl`, `expo-three`, `three`, `@types/three` : nouveau build natif nécessaire. Versions exactes, mais l'ancienneté de plus de deux semaines n'est pas vérifiée.
6. **Écran Profil** : plus de titre natif, bouton Retour dessiné à la main, fond transparent sur `FondDegrade`. Contraste et rendu en clair/sombre à vérifier.
7. **`onContextCreate` dépend de `accent` et `palette.fond`** : un changement de thème peut relancer tout le chargement (jusqu'à 12 s par étape). Mieux : garder le contexte et ne mettre à jour que les couleurs.

## Détails

8. `data/avatar/ancrages.ts` doit rester identique à la caméra du composant : vérifié à la main seulement.
9. `metro.config.js` et `plugins/withExpoGlAndroidR8.js` : propres, aucun secret.

## Solide

- Photo : bucket privé, lien signé d'une heure, 2 Mo maximum, chemin lié à l'id du compte (RLS).
- Le store `avatar` vérifie le changement de compte : jamais la photo d'un autre.
- `versPayload` conserve les `extras` existants.
- Nettoyage du rendu 3D correct (animation, géométrie, textures, renderer).

## À tester dans le simulateur

Écran Profil sur un vrai build (Expo Go ne suffit pas pour `expo-gl`), en sombre et en clair, avec le retour arrière.
