<script>
  import Bloc from '../components/Bloc.svelte';
  import { predictionsCourse } from '../data/synthese.js';
  import { formatChrono } from '../utils/format.js';

  let { contexte, taille = 'm' } = $props();
  const predictions = $derived(predictionsCourse(contexte.toutesSeances));

  // Écart à l'objectif : on compare à la prédiction de la distance la plus proche de la prochaine course
  const objectif = $derived(contexte.objectifs[0] || null);
  const ecart = $derived.by(() => {
    if (!objectif || !objectif.km || !objectif.duration) return null;
    const proche = predictions.reduce((a, b) => (a && Math.abs(a.km - objectif.km) <= Math.abs(b.km - objectif.km) ? a : b), null);
    if (!proche || Math.abs(proche.km - objectif.km) > 1.5) return null;
    return { cle: proche.cle, secondes: proche.secondes - objectif.duration * 60 };
  });
</script>

<Bloc titre="Prédictions de temps">
  {#if predictions.length}
    <ul class="liste">
      {#each predictions as p (p.cle)}
        <li class:vedette={ecart && ecart.cle === p.cle}>
          <span class="distance">{p.label}</span>
          <span class="chrono titre">{formatChrono(p.secondes)}</span>
          {#if ecart && ecart.cle === p.cle}
            <span class="puce" class:avance={ecart.secondes <= 0}>
              {ecart.secondes <= 0 ? '−' : '+'}{formatChrono(Math.abs(ecart.secondes))} vs objectif
            </span>
          {/if}
        </li>
      {/each}
    </ul>
    {#if taille !== 's'}
      <p class="note">Estimées à partir de tes sorties des 4 derniers mois (formule de Riegel). Prudentes : une sortie d'entraînement n'est pas une course.</p>
    {/if}
  {:else}
    <p class="vide">Il faut au moins une sortie de 5 km sur les 4 derniers mois pour estimer tes temps.</p>
  {/if}
</Bloc>

<style>
  .liste li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-top: 1px solid var(--trait);
  }
  .liste li:first-child {
    border-top: 0;
    padding-top: 0;
  }
  .liste li.vedette {
    margin: 0 -26px;
    padding-left: 26px;
    padding-right: 26px;
    background: color-mix(in srgb, var(--sport-course) 12%, transparent);
  }
  .distance {
    flex: 0 0 64px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .chrono {
    flex: 1;
    font-size: 28px;
    line-height: 1;
    letter-spacing: -0.01em;
  }
  .puce {
    font-size: 12px;
    font-weight: 600;
    padding: 4px 9px;
    border-radius: var(--rayon-rond);
    background: var(--sport-course);
    color: var(--encre-sur-couleur);
    white-space: nowrap;
  }
  .puce.avance {
    background: var(--ok);
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
  }
</style>
