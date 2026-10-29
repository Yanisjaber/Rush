-- ============================================================
-- Les courbes des autres signaux du vélo (Bilan › Records › Cyclisme) : fréquence cardiaque, cadence, couple, vitesse, vitesse ascensionnelle (VAM) et mètres descendus.
-- Comme la courbe de puissance : pour chaque durée, les trois meilleures séances du compte connecté, sur une période (`p_debut` à `p_fin`, jours compris) ou sur tout l'historique.
--
-- Où sont les valeurs : une colonne `signal_curves` (jsonb) sur chaque séance, remplie par l'Edge Function strava-streams à partir des streams :
--   { "v": 1, "fc": {"300": 171, "1200": 163}, "cad": {...}, "cou": {...}, "vit": {...}, "vam": {...}, "des": {...} }
--   (clés = durées en secondes ; fc en bpm, cad en tr/min, cou en N·m, vit en km/h, vam et des en m/h). Détails du calcul : supabase/functions/_shared/signaux.ts.
--
-- Qui peut lire : seulement le compte connecté, et seulement ses séances (`security invoker` : la RLS s'applique, et `user_id = auth.uid()` est écrit en plus).
-- Aucun accès `anon`. Mêmes sports que rpc_courbe_puissance (ni vélo électrique, ni étapes fusionnées). La vitesse, la VAM et la descente ignorent le vélo virtuel (l'altitude et la vitesse y sont simulées).
-- Un nom de signal inconnu ne renvoie rien. Relançable sans risque.
-- ============================================================

alter table public.activities add column if not exists signal_curves jsonb;

create or replace function public.rpc_courbe_signal(p_signal text, p_debut date default null, p_fin date default null)
returns table (
  duree_s integer,
  rang integer,
  valeur numeric,
  activity_id uuid,
  name text,
  start_date_local timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with valeurs as (
    select e.key::integer as duree_s, a.id, a.name, a.start_date_local, e.value::numeric as valeur
    from public.activities a
    cross join lateral jsonb_each_text(a.signal_curves -> p_signal) e
    where p_signal in ('fc', 'cad', 'cou', 'vit', 'vam', 'des')
      and a.user_id = auth.uid()
      and a.merged_into is null
      and a.sport in ('Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide')
      and (p_signal in ('fc', 'cad', 'cou') or a.sport <> 'VirtualRide')
      and a.signal_curves is not null
      and jsonb_typeof(a.signal_curves -> p_signal) = 'object'
      and e.key ~ '^[0-9]+$'
      and (p_debut is null or a.start_date_local >= p_debut::timestamptz)
      and (p_fin is null or a.start_date_local < (p_fin + 1)::timestamptz)
  ),
  classees as (
    select v.*, row_number() over (partition by v.duree_s order by v.valeur desc, v.start_date_local, v.id) as rang
    from valeurs v
    where v.valeur > 0
  )
  select c.duree_s, c.rang::integer, c.valeur, c.id, c.name, c.start_date_local
  from classees c
  where c.rang <= 3
  order by c.duree_s, c.rang;
$$;

revoke all on function public.rpc_courbe_signal(text, date, date) from public, anon;
grant execute on function public.rpc_courbe_signal(text, date, date) to authenticated;
