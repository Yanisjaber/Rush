<script>
  import { lisse, echelle, aireSousCourbe } from '../../utils/courbes.js';
  import { statistiques } from '../../data/streams.js';

  // Courbe d'une séance (puissance, cardio, altitude…) avec un curseur partagé entre tous les graphiques :
  // quand on survole l'un, le même instant est repéré sur les autres.
  //  valeurs : série déjà réduite (~300 points) · curseur : indice survolé (ou null) · onsurvol(indice | null)
  let {
    titre,
    valeurs = [],
    couleur = 'var(--sport-neutre)',
    unite = '',
    formater = (v) => String(Math.round(v)),
    hauteur = 120,
    curseur = null,
    onsurvol,
    aire = true,
    min,
    max,
  } = $props();

  const LARGEUR = 800;
  const idDegrade = `deg-${Math.random().toString(36).slice(2, 9)}`;

  // Les trous (valeurs absentes) sont comblés par la dernière valeur connue, pour ne pas casser la courbe
  const propres = $derived.by(() => {
    let derniere = valeurs.find((v) => v != null) ?? 0;
    return valeurs.map((v) => (v == null || Number.isNaN(v) ? derniere : (derniere = v)));
  });
  const points = $derived(echelle(propres, LARGEUR, hauteur, 6, min, max));
  const ligne = $derived(lisse(points, 0.08));
  const zone = $derived(aireSousCourbe(ligne, points, hauteur));
  const stats = $derived(statistiques(valeurs));
  const x = $derived(curseur != null && points[curseur] ? points[curseur][0] : null);
  const y = $derived(curseur != null && points[curseur] ? points[curseur][1] : null);
  const valeurCurseur = $derived(curseur != null && propres[curseur] != null ? formater(propres[curseur]) : null);

  function survoler(evenement) {
    const rect = evenement.currentTarget.getBoundingClientRect();
    if (!rect.width || valeurs.length < 2) return;
    const ratio = (evenement.clientX - rect.left) / rect.width;
    onsurvol?.(Math.max(0, Math.min(valeurs.length - 1, Math.round(ratio * (valeurs.length - 1)))));
  }
</script>

<figure class="graphique">
  <figcaption>
    <span class="titre-graphique titre">{titre}</span>
    <span class="chiffres">
      {#if valeurCurseur !== null}
        <strong style:color={couleur}>{valeurCurseur} {unite}</strong>
      {:else if stats}
        <span>moy. <strong>{formater(stats.moyenne)}</strong></span>
        <span>max <strong>{formater(stats.max)}</strong> {unite}</span>
      {/if}
    </span>
  </figcaption>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg
    viewBox="0 0 {LARGEUR} {hauteur}"
    role="img"
    aria-label="{titre}{stats ? `, moyenne ${formater(stats.moyenne)} ${unite}, maximum ${formater(stats.max)} ${unite}` : ''}"
    onpointermove={survoler}
    onpointerleave={() => onsurvol?.(null)}
  >
    <defs>
      <linearGradient id={idDegrade} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style:stop-color={couleur} stop-opacity="0.3" />
        <stop offset="1" style:stop-color={couleur} stop-opacity="0" />
      </linearGradient>
    </defs>
    {#if aire && zone}<path d={zone} fill="url(#{idDegrade})" />{/if}
    {#if ligne}<path d={ligne} fill="none" style:stroke={couleur} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />{/if}
    {#if x !== null}
      <line x1={x} y1="0" x2={x} y2={hauteur} class="repere" />
      <circle cx={x} cy={y} r="5" style:fill={couleur} class="point" />
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
    align-items: baseline;
    justify-content: space-between;
    gap: 4px 16px;
    margin-bottom: 6px;
  }
  .titre-graphique {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0;
  }
  .chiffres {
    display: flex;
    gap: 12px;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .chiffres strong {
    color: var(--texte);
    font-weight: 600;
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
