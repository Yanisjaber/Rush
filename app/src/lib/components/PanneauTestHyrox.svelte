<script>
  import { untrack } from 'svelte';
  import Panneau from './Panneau.svelte';
  import Champ from './Champ.svelte';
  import Bouton from './Bouton.svelte';
  import GrilleTemps from './GrilleTemps.svelte';
  import { formulaireTestVide, formulaireDepuisTest, validerTest, segmentsDepuisTours, ecrireTemps } from '../data/hyrox.js';
  import { lireSortiesImportables, lireToursSortie } from '../data/force-acces.js';
  import { dateIsoLocale, formatDateCourte } from '../utils/format.js';

  // Saisir ou modifier un test Hyrox (simulation) ou une course.
  //  - test : ligne hyrox_tests à modifier, ou null pour en créer un
  //  - onenregistrer(valeurs, id) : écrit en base (ou en démo) et renvoie { erreur }
  //  - demo, userId : pour l'import des tours d'une montre (Strava)
  let { ouvert = false, test = null, demo = false, userId = '', onenregistrer, onsupprimer, onfermer } = $props();

  let f = $state(formulaireTestVide(dateIsoLocale()));
  let erreurs = $state({});
  let erreurGlobale = $state('');
  let envoi = $state(false);
  let confirmer = $state(false);
  // Import des tours d'une montre : sorties Strava proposées, choix, message
  let imp = $state({ ouvert: false, sorties: null, choix: '', envoi: false, message: '', source: null });

  $effect(() => {
    if (!ouvert) return;
    const t = test;
    untrack(() => {
      f = t ? formulaireDepuisTest(t) : formulaireTestVide(dateIsoLocale());
      erreurs = {};
      erreurGlobale = '';
      envoi = false;
      confirmer = false;
      imp = { ouvert: false, sorties: null, choix: '', envoi: false, message: '', source: null };
    });
  });

  async function ouvrirImport() {
    imp.ouvert = true;
    if (imp.sorties) return;
    const r = await lireSortiesImportables(demo, userId);
    imp.sorties = r.data || [];
    if (r.erreur) imp.message = r.erreur;
    else if (!imp.sorties.length) imp.message = "Aucune sortie Strava récente. Synchronise ta montre avec Strava, ou saisis les temps à la main.";
    imp.choix = imp.sorties[0]?.id || '';
  }

  async function importer() {
    if (imp.envoi || !imp.choix) return;
    imp.envoi = true;
    imp.message = '';
    const r = await lireToursSortie(demo, userId, imp.choix);
    imp.envoi = false;
    if (r.erreur) return (imp.message = r.erreur);
    const segments = segmentsDepuisTours(r.data);
    if (!segments) {
      const n = r.data.length;
      return (imp.message = n
        ? `Cette sortie a ${n} tour${n > 1 ? 's' : ''}, il en faut exactement 16 (un par run d'1 km et par station). Règle les tours de ta montre pour les prochains tests, ou saisis les temps à la main.`
        : "Cette sortie n'a pas de tours enregistrés. Saisis les temps à la main.");
    }
    const sortie = imp.sorties.find((s) => s.id === imp.choix);
    f.temps = segments.map((s) => ecrireTemps(s));
    if (sortie) {
      f.date = String(sortie.start_date_local).slice(0, 10);
      if (!f.label || f.label === 'Simulation') f.label = String(sortie.name || 'Simulation').slice(0, 80);
    }
    imp.source = { source: 'strava', activity_id: demo ? null : imp.choix };
    imp.message = `Tours importés (${ecrireTemps(segments.reduce((a, b) => a + b, 0))}). Vérifie les temps puis enregistre.`;
  }

  async function enregistrer(e) {
    e.preventDefault();
    if (envoi) return;
    const { valeurs, erreurs: e2 } = validerTest(f);
    erreurs = e2;
    erreurGlobale = '';
    if (!valeurs) return;
    envoi = true;
    const r = await onenregistrer(imp.source && !test ? { ...valeurs, ...imp.source } : valeurs, test?.id || null);
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

    {#if !test}
      <section class="import" aria-label="Importer depuis ma montre">
        {#if !imp.ouvert}
          <Bouton variante="discret" onclick={ouvrirImport}>Importer les tours de ma montre</Bouton>
        {:else}
          <h3>Importer depuis ma montre</h3>
          {#if imp.sorties?.length}
            <label for="hx-sortie">Sortie Strava</label>
            <select id="hx-sortie" bind:value={imp.choix}>
              {#each imp.sorties as s (s.id)}<option value={s.id}>{formatDateCourte(s.start_date_local)} · {s.name}</option>{/each}
            </select>
            <Bouton variante="discret" onclick={importer}>{imp.envoi ? 'Lecture des tours…' : 'Récupérer les 16 tours'}</Bouton>
          {/if}
          {#if imp.message}<p class="aide" role="status">{imp.message}</p>{/if}
        {/if}
      </section>
    {/if}

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
  .import {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 14px;
    border: 1px dashed var(--trait-fort);
    border-radius: var(--rayon-l);
  }
  .import label {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .import select {
    max-width: 100%;
  }
  .aide {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--texte-doux);
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
