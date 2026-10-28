


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.user_profiles (user_id, extras)
  values (
    new.id,
    jsonb_strip_nulls(jsonb_build_object(
      'first_name', nullif(left(btrim(coalesce(m->>'first_name', '')), 60), ''),
      'last_name',  nullif(left(btrim(coalesce(m->>'last_name', '')), 60), '')))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."health_metrics_garde_fous"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.health_metrics where user_id = new.user_id) >= 50000 then
    raise exception 'health_metrics : limite de lignes atteinte pour ce compte' using errcode = '54000';
  end if;
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."health_metrics_garde_fous"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalc_daily_metrics"("p_user" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  d_first date;
  d_last  date;
  r record;
  v_ctl numeric := 0;
  v_atl numeric := 0;
begin
  select min(start_date_local::date), greatest(max(start_date_local::date), current_date)
    into d_first, d_last
  from activities
  where user_id = p_user
    and merged_into is null  -- étapes fusionnées (triathlon) : déjà comptées via leur parent
    and start_date_local is not null
    and start_date_local::date >= date '2000-01-01';  -- ignore dates aberrantes (epoch 1970)

  -- Plus aucune activité : on vide les métriques de l'utilisateur.
  if d_first is null then
    delete from daily_metrics where user_id = p_user;
    return;
  end if;

  -- Purge des lignes hors plage (avant la 1re activité / après aujourd'hui).
  delete from daily_metrics
  where user_id = p_user
    and (iso_date < d_first or iso_date > d_last);

  -- Série continue jour par jour + EWMA (même formule que strava-ingest).
  for r in
    with agg as (
      select start_date_local::date as iso,
             sum(coalesce(tss, 0)) as tss,
             sum(round(coalesce(moving_time, elapsed_time, 0) / 60.0)) as dur,
             count(*) as cnt
      from activities
      where user_id = p_user
        and merged_into is null  -- idem : on ne compte pas deux fois un triathlon fusionné
        and start_date_local is not null
        and start_date_local::date >= date '2000-01-01'
      group by 1
    )
    select gs::date as iso,
           coalesce(a.tss, 0) as tss,
           coalesce(a.dur, 0) as dur,
           coalesce(a.cnt, 0) as cnt
    from generate_series(d_first, d_last, interval '1 day') gs
    left join agg a on a.iso = gs::date
    order by gs::date
  loop
    v_ctl := v_ctl + (r.tss - v_ctl) * 2 / 43.0;
    v_atl := v_atl + (r.tss - v_atl) * 2 / 8.0;
    insert into daily_metrics (user_id, iso_date, tss, ctl, atl, tsb, duration_min, activity_count)
    values (p_user, r.iso, round(r.tss), round(v_ctl, 1), round(v_atl, 1),
            round(v_ctl - v_atl, 1), r.dur, r.cnt)
    on conflict (user_id, iso_date) do update
      set tss            = excluded.tss,
          ctl            = excluded.ctl,
          atl            = excluded.atl,
          tsb            = excluded.tsb,
          duration_min   = excluded.duration_min,
          activity_count = excluded.activity_count;
  end loop;
end;
$$;


ALTER FUNCTION "public"."recalc_daily_metrics"("p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_connection_secrets"("p_user_id" "uuid", "p_app" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'vault'
    AS $$
declare v_secret_id uuid; v_secret text;
begin
  select secret_id into v_secret_id from public.connexions_app where user_id = p_user_id and app = p_app;
  if not found then return null; end if;
  if v_secret_id is not null then
    select ds.decrypted_secret into v_secret from vault.decrypted_secrets ds where ds.id = v_secret_id;
    if v_secret is not null then return v_secret::jsonb; end if;
  end if;
  return '{}'::jsonb;
end $$;


ALTER FUNCTION "public"."rpc_connection_secrets"("p_user_id" "uuid", "p_app" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_purge_compte"("p_user" "uuid", "p_lot" integer DEFAULT 500) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  lot integer := least(greatest(coalesce(p_lot, 0), 0), 2000);
  n_met integer;
  n_pp  integer;
  n_act integer;
begin
  if p_user is null then raise exception 'utilisateur manquant'; end if;
  perform set_config('app.suppression_compte', '1', true);

  if lot > 0 then
    select count(*) into n_met from public.daily_metrics where user_id = p_user;
    if n_met > 0 then
      delete from public.daily_metrics where ctid in (select ctid from public.daily_metrics where user_id = p_user limit lot);
    else
      select count(*) into n_pp from public.power_profile where user_id = p_user;
      if n_pp > 0 then
        delete from public.power_profile where ctid in (select ctid from public.power_profile where user_id = p_user limit lot);
      else
        delete from public.activities where id in (select id from public.activities where user_id = p_user limit lot);
      end if;
    end if;
  end if;

  select count(*) into n_met from public.daily_metrics  where user_id = p_user;
  select count(*) into n_pp  from public.power_profile  where user_id = p_user;
  select count(*) into n_act from public.activities     where user_id = p_user;
  return jsonb_build_object('metriques', n_met, 'courbes', n_pp, 'activites', n_act, 'total', n_met + n_pp + n_act);
end;
$$;


ALTER FUNCTION "public"."rpc_purge_compte"("p_user" "uuid", "p_lot" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_remplacer_power_profile"("p_user" "uuid", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  n integer;
begin
  delete from public.power_profile where user_id = p_user;
  insert into public.power_profile
    select (jsonb_populate_record(null::public.power_profile,
              jsonb_build_object('updated_at', now()) || e || jsonb_build_object('user_id', p_user))).*
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) e;
  get diagnostics n = row_count;
  return n;
end;
$$;


ALTER FUNCTION "public"."rpc_remplacer_power_profile"("p_user" "uuid", "p_rows" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_remplacer_power_profile_sport"("p_user" "uuid", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  n integer;
begin
  delete from public.power_profile_sport where user_id = p_user;
  insert into public.power_profile_sport
    select (jsonb_populate_record(null::public.power_profile_sport,
              jsonb_build_object('details', '{}'::jsonb, 'updated_at', now()) || e || jsonb_build_object('user_id', p_user))).*
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) e;
  get diagnostics n = row_count;
  return n;
end;
$$;


ALTER FUNCTION "public"."rpc_remplacer_power_profile_sport"("p_user" "uuid", "p_rows" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_save_connection_secrets"("p_user_id" "uuid", "p_app" "text", "p_payload" "jsonb", "p_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'vault'
    AS $$
declare v_id uuid; v_secret uuid; v_payload jsonb;
begin
  select id, secret_id into v_id, v_secret from public.connexions_app where user_id = p_user_id and app = p_app for update;
  if v_id is null then raise exception 'connexion inconnue'; end if;
  v_payload := coalesce(public.rpc_connection_secrets(p_user_id, p_app), '{}'::jsonb) || jsonb_strip_nulls(coalesce(p_payload, '{}'::jsonb));
  if v_secret is null then
    v_secret := vault.create_secret(v_payload::text, 'connexion:' || v_id::text, 'Jetons ' || p_app);
  else
    perform vault.update_secret(v_secret, v_payload::text);
  end if;
  update public.connexions_app set secret_id = v_secret, expires_at = coalesce(p_expires_at, expires_at) where id = v_id;
end $$;


ALTER FUNCTION "public"."rpc_save_connection_secrets"("p_user_id" "uuid", "p_app" "text", "p_payload" "jsonb", "p_expires_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_connexions_delete_secret"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'vault'
    AS $$
begin
  if old.secret_id is not null then delete from vault.secrets where id = old.secret_id; end if;
  return old;
end $$;


ALTER FUNCTION "public"."trg_connexions_delete_secret"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_plafond_lignes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $_$
declare
  v_cap integer := TG_ARGV[0]::integer;
  u uuid;
  n integer;
begin
  for u in select distinct user_id from nouvelles where user_id is not null loop
    execute format('select count(*) from (select 1 from public.%I where user_id = $1 limit %s) s', TG_TABLE_NAME, v_cap + 1)
      into n using u;
    if n > v_cap then
      raise exception 'Plafond atteint : % lignes au maximum dans % par compte', v_cap, TG_TABLE_NAME
        using errcode = 'check_violation';
    end if;
  end loop;
  return null;
end;
$_$;


ALTER FUNCTION "public"."trg_plafond_lignes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_recalc_daily_metrics"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  u uuid;
begin
  if current_setting('app.suppression_compte', true) = '1' then return null; end if;
  for u in select distinct user_id from changed_rows where user_id is not null loop
    perform public.recalc_daily_metrics(u);
  end loop;
  return null;
end;
$$;


ALTER FUNCTION "public"."trg_recalc_daily_metrics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_training_cycles_max2"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if exists (
    select 1
    from generate_series(new.from_date, new.to_date, interval '1 day') as g(jour)
    where (
      select count(*) from public.training_cycles c
      where c.user_id = new.user_id and c.id <> new.id and c.from_date <= g.jour::date and c.to_date >= g.jour::date
    ) >= 2
  ) then
    raise exception 'training_cycles : au plus deux cycles le même jour' using errcode = '23514';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_training_cycles_max2"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "strava_id" bigint,
    "name" "text",
    "sport" "text",
    "start_date_local" timestamp with time zone NOT NULL,
    "elapsed_time" integer,
    "moving_time" integer,
    "distance_km" numeric,
    "total_elevation_gain" integer,
    "total_elevation_loss" integer,
    "avg_speed_kmh" numeric,
    "max_speed_kmh" numeric,
    "max_speed_smooth_kmh" numeric,
    "avg_heartrate" integer,
    "max_heartrate" integer,
    "avg_watts" integer,
    "max_watts" integer,
    "np" integer,
    "intensity" numeric,
    "ftp_at_time" integer,
    "avg_cadence" integer,
    "max_cadence" integer,
    "kj" integer,
    "calories" integer,
    "tss" integer,
    "variability_index" numeric,
    "zones_hr" "jsonb",
    "zones_power" "jsonb",
    "has_heartrate" boolean DEFAULT false,
    "has_power" boolean DEFAULT false,
    "device_watts" boolean DEFAULT false,
    "streams_blob" "bytea",
    "streams_format" "text",
    "gpx_blob" "bytea",
    "user_notes" "text",
    "user_tags" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "streams_gz" "text",
    "streams_synced_at" timestamp with time zone,
    "power_curve" "jsonb",
    "category" "text",
    "source" "text",
    "client_id" "text",
    "priority" "text",
    "target" "text",
    "course_dplus" integer,
    "laps" integer,
    "gpx_name" "text",
    "gpx_content" "text",
    "stages" "jsonb",
    "event" "text",
    "rpe" numeric,
    "structure" "jsonb",
    "type" "text",
    "excl_power" boolean,
    "excl_hr" boolean,
    "excl_distance" boolean,
    "planned_id" "text",
    "metrics" "jsonb",
    "tri" "jsonb",
    "category_set_by_user" boolean DEFAULT false NOT NULL,
    "result_place" integer,
    "result_total" integer,
    "result_catev" "text",
    "federation" "text",
    "race_level" "text",
    "tri_format" "text",
    "result_url" "text",
    "merged_into" "uuid",
    "discipline" "text",
    "lap_details" "jsonb",
    CONSTRAINT "activities_category_check" CHECK ((("category" IS NULL) OR ("category" = ANY (ARRAY['entrainement'::"text", 'competition'::"text"])))),
    CONSTRAINT "activities_discipline_format" CHECK ((("discipline" IS NULL) OR ("discipline" ~ '^[a-z0-9-]{1,40}$'::"text"))),
    CONSTRAINT "activities_durations_check" CHECK (((COALESCE("moving_time", 0) >= 0) AND (COALESCE("elapsed_time", 0) >= 0) AND (COALESCE("distance_km", (0)::numeric) >= (0)::numeric))),
    CONSTRAINT "activities_lap_details_check" CHECK ((("lap_details" IS NULL) OR (("jsonb_typeof"("lap_details") = 'array'::"text") AND ("jsonb_array_length"("lap_details") <= 5000)))),
    CONSTRAINT "activities_source_check" CHECK ((("source" IS NULL) OR ("source" = ANY (ARRAY['strava'::"text", 'manual'::"text"])))),
    CONSTRAINT "activities_streams_taille" CHECK ((("streams_gz" IS NULL) OR ("octet_length"("streams_gz") <= 1000000)))
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


COMMENT ON COLUMN "public"."activities"."streams_gz" IS 'Streams (watts/hr/cadence/altitude/distance) en JSON gzip+base64. Format dans streams_format.';



COMMENT ON COLUMN "public"."activities"."power_curve" IS 'Mean Maximal Power par durée pour cette activité. Sert à recalculer power_profile.';



COMMENT ON COLUMN "public"."activities"."lap_details" IS 'Tours importés d''un fichier FIT : [{index, name, elapsed_time, moving_time, distance}] (distance en m, temps en s). Null pour les activités Strava.';



CREATE TABLE IF NOT EXISTS "public"."activity_edits" (
    "user_id" "uuid" NOT NULL,
    "activity_id" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activity_edits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_planned" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "text",
    "category" "text" DEFAULT 'entrainement'::"text" NOT NULL,
    "name" "text",
    "date" "date" NOT NULL,
    "sport" "text",
    "duration" integer,
    "tss" integer,
    "notes" "text",
    "structure" "jsonb",
    "priority" "text",
    "km" numeric,
    "d_plus" integer,
    "laps" integer,
    "gpx_name" "text",
    "gpx_content" "text",
    "stages" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "event" "text",
    "created_by_ia" boolean DEFAULT false NOT NULL,
    "rpe" numeric,
    "type" "text",
    "start_date_local" timestamp with time zone,
    "tri" "jsonb",
    "federation" "text",
    "race_level" "text",
    "tri_format" "text",
    "est_watts" integer,
    "est_bpm" integer,
    "est_kj" integer,
    "est_if" numeric,
    "est_speed" numeric,
    "programme_id" "uuid",
    "discipline" "text",
    CONSTRAINT "activity_planned_discipline_format" CHECK ((("discipline" IS NULL) OR ("discipline" ~ '^[a-z0-9-]{1,40}$'::"text"))),
    CONSTRAINT "planned_sessions_category_check" CHECK (("category" = ANY (ARRAY['entrainement'::"text", 'competition'::"text"])))
);


ALTER TABLE "public"."activity_planned" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_template" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "text",
    "sport" "text",
    "name" "text" NOT NULL,
    "duration_min" integer,
    "tss" integer,
    "description" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sport_raw" "text",
    "rpe" numeric,
    "distance_km" numeric,
    "dplus" integer,
    "structure" "jsonb",
    "est_watts" integer,
    "est_bpm" integer,
    "est_kj" integer,
    "est_if" numeric,
    "est_speed" numeric
);


ALTER TABLE "public"."activity_template" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."connexions_app" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "app" "text" NOT NULL,
    "external_id" "text",
    "athlete_name" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "scope" "text",
    "first_connected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_sync_at" timestamp with time zone,
    "last_sync_status" "text",
    "last_sync_error" "text",
    "total_activities_synced" integer,
    "secret_id" "uuid",
    CONSTRAINT "connexions_app_app_check" CHECK (("app" = ANY (ARRAY['strava'::"text", 'garmin'::"text"])))
);


ALTER TABLE "public"."connexions_app" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_metrics" (
    "user_id" "uuid" NOT NULL,
    "iso_date" "date" NOT NULL,
    "tss" integer DEFAULT 0,
    "ctl" numeric DEFAULT 0,
    "atl" numeric DEFAULT 0,
    "tsb" numeric DEFAULT 0,
    "duration_min" integer DEFAULT 0,
    "activity_count" integer DEFAULT 0,
    "main_activity_id" "uuid",
    "calculated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."daily_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."day_notes" (
    "user_id" "uuid" NOT NULL,
    "iso_date" "date",
    "text" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "text",
    "type" "text",
    "color" "text",
    "from_date" "date",
    "to_date" "date",
    "created_by_ia" boolean DEFAULT false NOT NULL,
    "details" "jsonb",
    CONSTRAINT "day_notes_details_check" CHECK ((("details" IS NULL) OR (("jsonb_typeof"("details") = 'object'::"text") AND ("pg_column_size"("details") <= 2048))))
);


ALTER TABLE "public"."day_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."garmin_sleep" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "bedtime" "text",
    "wake_time" "text",
    "total_sec" integer,
    "deep_sec" integer,
    "light_sec" integer,
    "rem_sec" integer,
    "awake_sec" integer,
    "awake_count" integer,
    "restless_count" integer,
    "avg_stress" numeric,
    "avg_heart_rate" numeric,
    "body_battery_change" integer,
    "resp_avg" numeric,
    "resp_min" numeric,
    "resp_max" numeric,
    "spo2_avg" numeric,
    "spo2_min" numeric,
    "hrv_avg" numeric,
    "hrv_status" "text",
    "score" integer,
    "score_qualifier" "text",
    "score_detail" "jsonb",
    "segments" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resting_heart_rate" integer,
    "hr_stream" "jsonb"
);


ALTER TABLE "public"."garmin_sleep" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."health_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "metric" "text" NOT NULL,
    "value" double precision NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "health_metrics_date_plage" CHECK ((("date" >= '2000-01-01'::"date") AND ("date" <= '2100-01-01'::"date"))),
    CONSTRAINT "health_metrics_metric_format" CHECK (("metric" ~ '^[a-z][a-z0-9_]{1,39}$'::"text")),
    CONSTRAINT "health_metrics_source_valeur" CHECK (("source" = ANY (ARRAY['manual'::"text", 'garmin'::"text", 'apple_sante'::"text", 'whoop'::"text", 'strava'::"text"]))),
    CONSTRAINT "health_metrics_value_finie" CHECK ((("value" > ('-1000000'::integer)::double precision) AND ("value" < (1000000)::double precision)))
);


ALTER TABLE "public"."health_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."health_metrics" IS 'Données de santé d''un compte : une ligne par jour, mesure et source (manual, garmin, apple_sante, whoop, strava). RLS auth.uid() = user_id, supprimées avec le compte.';



CREATE TABLE IF NOT EXISTS "public"."hyrox_efforts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "activity_id" "uuid",
    "date" "date" NOT NULL,
    "position" smallint NOT NULL,
    "kind" "text" NOT NULL,
    "name" "text",
    "duration_s" integer NOT NULL,
    "distance_m" integer,
    "weight_kg" numeric(6,1),
    "reps" smallint,
    "simulation" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hyrox_efforts_distance_m_check" CHECK ((("distance_m" IS NULL) OR (("distance_m" >= 0) AND ("distance_m" <= 100000)))),
    CONSTRAINT "hyrox_efforts_duration_s_check" CHECK ((("duration_s" >= 1) AND ("duration_s" <= 36000))),
    CONSTRAINT "hyrox_efforts_free_name" CHECK ((("kind" <> 'free'::"text") OR ("name" IS NOT NULL))),
    CONSTRAINT "hyrox_efforts_kind_check" CHECK (("kind" = ANY (ARRAY['run'::"text", 'ski'::"text", 'push'::"text", 'pull'::"text", 'bbj'::"text", 'row'::"text", 'farm'::"text", 'lunge'::"text", 'wall'::"text", 'free'::"text", 'rest'::"text"]))),
    CONSTRAINT "hyrox_efforts_name_check" CHECK ((("name" IS NULL) OR (("char_length"("name") >= 1) AND ("char_length"("name") <= 60)))),
    CONSTRAINT "hyrox_efforts_notes_check" CHECK ((("notes" IS NULL) OR ("char_length"("notes") <= 500))),
    CONSTRAINT "hyrox_efforts_position_check" CHECK ((("position" >= 1) AND ("position" <= 100))),
    CONSTRAINT "hyrox_efforts_reps_check" CHECK ((("reps" IS NULL) OR (("reps" >= 0) AND ("reps" <= 10000)))),
    CONSTRAINT "hyrox_efforts_weight_kg_check" CHECK ((("weight_kg" IS NULL) OR (("weight_kg" >= (0)::numeric) AND ("weight_kg" <= (1000)::numeric))))
);


ALTER TABLE "public"."hyrox_efforts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hyrox_objectif" (
    "user_id" "uuid" NOT NULL,
    "total_s" integer NOT NULL,
    "segments" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hyrox_objectif_segments_check" CHECK ((("segments" IS NULL) OR (("jsonb_typeof"("segments") = 'array'::"text") AND ("jsonb_array_length"("segments") = 16) AND ("pg_column_size"("segments") < 2048)))),
    CONSTRAINT "hyrox_objectif_total_s_check" CHECK ((("total_s" >= 600) AND ("total_s" <= 36000)))
);


ALTER TABLE "public"."hyrox_objectif" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hyrox_tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "label" "text" DEFAULT 'Test'::"text" NOT NULL,
    "kind" "text" DEFAULT 'test'::"text" NOT NULL,
    "segments" "jsonb" NOT NULL,
    "total_s" integer NOT NULL,
    "source" "text" DEFAULT 'manuel'::"text" NOT NULL,
    "activity_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hyrox_tests_kind_check" CHECK (("kind" = ANY (ARRAY['test'::"text", 'course'::"text"]))),
    CONSTRAINT "hyrox_tests_label_check" CHECK ((("char_length"("label") >= 1) AND ("char_length"("label") <= 80))),
    CONSTRAINT "hyrox_tests_notes_check" CHECK ((("notes" IS NULL) OR ("char_length"("notes") <= 500))),
    CONSTRAINT "hyrox_tests_segments" CHECK ((("jsonb_typeof"("segments") = 'array'::"text") AND ("jsonb_array_length"("segments") = 16) AND ("pg_column_size"("segments") < 2048))),
    CONSTRAINT "hyrox_tests_source_check" CHECK (("source" = ANY (ARRAY['manuel'::"text", 'strava'::"text", 'garmin'::"text"]))),
    CONSTRAINT "hyrox_tests_total_s_check" CHECK ((("total_s" >= 0) AND ("total_s" <= 36000)))
);


