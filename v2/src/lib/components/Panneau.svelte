<script>
  import { tick } from 'svelte';

  // Panneau qui glisse par-dessus la page : en bas sur téléphone, sur le côté sur grand écran.
  // Accessible : rôle « dialog », Échap pour fermer, focus gardé dedans puis rendu à l'élément qui l'a ouvert.
  let { ouvert = false, titre = '', grand = false, onfermer, children } = $props();

  let panneau = $state(null);
  let precedent = null;

  $effect(() => {
    if (!ouvert) return;
    precedent = document.activeElement;
    const defilement = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // la page derrière ne défile plus
    tick().then(() => panneau?.focus());
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
    } else if (e.key === 'Tab' && panneau) {
      // Le focus reste dans le panneau (boucle de la dernière à la première commande)
      const liste = [...panneau.querySelectorAll(FOCALISABLES)];
      if (!liste.length) return;
      const premier = liste[0];
      const dernier = liste[liste.length - 1];
      if (e.shiftKey && (document.activeElement === premier || document.activeElement === panneau)) {
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
  <div class="panneau" class:grand role="dialog" aria-modal="true" aria-label={titre} tabindex="-1" bind:this={panneau} onkeydown={touche}>
    <header class="entete">
      <h2 class="titre">{titre}</h2>
      <button type="button" class="fermer" aria-label="Fermer" onclick={() => onfermer?.()}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </header>
    <div class="corps">{@render children?.()}</div>
  </div>
{/if}

<style>
  .voile {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgb(0 0 0 / 0.55);
  }
  .panneau {
    position: fixed;
    z-index: 51;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    color: var(--texte);
    outline: none;
    /* téléphone : feuille qui monte du bas */
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 92dvh;
    border-radius: var(--rayon-l) var(--rayon-l) 0 0;
    animation: monte 0.22s ease-out;
  }
  @media (min-width: 900px) {
    .panneau {
      left: auto;
      top: 0;
      bottom: 0;
      width: clamp(420px, 34vw, 640px);
      max-height: none;
      border-radius: 0;
      border-left: 1px solid var(--trait-fort);
      animation: glisse 0.22s ease-out;
    }
  }
  /* Mode « grand » (ex. construire une structure) : presque tout l'écran, même sur ordinateur */
  .panneau.grand {
    height: 96dvh;
    max-height: 96dvh;
  }
  @media (min-width: 900px) {
    .panneau.grand {
      width: min(1280px, 96vw);
      height: auto;
      max-height: none;
    }
  }
  .panneau {
    transition: width 0.2s ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .panneau {
      transition: none;
    }
  }
  .entete {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--trait);
  }
  h2 {
    font-size: 22px;
  }
  .fermer {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--rayon);
    background: transparent;
    cursor: pointer;
  }
  .fermer:hover {
    background: var(--surface-2);
  }
  .corps {
    overflow-y: auto;
    padding: 20px;
    padding-bottom: max(20px, env(safe-area-inset-bottom));
  }
  @keyframes monte {
    from { transform: translateY(40px); opacity: 0; }
  }
  @keyframes glisse {
    from { transform: translateX(40px); opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .panneau { animation: none; }
  }
</style>
