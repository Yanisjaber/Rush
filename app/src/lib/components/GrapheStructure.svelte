<script>
  import { segmentsDuBloc, milieu, indiceZone, ZONES, COULEURS_ZONE, texteDuree } from '../data/structure.js';

  // Graphique éditable d'une séance, dans l'esprit de Zwift :
  //   - largeur d'une barre = durée, hauteur = intensité, couleur = zone ;
  //   - les lignes pointillées sont les limites de zone (étiquettes dans la gouttière de gauche) ;
  //   - le nom de chaque bloc est écrit sous ses barres, et l'axe du temps en dessous ;
  //   - toucher une barre sélectionne son bloc ; tirer son HAUT change l'intensité, son BORD DROIT la durée.
  //  blocs : structure normalisée · selection : indice du bloc choisi · metrique : 'power' | 'hr' | 'pace'
  //  onselectionner(indice) · onmodifier(indiceBloc, 'work' | 'rec', changements) pendant le geste · ondebut() / onfin() autour du geste
  //  infobulle(segment) : texte affiché au-dessus de la barre choisie (durée · cible)
  let { blocs = [], metrique = 'power', selection = null, onselectionner, onmodifier, ondebut, onfin, infobulle } = $props();

  let zone = $state(null); // zone des barres (pour mesurer largeur et hauteur)
  let figee = $state(null); // échelle gelée pendant un geste : sinon tout bouge sous le doigt
  let geste = null;

  const segments = $derived.by(() => {
    const liste = [];
    let debut = 0;
    blocs.forEach((b, bi) => {
      const vus = new Set(); // poignées et infobulle seulement sur la 1re répétition : modifier l'une modifie toutes les autres
      for (const { seg, role } of segmentsDuBloc(b)) {
        const quel = role === 'travail' ? 'work' : 'rec';
        liste.push({ bi, quel, debut, min: seg.min, pct: milieu(seg), metric: b.metric, premiere: !vus.has(quel), seg });
        vus.add(quel);
        debut += seg.min;
      }
    });
    return liste;
  });
  // Un libellé par bloc, sous ses barres
  const etiquettes = $derived(
    blocs.map((b, bi) => {
      const mine = segments.filter((s) => s.bi === bi);
      const debut = mine[0]?.debut ?? 0;
      const fin = mine.length ? mine[mine.length - 1].debut + mine[mine.length - 1].min : 0;
      return { bi, debut, duree: fin - debut, texte: `${b.name}${b.reps > 1 ? ` ×${b.reps}` : ''}` };
    }),
  );
  const total = $derived(figee?.total ?? (segments.reduce((t, s) => t + s.min, 0) || 1));
  const pctMax = $derived(figee?.pctMax ?? Math.max(130, Math.ceil((Math.max(0, ...segments.map((s) => s.pct)) * 1.1) / 10) * 10));
  const limites = $derived((ZONES[metrique] || ZONES.power).bas.map((b, k) => ({ k, b })).filter((l) => l.b > 0 && l.b < pctMax));
  const couleurZone = (s) => COULEURS_ZONE[Math.min(COULEURS_ZONE.length - 1, indiceZone(s.pct, s.metric))];

  // Axe du temps : 4 à 8 reperes réguliers (toutes les 5, 10, 15, 30 ou 60 min)
  const reperes = $derived.by(() => {
    const pas = [5, 10, 15, 30, 60, 120].find((p) => total / p <= 8) ?? 120;
    const liste = [];
    for (let t = 0; t <= total; t += pas) liste.push({ t, texte: t === 0 ? '0' : texteDuree(t) });
    return liste;
  });

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
    geste = { mode, bi: s.bi, quel: s.quel, x: e.clientX, y: e.clientY, min: s.seg.min, pct: milieu(s.seg), pxMin: r.width / total, pxPct: r.height / pctMax };
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

