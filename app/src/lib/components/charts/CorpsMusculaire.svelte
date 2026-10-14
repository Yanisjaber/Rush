<script>
  // Corps humain en 2D (de face et de dos) découpé en groupes musculaires : plus la zone est foncée, plus tu l'as travaillée.
  // Tout est dessiné en SVG (aucune image). On touche une zone (ou sa ligne dans la liste) pour voir le détail.
  // groupes : [{ groupe, nom, series, parSemaine, cible: [bas, haut], etat, pct, exercices: [{ nom, series }] }]
  import { CORPS_SVG } from '../../data/corps-svg.js';
  let { groupes = [], etiquette = 'Corps humain', periode = '4 semaines' } = $props();

  let choisi = $state(null); // clé du groupe sélectionné

  const NOM_ETAT = { oublie: 'Oublié', sous: 'Sous la zone visée', zone: 'Dans la zone visée', 'au-dessus': 'Au-dessus de la zone visée' };
  const detail = $derived(groupes.find((g) => g.groupe === choisi) || null);
  const virgule = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
  const basculer = (cle) => (choisi = choisi === cle ? null : cle);

  // Du gris (jamais travaillé) au corail du muscu (130 % de la zone visée ou plus)
  const remplissage = (cle) => {
    const g = groupes.find((x) => x.groupe === cle);
    const t = g ? Math.round((Math.min(Math.max(g.pct, 0), 130) / 130) * 100) : 0;
    return `color-mix(in srgb, var(--sport-muscu) ${t}%, var(--trait-fort))`;
  };

  // Les muscles réels de chaque vue sont rattachés à nos 6 groupes ; le reste (tête, mains, pieds, genoux…) ne compte pas.
  const GROUPE_DU_MUSCLE = {
    chest: 'pectoraux',
    trapezius: 'dos',
    'upper-back': 'dos',
    deltoids: 'epaules',
    biceps: 'bras',
    triceps: 'bras',
    forearm: 'bras',
    abs: 'tronc',
    obliques: 'tronc',
    'lower-back': 'tronc',
    quadriceps: 'jambes',
    adductors: 'jambes',
    tibialis: 'jambes',
    calves: 'jambes',
    hamstring: 'jambes',
    gluteal: 'jambes',
  };
  const VUES = [
    { nom: 'Face', ...CORPS_SVG.face },
    { nom: 'Dos', ...CORPS_SVG.dos },
  ].map((v) => ({
    ...v,
    muscles: v.zones.filter((z) => GROUPE_DU_MUSCLE[z.slug]).map((z) => ({ ...z, g: GROUPE_DU_MUSCLE[z.slug] })),
    reste: v.zones.filter((z) => !GROUPE_DU_MUSCLE[z.slug]),
  }));
</script>

