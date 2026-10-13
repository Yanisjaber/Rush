<script>
  import Bloc from './Bloc.svelte';
  import { anneesDe, statistiques, parSaison, texteClassement } from '../data/opendossard.js';
  import { formatDateCourte } from '../utils/format.js';

  // « Mon palmarès » : résultats officiels (Open Dossard) et résultats saisis à la main, regroupés.
  //  resultats : palmarès fusionné, du plus récent au plus ancien
  let { resultats = [] } = $props();

  let annee = $state('all');
  const annees = $derived(anneesDe(resultats));
  const s = $derived(statistiques(resultats, annee));
  const saisons = $derived(parSaison(resultats));
  const liste = $derived(annee === 'all' ? resultats : resultats.filter((r) => r.date.startsWith(`${annee}-`)));
  let toutVoir = $state(false);
  const visibles = $derived(toutVoir ? liste : liste.slice(0, 8));
  const rang = (n) => (n === 1 ? '1er' : `${n}e`);
  const pct = (n) => (s.courses ? (n / s.courses) * 100 : 0);
  const C = 213.6; // circonférence de l'anneau (rayon 34)
</script>

<Bloc titre="Mon palmarès">
  {#snippet actions()}
    <label class="annee">
      <span>Saison</span>
      <select bind:value={annee} aria-label="Choisir la saison du palmarès">
        <option value="all">Toutes</option>
        {#each annees as y (y)}<option value={String(y)}>{y}</option>{/each}
      </select>
    </label>
  {/snippet}

  <div class="haut">
    <div class="anneau" role="img" aria-label="{s.tauxTop10} % de tes courses terminées dans le top 10">
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r="34" fill="none" stroke="var(--trait)" stroke-width="8" />
        <circle cx="40" cy="40" r="34" fill="none" stroke="var(--texte)" stroke-width="8" stroke-linecap="round" stroke-dasharray={C} stroke-dashoffset={C * (1 - s.tauxTop10 / 100)} transform="rotate(-90 40 40)" />
      </svg>
      <span class="centre"><b class="titre">{s.tauxTop10} %</b><i>top 10</i></span>
    </div>

    <ul class="decompte">
      <li><b>{s.victoires}</b> victoire{s.victoires > 1 ? 's' : ''}</li>
      <li><b>{s.podiums}</b> podium{s.podiums > 1 ? 's' : ''}</li>
      <li><b>{s.top10}</b> top 10</li>
      <li><b>{s.courses}</b> course{s.courses > 1 ? 's' : ''}</li>
    </ul>

    <div class="meilleur">
      <span class="etiq">Meilleur résultat</span>
      <span class="valeur titre">{s.meilleur ? rang(s.meilleur.place) : '—'}</span>
      <span class="sous">{s.meilleur ? `${s.meilleur.nom} · ${formatDateCourte(s.meilleur.date)}` : 'Pas encore de résultat'}</span>
    </div>
  </div>

  {#if s.courses}
    <div class="repartition" role="img" aria-label="Répartition : {s.repartition.victoire} victoires, {s.repartition.podium} podiums, {s.repartition.top10} top 10, {s.repartition.autre} autres">
      {#if s.repartition.victoire}<span class="v" style:width="{pct(s.repartition.victoire)}%"></span>{/if}
      {#if s.repartition.podium}<span class="p" style:width="{pct(s.repartition.podium)}%"></span>{/if}
      {#if s.repartition.top10}<span class="t" style:width="{pct(s.repartition.top10)}%"></span>{/if}
      {#if s.repartition.autre}<span class="a" style:width="{pct(s.repartition.autre)}%"></span>{/if}
    </div>
    <ul class="cles">
      <li><i class="v"></i>Victoires</li>
      <li><i class="p"></i>Podiums</li>
      <li><i class="t"></i>Top 10</li>
      <li><i class="a"></i>Au-delà</li>
    </ul>
  {/if}

  {#if annee === 'all' && saisons.length > 1}
    <h3>Saison par saison</h3>
    <table>
      <thead><tr><th scope="col">Saison</th><th scope="col">Courses</th><th scope="col">Victoires</th><th scope="col">Podiums</th><th scope="col">Top 10</th></tr></thead>
      <tbody>
        {#each saisons as sa (sa.annee)}
          <tr><th scope="row">{sa.annee}</th><td>{sa.courses}</td><td>{sa.victoires}</td><td>{sa.podiums}</td><td>{sa.top10}</td></tr>
        {/each}
      </tbody>
    </table>
  {/if}

  {#if liste.length}
    <h3>Résultats</h3>
    <ul class="resultats">
      {#each visibles as r, i (r.date + r.nom + i)}
        <li>
          <span class="date">{formatDateCourte(r.date)}</span>
          <span class="nom">{r.nom || 'Course'}</span>
          <span class="classement">{texteClassement(r) || '—'}</span>
          <span class="source">{r.source === 'od' ? 'Open Dossard' : 'Saisi'}</span>
        </li>
      {/each}
    </ul>
    {#if liste.length > 8}
      <button type="button" class="lien" onclick={() => (toutVoir = !toutVoir)}>{toutVoir ? 'Voir moins' : `Voir les ${liste.length} résultats`}</button>
    {/if}
  {/if}
</Bloc>

<style>
  .annee {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .annee select {
    min-height: 44px;
    padding: 0 12px;
    background: var(--surface-2);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    font-size: 15px;
  }
  .haut {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 20px 36px;
    margin-bottom: 18px;
  }
  .anneau {
    position: relative;
    width: 96px;
    height: 96px;
  }
  .centre {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    line-height: 1.1;
  }
  .centre b {
    font-size: 22px;
  }
  .centre i {
    font-style: normal;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--texte-muet);
  }
  .decompte {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 15px;
    color: var(--texte-doux);
  }
  .decompte b {
    margin-right: 4px;
    font-size: 18px;
    color: var(--texte);
  }
  .meilleur {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .etiq {
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-muet);
  }
  .valeur {
    font-size: 34px;
    line-height: 1.1;
  }
  .sous {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .repartition {
    display: flex;
    gap: 3px;
    height: 12px;
    margin-bottom: 8px;
  }
  .repartition span {
    border-radius: 3px;
  }
  .v {
    background: var(--sport-hybride);
  }
  .p {
    background: var(--texte);
  }
  .t {
    background: var(--texte-doux);
  }
  .a {
    background: var(--trait-fort);
  }
  .cles {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    margin-bottom: 18px;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .cles li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .cles i {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
  h3 {
    margin: 18px 0 8px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-muet);
  }
  table {
    width: 100%;
    max-width: 520px;
    border-collapse: collapse;
    font-size: 14px;
  }
  th,
  td {
    padding: 8px 6px;
    border-top: 1px solid var(--trait);
    text-align: left;
    font-weight: 400;
  }
  thead th {
    border-top: 0;
    font-size: 12px;
    color: var(--texte-muet);
  }
  tbody th {
    font-weight: 700;
  }
  .resultats li {
    display: grid;
    grid-template-columns: 70px minmax(0, 1fr) 150px 100px;
    gap: 10px;
    align-items: baseline;
    padding: 9px 0;
    border-top: 1px solid var(--trait);
    font-size: 14px;
  }
  .resultats .date,
  .resultats .source {
    font-size: 12.5px;
    color: var(--texte-doux);
  }
  .resultats .nom {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .resultats .classement {
    font-weight: 700;
  }
  @media (max-width: 640px) {
    .resultats li {
      grid-template-columns: 60px minmax(0, 1fr) auto;
    }
    .resultats .source {
      display: none;
    }
  }
  .lien {
    min-height: 44px;
    padding: 0 4px;
    border: 0;
    background: transparent;
    color: var(--texte);
    font-size: 14px;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  select:focus-visible,
  .lien:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
</style>
