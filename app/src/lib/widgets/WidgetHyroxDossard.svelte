<script>
  import Dossard from '../components/Dossard.svelte';
  import { familleAffichage } from '../data/familles.js';
  import { ecrireTemps } from '../data/hyrox.js';
  import { formatDateLongue, joursAvant } from '../utils/format.js';

  // Compte à rebours de ta prochaine compétition Hyrox, avec ton dernier test et ton objectif de temps.
  let { contexte } = $props();
  const objectif = $derived(contexte.objectifs.find((o) => familleAffichage(o.sport) === 'hyrox') || null);
  const dernier = $derived(contexte.hyrox.tests[0] || null);
  const cible = $derived(contexte.hyrox.objectif);
  // Barre de progression : plus le test se rapproche de l'objectif, plus elle se remplit
  const avancement = $derived(dernier && cible ? Math.max(0, Math.min(100, (cible.total_s / dernier.total_s) * 100)) : 0);
</script>

<div class="cadre">
  <Dossard
    etiquette="Prochain objectif"
    nom={objectif ? objectif.name : 'Hyrox'}
    valeur={objectif ? `J-${joursAvant(objectif.date)}` : '—'}
    detail={objectif ? formatDateLongue(objectif.date) : "Ajoute ta compétition Hyrox dans l'onglet Compétitions."}
  >
    {#if dernier || cible}
      <div class="temps">
        <span>{dernier ? `Dernier test ${ecrireTemps(dernier.total_s)}` : 'Aucun test'}</span>
        <span>{cible ? `Objectif ${ecrireTemps(cible.total_s)}` : 'Pas d\'objectif'}</span>
      </div>
      {#if dernier && cible}
        <div class="barre" role="img" aria-label={`Ton dernier test atteint ${Math.round(avancement)} % de ton objectif`}>
          <span style:width="{avancement}%"></span>
        </div>
      {/if}
    {/if}
  </Dossard>
</div>

<style>
  .cadre {
    height: 100%;
  }
  .cadre :global(.dossard) {
    height: 100%;
  }
  .temps {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin: 8px 0 6px;
    font-size: 13px;
    font-weight: 600;
  }
  .barre {
    height: 6px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--dossard-texte) 18%, transparent);
    overflow: hidden;
  }
  .barre span {
    display: block;
    height: 100%;
    background: var(--dossard-texte);
    border-radius: 3px;
  }
</style>
