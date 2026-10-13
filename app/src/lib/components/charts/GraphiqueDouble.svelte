<script>
  import { lisse, echelle } from '../../utils/courbes.js';
  import { statistiques } from '../../data/streams.js';

  // Deux courbes superposées sur un même graphique (par exemple puissance et fréquence cardiaque), chacune avec sa propre échelle.
  // Le curseur est partagé avec les autres graphiques de la sortie : quand on survole, les deux valeurs de l'instant sont affichées.
  //  a / b : { titre, valeurs (série déjà réduite), couleur, unite, formater? } · curseur : indice survolé (ou null) · onsurvol(indice | null)
  let { a, b, hauteur = 190, curseur = null, onsurvol } = $props();

  const LARGEUR = 800;
  const propres = (v) => {
    let derniere = v.find((x) => x != null) ?? 0;
    return v.map((x) => (x == null || Number.isNaN(x) ? derniere : (derniere = x)));
  };
  const va = $derived(propres(a.valeurs));
  const vb = $derived(propres(b.valeurs));
  const pa = $derived(echelle(va, LARGEUR, hauteur, 8, 0));
  const pb = $derived(echelle(vb, LARGEUR, hauteur, 8));
  const la = $derived(lisse(pa, 0.08));
  const lb = $derived(lisse(pb, 0.08));
  const sa = $derived(statistiques(a.valeurs));
  const sb = $derived(statistiques(b.valeurs));
  const fmt = (s, v) => (s.formater ? s.formater(v) : String(Math.round(v)));
  const x = $derived(curseur != null && pa[curseur] ? pa[curseur][0] : null);
  const n = $derived(va.length);

  function survoler(e) {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width || n < 2) return;
    onsurvol?.(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  }
</script>

<figure class="graphique">
  <figcaption>
    <span class="serie" style:color={a.couleur}><i style:background={a.couleur}></i>{a.titre}
      <strong>{curseur != null && va[curseur] != null ? `${fmt(a, va[curseur])} ${a.unite}` : sa ? `moy. ${fmt(a, sa.moyenne)} ${a.unite}` : ''}</strong></span>
    <span class="serie" style:color={b.couleur}><i style:background={b.couleur}></i>{b.titre}
      <strong>{curseur != null && vb[curseur] != null ? `${fmt(b, vb[curseur])} ${b.unite}` : sb ? `moy. ${fmt(b, sb.moyenne)} ${b.unite}` : ''}</strong></span>
  </figcaption>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg viewBox="0 0 {LARGEUR} {hauteur}" role="img" aria-label="{a.titre} et {b.titre} superposées" onpointermove={survoler} onpointerleave={() => onsurvol?.(null)}>
    {#if lb}<path d={lb} fill="none" style:stroke={b.couleur} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />{/if}
    {#if la}<path d={la} fill="none" style:stroke={a.couleur} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />{/if}
    {#if x !== null}
      <line x1={x} y1="0" x2={x} y2={hauteur} class="repere" />
      <circle cx={x} cy={pa[curseur][1]} r="4.5" style:fill={a.couleur} class="point" />
      <circle cx={x} cy={pb[curseur][1]} r="4.5" style:fill={b.couleur} class="point" />
    {/if}
  </svg>
</figure>

<style>
  .graphique {
    margin: 0;
  }
  figcaption {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 24px;
    margin-bottom: 6px;
    font-size: 13px;
  }
  .serie {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
  }
  .serie i {
    width: 14px;
    height: 3px;
    border-radius: 2px;
  }
  .serie strong {
    font-weight: 600;
    color: var(--texte);
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    touch-action: pan-y;
    cursor: crosshair;
  }
  .repere {
    stroke: var(--texte-doux);
    stroke-width: 1;
    stroke-dasharray: 3 4;
  }
  .point {
    stroke: var(--fond);
    stroke-width: 2;
  }
</style>
