import { RepartitionZones } from '@/components/RepartitionZones';
import { intensiteCrossfit } from '@/data/crossfit';
import type { WidgetProps } from '@/data/types';
import { usePalette } from '@/theme/usePalette';

// À quelle intensité tu t'entraînes en CrossFit (4 dernières semaines) : le temps de chaque séance rangé selon son cardio moyen face à ta FC max.
// Une séance est rangée tout entière dans un niveau : c'est une estimation (un WOD alterne des pics et des pauses), le grand format le dit.
export function WidgetCfIntensite({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const aFcMax = Number(contexte.hrMax) > 0;
  return (
    <RepartitionZones
      taille={taille}
      titre="Intensité"
      couleur={p.sportHybride}
      rep={intensiteCrossfit(contexte.toutesSeances, contexte.hrMax)}
      videTuile={aFcMax ? 'Pas de séance avec cardio' : 'Renseigne ta FC max'}
      videL={aFcMax ? 'Pas de séance de CrossFit avec cardio sur les 4 dernières semaines.' : 'Renseigne ta FC max dans Paramètres › Physiologie pour voir à quelle intensité tu t\'entraînes.'}
      uniteTotal="de CrossFit, 4 semaines"
      pied="Chaque séance est rangée selon son cardio moyen en % de ta FC max : moins de 75 % modérée, de 75 à 85 % soutenue, au-delà intense. Une estimation : un WOD alterne des pics et des pauses."
    />
  );
}
