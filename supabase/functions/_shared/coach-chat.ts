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
import { MAX_PAR_NIVEAU, outilsExposes, trouverAction } from './coach-actions.ts';
import { coutMicroUsd } from './coach-couts.ts';
import { avecMessageUtilisateur, blocContexte, contexteDepuisResume, historiquePourModele, texteAncienPourResume } from './coach-contexte.ts';
import type { CarteSeance, EtatCarte, MessageStocke } from './coach-contexte.ts';
import { MAX_TOKENS_REPONSE, MODELE_PAR_DEFAUT, NOM_OUTIL_SEANCE, PROMPT_SYSTEME } from './coach-prompt.ts';
import { evaluerGardeFou } from './garde-fou.ts';
import type { DecisionGardeFou, DonneesGardeFou } from './garde-fou.ts';
import { typeSeance } from './menu-seances.ts';
import type { FamilleCoach } from './menu-seances.ts';
import { ajouterUsage, ErreurModele, USAGE_NUL } from './modele.ts';
import type { AppelModele, AppelOutil, ClientModele, MessageModele, Usage } from './modele.ts';
import { normaliserReglages, validerSeance } from './validateur.ts';
import type { ContexteValidation, Proposition, ReglagesCoach } from './validateur.ts';

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
  messagesParJour: number;
  /** Coupe-circuit : dépense maximale du mois pour TOUS les comptes, en millionièmes de dollar (10 $ = 10 000 000) */
  budgetMicroUsd: number;
  /** Nombre de messages récents renvoyés en entier au modèle */
  fenetre: number;
  /** Au-delà de ce nombre de messages non résumés, les plus anciens passent dans le résumé */
  seuilResume: number;
}

export const CONFIG_PAR_DEFAUT: Config = { modele: MODELE_PAR_DEFAUT, messagesParJour: 30, budgetMicroUsd: 10_000_000, fenetre: 20, seuilResume: 40 };

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
  lireReglages(userId: string): Promise<{ accord: boolean; categories: string[]; seuils: unknown } | null>;
  /** Réserve un message du jour (atomique) : false = plafond atteint */
  reserverMessage(userId: string, jour: string, max: number): Promise<boolean>;
  /** Dépense du mois pour tous les comptes, en millionièmes de dollar. `mois` = « AAAA-MM-01 ». */
  depenseDuMois(mois: string): Promise<number>;
  compter(userId: string, jour: string, usage: Usage, microUsd: number): Promise<void>;
  /** rpc_coach_resume, lu avec les droits de l'utilisateur */
  lireResume(userId: string, jour: string, categories: string[]): Promise<unknown>;
  lireSignauxSante(userId: string, jour: string): Promise<SignauxSante>;
  lireMemoire(userId: string): Promise<{ resume: string; jusqua: string } | null>;
  /** Messages après `jusqua` (tous si null), du plus ancien au plus récent, 200 au plus (les plus récents) */
  lireMessagesDepuis(userId: string, jusqua: string | null): Promise<MessageStocke[]>;
  ecrireMessage(userId: string, m: { role: 'user' | 'assistant'; contenu: string; cartes: CarteSeance[] | null }): Promise<{ id: string; created_at: string }>;
  ecrireMemoire(userId: string, resume: string, jusqua: string): Promise<void>;
  /** Lit une carte (vers = null) ou change son état si elle est dans l'état `de` : voir coach_carte_etat. null = introuvable ou pas dans l'état attendu. */
  changerEtatCarte(userId: string, carteId: string, de: EtatCarte | null, vers: EtatCarte | null, motif?: string, seanceId?: string): Promise<{ messageId: string; carte: CarteSeance } | null>;
  /** Crée la séance prévue AVEC les droits de l'utilisateur (la RLS s'applique). Renvoie son identifiant. */
  insererSeance(userId: string, ligne: LigneSeancePrevue): Promise<string>;
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
  | { type: 'carte'; message_id: string; carte: CarteSeance }
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
  reglages: ReglagesCoach;
  resume: Libre;
  decision: DecisionGardeFou;
  ctx: ContexteValidation;
}

