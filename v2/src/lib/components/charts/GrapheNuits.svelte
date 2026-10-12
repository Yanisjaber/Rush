<script>
  // Graphique de séries de nuits (une valeur par nuit, de la plus ancienne à la plus récente).
  // Peut combiner : barres (simples ou empilées en %), lignes (sur la même échelle ou sur une échelle propre),
  // une bande min-max et des repères horizontaux. En survolant, la nuit pointée et ses valeurs sont écrites au-dessus.
  //  etiquettes : dates ISO · barres : [{ nom, valeurs, couleur, couleurs? }] · empile : empiler les barres (100 %)
  //  lignes : [{ nom, valeurs, couleur, pointille?, echelle?: { min, max } }] · bande : { min: [], max: [] }
  //  reperes : [{ valeur, etiquette }] · min / max : bornes de l'échelle · formater(valeur, nomSerie) : texte d'une valeur
  let { etiquettes = [], barres = [], empile = false, lignes = [], bande = null, reperes = [], min, max, hauteur = 150, formater = (v) => String(Math.round(v)), titre = 'Graphique' } = $props();

  const L = 800;
  const MARGE = 6;
  let survol = $state(null);

  const n = $derived(etiquettes.length);
  const toutes = $derived([...barres.flatMap((b) => b.valeurs), ...lignes.filter((l) => !l.echelle).flatMap((l) => l.valeurs), ...(bande ? [...bande.min, ...bande.max] : []), ...reperes.map((r) => r.valeur)].filter((v) => v != null && !Number.isNaN(v)));
  const echMin = $derived(min ?? (empile ? 0 : Math.min(0, ...(toutes.length ? toutes : [0]))));
  const echMax = $derived(max ?? (empile ? 100 : Math.max(1, ...(toutes.length ? toutes : [1])) * 1.08));
  const y = (v, e = { min: echMin, max: echMax }) => hauteur - MARGE - ((v - e.min) / (e.max - e.min || 1)) * (hauteur - 2 * MARGE);
  const pas = $derived(n ? L / n : L);
  const cx = (i) => i * pas + pas / 2;

  // Barres : empilées en % du total de chaque nuit, ou simples
  const rects = $derived.by(() => {
    const liste = [];
    for (let i = 0; i < n; i++) {
      const largeur = Math.max(2, pas * 0.7);
      if (empile) {
        const total = barres.reduce((s, b) => s + (b.valeurs[i] || 0), 0);
        let cumul = 0;
        for (const b of barres) {
          const part = total ? ((b.valeurs[i] || 0) / total) * 100 : 0;
          liste.push({ i, x: cx(i) - largeur / 2, w: largeur, y: y(cumul + part), h: Math.max(0, y(cumul) - y(cumul + part)), couleur: b.couleur });
          cumul += part;
        }
      } else {
        for (const b of barres) {
          const v = b.valeurs[i];
          if (v == null || Number.isNaN(v)) continue;
          liste.push({ i, x: cx(i) - largeur / 2, w: largeur, y: y(v), h: Math.max(1, y(echMin) - y(v)), couleur: b.couleurs?.[i] || b.couleur });
        }
      }
    }
    return liste;
  });

  // Lignes : les trous (valeurs absentes) interrompent le tracé
  const chemins = $derived(
    lignes.map((l) => {
      const e = l.echelle || { min: echMin, max: echMax };
      let d = '';
      let ouvert = false;
      l.valeurs.forEach((v, i) => {
        if (v == null || Number.isNaN(v)) return void (ouvert = false);
        d += `${ouvert ? 'L' : 'M'}${cx(i).toFixed(1)},${y(v, e).toFixed(1)}`;
        ouvert = true;
      });
      return { d, couleur: l.couleur, pointille: l.pointille };
    }),
  );
  const zoneBande = $derived.by(() => {
    if (!bande) return '';
    const haut = bande.max.map((v, i) => [cx(i), y(v)]).filter(([, yy]) => !Number.isNaN(yy));
    const bas = bande.min.map((v, i) => [cx(i), y(v)]).filter(([, yy]) => !Number.isNaN(yy)).reverse();
    return haut.length && bas.length ? `M${[...haut, ...bas].map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join('L')}Z` : '';
  });

  const jj = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const repereDates = $derived(n ? [0, Math.floor((n - 1) / 2), n - 1].filter((v, k, a) => a.indexOf(v) === k) : []);
  const lecture = $derived(
    survol == null || survol >= n
      ? ''
      : `${jj(etiquettes[survol])} : ${[...barres.map((b) => [b.nom, b.valeurs[survol]]), ...lignes.map((l) => [l.nom, l.valeurs[survol]])]
          .filter(([, v]) => v != null && !Number.isNaN(v))
          .map(([nom, v]) => `${nom} ${formater(v, nom)}`)
          .join(' · ')}`,
  );

  function bouger(e) {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width || !n) return;
    survol = Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n)));
  }
</script>

<figure class="graphe">
  <figcaption aria-live="off">{lecture || ' '}</figcaption>
  <svg viewBox="0 0 {L} {hauteur}" style:aspect-ratio="{L} / {hauteur}" preserveAspectRatio="none" role="img" aria-label={titre} onpointermove={bouger} onpointerleave={() => (survol = null)}>
    {#each reperes as r (r.valeur)}
      <line x1="0" x2={L} y1={y(r.valeur)} y2={y(r.valeur)} class="repere" />
    {/each}
    {#if zoneBande}<path d={zoneBande} class="bande" />{/if}
    {#each rects as r, k (k)}
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="1.5" style:fill={r.couleur} class:actif={survol === r.i} class:estompe={survol !== null && survol !== r.i} />
    {/each}
    {#each chemins as c, k (k)}
      <path d={c.d} fill="none" style:stroke={c.couleur} stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray={c.pointille ? '6 6' : null} />
    {/each}
    {#if survol !== null && survol < n}<line x1={cx(survol)} x2={cx(survol)} y1="0" y2={hauteur} class="curseur" />{/if}
  </svg>
  <div class="axe" aria-hidden="true">
    {#each repereDates as i (i)}<span style:left="{(cx(i) / L) * 100}%">{jj(etiquettes[i])}</span>{/each}
  </div>
  {#if reperes.some((r) => r.etiquette)}
    <p class="legende-reperes">{reperes.filter((r) => r.etiquette).map((r) => r.etiquette).join(' · ')}</p>
  {/if}
</figure>

<style>
  .graphe {
    margin: 0;
  }
  figcaption {
    min-height: 20px;
    margin-bottom: 4px;
    font-size: 13px;
    color: var(--texte-doux);
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    touch-action: pan-y;
    cursor: crosshair;
  }
  .repere {
    stroke: var(--trait-fort);
    stroke-dasharray: 4 5;
    stroke-width: 1;
  }
  .bande {
    fill: var(--trait);
    opacity: 0.6;
  }
  rect.estompe {
    opacity: 0.45;
  }
  .curseur {
    stroke: var(--texte-doux);
    stroke-width: 1;
    stroke-dasharray: 3 4;
  }
  .axe {
    position: relative;
    height: 16px;
  }
  .axe span {
    position: absolute;
    top: 2px;
    transform: translateX(-50%);
    font-size: 11px;
    color: var(--texte-muet);
  }
  .legende-reperes {
    margin-top: 2px;
    font-size: 12px;
    color: var(--texte-muet);
  }
</style>
