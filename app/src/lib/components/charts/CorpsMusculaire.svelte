<script>
  // Corps humain en 2D (de face et de dos) découpé en muscles : plus un muscle est foncé, plus tu l'as travaillé.
  // Tout est dessiné en SVG (aucune image). On touche un muscle (ou un groupe dans la liste) pour voir le détail :
  // un groupe se décompose en ses muscles, un muscle montre les exercices qui le travaillent.
  // groupes : [{ groupe, nom, series, parSemaine, cible, etat, pct, exercices, muscles: [{ slug, nom, parSemaine, series, cible, etat, pct, exercices: [{ nom, series, role }] }] }]
  import { CORPS_SVG } from '../../data/corps-svg.js';
  let { groupes = [], etiquette = 'Corps humain', periode = 'la période' } = $props();

  let choisi = $state(null); // clé du groupe sélectionné
  let muscleChoisi = $state(null); // slug du muscle sélectionné (dans ce groupe), sinon null

  const NOM_ETAT = { oublie: 'Oublié', sous: 'Sous la zone visée', zone: 'Dans la zone visée', 'au-dessus': 'Au-dessus de la zone visée' };
  const virgule = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
  const detail = $derived(groupes.find((g) => g.groupe === choisi) || null);
  const muscles = $derived(Object.fromEntries(groupes.flatMap((g) => g.muscles).map((m) => [m.slug, m])));
  const muscle = $derived(muscleChoisi ? muscles[muscleChoisi] || null : null);

  const choisirGroupe = (cle) => {
    muscleChoisi = null;
    choisi = choisi === cle && !muscle ? null : cle;
  };
  const choisirMuscle = (slug) => {
    const m = muscles[slug];
    if (!m) return;
    if (muscleChoisi === slug) {
      muscleChoisi = null;
      choisi = null;
      return;
    }
    choisi = m.groupe;
    muscleChoisi = slug;
  };

  // Du gris (jamais travaillé) au corail du muscu (130 % de la zone visée ou plus)
  const teinte = (pct) => `color-mix(in srgb, var(--sport-muscu) ${Math.round((Math.min(Math.max(pct ?? 0, 0), 130) / 130) * 100)}%, var(--trait-fort))`;
  // Les épaules : sur le dessin, l'avant du deltoïde se lit de face et l'arrière de dos (le faisceau latéral se lit dans le détail)
  const FAISCEAU_DE_LA_VUE = { Face: 'avant', Dos: 'arriere' };
  const pctPiece = (muscleSlug, vue) => {
    const m = muscles[muscleSlug];
    if (muscleSlug === 'deltoids') return m.portions?.find((p) => p.cle === FAISCEAU_DE_LA_VUE[vue])?.pct ?? m.pct;
    return m.pct;
  };
  const lumineux = (slug) => (muscleChoisi ? muscleChoisi === slug : choisi != null && muscles[slug]?.groupe === choisi);

  // Les tracés du dessin portent le nom d'un muscle ; les tibias sont rattachés aux mollets, le reste (tête, mains, pieds…) ne compte pas.
  const ALIAS = { tibialis: 'calves' };
  const VUES = [
    { nom: 'Face', ...CORPS_SVG.face },
    { nom: 'Dos', ...CORPS_SVG.dos },
  ].map((v) => ({
    ...v,
    pieces: v.zones.map((z) => ({ ...z, muscle: ALIAS[z.slug] || z.slug })),
  }));
</script>

