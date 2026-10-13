-- Vérifications APRÈS migration (à lancer sur la base locale de test, puis sur la vraie base en répétition générale).
-- Chaque contrôle affiche ✅ ou lève une erreur qui arrête tout. Aucune donnée n'est modifiée durablement (tout est annulé à la fin).
\set ON_ERROR_STOP on
begin;
create or replace function pg_temp.ok(p_nom text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception '❌ % %', p_nom, p_detail; end if;
  raise notice '✅ % %', p_nom, p_detail;
end $$;

-- ===== A. Comptes et sommes ============================================================================================
select pg_temp.ok('activités migrées (hors dates invalides)', (select count(*) from public.activities) = (select count(*) from legacy.activities where start_date_local::date >= date '2000-01-01'),
  format('%s / %s', (select count(*) from public.activities), (select count(*) from legacy.activities)));
select pg_temp.ok('charge totale identique (somme des TSS)', (select sum(training_load) from public.activities) = (select sum(least(tss, 9999)) from legacy.activities), '');
select pg_temp.ok('courbes migrées', (select count(*) from public.activity_streams) = (select count(*) from legacy.activities where streams_gz is not null), format('%s', (select count(*) from public.activity_streams)));
select pg_temp.ok('courbes identiques octet pour octet après décodage', not exists (
  select 1 from legacy.activities a join public.activity_streams s on s.activity_id = a.id where encode(s.payload, 'base64') <> replace(a.streams_gz, E'\n', '')), '');
select pg_temp.ok('séances prévues + compétitions = lignes d''origine', (select count(*) from public.planned_workouts) + (select count(*) from public.events where id in (select id from legacy.activity_planned)) = (select count(*) from legacy.activity_planned), '');
select pg_temp.ok('parcours GPX conservés intacts', not exists (select 1 from legacy.activity_planned ap left join public.routes r on r.id = ap.id where ap.gpx_content is not null and ap.gpx_content <> '' and r.gpx is distinct from ap.gpx_content), '');
select pg_temp.ok('séries de force migrées (3 clés : bibliothèque, perso, disparue)', (select count(*) from public.strength_sets) = (select count(*) from legacy.strength_sets), format('%s', (select count(*) from public.strength_sets)));
select pg_temp.ok('exercice disparu recréé en perso (rien perdu)', exists (select 1 from public.exercises where user_id is not null and name = 'Exercice disparu'), '');
select pg_temp.ok('Whoop non migré, Strava et Garmin migrés', (select count(*) from public.connections) = 2 and not exists (select 1 from public.connections where provider not in ('strava', 'garmin')), '');
select pg_temp.ok('jetons NON présents dans les tables lisibles', not exists (select 1 from information_schema.columns where table_schema = 'public' and column_name ~ '(access_token|refresh_token|secret)'), '');
select pg_temp.ok('jetons chiffrés retrouvables par le serveur', (select (public.rpc_connection_secrets('11111111-1111-4111-8111-111111111111', 'garmin') ->> 'oauth1_token') = 'oauth1_fictif'), '');

-- ===== B. Neutralisation des valeurs aberrantes ==========================================================================
select pg_temp.ok('FC aberrante neutralisée (240/300 → vide)', (select hr_avg_bpm is null and hr_max_bpm is null from public.activities where external_id = '9000010'), '');
select pg_temp.ok('puissance aberrante neutralisée', (select power_avg_w is null and power_max_w is null from public.activities where external_id = '9000011'), '');
select pg_temp.ok('nom vide → « Sans titre »', (select name = 'Sans titre' from public.activities where external_id = '9000012'), '');
select pg_temp.ok('lien invalide vers une séance prévue → vide, lien valide conservé', (select planned_workout_id is null from public.activities where external_id = '9000020')
  and (select planned_workout_id is not null from public.activities where external_id = '9000030'), '');
select pg_temp.ok('profil : date, sexe, taille illisibles → vides', (select birth_date is null and sex is null and height_cm is null from public.profiles where user_id = '22222222-2222-4222-8222-222222222222'), '');
select pg_temp.ok('profil : valeurs lisibles converties', (select birth_date = date '1998-04-02' and sex = 'm' and height_cm = 178 and last_name = 'Martin' from public.profiles where user_id = '11111111-1111-4111-8111-111111111111'), '');
select pg_temp.ok('avatar trop long écarté sans bloquer', (select avatar_url is null from public.profiles where user_id = '11111111-1111-4111-8111-111111111111'), '');
select pg_temp.ok('données de santé NON migrées (restent dans legacy)', not exists (select 1 from public.athlete_thresholds where extra::text ~* '(allerg|medic|emergency|injur)'), '');
select pg_temp.ok('seuils : W'' « 19 » converti en 19 000 J', (select w_prime_j = 19000 from public.athlete_thresholds where user_id = '11111111-1111-4111-8111-111111111111'), '');
select pg_temp.ok('note de fin avant le début → corrigée', not exists (select 1 from public.calendar_notes where to_date < from_date), '');
select pg_temp.ok('ancienne note (iso_date seul) reprise', exists (select 1 from public.calendar_notes where body = 'ancienne note' and from_date = date '2026-09-01'), '');
select pg_temp.ok('sommeil : heures texte → instants, format invalide → vide', (select bedtime_at is not null from public.sleep_nights where night_date = '2026-10-10')
  and (select bedtime_at is null from public.sleep_nights where night_date = '2026-10-12'), '');
select pg_temp.ok('sommeil : durée absurde (90000 s) neutralisée', (select total_s is null from public.sleep_nights where night_date = '2026-10-11'), '');
select pg_temp.ok('triathlon : événement + 3 disciplines, activité reliée', (select count(*) from public.event_segments) = 3 and (select event_id is not null from public.activities where external_id = '9000050'), '');
select pg_temp.ok('résultat de course repris', (select place = 12 and total = 150 and category = 'V1' from public.race_results limit 1), '');
select pg_temp.ok('retouches rattachées, orphelines écartées', (select count(*) from public.activity_overrides) = 2, format('%s sur 3', (select count(*) from public.activity_overrides)));
select pg_temp.ok('retouche : durée minutes → secondes', (select o.duration_s = 4500 and o.distance_m = 30500 and o.sport_code = 'run' from public.activity_overrides o join public.activities a on a.id = o.activity_id where a.external_id = '9000005'), '');
select pg_temp.ok('sports : « cyclisme » (ancien français) → ride, inconnu → other', (select sport_code = 'ride' from public.planned_workouts where name = 'Endurance') and (select sport_code = 'other' from public.workout_templates where name = 'Inconnu'), '');

-- ===== C. La forme (CTL/ATL) est IDENTIQUE à l'ancien moteur, jour par jour =============================================
select pg_temp.ok('forme : mêmes jours', (select count(*) from public.daily_load) = (select count(*) from legacy.daily_metrics), format('%s jours', (select count(*) from public.daily_load)));
select pg_temp.ok('forme : CTL, ATL (à 0,1 près, comme l''ancienne appli) et charge IDENTIQUES partout', not exists (
  select 1 from legacy.daily_metrics m left join public.daily_load d on d.user_id = m.user_id and d.day = m.iso_date
  where d.day is null or round(d.ctl, 1) <> m.ctl or round(d.atl, 1) <> m.atl or d.load <> m.tss), '');

-- ===== D. Records de puissance : comparés à un calcul indépendant sur l'ancienne base ====================================
select pg_temp.ok('records (tous sports, toute la vie) = calcul indépendant', not exists (
  with attendu as (
    select a.user_id, kv.key::int d, max(kv.value::int) w
    from legacy.activities a cross join lateral jsonb_each_text(a.power_curve) kv
    where kv.key ~ '^[0-9]+$' and kv.value::numeric > 0 group by 1, 2)
  select 1 from attendu e left join public.power_bests b on b.user_id = e.user_id and b.scope = 'all' and b.duration_s = e.d and b.time_window = 'all_time'
  where b.watts is distinct from least(e.w, 32767)), format('%s records', (select count(*) from public.power_bests)));

-- ===== E. CALCUL INCRÉMENTAL de la forme : même résultat qu'un recalcul complet ==========================================
do $$
declare v_avant text; v_apres text; v_id uuid; v_user uuid := '11111111-1111-4111-8111-111111111111';
begin
  select string_agg(day || ':' || ctl || ':' || atl || ':' || load, ',' order by day) into v_avant from public.daily_load where user_id = v_user;
  -- on ajoute une activité au milieu de l'historique : seul l'aval doit être recalculé…
  insert into public.activities (user_id, source, sport_code, name, started_at, duration_s, training_load) values (v_user, 'manual', 'run', 'Test incrémental', timestamptz '2025-06-01 08:00+00', 3600, 80) returning id into v_id;
  select string_agg(day || ':' || ctl || ':' || atl || ':' || load, ',' order by day) into v_apres from public.daily_load where user_id = v_user;
  perform pg_temp.ok('incrémental : l''ajout change bien la forme', v_avant is distinct from v_apres, '');
  -- … et doit donner EXACTEMENT ce que donne un recalcul complet depuis le début
  perform private.refresh_daily_load(v_user, null);
  perform pg_temp.ok('incrémental = recalcul complet', v_apres = (select string_agg(day || ':' || ctl || ':' || atl || ':' || load, ',' order by day) from public.daily_load where user_id = v_user), '');
  delete from public.activities where id = v_id;
  perform pg_temp.ok('incrémental : la suppression restaure l''état initial', v_avant = (select string_agg(day || ':' || ctl || ':' || atl || ':' || load, ',' order by day) from public.daily_load where user_id = v_user), '');
end $$;

-- ===== F. Sécurité : isolation entre utilisateurs, droits, intégrité inter-comptes ======================================
select pg_temp.ok('toutes les tables de public ont la RLS', not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), '');
select pg_temp.ok('aucun droit pour anon, ni TRUNCATE/TRIGGER/REFERENCES pour authenticated', not exists (
  select 1 from information_schema.role_table_grants where table_schema = 'public' and (grantee = 'anon' or (grantee = 'authenticated' and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')))), '');
select pg_temp.ok('private : inaccessible aux rôles de l''API', not exists (select 1 from information_schema.role_table_grants where table_schema = 'private' and grantee in ('anon', 'authenticated', 'public')), '');
select pg_temp.ok('fonctions rpc_* : réservées à service_role', not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.prosecdef and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))), '');

do $$
declare t record; v_vu bigint; v_total bigint; v_pb text := ''; n_tables int := 0;
begin
  -- Un utilisateur INCONNU ne voit rien dans aucune table ; l'utilisateur 1 ne voit que ses lignes
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped) order by 1 loop
    n_tables := n_tables + 1;
    perform set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999999', true);
    set local role authenticated;
    execute format('select count(*) from public.%I', t.relname) into v_vu;
    reset role;
    if v_vu <> 0 and t.relname <> 'exercises' then v_pb := v_pb || t.relname || '(' || v_vu || ') '; end if;
  end loop;
  perform pg_temp.ok(format('un utilisateur inconnu ne voit AUCUNE ligne (%s tables testées)', n_tables), v_pb = '', v_pb);
