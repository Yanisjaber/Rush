import { allureFenetre, arrets, debutDerive, percentile, tempsParZoneCoeur } from './flux.ts';
import type { Flux1Hz } from './flux.ts';
import { alignementFiable, comparerGlobal, intentionDuPlan, jugerParDetection, mesurerSegments, partIntervalles, resumerBlocs, segmentsPlan } from './plan.ts';
import type { Intention, PrevueAnalyse, RefsPlan, ResumeBloc } from './plan.ts';

// L'analyse d'une sortie : une suite de règles qui cherchent ce qui compte (l'objectif tenu ou non, le départ, les blocs du plan, la dérive et son début, les écarts au prévu, la fiabilité des données),
// chacune produit un constat avec une priorité ; on garde les plus importants et on les écrit en lignes courtes. Pas de récit : chaque ligne apporte un fait qui ne se lit pas à l'œil, ou un écart à ce qui était prévu.
// Fonctions pures : aucun écran, aucun réseau, aucun modèle de langage. Seuils : des conventions de lecture (nommées ci-dessous), sauf la dérive de 5 % (repère d'endurance solide, voir derive-cardiaque.ts).

export type TypeSortie = 'footing' | 'fractionne' | 'longue' | 'competition' | 'autre';

export interface EntreeAnalyse {
  famille: 'course' | 'velo';
  type: TypeSortie;
  flux: Flux1Hz | null;
  dureeS: number | null;
  /** Distance (km) et dénivelé positif (m). */
  distanceKm: number | null;
  deniveleM: number | null;
  /** Dérive cardiaque en % (positif = le cœur a monté), null sans flux ou trop court. */
  derivePct: number | null;
  /** Le début de chaque zone de cœur (bpm), du plus bas au plus haut ; null sans référence de cœur. */
  zonesCardio: number[] | null;
  zonesEstimees: boolean;
  /** La FC max du profil (réelle), null si non renseignée. */
  hrMaxProfil: number | null;
  /** La puissance vient d'un capteur ; false = estimée par Strava ; null = inconnu. */
  wattsMesures: boolean | null;
  tss: number | null;
  prevue: PrevueAnalyse | null;
  refs: RefsPlan;
}

export interface LigneAnalyse {
  label: string;
  texte: string;
}

/** Le compte rendu à la façon d'un coach : un titre qui dit l'essentiel, puis 3 ou 4 phrases courtes. */
export interface CompteRendu {
  titre: string;
  phrases: string[];
}

export interface Analyse {
  lignes: LigneAnalyse[];
  /** Le compte rendu écrit (null si on n'a rien à dire). */
  compteRendu: CompteRendu | null;
  /** La seule chose à retenir pour la prochaine fois (null si aucune consigne chiffrée n'est justifiée). */
  aFaire: string | null;
  /** La séance prévue a servi à juger. */
  avecPlan: boolean;
}

interface Constat {
  code: string;
  priorite: number;
  label: string;
  texte: string;
  action?: string;
  /** Les chiffres bruts, pour que le compte rendu les remette en phrases. */
  faits?: Record<string, number | string | null>;
}

// --- Seuils (conventions de lecture) ------------------------------------------------------------------------------------
/** Une sortie facile : au moins 70 % du temps en zones 1 et 2. */
const FACILE_PART_ZONES_12 = 0.7;
/** Une sortie facile « un cran trop haute » devient « ratée » quand le quart du temps est en zone 4 ou plus. */
const FACILE_RATE_PART_ZONES_45 = 0.25;
/** Un tempo : au moins la moitié du temps en zone 3. */
const MODERE_PART_ZONE_3 = 0.5;
/** Départ trop rapide : les premières minutes plus rapides de 4 % que le reste. */
const DEPART_ECART = 0.04;
/** Une moitié plus lente (ou plus rapide) de 3 % que l'autre. */
const TENDANCE_ECART = 0.03;
/** Écart au plan à partir duquel on le dit. */
const ECART_PLAN = 0.1;
/** Dérive : jusqu'à 5 % endurance solide ; au-delà de 10 % le cœur a nettement monté. */
const DERIVE_SOLIDE = 5;
const DERIVE_FORTE = 10;
/** Arrêts cumulés à partir desquels on les signale (s). */
const ARRETS_MINI_S = 60;

