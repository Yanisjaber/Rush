-- ============================================================
-- Les courbes de la course à pied (Bilan › Records › Course) : meilleurs temps par distance, meilleure distance par durée, meilleure FC moyenne par durée.
-- Comme rpc_courbe_signal (vélo) : pour chaque distance ou durée, les `p_n` meilleures séances du compte connecté (3 par défaut, de 1 à 100), sur une période (`p_debut` à `p_fin`, jours compris) ou tout l'historique.
--
-- Où sont les valeurs : la colonne `signal_curves` (jsonb) des séances de course, remplie par l'Edge Function strava-streams à partir des streams (calcul : supabase/functions/_shared/signaux-course.ts) :
--   { "v": 10, "pace": {"1000": 251.4, "5000": 1402.0}, "dis": {"60": 330, "600": 2650}, "fc": {"300": 171, "1200": 165} }
--   - pace : le meilleur TEMPS en secondes, clé = la distance en mètres (400, 1000, 1609, 3000, 5000, 10000, 15000, 20000, 21097, 30000, 42195) ; le plus PETIT temps gagne ;
--   - dis  : la meilleure distance en mètres, clé = la durée en secondes ; la plus GRANDE gagne ;
--   - fc   : la meilleure FC moyenne en bpm, clé = la durée en secondes ; la plus HAUTE gagne.
--
-- Qui peut lire : seulement le compte connecté, et seulement ses séances (`security invoker` : la RLS s'applique, et `user_id = auth.uid()` est écrit en plus). Aucun accès `anon`.
-- Mêmes sports que les courbes de signaux de l'Edge Function (Run, TrailRun, VirtualRun), sans les étapes fusionnées. Un nom de signal inconnu ne renvoie rien. Relançable sans risque.
-- ============================================================

create or replace function public.rpc_courbe_course(p_signal text, p_debut date default null, p_fin date default null, p_cle integer default null, p_n integer default 3)
returns table (
  cle integer,
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
    select e.key::integer as cle, a.id, a.name, a.start_date_local, e.value::numeric as valeur
    from public.activities a
    cross join lateral jsonb_each_text(a.signal_curves -> p_signal) e
    where p_signal in ('pace', 'dis', 'fc')
      and a.user_id = auth.uid()
      and a.merged_into is null
      and a.sport in ('Run', 'TrailRun', 'VirtualRun')
      and a.signal_curves is not null
      and jsonb_typeof(a.signal_curves -> p_signal) = 'object'
      and e.key ~ '^[0-9]+$'
      and (p_cle is null or e.key::integer = p_cle)
      and (p_debut is null or a.start_date_local >= p_debut::timestamptz)
      and (p_fin is null or a.start_date_local < (p_fin + 1)::timestamptz)
  ),
  classees as (
    select v.*,
           row_number() over (
             partition by v.cle
             order by case when p_signal = 'pace' then v.valeur else -v.valeur end, v.start_date_local, v.id
           ) as rang
    from valeurs v
    where v.valeur > 0
  )
  select c.cle, c.rang::integer, c.valeur, c.id, c.name, c.start_date_local
  from classees c
  where c.rang <= least(greatest(coalesce(p_n, 3), 1), 100)
  order by c.cle, c.rang;
$$;

revoke all on function public.rpc_courbe_course(text, date, date, integer, integer) from public, anon;
grant execute on function public.rpc_courbe_course(text, date, date, integer, integer) to authenticated;
