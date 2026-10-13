<script>
  import { COULEURS_ZONE } from '../data/structure.js';
  import { calculerZones, MODELES_ZONES } from '../data/profil.js';

  // Zones d'entraînement calculées (jamais stockées) à partir d'une valeur de référence.
  //  modele : 'puissance' | 'cardio' | 'allure' · reference : FTP (W), LTHR (bpm) ou vitesse seuil (km/h)
  let { modele, reference } = $props();

  const m = $derived(MODELES_ZONES[modele]);
  const zones = $derived(calculerZones(modele, reference));
  const allure = $derived(modele === 'allure');
</script>

<div class="zones">
  <h3 class="titre">{m.titre}</h3>
  {#if zones}
    <p class="ref">Référence : {String(reference).replace('.', ',')} {allure ? 'km/h' : m.unite} ({m.reference})</p>
    <div class="barre" role="img" aria-label="Répartition des zones {m.titre}">
      {#each zones as z (z.nom)}
        <span style:flex={Math.max(1, z.haut - z.bas)} style:background={COULEURS_ZONE[Math.min(z.couleur, COULEURS_ZONE.length - 1)]}></span>
      {/each}
    </div>
    <table>
      <thead><tr><th scope="col">Zone</th><th scope="col">% de la référence</th><th scope="col">{allure ? 'Vitesse · Allure' : 'Valeurs'}</th></tr></thead>
      <tbody>
        {#each zones as z (z.nom)}
          <tr>
            <th scope="row"><span class="pastille" style:background={COULEURS_ZONE[Math.min(z.couleur, COULEURS_ZONE.length - 1)]}></span>{z.nom}</th>
            <td>{z.bas}–{z.haut} %</td>
            <td>
              {#if allure && z.de === 0}<strong>moins de {String(z.a).replace('.', ',')} km/h</strong> <span class="doux">· plus lent que {z.alluresA}</span>
              {:else if allure}<strong>{String(z.de).replace('.', ',')}–{String(z.a).replace('.', ',')} km/h</strong> <span class="doux">· {z.alluresA}–{z.alluresDe}</span>
              {:else}<strong>{z.de}–{z.a} {m.unite}</strong>{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="vide">Renseigne ta valeur de référence ({m.reference}) dans la section Physiologie pour voir ces zones.</p>
  {/if}
</div>

<style>
  .zones {
    min-width: 0;
  }
  h3 {
    font-size: 18px;
  }
  .ref {
    margin: 2px 0 10px;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .barre {
    display: flex;
    gap: 3px;
    height: 14px;
    margin-bottom: 10px;
  }
  .barre span {
    border-radius: 3px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th,
  td {
    padding: 8px 6px;
    border-top: 1px solid var(--trait);
    text-align: left;
    font-weight: 400;
  }
  thead th {
    border-top: 0;
    font-size: 12px;
    color: var(--texte-muet);
  }
  tbody th {
    white-space: nowrap;
  }
  .pastille {
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-right: 8px;
    border-radius: 2px;
  }
  .doux {
    color: var(--texte-doux);
  }
  .vide {
    margin-top: 6px;
    font-size: 14px;
    color: var(--texte-doux);
  }
</style>
