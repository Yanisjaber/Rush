-- Imite la production AVANT la bascule : fonctions et déclencheurs d'inscription de l'ancienne base (utilisé par tests/run_cutover.sh)
create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin insert into public.user_profiles (user_id, display_name) values (new.id, split_part(new.email, '@', 1)) on conflict (user_id) do nothing; return new; end $$;
create function public.handle_new_profile() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin insert into public.profiles (id, display_name) values (new.id, new.email) on conflict (id) do nothing; return new; end $$;
create function public.trg_recalc_daily_metrics() returns trigger language plpgsql as $$ begin return null; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create trigger trg_auth_user_created after insert on auth.users for each row execute function public.handle_new_profile();
