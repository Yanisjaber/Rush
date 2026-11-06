// ============================================================
// Le vrai client du modèle : le SDK officiel Anthropic derrière l'interface `ClientModele` (docs/ia/CADRAGE_IA.md).
//
// Seul fichier du chat qui connaît le SDK. La clé vient d'un secret Supabase (ANTHROPIC_API_KEY), jamais du code.
// Dépendance : npm:@anthropic-ai/sdk, version EXACTE et publiée il y a plus de deux semaines (règle d'approvisionnement du projet).
//
// Réglages de l'appel (Claude Haiku 5.5) :
//   - effort « low » : la décision est cadrée, et la réflexion compte comme de la sortie (donc de l'argent) ;
//   - pas de température ni de top_p (refusés par ce modèle) ;
//   - cache de prompt sur le texte système, qui est identique d'un appel à l'autre ;
//   - outils en `strict: true` : les paramètres respectent exactement le schéma. Le code les revalide quand même (coach-chat.ts).
//   - pas de nouvel essai du SDK (maxRetries 0) : le chat en fait un seul lui-même, et seulement si rien n'est parti vers l'utilisateur.
// ============================================================
import Anthropic from 'npm:@anthropic-ai/sdk@1.1.0';
import { PROMPT_RESUME } from '../_shared/coach-prompt.ts';
import { ErreurModele } from '../_shared/modele.ts';
import type { AppelModele, AppelOutil, ClientModele, ReponseModele, Usage } from '../_shared/modele.ts';

const DELAI_MS = 60_000;

function usageDe(u: Anthropic.Usage | undefined): Usage {
  return {
    entree: u?.input_tokens ?? 0,
    sortie: u?.output_tokens ?? 0,
    cacheLecture: u?.cache_read_input_tokens ?? 0,
    cacheEcriture: u?.cache_creation_input_tokens ?? 0,
  };
}

/** Réseau coupé, délai dépassé, surcharge ou erreur du serveur : ça vaut un nouvel essai. Clé refusée ou requête invalide : non. */
function convertirErreur(e: unknown): ErreurModele {
  if (e instanceof Anthropic.APIError) {
    const s = e.status;
    const transitoire = s === undefined || s === 408 || s === 409 || s === 429 || s >= 500;
    return new ErreurModele(`api ${s ?? 'réseau'}`, transitoire);
  }
  return new ErreurModele('erreur inattendue', false);
}

const ARRETS: Record<string, ReponseModele['arret']> = { end_turn: 'fin', tool_use: 'outil', max_tokens: 'longueur', refusal: 'refus' };

export function creerClientAnthropic(opts: { apiKey: string; modele: string }): ClientModele {
  const client = new Anthropic({ apiKey: opts.apiKey, maxRetries: 0, timeout: DELAI_MS });

  return {
    async repondre(appel: AppelModele, surTexte: (delta: string) => void): Promise<ReponseModele> {
      try {
        const flux = client.messages.stream({
          model: opts.modele,
          max_tokens: appel.maxTokens,
          system: [{ type: 'text', text: appel.system, cache_control: { type: 'ephemeral' } }],
          tools: appel.outils.map((o) => ({ ...o, input_schema: o.input_schema as Anthropic.Tool.InputSchema, strict: true })),
          messages: appel.messages as Anthropic.MessageParam[],
          output_config: { effort: 'low' },
        });
        flux.on('text', (delta) => surTexte(delta));
        const message = await flux.finalMessage();

        const outils: AppelOutil[] = message.content
          .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
          .map((b) => ({ id: b.id, name: b.name, input: b.input }));
        const texte = message.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');
        return {
          texte,
          outils,
          arret: ARRETS[message.stop_reason ?? ''] ?? 'autre',
          usage: usageDe(message.usage),
          brut: message.content,
        };
      } catch (e) {
        throw convertirErreur(e);
      }
    },

    async resumer(entree: { resumeActuel: string | null; anciens: string }): Promise<{ texte: string; usage: Usage }> {
      try {
        const message = await client.messages.create({
          model: opts.modele,
          max_tokens: 800,
          system: PROMPT_RESUME,
          messages: [{ role: 'user', content: `Résumé actuel :\n${entree.resumeActuel ?? '(vide)'}\n\nAnciens messages :\n${entree.anciens}` }],
          output_config: { effort: 'low' },
        });
        const texte = message.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');
        return { texte, usage: usageDe(message.usage) };
      } catch (e) {
        throw convertirErreur(e);
      }
    },
  };
}
