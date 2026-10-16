<script>
  import { untrack } from 'svelte';
  import { menu } from '../stores/menu.svelte.js';
  import { nomDiscipline } from '../data/disciplines.js';
  import { auth } from '../stores/auth.svelte.js';
  import { modeDemo } from '../routeur.svelte.js';
  import { sportsChoisis, chargerSportsChoisis } from '../stores/sports.svelte.js';

  // Deuxième barre (téléphone), fixe sous celle des sports, visible seulement quand le sport « Athlé » est choisi :
  // « Tout » et les disciplines que l'utilisateur a cochées (100 m, saut en hauteur…). Choisir l'une ne montre que ses séances.
  const uid = $derived(modeDemo() ? 'demo' : auth.session?.user?.id);
  $effect(() => {
    const u = uid;
    if (u && !sportsChoisis.pret) untrack(() => chargerSportsChoisis(u));
  });
  const disciplines = $derived(sportsChoisis.disciplines?.athletisme || []);
  // La discipline choisie a été décochée entre-temps : on revient à « Tout »
  $effect(() => {
    if (sportsChoisis.pret && menu.discipline !== 'tout' && !disciplines.includes(menu.discipline)) menu.discipline = 'tout';
  });
</script>

{#if menu.filtre === 'athletisme'}
  <div class="barre-discipline" role="group" aria-label="Filtrer par discipline">
    <button class="disc" class:courant={menu.discipline === 'tout'} type="button" aria-pressed={menu.discipline === 'tout'} onclick={() => (menu.discipline = 'tout')}>Tout</button>
    {#each disciplines as cle (cle)}
      <button class="disc" class:courant={menu.discipline === cle} type="button" aria-pressed={menu.discipline === cle} onclick={() => (menu.discipline = menu.discipline === cle ? 'tout' : cle)}>
        {nomDiscipline('athletisme', cle)}
      </button>
    {/each}
  </div>
{/if}

<style>
  .barre-discipline {
    display: none;
  }
  /* Téléphone : fixe, juste sous la barre des sports (47 px + la zone de l'encoche) ; les pastilles défilent s'il y en a beaucoup */
  @media (max-width: 760px) {
    .barre-discipline {
      display: flex;
      align-items: center;
      position: fixed;
      top: calc(47px + env(safe-area-inset-top));
      left: 0;
      right: 0;
      z-index: 39; /* sous la barre des sports : son menu « + » passe par-dessus */
      view-transition-name: barre-discipline; /* reste fixe pendant le fondu entre deux pages */
      box-sizing: border-box;
      height: 53px;
      padding: 0 var(--gouttiere);
      background: var(--fond);
      border-bottom: 1px solid var(--trait);
      overflow-x: auto;
      scrollbar-width: none;
    }
    .barre-discipline::-webkit-scrollbar {
      display: none;
    }
  }
  .disc {
    -webkit-tap-highlight-color: transparent;
    flex: none;
    min-height: 40px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--rayon-rond);
    background: none;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-doux);
    white-space: nowrap;
    cursor: pointer;
  }
  .disc.courant {
    background: var(--surface-2);
    color: var(--texte);
  }
</style>
