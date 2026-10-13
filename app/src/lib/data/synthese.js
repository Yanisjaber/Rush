// Calculs purs sur les données brutes : charge par semaine et par sport, forme, répartition…
// Ces fonctions ne touchent ni au réseau ni à l'écran, donc elles se testent facilement.
import { couleurSport } from '../sports.js';
import { familleAffichage } from './familles.js';
import { dateIsoLocale } from '../utils/format.js';

const JOUR = 86400000;

/**
 * Charge d'une séance, en « points ». Principe : une charge universelle, comparable d'un sport
 * à l'autre. Aujourd'hui : le TSS enregistré s'il existe ; sinon une estimation simple à partir de la
 * durée (un peu plus élevée si le cardio est connu). Le vrai modèle (TRIMP cardio, effort ressenti × durée)
 * viendra avec le moteur de charge.
 */
export function chargeSeance(s) {
  if (typeof s.tss === 'number' && s.tss > 0) return s.tss;
  const heures = (s.moving_time || 0) / 3600;
  return Math.round(heures * (s.avg_heartrate ? 45 : 35));
}

function indexSemaine(dateSeance, aujourdhui) {
  const base = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
  const d = new Date(String(dateSeance).slice(0, 10) + 'T00:00:00');
  const jours = Math.floor((base - d) / JOUR);
  return Math.floor(jours / 7); // 0 = les 7 derniers jours, 1 = la semaine d'avant…
}

/**
 * Charge par semaine et par sport sur les N dernières semaines (la dernière colonne = les 7 derniers jours).
 * Renvoie { etiquettes, series: [{ nom, couleur, valeurs }] } prêt pour <BarresEmpilees>.
 */
export function chargeParSemaine(seances, nbSemaines = 12, aujourdhui = new Date()) {
  const parSport = new Map();
  for (const s of seances) {
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (i < 0 || i >= nbSemaines) continue;
    const famille = familleAffichage(s.sport);
    if (!parSport.has(famille)) parSport.set(famille, new Array(nbSemaines).fill(0));
    parSport.get(famille)[nbSemaines - 1 - i] += chargeSeance(s);
  }
  const series = [...parSport.entries()]
    .map(([famille, valeurs]) => ({
      nom: famille,
      couleur: couleurSport(famille),
      valeurs,
      total: valeurs.reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total);
  const etiquettes = Array.from({ length: nbSemaines }, (_, i) => (i === nbSemaines - 1 ? 'Auj.' : `S-${nbSemaines - 1 - i}`));
  return { etiquettes, series };
}

/** Condition (CTL) à la fin de chacune des N dernières semaines, pour tracer la courbe de forme. */
export function conditionHebdo(metriques, nbSemaines = 12, aujourdhui = new Date()) {
  if (!metriques.length) return [];
  const sorties = [];
  let derniere = metriques[0].ctl;
  for (let i = nbSemaines - 1; i >= 0; i--) {
    const fin = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - i * 7);
    const limite = dateIsoLocale(fin);
    const candidats = metriques.filter((m) => m.iso_date <= limite);
    if (candidats.length) derniere = candidats[candidats.length - 1].ctl;
    sorties.push(Number(derniere) || 0);
  }
  return sorties;
}

/** Dernière forme connue : { ctl, atl, tsb, libelle }. */
export function formeActuelle(metriques) {
  if (!metriques.length) return null;
  const m = metriques[metriques.length - 1];
  const tsb = Number(m.tsb) || 0;
  let libelle = 'Équilibré';
  if (tsb >= 15) libelle = 'Très frais';
  else if (tsb >= 5) libelle = 'Frais';
  else if (tsb <= -30) libelle = 'Très fatigué';
  else if (tsb <= -10) libelle = 'Fatigué';
  return { ctl: Math.round(Number(m.ctl) || 0), atl: Math.round(Number(m.atl) || 0), tsb: Math.round(tsb), libelle };
}

/** Temps passé par sport sur les 7 derniers jours : { segments, totalSecondes } pour <Anneau>. */
export function repartition7Jours(seances, aujourdhui = new Date()) {
  const parSport = new Map();
  let total = 0;
  for (const s of seances) {
    if (indexSemaine(s.start_date_local, aujourdhui) !== 0) continue;
    const famille = familleAffichage(s.sport);
    const t = s.moving_time || 0;
    parSport.set(famille, (parSport.get(famille) || 0) + t);
    total += t;
  }
  const segments = [...parSport.entries()]
    .map(([famille, secondes]) => ({ nom: famille, valeur: secondes, couleur: couleurSport(famille) }))
    .sort((a, b) => b.valeur - a.valeur);
  return { segments, totalSecondes: total };
}

// ---------------------------------------------------------------------------
// Régularité (carte de chaleur) et semaine en cours
// ---------------------------------------------------------------------------

const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Lundi (à midi) de la semaine qui contient `d`. */
function lundiDe(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const decalage = (x.getDay() + 6) % 7; // lundi = 0
  x.setDate(x.getDate() - decalage);
  return x;
}

function intensiteDeCharge(charge) {
  if (charge >= 80) return 3;
  if (charge >= 40) return 2;
  return charge > 0 ? 1 : 0;
}

/**
 * Cases de la carte de chaleur sur `nbSemaines` semaines : 7 rangées (lundi → dimanche) × nbSemaines colonnes,
 * la dernière colonne étant la semaine en cours. Chaque case a la couleur du sport dominant du jour
 * (celui qui a la plus grande charge) et une intensité 0 à 3. Les jours à venir sont marqués `vide`.
 */
export function casesRegularite(seances, nbSemaines = 12, aujourdhui = new Date()) {
  const parJour = new Map(); // date ISO → Map(famille → charge)
  for (const s of seances) {
    const iso = String(s.start_date_local).slice(0, 10);
    const famille = familleAffichage(s.sport);
    if (!parJour.has(iso)) parJour.set(iso, new Map());
    const m = parJour.get(iso);
    m.set(famille, (m.get(famille) || 0) + chargeSeance(s));
  }
  const debut = lundiDe(aujourdhui);
  debut.setDate(debut.getDate() - (nbSemaines - 1) * 7);
  const aujIso = dateIsoLocale(aujourdhui);
  const cases = [];
  for (let rangee = 0; rangee < 7; rangee++) {
    for (let col = 0; col < nbSemaines; col++) {
      const d = new Date(debut);
      d.setDate(debut.getDate() + col * 7 + rangee);
      const iso = dateIsoLocale(d);
      if (iso > aujIso) {
        cases.push({ couleur: 'transparent', intensite: 0, vide: true });
        continue;
      }
      const m = parJour.get(iso);
      if (!m) {
        cases.push({ couleur: 'transparent', intensite: 0, vide: false });
        continue;
      }
      const [famille, charge] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
      const total = [...m.values()].reduce((a, b) => a + b, 0);
      cases.push({ couleur: couleurSport(famille), intensite: intensiteDeCharge(total), vide: false });
    }
  }
  return cases;
}

/** Nombre de jours avec au moins une séance sur les N dernières semaines (pour un résumé de régularité). */
export function joursActifs(seances, nbSemaines = 12, aujourdhui = new Date()) {
  const limite = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - nbSemaines * 7);
  const iso = dateIsoLocale(limite);
  return new Set(seances.filter((s) => String(s.start_date_local).slice(0, 10) > iso).map((s) => String(s.start_date_local).slice(0, 10))).size;
}

