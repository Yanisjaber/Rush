// ============================================================
// Le cœur du chat Coach (docs/ia/CADRAGE_IA.md) : tout ce qui se passe entre « l'utilisateur écrit » et « la réponse part ».
//
// Ce module ne connaît ni Supabase, ni le SDK Anthropic : il parle à deux interfaces (`StockageCoach`, `ClientModele`),
// ce qui permet de le tester entièrement avec un faux stockage et un faux modèle (supabase/tests/edge/coach-chat.test.mts).
//
// Ce qui se passe, dans cet ordre, pour un message :
//   1. accès (liste blanche) → accord de partage des données → coupe-circuit de dépense → plafond du jour (atomique)
//   2. résumé des données + garde-fou santé. Si le garde-fou dit « pro » : réponse fixe, le modèle n'est PAS appelé.
//   3. appel au modèle avec la mémoire, les derniers messages et le bloc de contexte. Le modèle peut appeler l'outil
//      `proposer_seance` : chaque proposition passe par le validateur, qui peut la refuser (le modèle voit la raison et corrige).
//   4. enregistrement du message et de la réponse (avec les cartes), puis comptage des tokens et du coût.
//
// Règles de sécurité tenues ici :
//   - l'identifiant de l'utilisateur vient du JWT vérifié par l'appelant, jamais du client ;
//   - le modèle n'écrit jamais dans le calendrier : il crée des cartes ; la séance n'existe qu'après « Ajouter » (ajouterCarte),
//     qui revalide tout au moment du tap ;
//   - une erreur n'écrit rien dans le calendrier et ne montre aucun détail technique.
// ============================================================
import { extraitsConnaissance, fondementsPlanCourse } from './connaissances.ts';
import { detecterSuivi, texteSuivi } from './suivi-plan.ts';
import { planifierPeriode } from './periode.ts';
import { alluresCoureur, footing, planifierCourse, profilCourseDepuisResume, seanceIntervalles, seanceTempoContinu, sortieLongue } from './plan-course.ts';
import type { DemandeCourse, SeanceCourse } from './plan-course.ts';
import type { DemandePeriode } from './periode.ts';
import { structureSeance, structureSurMesure } from './structure-seance.ts';
import type { SpecSurMesure } from './structure-seance.ts';
import { FONCTIONS_HISTORIQUE, MAX_PAR_NIVEAU, outilsExposes, trouverAction } from './coach-actions.ts';
import type { FonctionHistorique } from './coach-actions.ts';
import { coutMicroUsd } from './coach-couts.ts';
import { avecMessageUtilisateur, blocContexte, contexteDepuisResume, historiquePourModele, texteAncienPourResume } from './coach-contexte.ts';
import { estPlanning } from './coach-contexte.ts';
import type { Carte, CartePlanning, CarteSeance, EtatCarte, MessageStocke } from './coach-contexte.ts';
import { MAX_TOKENS_REPONSE, MODELE_PAR_DEFAUT, NOM_OUTIL_SEANCE, PROMPT_SYSTEME } from './coach-prompt.ts';
import { evaluerGardeFou } from './garde-fou.ts';
import type { DecisionGardeFou, DonneesGardeFou } from './garde-fou.ts';
import { blocsLigneStructure, evaluerPlan, proposerReplanification, seancesDepuisResume } from './planning.ts';
import { habitudesDepuisResume, planifierSemaine } from './semaine.ts';
import type { DemandeSemaine } from './semaine.ts';
import type { Contraintes, Operation } from './planning.ts';
import { tssEstime, typeSeance } from './menu-seances.ts';
import type { FamilleCoach } from './menu-seances.ts';
import { ajouterUsage, ErreurModele, USAGE_NUL } from './modele.ts';
import type { AppelModele, AppelOutil, ClientModele, MessageModele, Usage } from './modele.ts';
import { validerSeance } from './validateur.ts';
import type { ContexteValidation, Proposition } from './validateur.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Libre = any;

export class ErreurCoach extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = 'ErreurCoach';
    this.code = code;
    this.status = status;
  }
}

export interface Config {
  modele: string;
  /** Nombre de messages récents renvoyés en entier au modèle */
  fenetre: number;
  /** Au-delà de ce nombre de messages non résumés, les plus anciens passent dans le résumé */
  seuilResume: number;
}

/** Un message de l'utilisateur : la taille que la base accepte (plus de limite de 2000 caractères depuis le 8 nov. 2026) */
export const LONGUE_MESSAGE_MAX = 8000;

export const CONFIG_PAR_DEFAUT: Config = { modele: MODELE_PAR_DEFAUT, fenetre: 20, seuilResume: 40 };

export interface SignauxSante {
  evenements: DonneesGardeFou['evenements'];
  fcRepos: DonneesGardeFou['fcRepos'];
  hrv: DonneesGardeFou['hrv'];
  fatigue: DonneesGardeFou['fatigue'];
}

export interface LigneSeancePrevue {
  [colonne: string]: unknown;
}

