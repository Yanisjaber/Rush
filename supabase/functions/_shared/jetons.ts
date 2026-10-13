// Jetons des connexions (Strava, Garmin) : lus et écrits UNIQUEMENT via les fonctions SQL `rpc_connection_secrets` et
// `rpc_save_connection_secrets`, qui les chiffrent dans Supabase Vault. À n'utiliser qu'avec un client `service_role`.
// Aucun jeton ne doit jamais être journalisé, ni renvoyé au navigateur.
// deno-lint-ignore-file no-explicit-any

export type Jetons = {
  access_token?: string | null;
  refresh_token?: string | null;
  oauth1_token?: string | null;
  oauth1_secret?: string | null;
};

/** Jetons déchiffrés d'une connexion, ou null si elle n'existe pas (ou en cas d'erreur : jamais de détail dans les journaux). */
export async function lireJetons(sb: any, userId: string, app: string): Promise<Jetons | null> {
  const { data, error } = await sb.rpc("rpc_connection_secrets", { p_user_id: userId, p_app: app });
  if (error) {
    console.error("lireJetons a échoué", error.code || "");
    return null;
  }
  return (data as Jetons) ?? null;
}

/** Enregistre (en fusionnant avec l'existant) les jetons d'une connexion existante ; `expiresAtIso` met aussi à jour son expiration. */
export async function ecrireJetons(sb: any, userId: string, app: string, jetons: Jetons, expiresAtIso?: string | null): Promise<void> {
  const { error } = await sb.rpc("rpc_save_connection_secrets", {
    p_user_id: userId,
    p_app: app,
    p_payload: jetons,
    p_expires_at: expiresAtIso ?? null,
  });
  if (error) {
    console.error("ecrireJetons a échoué", error.code || "");
    throw new Error("token_save_failed");
  }
}

/** Complète une ligne de connexion avec ses jetons déchiffrés (access_token, refresh_token, oauth1_*). Renvoie la même ligne. */
export async function joindreJetons(sb: any, conn: any): Promise<any> {
  const j = (await lireJetons(sb, conn.user_id, conn.app || "strava")) || {};
  conn.access_token = j.access_token ?? null;
  conn.refresh_token = j.refresh_token ?? null;
  conn.oauth1_token = j.oauth1_token ?? null;
  conn.oauth1_secret = j.oauth1_secret ?? null;
  return conn;
}

/** Enregistre le résultat d'un renouvellement de jeton Strava ({ access_token, refresh_token, expires_at en secondes }). */
export async function ecrireRenouvellementStrava(sb: any, userId: string, refreshed: any): Promise<void> {
  await ecrireJetons(
    sb,
    userId,
    "strava",
    { access_token: refreshed.access_token, refresh_token: refreshed.refresh_token },
    new Date(refreshed.expires_at * 1000).toISOString(),
  );
}
