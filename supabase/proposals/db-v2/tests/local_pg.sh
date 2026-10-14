#!/bin/bash
# Postgres 17 LOCAL et JETABLE pour tester la V2 : n'accède jamais à la vraie base (aucun mot de passe, aucun réseau).
# Prérequis : brew install postgresql@17
# Usage : tests/local_pg.sh start | stop | reset | psql [options psql…]
DATA="${PGTEST_DATA:-$HOME/.cache/rush-pgtest}"   # fichiers de la base de test (jetables)
SOCK=/tmp/rush-pg                                  # le chemin du socket doit rester COURT (limite de 103 caractères)
PORT=54329
export PATH="$(brew --prefix postgresql@17)/bin:$PATH" LC_ALL=en_US.UTF-8 PGTZ=UTC   # UTC comme Supabase : le fuseau change le « jour » d'une séance
case "$1" in
  start)
    mkdir -p "$SOCK" "$(dirname "$DATA")"
    [ -d "$DATA" ] || initdb -D "$DATA" -U postgres --auth=trust -E UTF8 --locale=en_US.UTF-8 >/dev/null
    pg_ctl -D "$DATA" -o "-c listen_addresses='' -c unix_socket_directories=$SOCK -c port=$PORT" -l "$DATA/pg.log" -w start ;;
  stop)  pg_ctl -D "$DATA" -m fast stop ;;
  reset) # base vide avec un décor minimal qui imite Supabase (rôles, auth.users, auth.uid(), Vault)
    psql -h "$SOCK" -p $PORT -U postgres -q -c "drop database if exists rush" -c "create database rush" || exit 1
    psql -h "$SOCK" -p $PORT -U postgres -d rush -v ON_ERROR_STOP=1 -q -o /dev/null <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;   -- comme Supabase : c'est ce qui crée les droits excessifs
create schema vault;
create table vault.secrets (id uuid primary key default gen_random_uuid(), secret text, name text, description text);
create view vault.decrypted_secrets as select id, name, description, secret as decrypted_secret from vault.secrets;
create function vault.create_secret(p_secret text, p_name text default null, p_description text default '') returns uuid language sql as $$ insert into vault.secrets(secret, name, description) values (p_secret, p_name, p_description) returning id $$;
create function vault.update_secret(p_id uuid, p_secret text) returns void language sql as $$ update vault.secrets set secret = p_secret where id = p_id $$;
SQL
    ;;
  psql) shift; exec psql -h "$SOCK" -p $PORT -U postgres "$@" ;;
  *) echo "usage : $0 start|stop|reset|psql" >&2; exit 1 ;;
esac