/** Tout ce que le chat lit et écrit en base. Implémentation réelle : coach-chat/stockage.ts. Chaque méthode reçoit l'identifiant vérifié de l'utilisateur. */
export interface StockageCoach {
  aAcces(userId: string): Promise<boolean>;
  lireReglages(userId: string): Promise<{ accord: boolean; categories: string[] } | null>;
  compter(userId: string, jour: string, usage: Usage, microUsd: number): Promise<void>;
  /** rpc_coach_resume, lu avec les droits de l'utilisateur */
  lireResume(userId: string, jour: string, categories: string[]): Promise<unknown>;
  /** Historique long : une des fonctions SQL de lecture (rpc_coach_semaines, rpc_coach_seances), avec les droits de l'utilisateur */
  lireHistorique(userId: string, fonction: FonctionHistorique, args: Record<string, unknown>): Promise<unknown>;
  lireSignauxSante(userId: string, jour: string): Promise<SignauxSante>;
  lireMemoire(userId: string): Promise<{ resume: string; jusqua: string } | null>;
  /** Messages après `jusqua` (tous si null), du plus ancien au plus récent, 200 au plus (les plus récents) */
  lireMessagesDepuis(userId: string, jusqua: string | null): Promise<MessageStocke[]>;
  ecrireMessage(userId: string, m: { role: 'user' | 'assistant'; contenu: string; cartes: Carte[] | null }): Promise<{ id: string; created_at: string }>;
  ecrireMemoire(userId: string, resume: string, jusqua: string): Promise<void>;
  /** Lit une carte (vers = null) ou change son état si elle est dans l'état `de` : voir coach_carte_etat. null = introuvable ou pas dans l'état attendu. */
  changerEtatCarte(userId: string, carteId: string, de: EtatCarte | null, vers: EtatCarte | null, motif?: string, seanceId?: string): Promise<{ messageId: string; carte: Carte } | null>;
  /** Crée la séance prévue AVEC les droits de l'utilisateur (la RLS s'applique). Renvoie son identifiant. */
  insererSeance(userId: string, ligne: LigneSeancePrevue): Promise<string>;
  /** Applique un plan de modifications EN UNE TRANSACTION, avec les droits de l'utilisateur (coach_appliquer_plan). Renvoie de quoi le défaire. Lève une erreur dont le message est le code de la base. */
  appliquerPlan(userId: string, operations: Record<string, unknown>[]): Promise<unknown[]>;
  /** Défait un plan appliqué (coach_annuler_plan). Au mieux : les lignes que l'utilisateur a modifiées depuis sont ignorées et comptées. */
  annulerPlan(userId: string, inverse: unknown[]): Promise<{ annulees: number; ignorees: number }>;
  /** Garde dans la carte de quoi annuler (null pour le retirer) */
  memoriserInverse(userId: string, carteId: string, inverse: unknown[] | null): Promise<void>;
  /** Supprime une séance créée par l'IA (jamais une autre). Renvoie false si elle n'existe plus. */
  supprimerSeanceIA(userId: string, seanceId: string): Promise<boolean>;
}

export interface Dependances {
  modele: ClientModele;
  stockage: StockageCoach;
  config: Config;
  maintenant: () => Date;
  uuid: () => string;
}

export type EvenementCoach =
  | { type: 'texte'; delta: string }
  | { type: 'carte'; message_id: string; carte: Carte }
  /** Action sans danger (ouvrir un écran…) que l'application exécute tout de suite. Elle n'est pas enregistrée : on ne la rejoue pas au rechargement. */
  | { type: 'action'; nom: string; params: Record<string, unknown> }
  | { type: 'fin'; message_id: string; texte: string }
  | { type: 'erreur'; code: string; message: string };

