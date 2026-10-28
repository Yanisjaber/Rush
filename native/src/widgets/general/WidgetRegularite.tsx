import { Text } from 'react-native';
import { CadreWidget } from '@/components/widgets/CadreWidget';
import { CarteChaleur } from '@/components/graphes/CarteChaleur';
import { MiniBarres } from '@/components/graphes/MiniBarres';
import { Tuile } from '@/components/ui/Tuile';
import { casesRegularite } from '@/data/bilan/synthese';
import type { WidgetProps } from '@/data/types';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const NB_SEMAINES = 12;

// Une case par jour sur 12 semaines, à la couleur du sport dominant.
export function WidgetRegularite({ contexte, taille = 'm' }: WidgetProps) {
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

  // XS : les jours de la semaine ; S : + les 8 dernières semaines en barres ; M : + la carte des 12 semaines serrée ; L : la carte en grand
  if (taille !== 'l') {
    return (
      <Tuile titre="Régularité" valeur={String(cetteSemaine)} unite={cetteSemaine > 1 ? 'jours' : 'jour'} note="cette semaine" large>
        {taille === 's' ? (
          <MiniBarres valeurs={joursParSemaine.slice(-8)} max={7} couleur={p.sportMuscu} etiquette="Jours d'entraînement par semaine sur 8 semaines" />
        ) : taille === 'm' ? (
          <CarteChaleur cases={cases} ecart={2} hauteurCase={11} etiquette="Carte des jours d'entraînement sur 12 semaines" />
        ) : null}
      </Tuile>
    );
  }
  return (
    <CadreWidget titre="Régularité">
      <CarteChaleur cases={cases} etiquette="Carte des jours d'entraînement sur 12 semaines" />
      <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>La couleur est celle du sport du jour ; plus elle est vive, plus la charge est forte.</Text>
    </CadreWidget>
  );
}
