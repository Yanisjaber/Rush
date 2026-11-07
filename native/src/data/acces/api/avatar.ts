import { sb } from '../supabase';
import { BUCKET_AVATAR, POIDS_MAX_AVATAR, cheminAvatar, extrasAvecAvatar, lireCheminAvatar } from '../../reglages/avatar.ts';
import type { Resultat } from './commun';
import { chargerProfilComplet, enregistrerProfil } from './reglages';

// Photo de profil : bucket privé « avatars », dossier = id du compte (RLS côté base). On lit la photo par un lien signé qui expire vite.
const DUREE_LIEN_S = 3600;

/** Le lien (temporaire) vers la photo du compte, ou null s'il n'en a pas. Une erreur de lecture se traite comme « pas de photo ». */
export async function chargerUrlAvatar(userId: string): Promise<string | null> {
  const profil = await chargerProfilComplet(userId);
  const chemin = lireCheminAvatar(profil.data?.extras, userId);
  if (!chemin) return null;
  const r = await sb.storage.from(BUCKET_AVATAR).createSignedUrl(chemin, DUREE_LIEN_S);
  return r.error ? null : r.data.signedUrl;
}

/** Envoie la photo choisie (fichier local déjà recadré en carré), garde son chemin dans le profil et renvoie le lien pour l'afficher. */
export async function envoyerAvatar(userId: string, uriLocale: string): Promise<Resultat<string>> {
  const chemin = cheminAvatar(userId);
  if (!chemin) return { data: null, erreur: 'Reconnecte-toi puis réessaie.' };
  let octets: ArrayBuffer;
  try {
    octets = await (await fetch(uriLocale)).arrayBuffer();
  } catch {
    return { data: null, erreur: 'Impossible de lire cette photo.' };
  }
  if (octets.byteLength > POIDS_MAX_AVATAR) return { data: null, erreur: 'Cette photo est trop lourde (2 Mo maximum). Choisis-en une plus légère.' };
  const envoi = await sb.storage.from(BUCKET_AVATAR).upload(chemin, octets, { contentType: 'image/jpeg', upsert: true });
  if (envoi.error) {
    console.error('[app/api] avatar', envoi.error.message?.slice(0, 80));
    return { data: null, erreur: "Impossible d'envoyer la photo. Vérifie ta connexion puis réessaie." };
  }
  const profil = await chargerProfilComplet(userId);
  if (!profil.data) return { data: null, erreur: profil.erreur || 'Profil introuvable : reconnecte-toi puis réessaie.' };
  const maj = await enregistrerProfil(userId, {}, extrasAvecAvatar(profil.data.extras, chemin));
  if (maj.erreur) return { data: null, erreur: maj.erreur };
  const lien = await sb.storage.from(BUCKET_AVATAR).createSignedUrl(chemin, DUREE_LIEN_S);
  return lien.error ? { data: null, erreur: 'Photo enregistrée, mais impossible de l’afficher pour le moment.' } : { data: lien.data.signedUrl, erreur: '' };
}

/** Retire la photo : le fichier est supprimé, puis le chemin est effacé du profil. */
export async function retirerAvatar(userId: string): Promise<{ erreur: string }> {
  const chemin = cheminAvatar(userId);
  if (!chemin) return { erreur: 'Reconnecte-toi puis réessaie.' };
  const profil = await chargerProfilComplet(userId);
  if (!profil.data) return { erreur: profil.erreur || 'Profil introuvable : reconnecte-toi puis réessaie.' };
  const maj = await enregistrerProfil(userId, {}, extrasAvecAvatar(profil.data.extras, null));
  if (maj.erreur) return { erreur: maj.erreur };
  // Le profil ne pointe déjà plus vers la photo : un échec ici laisse au pire un fichier orphelin, invisible
  await sb.storage.from(BUCKET_AVATAR).remove([chemin]);
  return { erreur: '' };
}
