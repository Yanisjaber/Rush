// ============================================================
// Replanification : modifier le planning à partir d'une phrase (docs/ia/PLAN_COACH_COMPLET.md).
//
// Le modèle TRADUIT la phrase de l'utilisateur en contraintes (« blessé 10 jours », « pas de vélo cette semaine », « je pars
// jeudi et vendredi ») ou en opérations simples (« décale ma sortie de demain à jeudi »). Le CODE décide : ce module calcule
// quoi déplacer, supprimer ou garder, avec les mêmes règles que le validateur, puis vérifie le plan entier avant qu'il
// devienne une carte. Rien ne s'écrit ici : la carte est validée par l'utilisateur, puis appliquée (docs/ia/CADRAGE_IA.md).
//
// Règle dure : un plan qui laisse une séance un jour de maladie, de blessure ou d'indisponibilité qu'il vient de déclarer
// est REFUSÉ. On ne peut pas déclarer une blessure et oublier les séances de la semaine.
// ============================================================
import { resumeStructure, structureSeance } from './structure-seance.ts';
import type { BlocStructure } from './structure-seance.ts';
import { ajouterJours, dateValide, ecartJours, entre } from './dates-iso.ts';
import { estFamilleCoach, MENU } from './menu-seances.ts';
import { estSeanceDure, HORIZON_TECHNIQUE_JOURS, validerDeplacement, validerSeance } from './validateur.ts';
import type { ContexteValidation, Proposition } from './validateur.ts';

export type TypeIndispo = 'maladie' | 'blessure' | 'indisponible';

export type Operation =
  | { op: 'indisponibilite'; type: TypeIndispo; du: string; au: string; raison?: string }
  | { op: 'deplacer'; seanceId: string; vers: string; raison?: string }
  | { op: 'supprimer'; seanceId: string; raison?: string }
  /** Poser (ou retirer) un jour de repos */
  | { op: 'repos'; date: string; poser: boolean; raison?: string }
  | { op: 'ajouter'; proposition: Proposition; justification: string; raison?: string; detail?: DetailSeance; phase?: string };

/**
 * Le contenu réel d'une séance bâtie par un moteur de plan (course visée) : un nom qui dit ce qu'on fait (« 6 × 400 m à 4:23/km »),
 * ses blocs avec allures chiffrées et une phrase. S'il est absent, la structure générique du type est utilisée.
 */
export interface DetailSeance {
  nom: string;
  structure: BlocStructure[];
  resume: string;
}

/** Une séance déjà prévue au calendrier (prevues du résumé) */
export interface SeancePrevue {
  id: string;
  date: string;
  sport: string | null;
  minutes: number | null;
  tss: number | null;
  creeeParIa: boolean;
}

/** Un plan peut être long (un an, environ 250 séances) : la limite de 16 opérations a été supprimée le 8 nov. 2026. Garde-fou technique seulement. */
export const MAX_OPERATIONS = 600;
/** La charge « prévue » d'un plan est montrée sur ce nombre de jours (une mesure d'affichage, pas une limite) */
export const FENETRE_CHARGE_JOURS = 14;
/** Jusqu'où le moteur cherche un jour libre pour déplacer une séance après un imprévu */
export const HORIZON_REPLANIFICATION_JOURS = 60;
/** Une période déclarée dure 60 jours au plus, et peut commencer jusqu'à 14 jours avant aujourd'hui (« blessé depuis lundi ») */
export const MAX_JOURS_INDISPO = 60;
export const MAX_JOURS_ARRIERE = 14;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------- Lecture du résumé ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Libre = any;

/** Les séances prévues du résumé, avec leur identifiant. Une ligne sans identifiant valide ou sans date est ignorée. */
export function seancesDepuisResume(resume: Libre): SeancePrevue[] {
  const liste = Array.isArray(resume?.prevues) ? resume.prevues : [];
  const out: SeancePrevue[] = [];
  for (const p of liste) {
    if (typeof p?.id !== 'string' || !UUID.test(p.id) || !dateValide(p?.date)) continue;
    out.push({
      id: p.id.toLowerCase(),
      date: p.date,
      sport: typeof p.sport === 'string' ? p.sport : null,
      minutes: typeof p.minutes === 'number' && Number.isFinite(p.minutes) ? p.minutes : null,
      tss: typeof p.tss === 'number' && Number.isFinite(p.tss) ? p.tss : null,
      creeeParIa: p.creee_par_ia === true,
    });
  }
  return out;
}

