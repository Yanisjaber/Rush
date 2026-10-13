<script>
  import { menu } from '../stores/menu.svelte.js';
  import { pagesMenu, pagesDeSports } from '../data/menu.js';

  // En-tête commun, sur ordinateur et tablette (sur téléphone il n'existe pas : voir BarreBas.svelte).
  // Trois états selon la place disponible :
  //   1. complet : tous les liens à plat ;
  //   2. compact : Muscu / Hyrox rangés dans un menu déroulant « Sports » ;
  //   3. défilant : même en compact ça ne tient pas, la ligne se fait glisser à l'horizontale.
  // actif : 'accueil' | 'calendrier' | 'plan' | 'force' | 'hyrox' | 'competitions' | 'bilan' | 'sommeil' | 'parametres'.
  let { actif = 'accueil', demo = false } = $props();

  const tous = $derived(pagesMenu(menu.familles));
  const sports = $derived(pagesDeSports(menu.familles));
  const cles = $derived(new Set(sports.map((s) => s.cle)));
  const sansSports = $derived(tous.filter((l) => !cles.has(l.cle)));

  let compact = $state(false);
  let defile = $state(false);
  let nav = $state();
  let mesureComplet = $state();
  let mesureCompact = $state();
  let bouton = $state();
  let ouvert = $state(false);
  let posMenu = $state({ top: 0, left: 0 });

  const sportActif = $derived(sports.some((s) => s.cle === actif));

  // On mesure la largeur dont chaque version a besoin (deux copies invisibles) et on la compare à la place de la barre.
  $effect(() => {
    if (!nav || !mesureComplet || !mesureCompact) return;
    void tous; // se relance quand les pages changent
    const calculer = () => {
      const dispo = nav.clientWidth;
      const complet = mesureComplet.scrollWidth <= dispo;
      compact = !complet && sports.length > 0;
      defile = !complet && mesureCompact.scrollWidth > dispo;
      if (!compact) ouvert = false;
    };
    calculer();
    const obs = new ResizeObserver(calculer);
    obs.observe(nav);
    return () => obs.disconnect();
  });

  function basculer() {
    if (!ouvert && bouton) {
      const r = bouton.getBoundingClientRect();
      posMenu = { top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 188)) };
    }
    ouvert = !ouvert;
  }
  function fermerSiDehors(e) {
    if (ouvert && !e.target.closest?.('.menu-sports, .liste-sports')) ouvert = false;
  }
  function touche(e) {
    if (e.key === 'Escape' && ouvert) {
      ouvert = false;
      bouton?.focus();
    }
  }
</script>

<svelte:window onclick={fermerSiDehors} onkeydown={touche} onresize={() => (ouvert = false)} />

<header class="barre">
  <span class="logo titre" aria-hidden="true">CI</span>
  <nav class="liens" class:defile aria-label="Navigation principale" bind:this={nav}>
    {#each compact ? sansSports : tous as l, i (l.cle)}
      <a href={l.href} aria-current={actif === l.cle ? 'page' : undefined}>{l.nom}</a>
      {#if compact && i === 2}
        <button
          class="menu-sports"
          class:courant={sportActif}
          type="button"
          aria-haspopup="true"
          aria-expanded={ouvert}
          bind:this={bouton}
          onclick={basculer}
        >
          Sports
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4l4 4 4-4" /></svg>
        </button>
      {/if}
    {/each}
  </nav>
  <div class="droite">
    {#if demo}<span class="etiquette-demo">Mode démo</span>{/if}
    <a class="reglages" href="#/parametres" aria-label="Paramètres" aria-current={actif === 'parametres' ? 'page' : undefined}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
    </a>
  </div>

  <!-- Copies invisibles, uniquement pour mesurer la place nécessaire -->
  <div class="mesure" aria-hidden="true" bind:this={mesureComplet}>
    {#each tous as l (l.cle)}<span>{l.nom}</span>{/each}
  </div>
  <div class="mesure" aria-hidden="true" bind:this={mesureCompact}>
    {#each sansSports as l (l.cle)}<span>{l.nom}</span>{/each}{#if sports.length}<span>Sports&nbsp;&nbsp;&nbsp;&nbsp;</span>{/if}
  </div>
</header>

{#if ouvert}
  <ul class="liste-sports" style:top="{posMenu.top}px" style:left="{posMenu.left}px">
    {#each sports as s (s.cle)}
      <li><a href={s.href} aria-current={actif === s.cle ? 'page' : undefined} onclick={() => (ouvert = false)}>{s.nom}</a></li>
    {/each}
  </ul>
{/if}

<style>
  .barre {
    position: relative;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px 0;
  }
  .droite {
    display: flex;
    flex: none;
    align-items: center;
    gap: 12px;
  }
  .logo {
    flex: none;
  }
  .logo {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--dossard-fond);
    color: var(--dossard-texte);
    border-radius: var(--rayon);
    font-size: 17px;
    letter-spacing: 0;
  }
  .liens {
    display: flex;
    flex: 1;
    gap: 4px;
    min-width: 0;
  }
  /* Même en compact ça ne tient pas : la ligne glisse à l'horizontale (barre de défilement masquée) */
  .liens.defile {
    overflow-x: auto;
    scrollbar-width: none;
  }
  .liens.defile::-webkit-scrollbar {
    display: none;
  }
  .liens a,
  .menu-sports {
    display: inline-flex;
    align-items: center;
    min-height: var(--cible);
    padding: 0 14px;
    border-radius: var(--rayon-rond);
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-doux);
    white-space: nowrap;
  }
  .menu-sports {
    gap: 6px;
    border: 0;
    background: none;
    font-family: inherit;
    cursor: pointer;
  }
  .menu-sports:hover,
  .menu-sports[aria-expanded='true'] {
    color: var(--texte);
  }
  .menu-sports.courant {
    background: var(--surface-2);
    color: var(--texte);
  }
  .liste-sports {
    position: fixed;
    z-index: 50;
    min-width: 180px;
    margin: 0;
    padding: 6px;
    list-style: none;
    background: var(--surface);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
  }
  .liste-sports a {
    display: flex;
    align-items: center;
    min-height: var(--cible);
    padding: 0 12px;
    border-radius: var(--rayon-s);
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-doux);
  }
  .liste-sports a:hover,
  .liste-sports a[aria-current='page'] {
    background: var(--surface-2);
    color: var(--texte);
  }
  /* Copies de mesure : hors écran, invisibles, une seule ligne */
  .mesure {
    position: absolute;
    left: 0;
    top: 0;
    display: flex;
    gap: 4px;
    visibility: hidden;
    pointer-events: none;
    white-space: nowrap;
    width: max-content;
    font-size: 14px;
    font-weight: 600;
  }
  .mesure span {
    padding: 0 14px;
  }
  /* Téléphone : pas d'en-tête, la navigation est la barre du bas (BarreBas.svelte) : le contenu commence tout en haut */
  @media (max-width: 760px) {
    .barre {
      display: none;
    }
  }
  .liens a:hover {
    color: var(--texte);
  }
  .liens a[aria-current='page'] {
    background: var(--surface-2);
    color: var(--texte);
  }
  .reglages {
    width: var(--cible);
    height: var(--cible);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--trait-fort);
    border-radius: 50%;
    color: var(--texte-doux);
  }
  .reglages:hover,
  .reglages[aria-current='page'] {
    color: var(--texte);
  }
  .etiquette-demo {
    padding: 6px 10px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-rond);
    font-size: 12px;
    color: var(--texte-doux);
  }
</style>
