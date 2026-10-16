<script>
  import Bloc from '../components/Bloc.svelte';
  import Tuile from '../components/Tuile.svelte';
  import MiniBarres from '../components/MiniBarres.svelte';
  import SilhouetteCorps from '../components/charts/SilhouetteCorps.svelte';
  import { musclesSurPeriode } from '../analyse/muscu.js';
  import { seriesParGroupe } from '../data/force.js';

  // Le corps de face et de dos : chaque muscle est teinté selon ses séries des 7 derniers jours
  // (plus c'est foncé, plus il a travaillé par rapport à sa zone visée). Le détail est sur la page d'analyse.
  // compact : tuile pour téléphone (le groupe le plus travaillé + les séries de chaque groupe en barres), le corps est dans l'analyse
  let { contexte, compact = false } = $props();
  const muscles = $derived(musclesSurPeriode(contexte.force.series));
  const groupes = $derived([...seriesParGroupe(contexte.force.series)].sort((a, b) => b.series - a.series));
  const premier = $derived(groupes[0]);
  const second = $derived(groupes[1]);
</script>

{#if compact}
  <Tuile
    titre="Séries / semaine"
    valeur={premier.series > 0 ? premier.nom : '—'}
    note={premier.series > 0 ? `${premier.series} série${premier.series > 1 ? 's' : ''}${second.series > 0 ? ` · ${second.nom} ${second.series}` : ''}` : 'Aucune série cette semaine'}
  >
    {#if premier.series > 0}<MiniBarres valeurs={groupes.map((g) => g.series)} max={premier.series} etiquette="Séries par groupe musculaire cette semaine" />{/if}
  </Tuile>
{:else}
<Bloc titre="Séries par groupe" remplir>
  <div class="cadre"><div class="corps"><SilhouetteCorps {muscles} etiquette="Muscles travaillés cette semaine" /></div></div>
</Bloc>
{/if}

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
