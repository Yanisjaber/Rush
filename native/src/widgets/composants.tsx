import type { ComponentType } from 'react';
import { Text } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import type { WidgetProps } from '@/data/types';
import { WIDGETS, type DefinitionWidget } from '@/data/registre';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { WidgetAujourdhui } from './WidgetAujourdhui';
import { WidgetAvenir } from './WidgetAvenir';
import { WidgetCharge } from './WidgetCharge';
import { WidgetChargeForce } from './WidgetChargeForce';
import { WidgetChargeMuscu } from './WidgetChargeMuscu';
import { WidgetDernieres } from './WidgetDernieres';
import { WidgetDenivele } from './WidgetDenivele';
import { WidgetEfficacite } from './WidgetEfficacite';
import { WidgetFtp } from './WidgetFtp';
import { WidgetForme } from './WidgetForme';
import { WidgetGroupes } from './WidgetGroupes';
import { WidgetHyroxAllure } from './WidgetHyroxAllure';
import { WidgetHyroxDossard } from './WidgetHyroxDossard';
import { WidgetHyroxDerive } from './WidgetHyroxDerive';
import { WidgetHyroxEvolution } from './WidgetHyroxEvolution';
import { WidgetHyroxGains } from './WidgetHyroxGains';
import { WidgetHyroxHebdo } from './WidgetHyroxHebdo';
import { WidgetHyroxRunsStations } from './WidgetHyroxRunsStations';
import { WidgetHyroxTest } from './WidgetHyroxTest';
import { WidgetKmHebdo } from './WidgetKmHebdo';
import { WidgetKmVelo } from './WidgetKmVelo';
import { WidgetMeilleures } from './WidgetMeilleures';
import { WidgetNatAllure } from './WidgetNatAllure';
import { WidgetNatLongue } from './WidgetNatLongue';
import { WidgetNatVolume } from './WidgetNatVolume';
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
import { WidgetWattsCardio } from './WidgetWattsCardio';
import { WidgetZonesAllure } from './WidgetZonesAllure';
import { WidgetZonesPuissance } from './WidgetZonesPuissance';

// Correspondance entre l'identifiant d'un widget (voir data/registre.ts) et son composant.
// Un identifiant sans composant (une vieille disposition sauvegardée) affiche un bloc « bientôt » (voir WidgetBientot).
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
  kmhebdo: WidgetKmHebdo,
  zonesallure: WidgetZonesAllure,
  kmvelo: WidgetKmVelo,
  denivele: WidgetDenivele,
  ftp: WidgetFtp,
  zonespuissance: WidgetZonesPuissance,
  wattscardio: WidgetWattsCardio,
  puissance: WidgetPuissance,
  natvolume: WidgetNatVolume,
  natallure: WidgetNatAllure,
  natlongue: WidgetNatLongue,
  aujourdhui: WidgetAujourdhui,
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
  hyroxhebdo: WidgetHyroxHebdo,
  hyroxevolution: WidgetHyroxEvolution,
  hyroxrunsstations: WidgetHyroxRunsStations,
  hyroxderive: WidgetHyroxDerive,
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
