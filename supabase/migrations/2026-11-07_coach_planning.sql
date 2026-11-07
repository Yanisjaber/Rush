-- ============================================================
-- IA de Rush : appliquer un PLAN de modifications du calendrier en une seule fois, et le défaire (7/11/2026).
--
-- Le coach ne modifie jamais le calendrier tout seul : il propose une carte « planning » (déplacer, supprimer, ajouter des
-- séances, déclarer une maladie ou une blessure). Quand l'utilisateur la valide, l'Edge Function revérifie tout puis appelle
-- coach_appliquer_plan avec le JETON DE L'UTILISATEUR (donc la RLS s'applique, comme pour une écriture faite à la main).
--
-- Sécurité :
--   - security invoker : chaque ligne lue ou écrite doit appartenir à auth.uid() (policies des tables), sinon rien ne passe.
--   - UNE transaction : si une seule opération échoue, AUCUNE n'est appliquée.
--   - Seules les séances d'entraînement sont touchées (jamais une compétition, jamais la ligne d'un autre compte).
--   - Bornes imposées ici (16 opérations, durée, charge, 60 jours de période), pas seulement par l'Edge Function.
--   - Une séance trop volumineuse (fichier GPX, structure détaillée) n'est jamais supprimée : l'annulation ne pourrait pas
--     la restituer entièrement.
--   - L'annulation ne supprime QUE ce que le coach a créé (created_by_ia), jamais ce que l'utilisateur a ajouté lui-même.
--
-- Relançable sans risque. Test local : bash supabase/tests/sql/coach_planning.sh
-- ============================================================

-- Les cartes de planning portent leur aperçu et de quoi annuler : 24 Ko au lieu de 8 Ko (toujours 3 cartes au plus par message)
alter table public.chat_messages drop constraint if exists chat_messages_cartes_check;
alter table public.chat_messages add constraint chat_messages_cartes_check
  check (cartes is null or (jsonb_typeof(cartes) = 'array' and jsonb_array_length(cartes) <= 3 and pg_column_size(cartes) <= 24576));

create or replace function public.coach_appliquer_plan(p_ops jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_op jsonb;
  v_inverse jsonb := '[]'::jsonb;
  v_id uuid;
  v_vers date;
  v_ancienne date;
  v_ancien_debut timestamptz;
  v_ligne jsonb;
  v_du date;
  v_au date;
  v_type text;
  v_duree integer;
  v_tss integer;
begin
  if v_uid is null then
    raise exception 'non_connecte';
  end if;
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) not between 1 and 16 then
    raise exception 'ops_invalides';
  end if;

  for v_op in select value from jsonb_array_elements(p_ops) loop
    if jsonb_typeof(v_op) <> 'object' then
      raise exception 'ops_invalides';
    end if;

    case v_op ->> 'op'
      when 'deplacer' then
        v_id := (v_op ->> 'seance_id')::uuid;
        v_vers := (v_op ->> 'vers')::date;
        select date, start_date_local into v_ancienne, v_ancien_debut
          from public.activity_planned
          where id = v_id and user_id = v_uid and category = 'entrainement'
          for update;
        if not found then
          raise exception 'seance_introuvable';
        end if;
        -- L'heure de la séance ne change pas, seulement son jour
        update public.activity_planned
           set date = v_vers,
               start_date_local = case when v_ancien_debut is null then null else (v_vers + (v_ancien_debut at time zone 'UTC')::time) at time zone 'UTC' end,
               updated_at = now()
         where id = v_id and user_id = v_uid;
        v_inverse := v_inverse || jsonb_build_array(jsonb_build_object('op', 'deplacer', 'seance_id', v_id, 'vers', v_ancienne, 'debut', v_ancien_debut));

      when 'supprimer' then
        v_id := (v_op ->> 'seance_id')::uuid;
        select to_jsonb(a) into v_ligne
          from public.activity_planned a
          where a.id = v_id and a.user_id = v_uid and a.category = 'entrainement'
          for update;
        if v_ligne is null then
          raise exception 'seance_introuvable';
        end if;
        if pg_column_size(v_ligne) > 4000 then
          raise exception 'seance_trop_lourde';
        end if;
        delete from public.activity_planned where id = v_id and user_id = v_uid;
        v_inverse := v_inverse || jsonb_build_array(jsonb_build_object('op', 'recreer', 'ligne', v_ligne));

      when 'ajouter' then
        v_vers := (v_op ->> 'date')::date;
        v_duree := (v_op ->> 'duration')::integer;
        v_tss := (v_op ->> 'tss')::integer;
        if coalesce(v_op ->> 'sport', '') not in ('Ride', 'Run', 'Swim') or v_duree not between 1 and 600 or v_tss not between 0 and 1000 then
          raise exception 'seance_invalide';
        end if;
        insert into public.activity_planned (user_id, category, name, date, start_date_local, sport, duration, tss, notes, created_by_ia, client_id)
        values (v_uid, 'entrainement', left(coalesce(v_op ->> 'name', 'Séance'), 120), v_vers, (v_op ->> 'start')::timestamptz, v_op ->> 'sport',
                v_duree, v_tss, left(v_op ->> 'notes', 500), true, left(v_op ->> 'client_id', 80))
        returning id into v_id;
        v_inverse := v_inverse || jsonb_build_array(jsonb_build_object('op', 'retirer', 'seance_id', v_id));

      when 'indisponibilite' then
        v_type := v_op ->> 'type';
        v_du := (v_op ->> 'du')::date;
        v_au := (v_op ->> 'au')::date;
        if coalesce(v_type, '') not in ('maladie', 'blessure', 'indisponible') or v_au < v_du or v_au - v_du + 1 > 60 then
          raise exception 'periode_invalide';
        end if;
        -- Mêmes couleurs que l'application (native/src/data/calendrier/ajouts.ts)
        insert into public.day_notes (user_id, type, text, color, from_date, to_date, details, created_by_ia, client_id)
        values (v_uid, v_type, null,
                case v_type when 'maladie' then '#fbbf24' when 'blessure' then '#f87171' else '#94a3b8' end,
                v_du, v_au, null, true, left(v_op ->> 'client_id', 80))
        returning id into v_id;
        v_inverse := v_inverse || jsonb_build_array(jsonb_build_object('op', 'retirer_note', 'note_id', v_id));

      else
        raise exception 'op_inconnue';
    end case;
  end loop;

  -- De quoi tout défaire doit tenir dans la carte
  if pg_column_size(v_inverse) > 16000 then
    raise exception 'annulation_trop_lourde';
  end if;
  return v_inverse;
