<script>
  import Bloc from '../components/Bloc.svelte';
  import NoteAncien from '../components/NoteAncien.svelte';
  import { seriesParGroupe, ancreSeries } from '../data/force.js';

  // Séries par groupe musculaire sur 7 jours, avec la zone cible (bande claire) de chaque groupe.
  let { contexte } = $props();
  // Rien dans les 7 derniers jours : on montre la semaine de ta dernière séance, en le disant
  const ancre = $derived(ancreSeries(contexte.force.series));
  const groupes = $derived(seriesParGroupe(contexte.force.series, ancre.date));
  const echelle = $derived(Math.max(20, ...groupes.map((g) => g.series)));
</script>

<Bloc titre={ancre.ancien ? 'Séries par groupe · dernière semaine' : 'Séries par groupe · cette semaine'}>
  {#if ancre.ancien}<NoteAncien derniere={ancre.derniere} suite="Voici la semaine de cette séance." />{/if}
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
</Bloc>

<style>
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
    grid-template-columns: 84px 1fr 28px;
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
