<script>
  import Panneau from './Panneau.svelte';
  import Bouton from './Bouton.svelte';
  import { grouper, resume } from '../data/modeles.js';
  import { supprimerModele } from '../data/api.js';
  import { couleurSport } from '../sports.js';

  // Bibliothèque de modèles de séances : rechercher, utiliser (crée une séance prévue préremplie) ou supprimer.
  //  modeles : liste (activity_template) · onutiliser(modele) · onsupprime(id)
  let { ouvert = false, modeles = [], chargement = false, erreur = '', userId, demo = false, onfermer, onutiliser, onsupprime } = $props();

  let recherche = $state('');
  let aSupprimer = $state(null); // id du modèle en attente de confirmation
  let erreurLocale = $state('');
  const groupes = $derived(grouper(modeles, recherche));
  const COULEUR = { cyclisme: 'velo', vtt: 'velo', course: 'course', trail: 'course', natation: 'natation', musculation: 'muscu', autre: 'autre' };

  async function supprimer(m) {
    erreurLocale = '';
    const r = demo ? { erreur: '' } : await supprimerModele(userId, m.id);
    aSupprimer = null;
    if (r.erreur) return (erreurLocale = r.erreur);
    onsupprime?.(m.id);
  }
</script>

<Panneau {ouvert} titre="Mes modèles de séances" {onfermer}>
  <div class="contenu">
    <div class="champ">
      <label for="modeles-recherche">Rechercher</label>
      <input id="modeles-recherche" type="search" placeholder="Nom ou description" bind:value={recherche} autocomplete="off" />
    </div>

    {#if chargement}
      <p class="info" role="status">Chargement…</p>
    {:else if erreur}
      <p class="erreur" role="alert">{erreur}</p>
    {:else if !modeles.length}
      <p class="info">Aucun modèle pour l'instant. Dans le formulaire d'une séance, utilise « Enregistrer comme modèle » pour en créer un.</p>
    {:else if !groupes.length}
      <p class="info">Aucun modèle ne correspond à « {recherche} ».</p>
    {/if}
    {#if erreurLocale}<p class="erreur" role="alert">{erreurLocale}</p>{/if}

    {#each groupes as g (g.cle)}
      <section aria-label={g.nom}>
        <h3><span class="point" style:background={couleurSport(COULEUR[g.cle] || 'autre')}></span>{g.nom}</h3>
        <ul>
          {#each g.modeles as m (m.id)}
            <li>
              <div class="corps">
                <span class="nom">{m.name}</span>
                <span class="sous">{resume(m)}</span>
              </div>
              {#if aSupprimer === m.id}
                <div class="confirmation">
                  <span>Supprimer ?</span>
                  <Bouton variante="discret" onclick={() => supprimer(m)}>Oui</Bouton>
                  <Bouton variante="texte" onclick={() => (aSupprimer = null)}>Non</Bouton>
                </div>
              {:else}
                <div class="actions">
                  <Bouton onclick={() => onutiliser?.(m)}>Utiliser</Bouton>
                  <Bouton variante="texte" onclick={() => (aSupprimer = m.id)}>Supprimer</Bouton>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
</Panneau>

<style>
  .contenu {
    display: flex;
    flex-direction: column;
    gap: 18px;
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
  input {
    box-sizing: border-box;
    height: 52px;
    padding: 0 16px;
    background: var(--fond);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    font-size: 16px;
  }
  input:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .info {
    font-size: 14px;
    color: var(--texte-doux);
  }
  .erreur {
    font-size: 14px;
    color: var(--danger);
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 8px;
    font-size: 16px;
  }
  .point {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
  ul {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 12px;
    padding: 12px 14px;
    border-radius: var(--rayon);
    background: var(--surface-2);
  }
  .corps {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1 1 180px;
  }
  .nom {
    font-size: 15px;
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .sous {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .actions,
  .confirmation {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 14px;
  }
</style>
