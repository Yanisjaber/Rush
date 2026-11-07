// ============================================================
// Le registre des actions du coach (docs/ia/PLAN_COACH_COMPLET.md).
//
// Une seule liste : un outil n'existe pour le modèle que s'il est déclaré ici, avec son niveau de risque.
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

export type NiveauAction = 'direct' | 'carte' | 'confirmation';

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
}

/** Combien d'actions de chaque niveau dans un même message de réponse */
export const MAX_PAR_NIVEAU: Record<NiveauAction, number> = { direct: 3, carte: 3, confirmation: 1 };

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

function uuid(x: unknown): string | null {
  return typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x) ? x.toLowerCase() : null;
}

const refus = (erreur: string): LectureAction => ({ ok: false, erreur });

// ---------- Les écrans que le coach peut ouvrir ----------

export const ECRANS = ['accueil', 'calendrier', 'bilan', 'sante', 'coach', 'parametres'] as const;
export const INDISPONIBILITES = ['maladie', 'blessure', 'indisponible'] as const;

// ---------- Le registre ----------

export const ACTIONS: DefinitionAction[] = [
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
