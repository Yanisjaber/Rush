import { useSyncExternalStore } from 'react';
import type { LigneNote, LignePrevue } from '@/data/ajouts';
import type { Note, Prevue } from '@/data/types';

// Ce qu'on ajoute au calendrier de la démo (séances prévues, compétitions, notes) : en mémoire seulement, ça survit à la navigation mais pas à un relancement.
// Un numéro de version change à chaque ajout (démo ou compte) pour que le calendrier recharge ses données.
let prevues: Prevue[] = [];
let notes: Note[] = [];
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
