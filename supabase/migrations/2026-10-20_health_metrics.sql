-- ============================================================
-- Données de santé : une ligne par compte, par jour, par mesure et par source (20/10/2026).
--
-- Ce que ça stocke : le ressenti du matin, les événements (malade, blessé, alcool, voyage), le corps (poids, masse grasse…), la nutrition,
-- le cycle, et plus tard les mesures importées (Apple Santé, Whoop, Garmin). Le catalogue des mesures (nom, unité, bornes) vit dans le code
-- (native/src/data/sante-catalogue.ts) : ajouter une mesure ou une source ne demande aucun changement de base.
--
-- Sécurité (ce sont des données de santé : sensibles) :
--   - RLS : chacun ne lit et n'écrit que SES lignes (auth.uid() = user_id). Aucun accès anonyme.
--   - Les lignes partent avec le compte (on delete cascade sur auth.users : voir la fonction delete-account).
--   - Garde-fous : forme de la clé de mesure, source connue, valeur finie, date raisonnable, plafond de lignes par compte.
--
-- Idempotente (relançable sans risque).
-- ============================================================

create table if not exists public.health_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  metric text not null,
  value double precision not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_metrics_metric_format check (metric ~ '^[a-z][a-z0-9_]{1,39}$'),
  constraint health_metrics_source_valeur check (source in ('manual', 'garmin', 'apple_sante', 'whoop', 'strava')),
  constraint health_metrics_value_finie check (value > -1000000 and value < 1000000),
  constraint health_metrics_date_plage check (date >= date '2000-01-01' and date <= date '2100-01-01'),
  constraint health_metrics_unique unique (user_id, date, metric, source)
);

create index if not exists health_metrics_user_date on public.health_metrics (user_id, date desc);
create index if not exists health_metrics_user_metric on public.health_metrics (user_id, metric, date desc);

alter table public.health_metrics enable row level security;
revoke all on public.health_metrics from anon;

drop policy if exists "health_metrics_select_own" on public.health_metrics;
create policy "health_metrics_select_own" on public.health_metrics
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "health_metrics_insert_own" on public.health_metrics;
create policy "health_metrics_insert_own" on public.health_metrics
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "health_metrics_update_own" on public.health_metrics;
create policy "health_metrics_update_own" on public.health_metrics
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "health_metrics_delete_own" on public.health_metrics;
create policy "health_metrics_delete_own" on public.health_metrics
  for delete to authenticated
  using (auth.uid() = user_id);

-- Plafond de lignes par compte (50 000 : des années de suivi quotidien) : pas de stockage détourné
create or replace function public.health_metrics_garde_fous() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.health_metrics where user_id = new.user_id) >= 50000 then
    raise exception 'health_metrics : limite de lignes atteinte pour ce compte' using errcode = '54000';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists health_metrics_garde_fous on public.health_metrics;
create trigger health_metrics_garde_fous
  before insert or update on public.health_metrics
  for each row execute function public.health_metrics_garde_fous();

comment on table public.health_metrics is 'Données de santé d''un compte : une ligne par jour, mesure et source (manual, garmin, apple_sante, whoop, strava). RLS auth.uid() = user_id, supprimées avec le compte.';
