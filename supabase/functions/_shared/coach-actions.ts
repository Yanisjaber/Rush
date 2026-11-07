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

/** Combien d'actions de chaque niveau dans un même message de réponse */
export const MAX_PAR_NIVEAU: Record<NiveauAction, number> = { lecture: 4, direct: 3, carte: 3, confirmation: 1 };

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

// ---------- Les écrans que le coach peut ouvrir ----------

export const ECRANS = ['accueil', 'calendrier', 'bilan', 'sante', 'coach', 'parametres'] as const;
/** Les familles de sport que porte le résumé (« autre » et « muscu » comprises) */
export const SPORTS_LECTURE = ['velo', 'course', 'natation', 'muscu', 'autre'] as const;
export const INDISPONIBILITES = ['maladie', 'blessure', 'indisponible'] as const;

// ---------- Le registre ----------

export const ACTIONS: DefinitionAction[] = [
  // ----- Niveau 0 : lecture (le détail que le résumé léger ne contient pas) -----
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
    nom: 'deplacer_seance',
    niveau: 'carte',
    disponible: false,
    description: "Propose de déplacer une séance prévue à un autre jour (carte à valider). Ça ne déplace rien tant que l'utilisateur n'a pas validé.",
    schema: {
      type: 'object',
      properties: { seance_id: { type: 'string', description: 'Identifiant de la séance prévue.' }, date: { type: 'string', description: 'Nouveau jour, AAAA-MM-JJ.' } },
      required: ['seance_id', 'date'],
      additionalProperties: false,
    },
    lire: (input) => {
      const o = objet(input, ['seance_id', 'date']);
      const seance_id = uuid(o?.seance_id);
      const date = dateIso(o?.date);
      return seance_id && date ? { ok: true, params: { seance_id, date } } : refus('Il faut un identifiant de séance valide et une date AAAA-MM-JJ.');
    },
  },
  {
    nom: 'supprimer_seance',
    niveau: 'carte',
    disponible: false,
    description: "Propose de supprimer une séance prévue (carte à valider). Ça ne supprime rien tant que l'utilisateur n'a pas validé.",
    schema: {
      type: 'object',
      properties: { seance_id: { type: 'string', description: 'Identifiant de la séance prévue.' } },
      required: ['seance_id'],
      additionalProperties: false,
    },
    lire: (input) => {
      const o = objet(input, ['seance_id']);
      const seance_id = uuid(o?.seance_id);
      return seance_id ? { ok: true, params: { seance_id } } : refus('Il faut un identifiant de séance valide.');
    },
  },
  {
    nom: 'declarer_indisponibilite',
    niveau: 'carte',
    disponible: false,
    description: "Propose de déclarer une période de maladie, blessure ou indisponibilité (carte à valider).",
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: [...INDISPONIBILITES] },
        du: { type: 'string', description: 'Premier jour, AAAA-MM-JJ.' },
        au: { type: 'string', description: 'Dernier jour, AAAA-MM-JJ (même jour ou après).' },
      },
      required: ['type', 'du', 'au'],
      additionalProperties: false,
    },
    lire: (input) => {
      const o = objet(input, ['type', 'du', 'au']);
      const type = parmi(o?.type, INDISPONIBILITES);
      const du = dateIso(o?.du);
      const au = dateIso(o?.au);
      if (!type || !du || !au) return refus('Il faut un type (maladie, blessure, indisponible) et deux dates AAAA-MM-JJ.');
      if (au < du) return refus("La date de fin doit être le même jour que le début, ou après.");
      return { ok: true, params: { type, du, au } };
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
