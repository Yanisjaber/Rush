<script>
  // Aiguillage de l'app : catalogue, paramètres, démo, connexion ou accueil selon l'adresse et l'état.
  import Catalogue from './routes/Catalogue.svelte';
  import Connexion from './routes/Connexion.svelte';
  import Accueil from './routes/Accueil.svelte';
  import Parametres from './routes/Parametres.svelte';
  import Calendrier from './routes/Calendrier.svelte';
  import Seance from './routes/Seance.svelte';
  import Sommeil from './routes/Sommeil.svelte';
  import PanneauSeance from './lib/components/PanneauSeance.svelte';
  import { auth, initAuth } from './lib/stores/auth.svelte.js';
  import { route, modeDemo } from './lib/routeur.svelte.js';

  const demo = modeDemo();

  // Paramètres : #/parametres ou #/parametres/<onglet> (onglet inconnu = Général)
  const ONGLETS = ['general', 'physiologie', 'zones', 'preferences'];
  const paramOnglet = $derived.by(() => {
    const m = /^\/parametres(?:\/([a-z]+))?$/.exec(route.chemin);
    if (!m) return null;
    return ONGLETS.includes(m[1]) ? m[1] : 'general';
  });

  // Identifiant de séance dans l'adresse (#/seance/<id>) : on n'accepte que des caractères sûrs
  const idSeance = $derived.by(() => {
    const m = /^\/seance\/([A-Za-z0-9_-]{1,64})$/.exec(route.chemin);
    return m ? m[1] : null;
  });

  // En démo, on n'a pas besoin de session : on évite même de contacter Supabase.
  if (!demo) initAuth();
</script>

{#if route.chemin === '/catalogue'}
  <Catalogue />
{:else if demo}
  {#if paramOnglet}
    <Parametres demo={true} onglet={paramOnglet} />
  {:else if route.chemin === '/calendrier'}
    <Calendrier demo={true} />
  {:else if route.chemin === '/sommeil'}
    <Sommeil demo={true} />
  {:else if idSeance}
    <Seance id={idSeance} demo={true} />
  {:else}
    <Accueil demo={true} />
  {/if}
{:else if !auth.pret}
  <p class="attente" role="status">Chargement…</p>
{:else if !auth.session}
  <Connexion />
{:else if paramOnglet}
  <Parametres onglet={paramOnglet} />
{:else if route.chemin === '/calendrier'}
  <Calendrier />
{:else if route.chemin === '/sommeil'}
  <Sommeil />
{:else if idSeance}
  <Seance id={idSeance} />
{:else}
  <Accueil />
{/if}

<!-- Résumé d'une séance réalisée : ouvert depuis le calendrier ou les widgets -->
<PanneauSeance />

<style>
  .attente {
    padding: 48px 32px;
    color: var(--texte-doux);
  }
</style>
