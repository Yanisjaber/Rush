<script>
  import { segmentsDuBloc, milieu, indiceZone, ZONES } from '../data/structure.js';

  // Profil d'une séance structurée : une barre par segment, largeur = durée, hauteur = intensité, teinte = zone.
  // Cliquable : toucher une barre sélectionne son bloc (le bloc choisi reste en couleur, les autres s'estompent).
  //  blocs : structure normalisée · couleur : couleur du sport · selection : indice du bloc choisi (ou null)
  //  onselectionner(indice) : appelé au clic ; absent = graphique en lecture seule
  let { blocs = [], couleur = 'var(--sport-neutre)', hauteur = 150, selection = null, onselectionner } = $props();

  const LARGEUR = 800;
  const total = $derived(blocs.reduce((t, b) => t + segmentsDuBloc(b).reduce((s, x) => s + x.seg.min, 0), 0));
  const barres = $derived.by(() => {
    if (!total) return [];
    const liste = [];
    let x = 0;
    blocs.forEach((b, bi) => {
      for (const { seg } of segmentsDuBloc(b)) {
        const largeur = Math.max(2, (seg.min / total) * LARGEUR);
        const pct = milieu(seg);
        const nb = (ZONES[b.metric] || ZONES.power).noms.length;
        const zone = indiceZone(pct, b.metric);
        const h = Math.max(8, Math.min(1, pct / 150) * hauteur);
        liste.push({ bi, x, largeur: Math.max(0, largeur - 1), y: hauteur - h, h, teinte: Math.round(25 + (zone / Math.max(1, nb - 1)) * 75) });
        x += largeur;
      }
    });
    return liste;
  });
  const interactif = $derived(typeof onselectionner === 'function');
  const choisir = (bi) => interactif && onselectionner(bi);
  function touche(e, bi) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choisir(bi);
    }
  }
</script>

{#if barres.length}
  <svg viewBox="0 0 {LARGEUR} {hauteur}" role={interactif ? 'group' : 'img'} aria-label="Profil de la séance, {blocs.length} bloc{blocs.length > 1 ? 's' : ''}" preserveAspectRatio="none" style:height="{Math.round(hauteur * 0.75)}px">
    {#each barres as b, i (i)}
      <!-- Zone de clic pleine hauteur : plus facile à toucher qu'une petite barre basse -->
      {#if interactif}
        <rect
          x={b.x}
          y="0"
          width={b.largeur + 1}
          height={hauteur}
          fill="transparent"
          role="button"
          tabindex="0"
          aria-label="Bloc {b.bi + 1} : {blocs[b.bi].name}"
          aria-pressed={selection === b.bi}
          class="cible"
          onclick={() => choisir(b.bi)}
          onkeydown={(e) => touche(e, b.bi)}
        />
      {/if}
      <rect
        x={b.x}
        y={b.y}
        width={b.largeur}
        height={b.h}
        rx="2"
        class:estompe={selection !== null && selection !== b.bi}
        style:fill="color-mix(in srgb, {couleur} {b.teinte}%, var(--surface-2))"
        pointer-events="none"
      />
    {/each}
  </svg>
{/if}

<style>
  svg {
    display: block;
    width: 100%;
  }
  .estompe {
    opacity: 0.35;
  }
  .cible {
    cursor: pointer;
  }
  .cible:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: -2px;
  }
</style>
