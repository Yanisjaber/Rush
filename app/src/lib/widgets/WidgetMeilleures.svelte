<script>
  import Bloc from '../components/Bloc.svelte';
  import { meilleuresSortiesCourse } from '../data/synthese.js';
  import { formatAllure, formatDuree, formatKm, formatDateCourte } from '../utils/format.js';

  let { contexte, taille = 'm' } = $props();
  const m = $derived(meilleuresSortiesCourse(contexte.toutesSeances));
  const lignes = $derived(
    [
      m.plusLongue && { cle: 'longue', nom: 'Plus longue', valeur: `${formatKm(m.plusLongue.valeur.km)} km`, detail: `${formatDuree(m.plusLongue.valeur.secondes)} · ${formatDateCourte(m.plusLongue.date)}` },
      m.rapide5 && { cle: 'r5', nom: 'Plus rapide (≥ 5 km)', valeur: formatAllure(m.rapide5.valeur.allure), detail: `${formatKm(m.rapide5.valeur.km)} km · ${formatDateCourte(m.rapide5.date)}` },
      m.rapide10 && { cle: 'r10', nom: 'Plus rapide (≥ 10 km)', valeur: formatAllure(m.rapide10.valeur.allure), detail: `${formatKm(m.rapide10.valeur.km)} km · ${formatDateCourte(m.rapide10.date)}` },
    ].filter(Boolean),
  );
</script>

<Bloc titre="Meilleures sorties">
  {#if lignes.length}
    <ul class="liste">
      {#each lignes as l (l.cle)}
        <li>
          <div class="texte">
            <div class="nom">{l.nom}</div>
            <div class="detail">{l.detail}</div>
          </div>
          <div class="valeur titre">{l.valeur}</div>
        </li>
      {/each}
    </ul>
    <p class="note">Sur les 12 dernières semaines.</p>
  {:else}
    <p class="vide">Pas encore de sortie de course sur les 12 dernières semaines.</p>
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
  .texte {
    flex: 1;
    min-width: 0;
  }
  .nom {
    font-size: 14px;
    font-weight: 600;
  }
  .detail {
    font-size: 12px;
    color: var(--texte-doux);
  }
  .valeur {
    font-size: 22px;
    line-height: 1;
    letter-spacing: 0;
    color: var(--sport-course);
  }
  .note,
  .vide {
    margin-top: 12px;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .vide {
    margin-top: 0;
    font-size: 14px;
  }
</style>