// --- Formats ----------------------------------------------------------------------------------------------------------------
const allure = (s: number) => {
  const t = Math.round(s);
  return `${Math.floor(t / 60)}'${String(t % 60).padStart(2, '0')}"`;
};
const duree = (s: number) => allure(s);
const nombre = (n: number, d = 0) => n.toFixed(d).replace('.', ',');
const signe = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');
const pct = (part: number) => Math.round(part * 100);
const km = (k: number) => nombre(k, 1);

/** La valeur d'une cible ou d'une mesure, avec son unité. */
function valeur(metric: 'pace' | 'hr' | 'power', v: number): string {
  return metric === 'pace' ? `${allure(v)}/km` : metric === 'hr' ? `${Math.round(v)} bpm` : `${Math.round(v)} W`;
}
function cible(metric: 'pace' | 'hr' | 'power', bas: number, haut: number): string {
  if (Math.abs(haut - bas) < 1) return valeur(metric, bas);
  const u = metric === 'pace' ? '/km' : metric === 'hr' ? ' bpm' : ' W';
  const f = (x: number) => (metric === 'pace' ? allure(x) : String(Math.round(x)));
  return `${f(bas)} à ${f(haut)}${u}`;
}

const NOM_TYPE: Record<TypeSortie, string> = { footing: 'Footing', fractionne: 'Fractionné', longue: 'Sortie longue', competition: 'Compétition', autre: 'Sortie' };

/** Ce qu'on attend de la sortie : la séance prévue d'abord, le nom ensuite (un footing ou une sortie longue sont faciles ; le reste ne dit rien). */
function intentionDeLaSortie(e: EntreeAnalyse): { intention: Intention | null; source: 'plan' | 'nom' | null } {
  if (e.prevue) {
    const i = intentionDuPlan(e.prevue);
    if (i) return { intention: i, source: 'plan' };
  }
  if (e.type === 'footing' || e.type === 'longue') return { intention: 'facile', source: 'nom' };
  return { intention: null, source: null };
}

/** Une sortie « à intervalles » : un fractionné, ou un plan dont le tiers au moins du temps est en intervalles. Quelques lignes droites dans un footing n'en font pas un fractionné. */
const PART_INTERVALLES_MINI = 0.35;
function aDesIntervalles(e: EntreeAnalyse): boolean {
  if (e.type === 'fractionne') return true;
  const s = e.prevue?.structure;
  return Array.isArray(s) && e.prevue ? partIntervalles(s, e.prevue.sport) >= PART_INTERVALLES_MINI : false;
}

// --- Les règles -----------------------------------------------------------------------------------------------------------------

