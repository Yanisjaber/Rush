// Open Dossard : appels à la fonction serveur `opendossard` (les identifiants Open Dossard restent côté serveur, jamais dans le
// navigateur) et mémorisation de la licence liée. Chaque fonction renvoie { data, erreur } (message court en français).
import { appeler } from './integrations.js';
import { normaliserLicences, normaliserResultats, licenceValide } from './opendossard.js';

function messageErreur(r) {
  const code = r.data?.error;
  if (code === 'od_credentials_missing') return "Open Dossard n'est pas configuré côté serveur.";
  if (code === 'rate_limited' || r.statut === 429) return 'Trop de recherches d\'un coup. Attends une minute.';
  if (r.statut === 401) return 'Reconnecte-toi pour utiliser Open Dossard.';
  return 'Open Dossard ne répond pas. Réessaie dans un instant.';
}

/** Recherche de licences par nom ou numéro (2 caractères minimum). */
export async function rechercherLicences(q) {
  const recherche = String(q || '').trim().slice(0, 60);
  if (recherche.length < 2) return { data: [], erreur: 'Saisis au moins 2 caractères.' };
  const r = await appeler('opendossard', { action: 'search-licence', q: recherche });
  if (!r.ok) return { data: null, erreur: messageErreur(r) };
  return { data: normaliserLicences(r.data?.results), erreur: '' };
}

/** Palmarès (résultats officiels) d'une licence. */
export async function chargerPalmares(licenceId) {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(String(licenceId))) return { data: null, erreur: 'Licence invalide.' };
  const r = await appeler('opendossard', { action: 'palmares', licenceId: String(licenceId) });
  if (!r.ok) return { data: null, erreur: messageErreur(r) };
  return { data: normaliserResultats(r.data?.palmares), erreur: '' };
}

// --- Licence liée et cache du palmarès : propres à CHAQUE compte (clé par utilisateur), jamais partagés d'un compte à l'autre ---
const cle = (base, userId) => (userId ? `rush-od-${base}::${userId}` : null);

function lire(base, userId) {
  const k = cle(base, userId);
  if (!k) return null;
  try {
    return JSON.parse(localStorage.getItem(k) || 'null');
  } catch {
    return null;
  }
}
function ecrire(base, userId, valeur) {
  const k = cle(base, userId);
  if (!k) return;
  try {
    if (valeur == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(valeur));
  } catch {
    /* stockage plein ou bloqué : on continue sans */
  }
}

export function lireLicence(userId) {
  const l = lire('licence', userId);
  return licenceValide(l) ? l : null;
}
export const ecrireLicence = (userId, licence) => ecrire('licence', userId, licence);
export function lireCachePalmares(userId) {
  const c = lire('palmares', userId);
  return Array.isArray(c) ? normaliserResultats(c.map((r) => ({ date: r.date, competitionName: r.nom, rankingScratch: r.place, totalInCategory: r.total, catev: r.categorie, competitionId: r.idCompetition }))) : [];
}
export const ecrireCachePalmares = (userId, resultats) => ecrire('palmares', userId, resultats);
