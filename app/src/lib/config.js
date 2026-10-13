// Configuration Supabase de l'app.
// L'URL et la clé « publishable » (ex-« anon ») sont PUBLIQUES par conception :
// c'est la RLS en base qui protège les données, jamais le secret de cette clé.
// Ne JAMAIS mettre ici une clé secrète (sb_secret_…) ni la clé service_role.
export const SUPABASE_URL = 'https://gfavgstyyaaidkpadkxz.supabase.co';
export const SUPABASE_CLE_PUBLIQUE = 'sb_publishable_vELRpICmyNukrxYCojbsIw_GzxeXGRk';

// Strava : l'identifiant client est PUBLIC (visible dans l'adresse d'autorisation). Le secret n'est jamais ici :
// l'échange du code contre les jetons est fait côté serveur (Edge Function strava-oauth-callback).
export const STRAVA_CLIENT_ID = '248376';
export const STRAVA_REDIRECT_URI = `${SUPABASE_URL}/functions/v1/strava-oauth-callback`;
