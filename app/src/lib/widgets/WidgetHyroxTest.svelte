<script>
  import Bloc from '../components/Bloc.svelte';
  import { SEGMENTS, analyserTest, ciblesSegments, ecrireTemps, formatEcartLong } from '../data/hyrox.js';
  import { formatDateCourte } from '../utils/format.js';

  // Ton dernier test, segment par segment : chaque case est large comme le temps passé dessus.
  let { contexte } = $props();
  const test = $derived(contexte.hyrox.tests[0] || null);
  const analyse = $derived(test ? analyserTest(test.segments) : null);
  const cibles = $derived(ciblesSegments(contexte.hyrox.objectif, test));
  const ecart = $derived(contexte.hyrox.objectif && test ? test.total_s - contexte.hyrox.objectif.total_s : null);
</script>

<Bloc titre="Ton dernier test, course par course">
  {#snippet actions()}
    <span class="legende"><span class="pastille run"></span>Run 1 km <span class="pastille station"></span>Station</span>
  {/snippet}
  {#if test}
    <p class="sous-titre">{test.label} · {formatDateCourte(test.date)}</p>
    <ol class="bande" aria-label="Temps de chaque segment du test">
      {#each SEGMENTS as s, i (s.i)}
        <li class={s.type} style:flex="{test.segments[i]} 1 0">
          <span class="etiq">{s.court}</span>
          <span class="temps">{ecrireTemps(test.segments[i])}</span>
        </li>
      {/each}
    </ol>
    <dl class="totaux">
      <div><dt>Temps total</dt><dd class="titre">{ecrireTemps(analyse.total)}</dd></div>
      <div><dt>Runs</dt><dd class="titre">{ecrireTemps(analyse.runs)}</dd></div>
      <div><dt>Stations</dt><dd class="titre">{ecrireTemps(analyse.stations)}</dd></div>
      <div><dt>Écart objectif</dt><dd class="titre" class:perdu={ecart > 0} class:gagne={ecart != null && ecart <= 0}>{ecart != null ? formatEcartLong(ecart) : '—'}</dd></div>
    </dl>
    {#if !cibles}<p class="note">Fixe un objectif de temps dans <a href="#/hyrox">ta page Hyrox</a> pour voir l'écart.</p>{/if}
  {:else}
    <p class="vide">Pas encore de test enregistré. <a href="#/hyrox">Saisis ta première simulation</a> pour voir tes 16 segments.</p>
  {/if}
</Bloc>

<style>
  .sous-titre {
    margin: -8px 0 12px;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .legende {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .pastille {
    width: 9px;
    height: 9px;
    border-radius: 2px;
    margin-left: 8px;
  }
  .pastille:first-child {
    margin-left: 0;
  }
  .pastille.run {
    background: var(--surface-2);
    outline: 1px solid var(--trait-fort);
  }
  .pastille.station {
    background: var(--sport-hybride);
  }
  .bande {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    gap: 3px;
    min-height: 62px;
  }
  .bande li {
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 6px 2px 5px;
    border-radius: 4px;
    overflow: hidden;
    font-size: 9px;
    line-height: 1.2;
    text-align: center;
  }
  .bande li.run {
    background: var(--surface-2);
    color: var(--texte-doux);
  }
  .bande li.station {
    background: var(--sport-hybride);
    color: var(--encre-sur-couleur);
  }
  .etiq {
    font-weight: 700;
    letter-spacing: 0;
  }
  .temps {
    font-variant-numeric: tabular-nums;
  }
  .totaux {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 14px;
    margin: 20px 0 0;
  }
  dt {
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-doux);
  }
  dd {
    margin: 4px 0 0;
    font-size: 28px;
    line-height: 1;
    letter-spacing: -0.01em;
  }
  dd.perdu {
    color: var(--sport-course);
  }
  dd.gagne {
    color: var(--ok);
  }
  .note,
  .vide {
    margin-top: 14px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .vide {
    margin-top: 0;
    font-size: 14px;
  }
  a {
    color: var(--texte);
  }
</style>
