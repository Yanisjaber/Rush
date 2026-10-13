<script>
  import { SPORTS, couleurSport } from '../sports.js';

  // Une puce de sport : pastille de couleur + nom. Cliquable (bouton) ou lien (si href).
  let { sport = 'autre', label = '', actif = false, href = '', onclick } = $props();
  const texte = $derived(label || (SPORTS[sport] || SPORTS.autre).court);
</script>

{#snippet contenu()}
  <span class="pastille" style:background={couleurSport(sport)}></span>
  {texte}
{/snippet}

{#if href}
  <a class="chip" class:actif {href} {onclick}>{@render contenu()}</a>
{:else}
  <button class="chip" class:actif type="button" aria-pressed={actif} {onclick}>{@render contenu()}</button>
{/if}

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: var(--cible);
    padding: 0 16px;
    box-sizing: border-box;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-rond);
    background: transparent;
    color: var(--texte-doux);
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }
  .chip.actif {
    background: var(--texte);
    border-color: var(--texte);
    color: var(--fond);
  }
  .pastille {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex: none;
  }
  .actif .pastille {
    outline: 2px solid var(--fond);
  }
</style>
