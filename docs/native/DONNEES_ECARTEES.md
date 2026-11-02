# Données écartées d'une activité

Sur l'écran d'une activité, le bloc **« Compte dans mes calculs »** (maquette 3 de `claude.ai/artifact/Nth5tKUEcoxCC4Y6rAmBTT`, choisie par Yanis le 2 nov. 2026) propose une puce par donnée que l'activité a. Une puce cochée (✓) compte partout ; une puce touchée devient grise et barrée : la donnée est **écartée de tous les calculs**. Les chiffres restent en base et sur l'écran (barrés, avec « écartée ») : on peut les remettre à tout moment. Ça marche pour les activités Strava comme pour celles saisies à la main (la synchro Strava ne touche pas aux colonnes `excl_*`).

Code : `native/src/data/calendrier/donnees-ecartees.ts` (liste des données, masque, règle de la charge), `native/src/components/ui/PucesEcart.tsx` (les puces), `native/app/seance.tsx`, `native/src/hooks/useSeance.ts` (la bascule), `native/src/stores/ecarts.ts` (fait relire les écrans). Base : `supabase/migrations/2026-11-02_donnees_ecartees.sql` et `2026-11-02_duree_ecartable.sql`. Tests : `native/tests/calendrier/donnees-ecartees.test.ts`, `supabase/tests/sql/donnees_ecartees.sh`.

## Les 7 données

| Puce | Colonne de `activities` | Ce qui n'entre plus dans les calculs |
|---|---|---|
| Durée | `excl_duration` | le temps de l'activité : minutes et heures des totaux (calendrier, bilan, volume), records de durée, vitesse et allure ; l'activité sort aussi des progressions (qui demandent une durée minimale) ; et la charge, puisque toute charge se calcule avec la durée |
| Puissance | `excl_power` | watts moyens et normalisés, pointe, énergie (kJ), courbe de puissance, records, forme, niveau global (pointes, durabilité, répétabilité, 2 h / 3 h, dérive, nombre de sorties avec capteur), courbe de couple, et la charge si elle vient de la puissance |
| Cardio | `excl_hr` | cardio moyen et max, courbe de cardio, forme (watts à cardio égal), dérive, progression course, et la charge si elle vient du cardio |
| Cadence | `excl_cadence` | cadence moyenne, courbe de cadence et de couple |
| Distance | `excl_distance` | distance, vitesse, allure, totaux, records, courbe de vitesse, progression course |
| Dénivelé | `excl_elevation` | D+ (totaux, records), courbes de montée et de descente, correction de l'allure en course (la course est alors écartée de la progression) |
| Charge | `excl_load` | la charge (TSS) ne compte plus dans la forme et la fatigue, quelle que soit son origine |

Une puce n'apparaît que si l'activité a la donnée (pas de puce Puissance sur une course sans capteur), ou si elle est déjà écartée (pour pouvoir la remettre). La durée est écartable quand un chrono a menti (une pause oubliée, un compteur resté allumé) : l'activité reste dans le calendrier, mais son temps ne compte plus nulle part.

## La charge

La charge (TSS) d'une activité vient de la puissance si elle en a, sinon du cardio, sinon de l'effort ressenti. Écarter la puissance retire donc la charge d'une activité qui en a ; écarter le cardio retire celle d'une activité sans puissance qui a du cardio ; écarter la durée ou « Charge » la retire toujours. On ne la recalcule pas avec une autre source : elle ne compte plus, c'est tout. Même règle en SQL (`tss_retenu`, utilisée par `recalc_daily_metrics`, que le déclencheur relance à chaque modification d'activité) et dans l'app (`chargeRetenue`).

## Comment les calculs ne voient plus la donnée

- **Base** : `recalc_daily_metrics` (charge, forme, fatigue, minutes du jour), `rpc_piliers_annuels` (niveau global), `rpc_courbe_puissance`, `rpc_courbe_signal` et `rpc_sorties_velo` (records) ignorent ce qui est écarté.
- **App** : les listes de séances (calendrier, accueil, historique de progression, bilan) passent par `sansDonneesEcarteesTout`, qui vide la donnée écartée (la séance d'origine n'est pas modifiée). Seul l'écran de l'activité lit la séance entière.
- **Mise à jour** : quand on écarte ou remet une donnée, `ecartsChanges()` vide les caches (records, niveau global, courbes) et fait relire le calendrier, l'accueil, le bilan, la progression et les métriques.

## Démo

En démo, la bascule change l'écran le temps de la visite, sans rien écrire ni changer les autres écrans.
