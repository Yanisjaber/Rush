<script>
  // Corps humain en 2D (de face et de dos) découpé en groupes musculaires : plus la zone est foncée, plus tu l'as travaillée.
  // Tout est dessiné en SVG (aucune image). On touche une zone (ou sa ligne dans la liste) pour voir le détail.
  // groupes : [{ groupe, nom, series, parSemaine, cible: [bas, haut], etat, pct, exercices: [{ nom, series }] }]
  let { groupes = [], etiquette = 'Corps humain' } = $props();

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

  // Moitié gauche du corps (côté gauche de l'image) ; la moitié droite est la même, en miroir.
  // Chaque forme : { g: groupe, d: tracé }. g = null pour les parties qui ne comptent pas (tête, mains, genoux, pieds…).
  const FACE = [
    { g: null, d: 'M100 8 C88 8 80 18 80 32 C80 48 88 58 100 58 Z' }, // tête
    { g: null, d: 'M100 56 L92 56 C92 64 90 70 86 76 L100 80 Z' }, // cou
    { g: 'dos', d: 'M99 77 L88 74 C84 80 80 84 76 86 L96 92 Z' }, // trapèzes vus de face
    { g: 'epaules', d: 'M78 84 C62 84 50 94 47 114 C46 122 50 128 57 126 C62 110 70 102 82 100 Z' },
    { g: 'pectoraux', d: 'M99 94 L83 90 C74 94 72 106 76 118 C82 126 94 126 99 122 Z' },
    { g: 'bras', d: 'M47 116 C42 136 42 152 44 168 L57 170 C59 154 59 138 58 124 Z' }, // haut du bras
    { g: 'bras', d: 'M44 172 C40 194 36 212 34 228 L47 230 C51 212 55 194 57 172 Z' }, // avant-bras
    { g: null, d: 'M34 232 C28 238 30 252 36 256 C42 254 48 244 47 232 Z' }, // main
    { g: 'tronc', d: 'M99 128 L86 128 C82 146 82 168 86 190 C92 196 97 196 99 196 Z' }, // abdominaux
    { g: 'tronc', d: 'M84 128 C75 138 73 162 77 188 L84 190 C80 168 80 146 84 128 Z' }, // obliques
    { g: null, d: 'M99 198 L82 194 C78 204 80 214 86 220 L99 216 Z' }, // bassin
    { g: 'jambes', d: 'M99 218 L84 222 C76 242 74 266 76 290 C80 296 92 296 96 290 C100 266 100 242 99 218 Z' }, // quadriceps
    { g: null, d: 'M78 296 C77 304 82 310 90 310 C96 306 97 298 95 294 Z' }, // genou
    { g: 'jambes', d: 'M78 312 C75 338 76 366 80 388 L92 388 C96 366 96 338 94 312 Z' }, // tibias et mollets
    { g: null, d: 'M80 390 L93 390 L96 406 L74 406 Z' }, // pied
  ];
  const DOS = [
    { g: null, d: 'M100 8 C88 8 80 18 80 32 C80 48 88 58 100 58 Z' },
    { g: null, d: 'M100 56 L92 56 C92 64 90 70 86 76 L100 80 Z' },
    { g: 'dos', d: 'M99 76 L90 76 C82 80 78 84 78 92 C76 112 78 140 86 168 L99 176 Z' }, // trapèzes et grand dorsal
    { g: 'epaules', d: 'M78 84 C62 84 50 94 47 114 C46 122 50 128 57 126 C62 110 70 102 82 100 Z' },
    { g: 'bras', d: 'M47 116 C42 136 42 152 44 168 L57 170 C59 154 59 138 58 124 Z' }, // triceps
    { g: 'bras', d: 'M44 172 C40 194 36 212 34 228 L47 230 C51 212 55 194 57 172 Z' },
    { g: null, d: 'M34 232 C28 238 30 252 36 256 C42 254 48 244 47 232 Z' },
    { g: 'tronc', d: 'M99 172 L86 168 C84 178 86 190 92 196 L99 198 Z' }, // lombaires
    { g: 'jambes', d: 'M99 198 L82 196 C76 206 78 226 90 232 C96 232 99 228 99 224 Z' }, // fessiers
    { g: 'jambes', d: 'M99 230 L80 234 C74 254 74 276 76 296 L94 296 C99 274 100 252 99 230 Z' }, // ischio-jambiers
    { g: 'jambes', d: 'M77 300 C73 326 76 362 80 388 L93 388 C97 362 99 326 95 300 Z' }, // mollets
    { g: null, d: 'M80 390 L93 390 L96 406 L74 406 Z' },
  ];
  const VUES = [
    { nom: 'Face', formes: FACE },
    { nom: 'Dos', formes: DOS },
  ];
</script>

<div class="corps">
  <div class="vues">
    {#each VUES as v (v.nom)}
      <figure>
        <svg viewBox="20 0 160 414" role="group" aria-label={`${etiquette}, vue de ${v.nom.toLowerCase()}`}>
          {#each [false, true] as miroir (miroir)}
            <g transform={miroir ? 'translate(200 0) scale(-1 1)' : ''}>
              {#each v.formes as f, i (i)}
                {#if f.g}
                  <path
                    d={f.d}
                    class="zone"
                    class:choisie={choisi === f.g}
                    style:fill={remplissage(f.g)}
                    role="button"
                    tabindex="0"
                    aria-label={groupes.find((x) => x.groupe === f.g)?.nom || f.g}
                    aria-pressed={choisi === f.g}
                    onclick={() => basculer(f.g)}
                    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), basculer(f.g))}
                  />
                {:else}
                  <path d={f.d} class="neutre" />
                {/if}
              {/each}
            </g>
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
          <p class="mini">{detail.exercices.length} exercice{detail.exercices.length > 1 ? 's' : ''} sur 4 semaines</p>
          <ul class="exos">
            {#each detail.exercices.slice(0, 6) as x (x.nom)}<li><span>{x.nom}</span><b>{x.series}</b></li>{/each}
          </ul>
        {:else}
          <p class="texte">Aucun exercice sur ce groupe ces 4 dernières semaines.</p>
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
    max-height: 480px;
  }
  figcaption {
    margin-top: 4px;
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-muet);
  }
  .neutre {
    fill: color-mix(in srgb, var(--trait-fort) 55%, var(--surface-2));
    stroke: var(--surface-2);
    stroke-width: 1.5;
  }
  .zone {
    stroke: var(--surface-2);
    stroke-width: 1.5;
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
    stroke-width: 2.5;
  }
  .zone:focus-visible {
    outline: none;
    stroke: var(--texte);
    stroke-width: 3;
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