ALTER TABLE "public"."hyrox_tests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oauth_states" (
    "state" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "return_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "oauth_states_provider_check" CHECK (("provider" = 'strava'::"text"))
);


ALTER TABLE "public"."oauth_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."power_profile" (
    "user_id" "uuid" NOT NULL,
    "duration_s" integer NOT NULL,
    "watts_alltime" integer NOT NULL,
    "watts_90d" integer,
    "achieved_at_alltime" "date",
    "achieved_at_90d" "date",
    "activity_id_alltime" "uuid",
    "activity_id_90d" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."power_profile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."power_profile_sport" (
    "user_id" "uuid" NOT NULL,
    "sport" "text" NOT NULL,
    "1s" integer,
    "2s" integer,
    "3s" integer,
    "4s" integer,
    "5s" integer,
    "6s" integer,
    "7s" integer,
    "8s" integer,
    "9s" integer,
    "10s" integer,
    "11s" integer,
    "12s" integer,
    "13s" integer,
    "14s" integer,
    "15s" integer,
    "20s" integer,
    "25s" integer,
    "30s" integer,
    "45s" integer,
    "1min" integer,
    "2min" integer,
    "3min" integer,
    "4min" integer,
    "5min" integer,
    "6min" integer,
    "7min" integer,
    "8min" integer,
    "9min" integer,
    "10min" integer,
    "12min" integer,
    "15min" integer,
    "20min" integer,
    "25min" integer,
    "30min" integer,
    "35min" integer,
    "40min" integer,
    "45min" integer,
    "1h" integer,
    "1h30" integer,
    "2h" integer,
    "2h30" integer,
    "3h" integer,
    "3h30" integer,
    "4h" integer,
    "4h30" integer,
    "5h" integer,
    "6h" integer,
    "7h" integer,
    "8h" integer,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "activities_count" integer,
    "longest_activity_s" integer,
    "ftp" integer,
    "weight" numeric,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."power_profile_sport" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rest_day" (
    "user_id" "uuid" NOT NULL,
    "iso_date" "date" NOT NULL,
    "created_by_ia" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."rest_day" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."strength_exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "muscle_group" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "strength_exercises_muscle_group_check" CHECK (("muscle_group" = ANY (ARRAY['pectoraux'::"text", 'dos'::"text", 'jambes'::"text", 'epaules'::"text", 'bras'::"text", 'tronc'::"text"]))),
    CONSTRAINT "strength_exercises_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 80)))
);


