import { dateIsoLocale, formatDateCourte } from '../outils/format.ts';
import type { Comparaison } from './comparaison-sortie.ts';
import { nSorties, texteAllure } from './comparaison-sortie.ts';

// La page 4 d'une sortie, seconde moitié : le « mot du coach ». Des phrases fabriquées par des règles à partir de la comparaison et des mesures de la sortie
// (pas d'IA : rien n'est envoyé, rien ne coûte). Fonctions pures : aucun écran, aucun réseau.
// Le coach décrit ce qu'il voit, sans diagnostic. La proposition n'est qu'une carte à valider : elle n'écrit rien toute seule.

export interface EntreeMotCoach {
  comparaison: Comparaison | null;
  /** Dérive cardiaque en % (positif = le cœur a monté à allure égale), null sans flux ou sortie trop courte. */
  derivePct: number | null;
  /** Part du temps passé en zone 4 ou plus (0 à 1), null sans zones. */
  partHaute: number | null;
  famille: 'course' | 'velo';
  /** Durée de la sortie, en secondes. */
  dureeS: number;
  /** Jour de la sortie (AAAA-MM-JJ) et aujourd'hui. */
  iso: string;
  aujourdhui: Date;
  /** Jours qui ont déjà une séance prévue (AAAA-MM-JJ) : on ne propose pas par-dessus. */
  joursOccupes: readonly string[];
}

/** Ce que la carte propose d'ajouter au calendrier. */
export interface PropositionCoach {
  date: string;
  nom: string;
  /** Le type de sport brut (Run, Ride). */
  type: string;
  dureeMin: number;
  rpe: number;
  notes: string;
  /** « mer. 11 nov. · footing facile 30 min, zone 2 » */
  texte: string;
  sousTexte: string;
}

export interface MotCoach {
  titre: string;
  paragraphes: string[];
  proposition: PropositionCoach | null;
}

/** Dérive : jusqu'à 5 % l'endurance est solide (même repère que le chiffre de la page 3), au-delà de 10 % le cœur a nettement monté. */
const DERIVE_SOLIDE = 5;
const DERIVE_FORTE = 10;
/** Une sortie est « exigeante » quand la moitié du temps se passe en zone 4 ou plus, ou que la dérive est forte. Convention du coach, pas une norme. */
const PART_HAUTE_EXIGEANTE = 0.5;

const pct = (n: number) => String(Math.round(Math.abs(n))).replace('.', ',');
const signe = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');

/** Une sortie qui a coûté : beaucoup de temps en zone haute, ou un cœur qui a nettement dérivé. */
export function sortieExigeante(e: Pick<EntreeMotCoach, 'derivePct' | 'partHaute'>): boolean {
  return (e.derivePct != null && e.derivePct > DERIVE_FORTE) || (e.partHaute != null && e.partHaute >= PART_HAUTE_EXIGEANTE);
}

function ajouterJours(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dateIsoLocale(d);
}

function proposer(e: EntreeMotCoach): PropositionCoach | null {
  if (!sortieExigeante(e)) return null;
  const aujourdhui = dateIsoLocale(e.aujourdhui);
  // Seulement tant que la sortie est fraîche : aujourd'hui ou hier
  if (e.iso < ajouterJours(aujourdhui, -1) || e.iso > aujourdhui) return null;
  const lendemain = ajouterJours(e.iso, 1);
  const date = lendemain < aujourdhui ? aujourdhui : lendemain;
  if (e.joursOccupes.includes(date)) return null;
  const minutes = e.dureeS / 60;
  const arrondi5 = (m: number) => Math.round(m / 5) * 5;
  const course = e.famille === 'course';
  // La moitié de la sortie (60 % à vélo), bornée : assez pour bouger, pas assez pour recharger la fatigue
  const dureeMin = course ? Math.min(45, Math.max(20, arrondi5(minutes * 0.5))) : Math.min(90, Math.max(45, arrondi5(minutes * 0.6)));
  const nom = course ? 'Footing facile' : 'Sortie facile';
  return {
    date,
    nom,
    type: course ? 'Run' : 'Ride',
    dureeMin,
    rpe: 3,
    notes: `Zone 2, proposée par le coach après ta sortie du ${formatDateCourte(e.iso).replace(/\./g, '')} : pour laisser retomber la fatigue.`,
    texte: `${formatDateCourte(date)} · ${nom.toLowerCase()} ${dureeMin} min, zone 2`,
    sousTexte: 'Pour laisser retomber la fatigue.',
  };
}

