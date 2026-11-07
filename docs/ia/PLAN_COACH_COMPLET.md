# Plan : le coach complet (7 nov. 2026)

Ambition de Yanis : une IA qui remplace un vrai coach **et** agit à la place de l'utilisateur. Elle replanifie sur imprévu, connaît l'entraînement à fond, répond à toute question et peut exécuter n'importe quelle fonction de l'app. Ce plan complète `CADRAGE_IA.md` (qui reste valable pour la sécurité, le prix et les erreurs).

## Décisions (7 nov.)

- **Le modèle ne calcule pas.** Le code garde le moteur de plan (charge, progression, affûtage, jours bloqués). Le modèle traduit l'imprévu en contraintes, appelle le moteur, puis valide et explique.
- **Actions : trois niveaux de risque.**
  1. **Bénin, exécuté direct** : navigation, filtres, ouvrir une séance, unité, noter un ressenti.
  2. **Modifie les données : toujours une carte à valider** (ajouter, déplacer, supprimer une séance, déclarer une blessure). Pas d'exécution seule, même si la demande est claire (décision de Yanis).
  3. **Gros ou irréversible : confirmation explicite** (supprimer un plan, déconnecter Strava, supprimer le compte).
- Toute action passe par une **liste d'outils définie dans le code**, avec le jeton de l'utilisateur (la RLS s'applique). Le modèle n'a jamais d'accès direct à la base.
- **« Surentraîné » = base de connaissances à nous + prompt d'expert + banc d'essai**, pas un entraînement du modèle.

## Fenêtre de contexte

Aujourd'hui le résumé complet est renvoyé à chaque tour (voir `_shared/coach-contexte.ts`). Avec beaucoup d'outils et de connaissances, ça ne tient plus. Cible :

1. **Résumé léger** : forme du jour, charge 7 jours, prochaines séances, indisponibilités, objectif.
2. **Outils de lecture** pour le détail (sorties, volumes, ressenti, calendrier), regroupés par domaine et chargés à la demande.
3. **Contexte en couches** : socle stable en tête (prompt, profil, mémoire) pour le cache de prompt, données du jour après.
4. **Base de connaissances en recherche**, jamais collée en entier dans le contexte.
5. **Fait (7 nov.)** : résumé léger + outils de lecture (jours, séances récentes, volume, santé, cycles) lus dans le résumé déjà chargé ; historique long par deux fonctions SQL appliquées en base (`rpc_coach_semaines` jusqu'à 52 semaines, `rpc_coach_seances` 92 jours et 30 séances au plus, test `bash supabase/tests/sql/coach_historique.sh`), outils `lire_semaines` et `lire_seances_periode`.
6. Plus tard : mémoire en faits typés, fenêtre variable selon le sujet.

## Ordre de construction

1. **Registre d'actions** par niveau de risque (type, validation des entrées, carte ou direct).
2. **Outils de lecture** + résumé allégé.
3. **Base de connaissances** (documents courts et sourcés : périodisation, affûtage, reprise après blessure, nutrition, spécifique par sport) + recherche.
4. **Replanification sur imprévu** : analyse de demande en contraintes, moteur, validateur.
5. **Banc d'essai** 1 000 à 2 000 cas (pièges inclus), puis comparaison Haiku / Sonnet.
6. Compte rendu de sortie, prédiction.

## À décider plus tard

- Format et sources de la base de connaissances (qui l'écrit, comment on la relit).
- Écran : cartes pour les niveaux 2 et 3 (8 maquettes avant le code).
