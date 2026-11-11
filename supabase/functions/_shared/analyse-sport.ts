// ============================================================
// ANALYSE D'UN SPORT (vélo, natation) sur TOUTE la vie du compte (rpc_coach_vie_sport), pas seulement les 28 derniers jours.
// Même principe que analyse-coureur.ts : rien n'est deviné. Ce que les données montrent est dit ; ce qu'elles ne permettent pas de savoir
// est listé dans `inconnues`, avec la question à poser. Les seuils ci-dessous sont des CONVENTIONS DE LECTURE à nous (aucune étude ne les donne).
//
//   - vélo : ce qui limite le cycliste est lu sur le rapport entre sa meilleure puissance sur 5 min et sur 20 min, sur les 24 derniers mois ;
//   - natation : AUCUNE conclusion sur ce qui limite le nageur. L'allure d'une séance contient les repos, les exercices et les longueurs de technique :
//     trop bruitée pour dire si c'est la vitesse ou l'endurance qui manque. Le coach demande plutôt un test (400 m / 200 m).
// ============================================================
import { ecartJours } from './dates-iso.ts';
import type { Limite } from './analyse-coureur.ts';

export type SportVie = 'velo' | 'natation';

export interface VieSport {
  sport: SportVie;
  premiereSortie: string | null;
  derniereSortie: string | null;
  joursDepuisDerniere: number | null;
  sorties: number;
  heuresTotal: number;
  annees: { annee: number; sorties: number; heures: number; km: number; semainesActives: number }[];
  plusGrosseSemaine: { du: string; sorties: number; minutes: number } | null;
  plusLongueSortie: { date: string; minutes: number; km: number } | null;
  arrets: { du: string; au: string; jours: number }[];
  recent90: { sorties: number; minutes: number; plusLongueMinutes: number };
  /** Vélo : meilleures puissances (W) par année et sur 24 mois */
  velo: { parAnnee: { annee: number; w5: number | null; w300: number | null; w1200: number | null; w3600: number | null }[]; recent24: { w5: number | null; w300: number | null; w1200: number | null; w3600: number | null; courbes: number } | null } | null;
  /** Natation : meilleure allure de séance au 100 m (secondes), séances courtes (0,4 à 0,9 km) et longues (1,5 km et plus) */
  natation: { parAnnee: { annee: number; court100: number | null; long100: number | null }[]; recent24: { court100: number | null; long100: number | null } | null } | null;
}

const nb = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x)) ? Number(x) : null);
// deno-lint-ignore no-explicit-any
const liste = (x: unknown): any[] => (Array.isArray(x) ? x : []);

/** La vie du sport lue dans le résumé (clés `vie_velo` / `vie_natation`) ; null si absente ou vide (aucune séance) */
// deno-lint-ignore no-explicit-any
export function vieSportDepuisResume(resume: any, sport: SportVie): VieSport | null {
  const v = resume?.[`vie_${sport}`];
  if (!v || typeof v !== 'object' || v.sport !== sport) return null;
  const gs = v.plus_grosse_semaine;
  const pl = v.plus_longue_sortie;
  const r = v.recent_90_jours ?? {};
  const rec = v.records ?? {};
  const rec24 = rec.recent_24_mois;
  return {
    sport,
    premiereSortie: typeof v.premiere_sortie === 'string' ? v.premiere_sortie : null,
    derniereSortie: typeof v.derniere_sortie === 'string' ? v.derniere_sortie : null,
    joursDepuisDerniere: nb(v.jours_depuis_derniere),
    sorties: nb(v.sorties) ?? 0,
    heuresTotal: nb(v.heures_total) ?? 0,
    annees: liste(v.annees).map((a) => ({ annee: nb(a?.annee) ?? 0, sorties: nb(a?.sorties) ?? 0, heures: nb(a?.heures) ?? 0, km: nb(a?.km) ?? 0, semainesActives: nb(a?.semaines_actives) ?? 0 })).filter((a) => a.annee > 0),
    plusGrosseSemaine: gs && typeof gs.du === 'string' ? { du: gs.du, sorties: nb(gs.sorties) ?? 0, minutes: nb(gs.minutes) ?? 0 } : null,
    plusLongueSortie: pl && typeof pl.date === 'string' ? { date: pl.date, minutes: nb(pl.minutes) ?? 0, km: nb(pl.km) ?? 0 } : null,
    arrets: liste(v.arrets).filter((a) => typeof a?.du === 'string' && typeof a?.au === 'string').map((a) => ({ du: a.du, au: a.au, jours: nb(a.jours) ?? 0 })),
    recent90: { sorties: nb(r.sorties) ?? 0, minutes: nb(r.minutes) ?? 0, plusLongueMinutes: nb(r.plus_longue_minutes) ?? 0 },
    velo: sport === 'velo' ? {
      parAnnee: liste(rec.par_annee).map((a) => ({ annee: nb(a?.annee) ?? 0, w5: nb(a?.w5), w300: nb(a?.w300), w1200: nb(a?.w1200), w3600: nb(a?.w3600) })).filter((a) => a.annee > 0),
      recent24: rec24 && typeof rec24 === 'object' ? { w5: nb(rec24.w5), w300: nb(rec24.w300), w1200: nb(rec24.w1200), w3600: nb(rec24.w3600), courbes: nb(rec24.courbes) ?? 0 } : null,
    } : null,
    natation: sport === 'natation' ? {
      parAnnee: liste(rec.par_annee).map((a) => ({ annee: nb(a?.annee) ?? 0, court100: nb(a?.court_s100), long100: nb(a?.long_s100) })).filter((a) => a.annee > 0),
      recent24: rec24 && typeof rec24 === 'object' ? { court100: nb(rec24.court_s100), long100: nb(rec24.long_s100) } : null,
    } : null,
  };
}