ALTER TABLE "public"."strength_exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."strength_programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "exercises" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "strength_programs_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 60))),
    CONSTRAINT "strength_programs_notes_check" CHECK ((("notes" IS NULL) OR ("char_length"("notes") <= 500))),
    CONSTRAINT "strength_programs_taille" CHECK (("pg_column_size"("exercises") < 16384))
);


ALTER TABLE "public"."strength_programs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."strength_sets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "exercise_key" "text" NOT NULL,
    "exercise_name" "text" NOT NULL,
    "muscle_group" "text" NOT NULL,
    "position" smallint DEFAULT 0 NOT NULL,
    "set_no" smallint DEFAULT 1 NOT NULL,
    "reps" smallint NOT NULL,
    "weight_kg" numeric(6,1) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rir" smallint,
    CONSTRAINT "strength_sets_exercise_key_check" CHECK ((("char_length"("exercise_key") >= 1) AND ("char_length"("exercise_key") <= 80))),
    CONSTRAINT "strength_sets_exercise_name_check" CHECK ((("char_length"("exercise_name") >= 1) AND ("char_length"("exercise_name") <= 80))),
    CONSTRAINT "strength_sets_muscle_group_check" CHECK (("muscle_group" = ANY (ARRAY['pectoraux'::"text", 'dos'::"text", 'jambes'::"text", 'epaules'::"text", 'bras'::"text", 'tronc'::"text"]))),
    CONSTRAINT "strength_sets_position_check" CHECK ((("position" >= 0) AND ("position" <= 99))),
    CONSTRAINT "strength_sets_reps_check" CHECK ((("reps" >= 0) AND ("reps" <= 1000))),
    CONSTRAINT "strength_sets_rir_borne" CHECK ((("rir" IS NULL) OR (("rir" >= 0) AND ("rir" <= 10)))),
    CONSTRAINT "strength_sets_set_no_check" CHECK ((("set_no" >= 1) AND ("set_no" <= 60))),
    CONSTRAINT "strength_sets_weight_kg_check" CHECK ((("weight_kg" >= (0)::numeric) AND ("weight_kg" <= (2000)::numeric)))
);


