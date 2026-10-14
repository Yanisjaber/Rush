<script>
  import Bloc from '../components/Bloc.svelte';
  import SilhouetteCorps from '../components/charts/SilhouetteCorps.svelte';
  import { musclesSurPeriode } from '../analyse/muscu.js';

  // Le corps de face et de dos : chaque muscle est teinté selon ses séries des 7 derniers jours
  // (plus c'est foncé, plus il a travaillé par rapport à sa zone visée). Le détail est sur la page d'analyse.
  let { contexte } = $props();
  const muscles = $derived(musclesSurPeriode(contexte.force.series));
</script>

<Bloc titre="Séries par groupe · cette semaine">
  <div class="cadre"><div class="corps"><SilhouetteCorps {muscles} etiquette="Muscles travaillés cette semaine" /></div></div>
</Bloc>

<style>
  /* La hauteur suit la largeur de la carte (≈ 58 %) : la carte a ainsi la même hauteur que ses voisines (Régularité, Volume) */
  .cadre {
    container-type: inline-size;
  }
  .corps {
    height: clamp(200px, 58cqw, 330px);
    padding: 12px 8px 8px;
    border-radius: var(--rayon-l);
    background: var(--surface-2);
  }
</style>
