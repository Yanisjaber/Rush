-- ============================================================
-- Les mesures par année du niveau global de la course à pied (Bilan › Progrès › Course) : une ligne par année avec les meilleurs temps et distances de l'année.
-- Lues dans `signal_curves` des séances de course (voir 2026-11-04_courbes_course.sql) :
--   t1000, t5000, t10000 : le meilleur temps de l'année sur 1 km, 5 km et 10 km (secondes ; le plus PETIT) ;
--   d300, d3600          : la meilleure distance de l'année en 5 minutes et en 1 heure (mètres ; la plus GRANDE) ;
--   n_courbes            : combien de courses de l'année ont leurs courbes (une seule course ne fixe jamais un « meilleur » : l'application demande 3 courses).
-- Une valeur absente (la course n'a jamais fait 10 km cette année-là) vaut null. Les notes de 0 à 100 sont calculées côté application (data/bilan/piliers-course.ts).
--
-- Qui peut lire : seulement le compte connecté et ses séances (`security invoker` : la RLS s'applique, `user_id = auth.uid()` est écrit en plus). Aucun accès `anon`. Relançable sans risque.
-- ============================================================

create or replace function public.rpc_piliers_course()
returns table (
  an integer,
  t1000 numeric,
  t5000 numeric,
  t10000 numeric,
  d300 numeric,
  d3600 numeric,
  n_courbes integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select extract(year from a.start_date_local)::integer as an,
         min((a.signal_curves -> 'pace' ->> '1000')::numeric) as t1000,
         min((a.signal_curves -> 'pace' ->> '5000')::numeric) as t5000,
         min((a.signal_curves -> 'pace' ->> '10000')::numeric) as t10000,
         max((a.signal_curves -> 'dis' ->> '300')::numeric) as d300,
         max((a.signal_curves -> 'dis' ->> '3600')::numeric) as d3600,
         (count(*) filter (where jsonb_typeof(a.signal_curves -> 'pace') = 'object' or jsonb_typeof(a.signal_curves -> 'dis') = 'object'))::integer as n_courbes
  from public.activities a
  where a.user_id = auth.uid()
    and a.merged_into is null
    and a.sport in ('Run', 'TrailRun', 'VirtualRun')
    and a.signal_curves is not null
  group by 1
  order by 1;
$$;

revoke all on function public.rpc_piliers_course() from public, anon;
grant execute on function public.rpc_piliers_course() to authenticated;