end $$;

do $$
declare v_ok boolean; v_act uuid;
begin
  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  set local role authenticated;
  -- l'utilisateur 2 ne peut pas LIRE les activités de l'utilisateur 1
  perform pg_temp.ok('utilisateur 2 : ne voit que ses activités', (select count(*) from public.activities) = (select count(*) from public.activities where user_id = '22222222-2222-4222-8222-222222222222'), '');
  -- … ni en CRÉER au nom de l'utilisateur 1
  begin
    insert into public.activities (user_id, source, sport_code, name, started_at) values ('11111111-1111-4111-8111-111111111111', 'manual', 'run', 'intrus', now());
    v_ok := false;
  exception when others then v_ok := true; end;
  perform pg_temp.ok('utilisateur 2 : ne peut pas écrire chez l''utilisateur 1 (RLS)', v_ok, '');
  -- … ni rattacher SES séries à l'activité de l'utilisateur 1 (clé étrangère composite : faille théorique de l'ancien modèle)
  select id into v_act from public.activities where false;
  reset role;
  select id into v_act from public.activities where user_id = '11111111-1111-4111-8111-111111111111' limit 1;
  set local role authenticated;
  begin
    insert into public.strength_sets (activity_id, user_id, exercise_id, position, set_no, reps) values (v_act, '22222222-2222-4222-8222-222222222222', (select id from public.exercises where slug = 'squat'), 1, 1, 5);
    v_ok := false;
  exception when others then v_ok := true; end;
  perform pg_temp.ok('on ne peut pas rattacher une série à l''activité d''un autre (clé composite)', v_ok, '');
  -- … ni lire les jetons
  begin
    perform public.rpc_connection_secrets('11111111-1111-4111-8111-111111111111', 'garmin');
    v_ok := false;
  exception when others then v_ok := true; end;
  perform pg_temp.ok('un utilisateur ne peut pas appeler rpc_connection_secrets', v_ok, '');
  begin
    perform * from private.connection_secrets;
    v_ok := false;
  exception when others then v_ok := true; end;
  perform pg_temp.ok('un utilisateur ne peut pas lire private.connection_secrets', v_ok, '');
  -- bibliothèque d'exercices : lisible, non modifiable
  perform pg_temp.ok('bibliothèque d''exercices lisible', (select count(*) from public.exercises where user_id is null) = 48, '');
  begin
    update public.exercises set name = 'piraté' where user_id is null;
    perform pg_temp.ok('bibliothèque d''exercices non modifiable', (select count(*) from public.exercises where name = 'piraté') = 0, '');
  exception when others then perform pg_temp.ok('bibliothèque d''exercices non modifiable', true, ''); end;
  reset role;
  -- anon : refusé partout
  set local role anon;
  begin perform count(*) from public.activities; v_ok := false; exception when others then v_ok := true; end;
  perform pg_temp.ok('rôle anonyme refusé', v_ok, '');
  reset role;
end $$;

-- ===== G. Suppression de compte : TOUT disparaît en cascade ==============================================================
do $$
declare v_user uuid := '11111111-1111-4111-8111-111111111111'; v_restes text := ''; t record; n bigint;
begin
  delete from auth.users where id = v_user;
  for t in select c.relname, n.nspname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname in ('public', 'private') and c.relkind = 'r' and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped) loop
    execute format('select count(*) from %I.%I where user_id = $1', t.nspname, t.relname) using v_user into n;
    if n > 0 then v_restes := v_restes || t.relname || '(' || n || ') '; end if;
  end loop;
  perform pg_temp.ok('suppression du compte : plus aucune ligne nulle part', v_restes = '', v_restes);
  perform pg_temp.ok('suppression du compte : ses jetons chiffrés aussi (private.connection_secrets)', not exists (select 1 from private.connection_secrets), '');
end $$;
rollback;
select 'TOUS LES CONTRÔLES SONT PASSÉS' as resultat;
