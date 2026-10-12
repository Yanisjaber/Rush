<script>
  // Un champ de saisie avec son libellé (toujours associé : accessible aux lecteurs d'écran).
  // `valeur` est « bindable » : <Champ bind:valeur={email} />
  let { id, label = '', type = 'text', valeur = $bindable(''), autocomplete = undefined, placeholder = '', requis = false } = $props();
</script>

<div class="champ">
  <label for={id}>{label}</label>
  <input {id} {type} {autocomplete} {placeholder} required={requis} bind:value={valeur} />
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
  input::placeholder {
    color: var(--texte-muet);
  }
  input:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
</style>
