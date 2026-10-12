<script>
  import { untrack } from 'svelte';
  import Panneau from './Panneau.svelte';
  import Champ from './Champ.svelte';
  import Bouton from './Bouton.svelte';
  import EditeurStructure from './EditeurStructure.svelte';
  import { SPORTS, couleurSport } from '../sports.js';
  import { familleAffichage } from '../data/familles.js';
  import { SPORTS_PREVUE, formulaireVide, formulaireDepuisLigne, validerPrevue, versLigne, estimerTss } from '../data/prevue.js';
  import { sportAvecStructure } from '../data/structure.js';
  import { donneesDemo } from '../data/demo.js';
  import { creerPlanifiee, modifierPlanifiee, supprimerPlanifiee, chargerProfil } from '../data/api.js';

  // Créer ou modifier une séance prévue.
  //  seance : ligne de activity_planned à modifier (null = nouvelle) · dateInitiale : jour proposé pour une nouvelle
  //  enregistree(ligne) / supprimee(id) : prévient la page pour qu'elle se mette à jour
  let { ouvert = false, seance = null, dateInitiale, userId, demo = false, onfermer, enregistree, supprimee } = $props();

  let f = $state(formulaireVide(dateInitiale));
  let erreurs = $state({});
  let erreurGlobale = $state('');
  let envoi = $state(false);
  let confirmerSuppression = $state(false);
  let ref = $state({ ftp: 0, hrMax: 0 }); // FTP et FC max du profil : servent à traduire les % en watts et en bpm
  let avecStructure = $state(false);

  // À chaque ouverture : on repart d'un formulaire propre (celui de la séance, ou vide).
  // L'effet ne dépend que de l'ouverture et de la séance visée : le reste est isolé par untrack,
  // sinon chaque modification d'un bloc relancerait l'effet et effacerait la saisie.
  $effect(() => {
    if (!ouvert) return;
    const cible = seance;
    const jour = dateInitiale;
    untrack(() => {
      f = cible ? formulaireDepuisLigne(cible) : formulaireVide(jour);
      erreurs = {};
      erreurGlobale = '';
      envoi = false;
      confirmerSuppression = false;
      avecStructure = f.structure.length > 0;
      chargerReference();
    });
  });

  async function chargerReference() {
    const p = demo ? donneesDemo().profil : userId ? (await chargerProfil(userId)).data : null;
    ref = { ftp: Number(p?.ftp) || 0, hrMax: Number(p?.hr_max) || 0 };
  }

  const nomSport = (type) => (SPORTS[familleAffichage(type)] || SPORTS.autre).nom;
  const peutStructurer = $derived(sportAvecStructure(f.sport));
  const structureActive = $derived(peutStructurer && avecStructure && f.structure.length > 0);
  const tssEstime = $derived(estimerTss(Number(f.duree), Number(f.rpe) || null));

  async function enregistrer(e) {
    e.preventDefault();
    if (envoi) return;
    const { valeurs, erreurs: e2 } = validerPrevue(f, ref);
    erreurs = e2;
    erreurGlobale = '';
    if (!valeurs) return;
    envoi = true;
    const ligne = versLigne(valeurs);
    let r;
    if (demo) r = { data: { ...ligne, id: seance?.id || `demo-nouvelle-${Date.now()}` }, erreur: '' };
    else r = seance ? await modifierPlanifiee(userId, seance.id, ligne) : await creerPlanifiee(userId, ligne);
    envoi = false;
    if (r.erreur) {
      erreurGlobale = r.erreur;
      return;
    }
    enregistree?.(r.data);
    onfermer?.();
  }

  async function supprimer() {
    if (!seance || envoi) return;
    envoi = true;
    const r = demo ? { erreur: '' } : await supprimerPlanifiee(userId, seance.id);
    envoi = false;
    if (r.erreur) {
      erreurGlobale = r.erreur;
      confirmerSuppression = false;
      return;
    }
    supprimee?.(seance.id);
    onfermer?.();
  }
</script>