/** La date du jour pour l'utilisateur (Paris), « AAAA-MM-JJ » */
export function jourLocal(d: Date, fuseau = 'Europe/Paris'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const MESSAGE_REFUS = "Je ne peux pas répondre à ça. Tu peux me poser une autre question sur ton entraînement ?";
const MESSAGE_VIDE = "Je n'ai rien à te répondre là-dessus. Tu peux reformuler ?";
const MESSAGE_CARTES = 'Voilà ce que je te propose.';

const NOM_SPORT: Record<FamilleCoach, string> = { velo: 'Vélo', course: 'Course', natation: 'Natation' };
/** Le type brut que l'app attend dans activity_planned.sport */
const SPORT_BRUT: Record<FamilleCoach, string> = { velo: 'Ride', course: 'Run', natation: 'Swim' };

// ---------- Préparation commune : données, garde-fou, contexte de validation ----------

const nombre = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

export function donneesGardeFou(jour: string, resume: Libre, signaux: SignauxSante): DonneesGardeFou {
  return {
    date: jour,
    tsb: nombre(resume?.forme?.tsb),
    tss7: nombre(resume?.charge?.tss_7_jours),
    tss7Prec: nombre(resume?.charge?.tss_7_jours_precedents),
    indisponibilites: (Array.isArray(resume?.indisponibilites) ? resume.indisponibilites : [])
      .filter((i: Libre) => ['maladie', 'blessure', 'indisponible'].includes(i?.type) && typeof i?.du === 'string' && typeof i?.au === 'string')
      .map((i: Libre) => ({ type: i.type, du: i.du, au: i.au })),
    evenements: signaux.evenements,
    fcRepos: signaux.fcRepos,
    hrv: signaux.hrv,
    fatigue: signaux.fatigue,
  };
}

interface Preparation {
  resume: Libre;
  decision: DecisionGardeFou;
  ctx: ContexteValidation;
}

async function preparer(userId: string, jour: string, s: StockageCoach, categories: string[]): Promise<Preparation> {
  const [resume, signaux] = await Promise.all([s.lireResume(userId, jour, categories), s.lireSignauxSante(userId, jour)]);
  if (!resume || typeof resume !== 'object') throw new ErreurCoach('donnees_indisponibles', 500, "Je n'arrive pas à lire tes données pour le moment.");
  const decision = evaluerGardeFou(donneesGardeFou(jour, resume, signaux));
  return { resume, decision, ctx: contexteDepuisResume(resume, decision, jour) };
}

// ---------- L'outil proposer_seance ----------

function lireProposition(input: unknown): { proposition: Proposition; justification: string } | null {
  if (!input || typeof input !== 'object') return null;
  const i = input as Record<string, unknown>;
  if (typeof i.date !== 'string' || typeof i.sport !== 'string' || typeof i.type !== 'string' || typeof i.minutes !== 'number') return null;
  const justification = typeof i.justification === 'string' ? i.justification.trim().slice(0, 300) : '';
  return { proposition: { date: i.date, sport: i.sport, type: i.type, minutes: i.minutes }, justification };
}

const MAX_CARTES = 3;
/** Un tour = un appel au modèle. Ce n'est plus une règle du produit mais un garde-fou technique contre une boucle d'outils sans fin (8 nov. 2026 : 4 → 12). */
const TOURS_MAX = 12;

interface EtatOutils {
  ctx: ContexteValidation;
  resume: Libre;
  jour: string;
  nbLectures: { n: number };
  cartes: Carte[];
  directes: { nom: string; params: Record<string, unknown> }[];
  uuid: () => string;
  lireHistorique: (fonction: FonctionHistorique, args: Record<string, unknown>) => Promise<unknown>;
}

async function traiterOutil(appel: AppelOutil, e: EtatOutils): Promise<{ contenu: string; erreur: boolean }> {
  const { ctx, resume, nbLectures, cartes, directes, uuid } = e;
  const def = trouverAction(appel.name);
  // Un outil absent du registre, ou pas encore branché, n'existe pas pour le modèle (même s'il l'invente)
  if (!def || !def.disponible) return { contenu: "Cet outil n'existe pas.", erreur: true };

  if (def.niveau === 'lecture') {
    const lu = def.lire ? def.lire(appel.input) : { ok: false as const, erreur: 'Lecture non lisible.' };
    if (!lu.ok) return { contenu: `Paramètres invalides : ${lu.erreur}`, erreur: true };
    nbLectures.n++;
    if (def.requete) {
      // Historique long : la fonction vient du registre (liste fermée), jamais du modèle
      if (!FONCTIONS_HISTORIQUE.includes(def.requete.fonction)) return { contenu: "Cet outil n'existe pas.", erreur: true };
      try {
        return { contenu: JSON.stringify(await e.lireHistorique(def.requete.fonction, def.requete.args(lu.params, e.jour))), erreur: false };
      } catch {
        console.error('coach-chat: lecture de l\'historique échouée');
        return { contenu: "Je n'arrive pas à lire l'historique pour le moment. Réponds avec ce que tu as déjà.", erreur: true };
      }
    }
    if (!def.repondre) return { contenu: 'Lecture non branchée.', erreur: true };
    return { contenu: JSON.stringify(def.repondre(lu.params, resume)), erreur: false };
  }

  if (def.niveau === 'direct') {
    const lu = def.lire ? def.lire(appel.input) : { ok: false as const, erreur: 'Action non lisible.' };
    if (!lu.ok) return { contenu: `Paramètres invalides : ${lu.erreur}`, erreur: true };
    directes.push({ nom: def.nom, params: lu.params });
    return { contenu: "Fait : l'application exécute l'action tout de suite.", erreur: false };
  }

  // Replanification : UNE carte de planning par message, jamais mélangée à d'autres cartes
  if (def.nom === 'proposer_replanification' || def.nom === 'modifier_planning' || def.nom === 'planifier_semaine' || def.nom === 'planifier_periode' || def.nom === 'preparer_course' || def.nom === 'ajuster_seance_course' || def.nom === 'ajuster_seance') {
    if (cartes.length > 0) return { contenu: "Une seule carte de planning à la fois, et pas avec une autre carte : attends que l'utilisateur la valide ou la refuse.", erreur: true };
    const lu = def.lire ? def.lire(appel.input) : { ok: false as const, erreur: 'Outil non lisible.' };
    if (!lu.ok) return { contenu: `Paramètres invalides : ${lu.erreur}`, erreur: true };
    const seances = seancesDepuisResume(resume);
    let operations: Operation[];
    let notes: string[] = [];
    let resumePeriode: string[] = [];
    // Ce que le code dit du niveau et de l'objectif : le modèle le reprend tel quel
    let bilanTexte = '';
    // Les fiches qui fondent le plan (distance, calibrage) : le coach explique le pourquoi avec les mêmes sources que le moteur
    let fondements = '';
    if (def.nom === 'planifier_semaine') {
      const res = planifierSemaine(lu.params.demande as DemandeSemaine, seances, ctx, habitudesDepuisResume(resume));
      if (!res.operations.length) {
        return { contenu: `Je n'ai pas pu construire cette semaine : ${res.abandons.join(' ') || 'aucune séance possible.'} Explique-le simplement à l'utilisateur, sans créer de carte, et propose une autre façon de faire.`, erreur: false };
      }
      operations = res.operations;
      notes = res.abandons;
    } else if (def.nom === 'preparer_course') {
      const demande = lu.params.demande as Partial<DemandeCourse>;
      // La course visée : celle que dit l'utilisateur, sinon la prochaine course à pied du calendrier (distance et temps visé compris)
      const courses = (Array.isArray(resume?.competitions) ? resume.competitions : []).filter((c: { sport?: string; date?: string }) => c?.sport === 'course' && typeof c.date === 'string' && c.date > ctx.aujourdhui);
      const calendrier = demande.date ? courses.find((c: { date: string }) => c.date === demande.date) : courses[0];
      const date = demande.date ?? calendrier?.date;
      if (!date) {
        return { contenu: "Je ne trouve aucune course à pied à venir dans le calendrier et l'utilisateur n'a pas donné de date. Demande-lui la date de sa course (et, s'il le veut, la distance et le temps visé), sans créer de carte.", erreur: false };
      }
      // Un plan déjà ajouté par le coach (séances de course créées par l'IA entre le début et la course) est REMPLACÉ : on retire les anciennes séances et on pose les nouvelles
      const debutPlan = demande.debut && demande.debut > ctx.aujourdhui ? demande.debut : ctx.aujourdhui;
      const anciennes = seances.filter((x) => x.creeeParIa && x.sport === 'course' && x.date >= debutPlan && x.date < date);
      const ids = new Set(anciennes.map((x) => x.id));
      const res = planifierCourse({
        allures: demande.allures,
        chrono: demande.chrono,
        sansTest: demande.sansTest,
        date,
        km: demande.km ?? (typeof calendrier?.km === 'number' && calendrier.km > 0 ? calendrier.km : 10),
        tempsCibleMinutes: demande.tempsCibleMinutes ?? (typeof calendrier?.temps_cible_min === 'number' ? calendrier.temps_cible_min : undefined),
        debut: demande.debut,
        seancesParSemaine: demande.seancesParSemaine,
        joursLibres: demande.joursLibres,
      }, seances.filter((x) => !ids.has(x.id)), ctx, profilCourseDepuisResume(resume));
      if (!res.operations.length) {
        return { contenu: `Je n'ai pas pu construire ce plan : ${res.abandons.join(' ') || 'aucune séance possible.'} Explique-le simplement à l'utilisateur, sans créer de carte, et propose une autre façon de faire.`, erreur: false };
      }
      operations = [...anciennes.map((x): Operation => ({ op: 'supprimer', seanceId: x.id, raison: 'remplacée par le plan mis à jour' })), ...res.operations];
      notes = res.abandons;
      resumePeriode = res.semaines;
      bilanTexte = res.message;
      fondements = fondementsPlanCourse(res.bilan?.km ?? 10, res.bilan?.test ?? false);
      if (anciennes.length) notes = [`${anciennes.length} séance${anciennes.length > 1 ? 's' : ''} de l'ancien plan ${anciennes.length > 1 ? 'sont remplacées' : 'est remplacée'} par le nouveau`, ...notes];
    } else if (def.nom === 'ajuster_seance_course') {
      const spec = lu.params.seance as { date: string; genre: string; reps?: number; metres?: number; minutes?: number; allure?: number; recupSecondes?: number };
      const ancienne = seances.find((x) => x.date === spec.date && x.sport === 'course');
      if (!ancienne) {
        return { contenu: `Aucune séance de course n'est prévue le ${spec.date}. Dis-le à l'utilisateur sans créer de carte (regarde prevues pour les dates), ou propose d'en ajouter une.`, erreur: false };
      }
      const a = alluresCoureur(resume, ctx.aujourdhui);
      let nouvelle: SeanceCourse;
      if (spec.genre === 'intervalles') {
        const metres = spec.metres as number;
        nouvelle = seanceIntervalles({ reps: spec.reps as number, metres, allure: spec.allure ?? (metres <= 800 ? a.vma : a.course), recupSecondes: spec.recupSecondes ?? (metres <= 400 ? 75 : metres <= 800 ? 90 : metres < 1500 ? 90 : 120) }, a);
      } else if (spec.genre === 'tempo_continu') {
        nouvelle = seanceTempoContinu({ minutes: spec.minutes as number, allure: spec.allure ?? a.tempo }, a);
      } else if (spec.genre === 'sortie_longue') {
        nouvelle = sortieLongue(spec.minutes as number, a, false);
      } else {
        nouvelle = footing(spec.minutes as number, a, false);
      }
      operations = [
        { op: 'supprimer', seanceId: ancienne.id, raison: 'remplacée par la séance adaptée' },
        { op: 'ajouter', proposition: { date: spec.date, sport: 'course', type: nouvelle.type, minutes: nouvelle.minutes }, justification: nouvelle.but, detail: nouvelle.detail },
      ];
    } else if (def.nom === 'ajuster_seance') {
      const spec = lu.params.seance as SpecSurMesure & { date: string; sport: 'velo' | 'natation' };
      const ancienne = seances.find((x) => x.date === spec.date && x.sport === spec.sport);
      if (!ancienne) {
        return { contenu: `Aucune séance de ${spec.sport === 'velo' ? 'vélo' : 'natation'} n'est prévue le ${spec.date}. Dis-le à l'utilisateur sans créer de carte (regarde prevues pour les dates), ou propose d'en ajouter une.`, erreur: false };
      }
      const nouvelle = structureSurMesure(spec.sport, spec);
      operations = [
        { op: 'supprimer', seanceId: ancienne.id, raison: 'remplacée par la séance adaptée' },
        { op: 'ajouter', proposition: { date: spec.date, sport: spec.sport, type: nouvelle.type, minutes: nouvelle.minutes }, justification: String(lu.params.intention), detail: { nom: nouvelle.nom, structure: nouvelle.structure, resume: nouvelle.resume } },
      ];
    } else if (def.nom === 'planifier_periode') {
      const res = planifierPeriode(lu.params.demande as DemandePeriode, seances, ctx, habitudesDepuisResume(resume));
      if (!res.operations.length) {
        return { contenu: `Je n'ai pas pu construire ce plan : ${res.abandons.join(' ') || 'aucune séance possible.'} Explique-le simplement à l'utilisateur, sans créer de carte, et propose une autre façon de faire.`, erreur: false };
      }
      operations = res.operations;
      notes = res.abandons;
      resumePeriode = res.semaines;
    } else if (def.nom === 'proposer_replanification') {
      operations = proposerReplanification(lu.params.contraintes as Contraintes, seances, ctx);
      if (!operations.length) return { contenu: "Rien à modifier : aucune séance prévue n'est touchée par cette contrainte. Dis-le simplement à l'utilisateur, sans créer de carte.", erreur: false };
    } else {
      operations = lu.params.operations as Operation[];
    }
    const r = evaluerPlan(operations, seances, ctx);
    if (!r.ok) return { contenu: `Plan refusé par les règles : ${r.erreurs.join(' | ')}`, erreur: true };
    const carte: CartePlanning = {
      ...(bilanTexte ? { bilan: bilanTexte } : {}),
      id: uuid(),
      genre: 'planning',
      etat: 'proposee',
      intention: String(lu.params.intention),
      operations,
      lignes: r.lignes,
      charge_avant: r.chargeAvant,
      charge_apres: r.chargeApres,
    };
    cartes.push(carte);
    // Un plan long : le modèle lit le résumé semaine par semaine, pas les centaines de lignes (la carte, elle, les montre toutes)
    const detail = r.lignes.length > 30 && resumePeriode.length ? resumePeriode.map((l) => `- ${l}`).join('\n') : r.lignes.map((l) => `- ${l.texte}${l.raison ? ` (${l.raison})` : ''}`).join('\n');
    const signaux = [...notes, ...r.avertissements];
    const bilan = bilanTexte ? `\nBilan établi par le code (à reprendre fidèlement, sans l'adoucir) : ${bilanTexte}\nSemaines :\n${resumePeriode.map((l) => `- ${l}`).join('\n')}` : '';
    const base = fondements ? `\nFondements du plan, tirés de la base de connaissances (pour expliquer le POURQUOI des séances ; n'invente aucun chiffre absent de ces fiches) :\n${fondements}` : '';
    const avert = signaux.length ? `\nÀ signaler à l'utilisateur : ${signaux.join(' ; ')}` : '';
    return {
      contenu:
        `Carte de planning créée (${r.lignes.length} modification(s), charge prévue sur 14 jours : ${r.chargeAvant} → ${r.chargeApres} points) :\n${detail}${bilan}${base}${avert}\n` +
        "L'utilisateur la verra et la validera lui-même : rien n'est modifié tant qu'il n'a pas validé, ne dis donc jamais que c'est fait. Explique le plan en quelques phrases simples, avec les raisons.",
      erreur: false,
    };
  }

  // Niveaux « carte » et « confirmation » : seul proposer_seance reste à traiter
  if (def.nom !== NOM_OUTIL_SEANCE) return { contenu: "Cet outil n'existe pas.", erreur: true };
  if (cartes.some(estPlanning)) return { contenu: "Une carte de planning est déjà proposée dans ce message : n'ajoute pas d'autre carte.", erreur: true };
  if (cartes.length >= MAX_CARTES) return { contenu: `Trois cartes au maximum par message : ne propose pas d'autre séance.`, erreur: true };
  const lue = lireProposition(appel.input);
  if (!lue) return { contenu: 'Paramètres invalides : date, sport, type, minutes et justification sont obligatoires.', erreur: true };
  // Les cartes déjà proposées dans ce message comptent comme prévues : trois cartes qui passent chacune seule ne doivent pas dépasser la limite ensemble
  const ctxTour: ContexteValidation = { ...ctx, prevues: [...ctx.prevues, ...cartes.filter((c): c is CarteSeance => !estPlanning(c)).map((c) => ({ date: c.proposition.date, tss: c.tss_estime }))] };
  const r = validerSeance(lue.proposition, ctxTour);
  if (!r.ok) return { contenu: `Séance refusée par les règles : ${r.erreurs.map((e) => e.message).join(' ')}`, erreur: true };
  cartes.push({ id: uuid(), etat: 'proposee', proposition: lue.proposition, tss_estime: r.tssEstime ?? 0, justification: lue.justification, blocs: blocsLigneStructure(lue.proposition) });
  return { contenu: `Carte créée (charge estimée : ${r.tssEstime} points). L'utilisateur la verra et l'ajoutera lui-même à son calendrier.`, erreur: false };
}

// ---------- Appel au modèle, avec un seul nouvel essai ----------

async function appelerModele(modele: ClientModele, appel: AppelModele, surTexte: (d: string) => void) {
  let emis = false;
  for (let essai = 0; ; essai++) {
    try {
      return await modele.repondre(appel, (d) => {
        emis = true;
        surTexte(d);
      });
    } catch (e) {
      // Un seul nouvel essai, et seulement si rien n'est encore parti vers l'utilisateur (sinon le texte serait doublé)
      if (e instanceof ErreurModele && e.transitoire && essai === 0 && !emis) continue;
      console.error('coach-chat: appel au modèle échoué', e instanceof ErreurModele ? (e.transitoire ? 'transitoire' : 'définitif') : 'inattendu');
      throw new ErreurCoach('modele_indisponible', 502, "Je n'arrive pas à répondre pour le moment. Réessaie dans un instant.");
    }
  }
}

// ---------- Un message de l'utilisateur ----------

export async function traiterMessage(userId: string, texteBrut: unknown, deps: Dependances, emettre: (e: EvenementCoach) => void): Promise<{ messageId: string; usage: Usage }> {
  const { stockage: s, config, modele } = deps;

  const texte = typeof texteBrut === 'string' ? texteBrut.trim() : '';
  if (!texte || texte.length > LONGUE_MESSAGE_MAX) throw new ErreurCoach('message_invalide', 400, `Ton message doit faire entre 1 et ${LONGUE_MESSAGE_MAX} caractères.`);

  if (!(await s.aAcces(userId))) throw new ErreurCoach('acces_refuse', 403, "Le coach n'est pas encore ouvert pour ton compte.");
  const reglagesBrut = await s.lireReglages(userId);
  if (!reglagesBrut?.accord) throw new ErreurCoach('accord_requis', 403, "Avant de discuter, il faut que tu acceptes le partage de tes données avec le coach.");

  // Plus de plafond de messages ni de coupe-circuit de dépense (supprimés le 8 nov. 2026). La dépense reste COMPTÉE (compter) mais ne bloque rien.
  const jour = jourLocal(deps.maintenant());

  const { resume, decision, ctx } = await preparer(userId, jour, s, reglagesBrut.categories);

  // Le garde-fou a parlé : réponse fixe, le modèle n'est pas appelé
  if (!decision.autoriserModele) {
    const reponse = decision.message ?? MESSAGE_VIDE;
    emettre({ type: 'texte', delta: reponse });
    await s.ecrireMessage(userId, { role: 'user', contenu: texte, cartes: null });
    const m = await s.ecrireMessage(userId, { role: 'assistant', contenu: reponse, cartes: null });
    emettre({ type: 'fin', message_id: m.id, texte: reponse });
    return { messageId: m.id, usage: USAGE_NUL };
  }

  const memoire = await s.lireMemoire(userId);
  const depuis = await s.lireMessagesDepuis(userId, memoire?.jusqua ?? null);
  const historique = historiquePourModele(depuis.slice(-config.fenetre));
  // Les fiches de la base de connaissances proches de ce message sont glissées dans le contexte : le coach s'en sert sans avoir à les chercher
  const dernierMessage = [...depuis].reverse().find((m) => m.role === 'user')?.contenu;
  const contexte = blocContexte({ aujourdhui: jour, resume, memoire: memoire?.resume ?? null, decision, connaissances: extraitsConnaissance(texte, dernierMessage, 2, 1200, estCoureur(resume)), suivi: texteSuivi(detecterSuivi(resume, jour, { dernierPlan: dernierPlanLe(depuis) })) });
  let messages: MessageModele[] = avecMessageUtilisateur(historique, contexte, texte);

  const cartes: Carte[] = [];
  const directes: { nom: string; params: Record<string, unknown> }[] = [];
  const nbLectures = { n: 0 };
  const textes: string[] = [];
  let usage = USAGE_NUL;
  let refus = false;

  for (let tour = 0; tour < TOURS_MAX; tour++) {
    let premierDelta = true;
    const reponse = await appelerModele(
      modele,
      { system: PROMPT_SYSTEME, messages, outils: outilsExposes(), maxTokens: MAX_TOKENS_REPONSE },
      (delta) => {
        // Un deuxième tour (après un outil) continue le texte du premier : un saut de ligne les sépare
        if (premierDelta && textes.length) emettre({ type: 'texte', delta: '\n\n' });
        premierDelta = false;
        emettre({ type: 'texte', delta });
      },
    );
    usage = ajouterUsage(usage, reponse.usage);
    if (reponse.texte.trim()) textes.push(reponse.texte.trim());
    if (reponse.arret === 'refus') {
      refus = true;
      break;
    }
    // Pas d'outil, ou une réponse coupée (jamais d'outil lancé sur une entrée tronquée) : fini
    if (!reponse.outils.length || reponse.arret === 'longueur') break;

    const etat: EtatOutils = { ctx, resume, jour, nbLectures, cartes, directes, uuid: deps.uuid, lireHistorique: (f, a) => s.lireHistorique(userId, f, a) };
    const resultats: { type: string; tool_use_id: string; content: string; is_error?: boolean }[] = [];
    // Un par un, dans l'ordre : les cartes d'un même tour se comptent ensemble
    for (const o of reponse.outils) {
      const avant = directes.length;
      const r = await traiterOutil(o, etat);
      for (const d of directes.slice(avant)) emettre({ type: 'action', nom: d.nom, params: d.params });
      resultats.push({ type: 'tool_result', tool_use_id: o.id, content: r.contenu, ...(r.erreur ? { is_error: true } : {}) });
    }
    messages = [...messages, { role: 'assistant', content: reponse.brut }, { role: 'user', content: resultats }];
  }

  let reponseFinale = textes.join('\n\n');
  if (refus && !reponseFinale) reponseFinale = MESSAGE_REFUS;
  if (!reponseFinale) reponseFinale = cartes.length ? MESSAGE_CARTES : MESSAGE_VIDE;

  await s.ecrireMessage(userId, { role: 'user', contenu: texte, cartes: null });
  const m = await s.ecrireMessage(userId, { role: 'assistant', contenu: reponseFinale, cartes: cartes.length ? cartes : null });
  for (const carte of cartes) emettre({ type: 'carte', message_id: m.id, carte });
  // Un nouveau plan remplace les plans encore « proposés » plus haut dans la conversation : ils ne doivent plus pouvoir être ajoutés par erreur
  if (cartes.some(estPlanning)) {
    for (const ancien of depuis) {
      for (const c of ancien.cartes ?? []) {
        if (estPlanning(c) && c.etat === 'proposee') {
          try { await s.changerEtatCarte(userId, c.id, 'proposee', 'refusee', 'Remplacé par un nouveau plan.'); } catch { console.error('coach-chat: ancien plan non retiré'); }
        }
      }
    }
  }
  emettre({ type: 'fin', message_id: m.id, texte: reponseFinale });

  try {
    await s.compter(userId, jour, usage, coutMicroUsd(config.modele, usage));
  } catch {
    console.error('coach-chat: comptage des tokens échoué');
  }
  return { messageId: m.id, usage };
}

// ---------- La mémoire : résumé glissant ----------

/** À appeler après la réponse. Résume les plus anciens messages quand il y en a trop. Renvoie true si le résumé a été mis à jour. */
export async function maintenirMemoire(userId: string, deps: Dependances): Promise<boolean> {
  const { stockage: s, config, modele } = deps;
  const memoire = await s.lireMemoire(userId);
  const depuis = await s.lireMessagesDepuis(userId, memoire?.jusqua ?? null);
  if (depuis.length <= config.seuilResume) return false;
  const anciens = depuis.slice(0, depuis.length - config.fenetre);
  const { texte, usage } = await modele.resumer({ resumeActuel: memoire?.resume ?? null, anciens: texteAncienPourResume(anciens) });
  const resume = texte.trim().slice(0, 4000);
  if (!resume) return false;
  await s.ecrireMemoire(userId, resume, anciens[anciens.length - 1].created_at);
  await s.compter(userId, jourLocal(deps.maintenant()), usage, coutMicroUsd(config.modele, usage));
  return true;
}

// ---------- Les cartes : Ajouter et Annuler ----------

/** La ligne à écrire dans activity_planned pour une carte (mêmes champs que l'ajout à la main dans l'app) */
export function ligneSeancePrevue(carte: CarteSeance, userId: string): LigneSeancePrevue {
  const p = carte.proposition;
  const sport = p.sport as FamilleCoach;
  const type = typeSeance(sport, p.type);
  return {
    user_id: userId,
    category: 'entrainement',
    name: `${NOM_SPORT[sport]} · ${type?.nom ?? p.type}`,
    date: p.date,
    start_date_local: `${p.date}T09:00:00`,
    sport: SPORT_BRUT[sport],
    duration: p.minutes,
    tss: carte.tss_estime,
    // Jamais de séance « vierge » : la structure (celle de la carte, sinon reconstruite par le code d'après le type et la durée) est toujours écrite
    structure: carte.blocs ?? structureSeance(sport, p.type, p.minutes),
    notes: carte.justification ? carte.justification.slice(0, 500) : null,
    created_by_ia: true,
    // Une clé stable par carte : deux « Ajouter » sur la même carte ne peuvent désigner qu'une seule séance
    client_id: `coach-${carte.id}`,
  };
}

export type ResultatAjout =
  | { ok: true; seanceId: string | null; carte: Carte }
  | { ok: false; code: 'refusee'; erreurs: { code: string; message: string }[] };

/** Les opérations d'une carte de planning, dans le format de la fonction SQL coach_appliquer_plan (mêmes champs que l'ajout à la main) */
/** La date du dernier plan proposé ou appliqué dans la conversation (ni refusé ni annulé) : le suivi ne relève pas deux fois la même alerte */
function dernierPlanLe(messages: MessageStocke[]): string | null {
  let dernier: string | null = null;
  for (const m of messages) {
    if (!m.cartes?.some((c) => estPlanning(c) && c.etat !== 'refusee' && c.etat !== 'annulee')) continue;
    const jour = String(m.created_at ?? '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(jour) && (dernier === null || jour > dernier)) dernier = jour;
  }
  return dernier;
}

/** Le résumé décrit-il un coureur ? (une course à pied à venir, ou des sorties de course sur les 90 derniers jours) */
// deno-lint-ignore no-explicit-any
function estCoureur(resume: any): boolean {
  const courses = Array.isArray(resume?.competitions) ? resume.competitions.some((c: { sport?: string }) => c?.sport === 'course') : false;
  const sorties = typeof resume?.profil_course?.sorties_90_jours === 'number' ? resume.profil_course.sorties_90_jours : 0;
  return courses || sorties > 0;
}

export function operationsPourEcriture(operations: Operation[], carteId: string): Record<string, unknown>[] {
  return operations.map((o, i): Record<string, unknown> => {
    switch (o.op) {
      case 'indisponibilite':
        return { op: 'indisponibilite', type: o.type, du: o.du, au: o.au, client_id: `coach-${carteId}-${i}` };
      case 'deplacer':
        return { op: 'deplacer', seance_id: o.seanceId, vers: o.vers };
      case 'supprimer':
        return { op: 'supprimer', seance_id: o.seanceId };
      case 'repos':
        return { op: o.poser ? 'poser_repos' : 'retirer_repos', date: o.date };
      case 'ajouter': {
        const p = o.proposition;
        const sport = p.sport as FamilleCoach;
        const type = typeSeance(sport, p.type);
        return {
          op: 'ajouter',
          date: p.date,
          name: `${NOM_SPORT[sport]} · ${o.detail?.nom ?? type?.nom ?? p.type}`.slice(0, 120),
          sport: SPORT_BRUT[sport],
          duration: p.minutes,
          tss: type ? tssEstime(type, p.minutes) : 0,
          notes: o.justification ? o.justification.slice(0, 500) : null,
          start: `${p.date}T09:00:00`,
          // jamais de séance « vierge » : la structure est toujours construite par le code, d'après le type et la durée exacte
          structure: o.detail?.structure ?? structureSeance(sport, p.type, p.minutes),
          client_id: `coach-${carteId}-${i}`,
        };
      }
    }
  });
}

/** Ce que l'utilisateur lit quand la base refuse un plan (jamais le détail technique) */
function messageEchecPlan(e: unknown): string {
  const code = e instanceof Error ? e.message : '';
  if (code.includes('seance_introuvable')) return "Une des séances n'est plus dans ton calendrier : le plan a changé, demande-moi de le refaire.";
  if (code.includes('seance_trop_lourde')) return "Une des séances contient un fichier (trace, structure détaillée) : je ne la supprime pas moi-même. Supprime-la à la main, puis revalide.";
  if (code.includes('annulation_trop_lourde')) return "Ce plan est trop gros pour être annulé d'un tap : demande-le en deux fois.";
  return "Je n'ai pas réussi à appliquer le plan. Rien n'a été modifié. Réessaie.";
}

/** Valider une carte de planning : tout est revérifié, appliqué en UNE transaction, et de quoi annuler est gardé dans la carte. */
async function appliquerPlanning(userId: string, carteId: string, carte: CartePlanning, deps: Dependances): Promise<ResultatAjout> {
  const { stockage: s } = deps;
  if (carte.etat === 'ajoutee') return { ok: true, seanceId: null, carte };
  if (carte.etat === 'en_cours') throw new ErreurCoach('deja_en_cours', 409, 'Ce plan est déjà en train d\'être appliqué.');
  if (carte.etat !== 'proposee') throw new ErreurCoach('carte_non_ajoutable', 409, 'Cette carte ne peut plus être appliquée.');

  // Le calendrier a pu changer depuis la proposition : on revérifie TOUT le plan sur l'état d'aujourd'hui
  const jour = jourLocal(deps.maintenant());
  const { ctx, resume } = await preparer(userId, jour, s, []);
  const verdict = evaluerPlan(carte.operations, seancesDepuisResume(resume), ctx);
  if (!verdict.ok) {
    await s.changerEtatCarte(userId, carteId, 'proposee', 'refusee', verdict.erreurs[0]);
    return { ok: false, code: 'refusee', erreurs: verdict.erreurs.map((message) => ({ code: 'plan', message })) };
  }

  // Une seule requête passe de « proposee » à « en_cours » : un double tap s'arrête ici
  const prise = await s.changerEtatCarte(userId, carteId, 'proposee', 'en_cours');
  if (!prise) throw new ErreurCoach('deja_en_cours', 409, 'Ce plan est déjà en train d\'être appliqué.');

  let inverse: unknown[];
  try {
    inverse = await s.appliquerPlan(userId, operationsPourEcriture(carte.operations, carteId));
  } catch (e) {
    await s.changerEtatCarte(userId, carteId, 'en_cours', 'proposee');
    console.error('coach-chat: application du plan échouée');
    throw new ErreurCoach('ecriture_echouee', 500, messageEchecPlan(e));
  }
  try {
    await s.memoriserInverse(userId, carteId, inverse);
  } catch {
    // Le plan EST appliqué : on ne le renie pas. Seule l'annulation automatique sera indisponible.
    console.error("coach-chat: mémorisation de l'annulation échouée");
  }
  const finale = await s.changerEtatCarte(userId, carteId, 'en_cours', 'ajoutee');
  return { ok: true, seanceId: null, carte: finale?.carte ?? { ...prise.carte, etat: 'ajoutee' } };
}

/** L'utilisateur tape « Ajouter » : tout est revalidé avec les données du moment, puis la séance est écrite avec SES droits. */
export async function ajouterCarte(userId: string, carteId: unknown, deps: Dependances): Promise<ResultatAjout> {
  const { stockage: s } = deps;
  if (typeof carteId !== 'string' || !carteId || carteId.length > 80) throw new ErreurCoach('carte_invalide', 400, 'Carte invalide.');
  if (!(await s.aAcces(userId))) throw new ErreurCoach('acces_refuse', 403, "Le coach n'est pas encore ouvert pour ton compte.");

  const lue = await s.changerEtatCarte(userId, carteId, null, null);
  if (!lue) throw new ErreurCoach('carte_introuvable', 404, "Cette carte n'existe plus.");
  if (estPlanning(lue.carte)) return appliquerPlanning(userId, carteId, lue.carte, deps);
  if (lue.carte.etat === 'ajoutee' && lue.carte.seance_id) return { ok: true, seanceId: lue.carte.seance_id, carte: lue.carte };
  if (lue.carte.etat === 'en_cours') throw new ErreurCoach('deja_en_cours', 409, "Cette séance est déjà en train d'être ajoutée.");
  if (lue.carte.etat !== 'proposee') throw new ErreurCoach('carte_non_ajoutable', 409, 'Cette carte ne peut plus être ajoutée.');

  const jour = jourLocal(deps.maintenant());
  const { ctx } = await preparer(userId, jour, s, []);
  const verdict = validerSeance(lue.carte.proposition, ctx);
  if (!verdict.ok) {
    await s.changerEtatCarte(userId, carteId, 'proposee', 'refusee', verdict.erreurs[0]?.message);
    return { ok: false, code: 'refusee', erreurs: verdict.erreurs };
  }

  // Une seule requête passe de « proposee » à « en_cours » : un double tap s'arrête ici
  const prise = await s.changerEtatCarte(userId, carteId, 'proposee', 'en_cours');
  if (!prise) throw new ErreurCoach('deja_en_cours', 409, "Cette séance est déjà en train d'être ajoutée.");
  if (estPlanning(prise.carte)) throw new ErreurCoach('carte_non_ajoutable', 409, 'Cette carte ne peut plus être ajoutée.');

  let seanceId: string;
  try {
    seanceId = await s.insererSeance(userId, ligneSeancePrevue(prise.carte, userId));
  } catch {
    await s.changerEtatCarte(userId, carteId, 'en_cours', 'proposee');
    console.error("coach-chat: écriture de la séance échouée");
    throw new ErreurCoach('ecriture_echouee', 500, "Je n'ai pas réussi à ajouter la séance. Réessaie.");
  }
  const finale = await s.changerEtatCarte(userId, carteId, 'en_cours', 'ajoutee', undefined, seanceId);
  return { ok: true, seanceId, carte: finale?.carte ?? { ...prise.carte, etat: 'ajoutee', seance_id: seanceId } };
}

/** L'utilisateur annule une séance qu'il avait ajoutée depuis une carte : la séance part du calendrier, la carte passe à « annulée ». */
export async function annulerCarte(userId: string, carteId: unknown, deps: Dependances): Promise<{ ok: true; annulees?: number; ignorees?: number }> {
  const { stockage: s } = deps;
  if (typeof carteId !== 'string' || !carteId || carteId.length > 80) throw new ErreurCoach('carte_invalide', 400, 'Carte invalide.');
  if (!(await s.aAcces(userId))) throw new ErreurCoach('acces_refuse', 403, "Le coach n'est pas encore ouvert pour ton compte.");
  const lue = await s.changerEtatCarte(userId, carteId, null, null);
  if (!lue) throw new ErreurCoach('carte_introuvable', 404, "Cette carte n'existe plus.");

  // Un plan : on le défait en une transaction, puis la carte passe à « annulée »
  if (estPlanning(lue.carte)) {
    if (lue.carte.etat !== 'ajoutee') throw new ErreurCoach('carte_non_annulable', 409, "Ce plan n'est pas appliqué à ton calendrier.");
    const inverse = lue.carte.inverse;
    if (!Array.isArray(inverse) || inverse.length === 0) {
      throw new ErreurCoach('annulation_indisponible', 409, "Je ne peux pas annuler ce plan automatiquement : remets les séances à la main dans ton calendrier.");
    }
    // Passer à « annulée » d'abord : un double tap ne défait pas deux fois
    const prise = await s.changerEtatCarte(userId, carteId, 'ajoutee', 'annulee');
    if (!prise) throw new ErreurCoach('carte_non_annulable', 409, "Ce plan n'est plus annulable.");
    let bilan: { annulees: number; ignorees: number };
    try {
      bilan = await s.annulerPlan(userId, inverse);
    } catch {
      await s.changerEtatCarte(userId, carteId, 'annulee', 'ajoutee');
      console.error("coach-chat: annulation du plan échouée");
      throw new ErreurCoach('annulation_echouee', 500, "Je n'ai pas réussi à annuler le plan. Rien n'a été modifié. Réessaie.");
    }
    try {
      await s.memoriserInverse(userId, carteId, null);
    } catch {
      console.error("coach-chat: nettoyage de l'annulation échoué");
    }
    return { ok: true, annulees: bilan.annulees, ignorees: bilan.ignorees };
  }

  if (lue.carte.etat !== 'ajoutee') throw new ErreurCoach('carte_non_annulable', 409, "Cette séance n'est pas dans ton calendrier.");
  // Si la séance a déjà été supprimée à la main, on marque quand même la carte comme annulée
  if (lue.carte.seance_id) await s.supprimerSeanceIA(userId, lue.carte.seance_id);
  await s.changerEtatCarte(userId, carteId, 'ajoutee', 'annulee');
  return { ok: true };
}
