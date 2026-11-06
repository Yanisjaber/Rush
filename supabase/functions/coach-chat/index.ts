// ============================================================
// Edge Function : coach-chat — le chat Coach de Rush (docs/ia/CADRAGE_IA.md).
//
// Appel (POST, JWT Supabase dans Authorization, corps JSON de 10 Ko au plus) :
//   { "action": "message", "texte": "…", "stream": true|false }
//        stream true (défaut) : flux SSE, une ligne « data: {…} » par événement :
//          { type: "texte", delta } · { type: "carte", message_id, carte } · { type: "fin", message_id, texte } · { type: "erreur", code, message }
//        stream false : une réponse JSON { ok, message_id, texte, cartes } (ou { error, message } avec le bon statut HTTP)
//   { "action": "ajouter", "carte_id": "…" }   → { ok: true, seance_id } ou { ok: false, erreurs: [...] }
//   { "action": "annuler", "carte_id": "…" }   → { ok: true }
//
// Sécurité :
//   - l'utilisateur vient du JWT vérifié, jamais du corps de la requête ;
//   - liste blanche (table coach_acces), accord de partage des données, plafond de messages du jour, coupe-circuit de dépense du mois ;
//   - le modèle n'écrit jamais dans le calendrier : il propose des cartes, la séance n'existe qu'après « ajouter » (revalidé) ;
//   - les journaux ne contiennent ni message, ni donnée de santé ; les erreurs montrées sont des phrases génériques ;
//   - CORS restreint (_shared/cors.ts).
//
// Déploiement : supabase functions deploy coach-chat
// Secrets : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (déjà là), ANTHROPIC_API_KEY (à créer),
//   facultatifs : COACH_MODELE (claude-haiku-5-5), COACH_MESSAGES_PAR_JOUR (30), COACH_BUDGET_MICRO_USD (10000000 = 10 $ par mois)
// ============================================================
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.3';
import { ajouterCarte, annulerCarte, CONFIG_PAR_DEFAUT, ErreurCoach, maintenirMemoire, traiterMessage } from '../_shared/coach-chat.ts';
import type { Config, Dependances, EvenementCoach } from '../_shared/coach-chat.ts';
import type { CarteSeance } from '../_shared/coach-contexte.ts';
import { corsHeadersFor } from '../_shared/cors.ts';
import { creerClientAnthropic } from './modele-anthropic.ts';
import { creerStockage } from './stockage.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TAILLE_MAX_CORPS = 10_000;

function entierEnv(nom: string, defaut: number): number {
  const n = Number(Deno.env.get(nom));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : defaut;
}

function configDepuisEnv(): Config {
  return {
    ...CONFIG_PAR_DEFAUT,
    modele: Deno.env.get('COACH_MODELE') || CONFIG_PAR_DEFAUT.modele,
    messagesParJour: entierEnv('COACH_MESSAGES_PAR_JOUR', CONFIG_PAR_DEFAUT.messagesParJour),
    budgetMicroUsd: entierEnv('COACH_BUDGET_MICRO_USD', CONFIG_PAR_DEFAUT.budgetMicroUsd),
  };
}

Deno.serve((req) => gerer(req, corsHeadersFor(req)));

