<script>
  import { GROUPES, ORDRE_GROUPES, chercherExercices, groupeValide } from '../data/exercices.js';

  // Choisir un exercice : recherche, filtre par groupe musculaire, et création d'un exercice perso.
  //  - perso : exercices de l'utilisateur ({cle, nom, groupe, perso})
  //  - onchoisir(exo) : appelé avec l'exercice choisi
  //  - oncreer(nom, groupe) : crée un exercice perso et renvoie { exo, erreur } (la page gère la base ou la démo)
  let { perso = [], onchoisir, oncreer, onfermer } = $props();

  let texte = $state('');
  let groupe = $state('');
  let creation = $state(false);
  let nom = $state('');
  let groupeNouveau = $state('pectoraux');
  let erreur = $state('');
  let envoi = $state(false);

  const resultats = $derived(chercherExercices(perso, { texte, groupe }));

  async function creer(e) {
    e.preventDefault();
    if (envoi) return;
    const n = nom.trim();
    if (!n) return (erreur = 'Donne un nom à ton exercice.');
    if (n.length > 80) return (erreur = '80 caractères maximum.');
    if (!groupeValide(groupeNouveau)) return (erreur = 'Choisis un groupe musculaire.');
    envoi = true;
    erreur = '';
    const r = await oncreer(n, groupeNouveau);
    envoi = false;
    if (r.erreur) return (erreur = r.erreur);
    nom = '';
    creation = false;
    onchoisir(r.exo);
  }
</script>

<div class="selecteur">
  <div class="entete">
    <input type="search" placeholder="Chercher un exercice…" aria-label="Chercher un exercice" bind:value={texte} maxlength="80" />
    {#if onfermer}<button type="button" class="fermer" onclick={onfermer}>Fermer</button>{/if}
  </div>

  <div class="groupes" role="group" aria-label="Filtrer par groupe musculaire">
    <button type="button" class="puce" class:actif={groupe === ''} aria-pressed={groupe === ''} onclick={() => (groupe = '')}>Tous</button>
    {#each ORDRE_GROUPES as g}
      <button type="button" class="puce" class:actif={groupe === g} aria-pressed={groupe === g} onclick={() => (groupe = g)}>{GROUPES[g].nom}</button>
    {/each}
  </div>

  <ul class="liste">
    {#each resultats as e (e.cle)}
      <li>
        <button type="button" onclick={() => onchoisir(e)}>
          <span>{e.nom}{#if e.perso}<em> · à toi</em>{/if}</span>
          <span class="groupe">{GROUPES[e.groupe]?.nom}</span>
        </button>
      </li>
    {:else}
      <li class="vide">Aucun exercice ne correspond.</li>
    {/each}
  </ul>

  {#if oncreer}
    {#if creation}
      <form class="creation" onsubmit={creer} novalidate>
        <label for="exo-nom">Nom de ton exercice</label>
        <input id="exo-nom" type="text" bind:value={nom} maxlength="80" placeholder="Développé Svend" aria-invalid={erreur ? 'true' : undefined} />
        <label for="exo-groupe">Groupe musculaire</label>
        <select id="exo-groupe" bind:value={groupeNouveau}>
          {#each ORDRE_GROUPES as g}<option value={g}>{GROUPES[g].nom}</option>{/each}
        </select>
        {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
        <div class="actions">
          <button type="submit" class="principal">{envoi ? 'Ajout…' : 'Ajouter et choisir'}</button>
          <button type="button" class="texte" onclick={() => (creation = false)}>Annuler</button>
        </div>
      </form>
    {:else}
      <button type="button" class="ajout" onclick={() => (creation = true)}>+ Créer mon propre exercice</button>
    {/if}
  {/if}
</div>

<style>
  .selecteur {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .entete {
    display: flex;
    gap: 8px;
  }
  input,
  select {
    box-sizing: border-box;
    width: 100%;
    height: 48px;
    padding: 0 14px;
    background: var(--fond);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    font-size: 16px;
  }
  input[aria-invalid='true'] {
    border-color: var(--danger);
  }
  input:focus-visible,
  select:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .fermer,
  .texte {
    flex: none;
    min-height: var(--cible);
    padding: 0 12px;
    background: transparent;
    border: 0;
    color: var(--texte-doux);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 4px;
    cursor: pointer;
  }
  .groupes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .puce {
    min-height: 40px;
    padding: 0 14px;
    background: transparent;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-rond);
    color: var(--texte-doux);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .puce.actif {
    background: var(--texte);
    border-color: var(--texte);
    color: var(--fond);
  }
  .liste {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 340px;
    overflow-y: auto;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-l);
  }
  .liste li + li {
    border-top: 1px solid var(--trait);
  }
  .liste button {
    display: flex;
    width: 100%;
    min-height: var(--cible);
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 14px;
    background: transparent;
    border: 0;
    color: var(--texte);
    font-size: 15px;
    text-align: left;
    cursor: pointer;
  }
  .liste button:hover {
    background: var(--surface-2);
  }
  .groupe,
  em {
    font-size: 12px;
    font-style: normal;
    color: var(--texte-doux);
  }
  .vide {
    padding: 14px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .ajout {
    min-height: var(--cible);
    background: transparent;
    border: 1px dashed var(--trait-fort);
    border-radius: var(--rayon-l);
    color: var(--texte);
    font-weight: 600;
    cursor: pointer;
  }
  .creation {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-l);
  }
  label {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .erreur {
    margin: 0;
    font-size: 13px;
    color: var(--danger);
  }
  .actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .principal {
    min-height: var(--cible);
    padding: 0 18px;
    background: var(--texte);
    color: var(--fond);
    border: 0;
    border-radius: var(--rayon);
    font-weight: 700;
    cursor: pointer;
  }
</style>
