import { RepartitionZones } from '@/components/RepartitionZones';
import { intensiteParZone } from '@/data/sports/hebdo';
import { estSkiDeFond } from '@/data/sports/ski';
import type { WidgetProps } from '@/data/types';
import { usePalette } from '@/theme/usePalette';

// À quelle intensité tu skies (4 dernières semaines) : le temps de chaque séance rangé selon son cardio moyen face à ta FC max.
// Une séance est rangée tout entière dans un niveau : c'est une estimation, le grand format le dit.
export function WidgetSkiIntensite({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const aFcMax = Number(contexte.hrMax) > 0;
  return (
    <RepartitionZones
      taille={taille}
      titre="Intensité"
      couleur={p.sportNeutre}
      rep={intensiteParZone(contexte.toutesSeances, contexte.hrMax, estSkiDeFond)}
      videTuile={aFcMax ? 'Pas de ski avec cardio' : 'Renseigne ta FC max'}
      videL={aFcMax ? 'Pas de séance de ski avec cardio sur les 4 dernières semaines.' : "Renseigne ta FC max dans Paramètres › Physiologie pour voir à quelle intensité tu skies."}
      uniteTotal="de ski, 4 semaines"
      pied="Chaque séance est rangée selon son cardio moyen en % de ta FC max : moins de 75 % modérée, de 75 à 85 % soutenue, au-delà intense. Une estimation : une séance alterne des montées dures et des descentes faciles."
    />
  );
}
