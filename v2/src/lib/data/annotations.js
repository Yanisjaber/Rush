// Repos, notes et annotations du calendrier : validation, rangement par jour. Fonctions pures, sans réseau.
//
// STOCKAGE (comme la v1) :
//  - day_notes : une note sur une plage de dates { type: 'texte' | 'maladie' | 'blessure', text, color, from_date, to_date }
//  - rest_day  : un jour de repos par ligne { iso_date }

/** Types proposés : clé, nom, couleur par défaut (null = pas de couleur : le repos est un simple marquage du jour). */
export const TYPES_MARQUAGE = [
  { cle: 'texte', nom: 'Note', couleur: '#60a5fa', aide: 'Un mot sur ta journée ou ta période.' },
  { cle: 'maladie', nom: 'Maladie', couleur: '#f87171', aide: 'Période de maladie : la charge à venir doit en tenir compte.' },
  { cle: 'blessure', nom: 'Blessure', couleur: '#fb923c', aide: 'Période de blessure.' },
  { cle: 'repos', nom: 'Repos', couleur: null, aide: 'Jour(s) de repos voulu(s), sans entraînement.' },
];
export const PALETTE = ['#f87171', '#fb923c', '#fbbf24', '#4ade80', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#94a3b8'];
const TYPES_NOTE = new Set(['texte', 'maladie', 'blessure']);
const MAX_JOURS = 90; // plage maximale d'un marquage

const dateValide = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return false;
  const d = new Date(`${iso}T12:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
};
const jourSuivant = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Tous les jours (AAAA-MM-JJ) de la plage, bornes incluses. Vide si la plage est invalide ou trop longue. */
export function joursDe(de, a) {
  if (!dateValide(de) || !dateValide(a) || a < de) return [];
  const liste = [];
  for (let j = de; j <= a && liste.length <= MAX_JOURS; j = jourSuivant(j)) liste.push(j);
  return liste.length > MAX_JOURS ? [] : liste;
}

export function formulaireVide(dateIso, type = 'texte') {
  return { type, de: dateIso, a: dateIso, texte: '', couleur: TYPES_MARQUAGE.find((t) => t.cle === type)?.couleur || PALETTE[5] };
}

/** Formulaire prérempli depuis une note (ligne day_notes) ou un jour de repos ({ type: 'repos', iso }). */
export function formulaireDepuisMarquage(m) {
  if (m.type === 'repos') return { type: 'repos', de: m.iso, a: m.iso, texte: '', couleur: PALETTE[5] };
  return {
    type: TYPES_NOTE.has(m.type) ? m.type : 'texte',
    de: String(m.from_date || ''),
    a: String(m.to_date || m.from_date || ''),
    texte: m.text == null ? '' : String(m.text),
    couleur: /^#[0-9a-f]{6}$/i.test(m.color || '') ? m.color : TYPES_MARQUAGE.find((t) => t.cle === m.type)?.couleur || PALETTE[5],
  };
}

/** Vérifie le formulaire. Renvoie { valeurs, erreurs } (valeurs = null s'il y a des erreurs). */
export function validerMarquage(f) {
  const erreurs = {};
  const type = TYPES_MARQUAGE.some((t) => t.cle === f.type) ? f.type : null;
  if (!type) erreurs.type = 'Choisis un type.';
  if (!dateValide(f.de)) erreurs.de = 'Date de début invalide.';
  if (!dateValide(f.a)) erreurs.a = 'Date de fin invalide.';
  else if (dateValide(f.de) && f.a < f.de) erreurs.a = 'La fin doit être après le début.';
  else if (dateValide(f.de) && joursDe(f.de, f.a).length === 0) erreurs.a = `Une période dure ${MAX_JOURS} jours au maximum.`;
  const texte = String(f.texte ?? '').trim();
  if (texte.length > 500) erreurs.texte = '500 caractères maximum.';
  if (type === 'texte' && !texte) erreurs.texte = 'Écris ta note.';
  if (type !== 'repos' && !/^#[0-9a-f]{6}$/i.test(String(f.couleur ?? ''))) erreurs.couleur = 'Couleur invalide.';
  if (Object.keys(erreurs).length) return { valeurs: null, erreurs };
  return { erreurs, valeurs: { type, de: f.de, a: f.a, texte: texte || null, couleur: type === 'repos' ? null : f.couleur } };
}

/** Ligne à écrire dans day_notes (sans user_id : ajouté par l'API depuis la session). */
export const versLigneNote = (v) => ({ type: v.type, text: v.texte, color: v.couleur, from_date: v.de, to_date: v.a });

/** Notes qui recouvrent un jour donné. */
export const notesDuJour = (notes, iso) => (notes || []).filter((n) => String(n.from_date) <= iso && iso <= String(n.to_date));