function verdictIntention(e: EntreeAnalyse, zones: number[] | null): Constat | null {
  const { intention, source } = intentionDeLaSortie(e);
  if (!intention || !zones || !e.zonesCardio) return null;
  if (aDesIntervalles(e)) return null; // les blocs du plan sont jugés un par un
  const total = zones.reduce((a, b) => a + b, 0);
  if (total < 300) return null;
  const p12 = (zones[0] + (zones[1] ?? 0)) / total;
  const p3 = (zones[2] ?? 0) / total;
  const p45 = zones.slice(3).reduce((a, b) => a + b, 0) / total;
  // Le type, pas le nom de la séance prévue (« Course · Footing 30 min + 6 lignes droites » est trop long pour une ligne)
  const nom = e.type === 'autre' ? (intention === 'facile' ? 'Séance facile' : 'Séance') : NOM_TYPE[e.type];
  const haut = e.zonesCardio[2] != null ? Math.round(e.zonesCardio[2]) - 1 : null; // le haut de la zone 2
  const reserve = e.zonesEstimees ? ' (zones estimées)' : '';
  if (intention === 'facile') {
    if (p12 >= FACILE_PART_ZONES_12) return { code: 'objectif_tenu', priorite: 30, label: 'Objectif', texte: `${nom} tenu : ${pct(p12)} % du temps en zones 1 et 2.${reserve}` };
    const action = haut ? `Au prochain footing, reste sous ${haut} bpm même si ça paraît lent.` : undefined;
    if (p45 < FACILE_RATE_PART_ZONES_45) return { code: 'objectif_un_cran', priorite: 60, label: 'Objectif', texte: `${nom} un cran trop haut : ${pct(p3)} % en zone 3, seulement ${pct(p12)} % en zones 1 et 2.${reserve}`, action };
    return { code: 'objectif_rate', priorite: 90, label: 'Objectif', texte: `${nom} raté : ${pct(p45)} % du temps en zone 4 ou plus, ${pct(p12)} % en zones 1 et 2.${reserve}`, action };
  }
  if (intention === 'modere') {
    if (p3 >= MODERE_PART_ZONE_3) return { code: 'objectif_tenu', priorite: 30, label: 'Objectif', texte: `${nom} tenu : ${pct(p3)} % du temps en zone 3.${reserve}` };
    if (p12 >= 0.5) return { code: 'objectif_trop_facile', priorite: 55, label: 'Objectif', texte: `${nom} trop facile : ${pct(p12)} % du temps en zones 1 et 2, ${pct(p3)} % en zone 3.${reserve}` };
    return { code: 'objectif_trop_dur', priorite: 65, label: 'Objectif', texte: `${nom} trop dur : ${pct(p45)} % du temps en zone 4 ou plus, ${pct(p3)} % en zone 3.${reserve}` };
  }
  return null;
}

