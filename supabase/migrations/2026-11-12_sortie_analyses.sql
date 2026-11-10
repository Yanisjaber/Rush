-- ============================================================
-- Analyse d'une sortie par le coach (page 4 de l'écran d'une sortie) : le texte écrit par le modèle, gardé en cache.
--
-- Une ligne par sortie. L'analyse n'est refaite que si les chiffres de la sortie changent (`empreinte` = signature des faits envoyés au modèle) :
-- ouvrir la page dix fois coûte un seul appel au modèle.
--
-- Sécurité :
--   - RLS activée, lecture limitée à auth.uid() = user_id, aucun accès anon ;
--   - le compte NE PEUT PAS écrire : seule l'Edge Function (service role) écrit, après avoir vérifié l'accès, l'accord de partage et la forme de la réponse ;
--   - `contenu` est borné (objet JSON, 8 Ko) ; aucun texte venant d'ailleurs que du modèle (relu et validé par la fonction) ;
--   - tout part avec le compte (on delete cascade sur auth.users : voir delete-account).
--
-- Relançable sans risque. À tester en local d'abord : bash supabase/tests/sql/sortie_analyses.sh
-- ============================================================
create table if not exists public.sortie_analyses (
  activity_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  empreinte text not null check (char_length(empreinte) between 8 and 128),
  contenu jsonb not null check (jsonb_typeof(contenu) = 'object' and pg_column_size(contenu) <= 8192),
  modele text not null check (char_length(modele) between 1 and 60),
  created_at timestamptz not null default now()
);
create index if not exists sortie_analyses_user on public.sortie_analyses (user_id, created_at desc);

alter table public.sortie_analyses enable row level security;
revoke all on public.sortie_analyses from anon;
revoke insert, update, delete on public.sortie_analyses from authenticated;
drop policy if exists "sortie_analyses_select_own" on public.sortie_analyses;
create policy "sortie_analyses_select_own" on public.sortie_analyses
  for select to authenticated
  using (auth.uid() = user_id);
