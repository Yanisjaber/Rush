// Le profil d'intensité d'une séance du coach : une suite de segments (durée, niveau d'effort) tirée de sa structure.
// Fonctions pures, sans écran : le ticket de séance (components/coach/TicketSeance.tsx) ne fait que les dessiner.
import type { BlocStructure } from './types.ts';

export interface SegmentProfil {
  /** Durée en minutes (sert de largeur) */
  min: number;
  /** Niveau d'effort de 0,2 (très facile) à 1 (très dur) : sert de hauteur */
  niveau: number;
  /** Segment d'effort (répétition ou corps de séance soutenu) : dessiné en couleur de sport */
  effort: boolean;
}

/** % de la référence (FTP, allure de base…) → niveau 0,2…1. Les bornes (40 % et 125 %) sont celles des zones de l'app. */
export function niveauDepuisPourcent(int: number): number {
  const t = (Math.min(125, Math.max(40, int)) - 40) / 85;
  return Math.round((0.2 + 0.8 * t) * 100) / 100;
}

/** La structure en segments, dans l'ordre : un bloc d'intervalles donne « travail, récupération » répétés */
export function profilSeance(blocs: BlocStructure[] | undefined): SegmentProfil[] {
  const segments: SegmentProfil[] = [];
  for (const b of blocs ?? []) {
    const reps = Math.max(1, Math.round(b.reps));
    for (let i = 0; i < reps; i++) {
      const niveau = niveauDepuisPourcent(b.work.int);
      segments.push({ min: b.work.min, niveau, effort: b.type === 'interval' || niveau >= 0.55 });
      if (b.rec && b.rec.min > 0) segments.push({ min: b.rec.min, niveau: niveauDepuisPourcent(b.rec.int), effort: false });
    }
  }
  return segments.filter((s) => s.min > 0);
}

/** La durée totale des segments, en minutes */
export const dureeProfil = (segments: SegmentProfil[]): number => segments.reduce((t, s) => t + s.min, 0);

/** « 15 min d'échauffement · 6 × 3 min · 10 min de retour au calme » */
export function resumeBlocs(blocs: BlocStructure[] | undefined): string {
  return (blocs ?? [])
    .map((b) => {
      if (b.type === 'interval') return b.reps > 1 ? `${b.reps} × ${b.work.min} min` : `${b.work.min} min soutenues`;
      if (b.type === 'warmup') return `${b.work.min} min d'échauffement`;
      if (b.type === 'cooldown') return `${b.work.min} min de retour au calme`;
      return `${b.work.min} min continues`;
    })
    .join(' · ');
}