// ---------- Libellés en français ----------

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const SPORTS_NOMS: Record<string, string> = { velo: 'vélo', course: 'course', natation: 'natation', muscu: 'musculation', hyrox: 'Hyrox', triathlon: 'triathlon', duathlon: 'duathlon' };
const NOM_INDISPO: Record<TypeIndispo, string> = { maladie: 'maladie', blessure: 'blessure', indisponible: 'indisponibilité' };

/** « jeu. 13/11 » */
export function etiquetteDate(date: string): string {
  if (!dateValide(date)) return date;
  const d = new Date(`${date}T00:00:00Z`);
  return `${JOURS[d.getUTCDay()]} ${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

function libelleSeance(s: { sport: string | null; minutes: number | null }): string {
  const sport = s.sport ? (SPORTS_NOMS[s.sport] ?? 'séance') : 'séance';
  return s.minutes ? `${sport} ${s.minutes} min` : sport;
}

// ---------- Évaluation d'un plan ----------

export interface LignePlan {
  op: Operation['op'];
  texte: string;
  raison?: string;
  /**
   * De quoi DESSINER le plan dans l'application (calendrier, frise) sans relire les phrases : le sport (« velo »…), la durée,
   * le jour d'origine (`de`) et le jour d'arrivée (`vers`). Pour une période déclarée : `type`, `du` et `au`.
   */
  sport?: string | null;
  minutes?: number | null;
  de?: string;
  vers?: string;
  type?: TypeIndispo;
  du?: string;
  au?: string;
  /** Jour de repos : posé (vrai) ou retiré (faux) */
  poser?: boolean;
  /** Séance ajoutée : sa structure en une phrase (échauffement, corps, retour au calme) */
  structure?: string;
  /** Séance ajoutée : ses blocs (échauffement, répétitions, retour au calme) pour dessiner le profil d'intensité, et son nom */
  blocs?: BlocStructure[];
  nom?: string;
  /** Le but de la semaine où tombe la séance, écrit par le moteur de plan (Base, Développement, Spécifique, Affûtage, Récupération, Montée) */
  phase?: string;
}

export interface ResultatPlan {
  ok: boolean;
  /** Les raisons du refus, une phrase chacune (le modèle les lit et corrige) */
  erreurs: string[];
  avertissements: string[];
  /** L'aperçu pour l'utilisateur : une ligne par opération */
  lignes: LignePlan[];
  /** Charge prévue (points) sur les 14 prochains jours, avant et après */
  chargeAvant: number;
  chargeApres: number;
}

function chargePrevue(seances: { date: string; tss: number | null }[], aujourdhui: string): number {
  const fin = ajouterJours(aujourdhui, FENETRE_CHARGE_JOURS);
  return Math.round(seances.filter((s) => s.date >= aujourdhui && s.date <= fin).reduce((t, s) => t + (s.tss ?? 0), 0));
}

export function ctxAvec(
  base: ContexteValidation,
  restantes: { date: string; tss: number | null }[],
  indispos: ContexteValidation['indisponibilites'],
  repos: string[] = base.joursDeRepos,
): ContexteValidation {
  return { ...base, prevues: restantes.map((r) => ({ date: r.date, tss: r.tss })), indisponibilites: indispos, joursDeRepos: repos };
}

/**
 * Vérifie un plan ENTIER, opération après opération, comme s'il était appliqué. Fonction pure.
 * Les périodes d'indisponibilité du plan comptent pour toutes les opérations, quel que soit leur ordre.
 */
export function evaluerPlan(operations: Operation[], seances: SeancePrevue[], base: ContexteValidation): ResultatPlan {
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  const lignes: LignePlan[] = [];
  const echec = (ligne: string, message: string) => erreurs.push(`${ligne} : ${message}`);
  const vide = (): ResultatPlan => ({ ok: false, erreurs, avertissements, lignes, chargeAvant: 0, chargeApres: 0 });

  if (!Array.isArray(operations) || operations.length === 0) {
    erreurs.push('Le plan est vide.');
    return vide();
  }
  if (operations.length > MAX_OPERATIONS) {
    erreurs.push(`${MAX_OPERATIONS} opérations au maximum par plan : découpe en plusieurs plans.`);
    return vide();
  }

  const parId = new Map(seances.map((s) => [s.id, s]));
  const touchees = new Set<string>();
  let restantes: SeancePrevue[] = seances.map((s) => ({ ...s }));
  const chargeAvant = chargePrevue(seances, base.aujourdhui);

  // 1. Les périodes déclarées par le plan, vérifiées et appliquées d'abord
  const indispos = [...base.indisponibilites];
  const nouvelles: { type: TypeIndispo; du: string; au: string }[] = [];
  for (const o of operations) {
    if (o.op !== 'indisponibilite') continue;
    const ligne = `${NOM_INDISPO[o.type] ?? 'Période'} ${etiquetteDate(o.du)} → ${etiquetteDate(o.au)}`;
    if (!['maladie', 'blessure', 'indisponible'].includes(o.type) || !dateValide(o.du) || !dateValide(o.au)) {
      echec(ligne, 'Il faut un type (maladie, blessure, indisponible) et deux dates valides.');
    } else if (o.au < o.du) {
      echec(ligne, 'La fin doit être le même jour que le début, ou après.');
    } else if (ecartJours(o.du, o.au) + 1 > MAX_JOURS_INDISPO) {
      echec(ligne, `Une période dure ${MAX_JOURS_INDISPO} jours au plus.`);
    } else if (ecartJours(o.du, base.aujourdhui) > MAX_JOURS_ARRIERE && o.du < base.aujourdhui) {
      echec(ligne, `Le début ne peut pas remonter à plus de ${MAX_JOURS_ARRIERE} jours.`);
    } else if (o.au > ajouterJours(base.aujourdhui, MAX_JOURS_INDISPO)) {
      echec(ligne, `La fin ne peut pas dépasser ${MAX_JOURS_INDISPO} jours à partir d'aujourd'hui.`);
    } else {
      indispos.push({ type: o.type, du: o.du, au: o.au });
      nouvelles.push({ type: o.type, du: o.du, au: o.au });
    }
  }

  // 1 bis. Les jours de repos posés ou retirés par le plan, vérifiés et appliqués d'abord (comme les périodes)
  const repos = [...base.joursDeRepos];
  const reposPoses: string[] = [];
  const limite = ajouterJours(base.aujourdhui, HORIZON_TECHNIQUE_JOURS);
  for (const o of operations) {
    if (o.op !== 'repos') continue;
    const ligne = `${o.poser ? 'Poser un jour de repos' : 'Retirer le jour de repos'} : ${etiquetteDate(o.date)}`;
    if (!dateValide(o.date) || o.date < base.aujourdhui || o.date > limite) {
      echec(ligne, "le jour doit être valide, et pas dans le passé");
    } else if (o.poser) {
      if (repos.includes(o.date)) echec(ligne, 'ce jour est déjà un jour de repos');
      else if (base.competitions.some((c) => c.date === o.date)) echec(ligne, 'tu as une compétition ce jour-là');
      else {
        repos.push(o.date);
        reposPoses.push(o.date);
      }
    } else if (!repos.includes(o.date)) {
      echec(ligne, "ce jour n'est pas un jour de repos");
    } else {
      repos.splice(repos.indexOf(o.date), 1);
    }
  }

  // 2. Les autres opérations, dans l'ordre
  const surAjouts: { date: string; tss: number | null }[] = [];
  for (const o of operations) {
    if (o.op === 'indisponibilite') {
      lignes.push({ op: o.op, texte: `Déclarer : ${NOM_INDISPO[o.type] ?? 'période'} du ${etiquetteDate(o.du)} au ${etiquetteDate(o.au)}`, raison: o.raison, type: o.type, du: o.du, au: o.au });
      continue;
    }
    if (o.op === 'repos') {
      lignes.push({ op: o.op, texte: `${o.poser ? 'Poser un jour de repos' : 'Retirer le jour de repos'} : ${etiquetteDate(o.date)}`, raison: o.raison, vers: o.date, poser: o.poser });
      continue;
    }
    if (o.op === 'supprimer' || o.op === 'deplacer') {
      const s = parId.get(o.seanceId?.toLowerCase?.() ?? '');
      const verbe = o.op === 'supprimer' ? 'Supprimer' : 'Déplacer';
      if (!s) {
        lignes.push({ op: o.op, texte: `${verbe} : séance inconnue` });
        echec(verbe, "cette séance n'existe pas (ou plus) dans ton calendrier");
        continue;
      }
      const base_ = `${libelleSeance(s)} du ${etiquetteDate(s.date)}`;
      if (touchees.has(s.id)) {
        lignes.push({ op: o.op, texte: `${verbe} : ${base_}` });
        echec(`${verbe} ${base_}`, 'cette séance est déjà modifiée dans ce plan');
        continue;
      }
      touchees.add(s.id);
      if (o.op === 'supprimer') {
        restantes = restantes.filter((r) => r.id !== s.id);
        lignes.push({ op: o.op, texte: `Supprimer : ${base_}`, raison: o.raison, sport: s.sport, minutes: s.minutes, de: s.date });
        continue;
      }
      const ligne = `Déplacer : ${base_} → ${etiquetteDate(o.vers)}`;
      lignes.push({ op: o.op, texte: ligne, raison: o.raison, sport: s.sport, minutes: s.minutes, de: s.date, vers: o.vers });
      restantes = restantes.filter((r) => r.id !== s.id);
      const v = validerDeplacement(s, o.vers, ctxAvec(base, restantes, indispos, repos));
      if (!v.ok) echec(ligne, v.erreurs.map((e) => e.message).join(' '));
      for (const a of v.avertissements) avertissements.push(`${ligne} : ${a.message}`);
      restantes.push({ ...s, date: o.vers });
      continue;
    }
    // ajouter
    const p = o.proposition;
    const nom = estFamilleCoach(p?.sport) ? (MENU[p.sport].find((t) => t.cle === p.type)?.nom ?? p.type) : String(p?.type ?? '');
    const ligne = `Ajouter : ${SPORTS_NOMS[p?.sport] ?? 'séance'} ${o.detail?.nom ?? nom} ${p?.minutes} min le ${etiquetteDate(p?.date)}`;
    lignes.push({ op: o.op, texte: ligne, raison: o.raison ?? o.justification, sport: p?.sport ?? null, minutes: p?.minutes ?? null, vers: p?.date, structure: o.detail?.resume ?? resumeLigneStructure(p), blocs: o.detail?.structure ?? blocsLigneStructure(p), nom: o.detail?.nom, ...(o.phase ? { phase: o.phase } : {}) });
    const v = validerSeance(p, ctxAvec(base, restantes, indispos, repos));
    if (!v.ok) echec(ligne, v.erreurs.map((e) => e.message).join(' '));
    for (const a of v.avertissements) avertissements.push(`${ligne} : ${a.message}`);
    const nouvelle: SeancePrevue = { id: `nouvelle-${surAjouts.length + 1}`, date: p?.date, sport: p?.sport ?? null, minutes: p?.minutes ?? null, tss: v.tssEstime, creeeParIa: true };
    surAjouts.push(nouvelle);
    restantes.push(nouvelle);
  }

  // 3. Règle dure : aucune séance ne reste pendant une période que le plan déclare
  for (const n of nouvelles) {
    for (const r of restantes) {
      if (entre(r.date, n.du, n.au)) {
        echec(`${NOM_INDISPO[n.type]} ${etiquetteDate(n.du)} → ${etiquetteDate(n.au)}`, `il reste ${libelleSeance(r)} le ${etiquetteDate(r.date)} pendant cette période : déplace-la ou supprime-la dans le même plan`);
      }
    }
  }

  // Règle dure bis : aucune séance ne reste un jour de repos que le plan pose
  for (const jour of reposPoses) {
    for (const r of restantes) {
      if (r.date === jour) echec(`Repos ${etiquetteDate(jour)}`, `il reste ${libelleSeance(r)} ce jour-là : déplace-la ou supprime-la dans le même plan`);
    }
  }

  return { ok: erreurs.length === 0, erreurs, avertissements, lignes, chargeAvant, chargeApres: chargePrevue(restantes, base.aujourdhui) };
}

// ---------- Le moteur : de contraintes à opérations ----------

export interface Contraintes {
  /** Maladie, blessure ou indisponibilité à déclarer */
  indisponibilite?: { type: TypeIndispo; du: string; au: string };
  /** Jours où l'utilisateur ne peut pas s'entraîner (voyage, travail…), sans que ce soit de la santé */
  joursBloques?: string[];
  /** Un ou plusieurs sports à éviter pendant une période (« pas de vélo cette semaine ») */
  sportsExclus?: { sports: string[]; du: string; au: string };
}

/**
 * Après une maladie ou une blessure d'au moins 3 jours : quelques jours sans séance au retour, puis une semaine de reprise
 * où les séances sont raccourcies et faciles (70 % de la durée si l'arrêt a duré moins d'une semaine, 50 % sinon).
 * Ce sont des repères de terrain (fiche reprise-apres-arret), pas des lois : voilà pourquoi ils sont réunis ici.
 */
function fenetreReprise(c: Contraintes): { debut: string; finDur: string; facteur: number; type: TypeIndispo } | null {
  const i = c.indisponibilite;
  if (!i || (i.type !== 'maladie' && i.type !== 'blessure')) return null;
  const duree = ecartJours(i.du, i.au) + 1;
  if (duree < 3) return null;
  const delai = i.type === 'blessure' ? 2 : 1;
  const debut = ajouterJours(i.au, delai);
  return { debut, finDur: ajouterJours(debut, Math.min(7, duree)), facteur: duree >= 7 ? 0.5 : 0.7, type: i.type };
}

/** Le type « facile » (zone 2, hors récupération) de chaque sport du menu : ce qu'on remet au programme à la reprise */
const TYPE_REPRISE: Record<string, string> = { velo: 'endurance', course: 'footing_facile', natation: 'endurance' };

function versionReduite(s: SeancePrevue, jour: string, facteur: number): Proposition | null {
  if (!estFamilleCoach(s.sport)) return null;
  const type = MENU[s.sport].find((t) => t.cle === TYPE_REPRISE[s.sport as string]);
  if (!type) return null;
  // Durée libre : la moitié (ou 70 %) de la séance d'origine, sans arrondi ni bornes, au moins 10 minutes
  const minutes = s.minutes ? Math.max(10, Math.round(s.minutes * facteur)) : 30;
  return { date: jour, sport: s.sport, type: type.cle, minutes };
}

/**
 * Calcule les opérations qui règlent les contraintes. Chaque séance touchée est :
 *   - déplacée au premier jour libre qui respecte toutes les règles (vers l'avant d'abord ; vers l'arrière seulement si ce
 *     n'est pas une affaire de santé), ou
 *   - remplacée par une version courte et facile pendant la semaine de reprise après maladie ou blessure, ou
 *   - supprimée, avec la raison, s'il n'y a aucune place dans les 14 jours.
 * Les séances touchées sont d'abord retirées toutes ensemble du calendrier : elles ne se gênent pas entre elles.
 * Cette fonction ne crée jamais de séance en plus : elle remplace ou déplace ce qui existe.
 */
export function proposerReplanification(c: Contraintes, seances: SeancePrevue[], base: ContexteValidation): Operation[] {
  const ops: Operation[] = [];
  const indispos = [...base.indisponibilites];
  if (c.indisponibilite) {
    ops.push({ op: 'indisponibilite', ...c.indisponibilite });
    indispos.push(c.indisponibilite);
  }
  const reprise = fenetreReprise(c);
  const sante = !!c.indisponibilite && c.indisponibilite.type !== 'indisponible';

  // Pourquoi cette séance doit-elle bouger ? (null = elle reste telle quelle)
  const motifDeplacement = (s: SeancePrevue): string | null => {
    const i = c.indisponibilite;
    if (i && entre(s.date, i.du, i.au)) return `${NOM_INDISPO[i.type]} jusqu'au ${etiquetteDate(i.au)}`;
    if (c.joursBloques?.includes(s.date)) return "jour où tu ne peux pas t'entraîner";
    const x = c.sportsExclus;
    if (x && s.sport && x.sports.includes(s.sport) && entre(s.date, x.du, x.au)) return `pas de ${SPORTS_NOMS[s.sport] ?? s.sport} du ${etiquetteDate(x.du)} au ${etiquetteDate(x.au)}`;
    if (reprise && i && s.date > i.au && s.date < reprise.debut) return 'trop tôt après le retour';
    if (reprise && s.date >= reprise.debut && s.date < reprise.finDur) return `semaine de reprise après ${NOM_INDISPO[reprise.type]}`;
    return null;
  };

  const interdit = (s: SeancePrevue, jour: string): boolean => {
    if (c.joursBloques?.includes(jour)) return true;
    const x = c.sportsExclus;
    if (x && s.sport && x.sports.includes(s.sport) && entre(jour, x.du, x.au)) return true;
    if (reprise && c.indisponibilite && jour >= c.indisponibilite.du && jour < reprise.debut) return true;
    // Une séance dure d'un sport sans version « facile » dans le menu ne peut pas être raccourcie : pas de place avant la fin de la reprise
    if (reprise && estSeanceDure(s.tss, s.minutes) && !estFamilleCoach(s.sport) && jour < reprise.finDur) return true;
    return false;
  };

  const aujourdhui = base.aujourdhui;
  const horizon = ajouterJours(aujourdhui, HORIZON_REPLANIFICATION_JOURS);
  const triees = [...seances].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const touchees = triees.filter((s) => motifDeplacement(s) !== null);
  const idsTouchees = new Set(touchees.map((s) => s.id));
  let restantes: SeancePrevue[] = seances.filter((s) => !idsTouchees.has(s.id)).map((s) => ({ ...s }));

  for (const s of touchees) {
    const raison = motifDeplacement(s) as string;

    const candidats: string[] = [];
    // Même jour : possible seulement en version réduite, pendant la semaine de reprise
    if (reprise && s.date >= reprise.debut && s.date < reprise.finDur) candidats.push(s.date);
    for (let d = ajouterJours(s.date, 1); d <= horizon; d = ajouterJours(d, 1)) candidats.push(d);
    if (!sante) for (let d = ajouterJours(s.date, -1); d >= aujourdhui; d = ajouterJours(d, -1)) candidats.push(d);

    let fait = false;
    for (const jour of candidats) {
      if (interdit(s, jour) || restantes.some((r) => r.date === jour)) continue;
      const ctx = ctxAvec(base, restantes, indispos);
      // Pendant la reprise : version courte et facile à la place de la séance d'origine
      const reduite = reprise && jour >= reprise.debut && jour < reprise.finDur ? versionReduite(s, jour, reprise.facteur) : null;
      if (reduite) {
        const v = validerSeance(reduite, ctx);
        if (!v.ok) continue;
        ops.push({ op: 'supprimer', seanceId: s.id, raison });
        ops.push({ op: 'ajouter', proposition: reduite, justification: `Reprise progressive après ${NOM_INDISPO[reprise!.type]} : séance plus courte et facile.`, raison: 'reprise progressive' });
        restantes.push({ id: `nouvelle-${ops.length}`, date: jour, sport: reduite.sport, minutes: reduite.minutes, tss: v.tssEstime, creeeParIa: true });
        fait = true;
        break;
      }
      if (jour === s.date) continue;
      const v = validerDeplacement(s, jour, ctx);
      if (v.ok) {
        ops.push({ op: 'deplacer', seanceId: s.id, vers: jour, raison });
        restantes.push({ ...s, date: jour });
        fait = true;
        break;
      }
    }
    if (!fait) ops.push({ op: 'supprimer', seanceId: s.id, raison: `${raison} ; aucun jour libre d'ici ${HORIZON_REPLANIFICATION_JOURS} jours` });
  }
  return ops;
}

/** La structure d'une séance ajoutée, en une phrase ; rien si la proposition est invalide (le validateur la refusera) */
function resumeLigneStructure(p: Proposition): string | undefined {
  const blocs = blocsLigneStructure(p);
  return blocs ? resumeStructure(blocs) : undefined;
}

/** Les blocs d'une séance ajoutée (construits par le code) ; rien si la proposition est invalide */
export function blocsLigneStructure(p: Proposition): BlocStructure[] | undefined {
  if (!estFamilleCoach(p?.sport) || !Number.isInteger(p?.minutes) || p.minutes < 1 || p.minutes > 1440) return undefined;
  return structureSeance(p.sport, p.type, p.minutes);
}
