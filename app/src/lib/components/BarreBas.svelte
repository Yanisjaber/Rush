<script>
  import Panneau from './Panneau.svelte';
  import { menu } from '../stores/menu.svelte.js';
  import { barreBas, cleDePage, ouvertureActive, lienPage } from '../data/menu.js';
  import { route, ouvrirPanneau, fermerPanneau } from '../routeur.svelte.js';

  // Barre de navigation fixe en bas du téléphone (au pouce). Sur ordinateur elle n'existe pas : le menu est en haut.
  // « Plus » ouvre une feuille qui monte du bas avec les pages qu'il regroupe. Le choix du sport est dans la barre du haut.
  let { demo = false } = $props();

  const b = barreBas();
  const courante = $derived(cleDePage(route.chemin));
  const surligne = $derived(ouvertureActive(courante));
  // La feuille « Plus » est dans l'adresse (?feuille=plus)
  const feuille = $derived(route.q.feuille === 'plus' ? 'plus' : null);
  const fermerFeuille = () => fermerPanneau('feuille');
  const pagesFeuille = $derived(feuille === 'plus' ? b.plus : []);
</script>

{#snippet icone(cle)}
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {#if cle === 'accueil'}<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    {:else if cle === 'calendrier'}<rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
    {:else if cle === 'plan'}<path d="M4 6h16M4 12h16M4 18h10" />
    {:else if cle === 'force'}<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" />
    {:else if cle === 'hyrox'}<path d="M13 2L4 14h7l-1 8 9-12h-7z" />
    {:else}<circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />{/if}
  </svg>
{/snippet}

<nav class="bas" aria-label="Navigation principale">
  {#each b.items as it (it.cle)}
    {@const actif = it.ouvre ? surligne === it.ouvre : courante === it.cle}
    {#if it.ouvre}
      <button type="button" class="btn" class:actif aria-haspopup="dialog" onclick={() => ouvrirPanneau({ feuille: it.ouvre })}>
        {@render icone(it.cle)}
        <span>{it.nom}</span>
      </button>
    {:else}
      <a class="btn" class:actif href={lienPage(it.cle, menu.filtre)} aria-current={actif ? 'page' : undefined}>
        {@render icone(it.cle)}
        <span>{it.nom}</span>
      </a>
    {/if}
  {/each}
</nav>

<Panneau ouvert={feuille !== null} titre="Plus" onfermer={fermerFeuille}>
  <ul class="liste">
    {#each pagesFeuille as p (p.cle)}
      <li><a href={lienPage(p.cle, menu.filtre)} aria-current={courante === p.cle ? 'page' : undefined} onclick={fermerFeuille}>{p.nom}</a></li>
    {/each}
    {#if feuille === 'plus' && demo}
      <li><a href="./" onclick={fermerFeuille}>Quitter la démo</a></li>
    {/if}
  </ul>
</Panneau>

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
  .liste {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .liste li + li {
    border-top: 1px solid var(--trait);
  }
  .liste a {
    width: 100%;
    gap: 10px;
    display: flex;
    align-items: center;
    min-height: 52px;
    font-size: 17px;
    font-weight: 600;
    color: var(--texte);
  }
  .liste a[aria-current='page'] {
    color: var(--texte);
    text-decoration: underline;
    text-underline-offset: 5px;
  }
</style>
