<script>
  import { untrack } from 'svelte';
  import Panneau from './Panneau.svelte';
  import Champ from './Champ.svelte';
  import Bouton from './Bouton.svelte';
  import { auth } from '../stores/auth.svelte.js';
  import { edition, fermerEdition, rafraichir } from '../stores/edition.svelte.js';
  import { modeDemo } from '../routeur.svelte.js';
  import { SPORTS, couleurSport } from '../sports.js';
  import { menu } from '../stores/menu.svelte.js';
  import ChampDiscipline from './ChampDiscipline.svelte';
  import { familleAffichage } from '../data/familles.js';
  import { SPORTS_PREVUE, sportsTries, sportDefaut, estimerTss } from '../data/prevue.js';
  import {
    estManuelle, cleRetouche, formulaireVide, formulaireDepuisSortie, validerSortie, versLigneManuelle, retoucheDepuis, appliquer,
  } from '../data/retouches.js';
  import {
    chargerSeance, creerSortieManuelle, modifierSortieManuelle, supprimerSortieManuelle, enregistrerRetouche, supprimerRetouche,
  } from '../data/api.js';
  import { donneesDemo, ajoutsDemo } from '../data/demo.js';

  // Créer une sortie à la main, modifier une sortie saisie à la main, ou retoucher une sortie Strava.
  //  - sortie saisie à la main : c'est une vraie ligne de `activities` (modification et suppression possibles) ;
  //  - sortie Strava : réécrite à chaque synchro, donc on n'y touche jamais : les changements sont gardés à part (activity_edits).
  const demo = modeDemo();
  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);

  let f = $state(formulaireVide(''));
  let sortie = $state(null); // sortie complète rechargée à l'ouverture (jamais la ligne partielle d'une liste)
  let chargement = $state(false);
  let erreurs = $state({});
  let erreurGlobale = $state('');
  let envoi = $state(false);
  let confirmer = $state(false);

  const creation = $derived(!edition.sortie);
  const manuelle = $derived(creation || estManuelle(sortie || edition.sortie));
  const titre = $derived(creation ? 'Nouvelle sortie' : manuelle ? 'Modifier la sortie' : 'Retoucher la sortie');
  const tssEstime = $derived(estimerTss(Number(f.duree), Number(f.rpe) || null));

  // À l'ouverture : formulaire vide (création) ou sortie complète rechargée (modification).
  $effect(() => {
    if (!edition.ouvert) return;
    const cible = edition.sortie;
    const jour = edition.date;
    untrack(async () => {
      erreurs = {};
      erreurGlobale = '';
      envoi = false;
      confirmer = false;
      if (!cible) {
        sortie = null;
        f = { ...formulaireVide(jour), sport: sportDefaut(menu.filtre) }; // nouvelle sortie : le sport filtré d'abord
        return;
      }
      chargement = true;
      let complete = cible;
      if (demo) complete = donneesDemo().seances.find((s) => s.id === cible.id) || cible;
      else {
        const r = await chargerSeance(userId, cible.id);
        if (r.erreur || !r.data) {
          chargement = false;
          return (erreurGlobale = r.erreur || 'Sortie introuvable.');
        }
        complete = r.data;
      }
      sortie = complete;
      f = formulaireDepuisSortie(complete);
      chargement = false;
    });
  });

  const nomSport = (type) => (SPORTS[familleAffichage(type)] || SPORTS.autre).nom;

  async function enregistrer(e) {
    e.preventDefault();
    if (envoi || chargement) return;
    const { valeurs, erreurs: e2 } = validerSortie(f);
    erreurs = e2;
    erreurGlobale = '';
    if (!valeurs) return;
    envoi = true;
    let r = { erreur: '' };
    if (manuelle) {
      const ligne = versLigneManuelle(valeurs);
      if (demo) {
        if (creation) ajoutsDemo.manuelles.push({ ...ligne, id: `demo-manuelle-${Date.now()}` });
        else {
          const i = ajoutsDemo.manuelles.findIndex((m) => m.id === sortie.id);
          if (i >= 0) ajoutsDemo.manuelles[i] = { ...ajoutsDemo.manuelles[i], ...ligne };
        }
      } else r = creation ? await creerSortieManuelle(userId, ligne) : await modifierSortieManuelle(userId, sortie.id, ligne);
    } else {
      const donnees = retoucheDepuis(valeurs, sortie);
      const cle = cleRetouche(sortie);
      if (demo) {
        if (donnees) ajoutsDemo.retouches[cle] = donnees;
        else delete ajoutsDemo.retouches[cle];
      } else r = donnees ? await enregistrerRetouche(userId, cle, donnees) : await supprimerRetouche(userId, cle);
    }
    envoi = false;
    if (r.erreur) return (erreurGlobale = r.erreur);
    rafraichir();
    fermerEdition();
  }

  async function revenirOrigine() {
    if (envoi || !sortie) return;
    envoi = true;
    const cle = cleRetouche(sortie);
    let r = { erreur: '' };
    if (demo) delete ajoutsDemo.retouches[cle];
    else r = await supprimerRetouche(userId, cle);
    envoi = false;
    if (r.erreur) return (erreurGlobale = r.erreur);
    rafraichir();
    fermerEdition();
  }

  async function supprimer() {
    if (envoi || !sortie) return;
    envoi = true;
    let r = { erreur: '' };
    if (demo) ajoutsDemo.manuelles = ajoutsDemo.manuelles.filter((m) => m.id !== sortie.id);
    else r = await supprimerSortieManuelle(userId, sortie.id);
    envoi = false;
    if (r.erreur) {
      erreurGlobale = r.erreur;
      confirmer = false;
      return;
    }
    rafraichir();
    fermerEdition();
    if (location.hash.startsWith('#/seance/')) location.hash = '#/calendrier'; // la page de cette sortie n'existe plus
  }
