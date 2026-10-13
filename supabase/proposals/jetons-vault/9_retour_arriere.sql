-- Jetons des connexions : RETOUR ARRIÈRE (à utiliser seulement si la phase 2a ou 2b a été appliquée puis qu'il faut revenir aux anciennes fonctions).
-- Remet les jetons EN CLAIR dans les anciennes colonnes à partir du coffre, pour que les anciennes versions des Edge Functions et du Pi refonctionnent.
-- (Avant la phase 2, rien à faire : le clair est tenu à jour par l'écriture double.)
update public.connexions_app c set
  access_token  = s.j ->> 'access_token',
  refresh_token = s.j ->> 'refresh_token',
  oauth1_token  = s.j ->> 'oauth1_token',
  oauth1_secret = s.j ->> 'oauth1_secret'
from (select id, public.rpc_connection_secrets(user_id, app) as j from public.connexions_app) s
where c.id = s.id and s.j is not null;
