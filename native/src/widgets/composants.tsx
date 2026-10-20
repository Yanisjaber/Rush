import type { ComponentType } from 'react';
import { Text } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import type { WidgetProps } from '@/data/types';
import { WIDGETS, type DefinitionWidget } from '@/data/registre';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { WidgetAvenir } from './WidgetAvenir';
import { WidgetCharge } from './WidgetCharge';
import { WidgetChargeForce } from './WidgetChargeForce';
import { WidgetChargeMuscu } from './WidgetChargeMuscu';
import { WidgetDernieres } from './WidgetDernieres';
import { WidgetEfficacite } from './WidgetEfficacite';
import { WidgetForme } from './WidgetForme';
import { WidgetGroupes } from './WidgetGroupes';
import { WidgetHyroxAllure } from './WidgetHyroxAllure';
import { WidgetHyroxDossard } from './WidgetHyroxDossard';
import { WidgetHyroxGains } from './WidgetHyroxGains';
import { WidgetHyroxTest } from './WidgetHyroxTest';
import { WidgetMeilleures } from './WidgetMeilleures';
import { WidgetObjectif } from './WidgetObjectif';
import { WidgetPredictions } from './WidgetPredictions';
import { WidgetProgrammes } from './WidgetProgrammes';
import { WidgetPuissance } from './WidgetPuissance';
import { WidgetRecords } from './WidgetRecords';
import { WidgetRegularite } from './WidgetRegularite';
import { WidgetSeanceDuJour } from './WidgetSeanceDuJour';
import { WidgetSemaine } from './WidgetSemaine';
import { WidgetTonnage } from './WidgetTonnage';
import { WidgetVolume } from './WidgetVolume';

// Correspondance entre l'identifiant d'un widget (voir data/registre.ts) et son composant.
// Les widgets pas encore refaits en natif ont un bloc « bientôt » (voir WidgetBientot).
export const COMPOSANTS: Record<string, ComponentType<WidgetProps>> = {
  objectif: WidgetObjectif,
  charge: WidgetCharge,
  forme: WidgetForme,
  volume: WidgetVolume,
  semaine: WidgetSemaine,
  avenir: WidgetAvenir,
  regularite: WidgetRegularite,
  dernieres: WidgetDernieres,
  predictions: WidgetPredictions,
  efficacite: WidgetEfficacite,
  meilleures: WidgetMeilleures,
  puissance: WidgetPuissance,
  seancedujour: WidgetSeanceDuJour,
  programmes: WidgetProgrammes,
  tonnage: WidgetTonnage,
  chargemuscu: WidgetChargeMuscu,
  records: WidgetRecords,
  groupes: WidgetGroupes,
  hyroxdossard: WidgetHyroxDossard,
  hyroxtest: WidgetHyroxTest,
  hyroxallure: WidgetHyroxAllure,
  hyroxgains: WidgetHyroxGains,
  chargeforce: WidgetChargeForce,
};

/** Bloc provisoire d'un widget qui n'existe pas encore en natif : son nom et sa description. */
export function WidgetBientot({ id }: { id: string }) {
  const p = usePalette();
  const def = (WIDGETS as Record<string, DefinitionWidget>)[id];
  return (
    <CadreWidget titre={def?.nom ?? id}>
      <Text style={[typo.petit, { color: p.texteDoux }]}>{def?.description ?? ''} Bientôt.</Text>
    </CadreWidget>
  );
}
