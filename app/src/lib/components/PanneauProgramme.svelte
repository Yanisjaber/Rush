<script>
  import { untrack } from 'svelte';
  import Panneau from './Panneau.svelte';
  import Champ from './Champ.svelte';
  import Bouton from './Bouton.svelte';
  import SelecteurExercice from './SelecteurExercice.svelte';
  import { GROUPES } from '../data/exercices.js';
  import { formulaireProgrammeVide, formulaireProgramme, exerciceDeProgramme, validerProgramme, resumeProgramme } from '../data/force.js';

  // Créer ou modifier un programme (une séance type : Push, Pull, Legs…).
  //  - programme : ligne strength_programs à modifier, ou null pour en créer un
  //  - onenregistrer(valeurs, id) : écrit en base (ou en démo) et renvoie { erreur }
  //  - oncreerExo(nom, groupe) : crée un exercice perso et renvoie { exo, erreur }
  let { ouvert = false, programme = null, perso = [], onenregistrer, oncreerExo, onsupprimer, onfermer } = $props();

  let f = $state(formulaireProgrammeVide());
  let erreurs = $state({});
  let erreurGlobale = $state('');
  let envoi = $state(false);
  let choix = $state(false);
  let confirmer = $state(false);

  $effect(() => {
    if (!ouvert) return;
    const p = programme;
    untrack(() => {
      f = p ? formulaireProgramme(p) : formulaireProgrammeVide();
      erreurs = {};
      erreurGlobale = '';
      envoi = false;
      choix = false;
      confirmer = false;
    });
  });

  const resume = $derived(resumeProgramme({ exercises: f.exercices.map((e) => ({ sets: Number(e.sets) || 0 })) }));

  function ajouter(exo) {
    f.exercices.push(exerciceDeProgramme(exo));
    choix = false;
  }
  function deplacer(i, sens) {
    const j = i + sens;
    if (j < 0 || j >= f.exercices.length) return;
    [f.exercices[i], f.exercices[j]] = [f.exercices[j], f.exercices[i]];
  }
  function retirer(i) {
    f.exercices.splice(i, 1);
  }

  async function enregistrer(e) {
    e.preventDefault();
    if (envoi) return;
    const { valeurs, erreurs: e2 } = validerProgramme(f);
    erreurs = e2;
    erreurGlobale = '';
    if (!valeurs) return;
    envoi = true;
    const r = await onenregistrer(valeurs, programme?.id || null);
    envoi = false;
    if (r.erreur) erreurGlobale = r.erreur;
  }

  async function supprimer() {
    if (envoi) return;
    envoi = true;
    const r = await onsupprimer(programme.id);
    envoi = false;
    if (r?.erreur) {
      erreurGlobale = r.erreur;
      confirmer = false;
    }
  }
</script>

