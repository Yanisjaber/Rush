import { familleAffichage } from '../sports/familles.ts';
import type { Seance } from '../types.ts';

// La page 4 d'une sortie, première moitié : où se place cette sortie face à tes sorties PROCHES (même sport, distance voisine, les plus récentes).
// Fonctions pures : aucun écran, aucun réseau. Les données viennent des colonnes de la séance (pas des flux : ceux des anciennes sorties ne sont pas chargés).

/** Les sorties comptées en comparaison : au plus 5, de 0,8 à 1,25 fois la distance, dans les 180 jours d'avant. */
export const NB_SORTIES_MAX = 5;
/** Moins que ça, une médiane ne dit rien : la page n'est pas affichée. */
export const NB_SORTIES_MIN = 3;
const RATIO_MIN = 0.8;
const RATIO_MAX = 1.25;
const JOURS_MAX = 180;
/** Sous cet écart relatif, on dit « pareil » (convention d'affichage, pas un seuil physiologique). */
const ECART_PAREIL = 0.02;

export type FamilleComparee = 'course' | 'velo';

export interface LigneComparaison {
  cle: 'allure' | 'vitesse' | 'fc' | 'efficacite' | 'watts';
  libelle: string;
  /** Les valeurs affichées : « 5'56"/km », « 174 bpm »… */
  texte: string;
  /** Mieux ou moins bien que la médiane ; null quand le sens n'a pas de « mieux » (le cœur). */
  verdict: 'mieux' | 'moins' | 'pareil' | null;
  /** « plus vite », « plus haute »… : ce qui s'écrit à droite de la valeur. */
  mot: string;
  /** Position sur la bande, de 0 (gauche) à 1 (droite). */
  position: number;
  autres: number[];
}

export interface HeroComparaison {
  etiquette: string;
  /** « −16" », « +1,4 ». */
  valeur: string;
  unite: string;
  detail: string;
}

export interface Comparaison {
  famille: FamilleComparee;
  /** Le nombre de sorties comparées. */
  n: number;
  lignes: LigneComparaison[];
  hero: HeroComparaison | null;
  /** Les médianes et valeurs, pour le mot du coach. */
  rythme: { valeur: number; mediane: number; ecartRelatif: number } | null;
  fc: { valeur: number; mediane: number } | null;
}

/** Les sorties de l'historique qui ressemblent à celle-ci, les plus récentes d'abord. Vide pour un sport autre que course et vélo. */
export function sortiesSimilaires(seance: Seance, historique: readonly Seance[]): Seance[] {
  const famille = familleAffichage(seance.sport);
  const distance = Number(seance.distance_km);
  if ((famille !== 'course' && famille !== 'velo') || !(distance > 0)) return [];
  const iso = String(seance.start_date_local);
  const limite = new Date(iso).getTime() - JOURS_MAX * 86_400_000;
  return historique
    .filter((s) => {
      if (s.id === seance.id || familleAffichage(s.sport) !== famille) return false;
      const d = Number(s.distance_km);
      const t = Number(s.moving_time);
      if (!(d > 0) || !(t > 0)) return false;
      const debut = String(s.start_date_local);
      if (debut >= iso) return false;
      if (new Date(debut).getTime() < limite) return false;
      const ratio = d / distance;
      return ratio >= RATIO_MIN && ratio <= RATIO_MAX;
    })
    .sort((a, b) => (String(a.start_date_local) < String(b.start_date_local) ? 1 : -1))
    .slice(0, NB_SORTIES_MAX);
}

interface Mesures {
  /** Secondes par km (course) ou km/h (vélo). */
  rythme: number;
  fc: number | null;
  /** Mètres parcourus par battement : la vitesse (m/min) divisée par la FC. */
  efficacite: number | null;
  watts: number | null;
}

function mesures(s: Seance, famille: FamilleComparee): Mesures | null {
  const d = Number(s.distance_km);
  const t = Number(s.moving_time);
  if (!(d > 0) || !(t > 0)) return null;
  const fc = Number(s.avg_heartrate) > 0 ? Number(s.avg_heartrate) : null;
  const vitesseMmin = (d * 1000) / (t / 60);
  return {
    rythme: famille === 'course' ? t / d : (d / t) * 3600,
    fc,
    efficacite: fc ? vitesseMmin / fc : null,
    watts: famille === 'velo' && Number(s.avg_watts) > 0 ? Number(s.avg_watts) : null,
  };
}

