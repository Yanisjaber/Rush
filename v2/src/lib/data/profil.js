// Profil de l'athlète : définition des champs, validation, calculs (zones, estimations). Fonctions pures, sans réseau.
//
// STOCKAGE (table user_profiles), identique à la v1 pour que les deux versions relisent les mêmes données :
//   - colonnes : display_name, weight, ftp, hr_max, lthr
//   - tout le reste dans la colonne JSON `extras` (clés identiques à celles de la v1, sans le préfixe « x_ »)
// Les zones ne sont JAMAIS stockées : on les recalcule à l'affichage à partir de la FTP, de la LTHR et de la vitesse seuil.

const COLONNES = ['display_name', 'weight', 'ftp', 'hr_max', 'lthr'];

// --- Définition des champs --------------------------------------------------------------------------------------
// type : 'texte' | 'nombre' | 'date' | 'choix' | 'case' | 'temps' | 'paragraphe'
const n = (cle, label, min, max, pas = 1, unite = '') => ({ cle, label, type: 'nombre', min, max, pas, unite });
const t = (cle, label, max = 100, exemple = '') => ({ cle, label, type: 'texte', max, exemple });
const temps = (cle, label, exemple) => ({ cle, label, type: 'temps', exemple });
const choix = (cle, label, options) => ({ cle, label, type: 'choix', options });
const colonne = (champ) => ({ ...champ, colonne: true });

// Prénom et nom : nouveaux champs, mais les profils de la v1 n'ont que `display_name` (colonne) et `full_name` (extras).
// On relit donc ces anciennes valeurs tant que les nouvelles n'existent pas.
function lirePrenom(ligne, extras) {
  if (typeof extras.first_name === 'string') return extras.first_name;
  const complet = String(extras.full_name ?? '').trim();
  return complet ? complet.split(/\s+/)[0] : String(ligne?.display_name ?? '');
}
function lireNom(ligne, extras) {
  if (typeof extras.last_name === 'string') return extras.last_name;
  const complet = String(extras.full_name ?? '').trim();
  return complet ? complet.split(/\s+/).slice(1).join(' ') : '';
}

export const SECTIONS = [
  {
    id: 'identite',
    titre: 'Identité',
    groupes: [
      {
        champs: [
          { ...t('first_name', 'Prénom', 60, 'Ton prénom'), requis: true, lire: lirePrenom },
          { ...t('last_name', 'Nom', 60, 'Ton nom'), lire: lireNom },
          { cle: 'birth_date', label: 'Date de naissance', type: 'date' },
          choix('sex', 'Sexe', [['M', 'Homme'], ['F', 'Femme'], ['O', 'Autre / non précisé']]),
          t('country', 'Pays', 60, 'France'),
          t('city', 'Ville', 80, 'Paris'),
          n('height', 'Taille', 120, 230, 1, 'cm'),
          colonne(n('weight', 'Poids', 20, 250, 0.1, 'kg')),
        ],
      },
    ],
  },
  {
    id: 'physiologie',
    titre: 'Physiologie',
    groupes: [
      {
        titre: 'Cardiaque',
        champs: [
          colonne(n('hr_max', 'FC max', 100, 230, 1, 'bpm')),
          n('rhr', 'FC au repos', 30, 100, 1, 'bpm'),
          colonne(n('lthr', 'FC au seuil (LTHR)', 100, 220, 1, 'bpm')),
          n('hrv_baseline', 'HRV de référence', 10, 200, 1, 'ms'),
          choix('hrmax_method', 'Méthode de la FC max', [['observed', 'Observée en activité'], ['test', 'Test maximal'], ['age', 'Formule âge (220 − âge)'], ['tanaka', 'Formule Tanaka (208 − 0,7 × âge)']]),
          n('cardiac_drift', 'Dérive cardiaque tolérée', 0, 20, 0.5, '%'),
        ],
      },
      {
        titre: 'Vélo',
        champs: [
          colonne(n('ftp', 'FTP', 50, 600, 1, 'W')),
          n('vo2max_bike', 'VO2max estimée', 20, 95, 0.1, 'ml/kg/min'),
          n('cp', 'Puissance critique (CP)', 50, 600, 1, 'W'),
          n('wprime', 'W’ (réserve anaérobie)', 0, 50, 0.1, 'kJ'),
          n('pmax', 'Puissance max en sprint', 200, 2500, 1, 'W'),
          { cle: 'last_ftp_test', label: 'Date du dernier test FTP', type: 'date' },
          choix('ftp_test_type', 'Type de test', [['20min', '20 min × 0,95'], ['8min', '8 min × 0,90'], ['ramp', 'Ramp test'], ['2x8', '2 × 8 min'], ['cp', 'Critical Power (3/12 min)'], ['record', 'Auto-déduit du record 60 min'], ['estimate', 'Estimation à vue']]),
        ],
      },
      {
        titre: 'Course',
        champs: [
          n('vma', 'VMA', 6, 25, 0.1, 'km/h'),
          n('threshold_speed', 'Vitesse seuil', 6, 22, 0.1, 'km/h'),
          n('vo2max_run', 'VO2max course', 20, 95, 0.1, 'ml/kg/min'),
          temps('pace_5k', 'Allure 5 km (min/km)', '4:30'),
          temps('pace_10k', 'Allure 10 km (min/km)', '4:45'),
          temps('pace_half', 'Allure semi (min/km)', '5:00'),
          temps('pace_marathon', 'Allure marathon (min/km)', '5:20'),
        ],
      },
      {
        titre: 'Natation',
        champs: [
          temps('css', 'CSS (min:s / 100 m)', '1:30'),
          n('swolf', 'SWOLF moyen', 20, 80, 1),
          choix('swim_level', 'Niveau technique', [['beginner', 'Débutant'], ['intermediate', 'Intermédiaire'], ['advanced', 'Avancé'], ['expert', 'Expert']]),
          temps('swim_100', 'Record 100 m', '1:25'),
          temps('swim_400', 'Record 400 m', '6:30'),
          temps('swim_1500', 'Record 1500 m', '25:00'),
          temps('swim_3800', 'Record 3800 m', '1:08:00'),
        ],
      },
    ],
  },
];