/** La semaine en cours (lundi → dimanche) : pour chaque jour, ses séances réalisées. */
export function semaineCourante(seances, aujourdhui = new Date()) {
  const lundi = lundiDe(aujourdhui);
  const aujIso = dateIsoLocale(aujourdhui);
  return JOURS_COURTS.map((jour, i) => {
    const d = new Date(lundi);
    d.setDate(lundi.getDate() + i);
    const iso = dateIsoLocale(d);
    return {
      iso,
      jour,
      num: d.getDate(),
      aujourdhui: iso === aujIso,
      futur: iso > aujIso,
      seances: seances.filter((s) => String(s.start_date_local).slice(0, 10) === iso),
    };
  });
}

// ---------------------------------------------------------------------------
// Course à pied : prédictions, efficacité, meilleures sorties
// ---------------------------------------------------------------------------

const EST_COURSE = (s) => familleAffichage(s.sport) === 'course';
const joursDepuis = (dateSeance, aujourdhui) => {
  const base = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
  return Math.floor((base - new Date(String(dateSeance).slice(0, 10) + 'T00:00:00')) / JOUR);
};

/**
 * Prédictions de temps sur 5 km, 10 km et semi, par la formule de Riegel (t2 = t1 × (d2 / d1)^1,06),
 * à partir des sorties de course récentes (au moins 5 km). On garde la meilleure estimation parmi les
 * sorties dont la distance est comparable (de 0,45 à 2,2 fois la distance visée). Ce sont des moyennes de
 * sorties entières : l'estimation est donc volontairement prudente.
 */
