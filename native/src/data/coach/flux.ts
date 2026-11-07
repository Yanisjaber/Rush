// Lecture du flux du coach (SSE) : le serveur envoie « data: {json} » suivi d'une ligne vide, pour chaque événement.
// Logique pure : les morceaux de texte arrivent coupés n'importe où, on garde ce qui n'est pas fini pour le morceau suivant.
import type { Carte, CarteSeance, CartePlanning, EtatCarte, EvenementCoach, LignePlan, TypeOperation, TypePeriode } from './types.ts';

const ETATS: readonly string[] = ['proposee', 'en_cours', 'ajoutee', 'refusee', 'annulee'];

const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

const OPERATIONS: readonly string[] = ['indisponibilite', 'deplacer', 'supprimer', 'ajouter'];
const PERIODES: readonly string[] = ['maladie', 'blessure', 'indisponible'];
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LIGNES = 20;
const MAX_TEXTE = 300;

const texte = (x: unknown, max = MAX_TEXTE): string => (typeof x === 'string' ? x.slice(0, max) : '');
const nombre = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);
const date = (x: unknown): string | undefined => (typeof x === 'string' && DATE_ISO.test(x) ? x : undefined);

/** Une ligne de plan, vérifiée : une ligne sans opération connue ou sans texte est écartée. */
function lireLigne(x: unknown): LignePlan | null {
  if (!estObjet(x) || !OPERATIONS.includes(String(x.op)) || typeof x.texte !== 'string' || !x.texte) return null;
  const raison = texte(x.raison);
  const minutes = nombre(x.minutes);
  const de = date(x.de);
  const vers = date(x.vers);
  const du = date(x.du);
  const au = date(x.au);
  return {
    op: x.op as TypeOperation,
    texte: texte(x.texte),
    ...(raison ? { raison } : {}),
    ...(typeof x.sport === 'string' ? { sport: x.sport.slice(0, 40) } : {}),
    ...(minutes !== undefined ? { minutes } : {}),
    ...(de ? { de } : {}),
    ...(vers ? { vers } : {}),
    ...(PERIODES.includes(String(x.type)) ? { type: x.type as TypePeriode } : {}),
    ...(du ? { du } : {}),
    ...(au ? { au } : {}),
  };
}

function lirePlanning(x: Record<string, unknown>): CartePlanning | null {
  if (typeof x.id !== 'string' || !ETATS.includes(String(x.etat)) || !Array.isArray(x.lignes)) return null;
  const lignes = x.lignes.slice(0, MAX_LIGNES).map(lireLigne).filter((l): l is LignePlan => l !== null);
  // Un plan sans aucune ligne lisible n'a rien à montrer : on ne l'affiche pas
  if (!lignes.length) return null;
  const a = x.annulation;
  const annulation = estObjet(a) && nombre(a.annulees) !== undefined && nombre(a.ignorees) !== undefined ? { annulees: a.annulees as number, ignorees: a.ignorees as number } : undefined;
  return {
    id: x.id,
    genre: 'planning',
    etat: x.etat as EtatCarte,
    intention: texte(x.intention, 200),
    lignes,
    charge_avant: nombre(x.charge_avant) ?? 0,
    charge_apres: nombre(x.charge_apres) ?? 0,
    ...(typeof x.motif === 'string' ? { motif: x.motif } : {}),
    ...(annulation ? { annulation } : {}),
  };
}

function lireSeance(x: Record<string, unknown>): CarteSeance | null {
  if (typeof x.id !== 'string' || !ETATS.includes(String(x.etat))) return null;
  const p = x.proposition;
  if (!estObjet(p) || typeof p.date !== 'string' || typeof p.sport !== 'string' || typeof p.type !== 'string' || typeof p.minutes !== 'number') return null;
  const tss = typeof x.tss_estime === 'number' && Number.isFinite(x.tss_estime) ? x.tss_estime : 0;
  return {
    id: x.id,
    etat: x.etat as EtatCarte,
    proposition: { date: p.date, sport: p.sport, type: p.type, minutes: p.minutes },
    tss_estime: tss,
    justification: typeof x.justification === 'string' ? x.justification : '',
    ...(typeof x.motif === 'string' ? { motif: x.motif } : {}),
    ...(typeof x.seance_id === 'string' ? { seance_id: x.seance_id } : {}),
  };
}

/** Une carte reçue du serveur, vérifiée : tout ce qui n'a pas la bonne forme est écarté (on n'affiche jamais une carte douteuse). */
export function lireCarte(x: unknown): Carte | null {
  if (!estObjet(x)) return null;
  return x.genre === 'planning' ? lirePlanning(x) : lireSeance(x);
}

/** Les cartes d'un message enregistré (colonne jsonb) : une liste, ou rien */
export function lireCartes(x: unknown): Carte[] {
  return Array.isArray(x) ? x.map(lireCarte).filter((c): c is Carte => c !== null) : [];
}

function lireEvenement(x: unknown): EvenementCoach | null {
  if (!estObjet(x)) return null;
  if (x.type === 'texte' && typeof x.delta === 'string') return { type: 'texte', delta: x.delta };
  if (x.type === 'fin' && typeof x.message_id === 'string' && typeof x.texte === 'string') return { type: 'fin', message_id: x.message_id, texte: x.texte };
  if (x.type === 'erreur' && typeof x.code === 'string') return { type: 'erreur', code: x.code, message: typeof x.message === 'string' ? x.message : '' };
  if (x.type === 'action' && typeof x.nom === 'string' && estObjet(x.params)) return { type: 'action', nom: x.nom.slice(0, 60), params: x.params };
  if (x.type === 'carte' && typeof x.message_id === 'string') {
    const carte = lireCarte(x.carte);
    return carte ? { type: 'carte', message_id: x.message_id, carte } : null;
  }
  return null;
}

/**
 * Découpe ce qui est arrivé : renvoie les événements complets et le reste (une fin de ligne pas encore reçue).
 * Une ligne qui n'est pas du JSON valide, ou d'un type inconnu, est ignorée sans faire échouer le reste.
 */
export function decouperEvenements(tampon: string): { evenements: EvenementCoach[]; reste: string } {
  const normalise = tampon.replace(/\r\n/g, '\n');
  const blocs = normalise.split('\n\n');
  const reste = blocs.pop() ?? '';
  const evenements: EvenementCoach[] = [];
  for (const bloc of blocs) {
    const donnees = bloc
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).replace(/^ /, ''))
      .join('\n');
    if (!donnees) continue;
    try {
      const e = lireEvenement(JSON.parse(donnees));
      if (e) evenements.push(e);
    } catch {
      // ligne cassée : on passe à la suivante
    }
  }
  return { evenements, reste };
}

/** À la fin du flux, un dernier événement peut être resté sans sa ligne vide : on le lit aussi. */
export function viderTampon(reste: string): EvenementCoach[] {
  return reste.trim() ? decouperEvenements(`${reste}\n\n`).evenements : [];
}
