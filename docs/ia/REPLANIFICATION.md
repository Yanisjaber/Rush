# Replanification : diriger le planning depuis le chat (7 nov. 2026)

Le cœur du coach : l'utilisateur dit une phrase simple (« je me suis blessé au genou, 10 jours », « décale ma sortie de demain à jeudi », « pas de vélo cette semaine »), le coach propose **une carte**, l'utilisateur la valide d'un tap. Rien n'est écrit avant.

## Qui fait quoi

| | Rôle |
|---|---|
| **Le modèle** | Traduit la phrase en contraintes ou en opérations, puis explique le plan. Il ne calcule aucun déplacement. |
| **Le code** (`_shared/planning.ts`) | Calcule le plan avec les mêmes règles que le validateur, vérifie le plan entier, refuse les plans dangereux. |
| **La base** (`coach_appliquer_plan`) | Applique tout en une transaction, avec le jeton de l'utilisateur (RLS). |

## Deux outils pour le modèle

- **`proposer_replanification`** : un imprévu. Contraintes : `indisponibilite` (maladie, blessure, indisponible), `jours_bloques` (voyage, travail), `sports_exclus` (pas de vélo du… au…). Le moteur déplace, remplace ou supprime.
- **`modifier_planning`** : une modification précise, jusqu'à 8 opérations : `deplacer`, `supprimer`, `ajouter`, `indisponibilite`. Les `seance_id` viennent du contexte (`prevues` du résumé, ajoutées dans `rpc_coach_resume`).

## Ce que fait le moteur (`proposerReplanification`)

Chaque séance touchée est :
1. **déplacée** au premier jour libre qui respecte toutes les règles (vers l'avant ; vers l'arrière seulement si ce n'est pas une affaire de santé) ;
2. **remplacée** par une version courte et facile pendant la **semaine de reprise** après une maladie ou une blessure d'au moins 3 jours : retour 1 jour (maladie) ou 2 jours (blessure) après la fin, durée à 70 % (arrêt de moins d'une semaine) ou 50 % (une semaine ou plus), type facile du menu ;
3. **supprimée**, avec la raison, s'il n'y a aucune place dans les 14 jours.

Les séances touchées sont retirées toutes ensemble avant le placement (elles ne se bloquent pas entre elles). Un jour qui a déjà une séance est évité. Le moteur ne crée jamais plus de séances qu'il n'en retire. Les repères de reprise sont des pratiques de terrain (fiche `reprise-apres-arret`), pas des lois, et sont réunis dans `fenetreReprise`.

## Règles de sécurité

- **Règle dure** : un plan qui laisse une séance pendant une période qu'il déclare est refusé.
- Les règles du validateur s'appliquent au nouveau jour : indisponibilité, repos posé, compétition, veille de compétition, jours durs d'affilée, hausse de charge de la semaine, repos de la semaine, horizon de 14 jours.
- **Garde-fou santé** : en « repos », on peut **supprimer** et déclarer une période, mais ni déplacer ni ajouter. En « prudence », pas de séance dure.
- Une carte de planning par message, jamais avec une autre carte.
- Au tap : tout le plan est **revérifié** sur le calendrier d'aujourd'hui ; si quelque chose a changé, la carte est refusée et rien n'est écrit.
- La base ne touche que les séances d'**entraînement** de l'utilisateur (jamais une compétition), refuse de supprimer une séance volumineuse (fichier GPX), et plafonne à 16 opérations.
- **Annuler** défait le plan en une transaction ; ne supprime que ce que le coach a créé ; au mieux (une ligne modifiée à la main depuis est ignorée et comptée).

## Fichiers

- Moteur et vérification : `supabase/functions/_shared/planning.ts` (+ `validerDeplacement` dans `validateur.ts`).
- Outils : `_shared/coach-actions.ts` ; cartes, validation, annulation : `_shared/coach-chat.ts` ; carte `planning` : `_shared/coach-contexte.ts`.
- SQL : `supabase/migrations/2026-11-07_coach_planning.sql` (test : `bash supabase/tests/sql/coach_planning.sh`) et `id` dans `prevues` de `2026-11-06_rpc_coach_resume.sql`.
- Tests : `tests/edge/planning.test.mts`, `coach-chat.test.mts`, `coach-actions.test.mts`.

## La base : planifier simple (8 nov. 2026)

