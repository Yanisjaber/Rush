import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_CLE_PUBLIQUE } from './config.js';

// Client Supabase unique de l'app.
// - La session est mémorisée par le navigateur (localStorage) avec la clé par défaut de la bibliothèque :
//   la connexion est donc partagée entre les onglets du navigateur.
// - detectSessionInUrl désactivé : on n'utilise pas (encore) de lien magique ni d'OAuth par redirection.
// - Toute la sécurité repose sur la RLS en base (auth.uid() = user_id), pas sur cette clé publique.
export const sb = createClient(SUPABASE_URL, SUPABASE_CLE_PUBLIQUE, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
