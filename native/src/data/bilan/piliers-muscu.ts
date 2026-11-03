// Le niveau global de la musculation : quatre piliers notés de 0 à 100 (mécanique commune : piliers-sport.ts), calculés année par année à partir du carnet de force (une ligne par série) et des séances.
//   force      : tes charges : le 1RM estimé (Epley, séries de 1 à 12 répétitions) de l'année pour tes 5 exercices les plus pratiqués, chacun contre ton meilleur de TOUS LES TEMPS sur cet exercice (100 = ton record, 0 = 30 % plus faible) ;
//   volume     : ce que tu soulèves : 40 % le tonnage (poids × répétitions), 20 % les séries et 40 % les heures de séance de l'année, chacun contre la moyenne de tes 3 MEILLEURES années (100 = cette référence, 0 à 40 %).
//                Une année en cours ou la première n'ayant pas 365 jours de données, ses totaux sont ramenés à une année complète (× 365 ÷ jours couverts, à partir de 30 jours) ;
//   régularité : revenir : 50 % les séances par semaine (3 par semaine = 100) et 50 % la part des semaines avec au moins une séance, sur les semaines couvertes de l'année ;
//   équilibre  : travailler tout le corps : l'entropie des séries entre les groupes musculaires (jambes, dos, pectoraux, épaules, bras, tronc) de l'année : 0,5 = 0, 0,95 (presque équilibré) = 100.
// La force et l'équilibre viennent du carnet de force (il commence au premier import) : sans carnet pour une année, ces deux piliers n'ont pas de preuve et l'année n'a pas de score global si moins de 3 piliers sont prouvés.
// Preuves : la force demande 3 exercices mesurés dans l'année, l'équilibre 30 séries, le volume et la régularité 30 jours de données. Avec moins, la note est réduite d'autant.
import type { SerieForce } from '../types.ts';
import type { ActiviteBilan } from './bilan.ts';
import { moyenneDesMeilleures, noteChargeDe, noteLineaire, preuveDe, surUneAnnee } from './piliers-niveau.ts';
import { assemblerNiveau, joursCouverts, moyenneNotes, moyennePonderee, type NiveauGlobalSport, type PilierSport } from './piliers-sport.ts';
import { epley, exercicesDuCarnet, REPS_MAX_1RM, seriesAvecCharge } from './records-muscu.ts';

export const PILIERS_MUSCU: readonly PilierSport[] = [
  { cle: 'force', nom: 'Force', abrege: 'Force', explication: '1RM de tes 5 exercices principaux' },
  { cle: 'volume', nom: 'Volume', abrege: 'Volume', explication: 'Tonnage, séries, heures' },
  { cle: 'regularite', nom: 'Régularité', abrege: 'Régul.', explication: 'Séances par semaine, semaines actives' },
  { cle: 'equilibre', nom: 'Équilibre', abrege: 'Équil.', explication: 'Répartition entre les groupes musculaires' },
];

/** Combien d'exercices comptent pour la force, et combien de mesurés pour une preuve complète. */
export const EXERCICES_FORCE = 5;
export const EXERCICES_FORCE_MINI = 3;
/** La force est notée de 0 (30 % sous ton record) à 100 (ton record). */
export const FORCE_ZERO = 0.7;
/** Ce que compte le volume. */
export const POIDS_VOLUME_MUSCU = { tonnage: 0.4, series: 0.2, heures: 0.4 } as const;
/** Les séances par semaine qui valent 100 en régularité. */
export const SEANCES_SEMAINE_CENT = 3;
/** L'équilibre : 0,5 d'entropie normalisée = 0, 0,95 = 100 ; il faut 30 séries dans l'année pour une preuve complète. */
export const EQUILIBRE_ZERO = 0.5;
export const EQUILIBRE_CENT = 0.95;
export const SERIES_MINI_EQUILIBRE = 30;
/** Les groupes musculaires du carnet (leur nombre fixe l'échelle de l'entropie). */
export const GROUPES_MUSCULAIRES = 6;
/** 30 jours de données pour que le volume et la régularité soient jugés. */
export const JOURS_MINI = 30;

const anDe = (iso: string): number => Number(String(iso).slice(0, 4));
const jourDe = (iso: string): number => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000;
/** La semaine (lundi = 0) d'un jour, pour compter les semaines actives. */
const semaineDe = (iso: string): number => Math.floor((jourDe(iso) + 3) / 7); // le 1er janvier 1970 était un jeudi : +3 ramène le lundi au début de la semaine

/** L'entropie de Shannon normalisée (0 = tout dans un groupe, 1 = parfaitement réparti entre `n` groupes). */
export function entropieNormalisee(parts: readonly number[], n = GROUPES_MUSCULAIRES): number {
  const total = parts.reduce((t, x) => t + x, 0);
  if (!(total > 0) || n < 2) return 0;
  return Math.max(0, -parts.filter((x) => x > 0).reduce((t, x) => t + (x / total) * Math.log(x / total), 0) / Math.log(n));
}

/**
 * Les piliers de chaque année de musculation. `acts` : les séances de musculation (famille « musculation ») ; `series` : tout le carnet de force.
 * Une année existe dès qu'elle a une séance ou une série. Null sans aucune des deux.
 */
