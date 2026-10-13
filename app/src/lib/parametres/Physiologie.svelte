<script>
  import FormulaireSection from '../components/FormulaireSection.svelte';
  import { profil, estSale, enregistrerSection } from '../stores/profil.svelte.js';
  import { SECTIONS, estimerFtp, estimerLthr, wattsParKg } from '../data/profil.js';

  // Onglet Physiologie : FC, FTP, course, natation, avec des estimations tirées de tes sorties.
  let { demo = false, userId } = $props();

  const section = SECTIONS.find((s) => s.id === 'physiologie');
  const nombre = (v) => Number(String(v ?? '').replace(',', '.')) || 0;
  const v = $derived(profil.valeurs.physiologie || {});
  const ftp = $derived(nombre(v.ftp));
  const lthr = $derived(nombre(v.lthr));
  const ftpEstimee = $derived(estimerFtp(profil.courbe));
  const lthrEstimee = $derived(estimerLthr(v.hr_max));
  const wkg = $derived(wattsParKg(ftp, profil.ligne?.weight));

  const aides = $derived({
    ...(!ftp && ftpEstimee ? { ftp: { texte: `Estimée à partir de tes sorties : ~${ftpEstimee} W.`, bouton: 'Utiliser', onbouton: () => (profil.valeurs.physiologie.ftp = String(ftpEstimee)) } } : {}),
    ...(!lthr && lthrEstimee ? { lthr: { texte: `Estimée (92 % de ta FC max) : ~${lthrEstimee} bpm.`, bouton: 'Utiliser', onbouton: () => (profil.valeurs.physiologie.lthr = String(lthrEstimee)) } } : {}),
  });
</script>

<FormulaireSection
  {section}
  bind:valeurs={profil.valeurs[section.id]}
  erreurs={profil.erreurs[section.id] || {}}
  sale={estSale(section.id)}
  envoi={!!profil.envoi[section.id]}
  message={profil.messages[section.id] || ''}
  erreurGlobale={profil.erreursGlobales[section.id] || ''}
  {aides}
  onenregistrer={() => enregistrerSection(section, userId, demo)}
>
  {#snippet enTete()}
    {#if wkg}<p class="derive"><strong>{String(wkg).replace('.', ',')}</strong> W/kg à ta FTP</p>{/if}
  {/snippet}
</FormulaireSection>

<style>
  .derive {
    margin: -6px 0 14px;
    font-size: 15px;
    color: var(--texte-doux);
  }
  .derive strong {
    font-family: var(--police-titre);
    font-size: 22px;
    color: var(--texte);
  }
</style>
