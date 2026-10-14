// Fatigue des jambes : quel effet une séance de muscu a-t-elle sur ton vélo et ta course à pied ?
// On ne additionne PAS la charge de muscu et celle du vélo (deux unités qui ne se comparent pas). On suit à la place la
// fatigue musculaire des jambes : chaque séance de muscu l'augmente selon ce que les jambes ont travaillé, puis elle
// retombe avec le temps (environ 2 jours de constante de temps : il en reste 60 % le lendemain, 37 % deux jours après).
// Puis on mesure sur TES sorties si l'efficacité (puissance ou vitesse par battement) baisse quand les jambes sont fatiguées.
// Fonctions pures, sans réseau ni écran. Appelées par analyserChargeMuscu.
import { MUSCLES, repartirSerie } from '../data/muscles.js';
import { familleAffichage } from '../data/familles.js';
import { estimerTss } from '../data/prevue.js';
import { moyenne, ecartType, decalerJour, ecartJours } from './maths.js';

export const TAU_JAMBES = 2; // jours : la fatigue des jambes décroît de 63 % tous les 2 jours
const JOURS_MAX = 10; // au-delà, il ne reste plus rien à compter
const MUSCLES_JAMBES = new Set(Object.entries(MUSCLES).filter(([, m]) => m.groupe === 'jambes').map(([slug]) => slug));

/**
 * Charge « jambes » de chaque jour (ISO → points) à partir des séries chargées par chargeParSerie.
 * Une série compte pour les jambes à hauteur de la part de ses muscles qui sont dans les jambes : un squat compte en entier,
 * un soulevé de terre en partie (fessiers, ischios), un développé couché pas du tout.
 */
export function chargeJambesParJour(sets) {
  const parJour = new Map();
  const parts = new Map();
  for (const s of sets) {
    const k = `${s.cle}|${s.groupe}`;
    if (!parts.has(k)) {
      const r = repartirSerie(s.cle, s.nom, s.groupe);
      const total = r.reduce((t, x) => t + x.poids, 0) || 1;
      parts.set(k, r.filter((x) => MUSCLES_JAMBES.has(x.muscle)).reduce((t, x) => t + x.poids, 0) / total);
    }
    const jambes = s.charge * parts.get(k);
    if (jambes > 0) parJour.set(s.date, (parJour.get(s.date) || 0) + jambes);
  }
  return parJour;
}

/** Fatigue brute des jambes (en points) à un jour : somme des séances passées qui s'estompent. `inclure` : compte aussi les séances de ce jour. */
export function fatigueBrute(parJour, jour, inclure = true) {
  let f = 0;
  for (let e = inclure ? 0 : 1; e <= JOURS_MAX; e++) {
    const c = parJour.get(decalerJour(jour, -e));
    if (c) f += c * Math.exp(-e / TAU_JAMBES);
  }
  return f;
}

/** Une « grosse séance de jambes » de référence : le 75e centile des journées où tu as travaillé les jambes (au moins 5 journées). */
export function referenceJambes(parJour) {
  const valeurs = [...parJour.values()].filter((v) => v > 0).sort((a, b) => a - b);
  if (valeurs.length < 5) return null;
  return valeurs[Math.min(valeurs.length - 1, Math.floor(0.75 * (valeurs.length - 1) + 0.5))];
}

/** Zone de la fatigue des jambes (en % d'une grosse séance de jambes). */
export function zoneJambes(pct) {
  if (pct < 20) return { cle: 'fraiches', libelle: 'jambes fraîches', ton: 'ok' };
  if (pct < 45) return { cle: 'legere', libelle: 'fatigue légère', ton: 'info' };
  if (pct < 75) return { cle: 'marquee', libelle: 'fatigue marquée', ton: 'alerte' };
  return { cle: 'forte', libelle: 'jambes cuites', ton: 'danger' };
}

/** Fatigue des jambes de chaque jour de debut à fin (inclus), en % de la grosse séance de référence, à la fin de la journée. */
export function courbeFatigue(parJour, ref, debut, fin) {
  const sortie = [];
  for (let j = debut; j <= fin; j = decalerJour(j, 1)) sortie.push({ iso: j, pct: Math.round((fatigueBrute(parJour, j, true) / ref) * 100) });
  return sortie;
}

/**
 * Tes sorties prévues de vélo et de course sur les `jours` prochains jours, avec la fatigue des jambes attendue le matin même
 * (sans nouvelle séance de muscu) et un conseil. Une sortie « dure » est une sortie d'au moins 60 points de charge.
 */