export type EtatSport = 'debutant' | 'reprise' | 'actif';

export interface Inconnue { sujet: string; question: string }

export interface AnalyseSport {
  sport: SportVie;
  /** debutant : aucune séance en base · reprise : aucune séance depuis 90 jours · actif : au moins une séance dans les 90 derniers jours */
  etat: EtatSport;
  /** Sa plus grosse semaine de toute sa vie dans ce sport (minutes) et le nombre de séances de cette semaine */
  picSemaineMinutes: number | null;
  picSemaineSeances: number | null;
  plusLongueVieMinutes: number | null;
  /** Durée moyenne d'une séance sur les 90 derniers jours (null s'il n'y en a pas) */
  moyenne90Minutes: number | null;
  plusLongue90Minutes: number | null;
  /** Vélo seulement : rapport puissance 5 min / puissance 20 min sur 24 mois (null si non calculable) */
  ratio5sur20: number | null;
  /** Vélo seulement : ce qui limite, lu sur le rapport ci-dessus ; null = on ne sait pas */
  limite: Limite | null;
  passe: string[];
  inconnues: Inconnue[];
  phrases: string[];
}

/** Le rapport 5 min / 20 min en dessous duquel la puissance de pointe est la plus faible, au-dessus duquel c'est la puissance soutenue (conventions à nous) */
export const RATIO_VELO_VITESSE_MAX = 1.08;
export const RATIO_VELO_ENDURANCE_MIN = 1.22;
/** Au moins 5 courbes de puissance sur 24 mois pour que le rapport veuille dire quelque chose (convention à nous) */
const COURBES_MINI = 5;

