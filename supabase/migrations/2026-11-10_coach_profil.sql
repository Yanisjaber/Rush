-- ============================================================
-- Profil du coureur pour le coach IA (docs/ia/FONDEMENTS_PLAN_COURSE.md : plus on a de données, plus le plan est juste).
--
-- Ce que l'historique de sorties ne dit pas : le TEMPS DISPONIBLE (jours libres, durée max par jour), l'ANCIENNETÉ (années de pratique,
-- plus grosse semaine déjà faite), les BLESSURES passées, les PRÉFÉRENCES (moment de la journée, fractionné).
--
-- Sécurité :
--   - une ligne par compte, RLS activée, policies limitées à auth.uid() = user_id, aucun accès anon ;
--   - AUCUN texte libre : tout est une valeur d'une liste fermée ou un nombre borné (rien d'externe ne peut finir dans le prompt du modèle) ;
--   - la validation est faite en base (fonction coach_profil_ok), pas seulement dans l'app : la RLS ne contrôle pas le contenu ;
--   - les blessures sont des données de santé : le coach ne les lit que si le compte a donné l'accord de santé correspondant (vérifié côté Edge Function) ;
--   - tout part avec le compte (on delete cascade sur auth.users : voir delete-account).
--
-- Relançable sans risque. À tester en local d'abord : bash supabase/tests/sql/coach_profil.sh
-- ============================================================

-- Valide le contenu des trois colonnes jsonb (listes fermées, nombres bornés). Immuable : utilisable dans un check.
create or replace function public.coach_profil_ok(dispo jsonb, blessures jsonb, preferences jsonb)
returns boolean language sql immutable as $$
  select
    -- disponibilités : { "lundi": { "libre": true, "minutes_max": 60 }, … } (jours de la semaine uniquement)
    jsonb_typeof(dispo) = 'object'
    and not exists (
      select 1 from jsonb_each(dispo) j(jour, v)
      where j.jour not in ('lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche')
         or jsonb_typeof(j.v) <> 'object'
         or exists (select 1 from jsonb_object_keys(j.v) k where k not in ('libre', 'minutes_max'))
         or (j.v ? 'libre' and jsonb_typeof(j.v -> 'libre') <> 'boolean')
         or (j.v ? 'minutes_max' and (jsonb_typeof(j.v -> 'minutes_max') <> 'number'
              or (j.v ->> 'minutes_max') !~ '^[0-9]{1,3}$' or (j.v ->> 'minutes_max')::int > 600))
    )
    -- blessures : [ { "zone": "genou", "quand": "recent", "actif": false }, … ] (10 au plus)
    and jsonb_typeof(blessures) = 'array' and jsonb_array_length(blessures) <= 10
    and not exists (
      select 1 from jsonb_array_elements(blessures) b(v)
      where jsonb_typeof(b.v) <> 'object'
         or exists (select 1 from jsonb_object_keys(b.v) k where k not in ('zone', 'quand', 'actif'))
         or (b.v ->> 'zone') is null or (b.v ->> 'zone') not in ('genou','cheville','pied','tibia','mollet','ischio','quadriceps','hanche','dos','autre')
         or (b.v ->> 'quand') is null or (b.v ->> 'quand') not in ('moins_3_mois','moins_1_an','plus_1_an')
         or (b.v ? 'actif' and jsonb_typeof(b.v -> 'actif') <> 'boolean')
    )
    -- préférences : { "moment": "matin|midi|soir|variable", "fractionne": "aime|neutre|evite" }
    and jsonb_typeof(preferences) = 'object'
    and not exists (select 1 from jsonb_object_keys(preferences) k where k not in ('moment', 'fractionne'))
    and (not preferences ? 'moment' or (preferences ->> 'moment') in ('matin','midi','soir','variable'))
    and (not preferences ? 'fractionne' or (preferences ->> 'fractionne') in ('aime','neutre','evite'))
$$;

create table if not exists public.coach_profil (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Depuis combien d'années il court (0 à 80), null = inconnu
  annees_pratique smallint check (annees_pratique is null or annees_pratique between 0 and 80),
  -- Sa plus grosse semaine déjà faite, en minutes de course (0 à 2000), null = inconnu
  pic_hebdo_minutes integer check (pic_hebdo_minutes is null or pic_hebdo_minutes between 0 and 2000),
  disponibilites jsonb not null default '{}'::jsonb,
  blessures jsonb not null default '[]'::jsonb,
  -- true = la question des blessures a été posée (une liste vide veut alors dire « aucune blessure », pas « pas demandé »)
  blessures_renseignees boolean not null default false,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint coach_profil_contenu check (public.coach_profil_ok(disponibilites, blessures, preferences)),
  constraint coach_profil_taille check (pg_column_size(disponibilites) + pg_column_size(blessures) + pg_column_size(preferences) <= 4096)
);

alter table public.coach_profil add column if not exists blessures_renseignees boolean not null default false;   -- pour une table créée avant cette colonne
alter table public.coach_profil enable row level security;
revoke all on public.coach_profil from anon;

drop policy if exists "coach_profil_select_own" on public.coach_profil;
create policy "coach_profil_select_own" on public.coach_profil
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "coach_profil_insert_own" on public.coach_profil;
create policy "coach_profil_insert_own" on public.coach_profil
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "coach_profil_update_own" on public.coach_profil;
create policy "coach_profil_update_own" on public.coach_profil
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "coach_profil_delete_own" on public.coach_profil;
create policy "coach_profil_delete_own" on public.coach_profil
  for delete to authenticated using (auth.uid() = user_id);
