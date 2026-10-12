<script>
  import { tousSegments, milieu, indiceZone, ZONES } from '../data/structure.js';

  // Profil d'une séance structurée : une barre par segment, largeur = durée, hauteur = intensité, teinte = zone.
  //  blocs : structure normalisée · couleur : couleur du sport (une teinte de plus en plus soutenue avec la zone)
  let { blocs = [], couleur = 'var(--sport-neutre)', hauteur = 110 } = $props();

  const LARGEUR = 800;
  const segments = $derived(tousSegments(blocs));
  const total = $derived(segments.reduce((t, s) => t + s.seg.min, 0));
  const barres = $derived.by(() => {
    if (!total) return [];
    let x = 0;
    return segments.map(({ seg, metric }) => {
      const largeur = Math.max(1.5, (seg.min / total) * LARGEUR);
      const pct = milieu(seg);
      const nb = (ZONES[metric] || ZONES.power).noms.length;
      const zone = indiceZone(pct, metric);
      const h = Math.max(6, Math.min(1, pct / 150) * hauteur);
      const barre = { x, largeur: Math.max(0, largeur - 1), y: hauteur - h, h, teinte: Math.round(25 + (zone / Math.max(1, nb - 1)) * 75) };
      x += largeur;
      return barre;
    });
  });
</script>

{#if barres.length}
  <svg viewBox="0 0 {LARGEUR} {hauteur}" role="img" aria-label="Profil de la séance : {segments.length} segments" preserveAspectRatio="none">
    {#each barres as b, i (i)}
      <rect x={b.x} y={b.y} width={b.largeur} height={b.h} rx="2" style:fill="color-mix(in srgb, {couleur} {b.teinte}%, var(--surface-2))" />
    {/each}
  </svg>
{/if}

<style>
  svg {
    display: block;
    width: 100%;
    height: 90px;
  }
</style>
