// Configuration Supabase de l'app (la même que celle du site : app/src/lib/config.js).
// L'URL et la clé « publishable » (ex-« anon ») sont PUBLIQUES par conception :
// c'est la RLS en base qui protège les données, jamais le secret de cette clé.
// Ne JAMAIS mettre ici une clé secrète (sb_secret_…) ni la clé service_role.
export const SUPABASE_URL = 'https://gfavgstyyaaidkpadkxz.supabase.co';
export const SUPABASE_CLE_PUBLIQUE = 'sb_publishable_vELRpICmyNukrxYCojbsIw_GzxeXGRk';
