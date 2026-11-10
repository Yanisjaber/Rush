// ============================================================
// Le déroulé d'une demande d'analyse de sortie (docs/ia/ANALYSE_SORTIE.md) : accès, accord, lecture de la sortie, cache, modèle, contrôle, cache.
// Aucun réseau ici : tout passe par `DepsAnalyse` (la vraie base et le vrai modèle dans l'Edge Function, des faux dans les tests).
// ============================================================
import { construireFaits, empreinteFaits, familleAnalysable, lireSignaux, messageAnalyse, PROMPT_ANALYSE, validerLettre } from './analyse-sortie.ts';
import type { ActiviteAnalysee, LettreValide } from './analyse-sortie.ts';
import { ErreurModele } from './modele.ts';
import type { ClientModele, MessageModele, Usage } from './modele.ts';

export interface DepsAnalyse {
  modele: ClientModele;
  nomModele: string;
  aAcces(userId: string): Promise<boolean>;
  accordDonnees(userId: string): Promise<boolean>;
  /** La sortie de CE compte (la RLS s'applique) ; null si elle n'existe pas ou n'est pas à lui. */
  lireActivite(userId: string, id: string): Promise<ActiviteAnalysee | null>;
  lireCache(userId: string, id: string): Promise<{ empreinte: string; contenu: { paragraphes?: unknown } } | null>;
  ecrireCache(userId: string, id: string, empreinte: string, contenu: LettreValide, modele: string): Promise<void>;
  /** Pour les journaux : des nombres seulement, jamais de texte. */
  journal?(info: { tokensEntree: number; tokensSortie: number; essais: number }): void;
}

export type ReponseAnalyse =
  | { statut: 200; corps: { ok: true; paragraphes: string[]; depuis_cache: boolean } }
  | { statut: number; corps: { ok: false; error: string; message: string } };

const erreur = (statut: number, error: string, message: string): ReponseAnalyse => ({ statut, corps: { ok: false, error, message } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TOKENS = 700;

export async function analyserSortie(userId: string, corps: unknown, deps: DepsAnalyse): Promise<ReponseAnalyse> {
  const c = corps && typeof corps === 'object' && !Array.isArray(corps) ? (corps as Record<string, unknown>) : null;
  if (!c || typeof c.activity_id !== 'string' || !UUID.test(c.activity_id)) return erreur(400, 'requete_invalide', 'Requête invalide.');
  const id = c.activity_id.toLowerCase();

  if (!(await deps.aAcces(userId))) return erreur(403, 'acces_refuse', "Le coach n'est pas encore ouvert pour ton compte.");
  if (!(await deps.accordDonnees(userId))) return erreur(403, 'accord_requis', 'Pour analyser tes sorties, il faut que tu acceptes le partage de tes données avec le coach.');

  const lu = lireSignaux(c.signaux);
  if (!lu.ok) return erreur(400, 'signaux_invalides', 'Les chiffres de la sortie sont invalides.');
  const act = await deps.lireActivite(userId, id);
  if (!act) return erreur(404, 'sortie_introuvable', 'Sortie introuvable.');
  if (!familleAnalysable(act.sport)) return erreur(422, 'sport_non_pris_en_charge', "Le coach n'analyse pour l'instant que la course à pied et le vélo.");

  const faits = construireFaits(act, lu.valeur);
  const empreinte = await empreinteFaits(faits);

  // Déjà analysée avec les mêmes chiffres : on rend le texte gardé, sans appeler le modèle
  const cache = await deps.lireCache(userId, id);
  if (cache && cache.empreinte === empreinte && Array.isArray(cache.contenu?.paragraphes) && cache.contenu.paragraphes.every((p) => typeof p === 'string')) {
    return { statut: 200, corps: { ok: true, paragraphes: cache.contenu.paragraphes as string[], depuis_cache: true } };
  }

  // Au plus deux essais : le second montre au modèle pourquoi le premier a été refusé
  const messages: MessageModele[] = [{ role: 'user', content: messageAnalyse(faits) }];
  let usage: Usage = { entree: 0, sortie: 0, cacheLecture: 0, cacheEcriture: 0 };
  let essais = 0;
  for (; essais < 2; ) {
    essais++;
    let texte = '';
    try {
      const r = await deps.modele.repondre({ system: PROMPT_ANALYSE, messages, outils: [], maxTokens: MAX_TOKENS }, () => {});
      usage = { entree: usage.entree + r.usage.entree, sortie: usage.sortie + r.usage.sortie, cacheLecture: usage.cacheLecture + r.usage.cacheLecture, cacheEcriture: usage.cacheEcriture + r.usage.cacheEcriture };
      if (r.arret === 'refus') return erreur(502, 'analyse_indisponible', "Le coach n'a pas pu analyser cette sortie. Réessaie dans un instant.");
      texte = r.texte;
    } catch (e) {
      if (e instanceof ErreurModele && e.transitoire && essais < 2) continue;
      return erreur(502, 'analyse_indisponible', "Le coach n'a pas pu analyser cette sortie. Réessaie dans un instant.");
    }
    const v = validerLettre(texte, faits);
    if (v.ok) {
      deps.journal?.({ tokensEntree: usage.entree + usage.cacheLecture + usage.cacheEcriture, tokensSortie: usage.sortie, essais });
      await deps.ecrireCache(userId, id, empreinte, v.valeur, deps.nomModele);
      return { statut: 200, corps: { ok: true, paragraphes: v.valeur.paragraphes, depuis_cache: false } };
    }
    messages.push({ role: 'assistant', content: texte || '(vide)' }, { role: 'user', content: `Ta réponse est refusée : ${v.raison}. Réécris le retour complet en respectant toutes les règles.` });
  }
  deps.journal?.({ tokensEntree: usage.entree + usage.cacheLecture + usage.cacheEcriture, tokensSortie: usage.sortie, essais });
  return erreur(502, 'analyse_indisponible', "Le coach n'a pas pu analyser cette sortie. Réessaie dans un instant.");
}
