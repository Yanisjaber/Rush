// État du profil partagé par les onglets des paramètres : on charge une seule fois, puis chaque onglet lit et écrit ici.
import { chargerProfilComplet, chargerPuissance, enregistrerProfil } from '../data/api.js';
import { donneesDemo } from '../data/demo.js';
import { SECTIONS, valeursDepuis, validerSection, versPayload } from '../data/profil.js';

export const profil = $state({
  utilisateur: null, // pour qui les données ont été chargées (évite de recharger en changeant d'onglet)
  chargement: true,
  erreur: '',
  ligne: null, // ligne user_profiles telle qu'enregistrée (colonnes + extras)
  courbe: [], // courbe de puissance mesurée : sert à estimer la FTP
  valeurs: {}, // { idSection: { cle: valeur } } : ce qui est tapé dans les formulaires
  initial: {}, // { idSection: JSON } : valeurs au dernier enregistrement, pour savoir ce qui a changé
  erreurs: {},
  envoi: {},
  messages: {},
  erreursGlobales: {},
});

function initialiser(ligne) {
  profil.ligne = ligne;
  for (const s of SECTIONS) {
    profil.valeurs[s.id] = valeursDepuis(ligne, s);
    profil.initial[s.id] = JSON.stringify(profil.valeurs[s.id]);
  }
}

/** Charge le profil de cet utilisateur (une seule fois par utilisateur). `demo` : données d'exemple, sans réseau. */
export async function chargerProfilStore(userId, demo = false) {
  if (!userId || profil.utilisateur === userId) return;
  profil.utilisateur = userId;
  profil.chargement = true;
  profil.erreur = '';
  if (demo) {
    const d = donneesDemo();
    initialiser({ ...d.profil, extras: {} });
    profil.courbe = d.puissance;
    profil.chargement = false;
    return;
  }
  const [p, c] = await Promise.all([chargerProfilComplet(userId), chargerPuissance(userId)]);
  profil.courbe = c.data || [];
  if (p.erreur) {
    profil.erreur = p.erreur;
    profil.utilisateur = null; // permet de réessayer
  } else initialiser(p.data || { extras: {} });
  profil.chargement = false;
}

/** Y a-t-il des modifications non enregistrées dans cette section ? */
export const estSale = (id) => profil.initial[id] !== undefined && JSON.stringify(profil.valeurs[id]) !== profil.initial[id];

/** Valide puis enregistre une section. En démo, rien n'est écrit : la ligne locale est simplement mise à jour. */
export async function enregistrerSection(section, userId, demo = false) {
  const id = section.id;
  profil.messages[id] = '';
  profil.erreursGlobales[id] = '';
  const { propres, erreurs } = validerSection(section, profil.valeurs[id]);
  profil.erreurs[id] = erreurs;
  if (Object.keys(erreurs).length) return;
  profil.envoi[id] = true;
  const { colonnes, extras } = versPayload(section, propres, profil.ligne?.extras);
  const r = demo ? { data: { ...profil.ligne, ...colonnes, extras }, erreur: '' } : await enregistrerProfil(userId, colonnes, extras);
  profil.envoi[id] = false;
  if (r.erreur) {
    profil.erreursGlobales[id] = r.erreur;
    return;
  }
  // Les valeurs relues de la base deviennent la référence : « Enregistré », plus de modifications en attente
  profil.ligne = r.data;
  profil.valeurs[id] = valeursDepuis(r.data, section);
  profil.initial[id] = JSON.stringify(profil.valeurs[id]);
  profil.messages[id] = 'Enregistré.';
}
