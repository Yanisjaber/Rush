// Le profil d'intensité d'une séance du coach : une suite de segments (durée, niveau d'effort) tirée de sa structure.
// Fonctions pures, sans écran. Les répétitions, les zones et la lecture des pourcentages viennent du module du calendrier (data/calendrier/structure.ts) :
// une seule définition de « ce qu'est une structure » dans toute l'app.
import { indiceZone, milieu, tousSegments, ZONES } from '../calendrier/structure.ts';
import type { BlocStructure } from './types.ts';

export interface SegmentProfil {
  /** Durée en minutes (sert de largeur) */
  min: number;
  /** Niveau d'effort de 0,2 (zone la plus basse) à 1 (zone la plus haute) : sert de hauteur */
  niveau: number;
  /** Segment d'effort (zone 3 ou plus, hors récupération) : dessiné en couleur de sport */
  effort: boolean;
}

/** La structure en segments, dans l'ordre : un bloc d'intervalles donne « travail, récupération » répétés */
export function profilSeance(blocs: BlocStructure[] | undefined): SegmentProfil[] {
  return tousSegments(blocs ?? [])
    .filter(({ seg }) => seg.min > 0)
    .map(({ seg, role, metric }) => {
      const zone = indiceZone(milieu(seg), metric);
      const nbZones = ZONES[metric].noms.length;
      return { min: seg.min, niveau: Math.round((0.2 + (0.8 * zone) / Math.max(1, nbZones - 1)) * 100) / 100, effort: role === 'travail' && zone >= 2 };
    });
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
