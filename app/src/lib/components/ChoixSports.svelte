<script>
  import { SPORTS, couleurSport } from '../sports.js';
  import { GROUPES_SPORTS } from '../data/sports-choisis.js';

  // Choix des sports en pastilles compactes, rangées par thème : une pastille cochée se remplit de la couleur du sport.
  // `selection` est la liste des clés cochées (bindable).
  let { selection = $bindable([]), desactive = false } = $props();

  function basculer(cle) {
    selection = selection.includes(cle) ? selection.filter((s) => s !== cle) : [...selection, cle];
  }

</script>

<div class="choix" role="group" aria-label="Tes sports">
  <div class="groupes">
    {#each GROUPES_SPORTS as groupe (groupe.titre)}
      <section class="groupe">
        <h3 class="titre-groupe">{groupe.titre}</h3>
        <div class="pastilles">
          {#each groupe.sports as cle (cle)}
            {@const actif = selection.includes(cle)}
            <button type="button" class="sport" class:actif aria-pressed={actif} disabled={desactive} onclick={() => basculer(cle)} style:--c={couleurSport(cle)}>
              <span class="point" aria-hidden="true"></span>
              {(SPORTS[cle] || SPORTS.autre).nom}
              {#if actif}<span class="coche" aria-hidden="true">✓</span>{/if}
            </button>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</div>

<style>
  .choix {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  /* les thèmes se rangent côte à côte tant qu'il y a la place */
  .groupes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px 32px;
  }
  .titre-groupe {
    margin: 0 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--trait);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--texte-doux);
  }
  .pastilles {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .sport {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    min-height: 44px;
    padding: 0 18px 0 14px;
    border: 1.5px solid var(--trait-fort);
    border-radius: var(--rayon-rond);
    background: transparent;
    color: var(--texte);
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, transform 0.12s;
  }
  .sport .point {
    width: 10px;
    height: 10px;
    flex: none;
    border-radius: 50%;
    background: var(--c);
  }
  .sport:hover:not(:disabled) {
    border-color: var(--c);
  }
  /* cochée : la pastille se remplit de la couleur du sport (texte foncé, la coche double l'information pour ne pas dépendre de la couleur) */
  .sport.actif {
    border-color: var(--c);
    background: var(--c);
    color: var(--encre-sur-couleur, #0c0d10);
  }
  .sport.actif .point {
    background: var(--encre-sur-couleur, #0c0d10);
  }
  .coche {
    font-weight: 800;
  }

  .sport:focus-visible {
    outline: 3px solid var(--texte);
    outline-offset: 2px;
  }
  .sport:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
