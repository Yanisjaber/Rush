-- ============================================================
-- La courbe de puissance des records (Bilan › Records, Cyclisme) : pour une quarantaine de durées (de 1 s à 5 h), les trois meilleures
-- puissances moyennes du compte connecté, avec la séance qui les a faites. Sur une période (`p_debut` à `p_fin`, jours compris) ou, sans dates, sur tout l'historique.
--
-- Pourquoi une fonction : `power_curve` contient une valeur par durée (près de mille clés par séance). Les agréger côté serveur évite d'envoyer
-- ces courbes entières au téléphone : on ne renvoie qu'une ligne par durée et par rang (au plus 3 × 44 lignes).
--
-- Qui peut lire : seulement le compte connecté, et seulement ses séances (`security invoker` : la RLS s'applique, et `user_id = auth.uid()` est écrit en plus).
-- Aucun accès `anon`. Mêmes sports que rpc_sorties_velo (ni vélo électrique, ni étapes fusionnées). Relançable sans risque.
-- ============================================================

create or replace function public.rpc_courbe_puissance(p_debut date default null, p_fin date default null)
returns table (
  duree_s integer,
  rang integer,
  watts integer,
  activity_id uuid,
  name text,
  start_date_local timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with durees(d) as (
    select unnest(array[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 90, 120, 150, 180, 240, 300, 360, 420, 480, 600, 720, 900,
                        1080, 1200, 1500, 1800, 2400, 3000, 3600, 4500, 5400, 7200, 9000, 10800, 14400, 18000])
  ),
  valeurs as (
    select d.d as duree_s, a.id, a.name, a.start_date_local,
           round((a.power_curve ->> d.d::text)::numeric)::integer as watts
    from durees d
    cross join public.activities a
    where a.user_id = auth.uid()
      and a.merged_into is null
      and a.sport in ('Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide')
      and a.power_curve is not null
      and (p_debut is null or a.start_date_local >= p_debut::timestamptz)
      and (p_fin is null or a.start_date_local < (p_fin + 1)::timestamptz)
  ),
  classees as (
    select v.*, row_number() over (partition by v.duree_s order by v.watts desc, v.start_date_local, v.id) as rang
    from valeurs v
    where v.watts is not null and v.watts > 0
  )
  select c.duree_s, c.rang::integer, c.watts, c.id, c.name, c.start_date_local
  from classees c
  where c.rang <= 3
  order by c.duree_s, c.rang;
$$;

revoke all on function public.rpc_courbe_puissance(date, date) from public, anon;
grant execute on function public.rpc_courbe_puissance(date, date) to authenticated;
