// ============================================================
// Le registre des actions du coach (docs/ia/PLAN_COACH_COMPLET.md).
//
// Une seule liste : un outil n'existe pour le modèle que s'il est déclaré ici, avec son niveau de risque.
//   - « lecture »      : le modèle va chercher un détail (jours, sorties, volumes…). Le serveur répond avec le résumé déjà chargé
//                        (aucun nouvel accès à la base, la santé reste filtrée par catégorie autorisée). Ne change rien.
//   - « direct »       : ne change aucune donnée (ouvrir un écran…). Le serveur vérifie les paramètres puis les envoie à l'app,
//                        qui les exécute elle-même (liste blanche côté app).
//   - « carte »        : modifie les données de l'utilisateur. Le modèle ne fait que PROPOSER : une carte apparaît, rien n'est
//                        écrit tant que l'utilisateur n'a pas tapé sur Valider (décision de Yanis, 7 nov. : toujours une carte).
//   - « confirmation » : gros ou irréversible. Carte avec confirmation explicite, une seule par message.
//
// Ce module ne contient AUCUN code qui écrit dans la base : pour les niveaux « carte » et « confirmation », le registre
// décrit et vérifie la demande, l'écriture est faite ailleurs, au tap, avec le jeton de l'utilisateur (donc la RLS s'applique).
//
// `disponible: false` = déclaré mais pas encore branché (il manque l'exécuteur au tap) : jamais montré au modèle.
// ============================================================
import { chercherConnaissance, SPORTS_CONNAISSANCE } from './connaissances.ts';
import type { Contraintes, Operation } from './planning.ts';
import { SEANCES_PAR_SPORT_MAX } from './semaine.ts';
import type { DemandeSemaine } from './semaine.ts';
import { FAMILLES_COACH } from './menu-seances.ts';
import type { OutilModele } from './modele.ts';
import { OUTIL_PROPOSER_SEANCE, NOM_OUTIL_SEANCE } from './coach-prompt.ts';

export type NiveauAction = 'lecture' | 'direct' | 'carte' | 'confirmation';

export type LectureAction = { ok: true; params: Record<string, unknown> } | { ok: false; erreur: string };

export interface DefinitionAction {
  nom: string;
  niveau: NiveauAction;
  /** Faux tant que l'exécuteur n'existe pas : l'action n'est alors pas proposée au modèle */
  disponible: boolean;
  description: string;
  schema: Record<string, unknown>;
  /** Vérifie et nettoie les paramètres écrits par le modèle (jamais crus tels quels). Absent seulement pour proposer_seance, validée par validerSeance. */
  lire?: (input: unknown) => LectureAction;
  /** Niveau « lecture » seulement : ce qu'on répond au modèle, à partir du résumé déjà chargé */
  repondre?: (params: Record<string, unknown>, resume: unknown) => unknown;
  /** Niveau « lecture » seulement : lecture de l'historique long, par une fonction SQL (droits de l'utilisateur, RLS). Liste fermée de fonctions. */
  requete?: { fonction: FonctionHistorique; args: (params: Record<string, unknown>, jour: string) => Record<string, unknown> };
}

export type FonctionHistorique = 'rpc_coach_semaines' | 'rpc_coach_seances';
export const FONCTIONS_HISTORIQUE: readonly FonctionHistorique[] = ['rpc_coach_semaines', 'rpc_coach_seances'];

/** Nombre de jours entre deux dates AAAA-MM-JJ valides */
function joursEntre(du: string, au: string): number {
  return Math.round((Date.parse(`${au}T00:00:00Z`) - Date.parse(`${du}T00:00:00Z`)) / 86_400_000);
}

/** Combien de cartes de séance et de cartes à confirmer dans un même message (les lectures et les actions directes ne sont plus limitées, 8 nov. 2026) */
export const MAX_PAR_NIVEAU = { carte: 3, confirmation: 1 } as const;

// ---------- Petits lecteurs ----------

type Objet = Record<string, unknown>;

/** Un objet dont les seules clés sont celles attendues (une clé en trop = refus) */
function objet(input: unknown, cles: string[]): Objet | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const o = input as Objet;
  return Object.keys(o).every((k) => cles.includes(k)) ? o : null;
}

