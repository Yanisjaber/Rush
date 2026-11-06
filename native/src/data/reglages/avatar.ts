// Photo de profil : règles pures (sans réseau).
// La photo vit dans le bucket privé « avatars », un seul fichier par compte : `<id utilisateur>/avatar.jpg`.
// Le chemin est gardé dans user_profiles.extras.avatar_path ; on ne l'utilise que s'il pointe bien vers le dossier du compte connecté.

export const BUCKET_AVATAR = 'avatars';
/** Poids maximal d'une photo envoyée (le bucket refuse au-delà de 2 Mo). */
export const POIDS_MAX_AVATAR = 2 * 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Le chemin du fichier d'un compte, ou null si l'identifiant n'a pas la forme d'un UUID. */
export function cheminAvatar(userId: string): string | null {
  return UUID.test(userId) ? `${userId.toLowerCase()}/avatar.jpg` : null;
}

/** Le chemin enregistré dans les extras du profil, s'il est valide pour CE compte ; sinon null (pas de photo). */
export function lireCheminAvatar(extras: unknown, userId: string): string | null {
  if (!extras || typeof extras !== 'object') return null;
  const brut = (extras as Record<string, unknown>).avatar_path;
  const attendu = cheminAvatar(userId);
  return attendu && typeof brut === 'string' && brut === attendu ? brut : null;
}

/** Les extras avec la photo posée (chemin) ou retirée (null), sans toucher aux autres clés. */
export function extrasAvecAvatar(extras: unknown, chemin: string | null): Record<string, unknown> {
  const suite: Record<string, unknown> = extras && typeof extras === 'object' ? { ...(extras as Record<string, unknown>) } : {};
  if (chemin) suite.avatar_path = chemin;
  else delete suite.avatar_path;
  return suite;
}
