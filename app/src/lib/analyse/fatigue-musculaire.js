// Fatigue musculaire : à quel point chaque groupe (et chaque muscle) est-il fatigué, et dans combien de temps sera-t-il prêt ?
// Chaque série de muscu fatigue les muscles qu'elle travaille (selon la part de chaque muscle, voir muscles.js), puis la fatigue
// retombe avec le temps : de façon exponentielle, plus vite pour les petits muscles que pour les gros.
// La fatigue s'exprime en % d'une « grosse journée » de CE groupe (le 75e centile de tes journées d'entraînement de ce groupe) :
// 100 % = tu viens de faire une de tes grosses séances sur ce groupe. Ce sont des repères d'entraînement, pas des mesures médicales.
// Fonctions pures, sans réseau ni écran.
import { MUSCLES, MUSCLES_PAR_GROUPE, repartirSerie } from '../data/muscles.js';
import { GROUPES, ORDRE_GROUPES } from '../data/exercices.js';
import { decalerJour } from './maths.js';

/** Constante de temps de la récupération, en jours (il reste 37 % de la fatigue après ce délai, 14 % après le double). */
export const TAU_GROUPE = { jambes: 2, dos: 2, pectoraux: 2, epaules: 1.5, bras: 1.5, tronc: 1.5 };
export const SEUIL_PRET = 0.2; // un groupe est « prêt » quand il lui reste moins de 20 % d'une grosse journée
const JOURS_MAX = 10; // au-delà, il ne reste plus rien à compter

/** Charge de chaque muscle et de chaque jour : { [slug]: Map(ISO → points) }. Une série se partage entre ses muscles (principal 1, secondaire 0,5). */
export function chargeParMuscleEtJour(sets) {
  const sortie = Object.fromEntries(Object.keys(MUSCLES).map((m) => [m, new Map()]));
  const parts = new Map();
  for (const s of sets) {
    const k = `${s.cle}|${s.groupe}`;
    if (!parts.has(k)) {
      const r = repartirSerie(s.cle, s.nom, s.groupe);
      const total = r.reduce((t, x) => t + x.poids, 0) || 1;
      parts.set(k, r.map((x) => ({ muscle: x.muscle, part: x.poids / total })));
    }
    for (const { muscle, part } of parts.get(k)) sortie[muscle].set(s.date, (sortie[muscle].get(s.date) || 0) + s.charge * part);
  }
  return sortie;
}

/** Somme de plusieurs « charge par jour ». */
function somme(cartes) {
  const total = new Map();
  for (const c of cartes) for (const [j, v] of c) total.set(j, (total.get(j) || 0) + v);
  return total;
}

/** Fatigue brute (en points) à un jour, à la fin de la journée : les séances passées, chacune qui s'estompe. */
export function fatigueBrute(parJour, jour, tau) {
  let f = 0;
  for (let e = 0; e <= JOURS_MAX; e++) {
    const c = parJour.get(decalerJour(jour, -e));
    if (c) f += c * Math.exp(-e / tau);
  }
  return f;
}

/** Une « grosse journée » de référence : le 75e centile de tes journées d'entraînement de ce groupe (au moins 5 journées), sinon null. */
export function referenceGrosse(parJour) {
  const v = [...parJour.values()].filter((x) => x > 0).sort((a, b) => a - b);
  if (v.length < 5) return null;
  return v[Math.min(v.length - 1, Math.floor(0.75 * (v.length - 1) + 0.5))];
}

/** Zone de fatigue (en % d'une grosse journée). */
export function zoneFatigue(pct) {
  if (pct == null) return { cle: 'inconnue', libelle: 'pas encore de repère', ton: 'neutre' };
  if (pct < 20) return { cle: 'frais', libelle: 'frais', ton: 'ok' };
  if (pct < 45) return { cle: 'legere', libelle: 'fatigue légère', ton: 'info' };
  if (pct < 75) return { cle: 'marquee', libelle: 'fatigue marquée', ton: 'alerte' };
  return { cle: 'forte', libelle: 'cuit', ton: 'danger' };
}

/** Heures avant que la fatigue (en % d'une grosse journée) repasse sous le seuil « prêt ». 0 si c'est déjà le cas. */
export function heuresAvantPret(pct, tau) {
  if (pct == null || pct / 100 <= SEUIL_PRET) return 0;
  return Math.round(tau * Math.log(pct / 100 / SEUIL_PRET) * 24);
}

/** Texte « prêt dans 2 jours », « prêt dans 14 h », « prêt ». */
export function texteDelai(heures) {
  if (heures <= 0) return 'prêt';
  if (heures < 24) return `prêt dans ${heures} h`;
  const j = Math.round(heures / 24);
  return `prêt dans ${j} jour${j > 1 ? 's' : ''}`;
}

/**
 * La courbe d'un groupe : sa fatigue (en % d'une grosse journée) sur les `jours` derniers jours, puis sa projection sur `avenir` jours
 * si tu ne refais aucune séance de ce groupe : [{ iso, pct }] pour le passé et pour le futur.
 */
export function courbeGroupe(parJour, ref, tau, jour, jours = 42, avenir = 7) {
  const passe = [];
  for (let i = jours - 1; i >= 0; i--) {
    const j = decalerJour(jour, -i);
    passe.push({ iso: j, pct: Math.round((fatigueBrute(parJour, j, tau) / ref) * 100) });
  }
  const futur = [];
  for (let i = 1; i <= avenir; i++) {
    const j = decalerJour(jour, i);
    futur.push({ iso: j, pct: Math.round((fatigueBrute(parJour, j, tau) / ref) * 100) });
  }
  return { passe, futur };
}

/**
 * La fatigue de chaque groupe et de chaque muscle à la fin du jour `jour` (aujourd'hui).
 * Renvoie { groupes: [{ groupe, nom, pct, zone, heures, courbe: { passe, futur } | null, muscles: [...] }], muscles: { [slug]: { slug, nom, groupe, pct, zone, heures } } }.
 * `pct` vaut null quand il n'y a pas assez de séances de ce groupe pour calibrer (au moins 5 journées).
 */
export function fatigueMusculaire(sets, jour) {
  const parMuscle = chargeParMuscleEtJour(sets);
  const muscles = {};
  for (const [slug, m] of Object.entries(MUSCLES)) {
    const tau = TAU_GROUPE[m.groupe];
    const ref = referenceGrosse(parMuscle[slug]);
    const pct = ref ? Math.round((fatigueBrute(parMuscle[slug], jour, tau) / ref) * 100) : null;
    muscles[slug] = { slug, nom: m.nom, groupe: m.groupe, pct, zone: zoneFatigue(pct), heures: heuresAvantPret(pct, tau) };
  }
  const groupes = ORDRE_GROUPES.map((g) => {
    const tau = TAU_GROUPE[g];
    const parJour = somme((MUSCLES_PAR_GROUPE[g] || []).map((slug) => parMuscle[slug]));
    const ref = referenceGrosse(parJour);
    const pct = ref ? Math.round((fatigueBrute(parJour, jour, tau) / ref) * 100) : null;
    return { groupe: g, nom: GROUPES[g].nom, pct, zone: zoneFatigue(pct), heures: heuresAvantPret(pct, tau), courbe: ref ? courbeGroupe(parJour, ref, tau, jour) : null, muscles: (MUSCLES_PAR_GROUPE[g] || []).map((s) => muscles[s]) };
  });
  return { groupes, muscles };
}
