<script>
  import Bloc from '../components/Bloc.svelte';
  import SilhouetteCorps from '../components/charts/SilhouetteCorps.svelte';
  import { musclesSurPeriode } from '../analyse/muscu.js';

  // Le corps de face et de dos : chaque muscle est teinté selon ses séries des 7 derniers jours
  // (plus c'est foncé, plus il a travaillé par rapport à sa zone visée). Le détail est sur la page d'analyse.
  let { contexte } = $props();
  const muscles = $derived(musclesSurPeriode(contexte.force.series));
</script>

<Bloc titre="Séries par groupe · cette semaine" remplir>
  <div class="cadre"><div class="corps"><SilhouetteCorps {muscles} etiquette="Muscles travaillés cette semaine" /></div></div>
</Bloc>

<style>
  /* Les corps remplissent la carte, quelle que soit sa hauteur : elle est fixée par la rangée (Régularité grandit avec l'écran),
     pas par eux. Minimum 220 px quand la rangée est basse. */
  .cadre {
    position: relative;
    flex: 1;
    min-height: 220px;
  }
  .corps {
    position: absolute;
    inset: 0;
    padding: 12px 8px 8px;
    border-radius: var(--rayon-l);
    background: var(--surface-2);
  }
</style>
