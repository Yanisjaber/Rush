// ============================================================
// Le SUIVI du plan : le coach n'attend pas qu'on lui dise « refais-le ». À chaque message, le code compare le plan et la réalité
// (séances prévues par le coach, sorties faites, période de blessure ou de maladie) et lève des ALERTES déjà rédigées.
// Le coach les reçoit dans son contexte avec la consigne d'en parler EN PREMIER, d'expliquer et de proposer la carte (toujours validée par l'utilisateur).
//
// Signaux (le code les calcule, le modèle ne calcule rien) :
//   - test_fait         : la sortie test a été faite, mais le temps des 3 km n'est pas connu (une sortie contient échauffement et retour au calme) → on le demande ;
//   - seances_manquees  : 2 séances ratées sur les 7 derniers jours, ou 3 sur 14, depuis le dernier plan → on cherche la cause et on allège ;
//   - blessure_a_venir  : une maladie ou blessure déclarée tombe sur des séances prévues par le coach → on replanifie ;
//   - allure_trop_rapide / allure_trop_lente : sur les footings et sorties longues (là où la moyenne de la sortie est comparable à l'allure prévue),
//     l'allure courue s'écarte de plus de 5 % (plus vite) ou de 8 % (plus lent) de celle du plan sur au moins 2 sorties → le niveau est mal estimé.
// Rien n'est répété : une alerte ne se lève pas si un plan a déjà été proposé après les faits.
// ============================================================
import { entre } from './dates-iso.ts';

/** Écarts qui déclenchent une alerte : plus de 5 % plus vite, ou plus de 8 % plus lent, que l'allure prévue (moyenne d'au moins 2 sorties) */
export const ECART_RAPIDE = 0.95;
export const ECART_LENT = 1.08;
const allure = (s: number) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Libre = any;

export type CodeAlerte = 'test_fait' | 'seances_manquees' | 'blessure_a_venir' | 'allure_trop_rapide' | 'allure_trop_lente';

export interface AlerteSuivi {
  code: CodeAlerte;
  /** Ce que le coach dit à l'utilisateur, en une ou deux phrases, écrit par le code */
  constat: string;
  /** Ce que le coach doit faire ensuite */
  action: string;
}

export interface HistoriqueSuivi {
  /** Date (AAAA-MM-JJ) du dernier plan proposé ou appliqué dans la conversation (ni refusé ni annulé) ; null s'il n'y en a pas */
  dernierPlan: string | null;
}

const jourCourt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const liste = (dates: string[]) => dates.map(jourCourt).join(', ');