<div class="corps">
  <div class="vues">
    {#each VUES as v (v.nom)}
      <figure>
        <svg viewBox={v.viewBox} role="group" aria-label={`${etiquette}, vue de ${v.nom.toLowerCase()}`}>
          <path d={v.contour} class="silhouette" />
          {#each v.pieces.filter((z) => !muscles[z.muscle]) as z (z.slug)}<path d={z.d} class="neutre" />{/each}
          {#each v.pieces.filter((z) => muscles[z.muscle]) as z (z.slug)}
            <path
              d={z.d}
              class="zone"
              class:choisie={lumineux(z.muscle)}
              style:fill={teinte(pctPiece(z.muscle, v.nom))}
              role="button"
              tabindex="0"
              aria-label={muscles[z.muscle].nom}
              aria-pressed={muscleChoisi === z.muscle}
              onclick={() => choisirMuscle(z.muscle)}
              onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), choisirMuscle(z.muscle))}
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
          <button type="button" class:actif={choisi === g.groupe} aria-pressed={choisi === g.groupe} onclick={() => choisirGroupe(g.groupe)}>
            <span class="ligne"><span class="nom">{g.nom}</span><span class="pct">{g.pct} %</span></span>
            <span class="barre" aria-hidden="true"><span style:width="{Math.min(g.pct, 130) / 1.3}%"></span></span>
          </button>
        </li>
      {/each}
    </ul>

    <div class="detail" aria-live="polite">
      {#if muscle}
        <button type="button" class="retour" onclick={() => (muscleChoisi = null)}>← {detail?.nom}</button>
        <h4>{muscle.nom}</h4>
        <p class="grand">{muscle.pct} % <span>de la zone visée</span></p>
        <p class="texte">{virgule(muscle.parSemaine)} séries par semaine (les séries où il aide comptent pour moitié) pour une zone de {muscle.cible[0]} à {muscle.cible[1]} : <strong>{NOM_ETAT[muscle.etat]}</strong>.</p>
        {#if muscle.portions?.length}
          <p class="mini">Les portions du muscle</p>
          <ul class="portions">
            {#each muscle.portions as p (p.cle)}
              <li>
                <span class="ligne"><span>{p.nom}</span><b>{p.pct} %</b></span>
                <span class="barre" aria-hidden="true"><span style:width="{Math.min(p.pct, 130) / 1.3}%"></span></span>
              </li>
            {/each}
          </ul>
          {#if muscle.slug === 'deltoids'}<p class="note">Sur le dessin, l'avant de l'épaule se lit sur la vue de face et l'arrière sur la vue de dos.</p>{/if}
        {/if}
        {#if muscle.exercices.length}
          <p class="mini">{muscle.exercices.length} exercice{muscle.exercices.length > 1 ? 's' : ''} sur {periode}</p>
          <ul class="exos">
            {#each muscle.exercices.slice(0, 8) as x (x.nom)}<li><span>{x.nom} <em>{x.role}</em></span><b>{x.series}</b></li>{/each}
          </ul>
        {:else}
          <p class="texte">Aucun exercice ne l'a travaillé sur cette période.{#if muscle.idee?.length} Pour le réveiller : {muscle.idee.join(', ')}.{/if}</p>
        {/if}
      {:else if detail}
        <h4>{detail.nom}</h4>
        <p class="grand">{detail.pct} % <span>de la zone visée</span></p>
        <p class="texte">{virgule(detail.parSemaine)} séries par semaine pour une zone de {detail.cible[0]} à {detail.cible[1]} : <strong>{NOM_ETAT[detail.etat]}</strong>.</p>
        <p class="mini">Les muscles de ce groupe</p>
        <ul class="muscles">
          {#each detail.muscles as m (m.slug)}
            <li>
              <button type="button" onclick={() => choisirMuscle(m.slug)}>
                <span class="ligne"><span>{m.nom}</span><b>{m.pct} %</b></span>
                <span class="barre" aria-hidden="true"><span style:width="{Math.min(m.pct, 130) / 1.3}%"></span></span>
              </button>
            </li>
          {/each}
        </ul>
        {#if detail.exercices.length}
          <p class="mini">{detail.exercices.length} exercice{detail.exercices.length > 1 ? 's' : ''} sur {periode}</p>
          <ul class="exos">
            {#each detail.exercices.slice(0, 6) as x (x.nom)}<li><span>{x.nom}</span><b>{x.series}</b></li>{/each}
          </ul>
        {:else}
          <p class="texte">Aucun exercice sur ce groupe sur cette période.</p>
        {/if}
      {:else}
        <p class="texte">Touche un muscle du corps (ou un groupe de la liste) pour voir le détail.</p>
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
  .portions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 6px 0 0;
    padding: 0;
    list-style: none;
    font-size: 14px;
  }
  .portions li {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .note {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--texte-muet);
  }
  .retour {
    margin: 0 0 8px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--texte-doux);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .retour:hover {
    color: var(--texte);
  }
  .muscles {
    margin: 6px 0 0;
    padding: 0;
    list-style: none;
  }
  .muscles button {
    display: flex;
    flex-direction: column;
    gap: 5px;
    width: 100%;
    min-height: 44px;
    padding: 6px 4px;
    border: 0;
    border-bottom: 1px solid var(--trait);
    background: none;
    color: var(--texte);
    font: inherit;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
  }
  .muscles button:hover {
    background: var(--surface-2);
  }
  .muscles button:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: -2px;
  }
  .exos em {
    margin-left: 6px;
    font-size: 11px;
    font-style: normal;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--texte-muet);
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
