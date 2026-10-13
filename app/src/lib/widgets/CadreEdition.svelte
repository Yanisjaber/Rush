<script>
  import { WIDGETS, TAILLES } from './registre.js';

  // Enveloppe d'un widget en mode édition : barre d'outils (monter, descendre, taille, retirer)
  // au-dessus d'un aperçu non cliquable. Tout est au clavier et au doigt (boutons de 44 px) :
  // pas besoin de glisser-déposer.
  let { id, taille, index, total, onDeplacer, onTaille, onRetirer, children } = $props();
  const def = $derived(WIDGETS[id]);
</script>

<div class="cadre">
  <div class="outils">
    <span class="nom titre">{def.nom}</span>
    <div class="groupe" role="group" aria-label="Déplacer {def.nom}">
      <button type="button" aria-label="Monter {def.nom}" disabled={index === 0} onclick={() => onDeplacer(index, -1)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 15l-6-6-6 6" /></svg>
      </button>
      <button type="button" aria-label="Descendre {def.nom}" disabled={index === total - 1} onclick={() => onDeplacer(index, 1)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
    </div>
    <div class="groupe" role="group" aria-label="Taille de {def.nom}">
      {#each def.tailles as t}
        <button type="button" class="taille" aria-pressed={taille === t} aria-label={TAILLES[t].nom} onclick={() => onTaille(id, t)}>
          {TAILLES[t].court}
        </button>
      {/each}
    </div>
    <button type="button" class="retirer" aria-label="Retirer {def.nom}" onclick={() => onRetirer(id)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  </div>
  <div class="apercu" inert>
    {@render children?.()}
  </div>
</div>

<style>
  .cadre {
    display: flex;
    flex-direction: column;
    min-width: 0;
    border: 2px dashed var(--trait-fort);
    border-radius: var(--rayon-l);
    overflow: hidden;
    background: var(--fond);
  }
  .outils {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    padding: 4px 6px 4px 14px;
    border-bottom: 2px dashed var(--trait-fort);
    background: var(--surface);
  }
  .nom {
    flex: 1 1 140px;
    min-width: 0;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .groupe {
    display: flex;
  }
  button {
    width: var(--cible);
    height: var(--cible);
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 0;
    color: var(--texte-doux);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    color: var(--texte);
  }
  button:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .taille[aria-pressed='true'] {
    color: var(--texte);
    text-decoration: underline;
    text-underline-offset: 5px;
    text-decoration-thickness: 2px;
  }
  .apercu {
    flex: 1;
    display: flex;
    padding: 12px;
    opacity: 0.92;
  }
  .apercu > :global(*) {
    flex: 1;
    min-width: 0;
  }
</style>
