# Analyse d'une sortie par le coach (page 4 de l'écran d'une sortie)

Décision de Yanis (11 nov. 2026) : la page 4 est un **retour de coach écrit** sur cette sortie seule (maquette 1 « la lettre »), pas une comparaison avec d'autres sorties (les types de sortie diffèrent trop pour que ça veuille dire quelque chose).

## Comment ça marche
1. L'app tire des flux de la sortie des **nombres seulement** : allure et cœur de chaque km, dérive cardiaque, temps par zone (ramené à 5 zones), cadence, plus un type de séance fermé (footing, fractionné, sortie longue, compétition, autre) deviné d'après le nom. Le nom lui-même n'est jamais envoyé. Code : `native/src/data/calendrier/signaux-analyse.ts`.
2. La fonction `coach-analyse-sortie` vérifie le JWT, la liste blanche (`coach_acces`) et l'accord de partage (`coach_reglages`), relit la sortie en base avec le jeton de l'utilisateur (durée, distance, dénivelé, cœur moyen) et refuse tout nombre hors bornes.
3. `construireFaits` met tout en phrases courtes : ce sont les **seuls chiffres** que le modèle (Haiku) a le droit d'employer. Il n'a aucun outil, il ne calcule pas.
4. `validerLettre` relit la lettre : chaque chiffre doit venir des faits, pas de lien, de gras, de titre ni d'émoji, dernier paragraphe « Je retiens : ». Refusée = une seconde chance avec la raison, puis pas de lettre (mieux vaut rien qu'une lettre fausse).
5. La lettre est gardée dans `sortie_analyses` (cache, une ligne par sortie). Elle n'est refaite que si les chiffres changent (`empreinte`). Le compte peut la lire, seule la fonction écrit.
6. L'appel au modèle ne part que sur le bouton « Demander l'analyse » (ou « Actualiser l'analyse »). Ouvrir la page ne coûte rien.

Coût d'une analyse : environ 0,002 $ (Haiku, quelques centaines de jetons de sortie).

## Fichiers
- Serveur : `supabase/functions/_shared/analyse-sortie.ts` (faits, consigne, validation), `analyse-sortie-service.ts` (déroulé), `supabase/functions/coach-analyse-sortie/index.ts`, migration `2026-11-12_sortie_analyses.sql`.
- App : `PageCoachSortie.tsx`, `useAnalyseSortie.ts`, `api/coach.ts` (`lireAnalyseSortie`, `demanderAnalyseSortie`).
- Tests : `supabase/tests/edge/analyse-sortie*.test.mts`, `supabase/tests/sql/sortie_analyses.sh`, `native/tests/calendrier/{signaux-analyse,lettre-coach}.test.ts`.

## À savoir
- Le modèle réfléchit avant d'écrire et cette réflexion compte dans `max_tokens` : à 700 la réponse sortait vide, 2500 marche.
- La qualité du texte dépend des **zones de cœur du profil** (FC max, seuil). Si elles sont estimées, la lettre le dit et reste prudente.
- Course et vélo seulement pour l'instant. Pas d'allure par km à vélo.

## Reste à faire
- Seuils de lecture dans la consigne (dérive 5 %, 85 %…) : à sourcer, comme les autres règles du coach (voir `IA_A_FAIRE.md`).
- Relier la sortie à la séance prévue (pour juger « prévu contre fait » avec le vrai objectif, pas seulement le nom).
- Cadence (le serveur sait la lire, l'app ne l'envoie pas encore : elle n'est pas dans les flux bruts).
- Muscu, natation, Hyrox : autres critères, autres faits.
- Supprimer les fichiers de l'ancienne idée « comparaison » (`comparaison-sortie.ts`, `mot-coach-sortie.ts`, `useContexteSortie.ts`, leur test) : en attente de l'OK de Yanis.