export function detecterSuivi(resume: Libre, aujourdhui: string, h: HistoriqueSuivi): AlerteSuivi[] {
  const alertes: AlerteSuivi[] = [];
  const passees: { date: string; est_test: boolean; faite: boolean; ratio: number | null; reel: number | null; cible: number | null; rpe: number | null }[] = (Array.isArray(resume?.plan_suivi) ? resume.plan_suivi : [])
    .filter((p: Libre) => typeof p?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date))
    .map((p: Libre) => {
      const km = Number(p.activite?.km);
      const sec = Number(p.activite?.secondes);
      const cible = Number(p.allure_cible_s);
      // Comparable seulement : séance d'allure unique, faite, d'au moins 2 km, avec une allure prévue lisible
      const comparable = p.faite === true && p.continue === true && !p.est_test && km >= 2 && sec > 0 && cible >= 150 && cible <= 900;
      const rpe = Number(p.activite?.rpe);
      return {
        date: p.date, est_test: p.est_test === true, faite: p.faite === true,
        ratio: comparable ? sec / km / cible : null, reel: comparable ? sec / km : null, cible: comparable ? cible : null,
        rpe: Number.isFinite(rpe) && rpe >= 1 && rpe <= 10 ? rpe : null,
      };
    });
  const depuis = h.dernierPlan ?? '0000-00-00';

  // 1. La sortie test est faite : le temps des 3 km manque
  const test = passees.find((p) => p.est_test && p.faite && p.date >= depuis);
  if (test) {
    alertes.push({
      code: 'test_fait',
      constat: `Tu as fait ta sortie test le ${jourCourt(test.date)}.`,
      action: "Demande-lui le temps de ses 3 km (mm:ss) : l'activité contient l'échauffement et le retour au calme, tu ne peux pas le lire. Dès qu'il te le donne, appelle preparer_course avec chrono_km et chrono_temps pour recalibrer tout le plan.",
    });
  }

  // 2. Des séances ratées depuis le dernier plan
  const manquees = passees.filter((p) => !p.faite && !p.est_test && p.date > depuis);
  const sept = manquees.filter((p) => p.date > jourMoins(aujourdhui, 7));
  if (sept.length >= 2 || manquees.length >= 3) {
    const dates = (sept.length >= 2 ? sept : manquees).map((p) => p.date);
    alertes.push({
      code: 'seances_manquees',
      constat: `Tu n'as pas fait ${dates.length} séances prévues (${liste(dates)}).`,
      action: "Demande-lui simplement ce qui s'est passé (fatigue, manque de temps, douleur, motivation), sans reproche. Selon sa réponse, propose de refaire le plan : moins de séances par semaine ou plus légères (preparer_course avec seances_par_semaine réduit), ou un congé (proposer_replanification). S'il parle de douleur, applique le garde-fou santé.",
    });
  }

  // 2 bis. L'allure courue s'écarte de celle du plan (footings et sorties longues faits depuis le dernier plan)
  const mesurees = passees.filter((p) => p.ratio !== null && p.date > depuis);
  if (mesurees.length >= 2) {
    const moy = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;
    const ratio = moy(mesurees.map((p) => p.ratio as number));
    const reel = moy(mesurees.map((p) => p.reel as number));
    const cible = moy(mesurees.map((p) => p.cible as number));
    const rpes = mesurees.map((p) => p.rpe).filter((x): x is number => x !== null);
    const effort = rpes.length ? ` Tu notes l'effort à ${Math.round(moy(rpes) * 10) / 10}/10 en moyenne.` : '';
    const pct = Math.round(Math.abs(1 - ratio) * 100);
    if (ratio <= ECART_RAPIDE) {
      alertes.push({
        code: 'allure_trop_rapide',
        constat: `Sur tes ${mesurees.length} dernières sorties à allure facile ou longue, tu cours en moyenne ${allure(reel)}/km au lieu de ${allure(cible)}/km prévu (${pct} % plus vite).${effort}`,
        action: "Demande-lui comment c'était (ressenti sur 10, essoufflement, peut-il parler ?). Si c'était vraiment facile, son niveau est au-dessus de l'estimation : propose de recalibrer le plan (demande un effort récent ou un chrono, puis preparer_course avec chrono_km et chrono_temps, ou avec des allures plus rapides). Si c'était dur, explique que le footing doit rester facile, avec la raison, et ne change pas le plan.",
      });
    } else if (ratio >= ECART_LENT) {
      alertes.push({
        code: 'allure_trop_lente',
        constat: `Sur tes ${mesurees.length} dernières sorties à allure facile ou longue, tu cours en moyenne ${allure(reel)}/km au lieu de ${allure(cible)}/km prévu (${pct} % plus lentement).${effort}`,
        action: "Demande si c'est la fatigue, la chaleur, le relief, une douleur ou un simple choix, sans reproche. Si ça dure sans raison, le plan est trop ambitieux : propose de le recalibrer plus doux (preparer_course avec des allures facile et longue plus lentes, ou une sortie test pour mesurer le niveau). S'il parle de douleur, applique le garde-fou santé.",
      });
    }
  }

  // 3. Une maladie ou une blessure déclarée tombe sur des séances prévues par le coach
  const indispos: { type: string; du: string; au: string }[] = Array.isArray(resume?.indisponibilites) ? resume.indisponibilites : [];
  const prevues: { date: string; creee_par_ia?: boolean; sport?: string }[] = Array.isArray(resume?.prevues) ? resume.prevues : [];
  const touchees = prevues.filter((p) => p?.creee_par_ia === true && typeof p.date === 'string' && p.date >= aujourdhui && indispos.some((i) => entre(p.date, i.du, i.au)));
  if (touchees.length && (h.dernierPlan === null || touchees.some((p) => p.date > h.dernierPlan!))) {
    const dates = touchees.map((p) => p.date).sort();
    alertes.push({
      code: 'blessure_a_venir',
      constat: `${touchees.length} séance${touchees.length > 1 ? 's' : ''} du plan tombe${touchees.length > 1 ? 'nt' : ''} pendant ta période d'indisponibilité (${liste(dates)}).`,
      action: "Propose de replanifier : appelle proposer_replanification avec cette indisponibilité (les séances seront déplacées, adoucies ou retirées), puis explique le plan.",
    });
  }
  return alertes;
}

function jourMoins(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Le texte glissé dans le contexte du modèle ; chaîne vide s'il n'y a rien à signaler */
export function texteSuivi(alertes: AlerteSuivi[]): string {
  if (!alertes.length) return '';
  return alertes.map((a) => `- ${a.constat} → ${a.action}`).join('\n');
}
