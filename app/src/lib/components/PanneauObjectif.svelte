<script>
  import { untrack } from 'svelte';
  import Panneau from './Panneau.svelte';
  import Champ from './Champ.svelte';
  import Bouton from './Bouton.svelte';
  import { SPORTS_OBJECTIFS, CATALOGUE, modele, estManuel, validerObjectif } from '../data/bilan.js';
  import { creerObjectifAnnuel, modifierObjectifAnnuel, supprimerObjectifAnnuel } from '../data/api.js';

  // Créer, modifier ou supprimer un objectif annuel (table yearly_goals).
  //  objectif : objectif à modifier (null = nouveau) · annee : année du nouvel objectif · sportDefaut : sport proposé à la création
  //  enregistre(objectif) / supprime(id)
  let { ouvert = false, objectif = null, annee, sportDefaut = null, userId, demo = false, onfermer, enregistre, supprime } = $props();

  let f = $state({ sport: 'tous', template: '', cible: '', actuel: '' });
  let erreurs = $state({});
  let erreurGlobale = $state('');
  let envoi = $state(false);
  let confirmer = $state(false);
  let ouverture = 0; // change à chaque ouverture : une réponse arrivée après la fermeture ne ferme pas un autre panneau

  $effect(() => {
    if (!ouvert) return;
    const o = objectif;
    untrack(() => {
      ouverture++;
      const sport = sportDefaut && Object.hasOwn(CATALOGUE, sportDefaut) ? sportDefaut : 'tous';
      f = o
        ? { sport: o.sport, template: o.template, cible: String(o.target), actuel: o.currentManual != null ? String(o.currentManual) : '' }
        : { sport, template: CATALOGUE[sport][0].id, cible: '', actuel: '' };
      erreurs = {};
      erreurGlobale = '';
      envoi = false;
      confirmer = false;
    });
  });

  const modeles = $derived(Object.hasOwn(CATALOGUE, f.sport) ? CATALOGUE[f.sport] : []);
  const m = $derived(modele(f.sport, f.template));
  // Changer de sport : on repasse sur le premier objectif de ce sport (sauf s'il convient déjà)
  function changerSport(e) {
    f.sport = e.currentTarget.value;
    if (!modele(f.sport, f.template)) f.template = CATALOGUE[f.sport][0].id;
  }

  async function enregistrer(e) {
    e.preventDefault();
    if (envoi) return;
    const { valeurs, erreurs: e2 } = validerObjectif(f);
    erreurs = e2;
    erreurGlobale = '';
    if (!valeurs) return;
    envoi = true;
    const cetteOuverture = ouverture;
    let r;
    if (demo) r = { data: { id: objectif?.id || `demo-g-${Date.now()}`, annee, sport: valeurs.sport, template: valeurs.template, target: valeurs.target, currentManual: valeurs.current_manual ?? undefined }, erreur: '' };
    else r = objectif ? await modifierObjectifAnnuel(userId, objectif.id, valeurs) : await creerObjectifAnnuel(userId, annee, valeurs);
    if (cetteOuverture !== ouverture) return r.erreur ? undefined : enregistre?.(r.data); // enregistré, mais le panneau n'est plus celui-là : on prévient la page sans le fermer
    envoi = false;
    if (r.erreur) return (erreurGlobale = r.erreur);
    enregistre?.(r.data);
    onfermer?.();
  }

  async function effacer() {
    if (!objectif || envoi) return;
    envoi = true;
    const cetteOuverture = ouverture;
    const cible = objectif;
    const r = demo ? { erreur: '' } : await supprimerObjectifAnnuel(userId, cible.id);
    if (cetteOuverture !== ouverture) return r.erreur ? undefined : supprime?.(cible.id);
    envoi = false;
    if (r.erreur) {
      erreurGlobale = r.erreur;
      confirmer = false;
      return;
    }
    supprime?.(cible.id);
    onfermer?.();
  }
</script>

<Panneau {ouvert} titre={objectif ? `Modifier l'objectif ${objectif.annee}` : `Nouvel objectif ${annee}`} {onfermer}>
  <form class="formulaire" onsubmit={enregistrer} novalidate>
    <div class="champ">
      <label for="obj-sport">Sport</label>
      <select id="obj-sport" value={f.sport} onchange={changerSport} disabled={!!objectif}>
        {#each SPORTS_OBJECTIFS as [cle, nom] (cle)}<option value={cle}>{nom}</option>{/each}
      </select>
    </div>

    <div class="champ">
      <label for="obj-modele">Objectif</label>
      <select id="obj-modele" bind:value={f.template} disabled={!!objectif} aria-invalid={erreurs.template ? 'true' : undefined}>
        {#each modeles as mod (mod.id)}<option value={mod.id}>{mod.label}{mod.unit ? ` (${mod.unit})` : ''}</option>{/each}
      </select>
      {#if erreurs.template}<span class="erreur" role="alert">{erreurs.template}</span>{/if}
      {#if m}<span class="aide">{estManuel(m) ? (m.calc === 'manual_lower' ? 'Tu saisis ta performance actuelle : plus elle est basse, mieux c’est.' : 'Tu saisis ta performance actuelle.') : "Calculé automatiquement à partir de tes sorties de l'année."}</span>{/if}
    </div>

    <Champ id="obj-cible" label={`Cible${m?.unit ? ` (${m.unit})` : ''}`} inputmode="decimal" bind:valeur={f.cible} erreur={erreurs.cible} placeholder="ex. 1500" />
    {#if m && estManuel(m)}
      <Champ id="obj-actuel" label={`Performance actuelle${m.unit ? ` (${m.unit})` : ''}`} inputmode="decimal" bind:valeur={f.actuel} erreur={erreurs.actuel} />
    {/if}

    {#if erreurGlobale}<p class="erreur global" role="alert">{erreurGlobale}</p>{/if}
    <div class="actions">
      <Bouton type="submit">{envoi ? 'Enregistrement…' : 'Enregistrer'}</Bouton>
      <Bouton variante="discret" onclick={() => onfermer?.()}>Annuler</Bouton>
    </div>

    {#if objectif}
      <div class="danger">
        {#if confirmer}
          <p>Supprimer définitivement cet objectif ?</p>
          <div class="actions">
            <Bouton variante="discret" onclick={effacer}>Oui, supprimer</Bouton>
            <Bouton variante="texte" onclick={() => (confirmer = false)}>Non, garder</Bouton>
          </div>
        {:else}
          <Bouton variante="texte" onclick={() => (confirmer = true)}>Supprimer cet objectif</Bouton>
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
  .champ {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  label {
    font-size: 13px;
    color: var(--texte-doux);
  }
  select {
    box-sizing: border-box;
    width: 100%;
    height: 52px;
    padding: 0 16px;
    background: var(--fond);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    font-size: 16px;
  }
  select:disabled {
    opacity: 0.6;
  }
  select:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .aide {
    font-size: 13px;
    color: var(--texte-doux);
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