function dateIso(x: unknown): string | null {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return null;
  const d = new Date(`${x}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== x ? null : x;
}

function parmi<T extends string>(x: unknown, valeurs: readonly T[]): T | null {
  return typeof x === 'string' && (valeurs as readonly string[]).includes(x) ? (x as T) : null;
}

function entier(x: unknown, min: number, max: number): number | null {
  return typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max ? x : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const liste = (x: unknown): any[] => (Array.isArray(x) ? x : []);

function uuid(x: unknown): string | null {
  return typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x) ? x.toLowerCase() : null;
}

const refus = (erreur: string): LectureAction => ({ ok: false, erreur });

/** « motif » : une phrase du modèle qui explique le plan à l'utilisateur (affichée sur la carte) */
function motifPlan(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const t = x.trim().replace(/\s+/g, ' ');
  return t.length >= 3 && t.length <= 200 ? t : null;
}

const DATES_MAX_JOURS_BLOQUES = 14;

function lireContraintes(o: Objet): { ok: true; contraintes: Contraintes } | { ok: false; erreur: string } {
  const c: Contraintes = {};
  if (o.indisponibilite !== undefined) {
    const i = objet(o.indisponibilite, ['type', 'du', 'au']);
    const type = parmi(i?.type, INDISPONIBILITES);
    const du = dateIso(i?.du);
    const au = dateIso(i?.au);
    if (!i || !type || !du || !au) return { ok: false, erreur: "indisponibilite : il faut type (maladie, blessure, indisponible), du et au (AAAA-MM-JJ)." };
    if (au < du) return { ok: false, erreur: 'indisponibilite : la fin doit être le même jour que le début, ou après.' };
    c.indisponibilite = { type, du, au };
  }
  if (o.jours_bloques !== undefined) {
    const l = o.jours_bloques;
    if (!Array.isArray(l) || l.length < 1 || l.length > DATES_MAX_JOURS_BLOQUES) return { ok: false, erreur: `jours_bloques : une liste de 1 à ${DATES_MAX_JOURS_BLOQUES} dates AAAA-MM-JJ.` };
    const dates = l.map(dateIso);
    if (dates.some((d) => !d)) return { ok: false, erreur: 'jours_bloques : toutes les dates doivent être au format AAAA-MM-JJ et exister.' };
    c.joursBloques = [...new Set(dates as string[])];
  }
  if (o.sports_exclus !== undefined) {
    const x = objet(o.sports_exclus, ['sports', 'du', 'au']);
    const du = dateIso(x?.du);
    const au = dateIso(x?.au);
    const sports = Array.isArray(x?.sports) ? (x!.sports as unknown[]).map((v) => parmi(v, SPORTS_LECTURE)) : [];
    if (!x || !du || !au || sports.length < 1 || sports.length > 5 || sports.some((v) => !v)) return { ok: false, erreur: `sports_exclus : sports (1 à 5 parmi ${SPORTS_LECTURE.join(', ')}), du et au (AAAA-MM-JJ).` };
    if (au < du || joursEntre(du, au) > 31) return { ok: false, erreur: 'sports_exclus : la fin doit être après le début, 31 jours au plus.' };
    c.sportsExclus = { sports: [...new Set(sports as string[])], du, au };
  }
  if (!c.indisponibilite && !c.joursBloques && !c.sportsExclus) return { ok: false, erreur: 'Donne au moins une contrainte : indisponibilite, jours_bloques ou sports_exclus.' };
  return { ok: true, contraintes: c };
}


function lireDemandeSemaine(o: Objet): { ok: true; demande: DemandeSemaine } | { ok: false; erreur: string } {
  const brut = o.sports;
  if (!Array.isArray(brut) || brut.length < 1 || brut.length > FAMILLES_COACH.length) return { ok: false, erreur: `sports : une liste de 1 à ${FAMILLES_COACH.length} sports, chacun avec son nombre de séances.` };
  const sports: DemandeSemaine['sports'] = [];
  for (const x of brut) {
    const e = objet(x, ['sport', 'seances']);
    const sport = parmi(e?.sport, FAMILLES_COACH);
    const seances = entier(e?.seances, 1, SEANCES_PAR_SPORT_MAX);
    if (!e || !sport || !seances) return { ok: false, erreur: `sports : chaque entrée demande un sport (${FAMILLES_COACH.join(', ')}) et seances (entier de 1 à ${SEANCES_PAR_SPORT_MAX}).` };
    if (sports.some((s) => s.sport === sport)) return { ok: false, erreur: `sports : « ${sport} » est en double.` };
    sports.push({ sport, seances });
  }
  const demande: DemandeSemaine = { sports };
  if (o.debut !== undefined) {
    const debut = dateIso(o.debut);
    if (!debut) return { ok: false, erreur: 'debut : une date AAAA-MM-JJ qui existe (lis-la dans prochains_jours).' };
    demande.debut = debut;
  }
  if (o.jours !== undefined) {
    const jours = entier(o.jours, 1, 14);
    if (!jours) return { ok: false, erreur: 'jours : un entier de 1 à 14.' };
    demande.jours = jours;
  }
  if (o.jours_libres !== undefined) {
    const l = o.jours_libres;
    if (!Array.isArray(l) || l.length > DATES_MAX_JOURS_BLOQUES) return { ok: false, erreur: `jours_libres : au plus ${DATES_MAX_JOURS_BLOQUES} dates AAAA-MM-JJ.` };
    const dates = l.map(dateIso);
    if (dates.some((d) => !d)) return { ok: false, erreur: 'jours_libres : toutes les dates doivent être au format AAAA-MM-JJ et exister.' };
    demande.joursLibres = [...new Set(dates as string[])];
  }
  if (o.intensite !== undefined) {
    const i = parmi(o.intensite, ['facile', 'normale'] as const);
    if (!i) return { ok: false, erreur: 'intensite : « facile » ou « normale ».' };
    demande.intensite = i;
  }
  return { ok: true, demande };
}

const OPS_MODIFIER_MAX = 8;

function lireOperations(liste: unknown): { ok: true; operations: Operation[] } | { ok: false; erreur: string } {
  if (!Array.isArray(liste) || liste.length < 1 || liste.length > OPS_MODIFIER_MAX) return { ok: false, erreur: `operations : une liste de 1 à ${OPS_MODIFIER_MAX} opérations.` };
  const operations: Operation[] = [];
  for (let n = 0; n < liste.length; n++) {
    const brut = liste[n];
    const nom = (typeof brut === 'object' && brut !== null ? (brut as Objet).op : undefined) as unknown;
    const err = (m: string) => ({ ok: false as const, erreur: `operations[${n}] : ${m}` });
    if (nom === 'deplacer') {
      const o = objet(brut, ['op', 'seance_id', 'vers']);
      const seanceId = uuid(o?.seance_id);
      const vers = dateIso(o?.vers);
      if (!seanceId || !vers) return err("deplacer demande seance_id (celui d'une séance prévue) et vers (AAAA-MM-JJ).");
      operations.push({ op: 'deplacer', seanceId, vers });
    } else if (nom === 'supprimer') {
      const o = objet(brut, ['op', 'seance_id']);
      const seanceId = uuid(o?.seance_id);
      if (!seanceId) return err("supprimer demande seance_id (celui d'une séance prévue).");
      operations.push({ op: 'supprimer', seanceId });
    } else if (nom === 'ajouter') {
      const o = objet(brut, ['op', 'date', 'sport', 'type_seance', 'minutes', 'justification']);
      const date = dateIso(o?.date);
      const sport = parmi(o?.sport, FAMILLES_COACH);
      const minutes = typeof o?.minutes === 'number' && Number.isInteger(o.minutes) ? o.minutes : null;
      if (!o || !date || !sport || typeof o.type_seance !== 'string' || minutes === null || typeof o.justification !== 'string') {
        return err('ajouter demande date, sport, type_seance, minutes (entier) et justification.');
      }
      operations.push({ op: 'ajouter', proposition: { date, sport, type: o.type_seance, minutes }, justification: o.justification.trim().slice(0, 300) });
    } else if (nom === 'repos') {
      const o = objet(brut, ['op', 'date', 'poser']);
      const date = dateIso(o?.date);
      if (!o || !date || (o.poser !== undefined && typeof o.poser !== 'boolean')) return err('repos demande date (AAAA-MM-JJ) et, si tu veux le retirer, poser: false.');
      operations.push({ op: 'repos', date, poser: o.poser !== false });
    } else if (nom === 'indisponibilite') {
      const o = objet(brut, ['op', 'type_periode', 'du', 'au']);
      const type = parmi(o?.type_periode, INDISPONIBILITES);
      const du = dateIso(o?.du);
      const au = dateIso(o?.au);
      if (!type || !du || !au) return err('indisponibilite demande type_periode (maladie, blessure, indisponible), du et au (AAAA-MM-JJ).');
      operations.push({ op: 'indisponibilite', type, du, au });
    } else {
      return err("op inconnue (deplacer, supprimer, ajouter, repos ou indisponibilite).");
    }
  }
  return { ok: true, operations };
}

// ---------- Les écrans que le coach peut ouvrir ----------

export const ECRANS = ['accueil', 'calendrier', 'bilan', 'sante', 'coach', 'parametres'] as const;
/** Les familles de sport que porte le résumé (« autre » et « muscu » comprises) */
export const SPORTS_LECTURE = ['velo', 'course', 'natation', 'muscu', 'autre'] as const;
export const INDISPONIBILITES = ['maladie', 'blessure', 'indisponible'] as const;

// ---------- Le registre ----------

export const ACTIONS: DefinitionAction[] = [
  // ----- Niveau 0 : lecture (le détail que le résumé léger ne contient pas) -----
  {
    nom: 'chercher_connaissance',
    niveau: 'lecture',
    disponible: true,
    description:
      "Cherche dans la base de connaissances de l'application (fiches sourcées sur l'entraînement : intensités, charge, affûtage, reprise, sommeil, nutrition sportive, force, chaleur, sports, profils). " +
      "À appeler AVANT de répondre à une question de méthode ou de science de l'entraînement, au lieu de répondre de mémoire. Rend jusqu'à 3 fiches avec leur niveau de preuve, ou aucune si la base ne couvre pas le sujet.",
    schema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: "La question ou les mots-clés du sujet, en français (3 à 200 caractères). Par exemple : « affûtage avant un marathon »." },
        sport: { type: 'string', enum: [...SPORTS_CONNAISSANCE], description: "Facultatif : le sport de l'utilisateur, pour mettre en avant les fiches qui le concernent." },
      },
      required: ['question'],
      additionalProperties: false,
    },
    lire: (input) => {
      const o = objet(input, ['question', 'sport']);
      const question = typeof o?.question === 'string' ? o.question.trim() : '';
      if (!o || question.length < 3 || question.length > 200) return refus('question doit faire entre 3 et 200 caractères.');
      if (o.sport === undefined) return { ok: true, params: { question } };
      const sport = parmi(o.sport, SPORTS_CONNAISSANCE);
      return sport ? { ok: true, params: { question, sport } } : refus(`Sport inconnu. Choix possibles : ${SPORTS_CONNAISSANCE.join(', ')}.`);
    },
    repondre: (p) => chercherConnaissance(p.question as string, p.sport as string | undefined),
  },
  {
    nom: 'lire_jours',
    niveau: 'lecture',
    disponible: true,
    description: "Lit la charge d'entraînement jour par jour (points de charge, minutes, nombre de séances, sports) sur les derniers jours, jusqu'à 14.",
    schema: {
      type: 'object',
      properties: { nb: { type: 'integer', minimum: 1, maximum: 14, description: 'Nombre de jours en arrière, aujourd\'hui compris.' } },
      required: ['nb'],
      additionalProperties: false,
    },
    lire: (input) => {
      const nb = entier(objet(input, ['nb'])?.nb, 1, 14);
      return nb ? { ok: true, params: { nb } } : refus('nb doit être un entier entre 1 et 14.');
    },
    repondre: (p, resume) => liste((resume as Objet)?.derniers_jours).slice(-(p.nb as number)),
  },
  {
    nom: 'lire_seances_recentes',
    niveau: 'lecture',
    disponible: true,
    description: "Lit les dernières séances réalisées (date, sport, minutes, km, fréquence cardiaque moyenne), les plus récentes d'abord, jusqu'à 8. Sans le nom des séances.",
    schema: {
      type: 'object',
      properties: {
        nb: { type: 'integer', minimum: 1, maximum: 8 },
        sport: { type: 'string', enum: [...SPORTS_LECTURE], description: 'Facultatif : un seul sport.' },
      },
      required: ['nb'],
      additionalProperties: false,
    },
    lire: (input) => {
      const o = objet(input, ['nb', 'sport']);
      const nb = entier(o?.nb, 1, 8);
      if (!o || !nb) return refus('nb doit être un entier entre 1 et 8.');
      if (o.sport === undefined) return { ok: true, params: { nb } };
      const sport = parmi(o.sport, SPORTS_LECTURE);
      return sport ? { ok: true, params: { nb, sport } } : refus(`Sport inconnu. Choix possibles : ${SPORTS_LECTURE.join(', ')}.`);
    },
    repondre: (p, resume) =>
      liste((resume as Objet)?.dernieres_seances)
        .filter((s) => p.sport === undefined || s?.sport === p.sport)
        .slice(0, p.nb as number),
  },
  {
    nom: 'lire_semaines',
    niveau: 'lecture',
    disponible: true,
    description:
      "Lit le bilan semaine par semaine sur une longue période, jusqu'à 52 semaines (du plus ancien au plus récent) : séances, minutes, km, et pour tous les sports ensemble la charge, les jours actifs et la forme de fond en fin de semaine. " +
      "À utiliser pour comparer des périodes (ce mois-ci contre il y a trois mois), voir une tendance ou une saison. Les semaines sont des blocs de 7 jours qui finissent aujourd'hui.",
    schema: {
      type: 'object',
      properties: {
        nb: { type: 'integer', minimum: 1, maximum: 52, description: 'Nombre de semaines en arrière.' },
        sport: { type: 'string', enum: ['velo', 'course', 'natation', 'muscu'], description: 'Facultatif : un seul sport (sans charge ni forme de fond).' },
      },
      required: ['nb'],
      additionalProperties: false,
    },
    lire: (input) => {
      const o = objet(input, ['nb', 'sport']);
      const nb = entier(o?.nb, 1, 52);
      if (!o || !nb) return refus('nb doit être un entier entre 1 et 52.');
      if (o.sport === undefined) return { ok: true, params: { nb } };
      const sport = parmi(o.sport, ['velo', 'course', 'natation', 'muscu'] as const);
      return sport ? { ok: true, params: { nb, sport } } : refus('Sport inconnu. Choix possibles : velo, course, natation, muscu.');
    },
    requete: { fonction: 'rpc_coach_semaines', args: (p, jour) => ({ p_date: jour, p_nb: p.nb, p_sport: p.sport ?? null }) },
  },
  {
    nom: 'lire_seances_periode',
    niveau: 'lecture',
    disponible: true,
    description:
      "Lit les séances réalisées sur une période de 92 jours au plus (date, sport, minutes, km, fréquence cardiaque moyenne), les plus récentes d'abord, 30 au plus. Sans le nom des séances. " +
      "À utiliser pour une période précise dans le passé (par exemple « la semaine avant ma course »).",
    schema: {
      type: 'object',
      properties: {
        du: { type: 'string', description: 'Premier jour, AAAA-MM-JJ.' },
        au: { type: 'string', description: 'Dernier jour, AAAA-MM-JJ (92 jours après le premier au plus).' },
        sport: { type: 'string', enum: [...SPORTS_LECTURE], description: 'Facultatif : un seul sport.' },
        nb: { type: 'integer', minimum: 1, maximum: 30, description: 'Nombre de séances au plus (20 par défaut).' },
      },
      required: ['du', 'au'],
      additionalProperties: false,
    },
    lire: (input) => {
      const o = objet(input, ['du', 'au', 'sport', 'nb']);
      const du = dateIso(o?.du);
      const au = dateIso(o?.au);
      if (!o || !du || !au) return refus('du et au doivent être des dates AAAA-MM-JJ qui existent.');
      if (au < du) return refus('La date de fin doit être le même jour que le début, ou après.');
      if (joursEntre(du, au) > 92) return refus('92 jours au plus entre du et au : découpe en plusieurs lectures.');
      const params: Record<string, unknown> = { du, au };
      if (o.sport !== undefined) {
        const sport = parmi(o.sport, SPORTS_LECTURE);
        if (!sport) return refus(`Sport inconnu. Choix possibles : ${SPORTS_LECTURE.join(', ')}.`);
        params.sport = sport;
      }
      if (o.nb !== undefined) {
        const nb = entier(o.nb, 1, 30);
        if (!nb) return refus('nb doit être un entier entre 1 et 30.');
        params.nb = nb;
      }
      return { ok: true, params };
    },
    requete: { fonction: 'rpc_coach_seances', args: (p) => ({ p_du: p.du, p_au: p.au, p_sport: p.sport ?? null, p_limite: p.nb ?? 20 }) },
  },
  {
    nom: 'lire_volume',
    niveau: 'lecture',
    disponible: true,
    description: 'Lit le volume par sport sur 7 et 28 jours (séances, minutes, km, séance la plus longue).',
    schema: { type: 'object', properties: {}, additionalProperties: false },
    lire: (input) => (objet(input, []) ? { ok: true, params: {} } : refus('Cet outil ne prend aucun paramètre.')),
    repondre: (_p, resume) => (resume as Objet)?.volume_par_sport ?? {},
  },
  {
    nom: 'lire_sante',
    niveau: 'lecture',
    disponible: true,
    description: "Lit les mesures de santé des 7 derniers jours (seulement les catégories que l'utilisateur a autorisées à partager). Liste vide = rien d'autorisé ou rien de saisi.",
    schema: { type: 'object', properties: {}, additionalProperties: false },
    lire: (input) => (objet(input, []) ? { ok: true, params: {} } : refus('Cet outil ne prend aucun paramètre.')),
    repondre: (_p, resume) => ({ mesures: liste((resume as Objet)?.sante) }),
  },
  {
    nom: 'lire_cycles',
    niveau: 'lecture',
    disponible: true,
    description: "Lit les cycles d'entraînement prévus dans les 60 prochains jours (dates et sport).",
    schema: { type: 'object', properties: {}, additionalProperties: false },
    lire: (input) => (objet(input, []) ? { ok: true, params: {} } : refus('Cet outil ne prend aucun paramètre.')),
    repondre: (_p, resume) => ({ cycles: liste((resume as Objet)?.cycles) }),
  },

  // ----- Niveau 1 : direct (ne change rien) -----
  {
    nom: 'ouvrir_ecran',
    niveau: 'direct',
    disponible: true,
    description: "Ouvre un écran de l'application pour l'utilisateur. Ça ne modifie rien.",
    schema: {
      type: 'object',
      properties: { ecran: { type: 'string', enum: [...ECRANS] } },
      required: ['ecran'],
      additionalProperties: false,
    },
    lire: (input) => {
      const o = objet(input, ['ecran']);
      const ecran = parmi(o?.ecran, ECRANS);
      return ecran ? { ok: true, params: { ecran } } : refus(`Écran inconnu. Choix possibles : ${ECRANS.join(', ')}.`);
    },
  },
  {
    nom: 'ouvrir_calendrier',
    niveau: 'direct',
    disponible: true,
    description: "Ouvre le calendrier sur un jour précis. Ça ne modifie rien.",
    schema: {
      type: 'object',
      properties: { date: { type: 'string', description: 'Jour, au format AAAA-MM-JJ.' } },
      required: ['date'],
      additionalProperties: false,
    },
    lire: (input) => {
      const o = objet(input, ['date']);
      const date = dateIso(o?.date);
      return date ? { ok: true, params: { date } } : refus('La date doit être au format AAAA-MM-JJ et exister.');
    },
  },
  {
    nom: 'filtrer_sport',
    niveau: 'direct',
    disponible: true,
    description: "Affiche l'application pour un seul sport (la barre des sports). Ça ne modifie aucune donnée.",
    schema: {
      type: 'object',
      properties: { sport: { type: 'string', enum: [...FAMILLES_COACH] } },
      required: ['sport'],
      additionalProperties: false,
    },
    lire: (input) => {
      const o = objet(input, ['sport']);
      const sport = parmi(o?.sport, FAMILLES_COACH);
      return sport ? { ok: true, params: { sport } } : refus(`Sport inconnu. Choix possibles : ${FAMILLES_COACH.join(', ')}.`);
    },
  },

  // ----- Niveau 2 : carte à valider (modifie les données) -----
  {
    nom: NOM_OUTIL_SEANCE,
    niveau: 'carte',
    disponible: true,
    description: OUTIL_PROPOSER_SEANCE.description,
    schema: OUTIL_PROPOSER_SEANCE.input_schema,
    // pas de `lire` : la séance est vérifiée par validerSeance (coach-chat.ts)
  },
  {
    nom: 'proposer_replanification',
    niveau: 'carte',
    disponible: true,
    description:
      "Replanifie le calendrier après un IMPRÉVU, à partir de contraintes : maladie ou blessure (indisponibilite), jours où l'utilisateur ne peut pas s'entraîner (jours_bloques), sport à éviter pendant une période (sports_exclus). " +
      "Le CODE calcule le plan : il déplace, remplace par des séances courtes et faciles à la reprise, ou supprime, en respectant toutes les règles, puis crée UNE carte que l'utilisateur valide. Rien n'est modifié avant sa validation. " +
      "Les dates sont au format AAAA-MM-JJ ; calcule-les à partir de la date du jour du contexte.",
    schema: {
      type: 'object',
      properties: {
        motif: { type: 'string', description: "Une phrase (200 caractères au plus) qui dit pourquoi, affichée sur la carte. Par exemple : « Blessure au genou, 10 jours de repos »." },
        indisponibilite: {
          type: 'object',
          description: "Maladie, blessure ou indisponibilité à déclarer sur le calendrier.",
          properties: { type: { type: 'string', enum: [...INDISPONIBILITES] }, du: { type: 'string' }, au: { type: 'string' } },
          required: ['type', 'du', 'au'],
          additionalProperties: false,
        },
        jours_bloques: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: DATES_MAX_JOURS_BLOQUES, description: "Dates où l'utilisateur ne peut pas s'entraîner (voyage, travail), sans que ce soit de la santé." },
        sports_exclus: {
          type: 'object',
          description: 'Sports à éviter pendant une période (par exemple pas de vélo cette semaine).',
          properties: { sports: { type: 'array', items: { type: 'string', enum: [...SPORTS_LECTURE] }, minItems: 1, maxItems: 5 }, du: { type: 'string' }, au: { type: 'string' } },
          required: ['sports', 'du', 'au'],
          additionalProperties: false,
        },
      },
      required: ['motif'],
      additionalProperties: false,
    },
    lire: (input) => {
      const o = objet(input, ['motif', 'indisponibilite', 'jours_bloques', 'sports_exclus']);
      const motif = motifPlan(o?.motif);
      if (!o || !motif) return refus('motif : une phrase de 3 à 200 caractères.');
      const c = lireContraintes(o);
      return c.ok ? { ok: true, params: { intention: motif, contraintes: c.contraintes } } : refus(c.erreur);
    },
  },
  {
    nom: 'planifier_semaine',
    niveau: 'carte',
    disponible: true,
    description:
      "Construit une semaine d'entraînement : « fais-moi ma semaine », « prépare mes séances », « je veux courir trois fois et faire deux sorties vélo ». " +
      "Tu donnes seulement CE QUE VEUT L'UTILISATEUR (les sports, combien de séances, les jours sans séance, facile ou non) : le CODE choisit les jours (bien espacés, sorties longues le week-end), les types de séance et les durées d'après son historique, en respectant toutes ses règles. " +
      "Crée UNE carte que l'utilisateur valide ; rien n'est ajouté avant. Les dates se lisent dans prochains_jours. Pour UNE séance précise, utilise proposer_seance ou modifier_planning.",
    schema: {
      type: 'object',
      properties: {
        motif: { type: 'string', description: 'Une phrase (200 caractères au plus) affichée sur la carte. Par exemple : « Ma semaine : deux sorties vélo et deux footings ».' },
        sports: {
          type: 'array',
          minItems: 1,
          maxItems: FAMILLES_COACH.length,
          items: {
            type: 'object',
            properties: { sport: { type: 'string', enum: [...FAMILLES_COACH] }, seances: { type: 'integer', minimum: 1, maximum: SEANCES_PAR_SPORT_MAX, description: 'Nombre de séances de ce sport sur la période.' } },
            required: ['sport', 'seances'],
            additionalProperties: false,
          },
        },
        debut: { type: 'string', description: 'Facultatif : premier jour à planifier, AAAA-MM-JJ. Par défaut demain.' },
        jours: { type: 'integer', minimum: 1, maximum: 14, description: 'Facultatif : nombre de jours à planifier. Par défaut 7.' },
        jours_libres: { type: 'array', items: { type: 'string' }, maxItems: DATES_MAX_JOURS_BLOQUES, description: "Facultatif : dates où l'utilisateur ne veut aucune séance (« pas le mardi »)." },
        intensite: { type: 'string', enum: ['facile', 'normale'], description: '« facile » : que des séances faciles. Par défaut « normale ».' },
      },
      required: ['motif', 'sports'],
      additionalProperties: false,
    },
    lire: (input) => {
      const o = objet(input, ['motif', 'sports', 'debut', 'jours', 'jours_libres', 'intensite']);
      const motif = motifPlan(o?.motif);
      if (!o || !motif) return refus('motif : une phrase de 3 à 200 caractères.');
      const d = lireDemandeSemaine(o);
      return d.ok ? { ok: true, params: { intention: motif, demande: d.demande } } : refus(d.erreur);
    },
  },
  {
    nom: 'modifier_planning',
    niveau: 'carte',
    disponible: true,
    description:
      "Modifie le calendrier avec des opérations PRÉCISES quand l'utilisateur le demande en termes simples : « décale ma sortie de demain à jeudi » (deplacer), « supprime ma séance de samedi » (supprimer), « ajoute une sortie facile dimanche » (ajouter), « je suis malade jusqu'à mardi » (indisponibilite), « mets-moi un jour de repos jeudi » (repos). " +
      "Les séances prévues sont dans le contexte avec leur id ; utilise ces id, n'en invente jamais. Crée UNE carte que l'utilisateur valide ; rien n'est modifié avant. Si l'imprévu touche plusieurs séances, préfère proposer_replanification. " +
      `${OPS_MODIFIER_MAX} opérations au plus.`,
    schema: {
      type: 'object',
      properties: {
        motif: { type: 'string', description: 'Une phrase (200 caractères au plus) qui dit pourquoi, affichée sur la carte.' },
        operations: {
          type: 'array',
          minItems: 1,
          maxItems: OPS_MODIFIER_MAX,
          items: {
            type: 'object',
            properties: {
              op: { type: 'string', enum: ['deplacer', 'supprimer', 'ajouter', 'repos', 'indisponibilite'] },
              poser: { type: 'boolean', description: 'repos : vrai (défaut) pour poser le jour de repos, faux pour le retirer. Le jour se lit dans date.' },
              seance_id: { type: 'string', description: "deplacer, supprimer : l'id d'une séance prévue du contexte." },
              vers: { type: 'string', description: 'deplacer : le nouveau jour, AAAA-MM-JJ.' },
              date: { type: 'string', description: 'ajouter ou repos : le jour, AAAA-MM-JJ.' },
              sport: { type: 'string', enum: [...FAMILLES_COACH], description: 'ajouter : le sport.' },
              type_seance: { type: 'string', description: 'ajouter : un type du menu de ce sport.' },
              minutes: { type: 'integer', description: 'ajouter : la durée.' },
              justification: { type: 'string', description: 'ajouter : une phrase, 200 caractères au plus.' },
              type_periode: { type: 'string', enum: [...INDISPONIBILITES], description: 'indisponibilite : le type de période.' },
              du: { type: 'string', description: 'indisponibilite : premier jour, AAAA-MM-JJ.' },
              au: { type: 'string', description: 'indisponibilite : dernier jour, AAAA-MM-JJ.' },
            },
            required: ['op'],
            additionalProperties: false,
          },
        },
      },
      required: ['motif', 'operations'],
      additionalProperties: false,
    },
    lire: (input) => {
      const o = objet(input, ['motif', 'operations']);
      const motif = motifPlan(o?.motif);
      if (!o || !motif) return refus('motif : une phrase de 3 à 200 caractères.');
      const l = lireOperations(o.operations);
      return l.ok ? { ok: true, params: { intention: motif, operations: l.operations } } : refus(l.erreur);
    },
  },

  // ----- Niveau 3 : confirmation explicite (gros ou irréversible) -----
  {
    nom: 'deconnecter_integration',
    niveau: 'confirmation',
    disponible: false,
    description: "Propose de déconnecter un service relié (Strava). Confirmation explicite demandée à l'utilisateur.",
    schema: {
      type: 'object',
      properties: { service: { type: 'string', enum: ['strava'] } },
      required: ['service'],
      additionalProperties: false,
    },
    lire: (input) => {
      const o = objet(input, ['service']);
      return o?.service === 'strava' ? { ok: true, params: { service: 'strava' } } : refus('Seul le service « strava » existe.');
    },
  },
  {
    nom: 'supprimer_compte',
    niveau: 'confirmation',
    disponible: false,
    description: "Propose de supprimer le compte et toutes ses données. Irréversible : confirmation explicite demandée à l'utilisateur.",
    schema: { type: 'object', properties: {}, additionalProperties: false },
    lire: (input) => (objet(input, []) ? { ok: true, params: {} } : refus('Cette action ne prend aucun paramètre.')),
  },
];

export function trouverAction(nom: string): DefinitionAction | undefined {
  return ACTIONS.find((a) => a.nom === nom);
}

/** Les actions montrées au modèle : seulement celles dont l'exécuteur existe */
export function actionsDisponibles(): DefinitionAction[] {
  return ACTIONS.filter((a) => a.disponible);
}

/** Le format « outil » du modèle, pour les actions disponibles */
export function outilsExposes(): OutilModele[] {
  return actionsDisponibles().map((a) => ({ name: a.nom, description: a.description, input_schema: a.schema }));
}
