<script>
  import AjoutSport from './AjoutSport.svelte';
  import { menu } from '../stores/menu.svelte.js';
  import { SPORTS, couleurSport } from '../sports.js';
  import { changerSport } from '../routeur.svelte.js';

  // Filtre de sport pour le TÉLÉPHONE (sur ordinateur, les sports sont dans l'en-tête). Même filtre global que l'en-tête.
  // Monté UNE SEULE fois dans App.svelte : barre figée en haut de tous les écrans, comme la barre du bas.
  const nom = (f) => (SPORTS[f] || SPORTS.autre).court;
</script>

{#if menu.familles.length}
  <div class="voir barre-sport">
    <!-- Les pastilles défilent sur la largeur s'il y en a beaucoup ; le « + » reste fixe à droite -->
    <div class="rangee" role="group" aria-label="Filtrer par sport">
      <button class="sport" class:courant={menu.filtre === 'tout'} type="button" aria-pressed={menu.filtre === 'tout'} onclick={() => changerSport('tout')}>Tous</button>
      {#each menu.familles as f (f)}
        <button class="sport" class:courant={menu.filtre === f} type="button" aria-pressed={menu.filtre === f} onclick={() => changerSport(f)}>
          <span class="point" style:background={couleurSport(f)}></span>{nom(f)}
        </button>
      {/each}
    </div>
    <AjoutSport />
  </div>
{/if}

<style>
  .voir {
    display: none;
  }
  /* Téléphone : barre fixe tout en haut, sous l'heure et l'encoche. Le contenu défile dessous
     (la place est réservée dans global.css). Si les sports ne tiennent pas, la rangée glisse sur le côté. */
  @media (max-width: 760px) {
    .voir {
      display: flex;
      align-items: center;
      gap: 0;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 40;
      view-transition-name: barre-haut; /* reste fixe pendant le fondu entre deux pages */
      box-sizing: border-box;
      /* La barre garde toujours la même hauteur : les pastilles remontent de 8 px quand la zone de l'encoche leur laisse la place
         (appli installée : ~59 px), et cet espace passe dessous. Dans un onglet Safari cette zone vaut 0 : rien ne bouge. */
      padding: max(0px, calc(env(safe-area-inset-top) - 8px)) var(--gouttiere) calc(2px + min(8px, env(safe-area-inset-top)));
      background: var(--fond);
      border-bottom: 1px solid var(--trait);
    }
    .rangee {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .rangee::-webkit-scrollbar {
      display: none;
    }
  }
  .sport {
    -webkit-tap-highlight-color: transparent; /* pas de flash gris d'iOS quand on touche une pastille */
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--rayon-rond);
    background: none;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-doux);
    cursor: pointer;
  }
  .sport.courant {
    background: var(--surface-2);
    color: var(--texte);
  }
  .point {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }
</style>
