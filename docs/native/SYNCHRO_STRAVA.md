# Synchro Strava : l'import des flux et des courbes

Écran : Réglages › Connexions › « Flux et courbes des sorties » (`native/app/(onglets)/parametres/synchro.tsx`). Logique : `native/src/hooks/useSynchroStrava.ts`, durées dans `native/src/data/synchro/estimation.ts` (tests : `native/tests/synchro/estimation.test.ts`), accès aux données `native/src/data/acces/api/synchro.ts`. Serveur : Edge Function `strava-streams`.

## Pourquoi cet écran

Importer une sortie depuis Strava ne donne que son résumé (durée, cardio, watts moyens). Les **courbes** (puissance : meilleur 5 s, 5, 20, 60 min, durabilité, répétabilité ; vitesse, cardio…) demandent le flux seconde par seconde, une demande à Strava **par sortie**. Avant cet écran, ce calcul ne partait que depuis le site (gelé) : un compte connecté à Strava ne l'avait jamais, et le niveau global du vélo restait à 2 piliers sur 5.

## Ce qui est importé

**Toutes les sorties** du compte, avec ou sans capteur de puissance (décision de Yanis : on importe tout, même la vitesse). Chaque sortie reçoit son flux seconde par seconde (watts, cardio, cadence, altitude, distance, vitesse) et ses courbes. Les plus récentes d'abord. Une sortie sans watts n'aura pas de courbe de puissance, mais ses autres courbes (vitesse, cardio…) sont calculées. La fonction accepte aussi `puissance_seulement: true` (seulement les sorties avec capteur, `device_watts`) ; l'app ne s'en sert plus.

**Place dans la base :** un flux pèse environ 68 Ko compressé. 2 810 sorties de plus font passer la base d'environ 139 Mo à 330 Mo (le palier gratuit de Supabase s'arrête à 500 Mo).

## Comment ça tourne

À l'ouverture de l'écran, l'app lit le compteur (toutes les sorties, dont celles déjà importées) et, s'il en reste, lance le calcul par lots de 20, sans attendre entre deux lots. **Fermer l'écran l'arrête** (iOS ne laisse pas tourner ça en arrière-plan) ; le rouvrir reprend là où il en était, parce que chaque sortie est écrite au fur et à mesure.

## Le temps : calcul et pauses séparés

Strava limite à **100 demandes par quart d'heure** et environ **1 000 par jour**, pour toute l'application Rush (tous les comptes ensemble). Ces limites sont lues dans les en-têtes de Strava (`X-RateLimit-Limit` / `X-RateLimit-Usage`, `_shared/quota-strava.ts`) et renvoyées par `strava-streams` dans `quota`. Strava remet le compteur à zéro à chaque quart d'heure pile, et à minuit UTC pour le jour.

- **La barre et « il reste environ… »** ne comptent que le **temps de calcul** : sorties restantes × temps moyen d'une sortie, mesuré sur les lots déjà faits (2 s au départ). Chaque sortie prend à peu près le même temps, donc la barre avance à vitesse régulière tant que ça calcule.
- **Les pauses** sont annoncées à part : « Pauses Strava à prévoir : 13 · environ 3 h » (simulation heure par heure du quota, avec l'attente de minuit quand la limite du jour est atteinte). Quand Strava refuse une demande, l'écran passe en pause avec un compte à rebours et reprend tout seul à la remise à zéro.
- Une erreur (réseau, jeton) est retentée 3 fois, puis l'écran dit qu'il est interrompu (« Réessayer »). Si rien n'avance sans que Strava refuse, il s'arrête aussi au bout de 3 lots.

## Limites

- Calcul seulement écran ouvert : un gros compte demande plusieurs heures de calcul, et plus d'un jour avec la limite quotidienne. Une tâche serveur planifiée (pg_cron) résoudrait ça, elle n'est pas faite.
- Le quota est partagé par tous les comptes : le temps annoncé est une estimation, pas une garantie.
- Pas de connexion Strava depuis le téléphone : l'écran suppose un compte déjà connecté depuis le site.
