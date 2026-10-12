<script>
  // Aiguillage de l'app : catalogue, paramètres, démo, connexion ou accueil selon l'adresse et l'état.
  import Catalogue from './routes/Catalogue.svelte';
  import Connexion from './routes/Connexion.svelte';
  import Accueil from './routes/Accueil.svelte';
  import Parametres from './routes/Parametres.svelte';
  import Calendrier from './routes/Calendrier.svelte';
  import { auth, initAuth } from './lib/stores/auth.svelte.js';
  import { route, modeDemo } from './lib/routeur.svelte.js';

  const demo = modeDemo();

  // En démo, on n'a pas besoin de session : on évite même de contacter Supabase.
  if (!demo) initAuth();
</script>

{#if route.chemin === '/catalogue'}
  <Catalogue />
{:else if demo}
  {#if route.chemin === '/parametres'}
    <Parametres demo={true} />
  {:else if route.chemin === '/calendrier'}
    <Calendrier demo={true} />
  {:else}
    <Accueil demo={true} />
  {/if}
{:else if !auth.pret}
  <p class="attente" role="status">Chargement…</p>
{:else if !auth.session}
  <Connexion />
{:else if route.chemin === '/parametres'}
  <Parametres />
{:else if route.chemin === '/calendrier'}
  <Calendrier />
{:else}
  <Accueil />
{/if}

<style>
  .attente {
    padding: 48px 32px;
    color: var(--texte-doux);
  }
</style>
