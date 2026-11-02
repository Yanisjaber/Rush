-- ============================================================
-- FTP glissante : fenêtre de ±90 jours (puis ±180, puis ±365) au lieu de ±45 (puis ±90, puis ±180) (Yanis, 3 nov. 2026).
--
-- Problème : la FTP d'une sortie = 95 % du meilleur 20 min dans les 45 jours autour d'elle. Or on ne fait pas un effort maximal de 20 min tous les 45 jours : quand la fenêtre
-- ne contient que des 20 min tranquilles, la FTP estimée tombe sous la vraie, l'intensité (puissance normalisée ÷ FTP) monte et le TSS gonfle. Compte de test, 2022 : FTP médiane
-- estimée 203 W (la meilleure puissance de l'année donne 216 W), intensité médiane 0,91, 70 points par heure contre 57 à 65 les autres années, et CTL max de 141 contre 91 à 110.
-- Avec ±90 / ±180 / ±365 : FTP 219 W et 60 points par heure en 2022, les autres années bougent de 1 à 4 points par heure au plus (2023 : 61 → 57, 2020 : 63 → 59).
--
-- Même fonction que 2026-11-03_tss_plausible.sql pour tout le reste (garde-fous de plausibilité, efforts absurdes écartés, FTP du profil sur les 90 derniers jours, watts estimés ignorés).
-- Relançable sans risque (une 2e passe ne modifie plus rien). Même sécurité : `security definer`, appelable seulement par le service et la tâche de nuit.
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
  efforts_bruts as (
    -- les meilleurs 20 min de tes sorties (vrai capteur, vélo seulement)
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
  efforts as (
    -- ceux qui servent à estimer la FTP : un effort sous la moitié de ton meilleur 20 min de toujours est un capteur en panne (4 W sur 20 min), pas ta FTP
    select e.jour, e.w20 from efforts_bruts e
    where e.w20 >= 0.5 * (select max(b.w20) from efforts_bruts b)
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
               (select round(0.95 * max(e.w20))::integer from efforts e where abs(e.jour - c.jour) <= 90),
               (select round(0.95 * max(e.w20))::integer from efforts e where abs(e.jour - c.jour) <= 180),
               (select round(0.95 * max(e.w20))::integer from efforts e where abs(e.jour - c.jour) <= 365)
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
           e.capteur_velo, e.heures, e.ftp, e.tss_cardio,
           round(e.np::numeric / nullif(e.ftp, 0), 3) as intensite,
           round(e.heures * (e.np::numeric / nullif(e.ftp, 0)) ^ 2 * 100)::integer as tss_puissance,
           -- l'estimation générale de l'app (chargeSeance) : 45 points par heure avec un cardio, 35 sans
           round(e.heures * case when e.avg_heartrate > 0 then 45 else 35 end)::integer as tss_estime
    from estimees e
  ),
  regles as (
    -- Une sortie ne dépasse jamais 200 points par heure (une heure à 1,4 fois la FTP en fait 196) et une intensité de plus de 1,5 n'existe pas :
    -- au-delà, c'est une FTP absurde (4 W) ou une puissance fausse, pas un effort. On passe alors à la règle suivante.
    select c.*,
           case
             when c.capteur_velo and c.ftp > 0 and c.intensite <= 1.5 and c.tss_puissance <= 200 * c.heures then 'puissance'
             when c.tss_cardio is not null and c.tss_cardio <= 200 * c.heures and (not c.capteur_velo or c.ftp > 0) then 'cardio'
             when c.tss_avant > 200 * c.heures then 'estimation'
           end as regle
    from calculs c
  )
  update activities a
     set ftp_at_time = case c.regle when 'puissance' then c.ftp when 'estimation' then null else a.ftp_at_time end,
         intensity   = case c.regle when 'puissance' then c.intensite else null end,
         tss         = case c.regle when 'puissance' then c.tss_puissance when 'cardio' then c.tss_cardio else c.tss_estime end
    from regles c
   where a.id = c.id
     and c.regle is not null
     and (   (c.regle = 'puissance' and (c.ftp is distinct from c.ftp_avant or c.tss_puissance is distinct from c.tss_avant or c.intensite is distinct from c.intensite_avant))
          or (c.regle = 'cardio' and (c.tss_cardio is distinct from c.tss_avant or c.intensite_avant is not null))
          or (c.regle = 'estimation' and (c.tss_estime is distinct from c.tss_avant or c.ftp_avant is not null or c.intensite_avant is not null)));

  get diagnostics v_modifiees = row_count;
  return v_modifiees;
end;
$$;

revoke all on function public.recalc_ftp_tss(uuid) from public, anon, authenticated;

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
