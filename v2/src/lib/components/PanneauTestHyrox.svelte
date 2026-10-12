<script>
  import { untrack } from 'svelte';
  import Panneau from './Panneau.svelte';
  import Champ from './Champ.svelte';
  import Bouton from './Bouton.svelte';
  import GrilleTemps from './GrilleTemps.svelte';
  import { formulaireTestVide, formulaireDepuisTest, validerTest } from '../data/hyrox.js';
  import { dateIsoLocale } from '../utils/format.js';

  // Saisir ou modifier un test Hyrox (simulation) ou une course.
  //  - test : ligne hyrox_tests à modifier, ou null pour en créer un
  //  - onenregistrer(valeurs, id) : écrit en base (ou en démo) et renvoie { erreur }
  let { ouvert = false, test = null, onenregistrer, onsupprimer, onfermer } = $props();

  let f = $state(formulaireTestVide(dateIsoLocale()));
  let erreurs = $state({});
  let erreurGlobale = $state('');
  let envoi = $state(false);
  let confirmer = $state(false);

  $effect(() => {
    if (!ouvert) return;
    const t = test;
    untrack(() => {
      f = t ? formulaireDepuisTest(t) : formulaireTestVide(dateIsoLocale());
      erreurs = {};
      erreurGlobale = '';
      envoi = false;
      confirmer = false;
    });
  });

  async function enregistrer(e) {
    e.preventDefault();
    if (envoi) return;
    const { valeurs, erreurs: e2 } = validerTest(f);
    erreurs = e2;
    erreurGlobale = '';
    if (!valeurs) return;
    envoi = true;
    const r = await onenregistrer(valeurs, test?.id || null);
    envoi = false;
    if (r.erreur) erreurGlobale = r.erreur;
  }

  async function supprimer() {
    if (envoi) return;
    envoi = true;
    const r = await onsupprimer(test.id);
    envoi = false;
    if (r?.erreur) {
      erreurGlobale = r.erreur;
      confirmer = false;
    }
  }
</script>

<Panneau {ouvert} titre={test ? 'Modifier le test' : 'Nouveau test Hyrox'} grand {onfermer}>
  <form class="formulaire" onsubmit={enregistrer} novalidate>
    <Champ id="hx-label" label="Nom" bind:valeur={f.label} erreur={erreurs.label} maxlength={80} placeholder="Simulation 8 × (1 km + station)" />
    <div class="ligne">
      <Champ id="hx-date" type="date" label="Date" bind:valeur={f.date} erreur={erreurs.date} />
      <div class="champ">
        <label for="hx-kind">Type</label>
        <select id="hx-kind" bind:value={f.kind}>
          <option value="test">Test / simulation</option>
          <option value="course">Course officielle</option>
        </select>
      </div>
    </div>

    <section aria-label="Temps de chaque segment">
      <h3>Temps par segment <span>format 4:52</span></h3>
      <GrilleTemps bind:temps={f.temps} id="test" />
      {#if erreurs.temps}<p class="erreur" role="alert">{erreurs.temps}</p>{/if}
    </section>

    <div class="champ">
      <label for="hx-notes">Notes</label>
      <textarea id="hx-notes" rows="3" maxlength="500" bind:value={f.notes} aria-invalid={erreurs.notes ? 'true' : undefined}></textarea>
      {#if erreurs.notes}<span class="erreur" role="alert">{erreurs.notes}</span>{/if}
    </div>

    {#if erreurGlobale}<p class="erreur global" role="alert">{erreurGlobale}</p>{/if}
    <div class="actions">
      <Bouton type="submit">{envoi ? 'Enregistrement…' : 'Enregistrer'}</Bouton>
      <Bouton variante="discret" onclick={onfermer}>Annuler</Bouton>
    </div>

    {#if test && onsupprimer}
      <div class="danger">
        {#if confirmer}
          <p>Supprimer « {test.label} » ?</p>
          <div class="actions">
            <Bouton variante="discret" onclick={supprimer}>Oui, supprimer</Bouton>
            <Bouton variante="texte" onclick={() => (confirmer = false)}>Non, garder</Bouton>
          </div>
        {:else}
          <Bouton variante="texte" onclick={() => (confirmer = true)}>Supprimer ce test</Bouton>
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
  .ligne {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
  }
  .champ {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .champ label {
    font-size: 13px;
    color: var(--texte-doux);
  }
  select,
  textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 12px 16px;
    background: var(--fond);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    font-size: 16px;
  }
  select {
    height: 52px;
    padding-block: 0;
  }
  textarea {
    resize: vertical;
  }
  h3 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 0 0 10px;
    font-size: 16px;
  }
  h3 span {
    font-size: 12px;
    font-weight: 500;
    color: var(--texte-doux);
  }
  select:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .erreur {
    margin: 8px 0 0;
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
