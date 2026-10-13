<script>
  // Graphique à lignes pour les analyses : plusieurs séries (certaines en pointillés pour le futur), des bandes de zones
  // colorées derrière, des repères verticaux (compétitions), et une lecture des valeurs quand on survole ou touche le graphique.
  //  etiquettes : un libellé par point (dates ISO « 2026-10-14 » → affichées « 14/10 ») · series : [{ nom, couleur, valeurs (null = trou), pointille }]
  //  bandes : [{ de, a, couleur, libelle }] · marqueurs : [{ iso, libelle }] · min / max : bornes de l'axe (sinon automatiques)
  let { etiquettes = [], series = [], bandes = [], marqueurs = [], hauteur = 240, min, max, etiquette = 'Graphique' } = $props();

  // La largeur du dessin suit celle du conteneur : les textes et les traits gardent leur taille réelle quel que soit l'écran
  let largeurMesuree = $state(760);
  const L = $derived(Math.max(300, Math.round(largeurMesuree)));
  const MG = { g: 40, d: 12, h: 14, b: 26 };
  const nb = $derived(etiquettes.length);
  const valeurs = $derived(series.flatMap((s) => s.valeurs).filter((v) => v != null));
  const borne = $derived.by(() => {
    let lo = min ?? Math.min(...valeurs, ...bandes.map((b) => b.de).filter((v) => v > -1000));
    let hi = max ?? Math.max(...valeurs, ...bandes.map((b) => b.a).filter((v) => v < 1000));
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: 0, hi: 1 };
    if (min == null && lo > 0 && lo < hi * 0.4) lo = 0;
    const marge = (hi - lo || 1) * 0.08;
    return { lo: min ?? lo - (lo === 0 ? 0 : marge), hi: max ?? hi + marge };
  });
  const x = (i) => MG.g + (nb <= 1 ? 0 : (i / (nb - 1)) * (L - MG.g - MG.d));
  const y = (v) => MG.h + (1 - (v - borne.lo) / (borne.hi - borne.lo || 1)) * (hauteur - MG.h - MG.b);

  // Graduations « rondes » de l'axe vertical
  const graduations = $derived.by(() => {
    const etendue = borne.hi - borne.lo || 1;
    const brut = etendue / 4;
    const p = 10 ** Math.floor(Math.log10(brut));
    const pas = [1, 2, 2.5, 5, 10].map((m) => m * p).find((c) => c >= brut) || brut;
    const sortie = [];
    for (let v = Math.ceil(borne.lo / pas) * pas; v <= borne.hi; v += pas) sortie.push(Math.round(v * 1000) / 1000);
    return sortie;
  });

  const estDate = (e) => /^\d{4}-\d{2}-\d{2}$/.test(e);
  const court = (e) => (estDate(e) ? `${e.slice(8)}/${e.slice(5, 7)}` : e);
  const ticksX = $derived.by(() => {
    if (!nb) return [];
    const n = Math.min(6, nb);
    return Array.from({ length: n }, (_, k) => Math.round((k / Math.max(1, n - 1)) * (nb - 1)));
  });
  const marques = $derived(marqueurs.map((m) => ({ ...m, i: etiquettes.indexOf(m.iso) })).filter((m) => m.i >= 0));

  // Une série devient plusieurs segments quand elle a des trous (valeurs nulles)
  function chemin(s) {
    let d = '';
    let ouvert = false;
    s.valeurs.forEach((v, i) => {
      if (v == null) {
        ouvert = false;
        return;
      }
      d += `${ouvert ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      ouvert = true;
    });
    return d.trim();
  }

  let survol = $state(-1);
  function suivre(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * L;
    survol = Math.min(nb - 1, Math.max(0, Math.round(((px - MG.g) / (L - MG.g - MG.d)) * (nb - 1))));
  }
  const lecture = $derived(
    survol >= 0 && survol < nb
      ? `${court(etiquettes[survol])} · ` + series.filter((s) => s.valeurs[survol] != null).map((s) => `${s.nom} ${String(s.valeurs[survol]).replace('.', ',')}`).join(' · ')
      : '',
  );
  const resume = $derived(`${etiquette}. ${series.map((s) => { const v = s.valeurs.filter((q) => q != null); return v.length ? `${s.nom} : de ${String(v[0]).replace('.', ',')} à ${String(v[v.length - 1]).replace('.', ',')}` : ''; }).filter(Boolean).join(' ; ')}.`);
</script>

<figure class="graphique" bind:clientWidth={largeurMesuree}>
  <p class="lecture" aria-live="off">{lecture || ' '}</p>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg viewBox="0 0 {L} {hauteur}" width={L} height={hauteur} role="img" aria-label={resume} onpointermove={suivre} onpointerleave={() => (survol = -1)}>
    {#each bandes as b (b.libelle + b.de)}
      {@const haut = y(Math.min(b.a, borne.hi))}
      {@const bas = y(Math.max(b.de, borne.lo))}
      <rect x={MG.g} y={Math.min(haut, bas)} width={L - MG.g - MG.d} height={Math.abs(bas - haut)} fill={b.couleur} opacity="0.1" />
      <text x={L - MG.d - 4} y={Math.min(haut, bas) + 12} class="bande" text-anchor="end" fill={b.couleur}>{b.libelle}</text>
    {/each}
    {#each graduations as g (g)}
      <line x1={MG.g} x2={L - MG.d} y1={y(g)} y2={y(g)} class="grille" />
      <text x={MG.g - 6} y={y(g) + 4} class="axe" text-anchor="end">{String(g).replace('.', ',')}</text>
    {/each}
    {#each ticksX as i (i)}
      <text x={x(i)} y={hauteur - 8} class="axe" text-anchor={i === 0 ? 'start' : i === nb - 1 ? 'end' : 'middle'}>{court(etiquettes[i])}</text>
    {/each}
    {#each marques as m (m.iso)}
      <line x1={x(m.i)} x2={x(m.i)} y1={MG.h} y2={hauteur - MG.b} class="marqueur" />
      <text x={x(m.i)} y={MG.h - 3} class="axe" text-anchor="middle">{m.libelle.length > 18 ? m.libelle.slice(0, 17) + '…' : m.libelle}</text>
    {/each}
    {#each series as s (s.nom)}
      <path d={chemin(s)} fill="none" style:stroke={s.couleur} stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray={s.pointille ? '6 5' : null} />
    {/each}
    {#if survol >= 0}
      <line x1={x(survol)} x2={x(survol)} y1={MG.h} y2={hauteur - MG.b} class="curseur" />
      {#each series as s (s.nom)}
        {#if s.valeurs[survol] != null}<circle cx={x(survol)} cy={y(s.valeurs[survol])} r="4" style:fill={s.couleur} />{/if}
      {/each}
    {/if}
  </svg>
  <ul class="legende">
    {#each series as s (s.nom)}
      <li><span class="trait" class:pointille={s.pointille} style:--c={s.couleur}></span>{s.nom}</li>
    {/each}
  </ul>
</figure>

<style>
  .graphique {
    margin: 0;
  }
  svg {
    display: block;
    max-width: 100%;
    touch-action: pan-y;
  }
  .lecture {
    min-height: 20px;
    margin: 0 0 4px;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: var(--texte);
  }
  .grille {
    stroke: var(--trait);
    stroke-width: 1;
  }
  .axe {
    font-size: 11px;
    fill: var(--texte-doux);
  }
  .bande {
    font-size: 10px;
    opacity: 0.9;
  }
  .marqueur {
    stroke: var(--texte-doux);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .curseur {
    stroke: var(--texte);
    stroke-width: 1;
    opacity: 0.5;
  }
  .legende {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .legende li {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .trait {
    width: 20px;
    height: 0;
    border-top: 3px solid var(--c);
  }
  .trait.pointille {
    border-top-style: dashed;
  }
</style>
