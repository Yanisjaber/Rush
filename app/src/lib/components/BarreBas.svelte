<script>
    import { menu } from '../stores/menu.svelte.js';
  import { barreBas, cleDePage, lienPage } from '../data/menu.js';
  import { route } from '../routeur.svelte.js';

  // Barre de navigation fixe en bas du téléphone (au pouce). Sur ordinateur elle n'existe pas : le menu est en haut.
  const b = barreBas();
  const courante = $derived(cleDePage(route.chemin));
</script>

{#snippet icone(cle)}
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {#if cle === 'accueil'}<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    {:else if cle === 'calendrier'}<rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
    {:else if cle === 'plan'}<path d="M4 6h16M4 12h16M4 18h10" />
    {:else if cle === 'force'}<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" />
    {:else if cle === 'hyrox'}<path d="M13 2L4 14h7l-1 8 9-12h-7z" />
    {:else if cle === 'bilan'}<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    {:else if cle === 'sante'}<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z" />
    {:else}<circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" />{/if}
  </svg>
{/snippet}

<nav class="bas" aria-label="Navigation principale">
  {#each b.items as it (it.cle)}
    {@const actif = courante === it.cle}
    <a class="btn" class:actif href={lienPage(it.cle, menu.filtre)} aria-current={actif ? 'page' : undefined}>
      {@render icone(it.cle)}
      <span>{it.nom}</span>
    </a>
  {/each}
</nav>

<style>
  /* Pas de barre sur ordinateur : le menu est en haut de page */
  .bas {
    display: none;
  }
  @media (max-width: 760px) {
    .bas {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 40;
      view-transition-name: barre-bas; /* reste fixe pendant le fondu entre deux pages */
      display: flex;
      justify-content: space-around;
      /* on descend les boutons : seulement une partie de la zone de l'indicateur d'accueil (34 px sur iPhone) est laissée sous eux */
      padding: 6px 4px max(6px, calc(env(safe-area-inset-bottom) - 12px));
      background: var(--fond);
      border-top: 1px solid var(--trait);
    }
  }
  .btn {
    -webkit-tap-highlight-color: transparent; /* pas de flash gris d'iOS quand on touche un onglet */
    flex: 1;
    min-width: 0;
    min-height: var(--cible);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 4px 2px;
    border: 0;
    border-radius: var(--rayon);
    background: none;
    color: var(--texte-doux);
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn.actif {
    color: var(--texte);
    font-weight: 800; /* l'onglet où l'on est ressort : texte plus gras */
  }
  .btn.actif svg {
    color: var(--texte);
    stroke-width: 2.6; /* icône plus épaisse, comme le texte */
  }
  .btn:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: -2px;
  }
</style>