ALTER TABLE "public"."strength_sets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_cycles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "from_date" "date" NOT NULL,
    "to_date" "date" NOT NULL,
    "color" "text" NOT NULL,
    "sport" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "training_cycles_color_check" CHECK (("color" ~ '^#[0-9a-fA-F]{6}$'::"text")),
    CONSTRAINT "training_cycles_dates" CHECK ((("to_date" >= "from_date") AND (("to_date" - "from_date") <= 366))),
    CONSTRAINT "training_cycles_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 60))),
    CONSTRAINT "training_cycles_sport" CHECK ((("sport" IS NULL) OR ("sport" = ANY (ARRAY['course'::"text", 'velo'::"text", 'natation'::"text", 'muscu'::"text", 'hyrox'::"text", 'triathlon'::"text", 'duathlon'::"text", 'autre'::"text"]))))
);


ALTER TABLE "public"."training_cycles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_phases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "text",
    "phase" "text" NOT NULL,
    "from_date" "date" NOT NULL,
    "to_date" "date" NOT NULL,
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by_ia" boolean DEFAULT false NOT NULL,
    CONSTRAINT "training_phases_phase_check" CHECK (("phase" = ANY (ARRAY['base'::"text", 'build'::"text", 'peak'::"text", 'taper'::"text", 'recup'::"text"])))
);


