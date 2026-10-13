// Moteur de charge : de la liste des séances à la charge quotidienne, puis à la condition (CTL), la fatigue (ATL),
// la fraîcheur (TSB) et le ratio de charge aiguë/chronique (ACWR). Fonctions pures.
//
// Modèle (Banister, popularisé par TrainingPeaks) :
//   CTL (condition)  = moyenne exponentielle de la charge, constante de temps 42 jours
//   ATL (fatigue)    = idem, 7 jours
//   TSB (fraîcheur)  = CTL de la veille − ATL de la veille
// ACWR (Gabbett 2016, version exponentielle de Williams 2017) = charge aiguë (7 j) / charge chronique (28 j)
import { chargeSeance } from '../data/synthese.js';
import { moyenne, decalerJour, joursEntre, ewma } from './maths.js';

export const TAU_CTL = 42;
export const TAU_ATL = 7;

/** Charge de chaque jour (ISO → points). Les jours sans séance valent 0. */
export function chargesQuotidiennes(seances, debut, fin) {
  const parJour = new Map(joursEntre(debut, fin).map((j) => [j, 0]));
  for (const s of seances) {
    const iso = String(s.start_date_local || '').slice(0, 10);
    if (parJour.has(iso)) parJour.set(iso, parJour.get(iso) + chargeSeance(s));
  }
  return parJour;
}

/**
 * Série quotidienne complète de debut à fin :
 * [{ iso, charge, ctl, atl, tsb, aigue, chronique, acwr }]
 * `echauffement` jours sont simulés avant `debut` pour que la condition soit déjà « chargée » (0 au départ = faux).
 * `prevues` : charges prévues (ISO → points) ajoutées aux jours sans séance réalisée (sert aux projections).
 */
export function serieCharge(seances, debut, fin, { echauffement = 126, prevues = null } = {}) {
  const depart = decalerJour(debut, -echauffement);
  const charges = chargesQuotidiennes(seances, depart, fin);
  const jours = [...charges.keys()];
  const valeurs = jours.map((iso) => {
    const reel = charges.get(iso);
    return reel > 0 || !prevues ? reel : prevues.get(iso) || 0;
  });
  // départ réaliste : la charge moyenne des 42 premiers jours (au lieu de 0, qui sous-estime la condition pendant des semaines)
  const initiale = moyenne(valeurs.slice(0, TAU_CTL));
  const ctl = ewma(valeurs, TAU_CTL, initiale);
  const atl = ewma(valeurs, TAU_ATL, initiale);
  const aigue = ewma(valeurs, 7, initiale);
  const chronique = ewma(valeurs, 28, initiale);
  const sortie = [];
  jours.forEach((iso, i) => {
    if (iso < debut) return;
    sortie.push({
      iso,
      charge: valeurs[i],
      ctl: ctl[i],
      atl: atl[i],
      tsb: (ctl[i - 1] ?? initiale) - (atl[i - 1] ?? initiale),
      aigue: aigue[i],
      chronique: chronique[i],
      acwr: chronique[i] >= 5 ? aigue[i] / chronique[i] : null, // trop peu de charge de fond : le ratio n'a pas de sens
    });
  });
  return sortie;
}

/** Zone de risque d'un ACWR (Gabbett) : { cle, libelle, ton }. */
export function zoneAcwr(v) {
  if (v == null) return { cle: 'inconnu', libelle: 'Pas assez de recul', ton: 'neutre' };
  if (v < 0.8) return { cle: 'bas', libelle: 'Sous-charge', ton: 'info' };
  if (v <= 1.3) return { cle: 'optimal', libelle: 'Zone optimale', ton: 'ok' };
  if (v <= 1.5) return { cle: 'vigilance', libelle: 'Zone de vigilance', ton: 'alerte' };
  return { cle: 'danger', libelle: 'Zone de danger', ton: 'danger' };
}

/** Zone de fraîcheur d'un TSB : { cle, libelle, ton }. */
export function zoneTsb(v) {
  if (v >= 25) return { cle: 'detrain', libelle: 'Désentraînement', ton: 'info' };
  if (v >= 5) return { cle: 'frais', libelle: 'Frais, prêt à performer', ton: 'ok' };
  if (v >= -10) return { cle: 'transition', libelle: 'Neutre', ton: 'neutre' };
  if (v >= -30) return { cle: 'optimal', libelle: 'Charge productive', ton: 'ok' };
  return { cle: 'risque', libelle: 'Fatigue excessive', ton: 'danger' };
}
