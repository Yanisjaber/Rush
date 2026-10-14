<script>
  import Bloc from '../components/Bloc.svelte';
  import SilhouetteCorps from '../components/charts/SilhouetteCorps.svelte';
  import { seriesParGroupe } from '../data/force.js';
  import { musclesSurPeriode } from '../analyse/muscu.js';

  // Séries par groupe musculaire sur 7 jours, avec la zone cible (bande claire) de chaque groupe.
  let { contexte } = $props();
  const groupes = $derived(seriesParGroupe(contexte.force.series));
  // Le corps : chaque muscle teinté selon ses séries des 7 derniers jours (100 % = milieu de sa zone visée)
  const muscles = $derived(musclesSurPeriode(contexte.force.series));
  let vue = $state('Face');
  const echelle = $derived(Math.max(20, ...groupes.map((g) => g.series)));
</script>

<Bloc titre="Séries par groupe · cette semaine">
  <div class="contenu">
    <div class="corps">
      <div class="vues" role="group" aria-label="Vue du corps">
        {#each ['Face', 'Dos'] as v (v)}<button type="button" aria-pressed={vue === v} onclick={() => (vue = v)}>{v}</button>{/each}
      </div>
      <div class="dessin"><SilhouetteCorps {muscles} {vue} etiquette="Muscles travaillés cette semaine" legendes={false} /></div>
    </div>
    <div class="barres">
  <p class="legende">La bande claire marque la zone de 10 à 20 séries par groupe.</p>
  <ul class="liste">
    {#each groupes as g (g.groupe)}
      <li>
        <span class="nom">{g.nom}</span>
        <span class="piste" role="img" aria-label={`${g.nom} : ${g.series} séries, zone visée de ${g.cible[0]} à ${g.cible[1]}`}>
          <span class="zone" style:left="{(g.cible[0] / echelle) * 100}%" style:width="{((g.cible[1] - g.cible[0]) / echelle) * 100}%"></span>
          <span class="remplie" style:width="{(g.series / echelle) * 100}%"></span>
        </span>
        <span class="nombre">{g.series}</span>
      </li>
    {/each}
  </ul>
    </div>
  </div>
</Bloc>

<style>
  .contenu {
    display: flex;
    gap: 18px;
    align-items: stretch;
  }
  .corps {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 0 0 44%;
    min-width: 0;
    height: 330px;
    padding: 10px 8px 8px;
    border-radius: var(--rayon-l);
    background: var(--surface-2);
  }
  .dessin {
    flex: 1;
    min-height: 0;
  }
  .vues {
    display: flex;
    justify-content: center;
    gap: 4px;
  }
  .vues button {
    min-height: 32px;
    padding: 0 12px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-rond);
    background: none;
    color: var(--texte-doux);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .vues button[aria-pressed='true'] {
    background: var(--texte);
    border-color: var(--texte);
    color: var(--fond);
  }
  .vues button:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .barres {
    flex: 1;
    min-width: 0;
  }
  .legende {
    margin: -6px 0 14px;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .liste {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  li {
    display: grid;
    grid-template-columns: minmax(56px, 84px) 1fr 24px;
    align-items: center;
    gap: 12px;
    font-size: 13px;
  }
  .nom {
    color: var(--texte-doux);
  }
  .piste {
    position: relative;
    height: 10px;
    background: var(--surface-2);
    border-radius: 5px;
    overflow: hidden;
  }
  .zone {
    position: absolute;
    top: 0;
    bottom: 0;
    background: color-mix(in srgb, var(--texte) 16%, transparent);
  }
  .remplie {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    background: var(--sport-muscu);
    border-radius: 5px;
    min-width: 2px;
  }
  .nombre {
    text-align: right;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
</style>
