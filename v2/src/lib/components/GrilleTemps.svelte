<script>
  import { SEGMENTS, lireTemps, ecrireTemps } from '../data/hyrox.js';

  // Les 16 champs de temps d'un test Hyrox (8 runs d'1 km et 8 stations), au format 4:52.
  //  - temps : tableau de 16 textes (modifiable : <GrilleTemps bind:temps />)
  //  - vide : texte affiché dans un champ non rempli (ex. « 4:52 », ou « = test » pour l'objectif)
  let { temps = $bindable([]), vide = '4:52', id = 'hx' } = $props();

  const total = $derived(temps.reduce((somme, t) => (Number.isNaN(lireTemps(t)) ? somme : somme + lireTemps(t)), 0));
</script>

<div class="grille">
  {#each SEGMENTS as s (s.i)}
    <label class={s.type}>
      <span class="nom">{s.nom}<small>{s.detail}</small></span>
      <input
        id={`${id}-${s.i}`}
        inputmode="numeric"
        placeholder={vide}
        bind:value={temps[s.i]}
        aria-label={`${s.nom}, ${s.detail}`}
        maxlength="8"
      />
    </label>
  {/each}
</div>
<p class="total">Total saisi : <strong>{total ? ecrireTemps(total) : '—'}</strong></p>

<style>
  .grille {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 8px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px 10px;
    border-radius: var(--rayon);
    background: var(--surface-2);
    border-left: 4px solid var(--trait-fort);
  }
  label.station {
    border-left-color: var(--sport-hybride);
  }
  .nom {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
  }
  small {
    font-size: 11px;
    font-weight: 500;
    color: var(--texte-doux);
  }
  input {
    box-sizing: border-box;
    width: 100%;
    height: 44px;
    padding: 0 10px;
    background: var(--fond);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    font-size: 17px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  input:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .total {
    margin: 10px 0 0;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .total strong {
    color: var(--texte);
  }
</style>