export const champsDe = (section) => section.groupes.flatMap((g) => g.champs);
export const sectionParId = (id) => SECTIONS.find((s) => s.id === id) || null;

// --- Lecture depuis la base ---------------------------------------------------------------------------------------

/** Valeurs plates { cle: valeur } d'une section, à partir de la ligne user_profiles (champs absents = null / false). */
export function valeursDepuis(ligne, section) {
  const extras = ligne && typeof ligne.extras === 'object' && ligne.extras ? ligne.extras : {};
  const sortie = {};
  for (const c of champsDe(section)) {
    const brut = c.lire ? c.lire(ligne, extras) : c.colonne ? ligne?.[c.cle] : Object.hasOwn(extras, c.cle) ? extras[c.cle] : undefined;
    if (c.type === 'case') sortie[c.cle] = brut === true;
    else sortie[c.cle] = brut === undefined || brut === null ? '' : String(brut);
  }
  return sortie;
}

// --- Validation -----------------------------------------------------------------------------------------------------

const RE_TEMPS = /^\d{1,2}(:[0-5]\d){1,2}$/;

function dateValide(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso && iso >= '1900-01-01';
}

/**
 * Vérifie les valeurs d'une section. Renvoie { propres, erreurs } :
 *  - propres : { cle: valeur propre } (nombre, texte, booléen ou null), prêtes à enregistrer
 *  - erreurs : { cle: message } ; vide si tout est bon
 */
export function validerSection(section, valeurs, aujourdhui = new Date().toISOString().slice(0, 10)) {
  const propres = {};
  const erreurs = {};
  for (const c of champsDe(section)) {
    const brut = valeurs?.[c.cle];
    if (c.type === 'case') {
      propres[c.cle] = brut === true;
      continue;
    }
    const texte = String(brut ?? '').trim();
    if (texte === '') {
      propres[c.cle] = null;
      if (c.requis) erreurs[c.cle] = 'Ce champ est obligatoire.';
      continue;
    }
    if (c.type === 'nombre') {
      const v = Number(texte.replace(',', '.'));
      if (!Number.isFinite(v) || v < c.min || v > c.max) erreurs[c.cle] = `Entre ${c.min} et ${c.max}${c.unite ? ` ${c.unite}` : ''}.`;
      else propres[c.cle] = Math.round(v * 100) / 100; // 2 décimales au plus
    } else if (c.type === 'texte' || c.type === 'paragraphe') {
      if (texte.length > c.max) erreurs[c.cle] = `${c.max} caractères maximum.`;
      else propres[c.cle] = texte;
    } else if (c.type === 'date') {
      if (!dateValide(texte) || texte > aujourdhui) erreurs[c.cle] = 'Date invalide.';
      else propres[c.cle] = texte;
    } else if (c.type === 'choix') {
      if (!c.options.some(([v]) => v === texte)) erreurs[c.cle] = 'Choix invalide.';
      else propres[c.cle] = texte;
    } else if (c.type === 'temps') {
      if (!RE_TEMPS.test(texte)) erreurs[c.cle] = 'Format attendu : 4:30 ou 1:05:00.';
      else propres[c.cle] = texte;
    }
  }
  return { propres, erreurs };
}

/**
 * Prépare l'écriture : sépare colonnes et extras. Les extras existants qui n'appartiennent pas à cette section
 * (autres sections, champs de la v1) sont conservés tels quels : on n'écrase jamais ce qu'on n'a pas édité.
 */
