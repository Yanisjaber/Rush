<script>
  import { menu } from '../stores/menu.svelte.js';
  import { page, pagesDeSports } from '../data/menu.js';
  import { SPORTS, couleurSport } from '../sports.js';

  // En-tête commun, sur ordinateur et tablette (sur téléphone il n'existe pas : voir BarreBas.svelte).
  // Deux groupes complémentaires :
  //   à gauche, les PAGES : Accueil · Calendrier · Plan · Compétitions · Bilan · Sommeil (+ « Plus ▾ » : écrans Muscu / Hyrox si pratiqués) ;
  //   à droite, les SPORTS : Tous · Course · Vélo… Le sport choisi est un filtre global : il reste quand on change de page
  //   (sauf Sommeil, qui l'ignore). Page courante et sport choisi sont surlignés en même temps.
  // Selon la place disponible :
  //   1. tout à plat ;
  //   2. les sports rangés dans « Sports ▾ » ;
  //   3. en plus, Compétitions, Bilan, Sommeil rangés dans « Plus ▾ » ;
  //   4. même comme ça ça ne tient pas : la ligne se fait glisser à l'horizontale.
  // actif : 'accueil' | 'calendrier' | 'plan' | 'force' | 'hyrox' | 'competitions' | 'bilan' | 'sommeil' | 'parametres'.
  let { actif = 'accueil', demo = false } = $props();

  const debut = [page('accueil'), page('calendrier'), page('plan')];
  const fin = [page('competitions'), page('bilan'), page('sommeil')];
  const familles = $derived(menu.familles);
  const pagesSport = $derived(pagesDeSports(menu.familles)); // Muscu, Hyrox : leurs écrans vivent dans « Plus »
  const nomSport = (f) => (SPORTS[f] || SPORTS.autre).court;

  let pagesEnPlus = $state(false);
  let compact = $state(false);
  let defile = $state(false);
  let nav = $state();
  let mesureComplet = $state();
  let mesureMilieu = $state();
  let mesureCompact = $state();
  let ouvert = $state(null); // null | 'sports' | 'plus'
  let posMenu = $state({ top: 0, left: 0 });

  // Contenu du menu « Plus » : les écrans de sports, et (si la place manque) les dernières pages
  const listePlus = $derived([...pagesSport, ...(pagesEnPlus ? fin : [])]);
  const plusActif = $derived(listePlus.some((l) => l.cle === actif));

  // On mesure la largeur dont chaque version a besoin (copies invisibles) et on la compare à la place de la barre.
  $effect(() => {
    if (!nav || !mesureComplet || !mesureMilieu || !mesureCompact) return;
    void familles;
    const calculer = () => {
      const dispo = nav.clientWidth;
      const toutPlat = mesureComplet.scrollWidth <= dispo;
      const sportsRanges = mesureMilieu.scrollWidth <= dispo; // seuls les sports sont rangés
      compact = !toutPlat;
      pagesEnPlus = !toutPlat && !sportsRanges;
      defile = pagesEnPlus && mesureCompact.scrollWidth > dispo;
      if (!pagesEnPlus && !pagesSport.length && ouvert === 'plus') ouvert = null;
      if (!compact && ouvert === 'sports') ouvert = null;
    };
    calculer();
    const obs = new ResizeObserver(calculer);
    obs.observe(nav);
    return () => obs.disconnect();
  });

  function basculer(nom, e) {
    if (ouvert === nom) {
      ouvert = null;
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    posMenu = { top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 200)) };
    ouvert = nom;
  }
  function fermerSiDehors(e) {
    if (ouvert && !e.target.closest?.('.menu-deroulant, .liste-deroulante')) ouvert = null;
  }
  function touche(e) {
    if (e.key === 'Escape' && ouvert) ouvert = null;
  }
  // Un sport = un filtre global (« tout » = tous les sports) ; recliquer sur le sport choisi revient à « Tous »
  function choisir(f) {
    menu.filtre = f === 'tout' || menu.filtre === f ? 'tout' : f;
    ouvert = null;
  }
</script>

<svelte:window onclick={fermerSiDehors} onkeydown={touche} onresize={() => (ouvert = null)} />