ALTER TABLE "public"."training_phases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "user_id" "uuid" NOT NULL,
    "layout" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "theme" "text",
    "sports" "jsonb",
    "disciplines" "jsonb",
    "layout_mobile" "jsonb",
    CONSTRAINT "user_preferences_disciplines_valeur" CHECK ((("disciplines" IS NULL) OR (("jsonb_typeof"("disciplines") = 'object'::"text") AND ("pg_column_size"("disciplines") < 2048)))),
    CONSTRAINT "user_preferences_layout_mobile_taille" CHECK (("pg_column_size"("layout_mobile") < 16384)),
    CONSTRAINT "user_preferences_layout_taille" CHECK (("pg_column_size"("layout") < 16384)),
    CONSTRAINT "user_preferences_sports_valeur" CHECK ((("sports" IS NULL) OR (("jsonb_typeof"("sports") = 'array'::"text") AND ("jsonb_array_length"("sports") <= 20) AND ("pg_column_size"("sports") < 1024)))),
    CONSTRAINT "user_preferences_theme_valeur" CHECK ((("theme" IS NULL) OR ("theme" = ANY (ARRAY['sombre'::"text", 'clair'::"text"]))))
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_preferences" IS 'Préférences d''un compte : layout = disposition de l''accueil (JSON), theme = sombre | clair. Une ligne par utilisateur, RLS auth.uid() = user_id.';



COMMENT ON COLUMN "public"."user_preferences"."layout" IS 'Disposition de l''accueil du SITE (JSON : widgets et tailles S, M, L, XL).';



COMMENT ON COLUMN "public"."user_preferences"."layout_mobile" IS 'Disposition de l''accueil de l''APP MOBILE (JSON : widgets et tailles XS, S, M, L). Null = composition automatique.';



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ftp" integer,
    "hr_max" integer,
    "lthr" integer,
    "weight" numeric,
    "extras" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "user_profiles_extras_taille" CHECK ((("extras" IS NULL) OR ("octet_length"(("extras")::"text") <= 100000)))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."yearly_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "text",
    "year" integer NOT NULL,
    "sport" "text" NOT NULL,
    "template" "text" NOT NULL,
    "target" numeric NOT NULL,
    "current_manual" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "yearly_goals_current_manual_check" CHECK ((("current_manual" IS NULL) OR (("current_manual" >= (0)::numeric) AND ("current_manual" <= (10000000)::numeric)))),
    CONSTRAINT "yearly_goals_sport_check" CHECK (("sport" = ANY (ARRAY['tous'::"text", 'cyclisme'::"text", 'course'::"text", 'natation'::"text", 'musculation'::"text", 'hyrox'::"text", 'triathlon'::"text", 'duathlon'::"text", 'autre'::"text"]))),
    CONSTRAINT "yearly_goals_target_check" CHECK ((("target" > (0)::numeric) AND ("target" <= (10000000)::numeric))),
    CONSTRAINT "yearly_goals_year_check" CHECK ((("year" >= 2000) AND ("year" <= 2100)))
);


ALTER TABLE "public"."yearly_goals" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_user_id_strava_id_key" UNIQUE ("user_id", "strava_id");



ALTER TABLE ONLY "public"."activity_edits"
    ADD CONSTRAINT "activity_overrides_pkey" PRIMARY KEY ("user_id", "activity_id");



ALTER TABLE ONLY "public"."activity_template"
    ADD CONSTRAINT "activity_template_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."connexions_app"
    ADD CONSTRAINT "connexions_app_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."connexions_app"
    ADD CONSTRAINT "connexions_app_user_id_app_key" UNIQUE ("user_id", "app");



ALTER TABLE ONLY "public"."daily_metrics"
    ADD CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("user_id", "iso_date");



ALTER TABLE ONLY "public"."day_notes"
    ADD CONSTRAINT "day_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."day_notes"
    ADD CONSTRAINT "day_notes_type_check" CHECK (("type" = ANY (ARRAY['texte'::"text", 'maladie'::"text", 'blessure'::"text", 'indisponible'::"text"]))) NOT VALID;



ALTER TABLE ONLY "public"."garmin_sleep"
    ADD CONSTRAINT "garmin_sleep_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."garmin_sleep"
    ADD CONSTRAINT "garmin_sleep_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."health_metrics"
    ADD CONSTRAINT "health_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."health_metrics"
    ADD CONSTRAINT "health_metrics_unique" UNIQUE ("user_id", "date", "metric", "source");



ALTER TABLE ONLY "public"."hyrox_efforts"
    ADD CONSTRAINT "hyrox_efforts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hyrox_objectif"
    ADD CONSTRAINT "hyrox_objectif_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."hyrox_tests"
    ADD CONSTRAINT "hyrox_tests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_states"
    ADD CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("state");



ALTER TABLE ONLY "public"."activity_planned"
    ADD CONSTRAINT "planned_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."power_profile"
    ADD CONSTRAINT "power_profile_pkey" PRIMARY KEY ("user_id", "duration_s");



ALTER TABLE ONLY "public"."power_profile_sport"
    ADD CONSTRAINT "power_profile_sport_pkey" PRIMARY KEY ("user_id", "sport");