function blocsDuPlan(e: EntreeAnalyse): Constat[] {
  const f = e.flux;
  const struct = e.prevue?.structure;
  if (!f || !e.prevue || !Array.isArray(struct) || !struct.length) return [];
  const segs = segmentsPlan(struct, e.refs, e.prevue.sport);
  if (!segs.length) return [];
  // Le chrono suit le plan : on juge bloc par bloc sur les fenêtres de temps. Sinon on retrouve les efforts dans le flux.
  const chrono = alignementFiable(f, segs);
  const blocs: ResumeBloc[] = chrono ? resumerBlocs(mesurerSegments(f, segs)) : jugerParDetection(f, segs);
  const sansCible = blocs.filter((b) => b.bas == null);
  if (!blocs.length || sansCible.length === blocs.length) {
    const metrique = segs.find((s) => s.role === 'travail')?.metric ?? 'pace';
    const manque = metrique === 'pace' ? 'ta vitesse seuil' : metrique === 'hr' ? 'ta FC max' : 'ta FTP';
    const prevu = segs.reduce((n, s) => Math.max(n, s.debutS + s.dureeS), 0);
    const sansRef = segs.some((s) => s.role === 'travail' && s.bas == null);
    if (sansRef) return [{ code: 'plan_sans_cible', priorite: 30, label: 'Plan', texte: `Les cibles du plan ne se chiffrent pas : il manque ${manque} dans ton profil.`, action: `Renseigne ${manque} dans Paramètres › Zones.` }];
    return [{ code: 'plan_decale', priorite: 35, label: 'Plan', texte: `Le chrono ne suit pas le plan (${duree(f.n)} faits, ${duree(prevu)} prévus) et je n'ai pas retrouvé ses efforts : je ne juge pas bloc par bloc.` }];
  }
  const sortie: Constat[] = [];
  for (const b of blocs) {
    if (b.bas == null || b.haut == null || !b.evaluees) {
      if (b.detectees === 0) sortie.push({ code: 'bloc_absent', priorite: 85, label: 'Plan', texte: `${b.nom} : aucune retrouvée sur ${b.nbReps}, pas assez rapides ou pas faites.`, action: b.bas ? `Pour les prochaines : ${valeur(b.metric, b.bas)}, ${Math.round(b.nbReps)} fois, en relâchant bien entre chaque.` : undefined });
      continue;
    }
    const c = cible(b.metric, b.bas, b.haut);
    const plur = (n: number) => `${n} répétition${n > 1 ? 's' : ''}`;
    // Un bloc continu jugé sans chrono : une phrase, l'écart en clair
    if (b.type === 'steady' && b.nbReps === 1 && b.premiere != null) {
      if (b.dans === 1) {
        sortie.push({ code: 'bloc_tenu', priorite: 40, label: 'Plan', texte: `${b.nom} : tenu, ${valeur(b.metric, b.premiere)} pour ${c} visés.`, faits: { reel: valeur(b.metric, b.premiere), cible: c } });
      } else {
        const unite = b.metric === 'pace' ? ' s/km' : b.metric === 'hr' ? ' bpm' : ' W';
        const sens = b.horsCible === 'trop_vite' ? 'trop vite' : b.horsCible === 'trop_lent' ? 'trop lent' : b.horsCible === 'trop_haut' ? 'trop haut' : 'trop bas';
        const action = b.horsCible === 'trop_vite' ? `Vise ${c} : ralentis, même si ça paraît trop facile.` : b.horsCible === 'trop_lent' ? `Vise ${c} : tu as de la marge pour aller un peu plus vite.` : undefined;
        sortie.push({ code: 'bloc_rate', priorite: 72, label: 'Plan', texte: `${b.nom} : ${valeur(b.metric, b.premiere)} au lieu de ${c} (${b.ecart}${unite} ${sens}).`, action, faits: { reel: valeur(b.metric, b.premiere), cible: c, sens: b.horsCible ?? null, continu: 1 } });
      }
      continue;
    }
    const evol = b.premiere != null && b.derniere != null && b.evaluees > 1 ? ` La 1re à ${valeur(b.metric, b.premiere)}, la dernière à ${valeur(b.metric, b.derniere)}.` : '';
    const sens = b.horsCible === 'trop_vite' ? 'trop vite' : b.horsCible === 'trop_lent' ? 'trop lent' : b.horsCible === 'trop_haut' ? 'trop haut' : b.horsCible === 'trop_bas' ? 'trop bas' : null;
    const manquantes = b.detectees != null && b.detectees < b.nbReps ? ` ${b.nbReps - b.detectees} manquante${b.nbReps - b.detectees > 1 ? 's' : ''}.` : '';
    const action = b.horsCible === 'trop_lent' || b.horsCible === 'trop_bas' ? "Raccourcis la dernière répétition ou allonge la récup d'une minute." : b.horsCible ? `Vise ${c} dès la première répétition, pas plus fort.` : undefined;
    sortie.push({
      code: 'bloc_rate',
      priorite: 85,
      label: 'Plan',
      texte: `${b.nom} : ${b.detectees != null ? `${b.detectees} retrouvée${b.detectees > 1 ? 's' : ''} sur ${b.nbReps}, ${b.dans} dans la cible` : `${plur(b.dans)} sur ${b.nbReps} dans la cible`} (${c})${sens ? `, les autres ${sens}` : ''}.${evol}${manquantes}`,
      action,
    });
  }
  return sortie;
}

