# La démo et ses streams

Depuis le 4 nov. 2026, les séances de la démo ont de vrais « streams » (temps, distance, vitesse, cardio, watts, cadence, altitude, seconde par seconde), et les records de la démo sont calculés dessus, comme sur un vrai compte.

- `native/src/data/demo/flux-demo.ts` : génère le stream d'une séance (toujours le même pour le même id). Vélo : physique (puissance, poids, pente, air). Course : profil par type (fractionné, tempo, footing). Natation : longueurs de 25 m et repos. Muscu et Hyrox : cardio en séries/stations. Les chiffres de la fiche (durée, distance, D+, cardio et puissance moyens) restent la référence. `completerSeance` ajoute cardio, watts, NP, FTP du jour (214 W en 2021 → ~252 W en 2026).
- `native/src/data/demo/courbes-demo.ts` : copie des formules du serveur (`supabase/functions/_shared/signaux.ts` et `signaux-course.ts`). Le vélo se calcule à 1 point toutes les 5 s (pas de durées de 1 à 4 s en démo), la course à 1 s. `tests/demo/courbes-demo.test.ts` vérifie que le résultat est identique au serveur à 1 s.
- `native/src/data/demo/records-course-demo.ts` : lignes équivalentes à `rpc_courbe_course` et `rpc_piliers_course`.
- Branchés : records vélo (`recordsVeloDemo`, donc podium, signaux, niveau global), records course (`useCourbeCourse`, `usePiliersCourse`).
- Pas encore : piliers annuels du vélo (répétabilité, charge, dérive : toujours inventés), natation hebdomadaire sur 6 ans.
