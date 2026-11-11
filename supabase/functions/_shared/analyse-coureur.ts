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

/** Ce qui limite le coureur d'après ses records sur deux distances : « endurance » = son temps se dégrade vite quand la distance augmente, « vitesse » = il tient bien la distance mais manque de vitesse pure */
export type Limite = 'endurance' | 'vitesse' | 'equilibre';

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
  /** Vitesse ou endurance : lu sur deux records de distances différentes, null si les données ne permettent pas de le dire */
  limite: Limite | null;
  /** L'exposant personnel entre les deux distances (ln(t2/t1) / ln(d2/d1)), null si non calculable */
  exposant: number | null;
  /** Vrai si un effort rapide (course, test) de moins de 6 semaines fixe le niveau : sinon il vient de sorties plutôt modérées */
  effortRapideRecent: boolean;
  /** Ce que toute sa vie de coureur montre (vide s'il n'y a aucune sortie en base) */
  passe: string[];
  inconnues: Inconnue[];
  /** Le portrait en phrases courtes, à la deuxième personne, prêtes à être reprises par le coach */
  phrases: string[];
}

/** Au-delà de 6 semaines, un effort n'est plus « récent » pour dire qu'on connaît sa vitesse du moment (convention à nous) */
const EFFORT_RECENT_JOURS = 42;
/** Au-delà de ±15 % entre les deux moitiés des 8 semaines, on parle de hausse ou de baisse (convention à nous) */
const SEUIL_TENDANCE = 15;

/** Exposant de référence entre distances (Riegel 1,06, déjà utilisé par le moteur) */
const EXPOSANT_REFERENCE = 1.06;
/** Écart autour de 1,06 à partir duquel on parle de limite d'endurance ou de vitesse (convention de lecture à nous : aucune étude ne le donne) */
const ECART_EXPOSANT = 0.03;
/** Les deux records doivent dater de moins de 120 jours l'un de l'autre, sinon la forme a changé entre les deux (convention à nous) */
const ECART_MAX_JOURS = 120;
/** Les deux distances doivent au moins faire un rapport de 1,6 (5 → 10 km, 10 → 21 km) pour que l'exposant ait un sens */
const RAPPORT_MIN = 1.6;

