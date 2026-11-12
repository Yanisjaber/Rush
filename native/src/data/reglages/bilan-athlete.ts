import { familleAffichage } from '@/data/sports/familles';
import { chargeSeance, type Forme } from '@/data/bilan/synthese';
import type { Metrique, Profil, Seance, SerieForce } from '@/data/types';

export interface StatAthlete {
  cle: 'force' | 'endurance' | 'vitesse' | 'cardio' | 'regularite';
  label: string;
  valeur: number;
  note: string;
}

export interface BilanAthlete {
  nom: string;
  discipline: string;
  score: number;
  niveau: number;
  xp: number;
  xpMax: number;
  forme: Forme;
  stats: StatAthlete[];
  pointsForts: StatAthlete[];
  axeDeProgres: StatAthlete;
  activite: {
    seances: number;
    heures: number;
    charge: number;
    jours: number;
    distance: number;
    seriesForce: number;
    tonnageForce: number;
  };
  donneesDisponibles: boolean;
}

interface EntreeBilan {
  profil: Profil | null | undefined;
  seances?: Seance[] | null;
  metriques?: Metrique[] | null;
  seriesForce?: SerieForce[] | null;
  aujourdhui?: Date;
}

const borne = (n: number, min = 0, max = 100): number => Math.min(max, Math.max(min, Math.round(n)));
const nombre = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const extrasDuProfil = (profil: Profil | null | undefined): Record<string, unknown> => (profil?.extras && typeof profil.extras === 'object' ? profil.extras : {});
const isoDuJour = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function formeParDefaut(metriques: Metrique[]): Forme {
  const derniere = metriques[metriques.length - 1];
  const tsb = derniere ? Math.round(nombre(derniere.tsb)) : 0;
  let libelle = 'Équilibré';
  if (tsb >= 15) libelle = 'Très frais';
  else if (tsb >= 5) libelle = 'Frais';
  else if (tsb <= -30) libelle = 'Très fatigué';
  else if (tsb <= -10) libelle = 'Fatigué';
  return { ctl: Math.round(nombre(derniere?.ctl)), atl: Math.round(nombre(derniere?.atl)), tsb, libelle };
}