function ecartsAuPlan(e: EntreeAnalyse): Constat | null {
  if (!e.prevue) return null;
  const g = comparerGlobal(e.prevue, { moving_time: e.dureeS, distance_km: e.distanceKm, tss: e.tss });
  if (!g.length) return null;
  const gros = g.filter((x) => Math.abs(x.ecartPct) >= ECART_PLAN * 100);
  if (!gros.length) return { code: 'plan_conforme', priorite: 20, label: 'Prévu', texte: `Conforme au plan : ${g.map((x) => (x.cle === 'duree' ? 'durée' : x.cle === 'km' ? 'distance' : 'charge')).join(', ')} à moins de 10 % près.` };
  const morceaux = gros.map((x) => {
    const e100 = `${signe(x.ecartPct)}${nombre(Math.abs(x.ecartPct), 0)} %`;
    if (x.cle === 'duree') return `durée ${duree(x.fait * 60)} au lieu de ${duree(x.prevu * 60)} (${e100})`;
    if (x.cle === 'km') return `distance ${km(x.fait)} km au lieu de ${km(x.prevu)} (${e100})`;
    return `charge ${Math.round(x.fait)} au lieu de ${Math.round(x.prevu)} (${e100})`;
  });
  const charge = gros.find((x) => x.cle === 'charge');
  const forte = charge && charge.ecartPct >= 25;
  const t = morceaux.join(', ');
  return { code: 'plan_ecart', priorite: forte ? 70 : 55, label: 'Prévu', texte: `${t[0].toUpperCase()}${t.slice(1)}.${forte ? ' La suite du plan tombe sur plus de fatigue que prévu.' : ''}` };
}

function depart(e: EntreeAnalyse): Constat | null {
  const f = e.flux;
  if (!f || e.famille !== 'course' || aDesIntervalles(e) || f.n < 900) return null;
  const w = Math.min(300, Math.round(f.n * 0.1));
  const debut = allureFenetre(f.v, 0, w);
  const reste = allureFenetre(f.v, w, f.n);
  if (!debut || !reste || debut >= reste * (1 - DEPART_ECART)) return null;
  const { intention } = intentionDeLaSortie(e);
  return {
    code: 'depart_rapide',
    priorite: intention === 'facile' ? 65 : 40,
    label: 'Départ',
    texte: `Trop rapide : ${allure(debut)} sur les ${Math.round(w / 60)} premières minutes, ${allure(reste)} ensuite.`,
    action: `Pars directement à ${allure(reste)}/km : c'est l'allure que tu tiens ensuite.`,
  };
}

function tendance(e: EntreeAnalyse): Constat | null {
  const f = e.flux;
  if (!f || aDesIntervalles(e) || f.n < 1200) return null;
  const m = Math.floor(f.n / 2);
  if (e.famille === 'course') {
    const a = allureFenetre(f.v, 0, m);
    const b = allureFenetre(f.v, m, f.n);
    if (!a || !b) return null;
    const ecart = (b - a) / a;
    if (ecart >= TENDANCE_ECART) return { code: 'ralentit', priorite: 50, label: 'Allure', texte: `Tu ralentis : ${allure(a)} sur la 1re moitié, ${allure(b)} sur la 2e (${Math.round(b - a)} s/km de plus).` };
    if (ecart <= -TENDANCE_ECART) return { code: 'accelere', priorite: 25, label: 'Allure', texte: `Seconde moitié plus rapide : ${allure(b)} contre ${allure(a)} sur la 1re (${Math.round(a - b)} s/km de moins).` };
    return null;
  }
  const kmh = (de: number, fin: number) => {
    let s = 0;
    for (let i = de; i < fin; i++) s += f.v[i];
    return (s / (fin - de)) * 3.6;
  };
  const a = kmh(0, m);
  const b = kmh(m, f.n);
  if (!(a > 0)) return null;
  const ecart = (b - a) / a;
  if (ecart <= -TENDANCE_ECART) return { code: 'ralentit', priorite: 50, label: 'Allure', texte: `Tu ralentis : ${nombre(a, 1)} km/h sur la 1re moitié, ${nombre(b, 1)} sur la 2e.` };
  if (ecart >= TENDANCE_ECART) return { code: 'accelere', priorite: 25, label: 'Allure', texte: `Seconde moitié plus rapide : ${nombre(b, 1)} km/h contre ${nombre(a, 1)}.` };
  return null;
}

