# Synchro Strava : l'import des flux et des courbes

Écran : Réglages › Connexions › « Flux et courbes des sorties » (`native/app/(onglets)/parametres/synchro.tsx`). Logique : `native/src/hooks/useSynchroStrava.ts`, durées dans `native/src/data/synchro/estimation.ts` (tests : `native/tests/synchro/estimation.test.ts`), accès aux données `native/src/data/acces/api/synchro.ts`. Serveur : Edge Function `strava-streams`.

## Pourquoi cet écran

Importer une sortie depuis Strava ne donne que son résumé (durée, cardio, watts moyens). Les **courbes** (puissance : meilleur 5 s, 5, 20, 60 min, durabilité, répétabilité ; vitesse, cardio…) demandent le flux seconde par seconde, une demande à Strava **par sortie**. Avant cet écran, ce calcul ne partait que depuis le site (gelé) : un compte connecté à Strava ne l'avait jamais, et le niveau global du vélo restait à 2 piliers sur 5.

## Ce qui est importé

**Toutes les sorties** du compte, avec ou sans capteur de puissance (décision de Yanis : on importe tout, même la vitesse). Chaque sortie reçoit son flux seconde par seconde (watts, cardio, cadence, altitude, distance, vitesse) et ses courbes. Les plus récentes d'abord. Une sortie sans watts n'aura pas de courbe de puissance, mais ses autres courbes (vitesse, cardio…) sont calculées. La fonction accepte aussi `puissance_seulement: true` (seulement les sorties avec capteur, `device_watts`) ; l'app ne s'en sert plus.

**Place dans la base :** un flux pèse environ 68 Ko compressé. 2 810 sorties de plus font passer la base d'environ 139 Mo à 330 Mo (le palier gratuit de Supabase s'arrête à 500 Mo).

## Comment ça tourne

À l'ouverture de l'écran, l'app lit le compteur (toutes les sorties, dont celles déjà importées) et, s'il en reste, lance le calcul par lots de 20, sans attendre entre deux lots. **Fermer l'écran l'arrête** (iOS ne laisse pas tourner ça en arrière-plan) ; le rouvrir reprend là où il en était, parce que chaque sortie est écrite au fur et à mesure.

## Le temps

La barre et « environ… de calcul » ne comptent que le **temps de calcul** : sorties restantes × temps moyen d'une sortie, mesuré sur les lots déjà faits (2 s au départ). Chaque sortie prend à peu près le même temps, donc la barre avance à vitesse régulière.

**Ce que l'écran affiche :** le grand chiffre du dossard est le pourcentage (« 2,3 % », une décimale), la barre le suit, et les sorties s'ajoutent **une par une** à vitesse régulière (le temps mesuré d'une sortie). Le serveur ne répond qu'à la fin d'un lot de 20 : pendant le lot, l'écran fait avancer le compteur tout seul (`faitesAffichees`), sans jamais dépasser la 19e sortie du lot ; à la réponse du serveur, le chiffre confirmé prend le relais.

**Pas de pause automatique ni de prévision des pauses.** Strava limite à 100 demandes par quart d'heure et environ 1 000 par jour, pour toute l'application Rush. Quand Strava refuse une demande, le calcul s'arrête, l'écran le dit et le bouton « Reprendre » le relance à la main. Une erreur (réseau, jeton) est retentée 3 fois, puis l'écran dit qu'il est interrompu (« Réessayer »). Si rien n'avance sans que Strava refuse, il s'arrête aussi au bout de 3 lots. (La fonction `strava-streams` renvoie encore `quota`, lu dans les en-têtes de Strava par `_shared/quota-strava.ts` : l'app ne s'en sert plus.)

## Limites

- Calcul seulement écran ouvert, et à relancer à la main après chaque limite de Strava : un gros compte demande plusieurs jours avec la limite quotidienne. Une tâche serveur planifiée (pg_cron) résoudrait ça, elle n'est pas faite.
- Le temps annoncé est celui du calcul seul, pas celui des attentes imposées par Strava.
- Pas de connexion Strava depuis le téléphone : l'écran suppose un compte déjà connecté depuis le site.