<Panneau {ouvert} grand={peutStructurer && avecStructure} titre={seance ? 'Modifier la séance' : 'Nouvelle séance'} {onfermer}>
  <form class="formulaire" onsubmit={enregistrer} novalidate>
    <Champ id="prevue-nom" label="Nom" bind:valeur={f.nom} erreur={erreurs.nom} maxlength={120} placeholder="Footing, sortie longue…" />

    <div class="ligne">
      <Champ id="prevue-date" type="date" label="Date" bind:valeur={f.date} erreur={erreurs.date} />
      <Champ id="prevue-heure" type="time" label="Heure" bind:valeur={f.heure} erreur={erreurs.heure} />
    </div>

    <div class="champ">
      <label for="prevue-sport">Sport</label>
      <select id="prevue-sport" bind:value={f.sport} aria-invalid={erreurs.sport ? 'true' : undefined}>
        {#each SPORTS_PREVUE as s (s.type)}
          <option value={s.type}>{nomSport(s.type)}</option>
        {/each}
      </select>
      {#if erreurs.sport}<span class="erreur" role="alert">{erreurs.sport}</span>{/if}
    </div>

    {#if peutStructurer}
      <section class="structure" aria-label="Structure de la séance">
        {#if avecStructure}
          <div class="entete-structure">
            <h3 class="titre">Structure</h3>
            <Bouton variante="texte" onclick={() => { avecStructure = false; f.structure = []; }}>Retirer la structure</Bouton>
          </div>
          <EditeurStructure bind:blocs={f.structure} sport={f.sport} {ref} />
          {#if structureActive}<p class="aide">Durée et charge sont calculées à partir des blocs.</p>{/if}
        {:else}
          <Bouton variante="discret" onclick={() => (avecStructure = true)}>Construire la séance par blocs</Bouton>
        {/if}
      </section>
    {/if}

    {#if !structureActive}
      <div class="ligne">
        <Champ id="prevue-duree" label="Durée (min)" inputmode="numeric" bind:valeur={f.duree} erreur={erreurs.duree} />
        <Champ id="prevue-rpe" label="Effort ressenti (1 à 10)" inputmode="numeric" bind:valeur={f.rpe} erreur={erreurs.rpe} />
      </div>

      <div class="ligne">
        <Champ id="prevue-tss" label="Charge (TSS)" inputmode="numeric" placeholder="auto : {tssEstime}" bind:valeur={f.tss} erreur={erreurs.tss} />
        <Champ id="prevue-km" label="Distance (km)" inputmode="decimal" bind:valeur={f.km} erreur={erreurs.km} />
      </div>
    {:else}
      <div class="ligne">
        <Champ id="prevue-rpe" label="Effort ressenti (1 à 10)" inputmode="numeric" bind:valeur={f.rpe} erreur={erreurs.rpe} />
        <Champ id="prevue-km" label="Distance (km)" inputmode="decimal" bind:valeur={f.km} erreur={erreurs.km} />
      </div>
    {/if}

    <Champ id="prevue-dplus" label="Dénivelé + (m)" inputmode="numeric" bind:valeur={f.dPlus} erreur={erreurs.dPlus} />

    <div class="champ">
      <label for="prevue-notes">Notes</label>
      <textarea id="prevue-notes" rows="4" maxlength="2000" bind:value={f.notes} aria-invalid={erreurs.notes ? 'true' : undefined}></textarea>
      {#if erreurs.notes}<span class="erreur" role="alert">{erreurs.notes}</span>{/if}
    </div>

    {#if erreurGlobale}<p class="erreur global" role="alert">{erreurGlobale}</p>{/if}

    <div class="actions">
      <Bouton type="submit">{envoi ? 'Enregistrement…' : 'Enregistrer'}</Bouton>
      <Bouton variante="discret" onclick={() => onfermer?.()}>Annuler</Bouton>
    </div>

    {#if seance}
      <div class="danger">
        {#if confirmerSuppression}
          <p>Supprimer définitivement « {seance.name} » ?</p>
          <div class="actions">
            <Bouton variante="discret" onclick={supprimer}>Oui, supprimer</Bouton>
            <Bouton variante="texte" onclick={() => (confirmerSuppression = false)}>Non, garder</Bouton>
          </div>
        {:else}
          <Bouton variante="texte" onclick={() => (confirmerSuppression = true)}>Supprimer cette séance</Bouton>
        {/if}
      </div>
    {/if}
  </form>
</Panneau>

<style>
  .formulaire {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .ligne {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }
  .champ {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  label {
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
  select:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  [aria-invalid='true'] {
    border-color: var(--danger);
  }
  .erreur {
    font-size: 13px;
    color: var(--danger);
  }
  .structure {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-l);
  }
  .entete-structure {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .entete-structure h3 {
    font-size: 17px;
  }
  .aide {
    font-size: 13px;
    color: var(--texte-doux);
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
    margin-top: 8px;
    padding-top: 16px;
    border-top: 1px solid var(--trait);
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 14px;
  }
</style>
