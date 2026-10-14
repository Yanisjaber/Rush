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
  // Plusieurs muscles réels (trapèzes, deltoïdes, grand dorsal, quadriceps…) sont dessinés séparément mais colorés par groupe.
  const FACE = [
    { g: null, d: 'M100 6 C88 6 80 16 80 30 C80 44 86 54 94 58 L100 60 Z' }, // tête
    { g: null, d: 'M100 58 L93 56 C92 64 91 68 88 72 L100 76 Z' }, // cou
    { g: 'dos', d: 'M100 74 L88 72 C80 76 72 80 64 84 C72 86 84 88 100 88 Z' }, // trapèzes
    { g: 'epaules', d: 'M64 84 C52 86 44 96 42 110 C41 120 44 128 50 130 C54 118 60 108 70 100 C70 94 68 88 64 84 Z' }, // deltoïde
    { g: 'pectoraux', d: 'M100 88 C88 88 76 92 70 100 C66 110 70 122 80 126 C88 128 96 126 100 124 Z' },
    { g: 'tronc', d: 'M70 128 L80 130 L78 137 L70 135 Z' }, // dentelés
    { g: 'tronc', d: 'M70 138 L79 140 L77 147 L69 145 Z' },
    { g: 'tronc', d: 'M69 148 L78 150 L76 156 L69 154 Z' },
    { g: 'tronc', d: 'M99 130 L90 130 C89 136 89 140 90 144 L99 144 Z' }, // abdominaux, 4 blocs
    { g: 'tronc', d: 'M99 146 L90 146 C89 152 89 156 90 160 L99 160 Z' },
    { g: 'tronc', d: 'M99 162 L91 162 C90 168 90 172 91 176 L99 176 Z' },
    { g: 'tronc', d: 'M99 178 L92 178 C92 184 93 190 95 194 L99 196 Z' },
    { g: 'tronc', d: 'M88 130 C82 140 78 156 79 172 C80 184 84 192 90 196 C89 180 89 150 88 130 Z' }, // obliques
    { g: null, d: 'M99 198 L86 196 C80 200 76 208 76 218 C84 220 94 218 99 214 Z' }, // bassin
    { g: 'bras', d: 'M50 132 C46 146 45 158 47 170 L58 172 C60 160 60 146 58 130 Z' }, // biceps
    { g: 'bras', d: 'M47 174 C42 192 38 210 36 226 L47 230 C52 212 56 194 58 174 Z' }, // avant-bras
    { g: null, d: 'M36 228 C30 236 30 252 36 260 C42 262 48 250 47 230 Z' }, // main
    { g: 'jambes', d: 'M86 222 C78 238 74 262 75 288 C78 294 84 296 87 294 C86 268 88 244 92 224 Z' }, // quadriceps externe
    { g: 'jambes', d: 'M92 224 C88 244 87 270 88 294 C92 298 98 296 99 292 L99 220 C97 222 94 223 92 224 Z' }, // quadriceps interne
    { g: null, d: 'M78 296 C78 306 86 310 94 308 C98 304 98 298 96 294 Z' }, // genou
    { g: 'jambes', d: 'M79 312 C76 336 77 364 81 388 L92 388 C96 364 96 338 94 312 Z' }, // tibia et mollet
    { g: null, d: 'M80 390 L93 390 L96 408 L74 408 Z' }, // pied
  ];
  const DOS = [
    { g: null, d: 'M100 6 C88 6 80 16 80 30 C80 44 86 54 94 58 L100 60 Z' },
    { g: null, d: 'M100 58 L93 56 C92 64 91 68 88 72 L100 76 Z' },
    { g: 'dos', d: 'M100 74 L88 72 C80 76 72 82 66 86 C74 100 90 112 100 122 Z' }, // trapèzes
    { g: 'epaules', d: 'M64 84 C52 86 44 96 42 110 C41 120 44 128 50 130 C54 118 60 108 70 100 C70 94 68 88 64 84 Z' }, // deltoïde arrière
    { g: 'dos', d: 'M66 90 C60 98 62 108 70 112 C76 108 78 98 74 92 Z' }, // petit rond, sous-épineux
    { g: 'dos', d: 'M100 124 C90 114 78 112 72 118 C70 134 74 152 84 168 L100 176 Z' }, // grand dorsal
    { g: 'tronc', d: 'M100 178 L86 170 C84 180 86 190 92 198 L100 200 Z' }, // lombaires
    { g: 'bras', d: 'M50 132 C46 146 45 158 47 170 L58 172 C60 160 60 146 58 130 Z' }, // triceps
    { g: 'bras', d: 'M47 174 C42 192 38 210 36 226 L47 230 C52 212 56 194 58 174 Z' },
    { g: null, d: 'M36 228 C30 236 30 252 36 260 C42 262 48 250 47 230 Z' },
    { g: 'jambes', d: 'M100 202 L84 200 C76 208 76 226 86 234 C94 236 100 232 100 228 Z' }, // fessiers
    { g: 'jambes', d: 'M100 234 L82 238 C76 256 76 278 78 296 L96 296 C100 278 101 256 100 234 Z' }, // ischio-jambiers
    { g: 'jambes', d: 'M78 300 C72 322 76 350 82 372 C86 380 90 380 94 372 C98 350 98 322 94 300 Z' }, // mollets
    { g: null, d: 'M80 380 L93 380 L96 408 L74 408 Z' }, // pied et talon
  ];
  // Traits fins pour dessiner les séparations entre muscles (colonne vertébrale, ligne blanche…)
  const TRAITS_FACE = ['M100 90 L100 196', 'M100 124 C92 128 86 128 82 126', 'M70 100 C76 104 82 108 86 112'];
  const TRAITS_DOS = ['M100 74 L100 200', 'M100 124 C96 140 92 156 88 172', 'M88 240 C86 262 86 280 87 296'];
  const VUES = [
    { nom: 'Face', formes: FACE, traits: TRAITS_FACE },
    { nom: 'Dos', formes: DOS, traits: TRAITS_DOS },
  ];
