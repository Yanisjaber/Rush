-- ============================================================
-- IA de Rush, étape 4 : les tables du chat Coach (6/11/2026). Voir docs/ia/CADRAGE_IA.md.
--
-- Ce que ça crée :
--   coach_acces      : la liste blanche. Une ligne = ce compte a le droit au Coach. Lisible par le compte (pour savoir s'il
--                      affiche l'onglet), modifiable par personne depuis l'app : on l'écrit à la main en SQL (service role).
--   coach_reglages   : l'accord de partage des données avec l'IA (global + une case par catégorie de santé) et les seuils
--                      choisis par l'utilisateur (hausse hebdo, jours durs d'affilée…). Le compte les écrit lui-même.
--   chat_messages    : LA conversation du compte (une seule). Le compte la lit et peut l'effacer ; il ne peut PAS y écrire :
--                      seule l'Edge Function coach-chat insère (service role), après avoir vérifié le JWT.
--   coach_memoire    : le résumé glissant de ce qui précède les derniers messages (c'est la mémoire du coach).
--   coach_usage      : les messages et tokens du jour, par compte (plafond quotidien).
--   coach_depense    : la dépense du mois pour TOUT le monde (coupe-circuit global). Aucun accès depuis l'app.
--
-- Sécurité :
--   - RLS activée partout, policies limitées à auth.uid() = user_id, aucun accès anon.
--   - Les droits d'écriture inutiles sont retirés (revoke), en plus de l'absence de policy.
--   - Textes bornés (message 8000 caractères, résumé 4000, cartes 8 Ko), plafond de 5000 messages par compte.
--   - Tout part avec le compte (on delete cascade sur auth.users : voir delete-account).
--   - Les fonctions coach_reserver et coach_compter ne sont appelables que par le service role (Edge Function).
--
-- Relançable sans risque. À tester en local d'abord : bash supabase/tests/sql/coach_chat.sh
-- ============================================================

-- ---------- Liste blanche ----------
create table if not exists public.coach_acces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.coach_acces enable row level security;
revoke all on public.coach_acces from anon;
revoke insert, update, delete on public.coach_acces from authenticated;
drop policy if exists "coach_acces_select_own" on public.coach_acces;
create policy "coach_acces_select_own" on public.coach_acces
  for select to authenticated
  using (auth.uid() = user_id);

-- ---------- Accord et réglages ----------
create table if not exists public.coach_reglages (
  user_id uuid primary key references auth.users(id) on delete cascade,
  accord_donnees boolean not null default false,
  accord_le timestamptz,
  sante_categories text[] not null default '{}',
  seuils jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint coach_reglages_categories
    check (sante_categories <@ array['ressenti', 'evenement', 'corps', 'nutrition', 'cycle', 'appareil']::text[]),
  constraint coach_reglages_seuils
    check (jsonb_typeof(seuils) = 'object' and pg_column_size(seuils) <= 1024)
);
alter table public.coach_reglages enable row level security;
revoke all on public.coach_reglages from anon;

drop policy if exists "coach_reglages_select_own" on public.coach_reglages;
create policy "coach_reglages_select_own" on public.coach_reglages
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "coach_reglages_insert_own" on public.coach_reglages;
create policy "coach_reglages_insert_own" on public.coach_reglages
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "coach_reglages_update_own" on public.coach_reglages;
create policy "coach_reglages_update_own" on public.coach_reglages
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "coach_reglages_delete_own" on public.coach_reglages;
create policy "coach_reglages_delete_own" on public.coach_reglages
  for delete to authenticated using (auth.uid() = user_id);

-- ---------- La conversation ----------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  contenu text not null check (char_length(contenu) between 1 and 8000),
  -- Les cartes de séance proposées dans ce message (3 au plus) : [{ id, proposition, tss_estime, etat, motif }]
  cartes jsonb check (cartes is null or (jsonb_typeof(cartes) = 'array' and jsonb_array_length(cartes) <= 3 and pg_column_size(cartes) <= 8192)),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_user_date on public.chat_messages (user_id, created_at desc);
alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon;
revoke insert, update on public.chat_messages from authenticated;
drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own" on public.chat_messages
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "chat_messages_delete_own" on public.chat_messages;
create policy "chat_messages_delete_own" on public.chat_messages
  for delete to authenticated using (auth.uid() = user_id);

-- Plafond de messages par compte (5000) : pas de stockage détourné
create or replace function public.chat_messages_garde_fous() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.chat_messages where user_id = new.user_id) >= 5000 then
    raise exception 'chat_messages : plafond de 5000 messages atteint pour ce compte';
  end if;
  return new;
end;
$$;
drop trigger if exists chat_messages_garde_fous on public.chat_messages;
create trigger chat_messages_garde_fous before insert on public.chat_messages
  for each row execute function public.chat_messages_garde_fous();

