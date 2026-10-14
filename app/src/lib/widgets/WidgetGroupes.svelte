<script>
  import Bloc from '../components/Bloc.svelte';
  import SilhouetteCorps from '../components/charts/SilhouetteCorps.svelte';
  import Camembert from '../components/charts/Camembert.svelte';
  import { seriesParGroupe } from '../data/force.js';
  import { musclesSurPeriode } from '../analyse/muscu.js';

  // Séries par groupe musculaire sur 7 jours : le corps de face et de dos (chaque muscle teinté selon son volume),
  // puis un camembert par groupe (le pourcentage de sa zone visée, 100 % = milieu de la zone).
  let { contexte } = $props();
  const groupes = $derived(
    seriesParGroupe(contexte.force.series).map((g) => ({ ...g, pct: Math.round((g.series / ((g.cible[0] + g.cible[1]) / 2)) * 100) })),
  );
  const muscles = $derived(musclesSurPeriode(contexte.force.series));
</script>

<Bloc titre="Séries par groupe · cette semaine">
  <div class="conteneur">
  <div class="contenu">
    <div class="corps"><SilhouetteCorps {muscles} etiquette="Muscles travaillés cette semaine" /></div>
    <ul class="camemberts">
      {#each groupes as g (g.groupe)}
        <li>
          <span class="anneau"><Camembert pct={g.pct} etiquette={`${g.nom} : ${g.series} séries, ${g.pct} % de la zone visée de ${g.cible[0]} à ${g.cible[1]}`} /></span>
          <span class="nom">{g.nom}</span>
          <span class="series">{g.series} série{g.series > 1 ? 's' : ''}</span>
        </li>
      {/each}
    </ul>
  </div>
  </div>
</Bloc>

<style>
  /* Étroit : le corps au-dessus, les camemberts dessous. Large : le corps à gauche, les camemberts à droite. */
  .conteneur {
    container-type: inline-size;
  }
  .contenu {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .corps {
    height: 280px;
    padding: 12px 8px 8px;
    border-radius: var(--rayon-l);
    background: var(--surface-2);
  }
  .camemberts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
  }
  .anneau {
    display: block;
    width: min(100%, 84px);
  }
  .nom {
    font-size: 13px;
    font-weight: 600;
  }
  .series {
    font-size: 12px;
    color: var(--texte-doux);
  }
  @container (min-width: 560px) {
    .contenu {
      flex-direction: row;
      align-items: stretch;
    }
    .corps {
      flex: 0 0 50%;
      height: 340px;
    }
    .camemberts {
      flex: 1;
      align-content: center;
    }
  }
</style>
