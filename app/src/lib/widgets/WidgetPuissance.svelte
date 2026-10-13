<script>
  import Bloc from '../components/Bloc.svelte';
  import { lisse } from '../utils/courbes.js';

  let { contexte, taille = 'm' } = $props();

  const LARGEUR = 400;
  const HAUTEUR = 230;
  const GAUCHE = 18;
  const DROITE = 18;
  const HAUT = 28;
  const BAS = 34;

  const LIBELLES = { 5: '5 s', 15: '15 s', 30: '30 s', 60: '1 min', 300: '5 min', 600: '10 min', 1200: '20 min', 3600: '1 h' };

  // Lignes valides (au moins une puissance), triées par durée
  const lignes = $derived(
    [...(contexte.puissance || [])].filter((l) => l.watts_90d > 0 || l.watts_alltime > 0).sort((a, b) => a.duration_s - b.duration_s),
  );

  // Abscisse logarithmique (de la plus courte à la plus longue durée) et ordonnée linéaire
  const geometrie = $derived.by(() => {
    if (lignes.length < 2) return null;
    const dmin = Math.log(lignes[0].duration_s);
    const dmax = Math.log(lignes[lignes.length - 1].duration_s);
    const toutes = lignes.flatMap((l) => [l.watts_90d || 0, l.watts_alltime || 0]);
    const wmax = Math.max(...toutes) * 1.08;
    const x = (d) => GAUCHE + ((Math.log(d) - dmin) / (dmax - dmin)) * (LARGEUR - GAUCHE - DROITE);
    const y = (w) => HAUT + (1 - w / wmax) * (HAUTEUR - HAUT - BAS);
    const pts90 = lignes.filter((l) => l.watts_90d > 0).map((l) => [x(l.duration_s), y(l.watts_90d)]);
    const ptsTout = lignes.filter((l) => l.watts_alltime > 0).map((l) => [x(l.duration_s), y(l.watts_alltime)]);
    return {
      ligne90: lisse(pts90, 0.2),
      ligneTout: lisse(ptsTout, 0.2),
      points: lignes
        .filter((l) => l.watts_90d > 0)
        .map((l) => ({ x: x(l.duration_s), y: y(l.watts_90d), watts: l.watts_90d, label: LIBELLES[l.duration_s] || `${l.duration_s} s` })),
      base: HAUTEUR - BAS,
    };
  });
</script>

<Bloc titre="Courbe de puissance">
  {#if geometrie}
    <div class="legende">
      <span><i class="trait plein"></i>90 jours</span>
      <span><i class="trait tirets"></i>Toute la vie</span>
    </div>
    <svg viewBox="0 0 {LARGEUR} {HAUTEUR}" role="img" aria-label="Meilleures puissances de 5 secondes à 1 heure, sur 90 jours et sur toute la vie">
      <line x1={GAUCHE} y1={geometrie.base} x2={LARGEUR - DROITE} y2={geometrie.base} class="axe" />
      <path d={geometrie.ligneTout} fill="none" class="tout" stroke-width="2" stroke-dasharray="6 6" />
      <path d={geometrie.ligne90} fill="none" class="courbe" stroke-width={taille === 'l' ? 3.4 : 3} stroke-linecap="round" />
      {#each geometrie.points as p}
        <circle cx={p.x} cy={p.y} r="4.5" class="point" stroke-width="2.6" />
        {#if taille === 'l' || ['5 s', '1 min', '5 min', '20 min', '1 h'].includes(p.label)}
          <text x={p.x} y={p.y - 10} text-anchor="middle" class="watts">{p.watts}</text>
          <text x={p.x} y={HAUTEUR - 12} text-anchor="middle" class="duree">{p.label}</text>
        {/if}
      {/each}
    </svg>
    <p class="unite">Watts</p>
  {:else}
    <p class="vide">Pas encore assez de sorties avec puissance pour tracer ta courbe.</p>
  {/if}
</Bloc>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }
  .axe {
    stroke: var(--trait-fort);
  }
  .courbe {
    stroke: var(--sport-velo);
  }
  .tout {
    stroke: var(--texte-doux);
  }
  .point {
    fill: var(--fond);
    stroke: var(--sport-velo);
  }
  .watts {
    font-family: var(--police-titre);
    font-weight: 700;
    font-size: 13px;
    fill: var(--texte);
  }
  .duree {
    font-size: 11px;
    fill: var(--texte-doux);
  }
  .legende {
    display: flex;
    gap: 16px;
    margin-bottom: 8px;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .legende span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .trait {
    display: inline-block;
    width: 16px;
    height: 0;
    border-top: 3px solid var(--sport-velo);
    border-radius: 2px;
  }
  .trait.tirets {
    border-top: 2px dashed var(--texte-doux);
  }
  .unite {
    margin-top: 4px;
    font-size: 11px;
    color: var(--texte-muet);
  }
  .vide {
    color: var(--texte-doux);
  }
</style>
