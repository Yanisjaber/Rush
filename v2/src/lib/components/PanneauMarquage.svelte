<script>
  import { untrack } from 'svelte';
  import Panneau from './Panneau.svelte';
  import Champ from './Champ.svelte';
  import Bouton from './Bouton.svelte';
  import { TYPES_MARQUAGE, PALETTE, formulaireVide, formulaireDepuisMarquage, validerMarquage, versLigneNote, joursDe } from '../data/annotations.js';
  import { creerNote, modifierNote, supprimerNote, poserRepos, retirerRepos } from '../data/api.js';

  // Ajouter, modifier ou supprimer une note, une maladie, une blessure ou des jours de repos.
  //  marquage : note existante (ligne day_notes) ou jour de repos ({ type: 'repos', iso }) ; null = nouveau
  //  dateInitiale : jour proposé pour un nouveau · enregistre(type) / supprime() : préviennent le calendrier (qui recharge)
  let { ouvert = false, marquage = null, dateInitiale, userId, demo = false, onfermer, enregistre, supprime } = $props();

  let f = $state(formulaireVide(dateInitiale));
  let erreurs = $state({});
  let erreurGlobale = $state('');
  let envoi = $state(false);
  let confirmer = $state(false);

  $effect(() => {
    if (!ouvert) return;
    const m = marquage;
    const jour = dateInitiale;
    untrack(() => {
      f = m ? formulaireDepuisMarquage(m) : formulaireVide(jour);
      erreurs = {};
      erreurGlobale = '';
      envoi = false;
      confirmer = false;
    });
  });

  const type = $derived(TYPES_MARQUAGE.find((t) => t.cle === f.type));
  const modification = $derived(!!marquage);
  function choisirType(cle) {
    const ancien = TYPES_MARQUAGE.find((t) => t.cle === f.type);
    f.type = cle;
    // La couleur suit le type tant qu'on n'a pas choisi la sienne
    const nouveau = TYPES_MARQUAGE.find((t) => t.cle === cle);
    if (nouveau?.couleur && (!ancien?.couleur || f.couleur === ancien.couleur)) f.couleur = nouveau.couleur;
  }

  async function enregistrer(e) {
    e.preventDefault();
    if (envoi) return;
    const { valeurs, erreurs: e2 } = validerMarquage(f);
    erreurs = e2;
    erreurGlobale = '';
    if (!valeurs) return;
    envoi = true;
    let r = { erreur: '' };
    if (!demo) {
      if (valeurs.type === 'repos') r = await poserRepos(userId, joursDe(valeurs.de, valeurs.a));
      else if (marquage && marquage.type !== 'repos') r = await modifierNote(userId, marquage.id, versLigneNote(valeurs));
      else r = await creerNote(userId, versLigneNote(valeurs));
      // On a changé un repos en note (ou l'inverse) : l'ancien marquage est retiré
      if (!r.erreur && marquage?.type === 'repos' && valeurs.type !== 'repos') r = await retirerRepos(userId, [marquage.iso]);
      else if (!r.erreur && marquage && marquage.type !== 'repos' && valeurs.type === 'repos') r = await supprimerNote(userId, marquage.id);
    }
    envoi = false;
    if (r.erreur) return (erreurGlobale = r.erreur);
    enregistre?.(valeurs);
    onfermer?.();
  }

  async function effacer() {
    if (!marquage || envoi) return;
    envoi = true;
    let r = { erreur: '' };
    if (!demo) r = marquage.type === 'repos' ? await retirerRepos(userId, [marquage.iso]) : await supprimerNote(userId, marquage.id);
    envoi = false;
    if (r.erreur) {
      erreurGlobale = r.erreur;
      confirmer = false;
      return;
    }
    supprime?.(marquage);
    onfermer?.();
  }
</script>

