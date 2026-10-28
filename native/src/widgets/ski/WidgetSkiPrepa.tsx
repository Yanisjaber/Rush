import { estSkiDeFond } from '@/data/sports/ski';
import { prepaDistance } from '@/data/sports/natation';
import type { WidgetProps } from '@/data/types';
import { usePalette } from '@/theme/usePalette';
import { PrepaDistance } from '../natation/WidgetNatPrepa';

// Où tu en es de la distance de ta prochaine course de ski de fond (Transjurassienne, Marcialonga…) : ta plus longue sortie face à elle.
export function WidgetSkiPrepa({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const prepa = prepaDistance(contexte.toutesSeances, contexte.objectifs, estSkiDeFond, (o) => estSkiDeFond(o), new Date());
  return <PrepaDistance taille={taille} prepa={prepa} couleur={p.sportNeutre} nomSport="ski de fond" unite="km" />;
}
