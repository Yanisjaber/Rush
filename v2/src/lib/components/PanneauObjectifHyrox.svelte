<script>
  import { untrack } from 'svelte';
  import Panneau from './Panneau.svelte';
  import Champ from './Champ.svelte';
  import Bouton from './Bouton.svelte';
  import GrilleTemps from './GrilleTemps.svelte';
  import { validerObjectif, ecrireTemps, NB_SEGMENTS } from '../data/hyrox.js';

  // Fixer son objectif de temps : un total (1:10:00) et, si on veut, un temps visé par segment.
  // Sans temps par segment, l'app répartit le total au prorata de ton dernier test.
  //  - objectif : { total_s, segments } actuel ou null
  //  - onenregistrer(valeurs | null) : écrit (ou efface si null) et renvoie { erreur }
  let { ouvert = false, objectif = null, onenregistrer, onfermer } = $props();

  let total = $state('');
  let temps = $state(new Array(NB_SEGMENTS).fill(''));
  let detail = $state(false);
  let erreur = $state('');
  let envoi = $state(false);

  $effect(() => {
    if (!ouvert) return;
    const o = objectif;
    untrack(() => {
      total = o ? ecrireTemps(o.total_s) : '';
      temps = o?.segments ? o.segments.map((s) => ecrireTemps(s)) : new Array(NB_SEGMENTS).fill('');
      detail = !!o?.segments;
      erreur = '';
      envoi = false;
    });
  });

  async function enregistrer(e) {
    e.preventDefault();
    if (envoi) return;
    const { valeurs, erreur: e2 } = validerObjectif(total, detail ? temps : null);
    erreur = e2;
    if (!valeurs) return;
    envoi = true;
    const r = await onenregistrer(valeurs);
    envoi = false;
    if (r.erreur) erreur = r.erreur;
  }
  async function effacer() {
    if (envoi) return;
    envoi = true;
    const r = await onenregistrer(null);
    envoi = false;
    if (r.erreur) erreur = r.erreur;
  }
</script>

<Panneau {ouvert} titre="Ton objectif de temps" grand {onfermer}>
  <form class="formulaire" onsubmit={enregistrer} novalidate>
    <Champ id="obj-total" label="Temps visé sur la course" bind:valeur={total} placeholder="1:10:00" inputmode="numeric" maxlength={8} />
    <label class="case">
      <input type="checkbox" bind:checked={detail} />
      <span>Je veux fixer un temps visé pour chaque segment</span>
    </label>
    {#if detail}
      <GrilleTemps bind:temps vide="visé" id="objectif" />
    {:else}
      <p class="aide">Sans détail, ton total est réparti sur les 16 segments selon ton dernier test : tu vois alors où gagner du temps.</p>
    {/if}
    {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
    <div class="actions">
      <Bouton type="submit">{envoi ? 'Enregistrement…' : 'Enregistrer'}</Bouton>
      <Bouton variante="discret" onclick={onfermer}>Annuler</Bouton>
      {#if objectif}<Bouton variante="texte" onclick={effacer}>Effacer l'objectif</Bouton>{/if}
    </div>
  </form>
</Panneau>

<style>
  .formulaire {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .case {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: var(--cible);
    font-size: 14px;
  }
  .case input {
    width: 22px;
    height: 22px;
    accent-color: var(--sport-hybride);
  }
  .aide {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .erreur {
    margin: 0;
    font-size: 13px;
    color: var(--danger);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