<Panneau {ouvert} titre={modification ? 'Modifier' : 'Ajouter au calendrier'} {onfermer}>
  <form class="formulaire" onsubmit={enregistrer} novalidate>
    <fieldset class="types">
      <legend>Type</legend>
      <div class="choix">
        {#each TYPES_MARQUAGE as t (t.cle)}
          <label class="choix-type" class:actif={f.type === t.cle}>
            <input type="radio" name="marquage-type" value={t.cle} checked={f.type === t.cle} onchange={() => choisirType(t.cle)} />
            {#if t.couleur}<span class="pastille" style:background={t.couleur}></span>{:else}<span class="pastille repos"></span>{/if}
            <span>{t.nom}</span>
          </label>
        {/each}
      </div>
      {#if type}<p class="aide">{type.aide}</p>{/if}
    </fieldset>

    <div class="ligne">
      <Champ id="marquage-de" type="date" label="Du" bind:valeur={f.de} erreur={erreurs.de} />
      <Champ id="marquage-a" type="date" label="Au (inclus)" bind:valeur={f.a} erreur={erreurs.a} />
    </div>

    {#if f.type !== 'repos'}
      <div class="champ">
        <label for="marquage-texte">{f.type === 'texte' ? 'Note' : 'Détails (facultatif)'}</label>
        <textarea id="marquage-texte" rows="3" maxlength="500" bind:value={f.texte} aria-invalid={erreurs.texte ? 'true' : undefined}></textarea>
        {#if erreurs.texte}<span class="erreur" role="alert">{erreurs.texte}</span>{/if}
      </div>

      <fieldset class="couleurs">
        <legend>Couleur</legend>
        <div class="palette">
          {#each PALETTE as c (c)}
            <label class="couleur" class:actif={f.couleur === c} style:background={c}>
              <input type="radio" name="marquage-couleur" value={c} checked={f.couleur === c} onchange={() => (f.couleur = c)} aria-label="Couleur {c}" />
            </label>
          {/each}
        </div>
      </fieldset>
    {/if}

    {#if erreurGlobale}<p class="erreur global" role="alert">{erreurGlobale}</p>{/if}
    <div class="actions">
      <Bouton type="submit">{envoi ? 'Enregistrement…' : 'Enregistrer'}</Bouton>
      <Bouton variante="discret" onclick={() => onfermer?.()}>Annuler</Bouton>
    </div>

    {#if modification}
      <div class="danger">
        {#if confirmer}
          <p>Supprimer {marquage.type === 'repos' ? 'ce jour de repos' : 'cette note'} ?</p>
          <div class="actions">
            <Bouton variante="discret" onclick={effacer}>Oui, supprimer</Bouton>
            <Bouton variante="texte" onclick={() => (confirmer = false)}>Non, garder</Bouton>
          </div>
        {:else}
          <Bouton variante="texte" onclick={() => (confirmer = true)}>Supprimer</Bouton>
        {/if}
      </div>
    {/if}
  </form>
</Panneau>

<style>
  .formulaire {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  legend,
  label {
    padding: 0;
    font-size: 13px;
    color: var(--texte-doux);
  }
  legend {
    margin-bottom: 8px;
  }
  .choix {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 8px;
  }
  .choix-type {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 0 14px;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    font-size: 15px;
    color: var(--texte);
    cursor: pointer;
  }
  .choix-type.actif {
    border-color: var(--texte);
    background: var(--surface-2);
  }
  .choix-type input,
  .couleur input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .choix-type:has(input:focus-visible),
  .couleur:has(input:focus-visible) {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .pastille {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    flex: none;
  }
  .pastille.repos {
    border: 2px solid var(--texte-muet);
  }
  .aide {
    margin-top: 8px;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .ligne {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }
  .champ {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 12px 16px;
    background: var(--fond);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    font-size: 16px;
    resize: vertical;
  }
  textarea:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  [aria-invalid='true'] {
    border-color: var(--danger);
  }
  .palette {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .couleur {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    cursor: pointer;
  }
  .couleur.actif {
    outline: 3px solid var(--texte);
    outline-offset: 2px;
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
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .danger {
    padding-top: 16px;
    border-top: 1px solid var(--trait);
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 14px;
  }
</style>