</script>

<div class="corps">
  <div class="vues">
    {#each VUES as v (v.nom)}
      <figure>
        <svg viewBox="26 0 148 412" role="group" aria-label={`${etiquette}, vue de ${v.nom.toLowerCase()}`}>
          <defs>
            <!-- Léger ombrage : le haut et l'extérieur de chaque muscle sont plus clairs, ce qui donne du volume -->
            <linearGradient id={`relief-${v.nom}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#fff" stop-opacity="0.22" />
              <stop offset="0.55" stop-color="#fff" stop-opacity="0" />
              <stop offset="1" stop-color="#000" stop-opacity="0.3" />
            </linearGradient>
          </defs>
          <!-- La « peau » : les mêmes formes en plus épais, derrière, pour combler les vides entre les muscles -->
          {#each [false, true] as miroir (miroir)}
            <g transform={miroir ? 'translate(200 0) scale(-1 1)' : ''}>
              {#each v.formes as f, i (i)}<path d={f.d} class="peau" />{/each}
            </g>
          {/each}
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
                  <path d={f.d} class="relief" style:fill={`url(#relief-${v.nom})`} />
                {:else}
                  <path d={f.d} class="neutre" />
                {/if}
              {/each}
              {#each v.traits as t (t)}<path d={t} class="trait" />{/each}
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
    fill: color-mix(in srgb, var(--trait-fort) 40%, var(--surface-2));
    stroke: var(--surface-2);
    stroke-width: 1.5;
  }
  .peau {
    fill: color-mix(in srgb, var(--trait-fort) 40%, var(--surface-2));
    stroke: color-mix(in srgb, var(--trait-fort) 40%, var(--surface-2));
    stroke-width: 7;
    stroke-linejoin: round;
    pointer-events: none;
  }
  .relief {
    pointer-events: none;
  }
  .trait {
    fill: none;
    stroke: var(--surface-2);
    stroke-width: 1;
    opacity: 0.7;
    pointer-events: none;
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
