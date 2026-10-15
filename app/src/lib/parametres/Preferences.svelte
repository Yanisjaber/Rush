<script>
  import { untrack } from 'svelte';
  import Bloc from '../components/Bloc.svelte';
  import Bouton from '../components/Bouton.svelte';
  import { theme, choisirTheme } from '../stores/theme.svelte.js';
  import { disposition, demanderEdition, reinitialiserAuto } from '../stores/disposition.svelte.js';
  import { aller, modeDemo } from '../routeur.svelte.js';
  import ChoixSports from '../components/ChoixSports.svelte';
  import { SPORTS, couleurSport } from '../sports.js';
  import { menu, chargerMenu } from '../stores/menu.svelte.js';
  import { sportsCoches } from '../data/sports-choisis.js';
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
      choix = sportsCoches(sportsChoisis.liste, menu.familles); // les sports de la barre sont cochés, y compris ceux que les séances révèlent
      disciplines = JSON.parse(JSON.stringify(sportsChoisis.disciplines || {}));
    });
  });
  // Ordre d'affichage : la barre des sports suit l'ordre de cette liste (on la règle avec ↑ ↓, puis « Enregistrer mes sports »)
  function deplacerSport(i, sens) {
    const j = i + sens;
    if (j < 0 || j >= choix.length) return;
    const copie = [...choix];
    [copie[i], copie[j]] = [copie[j], copie[i]];
    choix = copie;
  }
  async function enregistrerSports() {
    if (sportsEnCours) return;
    sportsEnCours = true;
    sportsMessage = '';
    const r = await enregistrerSportsChoisis(uid, choix, disciplines);
    sportsEnCours = false;
    if (uid !== 'demo') chargerMenu(uid); // le menu suit les sports choisis (Muscu, Hyrox)
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
    {#if choix.length > 1}
      <div class="ordre">
        <h3 class="titre-ordre titre">Ordre d'affichage</h3>
        <p class="aide">Dans la barre des sports, du premier au dernier. N'oublie pas d'enregistrer.</p>
        <ol class="liste-ordre">
          {#each choix as cle, i (cle)}
            <li>
              <span class="rang titre" aria-hidden="true">{i + 1}</span>
              <span class="point" style:background={couleurSport(cle)} aria-hidden="true"></span>
              <span class="nom-sport">{(SPORTS[cle] || SPORTS.autre).nom}</span>
              <button type="button" aria-label="Monter {(SPORTS[cle] || SPORTS.autre).nom}" disabled={i === 0 || sportsEnCours} onclick={() => deplacerSport(i, -1)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 15l-6-6-6 6" /></svg>
              </button>
              <button type="button" aria-label="Descendre {(SPORTS[cle] || SPORTS.autre).nom}" disabled={i === choix.length - 1 || sportsEnCours} onclick={() => deplacerSport(i, 1)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </button>
            </li>
          {/each}
        </ol>
      </div>
    {/if}
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
  .ordre {
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid var(--trait);
  }
  .titre-ordre {
    margin: 0 0 4px;
    font-size: 17px;
  }
  .liste-ordre {
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }
  .liste-ordre li {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: var(--cible);
    border-top: 1px solid var(--trait);
  }
  .liste-ordre li:first-child {
    border-top: 0;
  }
  /* Le numéro de place (1, 2, 3…) : la liste est une <ol>, les lecteurs d'écran annoncent déjà la position */
  .rang {
    flex: none;
    width: 22px;
    font-size: 17px;
    line-height: 1;
    text-align: center;
    color: var(--texte-doux);
  }
  .liste-ordre .point {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }
  .nom-sport {
    flex: 1;
    min-width: 0;
    font-size: 15px;
    font-weight: 600;
  }
  .liste-ordre button {
    flex: none;
    width: var(--cible);
    height: var(--cible);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: none;
    color: var(--texte);
    cursor: pointer;
  }
  .liste-ordre button:disabled {
    opacity: 0.3;
    cursor: default;
  }
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