export function sortiesAVenir(planifiees, parJour, ref, aujourdhui, jours = 7) {
  const lim = decalerJour(aujourdhui, jours);
  return (planifiees || [])
    .filter((p) => p.date && p.date >= aujourdhui && p.date <= lim && p.category !== 'competition')
    .map((p) => ({ p, famille: familleAffichage(p.sport) }))
    .filter((x) => x.famille === 'velo' || x.famille === 'course')
    .map(({ p, famille }) => {
      const tss = Number(p.tss) > 0 ? Number(p.tss) : estimerTss(Number(p.duration), Number(p.rpe) || null);
      const pct = Math.round((fatigueBrute(parJour, p.date, false) / ref) * 100);
      const dure = tss >= 60;
      let conseil = 'Rien à signaler.';
      if (pct >= 45 && dure) conseil = 'Jambes encore fatiguées : allège cette sortie ou décale-la d\'un jour.';
      else if (pct >= 45) conseil = 'Jambes marquées : reste en endurance facile.';
      else if (pct >= 20 && dure) conseil = 'Un peu de fatigue résiduelle : échauffe-toi bien.';
      return { id: p.id, date: p.date, nom: p.name || (famille === 'velo' ? 'Sortie vélo' : 'Sortie course'), famille, tss, pct, dure, conseil };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Efficacité d'une sortie : vélo = puissance (normalisée si connue) par battement ; course = mètres par minute par battement. */
function efficacite(s, famille) {
  const fc = Number(s.avg_heartrate);
  const min = Number(s.moving_time) / 60;
  if (!(fc > 60) || !(min >= 25)) return null;
  if (famille === 'velo') {
    const w = Number(s.np) > 0 ? Number(s.np) : Number(s.avg_watts);
    return w > 0 ? w / fc : null;
  }
  const km = Number(s.distance_km);
  return km > 0 ? (km * 1000) / min / fc : null;
}

const mediane = (t) => {
  const v = [...t].sort((a, b) => a - b);
  return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : 0;
};

/**
 * L'effet mesuré de la fatigue des jambes sur une discipline (« velo » ou « course »), d'après tes propres sorties.
 * Chaque sortie est comparée à ta médiane des sorties de la même discipline dans les 28 jours autour (pour retirer la progression
 * de forme), puis on regarde l'écart quand tes jambes étaient fatiguées (au moins 45 % d'une grosse séance) ou fraîches (moins de 20 %).
 * Renvoie null s'il n'y a pas assez de sorties.
 */
export function effetSurDiscipline(seances, parJour, ref, famille) {
  const sorties = seances
    .filter((s) => familleAffichage(s.sport) === famille && s.category !== 'competition')
    .map((s) => ({ iso: String(s.start_date_local).slice(0, 10), eff: efficacite(s, famille) }))
    .filter((s) => s.eff != null);
  if (sorties.length < 12) return null;
  const mesures = [];
  for (const s of sorties) {
    const voisines = sorties.filter((o) => o !== s && Math.abs(ecartJours(o.iso, s.iso)) <= 28).map((o) => o.eff);
    if (voisines.length < 3) continue;
    mesures.push({ iso: s.iso, relatif: s.eff / mediane(voisines), fatigue: (fatigueBrute(parJour, s.iso, false) / ref) * 100 });
  }
  const fatigues = mesures.filter((m) => m.fatigue >= 45);
  const fraiches = mesures.filter((m) => m.fatigue < 20);
  if (fatigues.length < 3 || fraiches.length < 5) return { famille, n: mesures.length, nFatigue: fatigues.length, nFraiches: fraiches.length, delta: null, confiance: 'insuffisant', parDelai: [] };
  const mf = moyenne(fatigues.map((m) => m.relatif));
  const mr = moyenne(fraiches.map((m) => m.relatif));
  const delta = (mf / mr - 1) * 100;
  // Marge d'erreur de l'écart (erreur standard de la différence des moyennes, en %)
  const erreur = Math.sqrt(ecartType(fatigues.map((m) => m.relatif)) ** 2 / fatigues.length + ecartType(fraiches.map((m) => m.relatif)) ** 2 / fraiches.length) / mr * 100;
  const confiance = Math.abs(delta) >= 2 * erreur && fatigues.length >= 4 ? 'nette' : Math.abs(delta) >= erreur ? 'indicative' : 'non concluante';

  // Selon le délai depuis ta dernière grosse séance de jambes (au moins 60 % d'une grosse séance)
  const grosses = [...parJour.entries()].filter(([, v]) => v >= ref * 0.6).map(([j]) => j).sort();
  const delaiDe = (iso) => {
    const d = grosses.filter((g) => g < iso).map((g) => ecartJours(g, iso));
    return d.length ? Math.min(...d) : 99;
  };
  const reference = mesures.filter((m) => delaiDe(m.iso) > 4);
  const parDelai = [];
  if (reference.length >= 5) {
    const base = moyenne(reference.map((m) => m.relatif));
    for (const [nom, test] of [['Le lendemain', (d) => d === 1], ['2 jours après', (d) => d === 2], ['3 à 4 jours après', (d) => d === 3 || d === 4]]) {
      const g = mesures.filter((m) => test(delaiDe(m.iso)));
      if (g.length >= 2) parDelai.push({ nom, n: g.length, ecart: (moyenne(g.map((m) => m.relatif)) / base - 1) * 100 });
    }
  }
  return { famille, n: mesures.length, nFatigue: fatigues.length, nFraiches: fraiches.length, delta, erreur, confiance, parDelai };
}