export function limiteDuCoureur(vie: NonNullable<ProfilCourse['vie']> | null | undefined): { limite: Limite; exposant: number } | null {
  const e = vie?.meilleursParDistance ?? [];
  let meilleur: { limite: Limite; exposant: number; rapport: number } | null = null;
  for (let i = 0; i < e.length; i++) for (let j = i + 1; j < e.length; j++) {
    const [c, l] = e[i].km < e[j].km ? [e[i], e[j]] : [e[j], e[i]];
    const rapport = l.km / c.km;
    if (rapport < RAPPORT_MIN || Math.abs(ecartJours(c.date, l.date)) > ECART_MAX_JOURS) continue;
    const exposant = Math.log(l.secondes / c.secondes) / Math.log(rapport);
    if (!Number.isFinite(exposant) || exposant < 0.9 || exposant > 1.3) continue; // un chiffre absurde (GPS, pause) : on ne s'en sert pas
    const limite: Limite = exposant >= EXPOSANT_REFERENCE + ECART_EXPOSANT ? 'endurance' : exposant <= EXPOSANT_REFERENCE - ECART_EXPOSANT ? 'vitesse' : 'equilibre';
    if (!meilleur || rapport > meilleur.rapport) meilleur = { limite, exposant: Math.round(exposant * 1000) / 1000, rapport };
  }
  return meilleur ? { limite: meilleur.limite, exposant: meilleur.exposant } : null;
}

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

  const vie = profil?.vie ?? null;
  const lecture = limiteDuCoureur(vie);
  const avaitCouru = (vie?.sorties ?? 0) > 0;
  const aDesDonnees = !!profil && (profil.recent.sorties >= 3 || profil.meilleurEffort !== null || profil.sorties90 > 0);
  let etat: EtatCoureur;
  if (!aDesDonnees && !avaitCouru) etat = 'debutant';
  else if ((profil?.sorties90 ?? 0) === 0 || actives.length <= 1) etat = 'reprise';
  else if (actives.length < semaines.length * 0.6) etat = 'irregulier';
  else if (tendance !== null && tendance >= SEUIL_TENDANCE) etat = 'en_hausse';
  else if (tendance !== null && tendance <= -SEUIL_TENDANCE) etat = 'en_baisse';
  else etat = 'regulier';

  const passe: string[] = [];
  if (vie && avaitCouru) {
    const fr = (n: number) => String(n).replace('.', ',');
    if (vie.premiereSortie) passe.push(`Tu cours depuis ${vie.premiereSortie.slice(0, 4)} : ${vie.sorties} sorties, ${Math.round(vie.kmTotal)} km et ${Math.round(vie.heuresTotal)} h au total.`);
    const meilleureAnnee = [...vie.annees].sort((a, b) => b.km - a.km)[0];
    if (meilleureAnnee && vie.annees.length > 1) passe.push(`Ta plus grosse année : ${meilleureAnnee.annee} (${Math.round(meilleureAnnee.km)} km, ${meilleureAnnee.sorties} sorties).`);
    if (vie.plusGrosseSemaine) passe.push(`Ta plus grosse semaine : ${Math.round(vie.plusGrosseSemaine.minutes)} min (${fr(vie.plusGrosseSemaine.km)} km) la semaine du ${vie.plusGrosseSemaine.du}.`);
    if (vie.plusLongueSortie) passe.push(`Ta plus longue sortie : ${fr(vie.plusLongueSortie.km)} km en ${Math.round(vie.plusLongueSortie.minutes)} min (${vie.plusLongueSortie.date}).`);
    if (vie.meilleurEffortVie) passe.push(`Ton meilleur effort : ${fr(vie.meilleurEffortVie.km)} km en ${Math.floor(vie.meilleurEffortVie.secondes / 60)}:${String(Math.round(vie.meilleurEffortVie.secondes % 60)).padStart(2, '0')} le ${vie.meilleurEffortVie.date}.`);
    const pa = vie.meilleurParAnnee;
    if (pa.length >= 2) {
      const premier = pa[0];
      const dernier = pa[pa.length - 1];
      const ecart = Math.round(((dernier.equiv10Secondes - premier.equiv10Secondes) / premier.equiv10Secondes) * 100);
      passe.push(ecart < -1 ? `Tes meilleurs efforts s'améliorent d'année en année (${premier.annee} → ${dernier.annee} : ${Math.abs(ecart)} % plus vite).` : ecart > 1 ? `Ton meilleur effort de ${dernier.annee} est ${ecart} % plus lent que celui de ${premier.annee}.` : `Ton meilleur effort est stable depuis ${premier.annee}.`);
    }
    if (vie.arrets.length) passe.push(`Tu as fait ${vie.arrets.length} arrêt${vie.arrets.length > 1 ? 's' : ''} de plus de 6 semaines${vie.arrets.length > 1 ? ' (le plus récent' : ' ('} du ${vie.arrets[vie.arrets.length - 1].du} au ${vie.arrets[vie.arrets.length - 1].au}).`);
    if (vie.joursDepuisDerniere !== null && vie.joursDepuisDerniere >= 42) passe.push(`Ta dernière sortie remonte à ${vie.joursDepuisDerniere} jours (${vie.derniereSortie}).`);
    if (vie.ctlMax) passe.push(`Ta charge chronique la plus haute : ${Math.round(vie.ctlMax.ctl)} (${vie.ctlMax.date}).`);
    if (vie.vo2maxCourse) passe.push(`VO2max course notée dans ton profil : ${vie.vo2maxCourse} (valeur actuelle, sans historique).`);
    if (vie.poidsParAnnee && vie.poidsParAnnee.length) { const p = vie.poidsParAnnee; passe.push(`Ton poids moyen : ${fr(p[0].moyenneKg)} kg en ${p[0].annee}${p.length > 1 ? `, ${fr(p[p.length - 1].moyenneKg)} kg en ${p[p.length - 1].annee}` : ''}.`); }
    if (vie.sommeilParAnnee && vie.sommeilParAnnee.length) { const q = vie.sommeilParAnnee[vie.sommeilParAnnee.length - 1]; if (q.dureeMoyenneH !== null) passe.push(`Ton sommeil en ${q.annee} : ${String(q.dureeMoyenneH).replace('.', ',')} h par nuit en moyenne (${q.nuits} nuits).`); }
  }

  if (lecture) passe.push(lecture.limite === 'endurance'
    ? `Tes records sur deux distances montrent que ton temps se dégrade vite quand la distance augmente (exposant ${String(lecture.exposant).replace('.', ',')}) : c'est ton endurance qu'il faut construire.`
    : lecture.limite === 'vitesse'
      ? `Tes records sur deux distances montrent que tu tiens bien la distance (exposant ${String(lecture.exposant).replace('.', ',')}) : c'est ta vitesse qu'il faut travailler.`
      : `Tes records sur deux distances sont équilibrés (exposant ${String(lecture.exposant).replace('.', ',')}) : vitesse et endurance se tiennent.`);

  const inconnues: Inconnue[] = [];
  if (!lecture && etat !== 'debutant') {
    inconnues.push({ sujet: "je ne peux pas dire si c'est ta vitesse ou ton endurance qui te limite : il me manque deux records récents sur des distances différentes (par exemple un 5 km et un 10 km)", question: "As-tu un temps récent sur une autre distance que celle de ta course (5 km, 10 km, semi) ?" });
  }
  if (etat === 'reprise' && vie && (vie.joursDepuisDerniere ?? 0) >= 90) {
    inconnues.push({ sujet: `je ne sais pas pourquoi tu t'es arrêté il y a ${vie.joursDepuisDerniere} jours (blessure, vie, envie)`, question: "Pourquoi as-tu arrêté de courir, et ton corps est-il prêt (douleur, gêne) ?" });
  }
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
    case 'reprise': phrases.push(avaitCouru && (profil?.sorties90 ?? 0) === 0 ? `Tu reprends après un arrêt : aucune sortie depuis 90 jours.` : `Tu reprends : seulement ${actives.length} semaine${actives.length > 1 ? 's' : ''} avec une sortie sur les ${semaines.length || 8} dernières.`); break;
    case 'irregulier': phrases.push(`Tu as couru ${actives.length} semaines sur ${semaines.length}, avec des trous.`); break;
    case 'en_hausse': phrases.push(`Ton volume monte (${tendance} % sur le dernier mois par rapport au mois d'avant).`); break;
    case 'en_baisse': phrases.push(`Ton volume baisse (${tendance} % sur le dernier mois par rapport au mois d'avant).`); break;
    default: phrases.push(`Tu cours régulièrement : ${actives.length} semaines sur ${semaines.length}.`);
  }
  if (volumeTypique !== null && etat !== 'debutant') phrases.push(`Une semaine typique : environ ${Math.round(volumeTypique)} min, ${sortiesParSemaine.toFixed(1).replace('.', ',')} sortie${sortiesParSemaine >= 1.5 ? 's' : ''} par semaine ; ta plus grosse récente : ${Math.round(pic)} min.`);
  if (effortRapideRecent && effort) phrases.push(`Ton niveau repose sur un effort rapide récent (${effort.km} km le ${effort.date}).`);

  return { etat, semainesActives: actives.length, semainesObservees: semaines.length, sortiesParSemaine, volumeTypiqueMinutes: volumeTypique === null ? null : Math.round(volumeTypique), picMinutes: pic, tendancePourcent: tendance, niveau, effortRapideRecent, limite: lecture?.limite ?? null, exposant: lecture?.exposant ?? null, passe, inconnues, phrases: [...phrases, ...passe] };
}
