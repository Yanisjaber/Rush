<script>
  import Panneau from './Panneau.svelte';
  import Bouton from './Bouton.svelte';
  import { rechercherLicences } from '../data/od-api.js';
  import { nomLicence } from '../data/opendossard.js';

  // Lier une licence Open Dossard : on cherche par nom, on choisit la bonne licence, le palmarès se charge ensuite.
  //  onchoisir(licence) : la licence choisie (déjà nettoyée par normaliserLicences)
  let { ouvert = false, demo = false, onfermer, onchoisir } = $props();

  let q = $state('');
  let etat = $state({ chargement: false, erreur: '', liste: null });
  const LICENCES_DEMO = [
    { id: 'demo-licence', numero: '1234567', prenom: 'Yanis', nom: 'Jaber', club: 'UV Toulouse', departement: '31' },
    { id: 'demo-2', numero: '7654321', prenom: 'Yanis', nom: 'Jabert', club: 'VC Blagnac', departement: '31' },
  ];

  async function chercher(e) {
    e.preventDefault();
    if (etat.chargement) return;
    etat = { chargement: true, erreur: '', liste: null };
    const r = demo ? { data: LICENCES_DEMO, erreur: q.trim().length < 2 ? 'Saisis au moins 2 caractères.' : '' } : await rechercherLicences(q);
    etat = { chargement: false, erreur: r.erreur, liste: r.data };
  }
</script>

<Panneau {ouvert} titre="Lier ma licence Open Dossard" {onfermer}>
  <form class="recherche" onsubmit={chercher}>
    <p class="intro">Cherche ta licence par nom pour importer tes résultats officiels.</p>
    <label for="od-recherche">Ton nom ou ton numéro de licence</label>
    <div class="ligne">
      <input id="od-recherche" type="search" placeholder="ex. Jaber" bind:value={q} autocomplete="off" maxlength="60" />
      <Bouton type="submit">{etat.chargement ? 'Recherche…' : 'Rechercher'}</Bouton>
    </div>
  </form>

  {#if etat.erreur}<p class="erreur" role="alert">{etat.erreur}</p>{/if}
  {#if etat.liste && !etat.liste.length && !etat.erreur}<p class="info">Aucune licence trouvée.</p>{/if}
  {#if etat.liste?.length}
    <ul class="liste">
      {#each etat.liste.slice(0, 12) as l (l.id)}
        <li>
          <div class="corps">
            <span class="nom">{nomLicence(l)}</span>
            <span class="sous">{[l.numero && `N° ${l.numero}`, l.club, l.departement].filter(Boolean).join(' · ')}</span>
          </div>
          <Bouton variante="discret" onclick={() => onchoisir?.(l)}>Choisir</Bouton>
        </li>
      {/each}
    </ul>
  {/if}
</Panneau>

<style>
  .recherche {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }
  .intro,
  .info,
  label {
    font-size: 14px;
    color: var(--texte-doux);
  }
  .ligne {
    display: flex;
    gap: 8px;
  }
  input {
    flex: 1;
    min-width: 0;
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
  .erreur {
    font-size: 14px;
    color: var(--danger);
  }
  .liste {
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
    overflow-wrap: anywhere;
  }
</style>
