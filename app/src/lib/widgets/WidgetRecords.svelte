<script>
  import Bloc from '../components/Bloc.svelte';
  import CourbeLissee from '../components/charts/CourbeLissee.svelte';
  import { exercicesPhares } from '../data/force.js';
  import { formatKg, formatDateCourte } from '../utils/format.js';

  // Les exercices que tu pratiques le plus : 1RM estimé, record éventuel et progression.
  let { contexte, taille = 'l' } = $props();
  const exos = $derived(exercicesPhares(contexte.force.series, taille === 'm' ? 2 : 3));
</script>

<Bloc titre="Tes records">
  {#if exos.length}
    <div class="cartes">
      {#each exos as e (e.cle)}
        <article class="carte">
          <header>
            <h3>{e.nom}</h3>
            {#if e.record}
              <span class="badge record">Record</span>
            {:else if e.delta != null && e.delta !== 0}
              <span class="badge">{e.delta > 0 ? '+' : '−'}{formatKg(Math.abs(e.delta))} kg</span>
            {/if}
          </header>
          <div class="chiffre titre">{formatKg(e.rm)}<span class="unite">kg</span><span class="estime">1RM estimé</span></div>
          {#if e.serie.length > 1}
            <div class="courbe">
              <CourbeLissee valeurs={e.serie.map((p) => p.rm)} couleur="var(--sport-muscu)" hauteur={64} etiquette={`Progression du 1RM estimé : ${e.nom}`} />
            </div>
          {/if}
          <p class="pied">{formatDateCourte(e.date)} · {e.reps} × {formatKg(e.poids)} kg</p>
        </article>
      {/each}
    </div>
  {:else}
    <p class="vide">Tes records apparaîtront dès que tu auras enregistré quelques séries.</p>
  {/if}
</Bloc>

<style>
  .cartes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 12px;
  }
  .carte {
    padding: 16px 16px 14px;
    background: var(--surface-2);
    border-radius: var(--rayon);
    min-width: 0;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }
  h3 {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--texte-doux);
  }
  .badge {
    flex: none;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: var(--rayon-rond);
    background: var(--surface);
    color: var(--texte-doux);
  }
  .badge.record {
    background: var(--sport-muscu);
    color: var(--encre-sur-couleur);
  }
  .chiffre {
    margin-top: 8px;
    font-size: 40px;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .unite {
    margin-left: 4px;
    font-family: var(--police-texte);
    font-size: 16px;
    font-weight: 500;
    color: var(--texte-doux);
  }
  .estime {
    margin-left: 8px;
    font-family: var(--police-texte);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0;
    color: var(--texte-doux);
  }
  .courbe {
    margin-top: 10px;
  }
  .pied {
    margin-top: 8px;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .vide {
    font-size: 14px;
    color: var(--texte-doux);
  }
</style>