async function preparer(userId: string, jour: string, s: StockageCoach, categories: string[], seuils: unknown): Promise<Preparation> {
  const [resume, signaux] = await Promise.all([s.lireResume(userId, jour, categories), s.lireSignauxSante(userId, jour)]);
  if (!resume || typeof resume !== 'object') throw new ErreurCoach('donnees_indisponibles', 500, "Je n'arrive pas à lire tes données pour le moment.");
  const reglages = normaliserReglages(seuils);
  const decision = evaluerGardeFou(donneesGardeFou(jour, resume, signaux));
  return { reglages, resume, decision, ctx: contexteDepuisResume(resume, decision, reglages, jour) };
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
/** Un tour = un appel au modèle. Il faut de la place pour lire (1 tour), proposer (1 tour) et conclure. */
const TOURS_MAX = 4;

function traiterOutil(appel: AppelOutil, ctx: ContexteValidation, resume: Libre, nbLectures: { n: number }, cartes: CarteSeance[], directes: { nom: string; params: Record<string, unknown> }[], uuid: () => string): { contenu: string; erreur: boolean } {
  const def = trouverAction(appel.name);
  // Un outil absent du registre, ou pas encore branché, n'existe pas pour le modèle (même s'il l'invente)
  if (!def || !def.disponible) return { contenu: "Cet outil n'existe pas.", erreur: true };

  if (def.niveau === 'lecture') {
    if (nbLectures.n >= MAX_PAR_NIVEAU.lecture) return { contenu: `${MAX_PAR_NIVEAU.lecture} lectures au maximum par message : réponds avec ce que tu as.`, erreur: true };
    const lu = def.lire ? def.lire(appel.input) : { ok: false as const, erreur: 'Lecture non lisible.' };
    if (!lu.ok || !def.repondre) return { contenu: `Paramètres invalides : ${lu.ok ? 'lecture non branchée' : lu.erreur}`, erreur: true };
    nbLectures.n++;
    return { contenu: JSON.stringify(def.repondre(lu.params, resume)), erreur: false };
  }

  if (def.niveau === 'direct') {
    if (directes.length >= MAX_PAR_NIVEAU.direct) return { contenu: `${MAX_PAR_NIVEAU.direct} actions directes au maximum par message.`, erreur: true };
    const lu = def.lire ? def.lire(appel.input) : { ok: false as const, erreur: 'Action non lisible.' };
    if (!lu.ok) return { contenu: `Paramètres invalides : ${lu.erreur}`, erreur: true };
    directes.push({ nom: def.nom, params: lu.params });
    return { contenu: "Fait : l'application exécute l'action tout de suite.", erreur: false };
  }

  // Niveaux « carte » et « confirmation » : seul proposer_seance est branché pour l'instant
  if (def.nom !== NOM_OUTIL_SEANCE) return { contenu: "Cet outil n'existe pas.", erreur: true };
  if (cartes.length >= MAX_CARTES) return { contenu: `Trois cartes au maximum par message : ne propose pas d'autre séance.`, erreur: true };
  const lue = lireProposition(appel.input);
  if (!lue) return { contenu: 'Paramètres invalides : date, sport, type, minutes et justification sont obligatoires.', erreur: true };
  // Les cartes déjà proposées dans ce message comptent comme prévues : trois cartes qui passent chacune seule ne doivent pas dépasser la limite ensemble
  const ctxTour: ContexteValidation = { ...ctx, prevues: [...ctx.prevues, ...cartes.map((c) => ({ date: c.proposition.date, tss: c.tss_estime }))] };
  const r = validerSeance(lue.proposition, ctxTour);
  if (!r.ok) return { contenu: `Séance refusée par les règles : ${r.erreurs.map((e) => e.message).join(' ')}`, erreur: true };
  cartes.push({ id: uuid(), etat: 'proposee', proposition: lue.proposition, tss_estime: r.tssEstime ?? 0, justification: lue.justification });
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
  if (!texte || texte.length > 2000) throw new ErreurCoach('message_invalide', 400, 'Ton message doit faire entre 1 et 2000 caractères.');

  if (!(await s.aAcces(userId))) throw new ErreurCoach('acces_refuse', 403, "Le coach n'est pas encore ouvert pour ton compte.");
  const reglagesBrut = await s.lireReglages(userId);
  if (!reglagesBrut?.accord) throw new ErreurCoach('accord_requis', 403, "Avant de discuter, il faut que tu acceptes le partage de tes données avec le coach.");

  const jour = jourLocal(deps.maintenant());
  if ((await s.depenseDuMois(`${jour.slice(0, 7)}-01`)) >= config.budgetMicroUsd) {
    throw new ErreurCoach('service_en_pause', 503, 'Le coach est indisponible pour le moment.');
  }
  if (!(await s.reserverMessage(userId, jour, config.messagesParJour))) {
    throw new ErreurCoach('plafond_jour', 429, "Tu as atteint la limite de messages du jour. Reviens demain.");
  }

  const { reglages, resume, decision, ctx } = await preparer(userId, jour, s, reglagesBrut.categories, reglagesBrut.seuils);

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
  const contexte = blocContexte({ aujourdhui: jour, resume, memoire: memoire?.resume ?? null, reglages, decision });
  let messages: MessageModele[] = avecMessageUtilisateur(historique, contexte, texte);

  const cartes: CarteSeance[] = [];
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

    const resultats = reponse.outils.map((o) => {
      const avant = directes.length;
      const r = traiterOutil(o, ctx, resume, nbLectures, cartes, directes, deps.uuid);
      for (const d of directes.slice(avant)) emettre({ type: 'action', nom: d.nom, params: d.params });
      return { type: 'tool_result', tool_use_id: o.id, content: r.contenu, ...(r.erreur ? { is_error: true } : {}) };
    });
    messages = [...messages, { role: 'assistant', content: reponse.brut }, { role: 'user', content: resultats }];
  }

  let reponseFinale = textes.join('\n\n');
  if (refus && !reponseFinale) reponseFinale = MESSAGE_REFUS;
  if (!reponseFinale) reponseFinale = cartes.length ? MESSAGE_CARTES : MESSAGE_VIDE;

  await s.ecrireMessage(userId, { role: 'user', contenu: texte, cartes: null });
  const m = await s.ecrireMessage(userId, { role: 'assistant', contenu: reponseFinale, cartes: cartes.length ? cartes : null });
  for (const carte of cartes) emettre({ type: 'carte', message_id: m.id, carte });
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
    notes: carte.justification ? carte.justification.slice(0, 500) : null,
    created_by_ia: true,
    // Une clé stable par carte : deux « Ajouter » sur la même carte ne peuvent désigner qu'une seule séance
    client_id: `coach-${carte.id}`,
  };
}