ALTER TABLE ONLY "public"."strength_exercises"
    ADD CONSTRAINT "strength_exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."strength_programs"
    ADD CONSTRAINT "strength_programs_id_user_unique" UNIQUE ("id", "user_id");



ALTER TABLE ONLY "public"."strength_programs"
    ADD CONSTRAINT "strength_programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."strength_sets"
    ADD CONSTRAINT "strength_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rest_day"
    ADD CONSTRAINT "template_rest_days_pkey" PRIMARY KEY ("user_id", "iso_date");



ALTER TABLE ONLY "public"."training_cycles"
    ADD CONSTRAINT "training_cycles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_phases"
    ADD CONSTRAINT "training_phases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."yearly_goals"
    ADD CONSTRAINT "yearly_goals_pkey" PRIMARY KEY ("id");



CREATE INDEX "activities_merged_into_idx" ON "public"."activities" USING "btree" ("merged_into") WHERE ("merged_into" IS NOT NULL);



CREATE INDEX "activity_template_user_idx" ON "public"."activity_template" USING "btree" ("user_id");



CREATE INDEX "health_metrics_user_date" ON "public"."health_metrics" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "health_metrics_user_metric" ON "public"."health_metrics" USING "btree" ("user_id", "metric", "date" DESC);



CREATE UNIQUE INDEX "hyrox_efforts_activity_position_idx" ON "public"."hyrox_efforts" USING "btree" ("activity_id", "position") WHERE ("activity_id" IS NOT NULL);



CREATE INDEX "hyrox_efforts_user_date_idx" ON "public"."hyrox_efforts" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "hyrox_tests_user_date_idx" ON "public"."hyrox_tests" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_activities_streams_todo" ON "public"."activities" USING "btree" ("user_id", "start_date_local" DESC) WHERE ("streams_synced_at" IS NULL);



CREATE INDEX "idx_activities_user_date" ON "public"."activities" USING "btree" ("user_id", "start_date_local" DESC);



CREATE INDEX "idx_activities_user_sport" ON "public"."activities" USING "btree" ("user_id", "sport");



CREATE INDEX "idx_activity_planned_programme" ON "public"."activity_planned" USING "btree" ("programme_id") WHERE ("programme_id" IS NOT NULL);



CREATE INDEX "idx_activity_planned_user_date" ON "public"."activity_planned" USING "btree" ("user_id", "date");



CREATE INDEX "idx_connexions_app_app_ext" ON "public"."connexions_app" USING "btree" ("app", "external_id");



CREATE INDEX "idx_daily_metrics_main_activity" ON "public"."daily_metrics" USING "btree" ("main_activity_id") WHERE ("main_activity_id" IS NOT NULL);



CREATE INDEX "idx_garmin_sleep_user_date" ON "public"."garmin_sleep" USING "btree" ("user_id", "date");



CREATE INDEX "idx_goals_user_year" ON "public"."yearly_goals" USING "btree" ("user_id", "year");



CREATE INDEX "idx_hyrox_tests_activity" ON "public"."hyrox_tests" USING "btree" ("activity_id") WHERE ("activity_id" IS NOT NULL);



CREATE INDEX "idx_phases_user_range" ON "public"."training_phases" USING "btree" ("user_id", "from_date", "to_date");



CREATE INDEX "idx_power_profile_act_90d" ON "public"."power_profile" USING "btree" ("activity_id_90d") WHERE ("activity_id_90d" IS NOT NULL);



CREATE INDEX "idx_power_profile_act_alltime" ON "public"."power_profile" USING "btree" ("activity_id_alltime") WHERE ("activity_id_alltime" IS NOT NULL);



CREATE INDEX "oauth_states_created_at_idx" ON "public"."oauth_states" USING "btree" ("created_at");



CREATE INDEX "strength_exercises_user_idx" ON "public"."strength_exercises" USING "btree" ("user_id");



CREATE INDEX "strength_programs_user_idx" ON "public"."strength_programs" USING "btree" ("user_id");



CREATE INDEX "strength_sets_activity_idx" ON "public"."strength_sets" USING "btree" ("activity_id");



CREATE INDEX "strength_sets_user_date_idx" ON "public"."strength_sets" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "training_cycles_user_from_idx" ON "public"."training_cycles" USING "btree" ("user_id", "from_date");



CREATE UNIQUE INDEX "yearly_goals_un_objectif_par_modele" ON "public"."yearly_goals" USING "btree" ("user_id", "year", "sport", "template");



CREATE OR REPLACE TRIGGER "activities_recalc_metrics_del" AFTER DELETE ON "public"."activities" REFERENCING OLD TABLE AS "changed_rows" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_recalc_daily_metrics"();



CREATE OR REPLACE TRIGGER "activities_recalc_metrics_ins" AFTER INSERT ON "public"."activities" REFERENCING NEW TABLE AS "changed_rows" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_recalc_daily_metrics"();



CREATE OR REPLACE TRIGGER "activities_recalc_metrics_upd" AFTER UPDATE ON "public"."activities" REFERENCING NEW TABLE AS "changed_rows" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_recalc_daily_metrics"();



CREATE OR REPLACE TRIGGER "connexions_app_delete_secret" AFTER DELETE ON "public"."connexions_app" FOR EACH ROW EXECUTE FUNCTION "public"."trg_connexions_delete_secret"();



CREATE OR REPLACE TRIGGER "health_metrics_garde_fous" BEFORE INSERT OR UPDATE ON "public"."health_metrics" FOR EACH ROW EXECUTE FUNCTION "public"."health_metrics_garde_fous"();



CREATE OR REPLACE TRIGGER "plafond_activities" AFTER INSERT ON "public"."activities" REFERENCING NEW TABLE AS "nouvelles" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_plafond_lignes"('20000');



CREATE OR REPLACE TRIGGER "plafond_activity_edits" AFTER INSERT ON "public"."activity_edits" REFERENCING NEW TABLE AS "nouvelles" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_plafond_lignes"('20000');



CREATE OR REPLACE TRIGGER "plafond_activity_planned" AFTER INSERT ON "public"."activity_planned" REFERENCING NEW TABLE AS "nouvelles" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_plafond_lignes"('10000');



CREATE OR REPLACE TRIGGER "plafond_activity_template" AFTER INSERT ON "public"."activity_template" REFERENCING NEW TABLE AS "nouvelles" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_plafond_lignes"('2000');



CREATE OR REPLACE TRIGGER "plafond_day_notes" AFTER INSERT ON "public"."day_notes" REFERENCING NEW TABLE AS "nouvelles" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_plafond_lignes"('20000');



CREATE OR REPLACE TRIGGER "plafond_hyrox_efforts" AFTER INSERT ON "public"."hyrox_efforts" REFERENCING NEW TABLE AS "nouvelles" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_plafond_lignes"('50000');



