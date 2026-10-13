<script>
  import Bloc from '../components/Bloc.svelte';
  import TableauZones from '../components/TableauZones.svelte';
  import { profil } from '../stores/profil.svelte.js';

  // Onglet Zones : zones d'entraînement calculées à partir de ce qui est ENREGISTRÉ dans la physiologie.
  // Elles ne sont jamais stockées : on les recalcule à chaque affichage.
  const ftp = $derived(Number(profil.ligne?.ftp) || 0);
  const lthr = $derived(Number(profil.ligne?.lthr) || 0);
  const vitesseSeuil = $derived(Number(profil.ligne?.extras?.threshold_speed) || 0);
</script>

<Bloc titre="Zones d'entraînement">
  <p class="intro">
    Calculées à partir de ta FTP, de ta LTHR et de ta vitesse seuil enregistrées. Pour les changer, va dans l'onglet
    <a href="#/parametres/physiologie">Physiologie</a>.
  </p>
  <div class="trois">
    <TableauZones modele="puissance" reference={ftp} />
    <TableauZones modele="cardio" reference={lthr} />
    <TableauZones modele="allure" reference={vitesseSeuil} />
  </div>
</Bloc>

<style>
  .intro {
    margin: 0 0 18px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .intro a {
    color: var(--texte);
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .trois {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 28px 24px;
  }
</style>
