import { useSyncExternalStore } from 'react';
import { prevueDepuisLigne, type LigneNote, type LignePrevue, type LigneSortie } from '../data/ajouts.ts';
import type { Note, Prevue, PrevueComplete, Seance } from '../data/types.ts';

// Ce qu'on ajoute au calendrier de la démo (séances prévues, compétitions, notes) : en mémoire seulement, ça survit à la navigation mais pas à un relancement.
// Un numéro de version change à chaque ajout (démo ou compte) pour que le calendrier recharge ses données.
let prevues: Prevue[] = [];
let notes: Note[] = [];
let sorties: Seance[] = [];
// Les notes de l'exemple modifiées ou supprimées, et les jours de repos posés ou retirés pendant la démo
const notesRemplacees = new Map<string, Note>();
const notesSupprimees = new Set<string>();
const reposPoses = new Set<string>();
const reposRetires = new Set<string>();
// Les séances prévues et compétitions de la démo : leur ligne complète (blocs, notes, parcours…), et celles de l'exemple modifiées ou supprimées
const lignesPrevues = new Map<string, LignePrevue>();
const prevuesRemplacees = new Map<string, Prevue>();
const prevuesSupprimees = new Set<string>();
let version = 0;
const ecouteurs = new Set<() => void>();
const prevenir = () => {
  version += 1;
  ecouteurs.forEach((fn) => fn());
};
const abonner = (fn: () => void) => {
  ecouteurs.add(fn);
  return () => {
    ecouteurs.delete(fn);
  };
};

/** Le numéro de version des ajouts : change dès qu'une séance prévue, une compétition ou une note est ajoutée. */
export const useVersionAjouts = (): number => useSyncExternalStore(abonner, () => version, () => version);

/** Dit à tout le monde que le calendrier a changé (après une écriture sur le compte). */
export const ajoutsChanges = (): void => prevenir();

export const prevuesAjoutees = (): Prevue[] => prevues;
export const notesAjoutees = (): Note[] => notes;
export const sortiesAjoutees = (): Seance[] => sorties;

/** Les notes de la démo : celles de l'exemple et celles ajoutées, avec les modifications et sans les suppressions. */
export const notesDeLaDemo = (base: Note[]): Note[] =>
  [...base, ...notes].filter((n) => !notesSupprimees.has(n.id)).map((n) => notesRemplacees.get(n.id) ?? n);

/** Les jours de repos de la démo : ceux de l'exemple et ceux posés, sans ceux retirés. */
export const reposDeLaDemo = (base: string[]): string[] => [...new Set([...base, ...reposPoses])].filter((iso) => !reposRetires.has(iso));

const identifiant = (): string => `demo-ajout-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const resumeDePrevue = (id: string, ligne: LignePrevue): Prevue => ({
  id,
  name: ligne.name,
  date: ligne.date,
  sport: ligne.sport,
  duration: ligne.duration,
  tss: ligne.tss,
  category: ligne.category,
  km: ligne.km,
  d_plus: ligne.d_plus,
});

export function ajouterPrevueDemo(ligne: LignePrevue): Prevue {
  const p = resumeDePrevue(identifiant(), ligne);
  prevues = [...prevues, p];
  lignesPrevues.set(p.id, ligne);
  prevenir();
  return p;
}

/** Les séances prévues et compétitions de la démo : celles de l'exemple et celles ajoutées, avec les modifications et sans les suppressions. */
export const prevuesDeLaDemo = (base: Prevue[]): Prevue[] =>
  [...base, ...prevues].filter((p) => !prevuesSupprimees.has(p.id)).map((p) => prevuesRemplacees.get(p.id) ?? p);

/** Une séance prévue ou une compétition de la démo avec toutes ses colonnes (celles que l'exemple ne donne pas valent null) ; null si elle n'existe plus. */
export function prevueCompleteDemo(id: string, base: Prevue[]): PrevueComplete | null {
  if (prevuesSupprimees.has(id)) return null;
  const ligne = lignesPrevues.get(id);
  if (ligne) return prevueDepuisLigne(id, ligne);
  const p = [...base, ...prevues].find((x) => x.id === id);
  if (!p) return null;
  return prevueDepuisLigne(id, {
    category: p.category === 'competition' ? 'competition' : 'entrainement',
    name: p.name ?? '',
    date: p.date,
    start_date_local: '',
    sport: p.sport,
    duration: p.duration,
    tss: p.tss,
    rpe: null,
    km: p.km,
    d_plus: p.d_plus ?? null,
    notes: null,
  });
}

export function modifierPrevueDemo(id: string, ligne: LignePrevue): void {
  lignesPrevues.set(id, ligne);
  const p = resumeDePrevue(id, ligne);
  if (prevues.some((x) => x.id === id)) prevues = prevues.map((x) => (x.id === id ? p : x));
  else prevuesRemplacees.set(id, p);
  prevenir();
}

export function supprimerPrevueDemo(id: string): void {
  if (prevues.some((x) => x.id === id)) prevues = prevues.filter((x) => x.id !== id);
  else prevuesSupprimees.add(id);
  prevuesRemplacees.delete(id);
  lignesPrevues.delete(id);
  prevenir();
}

export function ajouterNoteDemo(ligne: LigneNote): Note {
  const n: Note = { id: identifiant(), type: ligne.type, text: ligne.text, color: ligne.color, from_date: ligne.from_date, to_date: ligne.to_date, details: ligne.details };
  notes = [...notes, n];
  prevenir();
  return n;
}

export function modifierNoteDemo(id: string, ligne: LigneNote): void {
  const n: Note = { id, type: ligne.type, text: ligne.text, color: ligne.color, from_date: ligne.from_date, to_date: ligne.to_date, details: ligne.details };
  if (notes.some((x) => x.id === id)) notes = notes.map((x) => (x.id === id ? n : x));
  else notesRemplacees.set(id, n);
  prevenir();
}

export function supprimerNoteDemo(id: string): void {
  if (notes.some((x) => x.id === id)) notes = notes.filter((x) => x.id !== id);
  else notesSupprimees.add(id);
  notesRemplacees.delete(id);
  prevenir();
}

export function poserReposDemo(iso: string): void {
  reposRetires.delete(iso);
  reposPoses.add(iso);
  prevenir();
}

export function retirerReposDemo(iso: string): void {
  reposPoses.delete(iso);
  reposRetires.add(iso);
  prevenir();
}

export function ajouterSortieDemo(ligne: LigneSortie): Seance {
  const s: Seance = {
    id: identifiant(),
    name: ligne.name,
    sport: ligne.sport,
    start_date_local: ligne.start_date_local,
    moving_time: ligne.moving_time,
    distance_km: ligne.distance_km,
    total_elevation_gain: ligne.total_elevation_gain,
    avg_heartrate: ligne.avg_heartrate,
    ftp_at_time: null,
    avg_watts: null,
    np: null,
    tss: ligne.tss,
    category: ligne.category,
    source: 'manual',
    rpe: ligne.rpe,
    user_notes: ligne.user_notes,
  };
  sorties = [...sorties, s];
  prevenir();
  return s;
}