function derive(e: EntreeAnalyse): Constat | null {
  if (e.derivePct == null || aDesIntervalles(e)) return null;
  const d = e.derivePct;
  const debut = e.flux ? debutDerive(e.flux, e.famille === 'velo' && e.flux.w.some((x) => x > 0) && e.wattsMesures ? 'puissance' : 'vitesse') : null;
  const ou = debut ? `, dès le km ${km(debut.km)}` : '';
  const faits = { d, km: debut ? debut.km : null };
  if (d <= DERIVE_SOLIDE) return { faits, code: 'derive_ok', priorite: 25, label: 'Cœur', texte: `Dérive de ${signe(d)}${nombre(Math.abs(d), 1)} % : endurance solide (moins de 5 %).` };
  if (d <= DERIVE_FORTE) return { faits, code: 'derive_moyenne', priorite: 55, label: 'Cœur', texte: `Dérive de +${nombre(d, 1)} % (au-delà de 5 %)${ou} : le cœur a monté à allure égale.` };
  return { faits, code: 'derive_forte', priorite: 75, label: 'Cœur', texte: `Dérive de +${nombre(d, 1)} % (au-delà de 10 %)${ou} : le cœur a nettement monté à allure égale.` };
}

function arretsC(e: EntreeAnalyse): Constat | null {
  if (!e.flux) return null;
  const liste = arrets(e.flux);
  const total = liste.reduce((n, a) => n + a.dureeS, 0);
  if (total < ARRETS_MINI_S) return null;
  const long = [...liste].sort((a, b) => b.dureeS - a.dureeS)[0];
  return { code: 'arrets', priorite: total >= 180 ? 45 : 30, label: 'Arrêts', texte: `${duree(total)} d'arrêts cumulés${liste.length > 1 ? ` en ${liste.length} fois` : ''}, le plus long (${duree(long.dureeS)}) au km ${km(long.km)}.` };
}

function fcMax(e: EntreeAnalyse): Constat | null {
  if (!e.flux || !e.hrMaxProfil) return null;
  const p = percentile(e.flux.fc, 0.995);
  if (p == null || p < e.hrMaxProfil) return null;
  return { code: 'fcmax_basse', priorite: 80, label: 'Données', texte: `Ton cœur est monté à ${Math.round(p)} bpm, au-dessus de ta FC max enregistrée (${Math.round(e.hrMaxProfil)}) : elle est trop basse et tes zones sont décalées.`, action: `Mets ta FC max à environ ${Math.round(p)} bpm dans Paramètres › Zones.` };
}

function zonesEstimees(e: EntreeAnalyse): Constat | null {
  if (!e.zonesEstimees || !e.zonesCardio) return null;
  return { code: 'zones_estimees', priorite: 50, label: 'Données', texte: 'Tes zones de cœur reposent sur une FC max estimée : le temps par zone est approximatif.', action: 'Renseigne ta FC max réelle dans Paramètres › Zones.' };
}

function wattsEstimes(e: EntreeAnalyse): Constat | null {
  if (!e.flux || e.famille !== 'course' || !e.flux.w.some((x) => x > 0) || e.wattsMesures === true) return null;
  return { code: 'watts_estimes', priorite: 35, label: 'Données', texte: 'Puissance estimée par Strava en course : à ignorer, la charge qui en vient est approximative.' };
}

function coeurAbsent(e: EntreeAnalyse): Constat | null {
  if (!e.flux || e.flux.fc.some((x) => x > 0)) return null;
  return { code: 'coeur_absent', priorite: 40, label: 'Données', texte: "Pas de cœur sur cette sortie : l'intensité ne se juge que sur l'allure." };
}

