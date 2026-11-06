# Cadrage de l'IA de Rush

Statut : **cadrage (6 nov. 2026)**. Rien n'est codé, aucune migration appliquée, aucune fonction déployée. Ce fichier fixe les décisions prises avec Yanis, pour que toutes les sessions partent de la même base.

## Décisions de cadrage (6 nov. 2026)

- **Accès** : liste blanche par compte (drapeau). Yanis et le compte de test d'abord, ouverture plus tard. Aucun appel à Claude pour un compte non autorisé.
- **Sujets** : sport, santé et vie qui touche l'entraînement (récup, sommeil, nutrition sportive, blessure, organisation). Le reste est ramené poliment vers le sujet : le chat n'est pas un assistant généraliste payé par Yanis.
- **Consentement santé** : écran d'accord au premier usage (ce qui part à l'API et pourquoi) + interrupteurs par catégorie (cycle, corps, nutrition, événements…). Tout coupé = le chat fonctionne quand même et ne lit que séances, charge et objectifs. Le choix est stocké par compte et relu côté serveur avant chaque appel.
- **Proactivité** : aucune au début. Le chat répond seulement. Le message du matin (cron) viendra plus tard.

- **Seuils du validateur** : deux couches. (1) Réglages de l'utilisateur, modifiables à tout moment (écran de réglages ou demande au chat, via une carte « Changer ce réglage ? »), stockés par compte. (2) Plafonds absolus non modifiables (pas de séance un jour blessé/malade, plafond dur de hausse hebdomadaire). Valeurs de départ proposées : hausse de charge hebdo ≤ 10 %, jamais deux séances dures d'affilée, 1 jour de repos par semaine, séance seule ≤ 2 × la plus longue des 4 dernières semaines. Plafond dur à fixer (≈ 20 %).
- **Menu de séances** : contenu provisoire, figé après les maquettes (les 8 maquettes doivent montrer le menu et la carte de séance par sport). Départ endurance seulement.
- **Évaluation** : 1 000 à 2 000 cas générés systématiquement (profils × situations × types de questions, dont pièges). Contrôles automatiques sur tous les cas, juge LLM, échantillon de ~100 cas relus par Yanis + tous les échecs. Sert à choisir le modèle (Haiku ou Sonnet). Coût estimé : ~1 à 2 $ sur Haiku, ~25 $ sur Sonnet avec le juge.

