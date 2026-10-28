import type { ComponentType } from 'react';
import { Text } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import type { WidgetProps } from '@/data/types';
import { WIDGETS, type DefinitionWidget } from '@/data/accueil/registre';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { WidgetAujourdhui } from './general/WidgetAujourdhui';
import { WidgetAvenir } from './general/WidgetAvenir';
import { WidgetCharge } from './general/WidgetCharge';
import { WidgetChargeForce } from './hyrox/WidgetChargeForce';
import { WidgetChargeMuscu } from './muscu/WidgetChargeMuscu';
import { WidgetDeniveleSki } from './ski/WidgetDeniveleSki';
import { WidgetDernieres } from './general/WidgetDernieres';
import { WidgetDenivele } from './velo/WidgetDenivele';
import { WidgetEfficacite } from './course/WidgetEfficacite';
import { WidgetProgression } from './general/WidgetProgression';
import { WidgetFtp } from './velo/WidgetFtp';
import { WidgetForme } from './general/WidgetForme';
import { WidgetGroupes } from './muscu/WidgetGroupes';
import { WidgetHyroxAllure } from './hyrox/WidgetHyroxAllure';
import { WidgetHyroxDossard } from './hyrox/WidgetHyroxDossard';
import { WidgetHyroxDerive } from './hyrox/WidgetHyroxDerive';
import { WidgetHyroxEvolution } from './hyrox/WidgetHyroxEvolution';
import { WidgetHyroxGains } from './hyrox/WidgetHyroxGains';
import { WidgetHyroxHebdo } from './hyrox/WidgetHyroxHebdo';
import { WidgetHyroxRunsStations } from './hyrox/WidgetHyroxRunsStations';
import { WidgetHyroxTest } from './hyrox/WidgetHyroxTest';
import { WidgetKmHebdo } from './course/WidgetKmHebdo';
import { WidgetKmSki } from './ski/WidgetKmSki';
import { WidgetKmVelo } from './velo/WidgetKmVelo';
import { WidgetMeilleures } from './course/WidgetMeilleures';
import { WidgetMeilleuresSki } from './ski/WidgetMeilleuresSki';
import { WidgetNatAllure } from './natation/WidgetNatAllure';
import { WidgetNatCourbe } from './natation/WidgetNatCourbe';
import { WidgetNatLongue } from './natation/WidgetNatLongue';
import { WidgetNatMois } from './natation/WidgetNatMois';
import { WidgetNatPrepa } from './natation/WidgetNatPrepa';
import { WidgetNatRythmes } from './natation/WidgetNatRythmes';
import { WidgetNatVolume } from './natation/WidgetNatVolume';
import { WidgetObjectif } from './general/WidgetObjectif';
import { WidgetPredictions } from './course/WidgetPredictions';
import { WidgetProgrammes } from './muscu/WidgetProgrammes';
import { WidgetPuissance } from './velo/WidgetPuissance';
import { WidgetRecords } from './muscu/WidgetRecords';
import { WidgetRegularite } from './general/WidgetRegularite';
import { WidgetSeanceDuJour } from './muscu/WidgetSeanceDuJour';
import { WidgetSemaine } from './general/WidgetSemaine';
import { WidgetTonnage } from './muscu/WidgetTonnage';
import { WidgetSkiIntensite } from './ski/WidgetSkiIntensite';
import { WidgetSkiPrepa } from './ski/WidgetSkiPrepa';
import { WidgetSkiSurfaces } from './ski/WidgetSkiSurfaces';
import { WidgetTriBricks } from './triathlon/WidgetTriBricks';
import { WidgetTriEquilibre } from './triathlon/WidgetTriEquilibre';
import { WidgetTriFraicheur } from './triathlon/WidgetTriFraicheur';
import { WidgetTriReperes } from './triathlon/WidgetTriReperes';
import { WidgetVolume } from './general/WidgetVolume';
import { WidgetWattsCardio } from './velo/WidgetWattsCardio';
import { WidgetZonesAllure } from './course/WidgetZonesAllure';
import { WidgetZonesPuissance } from './velo/WidgetZonesPuissance';

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
