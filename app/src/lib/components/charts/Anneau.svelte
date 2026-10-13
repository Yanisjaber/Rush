<script>
  // Anneau segmenté (répartition entre sports, score…). Le contenu du centre se passe en enfant.
  // segments : [{ valeur, couleur, nom }]  ·  `total` fixe la valeur d'un tour complet (score sur 100…)
  let { segments = [], taille = 160, epaisseur = 16, total, etiquette = 'Répartition', children } = $props();

  const rayon = 54;
  const circonference = 2 * Math.PI * rayon;
  const somme = $derived(total ?? (segments.reduce((s, x) => s + x.valeur, 0) || 1));

  // Chaque segment : longueur de l'arc et décalage de départ, avec un petit vide entre deux arcs
  const arcs = $derived.by(() => {
    let cumul = 0;
    return segments.map((s) => {
      const longueur = (s.valeur / somme) * circonference;
      const depart = cumul;
      cumul += longueur;
      return {
        couleur: s.couleur,
        trait: `${Math.max(longueur - 3, 0).toFixed(1)} ${(circonference - Math.max(longueur - 3, 0)).toFixed(1)}`,
        decalage: (-depart).toFixed(1),
      };
    });
  });
</script>

<div class="anneau" style:width="{taille}px" style:height="{taille}px">
  <svg viewBox="0 0 140 140" role="img" aria-label={etiquette}>
    <circle cx="70" cy="70" r={rayon} fill="none" stroke="var(--surface-2)" stroke-width={epaisseur} />
    {#each arcs as arc}
      <circle
        cx="70"
        cy="70"
        r={rayon}
        fill="none"
        stroke-width={epaisseur}
        style:stroke={arc.couleur}
        style:stroke-dasharray={arc.trait}
        style:stroke-dashoffset={arc.decalage}
      />
    {/each}
  </svg>
  <div class="centre">{@render children?.()}</div>
</div>

<style>
  .anneau {
    position: relative;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }
  .centre {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
</style>
