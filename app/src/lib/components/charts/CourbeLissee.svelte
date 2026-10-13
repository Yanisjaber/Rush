<script>
  import { lisse, echelle, aireSousCourbe } from '../../utils/courbes.js';

  // Courbe lissée avec dégradé qui s'efface sous la courbe et point sur la dernière valeur.
  // `etiquette` décrit le graphique pour les lecteurs d'écran.
  let {
    valeurs = [],
    couleur = 'var(--sport-neutre)',
    largeur = 300,
    hauteur = 80,
    marge = 6,
    epaisseur = 2.6,
    aire = true,
    pointFinal = true,
    min,
    max,
    etiquette = 'Courbe',
  } = $props();

  // Identifiant propre à ce graphique (le dégradé SVG en a besoin, plusieurs graphiques coexistent)
  const idDegrade = `deg-${Math.random().toString(36).slice(2, 9)}`;

  const points = $derived(echelle(valeurs, largeur, hauteur, marge, min, max));
  const ligne = $derived(lisse(points));
  const zone = $derived(aireSousCourbe(ligne, points, hauteur));
  const dernier = $derived(points[points.length - 1]);
</script>

<svg viewBox="0 0 {largeur} {hauteur}" role="img" aria-label={etiquette}>
  <defs>
    <linearGradient id={idDegrade} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style:stop-color={couleur} stop-opacity="0.35" />
      <stop offset="1" style:stop-color={couleur} stop-opacity="0" />
    </linearGradient>
  </defs>
  {#if aire && zone}<path d={zone} fill="url(#{idDegrade})" />{/if}
  {#if ligne}
    <path d={ligne} fill="none" style:stroke={couleur} stroke-width={epaisseur} stroke-linecap="round" />
  {/if}
  {#if pointFinal && dernier}
    <circle cx={dernier[0]} cy={dernier[1]} r="4.5" style:fill={couleur} />
  {/if}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }
</style>
