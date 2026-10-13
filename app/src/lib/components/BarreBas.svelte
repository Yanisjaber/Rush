<script>
  import Panneau from './Panneau.svelte';
  import { menu } from '../stores/menu.svelte.js';
  import { barreBas, cleDePage, ouvertureActive, lienPage } from '../data/menu.js';
  import { route, changerSport, ouvrirPanneau, fermerPanneau } from '../routeur.svelte.js';
  import { SPORTS, couleurSport } from '../sports.js';

  // Barre de navigation fixe en bas du téléphone (au pouce). Sur ordinateur elle n'existe pas : le menu est en haut.
  // « Sports » et « Plus » ouvrent une feuille qui monte du bas avec les pages qu'ils regroupent.
  let { demo = false } = $props();

  const b = $derived(barreBas(menu.familles));
  const courante = $derived(cleDePage(route.chemin));
  const surligne = $derived(ouvertureActive(courante));
  // La feuille ouverte (« sports » ou « plus ») est dans l'adresse (?feuille=plus)
  const feuille = $derived(route.q.feuille === 'sports' || route.q.feuille === 'plus' ? route.q.feuille : null);
  const fermerFeuille = () => fermerPanneau('feuille');
  const pagesFeuille = $derived(feuille === 'plus' ? b.plus : []);
  const choisir = (f) => {
    changerSport(f);
    fermerFeuille();
  };
</script>

{#snippet icone(cle)}
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {#if cle === 'accueil'}<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    {:else if cle === 'calendrier'}<rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
    {:else if cle === 'plan'}<path d="M4 6h16M4 12h16M4 18h10" />
    {:else if cle === 'force'}<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" />
    {:else if cle === 'hyrox'}<path d="M13 2L4 14h7l-1 8 9-12h-7z" />
    {:else if cle === 'sports'}<circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" />
    {:else}<circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />{/if}
  </svg>
{/snippet}

<nav class="bas" aria-label="Navigation principale">
  {#each b.items as it (it.cle)}
    {@const actif = it.ouvre === 'sports' ? menu.filtre !== 'tout' : it.ouvre ? surligne === it.ouvre : courante === it.cle}
    {#if it.ouvre}
      <button type="button" class="btn" class:actif aria-haspopup="dialog" onclick={() => ouvrirPanneau({ feuille: it.ouvre })}>
        {@render icone(it.cle)}
        <span>{it.cle === 'sports' && menu.filtre !== 'tout' ? (SPORTS[menu.filtre] || SPORTS.autre).court : it.nom}</span>
      </button>
    {:else}
      <a class="btn" class:actif href={lienPage(it.cle, menu.filtre)} aria-current={actif ? 'page' : undefined}>
        {@render icone(it.cle)}
        <span>{it.nom}</span>
      </a>
    {/if}
  {/each}
</nav>

<Panneau ouvert={feuille !== null} titre={feuille === 'sports' ? 'Sport affiché' : 'Plus'} onfermer={fermerFeuille}>
  <ul class="liste">
    {#if feuille === 'sports'}
      <li><button type="button" class:courant={menu.filtre === 'tout'} onclick={() => choisir('tout')}>Tous les sports</button></li>
      {#each menu.familles as f (f)}
        <li>
          <button type="button" class:courant={menu.filtre === f} onclick={() => choisir(menu.filtre === f ? 'tout' : f)}>
            <span class="point" style:background={couleurSport(f)}></span>{(SPORTS[f] || SPORTS.autre).nom}
          </button>
        </li>
      {/each}
    {/if}
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
      display: flex;
      justify-content: space-around;
      padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
      background: var(--fond);
      border-top: 1px solid var(--trait);
    }
  }
  .btn {
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
  }
  .btn.actif svg {
    color: var(--texte);
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
  .liste a,
  .liste button {
    width: 100%;
    gap: 10px;
    border: 0;
    background: none;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    min-height: 52px;
    font-size: 17px;
    font-weight: 600;
    color: var(--texte);
  }
  .point {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .liste button.courant,
  .liste a[aria-current='page'] {
    color: var(--texte);
    text-decoration: underline;
    text-underline-offset: 5px;
  }
</style>
