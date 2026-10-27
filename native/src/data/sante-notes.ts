// Le détail d'une note de santé : maladie (nom, symptômes, gravité), blessure (zone, côté, nature, douleur) et indisponibilité (motif, lieu).
// Fonctions pures, sans réseau. Les clés ci-dessous sont ce qui est enregistré dans la colonne `details` (JSONB) de day_notes ; les noms sont ce qu'on affiche.
// On ne fait jamais confiance à ce qui vient de la base : `nettoyerDetails` ne garde que les clés connues, avec des valeurs de la liste.
import type { Note } from './types.ts';

export type TypeNote = 'texte' | 'maladie' | 'blessure' | 'indisponible';

export interface DetailsNote {
  // maladie
  maladie?: string;
  symptomes?: string[];
  gravite?: string;
  // blessure
  zone?: string;
  cote?: string;
  nature?: string;
  douleur?: number;
  // indisponible
  motif?: string;
  lieu?: string;
  // maladie ou indisponible : ce que tu peux encore faire
  entrainement?: string;
  // le nom libre quand on a choisi « Autre » (maladie, nature de la blessure ou motif)
  autre?: string;
}

type Choix = { cle: string; nom: string };

export const MALADIES: Choix[] = [
  { cle: 'grippe', nom: 'Grippe' },
  { cle: 'rhume', nom: 'Rhume' },
  { cle: 'angine', nom: 'Angine' },
  { cle: 'gastro', nom: 'Gastro' },
  { cle: 'covid', nom: 'Covid' },
  { cle: 'allergie', nom: 'Allergie' },
  { cle: 'autre', nom: 'Autre…' },
];
export const SYMPTOMES: Choix[] = [
  { cle: 'fievre', nom: 'Fièvre' },
  { cle: 'courbatures', nom: 'Courbatures' },
  { cle: 'toux', nom: 'Toux' },
  { cle: 'gorge', nom: 'Mal de gorge' },
  { cle: 'nez', nom: 'Nez bouché' },
  { cle: 'fatigue', nom: 'Fatigue' },
  { cle: 'nausees', nom: 'Nausées' },
];
export const GRAVITES: Choix[] = [
  { cle: 'legere', nom: 'Légère' },
  { cle: 'moyenne', nom: 'Moyenne' },
  { cle: 'forte', nom: 'Forte' },
];
export const ENTRAINEMENT_MALADIE: Choix[] = [
  { cle: 'normal', nom: 'Normal' },
  { cle: 'allege', nom: 'Allégé' },
  { cle: 'repos', nom: 'Repos' },
];
export const ENTRAINEMENT_INDISPO: Choix[] = [
  { cle: 'aucun', nom: 'Aucun' },
  { cle: 'leger', nom: 'Léger (marche, mobilité)' },
  { cle: 'normal', nom: 'Normal' },
];
export const MOTIFS: Choix[] = [
  { cle: 'travail', nom: 'Travail' },
  { cle: 'etudes', nom: 'Études, examens' },
  { cle: 'voyage', nom: 'Voyage' },
  { cle: 'famille', nom: 'Famille' },
  { cle: 'sans_materiel', nom: 'Sans matériel' },
  { cle: 'autre', nom: 'Autre…' },
];
/** Les zones du corps, avec le point qui s'allume sur la silhouette (repère de 96 × 150, voir SilhouetteZone). */
export const ZONES: (Choix & { x: number; y: number })[] = [
  { cle: 'tete', nom: 'Tête, nuque', x: 48, y: 14 },
  { cle: 'epaule', nom: 'Épaule', x: 33, y: 34 },
  { cle: 'bras', nom: 'Bras, coude', x: 24, y: 56 },
  { cle: 'poignet', nom: 'Poignet, main', x: 20, y: 76 },
  { cle: 'dos', nom: 'Dos', x: 48, y: 46 },
  { cle: 'abdos', nom: 'Ventre, abdos', x: 48, y: 62 },
  { cle: 'hanche', nom: 'Hanche', x: 40, y: 78 },
  { cle: 'cuisse', nom: 'Cuisse', x: 40, y: 92 },
  { cle: 'genou', nom: 'Genou', x: 40, y: 106 },
  { cle: 'mollet', nom: 'Mollet, tibia', x: 40, y: 120 },
  { cle: 'cheville', nom: 'Cheville', x: 40, y: 134 },
  { cle: 'pied', nom: 'Pied', x: 40, y: 143 },
];
export const COTES: Choix[] = [
  { cle: 'gauche', nom: 'Gauche' },
  { cle: 'droit', nom: 'Droit' },
  { cle: 'deux', nom: 'Les deux' },
];
export const NATURES: Choix[] = [
  { cle: 'tendinite', nom: 'Tendinite' },
  { cle: 'entorse', nom: 'Entorse' },
  { cle: 'contracture', nom: 'Contracture' },
  { cle: 'dechirure', nom: 'Déchirure' },
  { cle: 'fracture', nom: 'Fracture' },
  { cle: 'contusion', nom: 'Contusion' },
  { cle: 'autre', nom: 'Autre…' },
];

/** La douleur de 1 à 10, avec un mot pour chaque palier. */
export const niveauDouleur = (n: number): string => (n <= 3 ? 'légère' : n <= 6 ? 'modérée' : 'forte');
export const DOULEURS: Choix[] = Array.from({ length: 10 }, (_, i) => ({ cle: String(i + 1), nom: `${i + 1} / 10 · ${niveauDouleur(i + 1)}` }));

export const TEXTE_MAX_COURT = 60;

