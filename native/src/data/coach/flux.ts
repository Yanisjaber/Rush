// Lecture du flux du coach (SSE) : le serveur envoie « data: {json} » suivi d'une ligne vide, pour chaque événement.
// Logique pure : les morceaux de texte arrivent coupés n'importe où, on garde ce qui n'est pas fini pour le morceau suivant.
import type { CarteSeance, EtatCarte, EvenementCoach } from './types.ts';

const ETATS: readonly string[] = ['proposee', 'en_cours', 'ajoutee', 'refusee', 'annulee'];

const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** Une carte reçue du serveur, vérifiée : tout ce qui n'a pas la bonne forme est écarté (on n'affiche jamais une carte douteuse). */
export function lireCarte(x: unknown): CarteSeance | null {
  if (!estObjet(x) || typeof x.id !== 'string' || !ETATS.includes(String(x.etat))) return null;
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

/** Les cartes d'un message enregistré (colonne jsonb) : une liste, ou rien */
export function lireCartes(x: unknown): CarteSeance[] {
  return Array.isArray(x) ? x.map(lireCarte).filter((c): c is CarteSeance => c !== null) : [];
}

function lireEvenement(x: unknown): EvenementCoach | null {
  if (!estObjet(x)) return null;
  if (x.type === 'texte' && typeof x.delta === 'string') return { type: 'texte', delta: x.delta };
  if (x.type === 'fin' && typeof x.message_id === 'string' && typeof x.texte === 'string') return { type: 'fin', message_id: x.message_id, texte: x.texte };
  if (x.type === 'erreur' && typeof x.code === 'string') return { type: 'erreur', code: x.code, message: typeof x.message === 'string' ? x.message : '' };
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
