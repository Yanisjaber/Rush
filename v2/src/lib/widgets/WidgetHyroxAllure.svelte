<script>
  import Bloc from '../components/Bloc.svelte';
  import { analyserTest, ciblesSegments, ecrireTemps } from '../data/hyrox.js';

  // Le temps de chacun des 8 runs d'1 km : ton dernier test (trait plein) et ton objectif (pointillés).
  let { contexte } = $props();
  const test = $derived(contexte.hyrox.tests[0] || null);
  const runs = $derived(test ? analyserTest(test.segments).allures : []);
  const cibles = $derived(ciblesSegments(contexte.hyrox.objectif, test));
  const runsCibles = $derived(cibles ? cibles.filter((_, i) => i % 2 === 0) : []);

  const L = 400;
  const H = 170;
  const MARGE = 14;
  const tous = $derived([...runs, ...runsCibles]);
  const mini = $derived(tous.length ? Math.floor((Math.min(...tous) - 10) / 10) * 10 : 0);
  const maxi = $derived(tous.length ? Math.ceil((Math.max(...tous) + 10) / 10) * 10 : 1);
  const x = (i) => MARGE + (i * (L - 2 * MARGE)) / 7;
  const y = (v) => MARGE + ((v - mini) / Math.max(1, maxi - mini)) * (H - 2 * MARGE); // plus lent = plus bas
  const trace = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
</script>

<Bloc titre="Allure des 8 runs">
  {#if runs.length}
    <div class="legende">
      <span><span class="trait test"></span>Ton test</span>
      {#if runsCibles.length}<span><span class="trait objectif"></span>Objectif</span>{/if}
    </div>
    <svg viewBox="0 0 {L} {H}" role="img" aria-label={`Temps des 8 runs : de ${ecrireTemps(runs[0])} à ${ecrireTemps(runs[7])}`}>
      <text x="0" y="10" class="axe">{ecrireTemps(mini)}</text>
      <text x="0" y={H - 2} class="axe">{ecrireTemps(maxi)}</text>
      {#if runsCibles.length}<path d={trace(runsCibles)} fill="none" class="objectif" />{/if}
      <path d={trace(runs)} fill="none" class="test" />
      {#each runs as v, i}<circle cx={x(i)} cy={y(v)} r="4" class="point" />{/each}
    </svg>
    <div class="bas"><span>Run 1</span><span>Run 8</span></div>
  {:else}
    <p class="vide">Saisis un test pour voir l'allure de tes 8 runs.</p>
  {/if}
</Bloc>

<style>
  .legende {
    display: flex;
    gap: 16px;
    margin-bottom: 8px;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .legende span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .trait {
    width: 18px;
    height: 0;
    border-top: 3px solid var(--sport-hybride);
  }
  .trait.objectif {
    border-top: 2px dashed var(--texte-doux);
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
  }
  path {
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  path.test {
    stroke: var(--sport-hybride);
    stroke-width: 3;
  }
  path.objectif {
    stroke: var(--texte-doux);
    stroke-width: 2;
    stroke-dasharray: 5 5;
  }
  .point {
    fill: var(--surface);
    stroke: var(--sport-hybride);
    stroke-width: 2.5;
  }
  .axe {
    font-size: 10px;
    fill: var(--texte-doux);
  }
  .bas {
    display: flex;
    justify-content: space-between;
    margin-top: 4px;
    font-size: 11px;
    color: var(--texte-doux);
  }
  .vide {
    font-size: 14px;
    color: var(--texte-doux);
  }
</style>
