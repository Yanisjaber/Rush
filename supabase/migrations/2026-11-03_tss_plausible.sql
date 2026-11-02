-- ============================================================
-- TSS plausible : une sortie ne dépasse jamais 200 points par heure, une intensité de plus de 1,5 n'existe pas (Yanis, 3 nov. 2026).
--
-- Problème : sur le compte de test, 106 sorties de 2011 à 2013 ont plus de 1000 TSS (jusqu'à 1 176 714) et le CTL de 2012 et 2013 vaut 162 534 et 221 025.
-- Ces sorties ont des watts estimés par Strava (`device_watts` faux) et une « FTP » de 4 W enregistrée à l'import d'origine : intensité de 36 à 71 au lieu de 0,8.
-- `recalc_ftp_tss` ne les touchait pas (sans capteur et sans cardio de référence, aucune règle ne s'appliquait : elles gardaient leur ancien TSS), mais ces valeurs
-- faussent l'écran Records (« Charge » : 1 176 714 TSS), la forme de ces années et la note de charge (la référence « 3 meilleures années » les comprenait).
--
-- Règles ajoutées (même fonction que 2026-11-02_ftp_glissante.sql pour tout le reste) :
--   - la règle « puissance » ne s'applique que si l'intensité est de 1,5 au plus et le TSS de 200 par heure au plus ; sinon (FTP absurde) on passe au cardio ;
--   - la règle « cardio » ne s'applique que si le TSS est de 200 par heure au plus ;
--   - nouvelle règle « estimation » : une sortie dont le TSS enregistré dépasse 200 par heure reçoit l'estimation générale de l'app (chargeSeance : 45 points par heure avec
--     un cardio, 35 sans) ; sa FTP enregistrée et son intensité sont effacées (4 W n'avait aucun sens) ;
--   - les 20 min qui servent à estimer la FTP d'une sortie ignorent ceux sous la moitié de ton meilleur 20 min de toujours (capteur en panne : 4 W sur 20 min).
-- Le déclencheur sur `activities` recalcule ensuite la charge de chaque compte une seule fois. Relançable sans risque (une 2e passe ne modifie plus rien). Même sécurité qu'avant :
-- `security definer`, appelable seulement par le service et la tâche de nuit, jamais par anon ni un utilisateur.
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

-- ---------- Réparation immédiate de l'historique de tous les comptes ----------
do $$
declare
  u uuid;
begin
  for u in select distinct user_id from public.activities loop
    perform public.recalc_ftp_tss(u);
  end loop;
end;
$$;