function irregularite(e: EntreeAnalyse): Constat | null {
  const f = e.flux;
  if (!f || e.famille !== 'course' || aDesIntervalles(e) || f.n < 1200) return null;
  const { intention } = intentionDeLaSortie(e);
  if (intention === 'dur') return null;
  const hilly = e.deniveleM != null && e.distanceKm ? e.deniveleM / e.distanceKm > 15 : false;
  if (hilly) return null;
  const tranches: number[] = [];
  for (let a = 0; a + 120 <= f.n; a += 120) {
    const p = allureFenetre(f.v, a, a + 120);
    if (p) tranches.push(p);
  }
  if (tranches.length < 8) return null;
  const moy = tranches.reduce((s, x) => s + x, 0) / tranches.length;
  const ecartType = Math.sqrt(tranches.reduce((s, x) => s + (x - moy) ** 2, 0) / tranches.length);
  if (ecartType / moy < 0.07) return null;
  return { code: 'irregulier', priorite: 35, label: 'Allure', texte: `Allure irrégulière : ±${Math.round(ecartType)} s/km d'un bloc de 2 minutes à l'autre sur un terrain plat.` };
}


// --- Le compte rendu écrit --------------------------------------------------------------------------------------------------------

const NOM_AVEC_ARTICLE: Record<TypeSortie, string> = { footing: 'un footing', longue: 'une sortie longue', fractionne: 'un fractionné', competition: 'une compétition', autre: 'une sortie facile' };
const NOM_COURT: Record<TypeSortie, string> = { footing: 'footing', longue: 'sortie longue', fractionne: 'fractionné', competition: 'compétition', autre: 'sortie' };

/** La phrase du cœur : ce que la dérive dit, dans les mots d'un coach. */
function phraseCoeur(c: Constat): string | null {
  const d = Number(c.faits?.d);
  const kmDebut = c.faits?.km != null ? Number(c.faits.km) : null;
  if (!Number.isFinite(d)) return null;
  const ou = kmDebut ? ` dès le km ${km(kmDebut)}` : '';
  if (c.code === 'derive_forte') return `Ton cœur l'a payé : il a dérivé de ${nombre(d, 0)} %${ou}, à allure égale.`;
  if (c.code === 'derive_moyenne') return `Ton cœur a monté de ${nombre(d, 0)} %${ou} à allure égale.`;
  return `Cœur stable : ${nombre(Math.max(d, 0), 0)} % de dérive, endurance solide.`;
}

/**
 * Ce qu'un coach écrirait : le message principal de la séance (trop vite, bien tenue, cibles ratées…), puis ce qu'il a coûté, puis l'écart au plan.
 * Le moteur choisit UN message, pas une liste ; les constats secondaires ne passent que s'ils sont graves. Quatre phrases au plus.
 */
