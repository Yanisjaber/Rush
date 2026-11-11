// ============================================================
// ANALYSE DU COUREUR : le portrait que le code tire des données AVANT de construire un plan.
// Principe (Yanis, 11 nov.) : un plan n'est jamais un calendrier type, il découle de la personne. Ici, rien n'est deviné :
//   - ce que les données montrent est dit tel quel (régularité, volume, tendance, état) ;
//   - ce qu'elles ne permettent PAS de savoir est listé dans `inconnues`, avec la question à poser (le coach la pose, il ne devine pas).
// Les seuils ci-dessous sont des CONVENTIONS DE LECTURE à nous (aucune étude ne les donne) : ils servent à nommer un état, pas à fixer une charge.
// ============================================================
import { ecartJours } from './dates-iso.ts';
import type { Niveau, ProfilCourse } from './plan-course.ts';

export type EtatCoureur = 'debutant' | 'reprise' | 'regulier' | 'en_hausse' | 'en_baisse' | 'irregulier';

export interface Inconnue {
  /** Ce qu'on ne sait pas, en une phrase */
  sujet: string;
  /** La question à poser à la personne pour le savoir */
  question: string;
}

export interface AnalyseCoureur {
  etat: EtatCoureur;
  /** Semaines avec au moins une sortie, sur les 8 dernières fenêtres de 7 jours */
  semainesActives: number;
  semainesObservees: number;
  /** Sorties par semaine (moyenne sur les semaines observées) */
  sortiesParSemaine: number;
  /** Médiane des minutes des semaines actives */
  volumeTypiqueMinutes: number | null;
  /** Plus grosse semaine des 8 dernières */
  picMinutes: number;
  /** 4 dernières fenêtres contre les 4 d'avant, en % (null s'il manque des semaines ou de la base) */
  tendancePourcent: number | null;
  niveau: Niveau | null;
  /** Vrai si un effort rapide (course, test) de moins de 6 semaines fixe le niveau : sinon il vient de sorties plutôt modérées */
  effortRapideRecent: boolean;
  inconnues: Inconnue[];
  /** Le portrait en phrases courtes, à la deuxième personne, prêtes à être reprises par le coach */
  phrases: string[];
}

/** Au-delà de 6 semaines, un effort n'est plus « récent » pour dire qu'on connaît sa vitesse du moment (convention à nous) */
const EFFORT_RECENT_JOURS = 42;
/** Au-delà de ±15 % entre les deux moitiés des 8 semaines, on parle de hausse ou de baisse (convention à nous) */
const SEUIL_TENDANCE = 15;

const mediane = (v: number[]): number | null => {
  if (!v.length) return null;
  const t = [...v].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
};

/** `niveau` : le niveau déjà estimé par plan-course (passé en paramètre pour éviter un import circulaire) */
export function analyserCoureur(profil: ProfilCourse | null, niveau: Niveau | null, aujourdhui: string): AnalyseCoureur {
  const semaines = profil?.semaines ?? [];
  const actives = semaines.filter((s) => s.sorties > 0);
  const volumeTypique = mediane(actives.map((s) => s.minutes));
  const pic = Math.max(0, ...semaines.map((s) => s.minutes));
  const sortiesParSemaine = semaines.length ? semaines.reduce((t, s) => t + s.sorties, 0) / semaines.length : 0;

  let tendance: number | null = null;
  if (semaines.length >= 8) {
    const avant = semaines.slice(0, 4).reduce((t, s) => t + s.minutes, 0);
    const apres = semaines.slice(4).reduce((t, s) => t + s.minutes, 0);
    if (avant > 0) tendance = Math.round(((apres - avant) / avant) * 100);
  }

  const effort = profil?.effortRecent ?? null;
  const effortRapideRecent = !!effort && ecartJours(effort.date, aujourdhui) <= EFFORT_RECENT_JOURS;

  const aDesDonnees = !!profil && (profil.recent.sorties >= 3 || profil.meilleurEffort !== null || profil.sorties90 > 0);
  let etat: EtatCoureur;
  if (!aDesDonnees) etat = 'debutant';
  else if (profil!.sorties90 === 0 || actives.length <= 1) etat = 'reprise';
  else if (actives.length < semaines.length * 0.6) etat = 'irregulier';
  else if (tendance !== null && tendance >= SEUIL_TENDANCE) etat = 'en_hausse';
  else if (tendance !== null && tendance <= -SEUIL_TENDANCE) etat = 'en_baisse';
  else etat = 'regulier';

  const inconnues: Inconnue[] = [];
  if (etat !== 'debutant' && etat !== 'reprise' && !effortRapideRecent) {
    inconnues.push({
      sujet: "aucun effort rapide récent : je ne sais pas si ton niveau vient de tes footings ou de ta vraie vitesse, ni si c'est la vitesse ou l'endurance qui te limite",
      question: "As-tu fait une course ou un test chronométré ces six dernières semaines ? Sinon, la première séance du plan sera un test.",
    });
  }
  if (etat === 'irregulier') {
    inconnues.push({ sujet: 'tes semaines sont irrégulières, je ne sais pas pourquoi', question: "Qu'est-ce qui coupe tes semaines (travail, fatigue, blessure, motivation) ?" });
  }
  if (etat === 'en_baisse') {
    inconnues.push({ sujet: 'ton volume baisse, la cause est inconnue', question: 'Ton volume baisse depuis un mois : est-ce voulu (repos), ou une gêne, de la fatigue, un manque de temps ?' });
  }

  const phrases: string[] = [];
  switch (etat) {
    case 'debutant': phrases.push("Je n'ai aucune sortie de course exploitable : on part de zéro, en douceur."); break;
    case 'reprise': phrases.push(`Tu reprends : seulement ${actives.length} semaine${actives.length > 1 ? 's' : ''} avec une sortie sur les ${semaines.length || 8} dernières.`); break;
    case 'irregulier': phrases.push(`Tu as couru ${actives.length} semaines sur ${semaines.length}, avec des trous.`); break;
    case 'en_hausse': phrases.push(`Ton volume monte (${tendance} % sur le dernier mois par rapport au mois d'avant).`); break;
    case 'en_baisse': phrases.push(`Ton volume baisse (${tendance} % sur le dernier mois par rapport au mois d'avant).`); break;
    default: phrases.push(`Tu cours régulièrement : ${actives.length} semaines sur ${semaines.length}.`);
  }
  if (volumeTypique !== null && etat !== 'debutant') phrases.push(`Une semaine typique : environ ${Math.round(volumeTypique)} min, ${sortiesParSemaine.toFixed(1).replace('.', ',')} sortie${sortiesParSemaine >= 1.5 ? 's' : ''} par semaine ; ta plus grosse récente : ${Math.round(pic)} min.`);
  if (effortRapideRecent && effort) phrases.push(`Ton niveau repose sur un effort rapide récent (${effort.km} km le ${effort.date}).`);

  return { etat, semainesActives: actives.length, semainesObservees: semaines.length, sortiesParSemaine, volumeTypiqueMinutes: volumeTypique === null ? null : Math.round(volumeTypique), picMinutes: pic, tendancePourcent: tendance, niveau, effortRapideRecent, inconnues, phrases };
}