<div class="cadre">
  <div class="corps-graphe" role="group" aria-label="Profil de la séance. Touche une barre pour la choisir, tire son haut pour l'intensité, son bord droit pour la durée.">
    <div class="bandes" aria-hidden="true">
      {#each limites as l (l.k)}
        <div class="bande" style:bottom="{(l.b / pctMax) * 100}%" style:border-color={COULEURS_ZONE[Math.min(l.k, COULEURS_ZONE.length - 1)]}>
          <span style:color={COULEURS_ZONE[Math.min(l.k, COULEURS_ZONE.length - 1)]}>Z{l.k + 1}</span>
        </div>
      {/each}
    </div>

    <div class="plot" bind:this={zone}>
      {#each segments as s, i (i)}
        {@const choisi = selection === s.bi}
        <div
          class="barre"
          class:choisi
          class:estompe={selection !== null && !choisi}
          style:left="{(s.debut / total) * 100}%"
          style:width="calc({(s.min / total) * 100}% - 2px)"
          style:height="{Math.max(2, (s.pct / pctMax) * 100)}%"
          style:background={couleurZone(s)}
        >
          <button type="button" class="corps" aria-label="Bloc {s.bi + 1} : {blocs[s.bi].name}" aria-pressed={choisi} onclick={() => onselectionner?.(s.bi)} onkeydown={(e) => touche(e, s.bi)}></button>
          {#if choisi && s.premiere}
            {#if infobulle && s.quel === 'work'}<span class="infobulle">{infobulle(s)}</span>{/if}
            <div class="poignee haut" aria-hidden="true" onpointerdown={(e) => commencer(e, s, 'intensite')} onpointermove={bouger} onpointerup={finir} onpointercancel={finir}></div>
            <div class="poignee droite" aria-hidden="true" onpointerdown={(e) => commencer(e, s, 'duree')} onpointermove={bouger} onpointerup={finir} onpointercancel={finir}></div>
          {/if}
        </div>
      {/each}
    </div>

    <div class="noms" aria-hidden="true">
      {#each etiquettes as l (l.bi)}
        <span class="nom" class:choisi={selection === l.bi} style:left="{(l.debut / total) * 100}%" style:width="{(l.duree / total) * 100}%">{l.texte}</span>
      {/each}
    </div>

    <div class="axe" aria-hidden="true">
      {#each reperes as r (r.t)}<span style:left="{(r.t / total) * 100}%">{r.texte}</span>{/each}
    </div>
  </div>
</div>

<style>
  .cadre {
    padding: 12px;
    background: var(--fond);
    border: 1px solid var(--trait);
    border-radius: var(--rayon-l);
  }
  .corps-graphe {
    --gouttiere-zones: 54px;
    position: relative;
    height: clamp(260px, 40vh, 380px);
    user-select: none;
  }
  .bandes {
    position: absolute;
    inset: 0 0 46px 0;
    pointer-events: none;
  }
  .bande {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1px dashed;
    opacity: 0.55;
  }
  /* Étiquettes de zone dans une gouttière réservée : les barres ne les recouvrent jamais */
  .bande span {
    position: absolute;
    left: 2px;
    top: -9px;
    padding: 0 3px;
    background: var(--fond);
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
  }
  .plot {
    position: absolute;
    left: var(--gouttiere-zones);
    right: 0;
    top: 14px;
    bottom: 46px;
    touch-action: pan-y;
  }
  .barre {
    position: absolute;
    bottom: 0;
    min-width: 3px;
    border-radius: 3px 3px 0 0;
    opacity: 0.95;
    transition: opacity 0.15s;
  }
  .barre.estompe {
    opacity: 0.45;
  }
  .barre.choisi {
    outline: 2px solid var(--texte);
    outline-offset: 1px;
    opacity: 1;
    z-index: 3;
  }
  .corps {
    position: absolute;
    inset: 0;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .corps:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .infobulle {
    position: absolute;
    top: -30px;
    left: 50%;
    transform: translateX(-50%);
    padding: 3px 9px;
    background: var(--surface-2);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-s);
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    pointer-events: none;
    z-index: 5;
  }
  .poignee {
    position: absolute;
    z-index: 4;
    background: var(--texte);
    border-radius: 4px;
    opacity: 0.9;
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
  .noms,
  .axe {
    position: absolute;
    left: var(--gouttiere-zones);
    right: 0;
  }
  .noms {
    bottom: 24px;
    height: 18px;
  }
  .nom {
    position: absolute;
    top: 0;
    padding: 0 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
    font-size: 11px;
    color: var(--texte-doux);
    border-top: 2px solid var(--trait-fort);
    padding-top: 2px;
    box-sizing: border-box;
  }
  .nom.choisi {
    color: var(--texte);
    border-top-color: var(--texte);
    font-weight: 700;
  }
  .axe {
    bottom: 0;
    height: 16px;
    border-top: 1px solid var(--trait);
  }
  .axe span {
    position: absolute;
    top: 3px;
    transform: translateX(-30%);
    font-size: 10.5px;
    color: var(--texte-muet);
    white-space: nowrap;
  }
</style>
