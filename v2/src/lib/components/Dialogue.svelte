<script>
  import { tick } from 'svelte';

  // Pop-up centrée, au style « dossard » (carte claire, quatre points d'attache).
  // Accessible : rôle « dialog », Échap pour fermer, focus gardé dedans puis rendu à l'élément qui l'a ouvert.
  let { ouvert = false, titre = '', onfermer, icone, ton = 'course', children } = $props();

  let boite = $state(null);
  let precedent = null;

  $effect(() => {
    if (!ouvert) return;
    precedent = document.activeElement;
    const defilement = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    tick().then(() => boite?.focus());
    return () => {
      document.body.style.overflow = defilement;
      if (precedent && typeof precedent.focus === 'function') precedent.focus();
    };
  });

  const FOCALISABLES = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function touche(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onfermer?.();
    } else if (e.key === 'Tab' && boite) {
      const liste = [...boite.querySelectorAll(FOCALISABLES)];
      if (!liste.length) return;
      const premier = liste[0];
      const dernier = liste[liste.length - 1];
      if (e.shiftKey && (document.activeElement === premier || document.activeElement === boite)) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier.focus();
      }
    }
  }
</script>

{#if ouvert}
  <div class="voile" onclick={() => onfermer?.()} aria-hidden="true"></div>
  <div class="cadre">
    <div class="boite" role="dialog" aria-modal="true" aria-label={titre} tabindex="-1" bind:this={boite} onkeydown={touche}>
      <span class="point haut-gauche" aria-hidden="true"></span>
      <span class="point haut-droite" aria-hidden="true"></span>
      <span class="point bas-gauche" aria-hidden="true"></span>
      <span class="point bas-droite" aria-hidden="true"></span>
      {#if icone}<div class="icone {ton}" aria-hidden="true">{@render icone()}</div>{/if}
      <h2 class="titre">{titre}</h2>
      <div class="contenu">{@render children?.()}</div>
    </div>
  </div>
{/if}

<style>
  .voile {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgb(0 0 0 / 0.7);
    animation: fondu 0.2s ease-out;
  }
  .cadre {
    position: fixed;
    inset: 0;
    z-index: 61;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    pointer-events: none;
  }
  .boite {
    position: relative;
    pointer-events: auto;
    box-sizing: border-box;
    width: 100%;
    max-width: 440px;
    padding: 44px 32px 32px;
    border-radius: var(--rayon-l);
    background: var(--dossard-fond);
    color: var(--dossard-texte);
    box-shadow: 0 24px 60px rgb(0 0 0 / 0.55);
    text-align: center;
    outline: none;
    animation: monte 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.2);
  }
  /* les quatre points d'attache du dossard */
  .point {
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--dossard-texte);
    opacity: 0.22;
  }
  .haut-gauche { top: 14px; left: 14px; }
  .haut-droite { top: 14px; right: 14px; }
  .bas-gauche { bottom: 14px; left: 14px; }
  .bas-droite { bottom: 14px; right: 14px; }
  .icone {
    width: 72px;
    height: 72px;
    margin: 0 auto 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 18px;
    background: var(--sport-course);
    color: #0c0d10;
    transform: rotate(-4deg);
    box-shadow: 0 6px 0 rgb(12 13 16 / 0.18);
  }
  .icone.danger {
    background: var(--sport-muscu);
  }
  .titre {
    margin: 0 0 12px;
    font-size: 28px;
    line-height: 1.1;
    letter-spacing: 0;
  }
  .contenu {
    display: flex;
    flex-direction: column;
    gap: 14px;
    font-size: 16px;
    line-height: 1.5;
  }
  @keyframes fondu {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes monte {
    from { opacity: 0; transform: translateY(18px) scale(0.96); }
    to { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .voile, .boite { animation: none; }
  }
</style>
