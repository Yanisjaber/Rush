// Six ans d'activités d'un athlète multisport, simulées comme un vrai calendrier d'entraînement (Bilan en démo) :
// une semaine type (intervalles, sortie longue, home trainer, natation, muscu), des semaines de récupération (1 sur 4), un creux l'été, une blessure par an,
// des séances variées avec de vrais noms, des compétitions (semi, 10 km, marathon, triathlon, duathlon, cyclosportive, traversée à la nage), de la saisonnalité
// et un athlète qui progresse. Tout est déterministe (aucun hasard réel) : le même jour donne toujours la même séance.
// Les chiffres manquants (cardio, puissance, FTP) sont ajoutés par completerSeance (flux-demo.ts), les streams par genererFlux.
import { dateIsoLocale } from '../../src/data/outils/format.ts';
import type { Seance } from '../../src/data/types.ts';
import { completerSeance } from './flux-demo.ts';

/** Un nombre entre 0 et 1, toujours le même pour (jour, graine). */
function alea(a: number, j: number, graine: number): number {
  let h = Math.imul(a * 400 + j + 1, 0x9e3779b1) ^ Math.imul(graine + 7, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967295;
}
const choisir = <T>(liste: readonly T[], a: number, j: number, graine: number): T => liste[Math.min(liste.length - 1, Math.floor(alea(a, j, graine) * liste.length))];
const entre = (min: number, max: number, a: number, j: number, graine: number): number => min + (max - min) * alea(a, j, graine);

const NOMS = {
  footing: ['Footing facile', 'Footing sur les quais', 'Footing du matin', 'Footing récupération', 'Footing dans le parc', 'Footing en forêt'],
  fraction: ['Fractionné 10 × 400 m', 'Fractionné 6 × 1000 m', 'Fractionné 8 × 500 m', 'Fractionné 5 × 1200 m', 'Fractionné pyramide', 'Fractionné 12 × 300 m'],
  tempo: ['Tempo 3 × 10 min', 'Tempo 2 × 15 min', 'Allure semi 6 km', 'Tempo 25 min continu'],
  longue: ['Sortie longue', 'Sortie longue en nature', 'Sortie longue progressive'],
  endurance: ['Endurance, boucle du matin', 'Endurance, la vallée', 'Sortie vélo, boucle habituelle', 'Endurance avec les copains'],
  trainer: ['Home trainer, sweet spot', 'Home trainer, 3 × 12 min', 'Home trainer, pyramide', 'Home trainer, cadence'],
  velolongue: ['Sortie longue vélo', 'Grande boucle du samedi', 'Sortie longue, les coteaux', 'Sortie club'],
  col: ['Col de la Croix de Fer', 'Col du Galibier', 'Montée du Ventoux', 'Col du Tourmalet', 'Alpe d\'Huez'],
  nage: ['Natation, technique', 'Natation, séries de 400 m', 'Natation, endurance', 'Natation, 10 × 100 m', 'Natation, pull-buoy et plaquettes'],
  push: ['Push, pectoraux et épaules'],
  pull: ['Pull, dos et biceps'],
  legs: ['Legs, jambes'],
  hyrox: ['Hyrox, stations', 'Hyrox, demi-simulation', 'Hyrox, runs et wall balls', 'Hyrox, sled et farmers'],
};

interface Plan {
  suffixe: string;
  nom: string;
  sport: string;
  heure: string;
  minutes: number;
  km: number | null;
  dPlus: number | null;
  /** TSS par minute (l'intensité de la séance). */
  tssMin: number;
  competition?: boolean;
}

/**
 * Les séances d'un jour. `an` : l'année, `j` : le jour de l'année (0 = 1er janvier), `niveau` : 0 la première année (2020) → 5 la dernière (l'athlète progresse de façon continue, quel que soit le nombre d'années).
 */
function seancesDuJour(d: Date, an: number, j: number, niveau: number): Plan[] {
  const jourSemaine = (d.getDay() + 6) % 7; // 0 lundi … 6 dimanche
  const mois = d.getMonth();
  const jourMois = d.getDate();
  const semaine = Math.floor(j / 7);
  const plans: Plan[] = [];
  const ajoute = (p: Plan): void => void plans.push(p);

  // Vitesses de base (km/h), qui progressent avec les années
  const vCourse = (11.0 + 0.35 * niveau) * (1 + 0.04 * (alea(an, j, 1) - 0.5));
  const vVelo = (26.5 + 0.5 * niveau) * (1 + 0.06 * (alea(an, j, 2) - 0.5));
  // Saison : creux de l'hiver, plein de forme au printemps et à l'été ; une semaine sur quatre allégée ; vacances en août ; un bloc de blessure par an
  const saison = 1 + 0.12 * Math.sin((2 * Math.PI * (j - 100)) / 365);
  const recup = semaine % 4 === 3 ? 0.62 : 1;
  const vacances = mois === 7 && jourMois >= 8 && jourMois <= 22;
  const debutBlessure = 40 + ((an * 53) % 200);
  const blesse = j >= debutBlessure && j < debutBlessure + 12 && niveau < 4.99; // la dernière année n'a pas de blessure (l'athlète est en forme)
  const charge = saison * recup * (0.8 + 0.04 * niveau);
  const manque = alea(an, j, 3) < (recup < 1 ? 0.22 : 0.1); // un jour sans séance, de temps en temps
  const courir = !blesse && !vacances;

  // --- Les compétitions : une seule séance ce jour-là (le reste est du repos) ---
  const course = (suffixe: string, nom: string, km: number, kmh: number, dPlus: number): Plan => ({ suffixe, nom, sport: 'Run', heure: '09:00:00', minutes: (km / kmh) * 60, km, dPlus, tssMin: 1.25, competition: true });
  const vCompet = 12.4 + 0.45 * niveau;
  if (mois === 2 && jourMois === 29 && !blesse) return [course('semi', `Semi-marathon de Montpellier`, 21.1, vCompet * 0.93, 70)];
  if (mois === 9 && jourMois === 18) return [course('dix', '10 km de Lyon', 10, vCompet, 40)];
  if (mois === 10 && jourMois === 1 && an % 2 === 1) return [course('mar', 'Marathon de Valence', 42.2, vCompet * 0.85, 120)];
  if (mois === 5 && jourMois === 27) return [{ suffixe: 'tri', nom: 'Triathlon S de Castres', sport: 'Triathlon', heure: '09:30:00', minutes: 85 - 1.5 * niveau, km: 25.75, dPlus: 180, tssMin: 1.15, competition: true }];
  if (mois === 2 && jourMois === 14) return [{ suffixe: 'dua', nom: 'Duathlon de Revel', sport: 'Duathlon', heure: '09:00:00', minutes: 98 - 1.5 * niveau, km: 27, dPlus: 240, tssMin: 1.1, competition: true }];
  if (mois === 8 && jourMois === 12) return [{ suffixe: 'gf', nom: 'Cyclosportive des Alpes', sport: 'Ride', heure: '07:30:00', minutes: (112 / (27.5 + 0.4 * niveau)) * 60, km: 112, dPlus: 1900, tssMin: 0.95, competition: true }];
  if (mois === 6 && jourMois === 18) return [{ suffixe: 'ow', nom: 'Traversée du lac, 2 km', sport: 'Swim', heure: '10:00:00', minutes: 44 - niveau, km: 2, dPlus: null, tssMin: 0.9, competition: true }];
  if (manque && !(jourSemaine === 6 || jourSemaine === 5)) return plans;

  // --- La semaine type ---
  if (jourSemaine === 0) {
    // Lundi : muscu (push), et une natation technique une semaine sur deux
    ajoute({ suffixe: 'mu', nom: choisir(NOMS.push, an, j, 4), sport: 'WeightTraining', heure: '18:30:00', minutes: entre(55, 72, an, j, 5) * charge, km: null, dPlus: null, tssMin: 0.55 });
  } else if (jourSemaine === 1 && courir) {
    // Mardi : fractionné
    const m = entre(52, 68, an, j, 6) * charge;
    ajoute({ suffixe: 'ru', nom: choisir(NOMS.fraction, an, j, 7), sport: 'Run', heure: '06:45:00', minutes: m, km: (m / 60) * vCourse * 1.0, dPlus: entre(20, 80, an, j, 8), tssMin: 1.05 });
  } else if (jourSemaine === 2) {
    // Mercredi : home trainer l'hiver, sortie dehors le reste de l'année
    if (mois >= 10 || mois <= 1) {
      const m = entre(60, 80, an, j, 9) * charge;
      ajoute({ suffixe: 'ht', nom: choisir(NOMS.trainer, an, j, 10), sport: 'Ride', heure: '18:00:00', minutes: m, km: (m / 60) * vVelo * 0.98, dPlus: 0, tssMin: 0.85 });
    } else {
      const m = entre(75, 110, an, j, 9) * charge;
      ajoute({ suffixe: 've', nom: choisir(NOMS.endurance, an, j, 10), sport: 'Ride', heure: '17:45:00', minutes: m, km: (m / 60) * vVelo, dPlus: (m / 60) * entre(250, 450, an, j, 11), tssMin: 0.62 }); // le dénivelé suit la durée (m par heure)
    }
  } else if (jourSemaine === 3) {
    // Jeudi midi : natation ; le soir, muscu (pull) une semaine sur deux
    // Chaque type de séance a sa durée et son allure : les séries courtes sont rapides, le travail technique et l'endurance plus lents (la courbe des meilleurs efforts a donc une vraie forme)
    const nom = choisir(NOMS.nage, an, j, 13);
    const profil: Record<string, [number, number, number]> = { // [minutes min, minutes max, km/h moyen avec les repos]
      'Natation, technique': [42, 50, 2.1], 'Natation, séries de 400 m': [52, 62, 2.6], 'Natation, endurance': [58, 70, 2.4],
      'Natation, 10 × 100 m': [22, 27, 3.0], 'Natation, pull-buoy et plaquettes': [45, 55, 2.3],
    };
    const [mini, maxi, vitesse] = profil[nom] ?? [45, 60, 2.7];
    const m = entre(mini, maxi, an, j, 12) * charge;
    ajoute({ suffixe: 'na', nom, sport: 'Swim', heure: '12:30:00', minutes: m, km: (m / 60) * (vitesse + 0.07 * niveau) * (1 + 0.06 * (alea(an, j, 14) - 0.5)), dPlus: null, tssMin: 0.62 });
    if (semaine % 2 === 0) ajoute({ suffixe: 'mu', nom: choisir(NOMS.pull, an, j, 15), sport: 'WeightTraining', heure: '19:00:00', minutes: entre(55, 70, an, j, 16) * charge, km: null, dPlus: null, tssMin: 0.55 });
  } else if (jourSemaine === 4) {
    // Vendredi : footing, ou Hyrox toutes les deux semaines depuis 2023 ; muscu (legs) en fin de journée une semaine sur deux
    if (niveau >= 2 && semaine % 2 === 1) {
      ajoute({ suffixe: 'hx', nom: choisir(NOMS.hyrox, an, j, 17), sport: 'Hyrox', heure: '07:00:00', minutes: entre(52, 74, an, j, 18) * charge, km: null, dPlus: null, tssMin: 0.9 });
    } else if (courir) {
      const m = entre(40, 58, an, j, 19) * charge;
      ajoute({ suffixe: 'fo', nom: choisir(NOMS.footing, an, j, 20), sport: 'Run', heure: '12:15:00', minutes: m, km: (m / 60) * vCourse * 0.9, dPlus: entre(10, 60, an, j, 21), tssMin: 0.72 });
    }
    if (semaine % 2 === 0) ajoute({ suffixe: 'mu', nom: choisir(NOMS.legs, an, j, 22), sport: 'WeightTraining', heure: '18:30:00', minutes: entre(55, 70, an, j, 23) * charge, km: null, dPlus: null, tssMin: 0.6 });
  } else if (jourSemaine === 5) {
    // Samedi : la grande sortie à vélo (un col l'été), ou un tempo en course une semaine sur quatre
    const m = entre(120, 190, an, j, 24) * charge;
    const estCol = mois >= 5 && mois <= 8 && semaine % 3 === 0;
    ajoute({
      suffixe: 'vl', nom: estCol ? choisir(NOMS.col, an, j, 25) : choisir(NOMS.velolongue, an, j, 26), sport: 'Ride', heure: '08:00:00', minutes: m,
      km: (m / 60) * vVelo * (estCol ? 0.8 : 1.02), dPlus: (m / 60) * (estCol ? entre(650, 850, an, j, 27) : entre(380, 600, an, j, 27)), tssMin: estCol ? 0.78 : 0.66,
    });
    if (semaine % 4 === 1 && courir) ajoute({ suffixe: 'te', nom: choisir(NOMS.tempo, an, j, 28), sport: 'Run', heure: '17:30:00', minutes: entre(50, 62, an, j, 29) * charge, km: null, dPlus: entre(20, 60, an, j, 30), tssMin: 1.0 });
  } else if (jourSemaine === 6 && courir) {
    // Dimanche : la sortie longue en course à pied
    const m = entre(85, 125, an, j, 31) * charge;
    ajoute({ suffixe: 'lo', nom: choisir(NOMS.longue, an, j, 32), sport: 'Run', heure: '09:00:00', minutes: m, km: (m / 60) * vCourse * 0.93, dPlus: entre(100, 350, an, j, 33), tssMin: 0.8 });
  }

  // Les séances de course « tempo » du samedi n'ont pas de distance en dur : elle découle de l'allure
  for (const p of plans) if (p.sport === 'Run' && p.km == null) p.km = (p.minutes / 60) * vCourse * 1.07;

  // Les autres sports, à tour de rôle toutes les deux semaines environ (ils vivent dans « Autres »)
  if ((j + an * 5) % 14 === 6 && !blesse) {
    const rang = Math.floor(alea(an, j, 40) * 6);
    const hiver = j < 75 || j > 335;
    if (rang === 0) ajoute({ suffixe: 'au', nom: 'Randonnée en montagne', sport: 'Hike', heure: '09:30:00', minutes: entre(190, 250, an, j, 41), km: entre(12, 18, an, j, 42), dPlus: entre(650, 950, an, j, 43), tssMin: 0.3 });
    else if (rang === 1) ajoute({ suffixe: 'au', nom: 'Tennis, match', sport: 'Tennis', heure: '17:00:00', minutes: 75, km: null, dPlus: null, tssMin: 0.6 });
    else if (rang === 2) ajoute({ suffixe: 'au', nom: 'Aviron, sortie', sport: 'Rowing', heure: '08:00:00', minutes: 55, km: 10.5, dPlus: null, tssMin: 1.0 });
    else if (rang === 3) ajoute({ suffixe: 'au', nom: hiver ? 'Ski de fond' : 'Ski à roulettes', sport: hiver ? 'NordicSki' : 'RollerSki', heure: '10:00:00', minutes: 100, km: 18, dPlus: hiver ? 160 : 120, tssMin: 0.85 });
    else if (rang === 4) ajoute({ suffixe: 'au', nom: 'Padel', sport: 'Padel', heure: '19:00:00', minutes: 70, km: null, dPlus: null, tssMin: 0.6 });
    else ajoute({ suffixe: 'au', nom: 'Escalade en salle', sport: 'RockClimbing', heure: '19:00:00', minutes: 90, km: null, dPlus: null, tssMin: 0.55 });
  }
  return plans;
}

/** L'historique commence en 2020 : le compte de démo a près de sept ans de séances. */
export const DEBUT_HISTORIQUE = 2020;

/** Les activités depuis 2020 (jusqu'à `maintenant`), de la plus ancienne à la plus récente, avec leurs chiffres complets. */
export function historiqueDemo(maintenant: Date): Seance[] {
  const lignes: Seance[] = [];
  const an0 = DEBUT_HISTORIQUE;
  const pasNiveau = 5 / Math.max(1, maintenant.getFullYear() - an0); // le niveau va de 0 à 5 sur toute la période
  for (let an = an0; an <= maintenant.getFullYear(); an++) {
    for (let j = 0; j < 366; j++) {
      const d = new Date(an, 0, 1 + j, 12);
      if (d.getFullYear() !== an || d > maintenant) continue;
      for (const p of seancesDuJour(d, an, j, (an - an0) * pasNiveau)) {
        lignes.push(completerSeance({
          id: `demo-bilan-${p.suffixe}-${an}-${j}`,
          name: p.nom,
          sport: p.sport,
          start_date_local: `${dateIsoLocale(d)}T${p.heure}+00:00`,
          moving_time: Math.round(p.minutes * 60),
          distance_km: p.km == null ? null : Math.round(p.km * 100) / 100,
          total_elevation_gain: p.dPlus == null ? null : Math.round(p.dPlus),
          tss: Math.round(p.minutes * p.tssMin),
          avg_heartrate: null,
          ftp_at_time: null,
          avg_watts: null,
          np: null,
          category: p.competition ? 'competition' : 'entrainement',
        }));
      }
    }
  }
  return lignes;
}