export function versPayload(section, propres, extrasActuels = {}) {
  const colonnes = {};
  const extras = { ...(extrasActuels && typeof extrasActuels === 'object' ? extrasActuels : {}) };
  for (const c of champsDe(section)) {
    if (c.colonne) {
      if (!COLONNES.includes(c.cle)) continue;
      colonnes[c.cle] = propres[c.cle];
    } else extras[c.cle] = propres[c.cle];
  }
  if (Object.hasOwn(propres, 'first_name')) {
    // L'accueil et la v1 lisent encore `display_name` et `full_name` : on les tient à jour
    colonnes.display_name = propres.first_name;
    extras.full_name = [propres.first_name, propres.last_name].filter(Boolean).join(' ') || null;
  }
  return { colonnes, extras };
}

// --- Zones d'entraînement (recalculées, jamais stockées) -------------------------------------------------------------
// Chaque zone : nom, bornes en % de la référence, index de couleur (COULEURS_ZONE de structure.js).

export const MODELES_ZONES = {
  puissance: {
    titre: 'Puissance vélo',
    reference: 'FTP',
    unite: 'W',
    zones: [
      ['Z1 Récupération', 0, 55], ['Z2 Endurance', 56, 75], ['Z3 Tempo', 76, 90], ['Z4 Seuil', 91, 105],
      ['Z5 VO2max', 106, 120], ['Z6 Anaérobie', 121, 150], ['Z7 Sprint', 151, 200],
    ],
  },
  cardio: {
    titre: 'Cardio',
    reference: 'LTHR',
    unite: 'bpm',
    zones: [
      ['Z1 Récupération', 0, 80], ['Z2 Aérobie', 81, 89], ['Z3 Tempo', 90, 93], ['Z4 Sous le seuil', 94, 99],
      ['Z5a Seuil', 100, 102], ['Z5b VO2max', 103, 106], ['Z5c Anaérobie', 107, 120],
    ],
  },
  allure: {
    titre: 'Allure en course',
    reference: 'vitesse seuil',
    unite: 'km/h',
    zones: [['Z1 Récupération', 0, 80], ['Z2 Endurance', 81, 88], ['Z3 Tempo', 89, 94], ['Z4 Seuil', 95, 102], ['Z5 VO2max', 103, 110]],
  },
};

const secondesAllure = (kmh) => (kmh > 0 ? 3600 / kmh : null);
export function texteAllure(kmh) {
  const s = secondesAllure(kmh);
  if (!s) return '';
  const r = Math.round(s);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}/km`;
}

/** Zones calculées pour un modèle ('puissance' | 'cardio' | 'allure') et une valeur de référence, ou null si absente. */
export function calculerZones(modele, reference) {
  const m = MODELES_ZONES[modele];
  const ref = Number(reference);
  if (!m || !(ref > 0)) return null;
  return m.zones.map(([nom, bas, haut], i) => {
    const de = (ref * bas) / 100;
    const a = (ref * haut) / 100;
    const arrondi = (v) => (modele === 'allure' ? Math.round(v * 10) / 10 : Math.round(v));
    return { nom, bas, haut, couleur: i, de: arrondi(de), a: arrondi(a), alluresDe: modele === 'allure' ? texteAllure(de) : '', alluresA: modele === 'allure' ? texteAllure(a) : '' };
  });
}

// --- Estimations et valeurs dérivées ---------------------------------------------------------------------------------

/** FTP estimée depuis la courbe de puissance : 95 % du meilleur 20 min, sinon le meilleur 60 min. null sans données. */
export function estimerFtp(courbe) {
  const parDuree = new Map((courbe || []).map((l) => [Number(l.duration_s), Number(l.watts_alltime)]));
  const vingt = parDuree.get(1200);
  if (vingt > 0) return Math.round(vingt * 0.95);
  const soixante = parDuree.get(3600);
  return soixante > 0 ? Math.round(soixante) : null;
}

/** LTHR estimée : 92 % de la FC max. */
export const estimerLthr = (hrMax) => (Number(hrMax) > 0 ? Math.round(Number(hrMax) * 0.92) : null);

/** Watts par kilo, arrondi à 2 décimales, ou null. */
export function wattsParKg(ftp, poids) {
  const f = Number(ftp);
  const p = Number(String(poids).replace(',', '.'));
  return f > 0 && p > 0 ? Math.round((f / p) * 100) / 100 : null;
}

/** Âge en années à la date donnée, ou null si la date de naissance est absente ou invalide. */
export function calculerAge(naissanceIso, aujourdhui = new Date()) {
  if (!dateValide(String(naissanceIso || ''))) return null;
  const b = new Date(`${naissanceIso}T12:00:00`);
  let age = aujourdhui.getFullYear() - b.getFullYear();
  if (aujourdhui.getMonth() < b.getMonth() || (aujourdhui.getMonth() === b.getMonth() && aujourdhui.getDate() < b.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

/** L'image d'avatar est-elle sûre à afficher ? (image encodée en base64 ou lien https) */
export const avatarSur = (url) => typeof url === 'string' && (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(url) || /^https:\/\/[^\s"'<>]+$/.test(url));