export function niveauGlobalMuscu(series: readonly SerieForce[], acts: readonly ActiviteBilan[], maintenant: Date): NiveauGlobalSport | null {
  const seances = acts.filter((a) => a.sport === 'musculation');
  const valides = seriesAvecCharge(series);
  const annees = [...new Set([...seances.map((a) => anDe(a.iso)), ...series.map((s) => anDe(s.date))])].sort((a, b) => a - b);
  if (!annees.length) return null;
  const premierJour = [...seances.map((a) => a.iso), ...series.map((s) => String(s.date).slice(0, 10))].reduce((m, d) => (d < m ? d : m), '9999-12-31');

  // Les exercices qui comptent pour la force : les 5 plus pratiqués de tout le carnet (au moins 6 séries), et le meilleur 1RM de chacun
  const exercices = exercicesDuCarnet(valides).filter((e) => e.nSeries >= 6).slice(0, EXERCICES_FORCE);
  const rm = (s: SerieForce): number => (Number(s.reps) <= REPS_MAX_1RM ? epley(Number(s.weight_kg), Number(s.reps)) : 0);
  const meilleurDeToujours = new Map(exercices.map((e) => [e.cle, Math.max(0, ...valides.filter((s) => s.exercise_key === e.cle).map(rm))]));

  // Le volume de chaque année, ramené à une année complète
  const parAn = annees.map((an) => {
    const couverts = joursCouverts(an, premierJour, maintenant);
    const seriesAn = valides.filter((s) => anDe(s.date) === an);
    const seancesAn = seances.filter((a) => anDe(a.iso) === an);
    const seriesCompte = seancesAn.reduce((t, a) => t + (a.series ?? 0), 0);
    return {
      an, couverts, seriesAn, seancesAn,
      tonnage: surUneAnnee(seancesAn.reduce((t, a) => t + (a.tonnage ?? 0), 0), couverts),
      series: surUneAnnee(seriesCompte, couverts),
      heures: surUneAnnee(seancesAn.reduce((t, a) => t + a.duree_min / 60, 0), couverts),
      aDesSeries: seriesCompte > 0,
    };
  });
  const refTonnage = moyenneDesMeilleures(parAn.map((x) => x.tonnage));
  const refSeries = moyenneDesMeilleures(parAn.map((x) => x.series));
  const refHeures = moyenneDesMeilleures(parAn.map((x) => x.heures));

  const entrees = parAn.map((x) => {
    // Force : le meilleur 1RM de l'année de chaque exercice principal, contre ton record de toujours
    const notesForce = exercices
      .map((e) => {
        const record = meilleurDeToujours.get(e.cle) ?? 0;
        const annee = Math.max(0, ...x.seriesAn.filter((s) => s.exercise_key === e.cle).map(rm));
        return record > 0 && annee > 0 ? noteLineaire(annee / record, FORCE_ZERO, 1) : null;
      })
      .filter((n): n is number => n !== null);
    const preuveForce = preuveDe(notesForce.length, Math.min(EXERCICES_FORCE_MINI, Math.max(1, exercices.length)));

    // Volume : une part sans mesure ne compte pas
    const parts: [number, number][] = [];
    if (x.tonnage !== null && x.tonnage > 0 && refTonnage > 0) parts.push([POIDS_VOLUME_MUSCU.tonnage, noteChargeDe(x.tonnage / refTonnage)]);
    if (x.series !== null && x.series > 0 && refSeries > 0) parts.push([POIDS_VOLUME_MUSCU.series, noteChargeDe(x.series / refSeries)]);
    if (x.heures !== null && x.heures > 0 && refHeures > 0) parts.push([POIDS_VOLUME_MUSCU.heures, noteChargeDe(x.heures / refHeures)]);

    // Régularité : les séances par semaine et la part des semaines actives, sur les semaines couvertes
    const semainesCouvertes = x.couverts / 7;
    const semainesActives = new Set(x.seancesAn.map((a) => semaineDe(a.iso))).size;
    const parSemaine = semainesCouvertes > 0 ? x.seancesAn.length / semainesCouvertes : 0;
    const regularite = x.seancesAn.length && semainesCouvertes > 0 ? 100 * (0.5 * Math.min(1, parSemaine / SEANCES_SEMAINE_CENT) + 0.5 * Math.min(1, semainesActives / semainesCouvertes)) : 0;

    // Équilibre : les séries entre les groupes musculaires
    const parGroupe = new Map<string, number>();
    for (const s of x.seriesAn) parGroupe.set(s.muscle_group || 'autre', (parGroupe.get(s.muscle_group || 'autre') ?? 0) + 1);
    const equilibre = x.seriesAn.length ? noteLineaire(entropieNormalisee([...parGroupe.values()]), EQUILIBRE_ZERO, EQUILIBRE_CENT) : 0;
    const preuveEquilibre = preuveDe(x.seriesAn.length, SERIES_MINI_EQUILIBRE);

    const preuveRegularite = x.seancesAn.length ? preuveDe(x.couverts, JOURS_MINI) : 0;
    return {
      an: x.an,
      notes: { force: moyenneNotes(notesForce) * preuveForce, volume: moyennePonderee(parts), regularite: regularite * preuveRegularite, equilibre: equilibre * preuveEquilibre },
      preuves: { force: preuveForce, volume: parts.length ? 1 : 0, regularite: preuveRegularite, equilibre: preuveEquilibre },
    };
  });
  return assemblerNiveau(PILIERS_MUSCU, entrees);
}
