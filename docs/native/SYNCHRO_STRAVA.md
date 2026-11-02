# Synchro Strava : l'import des flux et des courbes

Écran : Réglages › Connexions › « Flux et courbes des sorties » (`native/app/(onglets)/parametres/synchro.tsx`). Logique : `native/src/hooks/useSynchroStrava.ts`, durées dans `native/src/data/synchro/estimation.ts` (tests : `native/tests/synchro/estimation.test.ts`), accès aux données `native/src/data/acces/api/synchro.ts`. Serveur : Edge Function `strava-streams`.

## Pourquoi cet écran

Importer une sortie depuis Strava ne donne que son résumé (durée, cardio, watts moyens). Les **courbes** (puissance : meilleur 5 s, 5, 20, 60 min, durabilité, répétabilité ; vitesse, cardio…) demandent le flux seconde par seconde, une demande à Strava **par sortie**. Avant cet écran, ce calcul ne partait que depuis le site (gelé) : un compte connecté à Strava ne l'avait jamais, et le niveau global du vélo restait à 2 piliers sur 5.

## Ce qui est importé

**Toutes les sorties** du compte, avec ou sans capteur de puissance (décision de Yanis : on importe tout, même la vitesse). Chaque sortie reçoit son flux seconde par seconde (watts, cardio, cadence, altitude, distance, vitesse) et ses courbes. Les plus récentes d'abord. Une sortie sans watts n'aura pas de courbe de puissance, mais ses autres courbes (vitesse, cardio…) sont calculées. La fonction accepte aussi `puissance_seulement: true` (seulement les sorties avec capteur, `device_watts`) ; l'app ne s'en sert plus.

**Place dans la base :** un flux pèse environ 68 Ko compressé. 2 810 sorties de plus font passer la base d'environ 139 Mo à 330 Mo (le palier gratuit de Supabase s'arrête à 500 Mo).

## Comment ça tourne

À l'ouverture de l'écran, l'app lit le compteur (toutes les sorties, dont celles déjà importées) et, s'il en reste, lance le calcul par lots de 20, sans attendre entre deux lots. **Fermer l'écran l'arrête** (iOS ne laisse pas tourner ça en arrière-plan) ; le rouvrir reprend là où il en était, parce que chaque sortie est écrite au fur et à mesure.

## Ce qui rend un lot plus rapide

Deux options de `strava-streams`, demandées par l'app (le site, lui, garde l'ancien comportement) :
- **`profil_a_la_fin`** : le profil de puissance (`power_profile`, deux recalculs) et le rattrapage des anciennes courbes ne se font qu'au **dernier lot** (quand il ne reste plus de sorties), pas à chaque appel. C'était une attente fixe à chaque lot de 20.
- **`parallele: 4`** : le serveur télécharge et écrit **quatre sorties à la fois**. Le calcul des courbes reste sur un seul fil (JavaScript), donc seules les attentes (réponse de Strava, écriture en base) se recouvrent : on gagne sur l'attente réseau, pas sur le calcul. Ça ne change pas la limite de Strava (une demande par sortie) ; si Strava refuse (429), les quatre s'arrêtent.

## Recalculer les courbes quand la formule change (depuis le 3 nov. 2026)

Quand on change ce que les courbes contiennent (la version `POWER_CURVE_VERSION` de `strava-streams`, par exemple la 8 : puissance après fatigue et découplage), les sorties déjà importées gardent leur ancienne courbe. Avant, rien ne les recalculait si tout était déjà importé : l'écran affichait « À jour » sans appeler la fonction.
Maintenant, quand toutes les sorties sont importées (à l'ouverture de l'écran ou à la fin d'un import), l'écran **compte** les courbes obsolètes (`compter_courbes`, sans rien calculer) et, s'il y en a, les **recalcule par lots** (`courbes_seulement`, depuis les flux déjà stockés, **sans appeler Strava**, 30 sorties environ à la fois) en affichant « Mise à jour des courbes : il en reste N ». Le profil de puissance ne se recalcule qu'au dernier lot. Rouvrir l'écran reprend là où il s'était arrêté ; « Réessayer » reprend la bonne étape. Quand il n'en reste plus : « À jour ».

Si tu t'arrêtes en route, le profil de puissance du site reste à son ancien état jusqu'à la fin du calcul (l'app lit les courbes directement, pas ce profil).

## Le temps

La barre et « environ… de calcul » ne comptent que le **temps de calcul** : sorties restantes × temps moyen d'une sortie, mesuré sur les lots déjà faits (2 s au départ). Chaque sortie prend à peu près le même temps, donc la barre avance à vitesse régulière.

**Ce que l'écran affiche :** le grand chiffre du dossard est le pourcentage (« 2,3 % », une décimale), la barre le suit, et les sorties s'ajoutent **une par une**. Le serveur ne répond qu'à la fin d'un lot de 20 : pour que le compteur ne saute pas à chaque réponse, l'écran le fait avancer 10 fois par seconde à **vitesse constante** (la vitesse moyenne mesurée depuis le début du calcul : temps total des lots ÷ sorties faites). Il ne dépasse jamais la 19e sortie du lot en cours ; quand le serveur confirme un chiffre plus haut que le sien, il le rattrape en glissant (environ 1,5 s) au lieu de sauter (`avancerAffichage`).

**La base fait foi :** pendant le calcul (et à l'arrêt ou en erreur), l'écran relit le compteur dans la base toutes les 4 secondes, donc il suit même si un lot tarde ou si le même compte avance la synchro sur un autre appareil ; à 100 %, la boucle s'arrête. Un lot qui ne répond pas au bout de 100 s est compté comme une erreur et retenté.

**Pas de pause automatique ni de prévision des pauses.** Les limites de l'application Rush chez Strava (tableau de bord développeur, 30 oct. 2026) : **lecture 200 demandes par quart d'heure et 2 000 par jour**, globales 400 et 4 000, 10 athlètes autorisés (3 connectés). Elles valent pour tous les comptes ensemble. Quand Strava refuse une demande, le calcul s'arrête, l'écran le dit et le bouton « Reprendre » le relance à la main. Une erreur (réseau, jeton) est retentée 3 fois, puis l'écran dit qu'il est interrompu (« Réessayer »). Si rien n'avance sans que Strava refuse, il s'arrête aussi au bout de 3 lots. (La fonction `strava-streams` renvoie encore `quota`, lu dans les en-têtes de Strava par `_shared/quota-strava.ts` : l'app ne s'en sert plus.)

## Limites

- Calcul seulement écran ouvert, et à relancer à la main après chaque limite de Strava : un gros compte demande plusieurs jours avec la limite quotidienne. Une tâche serveur planifiée (pg_cron) résoudrait ça, elle n'est pas faite.
- Le temps annoncé est celui du calcul seul, pas celui des attentes imposées par Strava.
- Pas de connexion Strava depuis le téléphone : l'écran suppose un compte déjà connecté depuis le site.

## Ce qu'on a constaté le 30 oct. 2026

Sur un compte de 2 986 sorties, l'import a écrit environ 1 900 flux en 35 minutes (de l'ordre de 1 000 par quart d'heure, soit environ 1 sortie par seconde), sans qu'aucune limite de Strava ne se déclenche, alors que la limite de lecture annoncée est de 200 par quart d'heure. Le graphique « Demandes » du tableau de bord Strava ne montrait à ce moment-là que 20 demandes sur la journée (toutes avant 17 h UTC). On ne sait pas encore si le tableau de bord est en retard ou si ces requêtes de flux ne sont pas comptées comme on le croit : la base (`streams_synced_at`) fait foi pour l'avancement.
