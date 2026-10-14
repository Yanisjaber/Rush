<script>
  // Anneau (« camembert ») de pourcentage : plein à 100 % de la zone visée, le chiffre au centre.
  let { pct = 0, etiquette = '' } = $props();
  const RAYON = 38;
  const CIRCONF = 2 * Math.PI * RAYON;
</script>

<svg viewBox="0 0 100 100" role="img" aria-label={etiquette || `${pct} % de la zone visée`}>
  <circle cx="50" cy="50" r={RAYON} class="fond" />
  {#if pct > 0}
    <circle cx="50" cy="50" r={RAYON} class="arc" stroke-dasharray={`${(CIRCONF * Math.min(Math.max(pct, 0), 100)) / 100} ${CIRCONF}`} transform="rotate(-90 50 50)" />
  {/if}
  <text x="50" y="50" class="valeur" text-anchor="middle" dominant-baseline="central">{pct} %</text>
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }
  .fond,
  .arc {
    fill: none;
    stroke-width: 12;
  }
  .fond {
    stroke: var(--trait-fort);
  }
  .arc {
    stroke: var(--sport-muscu);
    stroke-linecap: round;
    transition: stroke-dasharray 0.3s;
  }
  .valeur {
    fill: var(--texte);
    font-family: var(--police-titre);
    font-size: 21px;
    font-weight: 700;
  }
</style>
