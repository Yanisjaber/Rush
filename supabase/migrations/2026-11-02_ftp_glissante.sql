-- ============================================================
-- Charge d'une sortie : FTP glissante + règle complète du TSS (puissance avec vrai capteur, sinon cardio).
--
-- Problème 1 : à la première synchro, toutes les vieilles sorties recevaient la FTP du jour (profil, sinon estimée), figée dans `ftp_at_time`.
-- Le TSS de 2022 était donc calculé avec la FTP de 2026, la charge (CTL) des vieilles années était fausse, et l'évolution de la FTP restait plate.
-- Problème 2 : les watts estimés par Strava (sans capteur), la puissance de course à pied, celle du vélo électrique et la simple puissance moyenne
-- donnaient un TSS de « puissance » alors qu'ils ne mesurent pas ta puissance.
--
-- Règle (décidée avec Yanis, 2 nov. 2026), la même que supabase/functions/_shared/charge.ts :
--   1. TSS de PUISSANCE : sortie à vélo (route, gravel, VTT, virtuel) avec un VRAI capteur (`device_watts` vrai) et une puissance normalisée,
--      avec la FTP de son époque : durée en heures × (NP / FTP)² × 100, où
--        - FTP d'une sortie = 95 % du meilleur 20 min (clé '1200' de `power_curve`) des sorties à capteur réel situées dans les 45 jours avant ET après elle
--          (l'effort max d'après la sortie compte : la forme change lentement) ;
--        - la fenêtre s'élargit à ±90 puis ±180 jours quand elle ne contient aucun 20 min ; sans rien, la sortie garde son TSS et sa FTP d'avant ;
--        - sur les 90 derniers jours, la FTP saisie dans le profil (`user_profiles.ftp`) l'emporte sur l'estimation ;
--        - sont ignorés pour estimer : les watts estimés (`device_watts` faux), les puissances écartées (`excl_power`), les étapes fusionnées,
--          les sports qui ne sont pas du vélo, le vélo électrique ;
--   2. sinon TSS CARDIO avec la LTHR du profil (sinon 92 % de la FC max) : seconde par seconde quand le flux cardio de la sortie est chargé et couvre au moins
--      80 % de sa durée (TSS = 100 × hr_sq / (LTHR² × 3600), voir supabase/functions/_shared/cardio.ts : la moyenne de (FC / LTHR)² sur le temps × les heures × 100),
--      sinon d'après la FC moyenne : durée en heures × (FC moyenne / LTHR)² × 100. Les sorties sans puissance (cardio seul) sont donc recalculées elles aussi ;
--   3. sinon la sortie garde ce qu'elle avait.
-- Seules les sorties Strava (`strava_id` renseigné) avec une puissance (`np`) ou un cardio sont touchées : les séances saisies à la main et celles sans watts gardent leur TSS.
-- Une sortie qui passe au cardio garde sa `ftp_at_time` et perd son `intensity` (le facteur d'intensité n'existe que pour la puissance). Les watts restent affichés, la colonne `np` ne change pas.
--
-- `recalc_ftp_tss(p_user)` rend le nombre de sorties modifiées. Elle ne rappelle pas `recalc_daily_metrics` : c'est le déclencheur sur `activities`
-- (2026-07-08_daily_metrics_auto_recalc.sql) qui recalcule la charge, une seule fois pour tout l'UPDATE. Relançable sans risque (rien ne change si rien n'a bougé).
-- La tâche de nuit (daily_metrics_nuit) l'appelle avant `recalc_daily_metrics` : une sortie importée dans la journée reçoit sa règle définitive à 00 h 05 UTC.
-- Même sécurité que `recalc_daily_metrics` : `security definer`, appelable seulement par le service et la tâche de nuit, jamais par anon ni un utilisateur.
-- ============================================================

