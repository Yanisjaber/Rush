import { Text } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { CarteChaleur } from '@/components/CarteChaleur';
import { MiniBarres } from '@/components/MiniBarres';
import { Tuile } from '@/components/Tuile';
import { casesRegularite } from '@/data/synthese';
import type { WidgetProps } from '@/data/types';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const NB_SEMAINES = 12;

// Une case par jour sur 12 semaines, à la couleur du sport dominant.
// compact : tuile (jours entraînés cette semaine + les 8 dernières semaines en barres).
export function WidgetRegularite({ contexte, compact = false }: WidgetProps) {
  const p = usePalette();
  const cases = casesRegularite(contexte.seances, NB_SEMAINES);
  // Jours entraînés par semaine : les cases sont rangées par jour de semaine (lundi → dimanche), puis par semaine
  const joursParSemaine = Array.from({ length: NB_SEMAINES }, (_, col) => {
    let n = 0;
    for (let rangee = 0; rangee < 7; rangee++) {
      const c = cases[rangee * NB_SEMAINES + col];
      if (c && !c.vide && c.intensite > 0) n++;
    }
    return n;
  });
  const cetteSemaine = joursParSemaine[NB_SEMAINES - 1];

  if (compact) {
    return (
      <Tuile titre="Régularité" valeur={String(cetteSemaine)} unite={cetteSemaine > 1 ? 'jours' : 'jour'} note="d'entraînement cette semaine">
        <MiniBarres valeurs={joursParSemaine.slice(-8)} max={7} couleur={p.sportMuscu} etiquette="Jours d'entraînement par semaine sur 8 semaines" />
      </Tuile>
    );
  }
  return (
    <Bloc titre="Régularité">
      <CarteChaleur cases={cases} etiquette="Carte des jours d'entraînement sur 12 semaines" />
      <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>La couleur est celle du sport du jour ; plus elle est vive, plus la charge est forte.</Text>
    </Bloc>
  );
}
