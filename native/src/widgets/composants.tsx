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
import { WidgetDeniveleSki } from './WidgetDeniveleSki';
import { WidgetDernieres } from './WidgetDernieres';
import { WidgetDenivele } from './WidgetDenivele';
import { WidgetEfficacite } from './WidgetEfficacite';
import { WidgetProgression } from './WidgetProgression';
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
import { WidgetKmSki } from './WidgetKmSki';
import { WidgetKmVelo } from './WidgetKmVelo';
import { WidgetMeilleures } from './WidgetMeilleures';
import { WidgetMeilleuresSki } from './WidgetMeilleuresSki';
import { WidgetNatAllure } from './WidgetNatAllure';
import { WidgetNatCourbe } from './WidgetNatCourbe';
import { WidgetNatLongue } from './WidgetNatLongue';
import { WidgetNatMois } from './WidgetNatMois';
import { WidgetNatPrepa } from './WidgetNatPrepa';
import { WidgetNatRythmes } from './WidgetNatRythmes';
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
import { WidgetSkiIntensite } from './WidgetSkiIntensite';
import { WidgetSkiPrepa } from './WidgetSkiPrepa';
import { WidgetSkiSurfaces } from './WidgetSkiSurfaces';
import { WidgetTriBricks } from './WidgetTriBricks';
import { WidgetTriEquilibre } from './WidgetTriEquilibre';
import { WidgetTriFraicheur } from './WidgetTriFraicheur';
import { WidgetTriReperes } from './WidgetTriReperes';
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
  progression: WidgetProgression,
  meilleures: WidgetMeilleures,
  kmhebdo: WidgetKmHebdo,
  zonesallure: WidgetZonesAllure,
  kmvelo: WidgetKmVelo,
  denivele: WidgetDenivele,
  ftp: WidgetFtp,
  zonespuissance: WidgetZonesPuissance,
  wattscardio: WidgetWattsCardio,
  triequilibre: WidgetTriEquilibre,
  trifraicheur: WidgetTriFraicheur,
  tribricks: WidgetTriBricks,
  trireperes: WidgetTriReperes,
  natcourbe: WidgetNatCourbe,
  natmois: WidgetNatMois,
  natrythmes: WidgetNatRythmes,
  natprepa: WidgetNatPrepa,
  kmski: WidgetKmSki,
  deniveleski: WidgetDeniveleSki,
  skisurfaces: WidgetSkiSurfaces,
  skiintensite: WidgetSkiIntensite,
  skiprepa: WidgetSkiPrepa,
  meilleuresski: WidgetMeilleuresSki,
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