-- ---------- La mémoire (résumé glissant) ----------
create table if not exists public.coach_memoire (
  user_id uuid primary key references auth.users(id) on delete cascade,
  resume text not null check (char_length(resume) <= 4000),
  -- Le résumé couvre tous les messages jusqu'à cette date (comprise)
  jusqua timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.coach_memoire enable row level security;
revoke all on public.coach_memoire from anon;
revoke insert, update on public.coach_memoire from authenticated;
drop policy if exists "coach_memoire_select_own" on public.coach_memoire;
create policy "coach_memoire_select_own" on public.coach_memoire
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "coach_memoire_delete_own" on public.coach_memoire;
create policy "coach_memoire_delete_own" on public.coach_memoire
  for delete to authenticated using (auth.uid() = user_id);

-- ---------- Usage du jour (par compte) et dépense du mois (global) ----------
create table if not exists public.coach_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  jour date not null,
  messages integer not null default 0 check (messages >= 0),
  tokens_entree bigint not null default 0 check (tokens_entree >= 0),
  tokens_sortie bigint not null default 0 check (tokens_sortie >= 0),
  micro_usd bigint not null default 0 check (micro_usd >= 0),
  primary key (user_id, jour)
);
alter table public.coach_usage enable row level security;
revoke all on public.coach_usage from anon;
revoke insert, update, delete on public.coach_usage from authenticated;
drop policy if exists "coach_usage_select_own" on public.coach_usage;
create policy "coach_usage_select_own" on public.coach_usage
  for select to authenticated using (auth.uid() = user_id);

create table if not exists public.coach_depense (
  mois date primary key,
  micro_usd bigint not null default 0 check (micro_usd >= 0)
);
alter table public.coach_depense enable row level security;
revoke all on public.coach_depense from anon, authenticated;
-- (aucune policy : seule l'Edge Function, avec le service role, la lit et l'écrit)

-- ---------- Fonctions réservées à l'Edge Function ----------
-- Réserve un message du jour : renvoie true et compte +1 si le plafond n'est pas atteint, false sinon.
-- Atomique : deux requêtes simultanées ne peuvent pas dépasser le plafond.
create or replace function public.coach_reserver(p_user uuid, p_jour date, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_messages integer;
begin
  if p_user is null or p_jour is null or p_max is null or p_max < 1 then
    return false;
  end if;
  insert into public.coach_usage as u (user_id, jour, messages)
  values (p_user, p_jour, 1)
  on conflict (user_id, jour) do update set messages = u.messages + 1
    where u.messages < p_max
  returning u.messages into v_messages;
  return v_messages is not null;
end;
$$;

-- Ajoute les tokens et le coût (en millionièmes de dollar) d'un appel, au jour du compte et au mois global
create or replace function public.coach_compter(p_user uuid, p_jour date, p_tokens_entree bigint, p_tokens_sortie bigint, p_micro_usd bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null or p_jour is null or least(p_tokens_entree, p_tokens_sortie, p_micro_usd) < 0 then
    raise exception 'coach_compter : valeurs invalides';
  end if;
  insert into public.coach_usage as u (user_id, jour, tokens_entree, tokens_sortie, micro_usd)
  values (p_user, p_jour, p_tokens_entree, p_tokens_sortie, p_micro_usd)
  on conflict (user_id, jour) do update
    set tokens_entree = u.tokens_entree + excluded.tokens_entree,
        tokens_sortie = u.tokens_sortie + excluded.tokens_sortie,
        micro_usd = u.micro_usd + excluded.micro_usd;
  insert into public.coach_depense as d (mois, micro_usd)
  values (date_trunc('month', p_jour)::date, p_micro_usd)
  on conflict (mois) do update set micro_usd = d.micro_usd + excluded.micro_usd;
end;
$$;

-- Lit une carte de séance (p_vers null), ou change son état de façon atomique : « de p_de vers p_vers », sinon rien.
-- C'est ce qui empêche un double tap sur « Ajouter » de créer deux séances : une seule requête passe de « proposee » à « en_cours ».
-- Renvoie { message_id, carte } (la carte après le changement), ou null si la carte n'existe pas pour ce compte ou n'était pas dans l'état attendu.
create or replace function public.coach_carte_etat(p_user uuid, p_carte text, p_de text, p_vers text, p_motif text default null, p_planned uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  v_carte jsonb;
  v_elem jsonb;
  v_liste jsonb := '[]'::jsonb;
begin
  if p_user is null or p_carte is null
     or (p_vers is not null and p_vers not in ('proposee', 'en_cours', 'ajoutee', 'refusee', 'annulee')) then
    return null;
  end if;
  select id, cartes into m
  from public.chat_messages
  where user_id = p_user and cartes @> jsonb_build_array(jsonb_build_object('id', p_carte))
  order by created_at desc limit 1
  for update;
  if not found then
    return null;
  end if;
  for v_elem in select * from jsonb_array_elements(m.cartes) loop
    if v_elem ->> 'id' = p_carte then
      if p_vers is not null then
        if p_de is not null and coalesce(v_elem ->> 'etat', '') <> p_de then
          return null;
        end if;
        v_elem := v_elem || jsonb_build_object('etat', p_vers)
                         || case when p_motif is not null then jsonb_build_object('motif', left(p_motif, 300)) else '{}'::jsonb end
                         || case when p_planned is not null then jsonb_build_object('seance_id', p_planned) else '{}'::jsonb end;
      end if;
      v_carte := v_elem;
    end if;
    v_liste := v_liste || jsonb_build_array(v_elem);
  end loop;
  if p_vers is not null then
    update public.chat_messages set cartes = v_liste where id = m.id;
  end if;
  return jsonb_build_object('message_id', m.id, 'carte', v_carte);
end;
$$;

revoke all on function public.coach_carte_etat(uuid, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.coach_carte_etat(uuid, text, text, text, text, uuid) to service_role;

revoke all on function public.coach_reserver(uuid, date, integer) from public, anon, authenticated;
revoke all on function public.coach_compter(uuid, date, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function public.coach_reserver(uuid, date, integer) to service_role;
grant execute on function public.coach_compter(uuid, date, bigint, bigint, bigint) to service_role;
