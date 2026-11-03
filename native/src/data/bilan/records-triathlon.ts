// Les records de séance du triathlon et du duathlon (Bilan › Records › Tout) : les plus longues séances de chaque discipline, la plus longue séance et la plus grosse charge, toutes disciplines confondues.
// Les meilleurs efforts de chaque discipline (la courbe de puissance du vélo, l'allure de la course) se lisent en choisissant la discipline dans l'onglet (voir OngletRecordsTriathlon). Fonctions pures, sans réseau.
import type { ActiviteBilan } from './bilan.ts';
import type { EntreeRecord, RecordTop } from './records.ts';

/** Les n meilleures entrées (la plus grande valeur d'abord, à égalité la plus ancienne), sans les valeurs nulles. */
function meilleures(entrees: EntreeRecord[], n = 30): EntreeRecord[] {
  return entrees
    .filter((e) => Number.isFinite(e.valeur) && e.valeur > 0)
    .sort((a, b) => b.valeur - a.valeur || (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0))
    .slice(0, n);
}

/**
 * Les records d'un groupe de séances multisport : la plus longue séance (le temps), la plus grosse charge, la plus longue natation, la plus longue sortie à vélo, la plus longue course et le plus gros D+ à vélo.
 * La distance et le dénivelé du vélo virtuel sont simulés : ils ne comptent pas. Un record sans séance est absent.
 */
export function recordsTriathlon(acts: readonly ActiviteBilan[]): RecordTop[] {
  const entree = (a: ActiviteBilan, valeur: number): EntreeRecord => ({ valeur, nom: a.name || 'Sans titre', iso: a.iso, id: a.id, famille: a.famille });
  const dehors = (a: ActiviteBilan): boolean => a.type !== 'VirtualRide';
  const de = (famille: string, cle: 'distance_km' | 'd_plus', filtre: (a: ActiviteBilan) => boolean = () => true): EntreeRecord[] =>
    meilleures(acts.filter((a) => a.famille === famille && filtre(a)).map((a) => entree(a, a[cle])));
  const records: RecordTop[] = [
    { cle: 'duree', libelle: 'Plus longue séance', unite: 'min', top: meilleures(acts.map((a) => entree(a, a.duree_min))) },
    { cle: 'tss', libelle: 'Plus grosse charge', unite: 'TSS', top: meilleures(acts.map((a) => entree(a, a.tss))) },
    { cle: 'nat_distance', libelle: 'Plus longue natation', unite: 'km', top: de('natation', 'distance_km') },
    { cle: 'velo_distance', libelle: 'Plus longue sortie à vélo', unite: 'km', top: de('velo', 'distance_km', dehors) },
    { cle: 'course_distance', libelle: 'Plus longue course', unite: 'km', top: de('course', 'distance_km') },
    { cle: 'velo_dplus', libelle: 'Plus gros D+ à vélo', unite: 'm', top: de('velo', 'd_plus', dehors) },
  ];
  return records.filter((r) => r.top.length);
}
