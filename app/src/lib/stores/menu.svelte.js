// Les sports qui décident du menu : ceux que l'utilisateur a choisis, plus ceux que ses données révèlent
// (une séance de muscu, un programme, un test Hyrox…). Chargé une fois à la connexion, gardé en cache dans le navigateur
// pour que le menu ne « saute » pas à chaque ouverture.
import { sb } from '../supabase.js';
import { fusionnerFamilles, nettoyerSports } from '../data/sports-choisis.js';

export const menu = $state({ familles: [], pret: false });

const cleCache = (uid) => `coachia-v2-menu-${uid}`;

function lireCache(uid) {
  try {
    const brut = JSON.parse(localStorage.getItem(cleCache(uid)) || 'null');
    return Array.isArray(brut) ? brut.filter((f) => typeof f === 'string').slice(0, 20) : null;
  } catch (e) {
    return null;
  }
}

function ecrireCache(uid, familles) {
  try {
    localStorage.setItem(cleCache(uid), JSON.stringify(familles));
  } catch (e) {
    /* stockage indisponible : le menu se recalcule à chaque ouverture */
  }
}

/** Démo : tous les menus, pour voir toute l'app. */
export function menuDemo() {
  menu.familles = ['course', 'velo', 'muscu', 'hyrox'];
  menu.pret = true;
}

/** Y a-t-il au moins une ligne de l'utilisateur dans cette table (avec ce filtre) ? Une erreur (table absente…) compte pour « non ». */
async function existe(table, filtre = {}) {
  let r = sb.from(table).select('user_id').limit(1);
  for (const [colonne, valeur] of Object.entries(filtre)) r = r.eq(colonne, valeur);
  const { data, error } = await r;
  return !error && Array.isArray(data) && data.length > 0;
}

/** Charge (et met en cache) les sports qui décident du menu. À rappeler quand l'utilisateur change ses sports. */
export async function chargerMenu(uid) {
  if (!uid) return;
  const cache = lireCache(uid);
  if (cache) {
    menu.familles = cache; // affichage immédiat, corrigé juste après si besoin
    menu.pret = true;
  }
  const [prefs, forceAct, programmes, series, hyroxAct, hyroxPrevue, tests, objectif] = await Promise.all([
    sb.from('user_preferences').select('sports').eq('user_id', uid).maybeSingle(),
    existe('activities', { sport: 'WeightTraining' }),
    existe('strength_programs'),
    existe('strength_sets'),
    existe('activities', { sport: 'Hyrox' }),
    existe('activity_planned', { sport: 'Hyrox' }),
    existe('hyrox_tests'),
    existe('hyrox_objectif'),
  ]);
  const detectees = [];
  if (forceAct || programmes || series) detectees.push('muscu');
  if (hyroxAct || hyroxPrevue || tests || objectif) detectees.push('hyrox');
  const choisis = prefs.error ? [] : nettoyerSports(prefs.data?.sports) || [];
  const familles = fusionnerFamilles(detectees, choisis);
  menu.familles = familles;
  menu.pret = true;
  ecrireCache(uid, familles);
}

/** Déconnexion : le menu redevient vide. */
export function oublierMenu() {
  menu.familles = [];
  menu.pret = false;
}