CREATE OR REPLACE TRIGGER "plafond_hyrox_tests" AFTER INSERT ON "public"."hyrox_tests" REFERENCING NEW TABLE AS "nouvelles" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_plafond_lignes"('5000');



CREATE OR REPLACE TRIGGER "plafond_rest_day" AFTER INSERT ON "public"."rest_day" REFERENCING NEW TABLE AS "nouvelles" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_plafond_lignes"('20000');



CREATE OR REPLACE TRIGGER "plafond_strength_exercises" AFTER INSERT ON "public"."strength_exercises" REFERENCING NEW TABLE AS "nouvelles" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_plafond_lignes"('1000');



CREATE OR REPLACE TRIGGER "plafond_strength_programs" AFTER INSERT ON "public"."strength_programs" REFERENCING NEW TABLE AS "nouvelles" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_plafond_lignes"('500');



CREATE OR REPLACE TRIGGER "plafond_strength_sets" AFTER INSERT ON "public"."strength_sets" REFERENCING NEW TABLE AS "nouvelles" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_plafond_lignes"('200000');



CREATE OR REPLACE TRIGGER "plafond_training_cycles" AFTER INSERT ON "public"."training_cycles" REFERENCING NEW TABLE AS "nouvelles" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_plafond_lignes"('1000');



CREATE OR REPLACE TRIGGER "plafond_training_phases" AFTER INSERT ON "public"."training_phases" REFERENCING NEW TABLE AS "nouvelles" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_plafond_lignes"('2000');



CREATE OR REPLACE TRIGGER "plafond_yearly_goals" AFTER INSERT ON "public"."yearly_goals" REFERENCING NEW TABLE AS "nouvelles" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_plafond_lignes"('1000');



CREATE OR REPLACE TRIGGER "training_cycles_max2" BEFORE INSERT OR UPDATE OF "user_id", "from_date", "to_date" ON "public"."training_cycles" FOR EACH ROW EXECUTE FUNCTION "public"."trg_training_cycles_max2"();



CREATE OR REPLACE TRIGGER "trg_activities_updated_at" BEFORE UPDATE ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_day_notes_updated_at" BEFORE UPDATE ON "public"."day_notes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_power_profile_updated_at" BEFORE UPDATE ON "public"."power_profile" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_yearly_goals_updated_at" BEFORE UPDATE ON "public"."yearly_goals" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_merged_into_fkey" FOREIGN KEY ("merged_into") REFERENCES "public"."activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_edits"
    ADD CONSTRAINT "activity_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_planned"
    ADD CONSTRAINT "activity_planned_programme_fk" FOREIGN KEY ("programme_id", "user_id") REFERENCES "public"."strength_programs"("id", "user_id") ON DELETE SET NULL ("programme_id");



ALTER TABLE ONLY "public"."activity_template"
    ADD CONSTRAINT "activity_template_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."connexions_app"
    ADD CONSTRAINT "connexions_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_metrics"
    ADD CONSTRAINT "daily_metrics_main_activity_id_fkey" FOREIGN KEY ("main_activity_id") REFERENCES "public"."activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_metrics"
    ADD CONSTRAINT "daily_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."day_notes"
    ADD CONSTRAINT "day_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."garmin_sleep"
    ADD CONSTRAINT "garmin_sleep_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."health_metrics"
    ADD CONSTRAINT "health_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hyrox_efforts"
    ADD CONSTRAINT "hyrox_efforts_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hyrox_efforts"
    ADD CONSTRAINT "hyrox_efforts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hyrox_objectif"
    ADD CONSTRAINT "hyrox_objectif_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hyrox_tests"
    ADD CONSTRAINT "hyrox_tests_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hyrox_tests"
    ADD CONSTRAINT "hyrox_tests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oauth_states"
    ADD CONSTRAINT "oauth_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_planned"
    ADD CONSTRAINT "planned_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."power_profile"
    ADD CONSTRAINT "power_profile_activity_id_90d_fkey" FOREIGN KEY ("activity_id_90d") REFERENCES "public"."activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."power_profile"
    ADD CONSTRAINT "power_profile_activity_id_alltime_fkey" FOREIGN KEY ("activity_id_alltime") REFERENCES "public"."activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."power_profile_sport"
    ADD CONSTRAINT "power_profile_sport_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."power_profile"
    ADD CONSTRAINT "power_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."strength_exercises"
    ADD CONSTRAINT "strength_exercises_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."strength_programs"
    ADD CONSTRAINT "strength_programs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."strength_sets"
    ADD CONSTRAINT "strength_sets_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."strength_sets"
    ADD CONSTRAINT "strength_sets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rest_day"
    ADD CONSTRAINT "template_rest_days_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_cycles"
    ADD CONSTRAINT "training_cycles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_phases"
    ADD CONSTRAINT "training_phases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."yearly_goals"
    ADD CONSTRAINT "yearly_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can manage their own activity_edits" ON "public"."activity_edits" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own day_notes" ON "public"."day_notes" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own template_rest_days" ON "public"."rest_day" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own training_phases" ON "public"."training_phases" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own user_profiles" ON "public"."user_profiles" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own yearly_goals" ON "public"."yearly_goals" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own activity_planned" ON "public"."activity_planned" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage their own activities" ON "public"."activities" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage their own daily metrics" ON "public"."daily_metrics" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage their own power profile" ON "public"."power_profile" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_edits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_planned" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_template" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."connexions_app" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "connexions_app_select_own" ON "public"."connexions_app" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."daily_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."day_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."garmin_sleep" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "garmin_sleep_delete_own" ON "public"."garmin_sleep" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "garmin_sleep_insert_own" ON "public"."garmin_sleep" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "garmin_sleep_select_own" ON "public"."garmin_sleep" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "garmin_sleep_update_own" ON "public"."garmin_sleep" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."health_metrics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "health_metrics_delete_own" ON "public"."health_metrics" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "health_metrics_insert_own" ON "public"."health_metrics" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "health_metrics_select_own" ON "public"."health_metrics" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "health_metrics_update_own" ON "public"."health_metrics" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."hyrox_efforts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hyrox_efforts_delete_own" ON "public"."hyrox_efforts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "hyrox_efforts_insert_own" ON "public"."hyrox_efforts" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (("activity_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "hyrox_efforts"."activity_id") AND ("a"."user_id" = "auth"."uid"())))))));



CREATE POLICY "hyrox_efforts_select_own" ON "public"."hyrox_efforts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "hyrox_efforts_update_own" ON "public"."hyrox_efforts" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND (("activity_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "hyrox_efforts"."activity_id") AND ("a"."user_id" = "auth"."uid"())))))));