<div class="corps">
  <div class="vues">
    {#each VUES as v (v.nom)}
      <figure>
        <svg viewBox={v.viewBox} role="group" aria-label={`${etiquette}, vue de ${v.nom.toLowerCase()}`}>
          <path d={v.contour} class="silhouette" />
          {#each v.reste as z (z.slug)}<path d={z.d} class="neutre" />{/each}
          {#each v.muscles as z (z.slug)}
            <path
              d={z.d}
              class="zone"
              class:choisie={choisi === z.g}
              style:fill={remplissage(z.g)}
              role="button"
              tabindex="0"
              aria-label={groupes.find((x) => x.groupe === z.g)?.nom || z.g}
              aria-pressed={choisi === z.g}
              onclick={() => basculer(z.g)}
              onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), basculer(z.g))}
            />
          {/each}
        </svg>
        <figcaption>{v.nom}</figcaption>
      </figure>
    {/each}
  </div>

  <div class="infos">
    <ul class="liste">
      {#each groupes as g (g.groupe)}
        <li>
          <button type="button" class:actif={choisi === g.groupe} aria-pressed={choisi === g.groupe} onclick={() => basculer(g.groupe)}>
            <span class="ligne"><span class="nom">{g.nom}</span><span class="pct">{g.pct} %</span></span>
            <span class="barre" aria-hidden="true"><span style:width="{Math.min(g.pct, 130) / 1.3}%"></span></span>
          </button>
        </li>
      {/each}
    </ul>

    <div class="detail" aria-live="polite">
      {#if detail}
        <h4>{detail.nom}</h4>
        <p class="grand">{detail.pct} % <span>de la zone visée</span></p>
        <p class="texte">{virgule(detail.parSemaine)} séries par semaine pour une zone de {detail.cible[0]} à {detail.cible[1]} : <strong>{NOM_ETAT[detail.etat]}</strong>.</p>
        {#if detail.exercices.length}
          <p class="mini">{detail.exercices.length} exercice{detail.exercices.length > 1 ? 's' : ''} sur {periode}</p>
          <ul class="exos">
            {#each detail.exercices.slice(0, 6) as x (x.nom)}<li><span>{x.nom}</span><b>{x.series}</b></li>{/each}
          </ul>
        {:else}
          <p class="texte">Aucun exercice sur ce groupe sur cette période.</p>
        {/if}
      {:else}
        <p class="texte">Touche une zone du corps (ou une ligne de la liste) pour voir le détail.</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .corps {
    display: grid;
    grid-template-columns: minmax(260px, 1fr) minmax(260px, 1fr);
    gap: 20px 32px;
    align-items: start;
  }
  .vues {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 16px 8px 8px;
    border-radius: var(--rayon-l);
    background: var(--surface-2);
  }
  figure {
    margin: 0;
    text-align: center;
  }
  svg {
    display: block;
    width: 100%;
    max-height: 520px;
  }
  figcaption {
    margin-top: 4px;
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-muet);
  }
  .neutre {
    fill: color-mix(in srgb, var(--trait-fort) 40%, var(--surface-2));
    stroke: var(--surface-2);
    stroke-width: 3;
  }
  .silhouette {
    fill: none;
    stroke: var(--trait-fort);
    stroke-width: 4;
    stroke-linejoin: round;
    pointer-events: none;
  }
  .zone {
    stroke: var(--surface-2);
    stroke-width: 3;
    stroke-linejoin: round;
    cursor: pointer;
    outline: none;
    transition: fill 0.2s;
  }
  .zone:hover {
    stroke: var(--texte-doux);
  }
  .zone.choisie {
    stroke: var(--texte);
    stroke-width: 7;
  }
  .zone:focus-visible {
    outline: none;
    stroke: var(--texte);
    stroke-width: 7;
  }
  .liste {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .liste button {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid transparent;
    border-radius: var(--rayon-l);
    background: var(--surface-2);
    color: var(--texte);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .liste button:hover {
    border-color: var(--trait-fort);
  }
  .liste button.actif {
    border-color: var(--sport-muscu);
  }
  .liste button:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .ligne {
    display: flex;
    justify-content: space-between;
    font-size: 15px;
  }
  .nom {
    font-weight: 600;
  }
  .pct {
    font-family: var(--police-titre);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .barre {
    display: block;
    height: 4px;
    border-radius: 2px;
    background: var(--trait-fort);
    overflow: hidden;
  }
  .barre span {
    display: block;
    height: 100%;
    background: var(--sport-muscu);
  }
  .detail {
    margin-top: 16px;
    padding: 14px 16px;
    border-radius: var(--rayon-l);
    border: 1px solid var(--trait);
  }
  .detail h4 {
    font-size: 16px;
  }
  .grand {
    margin: 4px 0 0;
    font-family: var(--police-titre);
    font-size: 32px;
    font-weight: 700;
    line-height: 1.1;
  }
  .grand span {
    font-family: var(--police-texte);
    font-size: 14px;
    font-weight: 400;
    color: var(--texte-doux);
  }
  .texte {
    margin: 8px 0 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .texte strong {
    color: var(--texte);
  }
  .mini {
    margin: 12px 0 4px;
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-muet);
  }
  .exos {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .exos li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 5px 0;
    border-bottom: 1px solid var(--trait);
    font-size: 14px;
  }
  .exos li:last-child {
    border-bottom: 0;
  }
  @media (max-width: 640px) {
    .corps {
      grid-template-columns: 1fr;
    }
  }
</style>