function mediane(v: number[]): number {
  const t = [...v].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

/** « 5'56" » pour 356 secondes. */
export function texteAllure(secondes: number): string {
  const s = Math.round(secondes);
  return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`;
}
const virgule = (n: number, dec = 1) => n.toFixed(dec).replace('.', ',');
const signe = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');

/** Un nombre de sorties, avec « sorties » ou « sortie ». */
export const nSorties = (n: number) => `${n} sortie${n > 1 ? 's' : ''}`;

/** La comparaison de la sortie avec ses sorties proches ; null s'il en manque (moins de 3) ou sans distance. */
export function comparerSortie(seance: Seance, historique: readonly Seance[]): Comparaison | null {
  const famille = familleAffichage(seance.sport);
  if (famille !== 'course' && famille !== 'velo') return null;
  const autres = sortiesSimilaires(seance, historique);
  if (autres.length < NB_SORTIES_MIN) return null;
  const moi = mesures(seance, famille);
  if (!moi) return null;
  const mAutres = autres.map((s) => mesures(s, famille)).filter((m): m is Mesures => !!m);
  if (mAutres.length < NB_SORTIES_MIN) return null;

  // Une bande : les valeurs des autres sorties et celle-ci, mises à l'échelle avec une marge de 10 % de chaque côté
  const bande = (valeur: number, valeurs: number[]) => {
    const tous = [...valeurs, valeur];
    const min = Math.min(...tous);
    const max = Math.max(...tous);
    const etendue = max - min || 1;
    const pos = (v: number) => 0.1 + ((v - min) / etendue) * 0.8;
    return { position: pos(valeur), autres: valeurs.map(pos) };
  };
  const verdictDe = (valeur: number, med: number, sens: 'bas' | 'haut' | null): LigneComparaison['verdict'] => {
    if (!sens) return null;
    const ecart = (valeur - med) / med;
    if (Math.abs(ecart) < ECART_PAREIL) return 'pareil';
    return (sens === 'bas' ? ecart < 0 : ecart > 0) ? 'mieux' : 'moins';
  };

  const lignes: LigneComparaison[] = [];
  let rythme: Comparaison['rythme'] = null;
  let fc: Comparaison['fc'] = null;
  let hero: HeroComparaison | null = null;

  // Le rythme
  const rythmes = mAutres.map((m) => m.rythme);
  const medR = mediane(rythmes);
  const ecartR = (moi.rythme - medR) / medR;
  rythme = { valeur: moi.rythme, mediane: medR, ecartRelatif: ecartR };
  if (famille === 'course') {
    const v = verdictDe(moi.rythme, medR, 'bas');
    lignes.push({ cle: 'allure', libelle: 'Allure', texte: `${texteAllure(moi.rythme)}/km`, verdict: v, mot: v === 'mieux' ? 'plus vite' : v === 'moins' ? 'plus lent' : 'pareil', ...bande(moi.rythme, rythmes) });
    const diff = Math.round(moi.rythme - medR);
    hero = {
      etiquette: `Contre tes ${nSorties(mAutres.length)} proches`,
      valeur: `${signe(diff) || '±'}${Math.abs(diff)}"`,
      unite: '/km',
      detail: v === 'mieux' ? `plus rapide que ta médiane (${texteAllure(medR)})` : v === 'moins' ? `plus lent que ta médiane (${texteAllure(medR)})` : `dans ton rythme habituel (${texteAllure(medR)})`,
    };
  } else {
    const v = verdictDe(moi.rythme, medR, 'haut');
    lignes.push({ cle: 'vitesse', libelle: 'Vitesse', texte: `${virgule(moi.rythme)} km/h`, verdict: v, mot: v === 'mieux' ? 'plus vite' : v === 'moins' ? 'plus lent' : 'pareil', ...bande(moi.rythme, rythmes) });
    const diff = Math.round((moi.rythme - medR) * 10) / 10;
    hero = {
      etiquette: `Contre tes ${nSorties(mAutres.length)} proches`,
      valeur: `${signe(diff) || '±'}${virgule(Math.abs(diff))}`,
      unite: ' km/h',
      detail: v === 'mieux' ? `plus rapide que ta médiane (${virgule(medR)} km/h)` : v === 'moins' ? `plus lent que ta médiane (${virgule(medR)} km/h)` : `dans ton rythme habituel (${virgule(medR)} km/h)`,
    };
  }

  // Le cœur : pas de « mieux » (plus haut peut vouloir dire plus fort comme plus fatigué)
  const fcs = mAutres.map((m) => m.fc).filter((x): x is number => x != null);
  if (moi.fc && fcs.length >= NB_SORTIES_MIN) {
    const med = mediane(fcs);
    fc = { valeur: moi.fc, mediane: med };
    const haut = (moi.fc - med) / med;
    lignes.push({ cle: 'fc', libelle: 'FC moyenne', texte: `${Math.round(moi.fc)} bpm`, verdict: null, mot: Math.abs(haut) < ECART_PAREIL ? 'pareil' : haut > 0 ? 'plus haute' : 'plus basse', ...bande(moi.fc, fcs) });
  }

  // L'efficacité : mètres par battement, plus c'est haut mieux c'est
  const effs = mAutres.map((m) => m.efficacite).filter((x): x is number => x != null);
  if (moi.efficacite && effs.length >= NB_SORTIES_MIN) {
    const med = mediane(effs);
    const v = verdictDe(moi.efficacite, med, 'haut');
    lignes.push({ cle: 'efficacite', libelle: 'Mètres par battement', texte: virgule(moi.efficacite, 2), verdict: v, mot: v === 'mieux' ? 'mieux' : v === 'moins' ? 'moins bien' : 'pareil', ...bande(moi.efficacite, effs) });
  }

  // La puissance moyenne (vélo avec capteur)
  const ws = mAutres.map((m) => m.watts).filter((x): x is number => x != null);
  if (moi.watts && ws.length >= NB_SORTIES_MIN) {
    const med = mediane(ws);
    const v = verdictDe(moi.watts, med, 'haut');
    lignes.push({ cle: 'watts', libelle: 'Puissance moyenne', texte: `${Math.round(moi.watts)} W`, verdict: v, mot: v === 'mieux' ? 'plus forte' : v === 'moins' ? 'plus faible' : 'pareil', ...bande(moi.watts, ws) });
  }

  return { famille, n: mAutres.length, lignes, hero, rythme, fc };
}