async function gerer(req: Request, corsHeaders: Record<string, string>): Promise<Response> {
  const json = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    // 1) Qui appelle ? (JWT Supabase)
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!jwt) return json({ error: 'missing_jwt' }, 401);
    const { data: { user }, error: authErr } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY).auth.getUser(jwt);
    if (authErr || !user) return json({ error: 'invalid_jwt' }, 401);

    // 2) Corps de la requête, borné
    const brut = await req.text();
    if (brut.length > TAILLE_MAX_CORPS) return json({ error: 'corps_trop_gros', message: 'Requête trop grande.' }, 413);
    let corps: any;
    try {
      corps = JSON.parse(brut);
    } catch {
      return json({ error: 'json_invalide', message: 'Requête invalide.' }, 400);
    }
    if (!corps || typeof corps !== 'object') return json({ error: 'json_invalide', message: 'Requête invalide.' }, 400);

    // 3) Les dépendances. Pas de clé Anthropic = le chat n'est pas configuré (jamais de détail sur la raison côté client).
    const cleAnthropic = Deno.env.get('ANTHROPIC_API_KEY');
    if (!cleAnthropic) {
      console.error('coach-chat: ANTHROPIC_API_KEY absente');
      return json({ error: 'service_non_configure', message: 'Le coach est indisponible pour le moment.' }, 503);
    }
    const config = configDepuisEnv();
    const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const deps: Dependances = {
      modele: creerClientAnthropic({ apiKey: cleAnthropic, modele: config.modele }),
      stockage: creerStockage(sbUser, sbAdmin),
      config,
      maintenant: () => new Date(),
      uuid: () => crypto.randomUUID(),
    };

    // 4) L'action
    switch (corps.action) {
      case 'message':
        return corps.stream === false ? await messageJson(user.id, corps.texte, deps, json) : messageFlux(user.id, corps.texte, deps, corsHeaders);
      case 'ajouter': {
        const r = await ajouterCarte(user.id, corps.carte_id, deps);
        return r.ok ? json({ ok: true, seance_id: r.seanceId, carte: r.carte }) : json({ ok: false, erreurs: r.erreurs });
      }
      case 'annuler':
        return json(await annulerCarte(user.id, corps.carte_id, deps));
      default:
        return json({ error: 'action_inconnue', message: 'Action inconnue.' }, 400);
    }
  } catch (e) {
    return erreurJson(e, json);
  }
}

function erreurJson(e: unknown, json: (b: any, s?: number) => Response): Response {
  if (e instanceof ErreurCoach) return json({ error: e.code, message: e.message }, e.status);
  console.error('coach-chat: erreur inattendue', (e as any)?.name || '');
  return json({ error: 'erreur_interne', message: 'Quelque chose a mal tourné. Réessaie dans un instant.' }, 500);
}

/** Après la réponse : la mémoire se met à jour sans faire attendre l'utilisateur, et sans jamais lui faire de mal. */
function planifierMemoire(userId: string, deps: Dependances) {
  const tache = maintenirMemoire(userId, deps).catch(() => console.error('coach-chat: mise à jour de la mémoire échouée'));
  (globalThis as any).EdgeRuntime?.waitUntil?.(tache);
}

async function messageJson(userId: string, texte: unknown, deps: Dependances, json: (b: any, s?: number) => Response): Promise<Response> {
  const cartes: CarteSeance[] = [];
  let fin: Extract<EvenementCoach, { type: 'fin' }> | null = null;
  await traiterMessage(userId, texte, deps, (e) => {
    if (e.type === 'carte') cartes.push(e.carte);
    if (e.type === 'fin') fin = e;
  });
  planifierMemoire(userId, deps);
  const f = fin as Extract<EvenementCoach, { type: 'fin' }> | null;
  return json({ ok: true, message_id: f?.message_id, texte: f?.texte ?? '', cartes });
}

function messageFlux(userId: string, texte: unknown, deps: Dependances, corsHeaders: Record<string, string>): Response {
  const encodeur = new TextEncoder();
  const flux = new ReadableStream({
    async start(controleur) {
      const envoyer = (e: EvenementCoach) => controleur.enqueue(encodeur.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        await traiterMessage(userId, texte, deps, envoyer);
        planifierMemoire(userId, deps);
      } catch (e) {
        if (e instanceof ErreurCoach) envoyer({ type: 'erreur', code: e.code, message: e.message });
        else {
          console.error('coach-chat: erreur inattendue', (e as any)?.name || '');
          envoyer({ type: 'erreur', code: 'erreur_interne', message: 'Quelque chose a mal tourné. Réessaie dans un instant.' });
        }
      }
      controleur.close();
    },
  });
  return new Response(flux, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' } });
}
