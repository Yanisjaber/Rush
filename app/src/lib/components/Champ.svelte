<script>
  // Un champ de saisie avec son libellé (toujours associé : accessible aux lecteurs d'écran).
  // `valeur` est « bindable » : <Champ bind:valeur={email} />
  let { id, label = '', type = 'text', valeur = $bindable(''), autocomplete = undefined, placeholder = '', requis = false, erreur = '', inputmode = undefined, maxlength = undefined } = $props();

  // Champ mot de passe : un œil permet d'afficher ou de masquer ce qu'on tape
  const estMdp = $derived(type === 'password');
  let visible = $state(false);
  const typeAffiche = $derived(estMdp && visible ? 'text' : type);
</script>

<div class="champ">
  <label for={id}>{label}</label>
  <div class="saisie" class:avec-oeil={estMdp}>
    <input {id} type={typeAffiche} {autocomplete} {inputmode} {maxlength} {placeholder} required={requis} aria-invalid={erreur ? 'true' : undefined} aria-describedby={erreur ? `${id}-erreur` : undefined} bind:value={valeur} />
    {#if estMdp}
      <button type="button" class="oeil" aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={visible} onclick={() => (visible = !visible)}>
        {#if visible}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18" /><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c5 0 8.5 4 9.5 7a11.6 11.6 0 0 1-2.4 3.7M6.6 6.7A11.6 11.6 0 0 0 2.5 12c1 3 4.5 7 9.5 7a9.6 9.6 0 0 0 4.2-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
        {:else}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12C3.5 9 7 5 12 5s8.5 4 9.5 7c-1 3-4.5 7-9.5 7S3.5 15 2.5 12z" /><circle cx="12" cy="12" r="3" /></svg>
        {/if}
      </button>
    {/if}
  </div>
  {#if erreur}<span class="erreur" id="{id}-erreur" role="alert">{erreur}</span>{/if}
</div>

<style>
  .champ {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  label {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .saisie {
    position: relative;
    display: flex;
  }
  .saisie input {
    flex: 1;
    min-width: 0;
  }
  .avec-oeil input {
    padding-right: 56px; /* place pour l'œil */
  }
  .oeil {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 44px; /* cible tactile de 44 px */
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: var(--rayon-l);
    background: none;
    color: var(--texte-doux);
    cursor: pointer;
  }
  .oeil:hover {
    color: var(--texte);
  }
  .oeil:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: -2px;
  }
  input {
    height: 52px;
    box-sizing: border-box;
    padding: 0 16px;
    background: var(--fond);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    font-size: 16px; /* 16 px minimum : évite le zoom automatique sur iPhone */
  }
  input[aria-invalid='true'] {
    border-color: var(--danger);
  }
  .erreur {
    font-size: 13px;
    color: var(--danger);
  }
  input::placeholder {
    color: var(--texte-muet);
  }
  input:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
</style>