ALTER TABLE "public"."hyrox_objectif" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hyrox_objectif_delete_own" ON "public"."hyrox_objectif" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "hyrox_objectif_insert_own" ON "public"."hyrox_objectif" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "hyrox_objectif_select_own" ON "public"."hyrox_objectif" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "hyrox_objectif_update_own" ON "public"."hyrox_objectif" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."hyrox_tests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hyrox_tests_delete_own" ON "public"."hyrox_tests" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "hyrox_tests_insert_own" ON "public"."hyrox_tests" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (("activity_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "hyrox_tests"."activity_id") AND ("a"."user_id" = "auth"."uid"())))))));



CREATE POLICY "hyrox_tests_select_own" ON "public"."hyrox_tests" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "hyrox_tests_update_own" ON "public"."hyrox_tests" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND (("activity_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "hyrox_tests"."activity_id") AND ("a"."user_id" = "auth"."uid"())))))));



ALTER TABLE "public"."oauth_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."power_profile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."power_profile_sport" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "power_profile_sport_select_own" ON "public"."power_profile_sport" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."rest_day" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."strength_exercises" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "strength_exercises_delete_own" ON "public"."strength_exercises" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "strength_exercises_insert_own" ON "public"."strength_exercises" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "strength_exercises_select_own" ON "public"."strength_exercises" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "strength_exercises_update_own" ON "public"."strength_exercises" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."strength_programs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "strength_programs_delete_own" ON "public"."strength_programs" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "strength_programs_insert_own" ON "public"."strength_programs" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "strength_programs_select_own" ON "public"."strength_programs" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "strength_programs_update_own" ON "public"."strength_programs" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."strength_sets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "strength_sets_delete_own" ON "public"."strength_sets" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "strength_sets_insert_own" ON "public"."strength_sets" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (("activity_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "strength_sets"."activity_id") AND ("a"."user_id" = "auth"."uid"())))))));



CREATE POLICY "strength_sets_select_own" ON "public"."strength_sets" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "strength_sets_update_own" ON "public"."strength_sets" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND (("activity_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "strength_sets"."activity_id") AND ("a"."user_id" = "auth"."uid"())))))));



CREATE POLICY "tpl_delete_own" ON "public"."activity_template" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "tpl_insert_own" ON "public"."activity_template" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "tpl_select_own" ON "public"."activity_template" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "tpl_update_own" ON "public"."activity_template" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."training_cycles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "training_cycles_delete_own" ON "public"."training_cycles" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "training_cycles_insert_own" ON "public"."training_cycles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "training_cycles_select_own" ON "public"."training_cycles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "training_cycles_update_own" ON "public"."training_cycles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."training_phases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_preferences_delete_own" ON "public"."user_preferences" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_preferences_insert_own" ON "public"."user_preferences" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_preferences_select_own" ON "public"."user_preferences" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_preferences_update_own" ON "public"."user_preferences" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."yearly_goals" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."health_metrics_garde_fous"() TO "anon";
GRANT ALL ON FUNCTION "public"."health_metrics_garde_fous"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."health_metrics_garde_fous"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."recalc_daily_metrics"("p_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recalc_daily_metrics"("p_user" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_connection_secrets"("p_user_id" "uuid", "p_app" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_connection_secrets"("p_user_id" "uuid", "p_app" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_purge_compte"("p_user" "uuid", "p_lot" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_purge_compte"("p_user" "uuid", "p_lot" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_remplacer_power_profile"("p_user" "uuid", "p_rows" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_remplacer_power_profile"("p_user" "uuid", "p_rows" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_remplacer_power_profile_sport"("p_user" "uuid", "p_rows" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_remplacer_power_profile_sport"("p_user" "uuid", "p_rows" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_save_connection_secrets"("p_user_id" "uuid", "p_app" "text", "p_payload" "jsonb", "p_expires_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_save_connection_secrets"("p_user_id" "uuid", "p_app" "text", "p_payload" "jsonb", "p_expires_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_connexions_delete_secret"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_connexions_delete_secret"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_plafond_lignes"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_plafond_lignes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_plafond_lignes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_recalc_daily_metrics"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_recalc_daily_metrics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_training_cycles_max2"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_training_cycles_max2"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_training_cycles_max2"() TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."activity_edits" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_edits" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."activity_planned" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_planned" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."activity_template" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_template" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."connexions_app" TO "authenticated";
GRANT ALL ON TABLE "public"."connexions_app" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."connexions_app" TO "authenticated";



GRANT SELECT("user_id") ON TABLE "public"."connexions_app" TO "authenticated";



GRANT SELECT("app") ON TABLE "public"."connexions_app" TO "authenticated";



GRANT SELECT("external_id") ON TABLE "public"."connexions_app" TO "authenticated";



GRANT SELECT("athlete_name") ON TABLE "public"."connexions_app" TO "authenticated";



GRANT SELECT("scope") ON TABLE "public"."connexions_app" TO "authenticated";



GRANT SELECT("first_connected_at") ON TABLE "public"."connexions_app" TO "authenticated";



GRANT SELECT("last_sync_at") ON TABLE "public"."connexions_app" TO "authenticated";



GRANT SELECT("last_sync_status") ON TABLE "public"."connexions_app" TO "authenticated";



GRANT SELECT("last_sync_error") ON TABLE "public"."connexions_app" TO "authenticated";



GRANT SELECT("total_activities_synced") ON TABLE "public"."connexions_app" TO "authenticated";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."daily_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_metrics" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."day_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."day_notes" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."garmin_sleep" TO "authenticated";
GRANT ALL ON TABLE "public"."garmin_sleep" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."health_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."health_metrics" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."hyrox_efforts" TO "authenticated";
GRANT ALL ON TABLE "public"."hyrox_efforts" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."hyrox_objectif" TO "authenticated";
GRANT ALL ON TABLE "public"."hyrox_objectif" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."hyrox_tests" TO "authenticated";
GRANT ALL ON TABLE "public"."hyrox_tests" TO "service_role";



GRANT ALL ON TABLE "public"."oauth_states" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."power_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."power_profile" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."power_profile_sport" TO "authenticated";
GRANT ALL ON TABLE "public"."power_profile_sport" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."rest_day" TO "authenticated";
GRANT ALL ON TABLE "public"."rest_day" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."strength_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."strength_exercises" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."strength_programs" TO "authenticated";
GRANT ALL ON TABLE "public"."strength_programs" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."strength_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."strength_sets" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."training_cycles" TO "authenticated";
GRANT ALL ON TABLE "public"."training_cycles" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."training_phases" TO "authenticated";
GRANT ALL ON TABLE "public"."training_phases" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."yearly_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."yearly_goals" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







