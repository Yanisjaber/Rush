<script>
  import { SPORTS, couleurSport } from '../sports.js';
  import { SPORTS_PRINCIPAUX, SPORTS_AUTRES } from '../data/sports-choisis.js';

  // Cases à cocher pour choisir ses sports : les cinq de l'accueil en grand, puis les autres sports de performance.
  // `selection` est la liste des clés cochées (bindable).
  let { selection = $bindable([]), desactive = false } = $props();

  function basculer(cle) {
    selection = selection.includes(cle) ? selection.filter((s) => s !== cle) : [...selection, cle];
  }
</script>

{#snippet carte(cle, grande)}
  {@const actif = selection.includes(cle)}
  <button type="button" class="sport" class:grande class:actif aria-pressed={actif} disabled={desactive} onclick={() => basculer(cle)} style:--c={couleurSport(cle)}>
    <span class="pastille" aria-hidden="true"></span>
    <span class="nom">{(SPORTS[cle] || SPORTS.autre).nom}</span>
    <span class="coche" aria-hidden="true">{actif ? '✓' : ''}</span>
  </button>
{/snippet}

<div class="groupe" role="group" aria-label="Tes sports">
  <div class="sports">
    {#each SPORTS_PRINCIPAUX as cle (cle)}{@render carte(cle, true)}{/each}
  </div>
  <h3 class="sous-titre">Autres sports de performance</h3>
  <div class="sports">
    {#each SPORTS_AUTRES as cle (cle)}{@render carte(cle, false)}{/each}
  </div>
</div>

<style>
  .groupe {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .sous-titre {
    margin: 6px 0 0;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--texte-doux);
  }
  .sports {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 8px;
  }
  .sport {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 0 14px;
    border: 2px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    background: var(--fond);
    color: var(--texte);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }
  .sport.grande {
    min-height: 56px;
    padding: 0 16px;
    font-size: 15px;
  }
  .sport:hover:not(:disabled) {
    border-color: var(--c);
  }
  .sport.actif {
    border-color: var(--c);
    background: color-mix(in srgb, var(--c) 18%, var(--fond));
  }
  .sport:focus-visible {
    outline: 3px solid var(--texte);
    outline-offset: 2px;
  }
  .sport:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .pastille {
    width: 14px;
    height: 14px;
    flex: none;
    border-radius: 50%;
    background: var(--c);
  }
  .nom {
    flex: 1;
  }
  .coche {
    width: 20px;
    text-align: center;
    font-weight: 800;
  }
</style>
