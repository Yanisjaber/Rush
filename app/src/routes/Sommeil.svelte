<script>
  import { untrack } from 'svelte';
  import { route, regler } from '../lib/routeur.svelte.js';
  import Apercu from '../lib/sommeil/Apercu.svelte';
  import Graphiques from '../lib/sommeil/Graphiques.svelte';
  import Conseils from '../lib/sommeil/Conseils.svelte';
  import Bouton from '../lib/components/Bouton.svelte';
  import { derniereDemande } from '../lib/utils/derniere-demande.js';
  import { auth } from '../lib/stores/auth.svelte.js';
  import { chargerSommeil } from '../lib/data/api.js';
  import { sommeilDemo } from '../lib/data/demo.js';
  import { preparer } from '../lib/data/score-sommeil.js';

  // Sommeil : trois sous-onglets (#/sommeil, #/sommeil/graphiques, #/sommeil/conseils).
  // Les nuits viennent de garmin_sleep ; le score est calculé ici (score maison), jamais lu de Garmin.
  let { demo = false, onglet = 'apercu' } = $props();

  const ONGLETS = [
    { cle: 'apercu', nom: 'Aperçu', href: '#/sommeil' },
    { cle: 'graphiques', nom: 'Graphiques', href: '#/sommeil/graphiques' },
    { cle: 'conseils', nom: 'Conseils', href: '#/sommeil/conseils' },
  ];

  let etat = $state({ chargement: true, erreur: '', brutes: [] });
  // date de la nuit affichée dans l'aperçu, dans l'adresse (?nuit=2026-10-13) ; sans elle, la plus récente
  const choisie = $derived(route.q.nuit || null);

  // Une réponse en retard d'un chargement plus ancien est ignorée
  const suivi = derniereDemande();
  async function charger(userId) {
    const moi = suivi.nouvelle();
    etat = { chargement: true, erreur: '', brutes: [] };
    if (demo) {
      etat = { chargement: false, erreur: '', brutes: sommeilDemo() };
      return;
    }
    if (!userId) return;
    let r;
    try {
      r = await chargerSommeil(userId, 90);
    } catch {
      r = { data: null, erreur: 'Impossible de charger ton sommeil.' };
    }
    if (!suivi.estActuelle(moi)) return;
    etat = { chargement: false, erreur: r.erreur, brutes: r.data || [] };
  }
  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);
  $effect(() => {
    const u = userId;
    untrack(() => charger(u));
  });

  const nuits = $derived(preparer(etat.brutes));

</script>

<main class="page">

  <header class="entete-page">
    <h1 class="titre">Sommeil</h1>
  </header>

  <nav class="onglets" aria-label="Sections du sommeil">
    {#each ONGLETS as o (o.cle)}
      <a href={o.href} aria-current={onglet === o.cle ? 'page' : undefined}>{o.nom}</a>
    {/each}
  </nav>

  {#if etat.chargement}
    <p class="info" role="status">Chargement du sommeil…</p>
  {:else if etat.erreur}
    <div class="alerte" role="alert">
      <p>{etat.erreur} Vérifie ta connexion internet, puis réessaie.</p>
      <Bouton variante="discret" onclick={() => charger(userId)}>Réessayer</Bouton>
    </div>
  {:else if !nuits.length}
    <p class="info">Aucune nuit pour l'instant. La connexion officielle Garmin arrive bientôt : tu pourras suivre son avancée dans <a href="#/parametres/connexions">Paramètres › Connexions</a>.</p>
  {:else if onglet === 'graphiques'}
    <Graphiques {nuits} />
  {:else if onglet === 'conseils'}
    <Conseils {nuits} />
  {:else}
    <Apercu {nuits} {choisie} onchoisir={(d) => regler({ nuit: d })} {userId} {demo} />
  {/if}
</main>

<style>
  .entete-page {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 24px;
    margin-bottom: 12px;
  }
  h1 {
    font-size: clamp(32px, 6vw, 52px);
    line-height: 1.05;
  }
  .onglets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 16px;
  }
  .onglets a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 18px;
    border: 1px solid var(--trait-fort);
    border-radius: 999px;
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-doux);
  }
  .onglets a:hover {
    color: var(--texte);
  }
  .onglets a[aria-current='page'] {
    background: var(--texte);
    border-color: var(--texte);
    color: var(--fond);
  }
  .info {
    color: var(--texte-doux);
  }
  .info a {
    color: var(--texte);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .alerte {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 16px;
    padding: 10px 14px;
    border: 1px solid var(--danger);
    border-radius: var(--rayon-l);
    background: var(--surface);
    font-size: 14px;
  }
</style>
