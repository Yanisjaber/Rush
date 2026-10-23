import { useSyncExternalStore } from 'react';
import type { LigneNote, LignePrevue, LigneSortie } from '@/data/ajouts';
import type { Note, Prevue, Seance } from '@/data/types';

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

export function ajouterPrevueDemo(ligne: LignePrevue): Prevue {
  const p: Prevue = {
    id: identifiant(),
    name: ligne.name,
    date: ligne.date,
    sport: ligne.sport,
    duration: ligne.duration,
    tss: ligne.tss,
    category: ligne.category,
    km: ligne.km,
    d_plus: ligne.d_plus,
  };
  prevues = [...prevues, p];
  prevenir();
  return p;
}

export function ajouterNoteDemo(ligne: LigneNote): Note {
  const n: Note = { id: identifiant(), type: ligne.type, text: ligne.text, color: ligne.color, from_date: ligne.from_date, to_date: ligne.to_date };
  notes = [...notes, n];
  prevenir();
  return n;
}

export function modifierNoteDemo(id: string, ligne: LigneNote): void {
  const n: Note = { id, type: ligne.type, text: ligne.text, color: ligne.color, from_date: ligne.from_date, to_date: ligne.to_date };
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