create or replace function public.recalc_ftp_tss(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profil integer;
  v_lthr integer;
  v_modifiees integer;
begin
  select ftp, coalesce(nullif(lthr, 0), round(hr_max * 0.92)::integer)
    into v_profil, v_lthr
  from user_profiles where user_id = p_user;

  with
  efforts as (
    -- les meilleurs 20 min qui servent à estimer la FTP (vrai capteur, vélo seulement)
    select a.start_date_local::date as jour, (a.power_curve ->> '1200')::numeric as w20
    from activities a
    where a.user_id = p_user
      and a.merged_into is null
      and a.start_date_local is not null
      and a.sport in ('Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide')
      and a.device_watts is true
      and not coalesce(a.excl_power, false)
      and a.power_curve ? '1200'
      and (a.power_curve ->> '1200')::numeric > 0
  ),
  cibles as (
    -- les sorties Strava qui ont une puissance ou un cardio : leur TSS se recalcule (puissance si possible, sinon cardio)
    select a.id, a.np, a.avg_heartrate, a.tss, a.ftp_at_time, a.intensity,
           a.start_date_local::date as jour,
           coalesce(a.moving_time, a.elapsed_time, 0) as secondes,
           coalesce(a.moving_time, a.elapsed_time, 0) / 3600.0 as heures,
           (a.power_curve ->> 'hr_s')::numeric as hr_s,
           (a.power_curve ->> 'hr_sq')::numeric as hr_sq,
           (a.np > 0 and a.sport in ('Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide') and a.device_watts is true) as capteur_velo
    from activities a
    where a.user_id = p_user
      and a.strava_id is not null
      and a.merged_into is null
      and a.start_date_local is not null
      and (a.np > 0 or a.avg_heartrate > 0 or (a.power_curve ->> 'hr_sq')::numeric > 0)
  ),
  estimees as (
    select c.*,
           case when c.capteur_velo then
             coalesce(
               case when v_profil > 0 and c.jour >= current_date - 90 then v_profil end,
               (select round(0.95 * max(e.w20))::integer from efforts e where abs(e.jour - c.jour) <= 45),
               (select round(0.95 * max(e.w20))::integer from efforts e where abs(e.jour - c.jour) <= 90),
               (select round(0.95 * max(e.w20))::integer from efforts e where abs(e.jour - c.jour) <= 180)
             )
           end as ftp,
           -- TSS cardio : seconde par seconde quand le flux couvre au moins 80 % de la sortie (hr_sq = somme des carrés des cardios, voir _shared/cardio.ts),
           -- sinon d'après la FC moyenne
           case
             when v_lthr > 0 and c.hr_sq > 0 and c.hr_s >= 0.8 * c.secondes then round(100 * c.hr_sq / (v_lthr::numeric ^ 2 * 3600))::integer
             when v_lthr > 0 and c.avg_heartrate > 0 then round(c.heures * (c.avg_heartrate::numeric / v_lthr) ^ 2 * 100)::integer
           end as tss_cardio
    from cibles c
  ),
  calculs as (
    select e.id, e.tss as tss_avant, e.ftp_at_time as ftp_avant, e.intensity as intensite_avant,
           case
             when e.ftp > 0 then 'puissance'
             when not e.capteur_velo and e.tss_cardio is not null then 'cardio'
           end as regle,
           e.ftp,
           e.tss_cardio,
           round(e.np::numeric / nullif(e.ftp, 0), 3) as intensite,
           round(e.heures * (e.np::numeric / nullif(e.ftp, 0)) ^ 2 * 100)::integer as tss_puissance
    from estimees e
  )
  update activities a
     set ftp_at_time = case c.regle when 'puissance' then c.ftp else a.ftp_at_time end,
         intensity   = case c.regle when 'puissance' then c.intensite else null end,
         tss         = case c.regle when 'puissance' then c.tss_puissance else c.tss_cardio end
    from calculs c
   where a.id = c.id
     and c.regle is not null
     and (   (c.regle = 'puissance' and (c.ftp is distinct from c.ftp_avant or c.tss_puissance is distinct from c.tss_avant or c.intensite is distinct from c.intensite_avant))
          or (c.regle = 'cardio' and (c.tss_cardio is distinct from c.tss_avant or c.intensite_avant is not null)));

  get diagnostics v_modifiees = row_count;
  return v_modifiees;
end;
$$;

revoke all on function public.recalc_ftp_tss(uuid) from public, anon, authenticated;

-- ---------- La tâche de nuit recalcule la FTP avant la charge ----------
-- Même tâche que 2026-10-28_daily_metrics_cron_nuit.sql, avec un appel de plus. Sans pg_cron (base locale), ne fait rien.
-- Retour arrière : relancer 2026-10-28_daily_metrics_cron_nuit.sql.
do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron absent : tâche non modifiée';
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'daily_metrics_nuit') then
    perform cron.unschedule('daily_metrics_nuit');
  end if;
  perform cron.schedule(
    'daily_metrics_nuit',
    '5 0 * * *',
    $job$select public.recalc_ftp_tss(u.user_id), public.recalc_daily_metrics(u.user_id) from (select distinct user_id from public.activities) u$job$
  );
end;
$$;

-- ---------- Recalcul immédiat de l'historique de tous les comptes ----------
do $$
declare
  u uuid;
begin
  for u in select distinct user_id from public.activities loop
    perform public.recalc_ftp_tss(u);
  end loop;
end;
$$;