function redigerCompteRendu(e: EntreeAnalyse, constats: Constat[], zones: number[] | null): CompteRendu | null {
  if (!constats.length) return null;
  const par = (code: string) => constats.find((c) => c.code === code);
  const utilises = new Set<string>();
  const phrases: string[] = [];
  const dire = (code: string, texte: string | null) => {
    if (texte) {
      phrases.push(texte);
      utilises.add(code);
    }
  };
  const { intention } = intentionDeLaSortie(e);
  const objectif = constats.find((c) => c.code.startsWith('objectif_'));
  const continu = constats.find((c) => c.code.startsWith('bloc_') && c.faits?.continu);
  const coeur = constats.find((c) => c.code.startsWith('derive_'));
  const total = zones ? zones.reduce((a, b) => a + b, 0) : 0;
  const p12 = zones && total ? (zones[0] + (zones[1] ?? 0)) / total : 0;
  const p3 = zones && total ? (zones[2] ?? 0) / total : 0;
  const p45 = zones && total ? zones.slice(3).reduce((a, b) => a + b, 0) / total : 0;
  const mot = NOM_COURT[e.type];
  let titre = '';

  if (intention === 'facile' && objectif && objectif.code !== 'objectif_tenu') {
    // Une séance faite plus fort que prévu : un seul message, la cause d'abord
    const vite = continu?.code === 'bloc_rate' && continu.faits?.sens === 'trop_vite';
    titre = vite ? `Trop vite pour ${NOM_AVEC_ARTICLE[e.type]}` : `Trop dur pour ${NOM_AVEC_ARTICLE[e.type]}`;
    if (vite && continu) dire(continu.code, `Ton ${mot} devait rester facile, à ${continu.faits?.cible}. Tu l'as fait à ${continu.faits?.reel}, trop vite.`);
    else dire(objectif.code, `Ton ${mot} devait rester facile, mais ${p45 >= FACILE_RATE_PART_ZONES_45 ? `${pct(p45)} % du temps s'est passé en zone 4 ou plus` : `${pct(p3)} % du temps s'est passé en zone 3`}.`);
    utilises.add(objectif.code);
    const dep = par('depart_rapide');
    if (dep && !vite) dire(dep.code, dep.texte.replace(/^Trop rapide/, 'Départ trop rapide'));
    if (coeur && coeur.code !== 'derive_ok') dire(coeur.code, phraseCoeur(coeur));
  } else if ((intention === 'facile' || intention === 'modere') && objectif) {
    titre = intention === 'facile' ? `${mot[0].toUpperCase()}${mot.slice(1)} bien tenu` : 'Allure modérée tenue';
    dire(objectif.code, intention === 'facile' ? `Tu es resté tranquille : ${pct(p12)} % du temps en zones 1 et 2.` : `Tu as tenu l'allure : ${pct(p3)} % du temps en zone 3.`);
    if (coeur) dire(coeur.code, phraseCoeur(coeur));
    const dep = par('depart_rapide');
    if (dep) dire(dep.code, dep.texte.replace(/^Trop rapide/, 'Départ un peu rapide'));
  } else {
    // Séance à intervalles, ou rien de précis à juger : on prend les constats les plus lourds, en phrases
    const rates = constats.filter((c) => c.code === 'bloc_rate' || c.code === 'bloc_absent');
    titre = rates.length ? 'Les cibles du plan ne sont pas tenues' : constats.some((c) => c.code === 'bloc_tenu') ? 'Plan tenu' : 'À retenir de la séance';
    for (const c of [...constats].filter((x) => x.priorite >= 30 && x.label !== 'Données').sort((a, b) => b.priorite - a.priorite).slice(0, 3)) {
      dire(c.code, c.code.startsWith('derive_') ? phraseCoeur(c) : c.texte);
    }
  }

  // Ce que ça a coûté par rapport au prévu, puis les problèmes de données graves
  const ecart = par('plan_ecart');
  if (ecart && !utilises.has(ecart.code)) dire(ecart.code, ecart.texte);
  for (const c of constats.filter((x) => x.priorite >= 80 && !utilises.has(x.code)).sort((a, b) => b.priorite - a.priorite)) dire(c.code, c.texte);
  return phrases.length ? { titre, phrases: phrases.slice(0, 4) } : null;
}

/** Analyse la sortie : les constats les plus importants (5 au plus), en lignes courtes, et la consigne à retenir. */
export function analyserSortie(e: EntreeAnalyse): Analyse {
  const zones = e.flux && e.zonesCardio ? tempsParZoneCoeur(e.flux, e.zonesCardio) : null;
  const constats: Constat[] = [];
  const pousser = (c: Constat | Constat[] | null) => {
    if (!c) return;
    constats.push(...(Array.isArray(c) ? c : [c]));
  };
  pousser(verdictIntention(e, zones));
  pousser(blocsDuPlan(e));
  pousser(ecartsAuPlan(e));
  pousser(depart(e));
  pousser(tendance(e));
  pousser(derive(e));
  pousser(irregularite(e));
  pousser(arretsC(e));
  pousser(fcMax(e));
  pousser(zonesEstimees(e));
  pousser(wattsEstimes(e));
  pousser(coeurAbsent(e));

  const gardes = [...constats].sort((a, b) => b.priorite - a.priorite).slice(0, 5);
  const lignes = gardes.map((c) => ({ label: c.label, texte: c.texte }));
  const aFaire = gardes.find((c) => c.action && c.priorite >= 50)?.action ?? null;
  return { lignes, compteRendu: redigerCompteRendu(e, constats, zones), aFaire, avecPlan: !!e.prevue };
}

