<script>
  import { lisse } from '../../utils/courbes.js';

  // Barres empilées par période (par exemple la charge par sport et par semaine).
  // series : [{ nom, couleur, valeurs: [...] }, ...]  ·  etiquettes : un libellé par période
  // ligne (facultatif) : une série de valeurs tracée par-dessus, en trait clair (par ex. la condition).
  let { series = [], etiquettes = [], hauteur = 200, max, ligne = [], etiquette = 'Barres' } = $props();

  const nbPeriodes = $derived(etiquettes.length || (series[0] ? series[0].valeurs.length : 0));
  const totaux = $derived(
    Array.from({ length: nbPeriodes }, (_, i) => series.reduce((s, serie) => s + (serie.valeurs[i] || 0), 0)),
  );
  const plafond = $derived(max ?? Math.max(1, ...totaux) * 1.1);

  // Courbe en superposition : coordonnées en 0..nbPeriodes (largeur) et 0..100 (hauteur)
  const trace = $derived.by(() => {
    if (!ligne.length) return '';
    const hautLigne = Math.max(...ligne);
    const pts = ligne.map((v, i) => [i + 0.5, 100 - (v / (hautLigne * 1.15)) * 100 * 0.78 - 4]);
    return lisse(pts, 0.2);
  });
</script>

<div class="graphique" role="img" aria-label={etiquette}>
  <div class="zone" style:height="{hauteur}px">
    <div class="barres">
      {#each { length: nbPeriodes } as _, i}
        <div class="colonne" class:derniere={i === nbPeriodes - 1}>
          {#each series as serie, k}
            <div
              class="segment"
              class:sommet={k === series.length - 1}
              style:height="{((serie.valeurs[i] || 0) / plafond) * 100}%"
              style:background={serie.couleur}
            ></div>
          {/each}
        </div>
      {/each}
    </div>
    {#if trace}
      <svg viewBox="0 0 {nbPeriodes} 100" preserveAspectRatio="none" aria-hidden="true">
        <path d={trace} fill="none" stroke="var(--texte)" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      </svg>
    {/if}
  </div>
  {#if etiquettes.length}
    <div class="axe">
      {#each etiquettes as e, i}
        <span class:derniere={i === nbPeriodes - 1}>{e}</span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .zone {
    position: relative;
    border-bottom: 1px solid var(--trait);
  }
  .barres {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    gap: 10px;
  }
  .colonne {
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    flex-direction: column-reverse;
    opacity: 0.55;
  }
  .colonne.derniere {
    opacity: 1;
  }
  .segment {
    margin-top: 2px;
  }
  .segment.sommet {
    border-radius: 4px 4px 0 0;
  }
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .axe {
    display: flex;
    gap: 10px;
    margin-top: 8px;
    font-size: 10px;
    color: var(--texte-doux);
  }
  .axe span {
    flex: 1;
    min-width: 0;
    text-align: center;
  }
  .axe .derniere {
    color: var(--texte);
    font-weight: 600;
  }
  /* Sur petit écran, une étiquette sur deux est masquée pour éviter qu'elles se chevauchent */
  @media (max-width: 520px) {
    .axe span {
      white-space: nowrap;
      overflow: visible;
    }
    .axe span:not(.derniere):nth-child(odd) {
      visibility: hidden;
    }
  }
</style>