function disciplineDominante(seances: Seance[]): string {
  const comptes = new Map<string, number>();
  for (const seance of seances) {
    const famille = familleAffichage(seance.sport);
    comptes.set(famille, (comptes.get(famille) ?? 0) + 1);
  }
  const dominante = [...comptes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return ({ course: 'Course', velo: 'Vélo', natation: 'Natation', muscu: 'Force', hyrox: 'Hyrox' } as Record<string, string>)[dominante ?? ''] ?? 'Multi-sport';
}

/**
 * Fabrique une lecture ludique du profil : les notes sont des indices d'entraînement,
 * pas des mesures médicales. Tout est calculé localement à partir des données déjà chargées.
 */
export function bilanAthlete({ profil, seances = [], metriques = [], seriesForce = [], aujourdhui = new Date() }: EntreeBilan): BilanAthlete {
  const listeSeances = seances ?? [];
  const listeMetriques = metriques ?? [];
  const listeSeriesForce = seriesForce ?? [];
  const extras = extrasDuProfil(profil);
  const nom = typeof extras.first_name === 'string' && extras.first_name.trim() ? extras.first_name.trim() : 'Athlète';
  const debut = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - 27);
  const debutIso = isoDuJour(debut);
  const recentes = listeSeances.filter((s) => String(s.start_date_local).slice(0, 10) >= debutIso);
  const jours = new Set(recentes.map((s) => String(s.start_date_local).slice(0, 10))).size;
  const heures = recentes.reduce((total, s) => total + Math.max(0, nombre(s.moving_time)) / 3600, 0);
  const charge = Math.round(recentes.reduce((total, s) => total + chargeSeance(s), 0));
  const distance = recentes.reduce((total, s) => total + Math.max(0, nombre(s.distance_km)), 0);
  const seriesForceRecentes = listeSeriesForce.filter((serie) => String(serie.date).slice(0, 10) >= debutIso);
  const tonnageForce = seriesForceRecentes.reduce((total, serie) => total + Math.max(0, nombre(serie.reps)) * Math.max(0, nombre(serie.weight_kg)), 0);
  const forme = formeParDefaut(listeMetriques);
  const ctl = nombre(listeMetriques[listeMetriques.length - 1]?.ctl);

  const ftp = nombre(profil?.ftp);
  const poids = nombre(profil?.weight);
  const wkg = ftp > 0 && poids > 0 ? ftp / poids : 0;
  const forceParPuissance = wkg > 0 ? borne(30 + ((wkg - 1.5) / 3.2) * 65) : 0;
  const forceParMuscu = borne(40 + Math.min(32, seriesForceRecentes.length * 1.35) + Math.min(20, tonnageForce / 350));
  const force = forceParPuissance > 0 ? borne(forceParPuissance * 0.65 + forceParMuscu * 0.35) : forceParMuscu;

  const endurance = borne(35 + ctl * 0.72 + Math.min(16, heures) * 1.2);
  const vma = nombre(extras.vma);
  const vitesseSeuil = nombre(extras.threshold_speed);
  const vitesse = vma > 0 ? borne(30 + ((vma - 8) / 12) * 70) : vitesseSeuil > 0 ? borne(30 + ((vitesseSeuil - 8) / 10) * 70) : borne(42 + recentes.filter((s) => familleAffichage(s.sport) === 'course').length * 3);
  const cardio = borne(42 + ctl * 0.42 + Math.min(24, recentes.length) * 1.5 + (nombre(profil?.lthr) > 0 ? 5 : 0));
  const regularite = borne((jours / 20) * 100);

  const stats: StatAthlete[] = [
    { cle: 'force', label: 'Force', valeur: force, note: seriesForceRecentes.length > 0 ? `${seriesForceRecentes.length} séries · ${Math.round(tonnageForce)} kg` : wkg > 0 ? `${wkg.toFixed(1).replace('.', ',')} W/kg` : 'Profil à compléter' },
    { cle: 'endurance', label: 'Endurance', valeur: endurance, note: ctl > 0 ? `CTL ${Math.round(ctl)}` : 'En construction' },
    { cle: 'vitesse', label: 'Vitesse', valeur: vitesse, note: vma > 0 ? `VMA ${String(vma).replace('.', ',')} km/h` : 'À mesurer' },
    { cle: 'cardio', label: 'Cardio', valeur: cardio, note: nombre(profil?.hr_max) > 0 ? `${Math.round(nombre(profil?.hr_max))} bpm max` : 'FC max à renseigner' },
    { cle: 'regularite', label: 'Régularité', valeur: regularite, note: `${jours} jour${jours > 1 ? 's' : ''} actif${jours > 1 ? 's' : ''}` },
  ];
  const score = borne(stats.reduce((total, stat) => total + stat.valeur, 0) / stats.length);
  const niveau = Math.max(1, Math.min(99, Math.floor((listeSeances.length + score) / 12) + 1));
  const xpMax = 120 + niveau * 25;
  const xp = Math.min(xpMax - 1, Math.max(0, Math.round((score % 10) * 8 + recentes.length * 4)));
  const tries = [...stats].sort((a, b) => b.valeur - a.valeur);
  const pointsForts = tries.slice(0, 2);
  const axeDeProgres = tries[tries.length - 1] ?? stats[0];

  return {
    nom,
    discipline: disciplineDominante(listeSeances),
    score,
    niveau,
    xp,
    xpMax,
    forme,
    stats,
    pointsForts,
    axeDeProgres,
    activite: { seances: recentes.length, heures: Math.round(heures * 10) / 10, charge, jours, distance: Math.round(distance * 10) / 10, seriesForce: seriesForceRecentes.length, tonnageForce: Math.round(tonnageForce) },
    donneesDisponibles: !!profil || listeSeances.length > 0 || listeMetriques.length > 0 || listeSeriesForce.length > 0,
  };
}