export function motDuCoach(e: EntreeMotCoach): MotCoach {
  const c = e.comparaison;
  const exigeante = sortieExigeante(e);
  const paragraphes: string[] = [];

  // 1. Le rythme, comparé à la médiane des sorties proches
  if (c?.rythme) {
    const r = c.rythme;
    const proche = Math.abs(r.ecartRelatif) < 0.02;
    if (e.famille === 'course') {
      const diff = Math.abs(Math.round(r.valeur - r.mediane));
      paragraphes.push(
        proche
          ? `Tu as couru à ${texteAllure(r.valeur)} au km, comme d'habitude : ta médiane sur tes ${nSorties(c.n)} de distance proche est de ${texteAllure(r.mediane)}.`
          : `Tu as couru à ${texteAllure(r.valeur)} au km, contre ${texteAllure(r.mediane)} en médiane sur tes ${nSorties(c.n)} de distance proche : ${diff} s ${r.valeur < r.mediane ? 'plus vite' : 'plus lentement'}.`,
      );
    } else {
      const diff = Math.round(Math.abs(r.valeur - r.mediane) * 10) / 10;
      const f = (n: number) => n.toFixed(1).replace('.', ',');
      paragraphes.push(
        proche
          ? `Tu as roulé à ${f(r.valeur)} km/h, comme d'habitude : ta médiane sur tes ${nSorties(c.n)} de distance proche est de ${f(r.mediane)} km/h.`
          : `Tu as roulé à ${f(r.valeur)} km/h, contre ${f(r.mediane)} en médiane sur tes ${nSorties(c.n)} de distance proche : ${f(diff)} km/h ${r.valeur > r.mediane ? 'de plus' : 'de moins'}.`,
      );
    }
  }

  // 2. Le cœur : sa moyenne contre d'habitude, puis la dérive
  const morceauxCoeur: string[] = [];
  if (c?.fc) {
    const ecart = Math.round(c.fc.valeur - c.fc.mediane);
    morceauxCoeur.push(
      Math.abs(ecart) <= 1
        ? `Ton cœur est resté au niveau habituel (${Math.round(c.fc.valeur)} bpm en moyenne).`
        : `Ton cœur est à ${Math.round(c.fc.valeur)} bpm en moyenne, ${Math.abs(ecart)} de ${ecart > 0 ? 'plus' : 'moins'} que d'habitude.`,
    );
  }
  if (e.derivePct != null) {
    const d = e.derivePct;
    morceauxCoeur.push(
      d <= DERIVE_SOLIDE
        ? `Ta dérive est faible (${signe(d) || ''}${pct(d)} %) : tu as tenu ton allure sans que le cœur décroche.`
        : d <= DERIVE_FORTE
          ? `Ta dérive est de +${pct(d)} % : le cœur a un peu monté sur la fin.`
          : `Ta dérive est de +${pct(d)} % : à la fin, il fallait nettement plus de battements pour la même allure, signe de fatigue (ou de chaleur).`,
    );
  }
  if (morceauxCoeur.length) paragraphes.push(morceauxCoeur.join(' '));

  // 3. Le temps en zone haute, quand il pèse
  if (e.partHaute != null && e.partHaute >= PART_HAUTE_EXIGEANTE) {
    paragraphes.push(`Tu as passé ${pct(e.partHaute * 100)} % du temps en zone 4 ou plus : c'est une sortie qui a coûté.`);
  }

  const mieux = c?.rythme && c.rythme.ecartRelatif * (e.famille === 'course' ? -1 : 1) > 0.02;
  const titre = exigeante ? 'Une sortie qui a coûté.' : mieux ? 'Une belle sortie, sans surcoût.' : 'Une sortie dans tes habitudes.';

  return { titre, paragraphes: paragraphes.length ? paragraphes : ['Pas assez de données pour commenter cette sortie : il manque le cœur ou des sorties proches à comparer.'], proposition: proposer(e) };
}