end;
$$;

-- Défait un plan appliqué (l'« inverse » rendu par coach_appliquer_plan), dans l'ordre inverse. Au mieux : une ligne que
-- l'utilisateur a déjà modifiée ou supprimée à la main est ignorée et comptée, jamais forcée.
create or replace function public.coach_annuler_plan(p_inverse jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_i integer;
  v_op jsonb;
  v_ok integer := 0;
  v_ignore integer := 0;
  v_n integer;
begin
  if v_uid is null then
    raise exception 'non_connecte';
  end if;
  if p_inverse is null or jsonb_typeof(p_inverse) <> 'array' or jsonb_array_length(p_inverse) not between 1 and 16 then
    raise exception 'ops_invalides';
  end if;

  for v_i in reverse (jsonb_array_length(p_inverse) - 1) .. 0 loop
    v_op := p_inverse -> v_i;
    case v_op ->> 'op'
      when 'deplacer' then
        update public.activity_planned
           set date = (v_op ->> 'vers')::date, start_date_local = (v_op ->> 'debut')::timestamptz, updated_at = now()
         where id = (v_op ->> 'seance_id')::uuid and user_id = v_uid;
      when 'recreer' then
        insert into public.activity_planned
          select * from jsonb_populate_record(null::public.activity_planned, v_op -> 'ligne')
          where (v_op -> 'ligne' ->> 'user_id')::uuid = v_uid
          on conflict (id) do nothing;
      when 'retirer' then
        delete from public.activity_planned where id = (v_op ->> 'seance_id')::uuid and user_id = v_uid and created_by_ia = true;
      when 'retirer_note' then
        delete from public.day_notes where id = (v_op ->> 'note_id')::uuid and user_id = v_uid and created_by_ia = true;
      else
        raise exception 'op_inconnue';
    end case;
    get diagnostics v_n = row_count;
    if v_n > 0 then v_ok := v_ok + 1; else v_ignore := v_ignore + 1; end if;
  end loop;

  return jsonb_build_object('annulees', v_ok, 'ignorees', v_ignore);
end;
$$;

-- Garde (ou retire, avec p_inverse null) de quoi annuler dans la carte du message. Réservé à l'Edge Function.
create or replace function public.coach_carte_inverse(p_user uuid, p_carte text, p_inverse jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  v_elem jsonb;
  v_liste jsonb := '[]'::jsonb;
  v_trouvee boolean := false;
begin
  if p_user is null or p_carte is null then
    return false;
  end if;
  select id, cartes into m
  from public.chat_messages
  where user_id = p_user and cartes @> jsonb_build_array(jsonb_build_object('id', p_carte))
  order by created_at desc limit 1
  for update;
  if not found then
    return false;
  end if;
  for v_elem in select * from jsonb_array_elements(m.cartes) loop
    if v_elem ->> 'id' = p_carte then
      v_trouvee := true;
      v_elem := case when p_inverse is null then v_elem - 'inverse' else v_elem || jsonb_build_object('inverse', p_inverse) end;
    end if;
    v_liste := v_liste || jsonb_build_array(v_elem);
  end loop;
  update public.chat_messages set cartes = v_liste where id = m.id;
  return v_trouvee;
end;
$$;

revoke all on function public.coach_appliquer_plan(jsonb) from public, anon;
grant execute on function public.coach_appliquer_plan(jsonb) to authenticated;
revoke all on function public.coach_annuler_plan(jsonb) from public, anon;
grant execute on function public.coach_annuler_plan(jsonb) to authenticated;
revoke all on function public.coach_carte_inverse(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.coach_carte_inverse(uuid, text, jsonb) to service_role;