Avant les imprévus, les demandes de tous les jours :

- **Les dates en mots** : le contexte contient `prochains_jours` (15 jours, avec le jour de la semaine, calculés par le code). « Jeudi », « demain », « samedi prochain » se LISENT dans cette table : le modèle ne calcule jamais une date.
- **`planifier_semaine`** (`_shared/semaine.ts`) : « fais-moi ma semaine », « deux sorties vélo et trois footings, pas le mardi ». Le modèle donne les sports, le nombre de séances, les jours sans séance et facile ou non ; le **code** construit la semaine.
  - Jours : bien espacés, jamais un jour indisponible, de repos, de compétition, ou déjà occupé ; au moins un jour de repos par semaine (le réglage de l'utilisateur) ; au plus 6 séances par sport et 10 en tout ; 14 jours maximum.
  - Types : du facile ; **une sortie longue** seulement si l'historique la permet (sa plus longue séance des 28 jours atteint 80 % du minimum du type), placée le **week-end** quand c'est possible ; **une séance de tempo** seulement avec 3 séances ou plus d'un sport et une forme de fond d'au moins 30. Le garde-fou « prudence » ou « facile » demandé = que du facile. La veille d'une compétition : jamais de qualité.
  - Durées : d'après la moyenne de l'utilisateur sur 28 jours dans ce sport (défaut : vélo 60, course 40, natation 30 minutes), arrondies à 5 minutes.
  - Chaque séance passe par le validateur : refusée, elle est raccourcie (85 %, 70 %), puis adoucie, puis **abandonnée avec la raison**, qui est dite à l'utilisateur.
  - Ces repères (seuils, proportions) sont des pratiques de terrain, pas des lois : ils sont réunis en haut de `semaine.ts`.
- **Jours de repos** : l'opération `repos` de `modifier_planning` pose (ou retire) un jour de repos. Règle dure : on ne pose pas un repos un jour où il reste une séance, sauf si le même plan la déplace ou la supprime. SQL : `supabase/migrations/2026-11-08_coach_repos.sql` (annulation comprise : seuls les repos posés par le coach sont retirés).

## Dans l'app (`native/`)

- **La carte de planning** (`src/components/coach/CartePlanningCoach.tsx`) est le mélange 7 + 2 + 3 des maquettes : interrupteur « Aujourd'hui / Avec le plan », calendrier de 3 semaines ou frise de 14 jours (`PlanApercu.tsx`), légende, détail ligne par ligne, puis « Valider le plan » (états : proposée, application en cours, appliquée avec « Annuler le plan » et « Voir au calendrier », refusée avec « Refaire le plan », annulée).
- Un repos s'affiche en toutes lettres (« repos ») dans la case du jour.
- **Ce que l'app dessine** vient des lignes du plan (sport, durée, jour d'origine, jour d'arrivée, période), calculées par `data/coach/apercu-plan.ts` (testé). Elle ne dessine que ce que le plan touche, pas les séances qu'il laisse en place.
- **Actions directes** du coach (`data/coach/actions.ts`) : liste blanche stricte (ouvrir un écran, ouvrir un jour du calendrier, filtrer un sport). Tout le reste est ignoré. « Ouvrir un jour » passe par `stores/jour-demande.ts` et le Calendrier saute au mois et au jour demandés.
- Après un plan appliqué ou défait, le Calendrier se recharge (`ajoutsChanges`).
- **Mode développement seulement** : un appui long sur le titre « Coach » pose une carte de plan d'exemple dans le fil (chaque appui propose la suivante : blessure, semaine, repos) (sans serveur ni modèle) et joue les états Valider et Annuler, pour voir l'écran sans clé Anthropic. Ces cartes (identifiant `exemple-…`) ne partent jamais au serveur.

## Reste à faire

- Voir le plan **réel** de bout en bout (serveur, base, app) : demande une clé Anthropic valide.
- **Écran d'accord de partage** et réglages des seuils (8 maquettes avant le code) : sans accord enregistré, le chat répond « accord requis ».
- Plus d'imprévus : « moins de temps cette semaine » (plafond d'heures), « fatigué » (alléger sans supprimer), compétition qui bouge.
- Valider un plan **partiel** (garder seulement certaines séances de reprise) : demande de revérifier le sous-plan côté serveur.
- Banc d'essai de phrases d'imprévus pour juger la compréhension du modèle.