{#snippet fleche()}
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4l4 4 4-4" /></svg>
{/snippet}

<header class="barre">
  <span class="logo titre" aria-hidden="true">CI</span>
  <nav class="liens" class:defile aria-label="Navigation principale" bind:this={nav}>
    {#each pagesEnPlus ? debut : [...debut, ...fin] as l (l.cle)}
      <a href={l.href} aria-current={actif === l.cle ? 'page' : undefined}>{l.nom}</a>
    {/each}
    {#if listePlus.length}
      <button class="menu-deroulant" class:courant={plusActif} type="button" aria-haspopup="true" aria-expanded={ouvert === 'plus'} onclick={(e) => basculer('plus', e)}>
        Plus
        {@render fleche()}
      </button>
    {/if}
    {#if familles.length}
      <span class="espace" aria-hidden="true"></span>
      <div class="sports" class:neutre={actif === 'sommeil'} role="group" aria-label="Filtrer par sport" title={actif === 'sommeil' ? 'Le sommeil ne dépend pas du sport' : undefined}>
        {#if compact}
          <button class="menu-deroulant" class:courant={menu.filtre !== 'tout'} type="button" aria-haspopup="true" aria-expanded={ouvert === 'sports'} onclick={(e) => basculer('sports', e)}>
            {menu.filtre !== 'tout' ? nomSport(menu.filtre) : 'Sports'}
            {@render fleche()}
          </button>
        {:else}
          <button class="sport" class:courant={menu.filtre === 'tout'} type="button" aria-pressed={menu.filtre === 'tout'} onclick={() => choisir('tout')}>Tous</button>
          {#each familles as f (f)}
            <button class="sport" class:courant={menu.filtre === f} type="button" aria-pressed={menu.filtre === f} onclick={() => choisir(f)}>
              <span class="point" style:background={couleurSport(f)}></span>{nomSport(f)}
            </button>
          {/each}
        {/if}
      </div>
    {/if}
  </nav>
  <div class="droite">
    {#if demo}<span class="etiquette-demo">Mode démo</span>{/if}
    <a class="reglages" href="#/parametres" aria-label="Paramètres" aria-current={actif === 'parametres' ? 'page' : undefined}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
    </a>
  </div>

  <!-- Copies invisibles, uniquement pour mesurer la place nécessaire (tout à plat / « Sports » seul / « Sports » et « Plus ») -->
  <div class="mesure" aria-hidden="true" bind:this={mesureComplet}>
    {#each [...debut, ...fin] as l (l.cle)}<span>{l.nom}</span>{/each}
    {#if pagesSport.length}<span>Plus&nbsp;&nbsp;&nbsp;&nbsp;</span>{/if}
    {#if familles.length}<span>Tous</span>{#each familles as f (f)}<span class="m-sport">{nomSport(f)}</span>{/each}{/if}
  </div>
  <div class="mesure" aria-hidden="true" bind:this={mesureMilieu}>
    {#each [...debut, ...fin] as l (l.cle)}<span>{l.nom}</span>{/each}
    {#if pagesSport.length}<span>Plus&nbsp;&nbsp;&nbsp;&nbsp;</span>{/if}
    {#if familles.length}<span>Sports&nbsp;&nbsp;&nbsp;&nbsp;</span>{/if}
  </div>
  <div class="mesure" aria-hidden="true" bind:this={mesureCompact}>
    {#each debut as l (l.cle)}<span>{l.nom}</span>{/each}
    <span>Plus&nbsp;&nbsp;&nbsp;&nbsp;</span>
    {#if familles.length}<span>Sports&nbsp;&nbsp;&nbsp;&nbsp;</span>{/if}
  </div>
</header>

{#if ouvert}
  <ul class="liste-deroulante" style:top="{posMenu.top}px" style:left="{posMenu.left}px">
    {#if ouvert === 'sports'}
      <li><button type="button" class:courant={menu.filtre === 'tout'} onclick={() => choisir('tout')}>Tous les sports</button></li>
      {#each familles as f (f)}
        <li>
          <button type="button" class:courant={menu.filtre === f} onclick={() => choisir(f)}>
            <span class="point" style:background={couleurSport(f)}></span>{(SPORTS[f] || SPORTS.autre).nom}
          </button>
        </li>
      {/each}
    {:else}
      {#each listePlus as l (l.cle)}
        <li><a href={l.href} aria-current={actif === l.cle ? 'page' : undefined} onclick={() => (ouvert = null)}>{l.nom}</a></li>
      {/each}
    {/if}
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
  .menu-deroulant,
  .sport {
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
  .menu-deroulant,
  .sport {
    gap: 7px;
    border: 0;
    background: none;
    font-family: inherit;
    cursor: pointer;
  }
  .menu-deroulant:hover,
  .menu-deroulant[aria-expanded='true'],
  .sport:hover {
    color: var(--texte);
  }
  .menu-deroulant.courant,
  .sport.courant {
    background: var(--surface-2);
    color: var(--texte);
  }
  .liste-deroulante {
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
  .point {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }
  /* pousse le groupe des sports à droite de la ligne */
  .espace {
    flex: 1;
    min-width: 16px;
  }
  .sports {
    display: flex;
    flex: none;
    gap: 4px;
    padding-left: 16px;
    border-left: 1px solid var(--trait-fort);
  }
  /* sur Sommeil le sport ne compte pas : les pastilles sont atténuées (mais gardent le choix) */
  .sports.neutre {
    opacity: 0.45;
  }
  .liste-deroulante button,
  .liste-deroulante a {
    width: 100%;
    border: 0;
    background: none;
    font-family: inherit;
    text-align: left;
    gap: 8px;
    cursor: pointer;
  }
  .liste-deroulante a {
    display: flex;
    align-items: center;
    min-height: var(--cible);
    padding: 0 12px;
    border-radius: var(--rayon-s);
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-doux);
  }
  .liste-deroulante button {
    display: flex;
    align-items: center;
    min-height: var(--cible);
    padding: 0 12px;
    border-radius: var(--rayon-s);
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-doux);
  }
  .liste-deroulante button:hover,
  .liste-deroulante button.courant,
  .liste-deroulante a:hover,
  .liste-deroulante a[aria-current='page'] {
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
  .mesure .m-sport {
    padding: 0 14px 0 30px; /* + la pastille de couleur */
  }
  .mesure {
    gap: 4px;
    padding-right: 52px; /* + le trait de séparation et l'espace entre les deux groupes */
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