</script>

<Panneau ouvert={edition.ouvert} {titre} onfermer={fermerEdition}>
  {#if chargement}
    <p class="info" role="status">Chargement…</p>
  {:else}
    <form class="formulaire" onsubmit={enregistrer} novalidate>
      {#if !manuelle}
        <p class="note">
          Cette sortie vient de Strava : elle n'est pas modifiée à la source. Tes changements sont gardés à part et réappliqués après chaque synchro.
        </p>
      {/if}

      <Champ id="reel-nom" label="Nom" bind:valeur={f.nom} erreur={erreurs.nom} maxlength={120} placeholder="Footing, sortie vélo…" />

      {#if manuelle}
        <div class="ligne">
          <Champ id="reel-date" type="date" label="Date" bind:valeur={f.date} erreur={erreurs.date} />
          <Champ id="reel-heure" type="time" label="Heure" bind:valeur={f.heure} erreur={erreurs.heure} />
        </div>
      {/if}

      <div class="champ">
        <label for="reel-sport">Sport</label>
        <select id="reel-sport" bind:value={f.sport}>
          {#each sportsTries(menu.filtre) as s (s.type)}<option value={s.type}>{nomSport(s.type)}</option>{/each}
          {#if !SPORTS_PREVUE.some((s) => s.type === f.sport)}<option value={f.sport}>{f.sport}</option>{/if}
        </select>
      </div>

      {#if f.sport === 'Athletics'}
        <ChampDiscipline id="reel-discipline" bind:valeur={f.discipline} erreur={erreurs.discipline} />
      {/if}

      <div class="ligne">
        <Champ id="reel-duree" label="Durée (min)" inputmode="numeric" bind:valeur={f.duree} erreur={erreurs.duree} />
        <Champ id="reel-rpe" label="Effort ressenti (1 à 10)" inputmode="numeric" bind:valeur={f.rpe} erreur={erreurs.rpe} />
      </div>
      <div class="ligne">
        <Champ id="reel-tss" label="Charge (TSS)" inputmode="numeric" placeholder="auto : {tssEstime}" bind:valeur={f.tss} erreur={erreurs.tss} />
        <Champ id="reel-km" label="Distance (km)" inputmode="decimal" bind:valeur={f.km} erreur={erreurs.km} />
      </div>
      <Champ id="reel-dplus" label="Dénivelé + (m)" inputmode="numeric" bind:valeur={f.dPlus} erreur={erreurs.dPlus} />

      <div class="champ">
        <label for="reel-notes">Notes</label>
        <textarea id="reel-notes" rows="4" maxlength="2000" bind:value={f.notes} aria-invalid={erreurs.notes ? 'true' : undefined}></textarea>
        {#if erreurs.notes}<span class="erreur" role="alert">{erreurs.notes}</span>{/if}
      </div>

      {#if erreurGlobale}<p class="erreur global" role="alert">{erreurGlobale}</p>{/if}
      <div class="actions">
        <Bouton type="submit">{envoi ? 'Enregistrement…' : 'Enregistrer'}</Bouton>
        <Bouton variante="discret" onclick={fermerEdition}>Annuler</Bouton>
      </div>

      {#if !creation}
        <div class="danger">
          {#if !manuelle && sortie?.retouchee}
            <Bouton variante="texte" onclick={revenirOrigine}>Revenir aux valeurs d'origine</Bouton>
          {:else if manuelle}
            {#if confirmer}
              <p>Supprimer définitivement « {f.nom} » ?</p>
              <div class="actions">
                <Bouton variante="discret" onclick={supprimer}>Oui, supprimer</Bouton>
                <Bouton variante="texte" onclick={() => (confirmer = false)}>Non, garder</Bouton>
              </div>
            {:else}
              <Bouton variante="texte" onclick={() => (confirmer = true)}>Supprimer cette sortie</Bouton>
            {/if}
          {/if}
        </div>
      {/if}
    </form>
  {/if}
</Panneau>

<style>
  .formulaire {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .info {
    color: var(--texte-doux);
  }
  .note {
    padding: 10px 14px;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--texte-doux);
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
