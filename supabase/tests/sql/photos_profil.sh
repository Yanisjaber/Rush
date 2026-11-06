#!/bin/bash
# Test LOCAL (Postgres jetable) : chacun ne voit et n'écrit que dans SON dossier du bucket avatars ; anon n'a rien.
set -e
cd "$(dirname "$0")/../../.."
H=supabase/tests/sql/local_pg.sh
A=00000000-0000-4000-8000-00000000000a
B=00000000-0000-4000-8000-00000000000b
bash $H start >/dev/null 2>&1 || true
bash $H reset
# Décor minimal qui imite le stockage Supabase
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<SQL
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql immutable as \$\$ select string_to_array(name, '/') \$\$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
insert into auth.users (id, email) values ('$A', 'a@test'), ('$B', 'b@test');
SQL
echo "== la migration, deux fois (relançable)"
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-06_photos_profil.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-06_photos_profil.sql
bash $H psql -d rush -v ON_ERROR_STOP=0 <<SQL
select 'bucket privé' as controle, public = false and file_size_limit = 2097152 as ok from storage.buckets where id = 'avatars';
set role authenticated;
set request.jwt.claim.sub = '$A';
insert into storage.objects (bucket_id, name) values ('avatars', '$A/avatar.jpg');
select 'A écrit dans son dossier' as controle, count(*) = 1 as ok from storage.objects;
insert into storage.objects (bucket_id, name) values ('avatars', '$B/avatar.jpg');
insert into storage.objects (bucket_id, name) values ('autre', '$A/avatar.jpg');
select 'A : refus ailleurs (dossier de B, autre bucket)' as controle, count(*) = 1 as ok from storage.objects;
reset role;
insert into storage.objects (bucket_id, name) values ('avatars', '$B/avatar.jpg');
set role authenticated;
set request.jwt.claim.sub = '$A';
select 'A ne voit pas la photo de B' as controle, count(*) = 1 and bool_and(name like '$A/%') as ok from storage.objects where bucket_id = 'avatars';
update storage.objects set name = '$A/x.jpg' where name = '$B/avatar.jpg';
delete from storage.objects where name = '$B/avatar.jpg';
reset role;
select 'la photo de B est intacte' as controle, count(*) = 1 as ok from storage.objects where name = '$B/avatar.jpg';
set role anon;
select 'anon ne voit rien' as controle, count(*) = 0 as ok from storage.objects;
insert into storage.objects (bucket_id, name) values ('avatars', 'anon/x.jpg');
SQL
