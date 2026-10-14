<script>
  import { ajusterTexte } from '../actions/ajusterTexte.js';

  // Le dossard : la signature visuelle de l'app. Un bloc clair avec quatre points d'attache,
  // un grand nombre (J-63, PUSH…) et le contexte de l'objectif.
  // Tout le texte est affiché en texte brut : Svelte échappe automatiquement le HTML.
  // compact : dossard réduit (sans grand chiffre) pour un état vide, comme « aucun objectif »
  let { etiquette = '', nom = '', valeur = '', detail = '', taille = 'l', compact = false, children } = $props();
  const tailleMax = $derived(taille === 'm' ? 112 : 150);
</script>

<section class="dossard {taille}" class:compact aria-label={etiquette || nom || 'Objectif'}>
  <span class="attache haut-gauche" aria-hidden="true"></span>
  <span class="attache haut-droite" aria-hidden="true"></span>
  <span class="attache bas-gauche" aria-hidden="true"></span>
  <span class="attache bas-droite" aria-hidden="true"></span>

  <div class="entete">
    {#if etiquette}<div class="etiquette">{etiquette}</div>{/if}
    {#if nom}<div class="nom titre">{nom}</div>{/if}
  </div>

  {#if valeur}
    <div class="valeur titre" use:ajusterTexte={{ max: tailleMax, valeur }}>{valeur}</div>
  {/if}

  <div class="pied">
    {#if detail}<div class="detail">{detail}</div>{/if}
    {@render children?.()}
  </div>
</section>

<style>
  .dossard {
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: var(--e3);
    background: var(--dossard-fond);
    color: var(--dossard-texte);
    --texte-doux: var(--dossard-texte);
    border-radius: var(--rayon);
    padding: 26px 28px;
    min-height: 360px;
  }
  .dossard.m {
    padding: 30px 26px 18px; /* de l'air autour des points d'attache du haut */
    min-height: 0;
  }
  /* état vide : juste le titre et le détail, sans grand espace ni gros chiffre */
  .dossard.compact {
    min-height: 0;
    padding: 18px 20px;
    justify-content: flex-start;
    gap: 14px;
  }

  .attache {
    position: absolute;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--dossard-texte);
  }
  .haut-gauche { left: 12px; top: 12px; }
  .haut-droite { right: 12px; top: 12px; }
  .bas-gauche { left: 12px; bottom: 12px; }
  .bas-droite { right: 12px; bottom: 12px; }
  .m .bas-gauche, .m .bas-droite { display: none; }

  .etiquette {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .nom {
    margin-top: 6px;
    font-weight: 700;
    font-size: 24px;
    letter-spacing: 0;
  }
  .m .nom { font-size: 18px; }

  /* La taille réelle est posée par l'action ajusterTexte (au plus 150 px, moins si le texte déborde) */
  .valeur {
    font-size: 150px;
    line-height: 0.85;
    letter-spacing: -0.04em;
    white-space: nowrap;
  }
  .m .valeur { font-size: 112px; line-height: 0.92; }

  .detail {
    font-size: 14px;
    font-weight: 500;
  }
</style>
