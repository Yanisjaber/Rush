// La structure d'une séance du coach, dite en une phrase. Les blocs, les zones et le dessin du profil viennent du calendrier
// (data/calendrier/structure.ts et components/graphes/ProfilSeance.tsx) : une seule définition de « ce qu'est une structure » dans l'app.
import type { BlocStructure } from './types.ts';

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
