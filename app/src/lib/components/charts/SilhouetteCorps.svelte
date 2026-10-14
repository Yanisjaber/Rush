<script>
  // Le corps humain dessiné (de face et de dos), chaque muscle teinté selon son pourcentage de la zone visée.
  // Partagé par la page d'analyse (cliquable) et le widget de l'accueil (lecture seule : sans `onchoisir`).
  //  muscles : { [slug]: { nom, pct, groupe, portions } } · actif(slug) : le muscle est-il mis en valeur ? · onchoisir(slug) : toucher un muscle
  import { CORPS_SVG } from '../../data/corps-svg.js';
  let { muscles = {}, actif = () => false, onchoisir = null, etiquette = 'Corps humain', legendes = true, vue = 'toutes' } = $props();

  // Du gris (jamais travaillé) au corail du muscu (130 % de la zone visée ou plus)
  const teinte = (pct) => `color-mix(in srgb, var(--sport-muscu) ${Math.round((Math.min(Math.max(pct ?? 0, 0), 130) / 130) * 100)}%, var(--trait-fort))`;
  // Les épaules : l'avant du deltoïde se lit de face et l'arrière de dos (le faisceau latéral se lit dans le détail)
  const FAISCEAU_DE_LA_VUE = { Face: 'avant', Dos: 'arriere' };
  const pctPiece = (slug, vue) => {
    const m = muscles[slug];
    if (slug === 'deltoids') return m.portions?.find((p) => p.cle === FAISCEAU_DE_LA_VUE[vue])?.pct ?? m.pct;
    return m.pct;
  };

  // Les tracés du dessin portent le nom d'un muscle ; les tibias sont rattachés aux mollets, le reste (tête, mains, pieds…) ne compte pas.
  const ALIAS = { tibialis: 'calves' };
  const VUES = [
    { nom: 'Face', ...CORPS_SVG.face },
    { nom: 'Dos', ...CORPS_SVG.dos },
  ]
    .filter((v) => vue === 'toutes' || v.nom === vue) // une seule vue (Face ou Dos) quand la place manque
    .map((v) => ({ ...v, pieces: v.zones.map((z) => ({ ...z, muscle: ALIAS[z.slug] || z.slug })) }));
</script>

<div class="silhouettes">
  {#each VUES as v (v.nom)}
    <figure>
      <svg viewBox={v.viewBox} role={onchoisir ? 'group' : 'img'} aria-label={`${etiquette}, vue de ${v.nom.toLowerCase()}`}>
        <path d={v.contour} class="contour" />
        {#each v.pieces.filter((z) => !muscles[z.muscle]) as z (z.slug)}<path d={z.d} class="neutre" />{/each}
        {#each v.pieces.filter((z) => muscles[z.muscle]) as z (z.slug)}
          {#if onchoisir}
            <path
              d={z.d}
              class="zone cliquable"
              class:choisie={actif(z.muscle)}
              style:fill={teinte(pctPiece(z.muscle, v.nom))}
              role="button"
              tabindex="0"
              aria-label={muscles[z.muscle].nom}
              aria-pressed={actif(z.muscle)}
              onclick={() => onchoisir(z.muscle)}
              onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onchoisir(z.muscle))}
            />
          {:else}
            <path d={z.d} class="zone" style:fill={teinte(pctPiece(z.muscle, v.nom))} />
          {/if}
        {/each}
      </svg>
      {#if legendes}<figcaption>{v.nom}</figcaption>{/if}
    </figure>
  {/each}
</div>

<style>
  .silhouettes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
    gap: 8px;
    height: 100%;
  }
  figure {
    display: flex;
    flex-direction: column;
    min-height: 0;
    margin: 0;
    text-align: center;
  }
  svg {
    display: block;
    flex: 1;
    width: 100%;
    min-height: 0;
  }
  figcaption {
    margin-top: 4px;
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-muet);
  }
  .contour {
    fill: none;
    stroke: var(--trait-fort);
    stroke-width: 4;
    stroke-linejoin: round;
    pointer-events: none;
  }
  .neutre {
    fill: color-mix(in srgb, var(--trait-fort) 40%, var(--surface-2));
    stroke: var(--surface-2);
    stroke-width: 3;
  }
  .zone {
    stroke: var(--surface-2);
    stroke-width: 3;
    stroke-linejoin: round;
    outline: none;
    transition: fill 0.2s;
  }
  .cliquable {
    cursor: pointer;
  }
  .cliquable:hover {
    stroke: var(--texte-doux);
  }
  .zone.choisie {
    stroke: var(--texte);
    stroke-width: 7;
  }
  .cliquable:focus-visible {
    stroke: var(--texte);
    stroke-width: 7;
  }
</style>
