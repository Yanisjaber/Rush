// Configuration Supabase de la v2.
// L'URL et la clé « publishable » (ex-« anon ») sont PUBLIQUES par conception (mêmes valeurs
// que la v1) : c'est la RLS en base qui protège les données, jamais le secret de cette clé.
// Ne JAMAIS mettre ici une clé secrète (sb_secret_…) ni la clé service_role.
export const SUPABASE_URL = 'https://gfavgstyyaaidkpadkxz.supabase.co';
export const SUPABASE_CLE_PUBLIQUE = 'sb_publishable_vELRpICmyNukrxYCojbsIw_GzxeXGRk';
