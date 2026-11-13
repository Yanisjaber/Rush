-- ============================================================
-- Fin du filet de sécurité de la bascule de daily_metrics en vue (14/11/2026).
-- La vue marche (Accueil, Santé, Bilan, Coach vérifiés) : on supprime l'ancienne table `daily_metrics_ancienne` (gardée pour pouvoir revenir en arrière)
-- et les deux fonctions de l'ancien recalcul, que plus aucun déclencheur n'appelle. Relançable sans risque.
-- ============================================================
drop table if exists public.daily_metrics_ancienne;
drop function if exists public.trg_recalc_daily_metrics();
drop function if exists public.recalc_daily_metrics(uuid);
notify pgrst, 'reload schema';