const nomDe = (liste: Choix[], cle: unknown): string | null => (typeof cle === 'string' ? (liste.find((c) => c.cle === cle)?.nom ?? null) : null);
const cleDe = (liste: Choix[], cle: unknown): string | undefined => (typeof cle === 'string' && liste.some((c) => c.cle === cle) ? cle : undefined);
const texteCourt = (v: unknown): string | undefined => {
  const t = typeof v === 'string' ? v.trim().slice(0, TEXTE_MAX_COURT) : '';
  return t || undefined;
};

/**
 * Ne garde de `details` que ce qui concerne le type de la note, avec des valeurs connues : une clé inconnue, une valeur hors liste ou le détail d'un autre type disparaissent.
 * Renvoie null quand il ne reste rien (et toujours pour une simple note).
 */
export function nettoyerDetails(type: string, d: unknown): DetailsNote | null {
  const s = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
  const r: DetailsNote = {};
  if (type === 'maladie') {
    r.maladie = cleDe(MALADIES, s.maladie);
    r.symptomes = Array.isArray(s.symptomes) ? SYMPTOMES.map((c) => c.cle).filter((c) => (s.symptomes as unknown[]).includes(c)) : undefined;
    r.gravite = cleDe(GRAVITES, s.gravite);
    r.entrainement = cleDe(ENTRAINEMENT_MALADIE, s.entrainement);
    if (r.maladie === 'autre') r.autre = texteCourt(s.autre);
  } else if (type === 'blessure') {
    r.zone = cleDe(ZONES, s.zone);
    r.cote = cleDe(COTES, s.cote);
    r.nature = cleDe(NATURES, s.nature);
    const n = Number(s.douleur);
    if (Number.isInteger(n) && n >= 1 && n <= 10) r.douleur = n;
    if (r.nature === 'autre') r.autre = texteCourt(s.autre);
  } else if (type === 'indisponible') {
    r.motif = cleDe(MOTIFS, s.motif);
    r.entrainement = cleDe(ENTRAINEMENT_INDISPO, s.entrainement);
    r.lieu = texteCourt(s.lieu);
    if (r.motif === 'autre') r.autre = texteCourt(s.autre);
  } else return null;
  const propres = Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length))) as DetailsNote;
  return Object.keys(propres).length ? propres : null;
}

/** Les valeurs par défaut à l'ouverture d'un type (ce qu'on voit déjà choisi sur la maquette). */
export function detailsParDefaut(type: string): DetailsNote {
  if (type === 'maladie') return { maladie: 'grippe', gravite: 'moyenne', entrainement: 'repos' };
  if (type === 'blessure') return { zone: 'genou', cote: 'droit', nature: 'tendinite', douleur: 4 };
  if (type === 'indisponible') return { motif: 'travail', entrainement: 'normal' };
  return {};
}

/** Le titre d'une note : le nom de la maladie, « Genou droit », le motif… ; une simple note garde son texte. */
export function titreNote(n: Pick<Note, 'type' | 'text'> & { details?: DetailsNote | null }): string {
  const d = n.details ?? {};
  if (n.type === 'maladie') return (d.maladie === 'autre' ? d.autre : nomDe(MALADIES, d.maladie)) || 'Maladie';
  if (n.type === 'blessure') {
    const zone = nomDe(ZONES, d.zone)?.split(',')[0];
    const cote = d.cote === 'gauche' ? ' gauche' : d.cote === 'droit' ? ' droit' : d.cote === 'deux' ? ' (les deux)' : '';
    return zone ? `${zone}${cote}` : 'Blessure';
  }
  if (n.type === 'indisponible') return (d.motif === 'autre' ? d.autre : nomDe(MOTIFS, d.motif)) || 'Indisponible';
  return n.text || 'Note';
}

/** Les lignes « Étiquette : valeur » du détail d'une note, dans l'ordre de la feuille. */
export function lignesDetail(n: Pick<Note, 'type' | 'text'> & { details?: DetailsNote | null }): { etiquette: string; valeur: string }[] {
  const d = n.details ?? {};
  const lignes: { etiquette: string; valeur: string | null }[] = [];
  if (n.type === 'maladie') {
    lignes.push({ etiquette: 'Symptômes', valeur: d.symptomes?.length ? d.symptomes.map((c) => nomDe(SYMPTOMES, c)).filter(Boolean).join(', ') : null });
    lignes.push({ etiquette: 'Gravité', valeur: nomDe(GRAVITES, d.gravite) });
    lignes.push({ etiquette: 'Entraînement', valeur: nomDe(ENTRAINEMENT_MALADIE, d.entrainement) });
  } else if (n.type === 'blessure') {
    lignes.push({ etiquette: 'Zone', valeur: nomDe(ZONES, d.zone) });
    lignes.push({ etiquette: 'Côté', valeur: nomDe(COTES, d.cote) });
    lignes.push({ etiquette: 'Nature', valeur: d.nature === 'autre' ? (d.autre ?? 'Autre') : nomDe(NATURES, d.nature) });
    lignes.push({ etiquette: 'Douleur', valeur: d.douleur ? `${d.douleur} / 10 · ${niveauDouleur(d.douleur)}` : null });
  } else if (n.type === 'indisponible') {
    lignes.push({ etiquette: 'Entraînement', valeur: nomDe(ENTRAINEMENT_INDISPO, d.entrainement) });
    lignes.push({ etiquette: 'Lieu', valeur: d.lieu ?? null });
  }
  if (n.type !== 'texte') lignes.push({ etiquette: 'Note', valeur: n.text || null });
  return lignes.filter((l): l is { etiquette: string; valeur: string } => !!l.valeur);
}
