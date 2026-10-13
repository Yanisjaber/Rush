<script>
  import Bouton from './Bouton.svelte';

  // Une carte de profil : ses champs (définis dans data/profil.js) et son bouton Enregistrer.
  //  section : définition · valeurs (bindable) : { cle: texte | booléen } · erreurs : { cle: message }
  //  sale : des modifications ne sont pas enregistrées · envoi : enregistrement en cours · message / erreurGlobale : retours
  //  aides : { cle: { texte, bouton?, onbouton? } } petites aides sous un champ (valeur estimée, valeur mesurée, âge…)
  //  onenregistrer() : appelé au clic ; enTete : contenu libre en haut de la carte (snippet)
  let { section, valeurs = $bindable({}), erreurs = {}, sale = false, envoi = false, message = '', erreurGlobale = '', aides = {}, onenregistrer, enTete, children } = $props();

  const id = (cle) => `profil-${section.id}-${cle}`;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const SANS_LIGNE = ['case'];
</script>

<section class="carte" id="section-{section.id}" aria-labelledby="titre-{section.id}">
  <h2 class="titre" id="titre-{section.id}">{section.titre}</h2>
  {@render enTete?.()}

  <form
    onsubmit={(e) => {
      e.preventDefault();
      onenregistrer?.();
    }}
    novalidate
  >
    {#each section.groupes as g, gi (gi)}
      <fieldset class="groupe">
        {#if g.titre}<legend>{g.titre}</legend>{/if}
        <div class="grille" class:cases={g.champs.every((c) => SANS_LIGNE.includes(c.type))}>
          {#each g.champs as c (c.cle)}
            {#if c.type === 'case'}
              <label class="case"><input type="checkbox" bind:checked={valeurs[c.cle]} /><span>{c.label}</span></label>
            {:else}
              <div class="champ" class:large={c.type === 'paragraphe'}>
                <label for={id(c.cle)}>{c.label}{#if c.unite}<span class="unite"> ({c.unite})</span>{/if}</label>
                {#if c.type === 'choix'}
                  <select id={id(c.cle)} bind:value={valeurs[c.cle]} aria-invalid={erreurs[c.cle] ? 'true' : undefined} aria-describedby={erreurs[c.cle] ? `${id(c.cle)}-e` : undefined}>
                    <option value="">—</option>
                    {#each c.options as [v, l] (v)}<option value={v}>{l}</option>{/each}
                  </select>
                {:else if c.type === 'paragraphe'}
                  <textarea id={id(c.cle)} rows="3" maxlength={c.max} bind:value={valeurs[c.cle]} aria-invalid={erreurs[c.cle] ? 'true' : undefined}></textarea>
                {:else if c.type === 'date'}
                  <input id={id(c.cle)} type="date" max={aujourdhui} bind:value={valeurs[c.cle]} aria-invalid={erreurs[c.cle] ? 'true' : undefined} aria-describedby={erreurs[c.cle] ? `${id(c.cle)}-e` : undefined} />
                {:else}
                  <input
                    id={id(c.cle)}
                    type="text"
                    inputmode={c.type === 'nombre' ? 'decimal' : undefined}
                    maxlength={c.max}
                    placeholder={c.exemple || ''}
                    autocomplete="off"
                    bind:value={valeurs[c.cle]}
                    aria-invalid={erreurs[c.cle] ? 'true' : undefined}
                    aria-describedby={erreurs[c.cle] ? `${id(c.cle)}-e` : undefined}
                  />
                {/if}
                {#if erreurs[c.cle]}<span class="erreur" id="{id(c.cle)}-e" role="alert">{erreurs[c.cle]}</span>{/if}
                {#if aides[c.cle]}
                  <span class="aide">
                    {aides[c.cle].texte}
                    {#if aides[c.cle].bouton}<button type="button" class="lien" onclick={aides[c.cle].onbouton}>{aides[c.cle].bouton}</button>{/if}
                  </span>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      </fieldset>
    {/each}

    {@render children?.()}

    {#if erreurGlobale}<p class="erreur global" role="alert">{erreurGlobale}</p>{/if}
    <div class="pied">
      <Bouton type="submit">{envoi ? 'Enregistrement…' : 'Enregistrer'}</Bouton>
      <span class="statut" role="status" aria-live="polite">{#if message}{message}{:else if sale}Modifications non enregistrées{/if}</span>
    </div>
  </form>
</section>

<style>
  .carte {
    scroll-margin-top: 16px;
    padding: 24px 26px;
    background: var(--surface);
    border-radius: var(--rayon);
  }
  h2 {
    margin-bottom: 16px;
    font-size: 24px;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .groupe {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  legend {
    padding: 0;
    margin-bottom: 12px;
    font-family: var(--police-titre);
    font-size: 16px;
    font-weight: 700;
  }
  .grille {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 14px 16px;
  }
  .grille.cases {
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  }
  .champ {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .champ.large {
    grid-column: 1 / -1;
  }
  label {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .unite {
    color: var(--texte-muet);
  }
  input[type='text'],
  input[type='date'],
  select,
  textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 48px;
    padding: 0 14px;
    background: var(--fond);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    font-size: 16px;
  }
  textarea {
    padding-block: 12px;
    resize: vertical;
  }
  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible,
  .lien:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  [aria-invalid='true'] {
    border-color: var(--danger);
  }
  .case {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    font-size: 15px;
    color: var(--texte);
    cursor: pointer;
  }
  .case input {
    width: 20px;
    height: 20px;
    accent-color: var(--texte);
  }
  .erreur {
    font-size: 13px;
    color: var(--danger);
  }
  .global {
    padding: 10px 14px;
    border: 1px solid var(--danger);
    border-radius: var(--rayon-l);
  }
  .aide {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .lien {
    min-height: 32px;
    padding: 0 4px;
    border: 0;
    background: transparent;
    color: var(--texte);
    font-size: 13px;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .pied {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 16px;
  }
  .statut {
    font-size: 14px;
    color: var(--texte-doux);
  }
</style>
