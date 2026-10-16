<script>
  import { untrack } from 'svelte';
  import { nomDiscipline } from '../data/disciplines.js';
  import { auth } from '../stores/auth.svelte.js';
  import { modeDemo } from '../routeur.svelte.js';
  import { sportsChoisis, chargerSportsChoisis } from '../stores/sports.svelte.js';

  // Le choix de la discipline d'une séance d'athlétisme (100 m, saut en hauteur…) : parmi celles que l'utilisateur a cochées
  // (menu « + » de la barre des sports, ou Paramètres › Préférences). `valeur` est la clé choisie, '' = non précisée.
  let { id = 'discipline', valeur = $bindable(''), erreur = '' } = $props();

  const uid = $derived(modeDemo() ? 'demo' : auth.session?.user?.id);
  $effect(() => {
    const u = uid;
    if (u && !sportsChoisis.pret) untrack(() => chargerSportsChoisis(u));
  });
  const cochees = $derived(sportsChoisis.disciplines?.athletisme || []);
  // Une séance déjà enregistrée garde sa discipline même si elle a été décochée depuis : on la montre quand même
  const options = $derived(valeur && !cochees.includes(valeur) ? [...cochees, valeur] : cochees);
</script>

<div class="champ">
  <label for={id}>Discipline</label>
  <select {id} bind:value={valeur} aria-invalid={erreur ? 'true' : undefined}>
    <option value="">Non précisée</option>
    {#each options as cle (cle)}<option value={cle}>{nomDiscipline('athletisme', cle)}</option>{/each}
  </select>
  {#if !cochees.length}<span class="aide">Coche tes disciplines dans le « + » de la barre des sports pour les retrouver ici.</span>{/if}
  {#if erreur}<span class="erreur" role="alert">{erreur}</span>{/if}
</div>

<style>
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
    min-height: var(--cible);
    padding: 0 12px;
    font: inherit;
    font-size: 16px; /* 16 px minimum : sinon l'iPhone zoome quand on touche le champ */
    color: var(--texte);
    background: var(--surface);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
  }
  select[aria-invalid='true'] {
    border-color: var(--danger);
  }
  .aide {
    font-size: 12px;
    color: var(--texte-muet);
  }
  .erreur {
    font-size: 13px;
    color: var(--danger);
  }
</style>
