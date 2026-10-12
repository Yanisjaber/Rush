<script>
  import { segmentsDuBloc, milieu, indiceZone, ZONES, texteDuree } from '../data/structure.js';

  // Graphique éditable d'une séance, à la façon de Zwift : on agit directement dessus.
  //   - toucher une barre : sélectionne son bloc ;
  //   - tirer le HAUT d'une barre : change l'intensité ; tirer son BORD DROIT : change la durée.
  // Largeur d'une barre = durée, hauteur = intensité, teinte = zone. Les lignes pointillées sont les limites de zone.
  //  blocs : structure normalisée · selection : indice du bloc choisi · couleur : couleur du sport · metrique : 'power' | 'hr' | 'pace'
  //  onselectionner(indice) · onmodifier(indiceBloc, 'work' | 'rec', changements) pendant le geste · ondebut() / onfin() autour du geste
  let { blocs = [], couleur = 'var(--sport-neutre)', metrique = 'power', selection = null, onselectionner, onmodifier, ondebut, onfin } = $props();

  let zone = $state(null); // élément du graphique (pour mesurer la largeur et la hauteur)
  let figee = $state(null); // échelle gelée pendant un geste : sinon tout bouge sous le doigt
  let geste = null;

  const segments = $derived.by(() => {
    const liste = [];
    let debut = 0;
    blocs.forEach((b, bi) => {
      const vus = new Set(); // poignées et étiquette seulement sur la 1re répétition : modifier l'une modifie toutes les autres
      for (const { seg, role } of segmentsDuBloc(b)) {
        const quel = role === 'travail' ? 'work' : 'rec';
        liste.push({ bi, quel, debut, min: seg.min, pct: milieu(seg), metric: b.metric, premiere: !vus.has(quel) });
        vus.add(quel);
        debut += seg.min;
      }
    });
    return liste;
  });
  const total = $derived(figee?.total ?? (segments.reduce((t, s) => t + s.min, 0) || 1));
  const pctMax = $derived(figee?.pctMax ?? Math.max(130, Math.ceil((Math.max(0, ...segments.map((s) => s.pct)) * 1.1) / 10) * 10));
  const limites = $derived((ZONES[metrique] || ZONES.power).bas.map((b, k) => ({ k, b })).filter((l) => l.b > 0 && l.b < pctMax));
  const teinte = (s) => {
    const nb = (ZONES[s.metric] || ZONES.power).noms.length;
    return Math.round(25 + (indiceZone(s.pct, s.metric) / Math.max(1, nb - 1)) * 75);
  };

  // --- Gestes : tirer le haut (intensité) ou le bord droit (durée) d'une barre ---
  function commencer(e, s, mode) {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId); // le geste continue même si le doigt sort de la poignée
    } catch {
      /* pointeur déjà relâché : on continue sans capture */
    }
    const r = zone.getBoundingClientRect();
    const bloc = blocs[s.bi];
    geste = { mode, bi: s.bi, quel: s.quel, x: e.clientX, y: e.clientY, min: bloc[s.quel].min, pct: milieu(bloc[s.quel]), pxMin: r.width / total, pxPct: r.height / pctMax };
    figee = { total, pctMax };
    onselectionner?.(s.bi);
    ondebut?.();
  }
  function bouger(e) {
    if (!geste) return;
    if (geste.mode === 'duree') {
      const brut = geste.min + (e.clientX - geste.x) / geste.pxMin;
      const pas = brut < 10 ? 0.5 : 1; // 30 s pour les efforts courts, 1 min sinon
      onmodifier?.(geste.bi, geste.quel, { min: Math.max(0.5, Math.round(brut / pas) * pas) });
    } else {
      const brut = geste.pct + (geste.y - e.clientY) / geste.pxPct;
      onmodifier?.(geste.bi, geste.quel, { int: Math.min(300, Math.max(20, Math.round(brut))), intHi: null });
    }
  }
  function finir() {
    if (!geste) return;
    geste = null;
    figee = null;
    onfin?.();
  }
  const touche = (e, bi) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onselectionner?.(bi);
    }
  };