export function predictionsCourse(seances, aujourdhui = new Date(), jours = 120) {
  const sorties = seances.filter(
    (s) => EST_COURSE(s) && s.distance_km >= 5 && s.moving_time > 0 && joursDepuis(s.start_date_local, aujourdhui) <= jours,
  );
  const cibles = [
    { cle: '5k', label: '5 km', km: 5 },
    { cle: '10k', label: '10 km', km: 10 },
    { cle: 'semi', label: 'Semi', km: 21.0975 },
  ];
  const resultats = [];
  for (const c of cibles) {
    let meilleur = null;
    for (const s of sorties) {
      const d = Number(s.distance_km);
      if (d < c.km * 0.45 || d > c.km * 2.2) continue;
      const estimation = s.moving_time * Math.pow(c.km / d, 1.06);
      if (meilleur === null || estimation < meilleur) meilleur = estimation;
    }
    if (meilleur !== null) resultats.push({ ...c, secondes: Math.round(meilleur) });
  }
  return resultats;
}

/**
 * Efficacité : allure moyenne des sorties « faciles » (cardio entre 60 et 80 % de la FC max) semaine par
 * semaine. Si l'allure baisse à cardio égal, la condition progresse. Renvoie null s'il y a moins de 3 semaines
 * exploitables. `points` : une valeur d'allure (secondes par km) par semaine disponible, de la plus ancienne
 * à la plus récente ; `amelioration` : gain en pourcentage entre la première et la dernière semaine.
 */
export function efficaciteCourse(seances, hrMax, nbSemaines = 12, aujourdhui = new Date()) {
  const bas = hrMax ? hrMax * 0.6 : 125;
  const haut = hrMax ? hrMax * 0.8 : 155;
  const semaines = new Map(); // indice de semaine (0 = ancienne) → { temps, km }
  for (const s of seances) {
    if (!EST_COURSE(s) || !(s.distance_km >= 3) || !(s.moving_time > 0)) continue;
    const fc = s.avg_heartrate;
    if (!fc || fc < bas || fc > haut) continue;
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (i < 0 || i >= nbSemaines) continue;
    const cle = nbSemaines - 1 - i;
    const m = semaines.get(cle) || { temps: 0, km: 0 };
    m.temps += s.moving_time;
    m.km += Number(s.distance_km);
    semaines.set(cle, m);
  }
  const points = [...semaines.entries()].sort((a, b) => a[0] - b[0]).map(([semaine, m]) => ({ semaine, allure: m.temps / m.km }));
  if (points.length < 3) return null;
  const premiere = points[0].allure;
  const derniere = points[points.length - 1].allure;
  return { points, amelioration: Math.round(((premiere - derniere) / premiere) * 1000) / 10, allureActuelle: derniere };
}

/** Meilleures sorties de course sur la période chargée : la plus longue, la plus rapide ≥ 5 km et ≥ 10 km. */
export function meilleuresSortiesCourse(seances) {
  const courses = seances.filter((s) => EST_COURSE(s) && s.distance_km > 0 && s.moving_time > 0);
  const allure = (s) => s.moving_time / Number(s.distance_km);
  const meilleur = (liste, cle) => (liste.length ? liste.reduce((a, b) => (cle(b) < cle(a) ? b : a)) : null);
  const resume = (s, valeur) => (s ? { id: s.id, nom: s.name, date: String(s.start_date_local).slice(0, 10), valeur } : null);
  const plusLongue = meilleur(courses, (s) => -Number(s.distance_km));
  const rapide5 = meilleur(courses.filter((s) => s.distance_km >= 5), allure);
  const rapide10 = meilleur(courses.filter((s) => s.distance_km >= 10), allure);
  return {
    plusLongue: resume(plusLongue, plusLongue && { km: Number(plusLongue.distance_km), secondes: plusLongue.moving_time }),
    rapide5: resume(rapide5, rapide5 && { km: Number(rapide5.distance_km), allure: allure(rapide5) }),
    rapide10: resume(rapide10, rapide10 && { km: Number(rapide10.distance_km), allure: allure(rapide10) }),
  };
}

// ---------------------------------------------------------------------------
// Force : régularité des séances de musculation
// ---------------------------------------------------------------------------

/**
 * Nombre de séances de force par semaine sur N semaines, et série de semaines consécutives avec au moins
 * une séance (la semaine en cours ne casse pas la série tant qu'elle n'est pas terminée).
 */
export function seancesForce(seances, nbSemaines = 12, aujourdhui = new Date()) {
  const parSemaine = new Array(nbSemaines).fill(0);
  for (const s of seances) {
    if (familleAffichage(s.sport) !== 'muscu') continue;
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (i < 0 || i >= nbSemaines) continue;
    parSemaine[nbSemaines - 1 - i] += 1;
  }
  let serie = 0;
  let i = nbSemaines - 1;
  if (parSemaine[i] === 0) i--; // semaine en cours encore vide : on ne casse pas la série
  for (; i >= 0 && parSemaine[i] > 0; i--) serie++;
  const total = parSemaine.reduce((a, b) => a + b, 0);
  return { parSemaine, serie, total, moyenne: Math.round((total / nbSemaines) * 10) / 10 };
}