<Panneau {ouvert} titre={programme ? 'Modifier le programme' : 'Nouveau programme'} grand {onfermer}>
  <form class="formulaire" onsubmit={enregistrer} novalidate>
    <Champ id="prog-nom" label="Nom" bind:valeur={f.nom} erreur={erreurs.nom} maxlength={60} placeholder="Push, Pull, Legs…" />

    <section aria-label="Exercices du programme">
      <h3>Exercices <span class="total">{resume.exercices} · {resume.series} séries · environ {resume.minutes} min</span></h3>
      {#if f.exercices.length}
        <ol class="exercices">
          {#each f.exercices as e, i (i + e.cle)}
            <li>
              <div class="titre-ex">
                <span class="nom">{e.nom}</span>
                <span class="groupe">{GROUPES[e.groupe]?.nom}</span>
              </div>
              <div class="valeurs">
                <label>Séries<input inputmode="numeric" bind:value={e.sets} aria-label={`Séries de ${e.nom}`} /></label>
                <label>Reps<input inputmode="numeric" bind:value={e.reps} aria-label={`Répétitions de ${e.nom}`} /></label>
                <label>Charge (kg)<input inputmode="decimal" bind:value={e.weight} placeholder="corps" aria-label={`Charge de ${e.nom} en kilos`} /></label>
              </div>
              <div class="outils">
                <button type="button" onclick={() => deplacer(i, -1)} disabled={i === 0} aria-label={`Monter ${e.nom}`}>↑</button>
                <button type="button" onclick={() => deplacer(i, 1)} disabled={i === f.exercices.length - 1} aria-label={`Descendre ${e.nom}`}>↓</button>
                <button type="button" class="retirer" onclick={() => retirer(i)} aria-label={`Retirer ${e.nom}`}>Retirer</button>
              </div>
            </li>
          {/each}
        </ol>
      {/if}
      {#if erreurs.exercices}<p class="erreur" role="alert">{erreurs.exercices}</p>{/if}

      {#if choix}
        <SelecteurExercice {perso} onchoisir={ajouter} oncreer={oncreerExo} onfermer={() => (choix = false)} />
      {:else}
        <Bouton variante="discret" onclick={() => (choix = true)}>+ Ajouter un exercice</Bouton>
      {/if}
    </section>

    <div class="champ">
      <label for="prog-notes">Notes</label>
      <textarea id="prog-notes" rows="3" maxlength="500" bind:value={f.notes} aria-invalid={erreurs.notes ? 'true' : undefined}></textarea>
      {#if erreurs.notes}<span class="erreur" role="alert">{erreurs.notes}</span>{/if}
    </div>

    {#if erreurGlobale}<p class="erreur global" role="alert">{erreurGlobale}</p>{/if}
    <div class="actions">
      <Bouton type="submit">{envoi ? 'Enregistrement…' : 'Enregistrer'}</Bouton>
      <Bouton variante="discret" onclick={onfermer}>Annuler</Bouton>
    </div>

    {#if programme && onsupprimer}
      <div class="danger">
        {#if confirmer}
          <p>Supprimer le programme « {programme.name} » ? Tes séances déjà faites ne changent pas.</p>
          <div class="actions">
            <Bouton variante="discret" onclick={supprimer}>Oui, supprimer</Bouton>
            <Bouton variante="texte" onclick={() => (confirmer = false)}>Non, garder</Bouton>
          </div>
        {:else}
          <Bouton variante="texte" onclick={() => (confirmer = true)}>Supprimer ce programme</Bouton>
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
  h3 {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: baseline;
    gap: 6px;
    margin: 0 0 10px;
    font-size: 16px;
  }
  .total {
    font-size: 12px;
    font-weight: 500;
    color: var(--texte-doux);
  }
  .exercices {
    list-style: none;
    margin: 0 0 12px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  li {
    padding: 12px;
    background: var(--surface-2);
    border-radius: var(--rayon-l);
  }
  .titre-ex {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
    font-weight: 600;
  }
  .groupe {
    font-size: 12px;
    font-weight: 500;
    color: var(--texte-doux);
  }
  .valeurs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .valeurs label,
  .champ label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .valeurs input,
  textarea {
    box-sizing: border-box;
    width: 100%;
    height: 44px;
    padding: 0 10px;
    background: var(--fond);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    font-size: 16px;
  }
  textarea {
    height: auto;
    padding: 10px 14px;
    resize: vertical;
  }
  .champ {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .champ label {
    font-size: 13px;
  }
  .outils {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }
  .outils button {
    min-width: 44px;
    min-height: 44px;
    padding: 0 12px;
    background: transparent;
    border: 1px solid var(--trait);
    border-radius: var(--rayon);
    color: var(--texte);
    font-size: 14px;
    cursor: pointer;
  }
  .outils button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .outils .retirer {
    margin-left: auto;
    color: var(--texte-doux);
  }
  input:focus-visible,
  textarea:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .erreur {
    margin: 0 0 8px;
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
