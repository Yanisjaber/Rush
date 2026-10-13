<script>
  import { untrack, onDestroy } from 'svelte';
  import EnTete from '../lib/components/EnTete.svelte';
  import Bouton from '../lib/components/Bouton.svelte';
  import Apercu from '../lib/sommeil/Apercu.svelte';
  import Graphiques from '../lib/sommeil/Graphiques.svelte';
  import Conseils from '../lib/sommeil/Conseils.svelte';
  import { auth } from '../lib/stores/auth.svelte.js';
  import { chargerSommeil } from '../lib/data/api.js';
  import { synchroniserGarmin } from '../lib/data/integrations.js';
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
  let choisie = $state(null); // date de la nuit affichée dans l'aperçu (null = la plus récente)
  let synchro = $state({ actif: false, texte: '', erreur: false });
  const arret = new AbortController();
  onDestroy(() => arret.abort());

  async function charger(userId) {
    if (demo) {
      etat = { chargement: false, erreur: '', brutes: sommeilDemo() };
      return;
    }
    if (!userId) return;
    const r = await chargerSommeil(userId, 90);
    etat = { chargement: false, erreur: r.erreur, brutes: r.data || [] };
  }
  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);
  $effect(() => {
    const u = userId;
    untrack(() => charger(u));
  });

  const nuits = $derived(preparer(etat.brutes));

  async function lancerSynchro() {
    if (synchro.actif) return;
    if (demo) return (synchro = { actif: false, texte: 'Désactivé en mode démo.', erreur: true });
    synchro = { actif: true, texte: 'Demande envoyée…', erreur: false };
    const r = await synchroniserGarmin(userId, (e) => (synchro = { actif: true, texte: e.texte, erreur: false }), arret.signal);
    synchro = { actif: false, texte: r.ok ? `Sommeil synchronisé : ${r.nuits} nuit${r.nuits > 1 ? 's' : ''}.` : r.erreur, erreur: !r.ok && !!r.erreur };
    if (r.ok) await charger(userId);
  }
</script>

<main class="page">
  <EnTete actif="sommeil" {demo} />

  <header class="entete-page">
    <h1 class="titre">Sommeil</h1>
    <div class="synchro">
      <Bouton variante="discret" onclick={lancerSynchro}>{synchro.actif ? 'Synchro en cours…' : 'Synchroniser Garmin'}</Bouton>
      {#if synchro.texte}<span class="retour" class:erreur={synchro.erreur} role="status" aria-live="polite">{synchro.texte}</span>{/if}
    </div>
  </header>

  <nav class="onglets" aria-label="Sections du sommeil">
    {#each ONGLETS as o (o.cle)}
      <a href={o.href} aria-current={onglet === o.cle ? 'page' : undefined}>{o.nom}</a>
    {/each}
  </nav>

  {#if etat.chargement}
    <p class="info" role="status">Chargement du sommeil…</p>
  {:else if etat.erreur}
    <p class="alerte" role="alert">{etat.erreur}</p>
  {:else if !nuits.length}
    <p class="info">Aucune nuit pour l'instant. Lance une synchro Garmin pour récupérer ton sommeil.</p>
  {:else if onglet === 'graphiques'}
    <Graphiques {nuits} />
  {:else if onglet === 'conseils'}
    <Conseils {nuits} />
  {:else}
    <Apercu {nuits} {choisie} onchoisir={(d) => (choisie = d)} {userId} {demo} />
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
  .synchro {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .retour {
    font-size: 14px;
    color: var(--texte-doux);
  }
  .retour.erreur {
    color: var(--danger);
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
  .alerte {
    padding: 10px 14px;
    border: 1px solid var(--danger);
    border-radius: var(--rayon-l);
    background: var(--surface);
    font-size: 14px;
  }
</style>
