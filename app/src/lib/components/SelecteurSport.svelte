<script>
  import { menu } from '../stores/menu.svelte.js';
  import { SPORTS } from '../sports.js';

  // Filtre de sport pour le TÉLÉPHONE (sur ordinateur, les sports sont dans l'en-tête). Même filtre global que l'en-tête.
  const nom = (f) => (SPORTS[f] || SPORTS.autre).nom;
</script>

{#if menu.familles.length}
  <label class="voir">
    <span>Sport</span>
    <select value={menu.filtre} onchange={(e) => (menu.filtre = e.currentTarget.value)}>
      <option value="tout">Tous</option>
      {#each menu.familles as f (f)}<option value={f}>{nom(f)}</option>{/each}
    </select>
  </label>
{/if}

<style>
  .voir {
    display: none;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--texte-doux);
  }
  @media (max-width: 760px) {
    .voir {
      display: inline-flex;
    }
  }
  select {
    min-height: 44px;
    padding: 0 12px;
    font: inherit;
    font-weight: 600;
    color: var(--texte);
    background: var(--surface);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
  }
</style>
