import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { SUPABASE_CLE_PUBLIQUE, SUPABASE_URL } from '@/config';
import { stockageSecurise } from './stockage-securise';

// Client Supabase unique de l'app.
// - La session est gardée dans le Trousseau iOS (voir stockage-securise.ts), pas dans un stockage lisible.
// - detectSessionInUrl désactivé : pas de redirection OAuth dans l'URL (les liens de confirmation passeront par un lien profond plus tard).
// - Toute la sécurité repose sur la RLS en base (auth.uid() = user_id), pas sur cette clé publique.
export const sb = createClient(SUPABASE_URL, SUPABASE_CLE_PUBLIQUE, {
  auth: {
    storage: stockageSecurise,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Sur mobile, on ne rafraîchit la session que lorsque l'app est au premier plan (économie de batterie, et pas de requête en arrière-plan).
AppState.addEventListener('change', (etat) => {
  if (etat === 'active') sb.auth.startAutoRefresh();
  else sb.auth.stopAutoRefresh();
});
