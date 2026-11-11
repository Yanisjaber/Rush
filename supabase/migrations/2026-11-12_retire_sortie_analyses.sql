-- Retire la table du cache des analyses de sortie par le modèle (11 nov. 2026).
-- L'analyse de la page 4 est maintenant calculée par le code dans l'app (native/src/data/calendrier/analyse/) : plus de modèle, donc plus de cache ni de fonction coach-analyse-sortie.
-- Relançable sans risque : ne fait rien si la table n'existe pas.
drop table if exists public.sortie_analyses;
