<script>
  import { SPORTS, couleurSport } from '../sports.js';
  import { SPORTS_A_CHOISIR } from '../data/sports-choisis.js';

  // Cases à cocher pour choisir ses sports. `selection` est la liste des clés cochées (bindable).
  let { selection = $bindable([]), desactive = false } = $props();

  function basculer(cle) {
    selection = selection.includes(cle) ? selection.filter((s) => s !== cle) : [...selection, cle];
  }
</script>

<div class="sports" role="group" aria-label="Tes sports">
  {#each SPORTS_A_CHOISIR as cle (cle)}
    {@const actif = selection.includes(cle)}
    <button type="button" class="sport" class:actif aria-pressed={actif} disabled={desactive} onclick={() => basculer(cle)} style:--c={couleurSport(cle)}>
      <span class="pastille" aria-hidden="true"></span>
      <span class="nom">{(SPORTS[cle] || SPORTS.autre).nom}</span>
      <span class="coche" aria-hidden="true">{actif ? '✓' : ''}</span>
    </button>
  {/each}
</div>

<style>
  .sports {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 10px;
  }
  .sport {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 0 16px;
    border: 2px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    background: var(--fond);
    color: var(--texte);
    font: inherit;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
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