const NOM: Record<SportVie, string> = { velo: 'vélo', natation: 'natation' };
const fr = (n: number) => String(n).replace('.', ',');
const hm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}` : `${Math.round(min)} min`);
const alure100 = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export function analyserSport(vie: VieSport | null, sport: SportVie): AnalyseSport {
  const avaitFait = !!vie && vie.sorties > 0;
  const r90 = vie?.recent90 ?? { sorties: 0, minutes: 0, plusLongueMinutes: 0 };
  const etat: EtatSport = !avaitFait ? 'debutant' : r90.sorties === 0 ? 'reprise' : 'actif';
  const nom = NOM[sport];

  let ratio: number | null = null;
  let limite: Limite | null = null;
  const r24 = vie?.velo?.recent24;
  if (sport === 'velo' && r24 && r24.courbes >= COURBES_MINI && r24.w300 && r24.w1200 && r24.w1200 > 0) {
    ratio = Math.round((r24.w300 / r24.w1200) * 100) / 100;
    limite = ratio >= RATIO_VELO_ENDURANCE_MIN ? 'endurance' : ratio <= RATIO_VELO_VITESSE_MAX ? 'vitesse' : 'equilibre';
  }

  const passe: string[] = [];
  if (vie && avaitFait) {
    if (vie.premiereSortie) passe.push(`Tu fais du ${nom} depuis ${vie.premiereSortie.slice(0, 4)} : ${vie.sorties} séances et ${Math.round(vie.heuresTotal)} h au total.`);
    const top = [...vie.annees].sort((a, b) => b.heures - a.heures)[0];
    if (top && vie.annees.length > 1) passe.push(`Ta plus grosse année de ${nom} : ${top.annee} (${fr(top.heures)} h, ${top.sorties} séances).`);
    if (vie.plusGrosseSemaine) passe.push(`Ta plus grosse semaine de ${nom} : ${hm(vie.plusGrosseSemaine.minutes)} en ${vie.plusGrosseSemaine.sorties} séance${vie.plusGrosseSemaine.sorties > 1 ? 's' : ''} (semaine du ${vie.plusGrosseSemaine.du}).`);
    if (vie.plusLongueSortie) passe.push(`Ta plus longue séance : ${hm(vie.plusLongueSortie.minutes)}${vie.plusLongueSortie.km ? ` (${fr(vie.plusLongueSortie.km)} km)` : ''} le ${vie.plusLongueSortie.date}.`);
    if (vie.arrets.length) { const a = vie.arrets[vie.arrets.length - 1]; passe.push(`Tu as fait ${vie.arrets.length} arrêt${vie.arrets.length > 1 ? 's' : ''} de plus de 6 semaines${vie.arrets.length > 1 ? ' (le plus récent' : ' ('} du ${a.du} au ${a.au}).`); }
    if (vie.joursDepuisDerniere !== null && vie.joursDepuisDerniere >= 42) passe.push(`Ta dernière séance de ${nom} remonte à ${vie.joursDepuisDerniere} jours (${vie.derniereSortie}).`);
    if (sport === 'velo' && vie.velo) {
      const a = vie.velo.parAnnee;
      if (r24 && r24.w1200) passe.push(`Tes meilleures puissances sur 24 mois : ${r24.w5 ? `${Math.round(r24.w5)} W sur 5 s, ` : ''}${r24.w300 ? `${Math.round(r24.w300)} W sur 5 min, ` : ''}${Math.round(r24.w1200)} W sur 20 min${r24.w3600 ? `, ${Math.round(r24.w3600)} W sur 1 h` : ''}.`);
      const premier = a.find((x) => x.w1200 !== null);
      const dernier = [...a].reverse().find((x) => x.w1200 !== null);
      if (premier && dernier && premier.annee !== dernier.annee && premier.w1200 && dernier.w1200) {
        const ecart = Math.round(((dernier.w1200 - premier.w1200) / premier.w1200) * 100);
        passe.push(ecart > 1 ? `Ta puissance sur 20 min a progressé de ${ecart} % entre ${premier.annee} et ${dernier.annee}.` : ecart < -1 ? `Ta puissance sur 20 min est ${Math.abs(ecart)} % plus basse en ${dernier.annee} qu'en ${premier.annee}.` : `Ta puissance sur 20 min est stable depuis ${premier.annee}.`);
      }
      if (limite && ratio !== null) passe.push(limite === 'endurance'
        ? `Ta puissance de 5 min est très haute par rapport à celle de 20 min (rapport ${fr(ratio)}) : c'est ta puissance soutenue (seuil, endurance) qu'il faut construire.`
        : limite === 'vitesse'
          ? `Ta puissance de 5 min est proche de celle de 20 min (rapport ${fr(ratio)}) : tu tiens bien l'effort long, c'est ta puissance de pointe (VO2max) qu'il faut travailler.`
          : `Ta puissance de 5 min et de 20 min sont équilibrées (rapport ${fr(ratio)}).`);
    }
    if (sport === 'natation' && vie.natation?.recent24) {
      const n = vie.natation.recent24;
      if (n.court100 || n.long100) passe.push(`Tes meilleures allures de séance au 100 m sur 24 mois (repos compris) : ${n.court100 ? `${alure100(n.court100)} en séance courte` : ''}${n.court100 && n.long100 ? ', ' : ''}${n.long100 ? `${alure100(n.long100)} en séance longue` : ''}.`);
    }
  }

  const inconnues: Inconnue[] = [];
  if (etat === 'reprise' && vie) inconnues.push({ sujet: `je ne sais pas pourquoi tu as arrêté le ${nom} il y a ${vie.joursDepuisDerniere} jours (blessure, vie, envie)`, question: `Pourquoi as-tu arrêté le ${nom}, et ton corps est-il prêt (douleur, gêne) ?` });
  if (sport === 'velo' && etat !== 'debutant' && limite === null) {
    inconnues.push({ sujet: "je ne peux pas dire si c'est ta puissance de pointe ou ta puissance soutenue qui te limite : je n'ai pas assez de séances avec capteur de puissance sur 24 mois", question: "As-tu un capteur de puissance, ou un test de 20 minutes à fond récent (ta FTP) ?" });
  }
  if (sport === 'natation' && etat !== 'debutant') {
    inconnues.push({ sujet: "je ne peux pas dire ce qui te limite en natation : l'allure d'une séance contient les repos et les exercices, trop bruitée pour conclure", question: "As-tu un temps récent sur 400 m et sur 200 m (ou un test de vitesse critique) ?" });
  }

  const phrases: string[] = [];
  if (etat === 'debutant') phrases.push(`Je n'ai aucune séance de ${nom} dans ton compte : on part de zéro, en douceur.`);
  else if (etat === 'reprise') phrases.push(`Tu reprends le ${nom} : aucune séance depuis 90 jours.`);
  else phrases.push(`Tu fais du ${nom} en ce moment : ${r90.sorties} séance${r90.sorties > 1 ? 's' : ''} sur les 90 derniers jours, ${Math.round(r90.minutes / r90.sorties)} min en moyenne.`);

  return {
    sport, etat,
    picSemaineMinutes: vie?.plusGrosseSemaine?.minutes ?? null,
    picSemaineSeances: vie?.plusGrosseSemaine?.sorties ?? null,
    plusLongueVieMinutes: vie?.plusLongueSortie?.minutes ?? null,
    moyenne90Minutes: r90.sorties > 0 ? Math.round(r90.minutes / r90.sorties) : null,
    plusLongue90Minutes: r90.plusLongueMinutes > 0 ? r90.plusLongueMinutes : null,
    ratio5sur20: ratio, limite, passe, inconnues, phrases: [...phrases, ...passe],
  };
}

/** Les jours entre deux dates (utilitaire pour les tests) */
export const joursEntre = ecartJours;
