<script>
  import { untrack } from 'svelte';
  import Bloc from '../components/Bloc.svelte';
  import Bouton from '../components/Bouton.svelte';
  import { theme, choisirTheme } from '../stores/theme.svelte.js';
  import { disposition, demanderEdition, reinitialiserAuto } from '../stores/disposition.svelte.js';
  import { aller, modeDemo } from '../routeur.svelte.js';
  import ChoixSports from '../components/ChoixSports.svelte';
  import { auth } from '../stores/auth.svelte.js';
  import { sportsChoisis, chargerSportsChoisis, enregistrerSportsChoisis } from '../stores/sports.svelte.js';

  // Onglet Préférences : accueil personnalisable et apparence.
  function modifierAccueil() {
    demanderEdition();
    aller('/');
  }
  // « Mes sports » : change les sports qui composent l'accueil et ses onglets
  const uid = modeDemo() ? 'demo' : auth.session?.user?.id;
  let choix = $state([]);
  let disciplines = $state({});
  let sportsEnCours = $state(false);
  let sportsMessage = $state('');
  $effect(() => {
    const id = uid;
    // `untrack` : seul l'identifiant de l'utilisateur doit relancer le chargement, jamais ce qu'il lit ou écrit dans le store
    untrack(() => chargerSportsChoisis(id)).then(() => {
      choix = [...(sportsChoisis.liste || [])];
      disciplines = JSON.parse(JSON.stringify(sportsChoisis.disciplines || {}));
    });
  });
  async function enregistrerSports() {
    if (sportsEnCours) return;
    sportsEnCours = true;
    sportsMessage = '';
    const r = await enregistrerSportsChoisis(uid, choix, disciplines);
    sportsEnCours = false;
    sportsMessage = r.local && uid !== 'demo' ? 'Enregistré sur cet appareil (la sauvegarde en ligne a échoué).' : 'Sports enregistrés : ton accueil s\'adapte à ton prochain passage.';
  }
  async function revenirAuto() {
    await reinitialiserAuto();
    aller('/');
  }
</script>

<div class="onglet">
  <Bloc titre="Mes sports">
    <p class="aide">Les sports que tu pratiques composent ton accueil et ses onglets. Triathlon : coche course, vélo et natation.</p>
    <ChoixSports bind:selection={choix} bind:disciplines desactive={sportsEnCours} />
    <div class="actions" style="margin-top: 14px">
      <Bouton onclick={enregistrerSports}>{sportsEnCours ? 'Enregistrement…' : 'Enregistrer mes sports'}</Bouton>
    </div>
    {#if sportsMessage}<p class="aide" role="status">{sportsMessage}</p>{/if}
  </Bloc>

  <Bloc titre="Mon accueil">
    <p class="aide">
      Choisis quels widgets s'affichent, dans quel ordre et à quelle taille.
      {#if disposition.auto}Aujourd'hui, ton accueil est <strong>automatique</strong> : il s'adapte à tes sports.{:else}Ton accueil est <strong>personnalisé</strong>.{/if}
    </p>
    <div class="actions">
      <Bouton onclick={modifierAccueil}>Personnaliser mon accueil</Bouton>
      {#if !disposition.auto}<Bouton variante="texte" onclick={revenirAuto}>Revenir à l'accueil automatique</Bouton>{/if}
    </div>
  </Bloc>

  <Bloc titre="Apparence">
    <p class="aide">Le thème sombre est celui de l'app. Le thème clair est plus lisible en plein soleil.</p>
    <div class="segment" role="group" aria-label="Thème">
      <button type="button" aria-pressed={theme.choix === 'sombre'} onclick={() => choisirTheme('sombre')}>Sombre</button>
      <button type="button" aria-pressed={theme.choix === 'clair'} onclick={() => choisirTheme('clair')}>Clair</button>
    </div>
  </Bloc>
</div>

<style>
  .onglet {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .aide {
    margin-bottom: 16px;
    font-size: 15px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .aide strong {
    color: var(--texte);
    font-weight: 600;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .segment {
    display: inline-flex;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    overflow: hidden;
  }
  .segment button {
    min-height: var(--cible);
    padding: 0 24px;
    background: transparent;
    border: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-doux);
    cursor: pointer;
  }
  .segment button[aria-pressed='true'] {
    background: var(--texte);
    color: var(--fond);
  }
</style>