export type ResultatAjout =
  | { ok: true; seanceId: string; carte: CarteSeance }
  | { ok: false; code: 'refusee'; erreurs: { code: string; message: string }[] };

/** L'utilisateur tape « Ajouter » : tout est revalidé avec les données du moment, puis la séance est écrite avec SES droits. */
export async function ajouterCarte(userId: string, carteId: unknown, deps: Dependances): Promise<ResultatAjout> {
  const { stockage: s } = deps;
  if (typeof carteId !== 'string' || !carteId || carteId.length > 80) throw new ErreurCoach('carte_invalide', 400, 'Carte invalide.');
  if (!(await s.aAcces(userId))) throw new ErreurCoach('acces_refuse', 403, "Le coach n'est pas encore ouvert pour ton compte.");

  const lue = await s.changerEtatCarte(userId, carteId, null, null);
  if (!lue) throw new ErreurCoach('carte_introuvable', 404, "Cette carte n'existe plus.");
  if (lue.carte.etat === 'ajoutee' && lue.carte.seance_id) return { ok: true, seanceId: lue.carte.seance_id, carte: lue.carte };
  if (lue.carte.etat === 'en_cours') throw new ErreurCoach('deja_en_cours', 409, "Cette séance est déjà en train d'être ajoutée.");
  if (lue.carte.etat !== 'proposee') throw new ErreurCoach('carte_non_ajoutable', 409, 'Cette carte ne peut plus être ajoutée.');

  const reglagesBrut = await s.lireReglages(userId);
  const jour = jourLocal(deps.maintenant());
  const { ctx } = await preparer(userId, jour, s, [], reglagesBrut?.seuils);
  const verdict = validerSeance(lue.carte.proposition, ctx);
  if (!verdict.ok) {
    await s.changerEtatCarte(userId, carteId, 'proposee', 'refusee', verdict.erreurs[0]?.message);
    return { ok: false, code: 'refusee', erreurs: verdict.erreurs };
  }

  // Une seule requête passe de « proposee » à « en_cours » : un double tap s'arrête ici
  const prise = await s.changerEtatCarte(userId, carteId, 'proposee', 'en_cours');
  if (!prise) throw new ErreurCoach('deja_en_cours', 409, "Cette séance est déjà en train d'être ajoutée.");

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
export async function annulerCarte(userId: string, carteId: unknown, deps: Dependances): Promise<{ ok: true }> {
  const { stockage: s } = deps;
  if (typeof carteId !== 'string' || !carteId || carteId.length > 80) throw new ErreurCoach('carte_invalide', 400, 'Carte invalide.');
  if (!(await s.aAcces(userId))) throw new ErreurCoach('acces_refuse', 403, "Le coach n'est pas encore ouvert pour ton compte.");
  const lue = await s.changerEtatCarte(userId, carteId, null, null);
  if (!lue) throw new ErreurCoach('carte_introuvable', 404, "Cette carte n'existe plus.");
  if (lue.carte.etat !== 'ajoutee') throw new ErreurCoach('carte_non_annulable', 409, "Cette séance n'est pas dans ton calendrier.");
  // Si la séance a déjà été supprimée à la main, on marque quand même la carte comme annulée
  if (lue.carte.seance_id) await s.supprimerSeanceIA(userId, lue.carte.seance_id);
  await s.changerEtatCarte(userId, carteId, 'ajoutee', 'annulee');
  return { ok: true };
}