</script>

<div class="graphe" bind:this={zone} role="group" aria-label="Profil de la séance. Touche une barre pour la choisir, tire son haut pour l'intensité, son bord droit pour la durée.">
  {#each limites as l (l.k)}
    <div class="limite" style:bottom="{(l.b / pctMax) * 100}%"><span>Z{l.k + 1}</span></div>
  {/each}

  {#each segments as s, i (i)}
    {@const choisi = selection === s.bi}
    <div
      class="barre"
      class:choisi
      class:estompe={selection !== null && !choisi}
      style:left="{(s.debut / total) * 100}%"
      style:width="calc({(s.min / total) * 100}% - 2px)"
      style:height="{Math.max(3, (s.pct / pctMax) * 100)}%"
      style:background="color-mix(in srgb, {couleur} {teinte(s)}%, var(--surface-2))"
    >
      <button type="button" class="corps" aria-label="Bloc {s.bi + 1} : {blocs[s.bi].name}" aria-pressed={choisi} onclick={() => onselectionner?.(s.bi)} onkeydown={(e) => touche(e, s.bi)}>
        {#if choisi && s.premiere}<span class="etiq">{texteDuree(s.min)} · {Math.round(s.pct)} %</span>{/if}
      </button>
      {#if choisi && s.premiere}
        <div class="poignee haut" aria-hidden="true" onpointerdown={(e) => commencer(e, s, 'intensite')} onpointermove={bouger} onpointerup={finir} onpointercancel={finir}></div>
        <div class="poignee droite" aria-hidden="true" onpointerdown={(e) => commencer(e, s, 'duree')} onpointermove={bouger} onpointerup={finir} onpointercancel={finir}></div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .graphe {
    position: relative;
    height: clamp(200px, 32vh, 340px);
    margin-top: 8px;
    border-bottom: 2px solid var(--trait-fort);
    background: var(--fond);
    border-radius: var(--rayon) var(--rayon) 0 0;
    touch-action: pan-y;
    user-select: none;
  }
  .limite {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1px dashed var(--trait);
    pointer-events: none;
  }
  .limite span {
    position: absolute;
    left: 6px;
    top: -9px;
    padding: 0 4px;
    background: var(--fond);
    font-size: 11px;
    color: var(--texte-muet);
  }
  .barre {
    position: absolute;
    bottom: 0;
    min-width: 3px;
    border-radius: 3px 3px 0 0;
    transition: opacity 0.15s;
  }
  .barre.estompe {
    opacity: 0.4;
  }
  .barre.choisi {
    outline: 2px solid var(--texte);
    outline-offset: 0;
    z-index: 2;
  }
  .corps {
    position: absolute;
    inset: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--encre-sur-couleur, #000);
    cursor: pointer;
    overflow: hidden;
  }
  .corps:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .etiq {
    position: absolute;
    left: 4px;
    bottom: 4px;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
    color: var(--texte);
    text-shadow: 0 0 3px var(--fond), 0 0 3px var(--fond);
  }
  .poignee {
    position: absolute;
    z-index: 3;
    background: var(--texte);
    border-radius: 3px;
  }
  .poignee.haut {
    left: calc(50% - 16px);
    width: 32px;
    top: -4px;
    height: 8px;
    cursor: ns-resize;
    touch-action: none;
  }
  .poignee.droite {
    top: calc(50% - 16px);
    height: 32px;
    right: -4px;
    width: 8px;
    cursor: ew-resize;
    touch-action: none;
  }
  /* Zones de saisie plus grandes que le trait visible (doigt) */
  .poignee::after {
    content: '';
    position: absolute;
    inset: -14px;
  }
  .poignee:hover {
    background: var(--sport-hybride);
  }
</style>