- **Plafonds absolus** : fixes pour tout le monde, non modifiables par l'utilisateur.
- **Navigation (validée sur maquettes le 6 nov.)** : onglet **Coach** en bas à la place de Paramètres (Accueil, Calendrier, Bilan, Santé, Coach). **Roue dentée** en haut à droite de la barre des sports, qui ouvre Paramètres ; elle reste visible même pour un compte sans sport (sinon plus d'accès à Paramètres, déconnexion, suppression du compte). Le **« + »** (ajouter ou retirer un sport) passe au bout de la rangée des sports. À ajouter : la roue dentée sur l'écran Santé, qui n'a pas la barre des sports aujourd'hui. Le bouton Coach est absent pour les comptes non autorisés (liste blanche). Entrées contextuelles vers le même fil : « Analyser avec le coach » sur une sortie, « Adapter ma semaine » dans le Calendrier.
- Maquettes : https://claude.ai/artifact/Nf3QTPboXZv1c78J2WYqtY (8 affichages du chat, états de la carte, 3 menus de séances).
- **Affichage retenu (6 nov.)** : maquette 1, **fil classique** (bulles sobres, carte dans la conversation). Aucune des autres propositions (journal, dossard, effet sur la semaine, contexte épinglé, filtre de sport) : le chat reste simple.
- **Pas de menu de séances à l'écran** : aucune des 3 maquettes (liste, échelle, pastilles) n'est retenue. On modifie une séance **en parlant au chat** (« plutôt plus court », « mets-la samedi »), pas via un menu. Le menu de types de séances existe toujours **côté serveur** (ce que Claude a le droit de proposer, avec le coefficient de charge de chacun), mais l'utilisateur ne le voit pas. La carte n'a donc pas de bouton « Changer ».

## Principe

**Le modèle ne calcule pas, il décide et il explique.** Le code déterministe calcule les chiffres (charge, forme, volumes, courbes, prédictions). Claude lit un résumé JSON, répond, et le code valide tout ce qui est écrit.

## Les 4 briques voulues

| # | Brique | Rôle de Claude | Rôle du code |
|---|---|---|---|
| 1 | **Chatbot** (priorité) | Discuter librement, consulter les données, proposer des séances | Outils de lecture, validation, écriture |
| 2 | **Analyse de demandes** (« rouler plus », « moins mais plus fort », vacances, blessure) | Traduire la phrase en contraintes structurées | Refaire le plan avec ces contraintes, puis valider |
| 3 | **Compte rendu de sortie** | Écrire le texte autour des chiffres | Calculer zones, dérive de FC, comparaison aux sorties similaires, records |
| 4 | **Prédiction** | Expliquer la prédiction et sa fiabilité | Calculer la prédiction **et sa fourchette** (régression, courbes) |

Ordre : socle + chatbot, puis compte rendu, puis analyse de demandes, puis prédiction (le calcul déterministe d'abord).

## Le chatbot

- **Une seule conversation par compte**, pas de liste de discussions. Table `chat_messages` (RLS `auth.uid() = user_id`, supprimée avec le compte).
- **Mémoire** : on renvoie les ~20 derniers messages en entier + un **résumé glissant** de tout ce qui précède (c'est la mémoire). Claude n'a aucune mémoire entre deux appels.
- Bouton « effacer la conversation » : supprime vraiment les messages et le résumé.
- **Streaming** de la réponse (mot à mot).
- **Outils de lecture seule** : sorties récentes, forme/charge, calendrier, ressenti, objectifs. Il va chercher ce dont il a besoin, on ne lui envoie pas tout.
- **Ton** : coach direct, tutoiement, pas bavard (prompt système).
- **Texte externe** (noms et descriptions Strava, notes) : traité comme des **données**, jamais comme des consignes (risque d'injection de prompt).

### Écriture dans le calendrier : par carte

1. Claude appelle l'outil `proposer_seance`, qui **n'écrit rien**.
2. Le chat affiche une **carte** : sport (couleur du sport), jour, durée, intensité, charge estimée, une phrase de justification, bouton **Ajouter**.
3. Au tap, l'app écrit dans `activity_planned` **avec le jeton de l'utilisateur** (jamais `service_role`) : la RLS et le validateur s'appliquent à ce moment.
4. La séance est marquée « IA » et peut être annulée.
5. Déplacer et supprimer marchent pareil (carte à valider), et **uniquement sur les séances créées par l'IA**.

Une carte non utilisée reste dans le fil sans effet.

## Validation (obligatoire)

Claude peut sortir un plan incohérent avec aplomb. Le code refuse ou redemande si :
- plafond de charge dépassé, hausse hebdomadaire trop forte ;
- deux séances dures d'affilée ;
- séance un jour « indisponible », « blessé » ou « malade » (`day_notes`) ;
- séance hors du menu de types de séances.

## Garde-fou santé (avant Claude)

C'est du coaching, pas du médical. Si les données sont anormales (malade, blessé, charge qui explose, FC repos qui s'envole), le code répond « repos / voir un pro » **sans appeler le modèle**. Pour une blessure : on adapte la charge, aucun diagnostic.

## Séances : un menu, pas des blocs libres

Claude choisit dans une liste de types de séances (Z2 facile, seuil, sortie longue, repos…), chacun avec un coefficient de charge, et ajuste la durée. Le code calcule la charge réelle. Les zones restent en « Z2 » (jamais en watts : elles se recalculent à l'affichage).

## Données d'entrée

Garmin est coupé : peu de HRV, de FC repos et de sommeil. Les signaux fiables sont la **charge d'entraînement** (`daily_metrics`) et le **ressenti du matin** (`health_metrics`). Une source HRV s'ajoutera plus tard si elle existe.

## Modèle et prix

Prix de l'API (par million de tokens, table du 6 oct. 2026) :

| Modèle | Entrée | Sortie | Lecture du cache |
|---|---|---|---|
| Haiku 5.5 | 0,10 $ | 0,50 $ | non indiqué |
| Sonnet 5.5 | 2 $ | 10 $ | 0,20 $ |
| Opus 5.5 | 4 $ | 20 $ | 0,20 $ |

Haiku 5.5 : prix valables jusqu'à 100 000 tokens de prompt. L'API en différé (batch) coûte 50 % de moins, adaptée à un cron du matin.

- **Départ : Haiku 5.5**, puis comparaison avec Sonnet 5.5 sur les mêmes questions. Le modèle est une ligne de configuration.
- La réflexion du modèle compte comme de la sortie : effort réglé sur `low` pour les décisions cadrées.
- Prompt de cache : menu de séances et consignes en tête du prompt.
- **Plafond de messages par jour et par compte**, obligatoire.
- Ordres de grandeur (hypothèse 3 000 tokens en entrée, 600 en sortie par plan) : environ 0,0006 $ par plan avec Haiku, 0,012 $ avec Sonnet.

## Sécurité

- Appels à l'API Claude **uniquement depuis une Edge Function**. La clé Anthropic vit dans un secret Supabase, jamais dans le code, un commit ou un log (c'est Yanis qui la crée).
- Toute nouvelle table : RLS activée, policies `auth.uid() = user_id`, aucun accès `anon`.
- Données de santé envoyées à l'API : chiffres agrégés, **sans nom, e-mail ni identifiant**. À mentionner dans les mentions légales.
- CORS via `_shared/cors.ts`.

## Ce qui existe déjà et qu'on réutilise

- `daily_metrics` : charge, forme, fatigue (CTL/ATL/TSB), recalculée chaque nuit à 00h05 par pg_cron.
- `health_metrics`, `day_notes`, `yearly_goals`, `training_cycles`.
- `activity_planned` : séances prévues (structure à relire avant la migration).
- Pas d'Edge Function Claude aujourd'hui, et le « coach system » a été supprimé le 11 oct. (`2026-10-11_remove_coach_system.sql`) : on repart de zéro.

## Ordre de construction

1. **Fait** : fonction SQL de résumé `rpc_coach_resume` (JSON), testée en local (`supabase/tests/sql/coach_resume.sh`) et appliquée en base le 6 nov.
2. **Fait** : garde-fou (`_shared/garde-fou.ts`) et validateur (`_shared/validateur.ts`) en TypeScript, tests `node --experimental-strip-types --test supabase/tests/edge/garde-fou.test.mts supabase/tests/edge/validateur.test.mts`. Seuils : un seul endroit chacun (`SEUILS` du garde-fou, `PLAFONDS` et `REGLAGES_DEFAUT` du validateur).
3. **Fait pour le menu** (`_shared/menu-seances.ts`, endurance : vélo, course, natation ; TSS par heure de départ à affiner). Reste le schéma JSON de la réponse de Claude, avec l'Edge Function.
4. Table `chat_messages` + Edge Function du chat (streaming, outils, prompt système).
5. Écran du chat et carte de séance : **8 maquettes d'abord**.
6. Compte rendu de sortie, puis analyse de demandes, puis prédiction.

## Sports au départ

**Endurance d'abord** : vélo, course, natation. Muscu et Hyrox plus tard (autre type de charge : RIR, volume).

## Erreurs : ce que l'utilisateur voit

Principe : **une erreur n'écrit jamais rien dans le calendrier**, n'affiche jamais de détail technique, et ne perd jamais le message de l'utilisateur.

| Situation | Comportement |
|---|---|
| API Claude en panne, lente ou 5xx | Un seul nouvel essai automatique côté serveur. Sinon message dans le fil : « Je n'arrive pas à répondre pour le moment. » + bouton Réessayer. Le message de l'utilisateur reste dans le champ. |
| Plafond de messages du jour atteint (30) | « Tu as atteint la limite du jour. Reviens demain. » Compteur discret quand il reste 5 messages ou moins. |
| Coupe-circuit de dépense global atteint | Chat en pause pour tout le monde : « Le coach est indisponible pour le moment. » Seuil de départ : 10 $ par mois, réglable (à confirmer par Yanis). |
| Accord santé retiré ou catégorie coupée | Le chat continue avec les données restantes. Accord global retiré : retour à l'écran d'accord. Le serveur relit le consentement avant chaque appel. |
| Compte non autorisé | Pas d'onglet Coach. Un appel direct à la fonction renvoie 403, sans appel à Claude. |
| Réponse invalide (carte mal formée, séance hors menu) | Un nouvel essai avec l'erreur indiquée au modèle. Sinon texte seul, sans carte : « Je n'ai pas réussi à préparer la séance, dis-le-moi autrement. » |
| Le validateur refuse au tap sur Ajouter | La carte passe à l'état « Refusée » avec le motif, rien n'est écrit. |
| Anomalie santé détectée (blessé, malade, charge qui explose) | Réponse du code « repos / voir un pro », sans appel à Claude. |
| Téléphone hors connexion | Champ de saisie désactivé : « Pas de connexion ». |

Journaux : identifiant du compte, durée, code d'erreur, nombre de tokens. **Jamais le contenu des messages ni les données de santé.**

## Questions encore ouvertes

- Budget mensuel : 10 $ par mois en coupe-circuit au départ, à confirmer.
- Seuil exact du plafond dur de hausse hebdomadaire (≈ 20 %).
- Écran d'accord santé et écran de réglages des seuils : maquettes (8 variantes chacun) avant leur code.
