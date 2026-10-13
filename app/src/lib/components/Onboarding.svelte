<script>
  import ChoixSports from './ChoixSports.svelte';
  import Bouton from './Bouton.svelte';
  import { enregistrerSportsChoisis } from '../stores/sports.svelte.js';

  // Premier écran d'un compte neuf : on coche ses sports, l'accueil se compose ensuite tout seul.
  let { userId, onTermine } = $props();
  let selection = $state([]);
  let enCours = $state(false);
  let message = $state('');

  async function valider(liste) {
    if (enCours) return;
    enCours = true;
    message = '';
    await enregistrerSportsChoisis(userId, liste);
    enCours = false;
    onTermine?.();
  }
</script>

<section class="onboarding" aria-labelledby="titre-onboarding">
  <p class="sur-titre">Bienvenue sur Coach IA</p>
  <h1 id="titre-onboarding" class="titre">Quels sports pratiques-tu ?</h1>
  <p class="aide">
    Coche tout ce que tu pratiques : ton accueil se compose tout seul avec les bons widgets et les bons onglets.
    Triathlon ? Coche course, vélo et natation. Tu pourras changer ça quand tu veux dans Paramètres › Préférences.
  </p>
  <ChoixSports bind:selection desactive={enCours} />
  {#if message}<p class="erreur" role="alert">{message}</p>{/if}
  <div class="actions">
    <Bouton onclick={() => valider(selection)}>{enCours ? 'Enregistrement…' : selection.length ? 'Continuer' : 'Continuer sans choisir'}</Bouton>
    {#if selection.length}<Bouton variante="texte" onclick={() => valider([])}>Passer</Bouton>{/if}
  </div>
</section>

<style>
  .onboarding {
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-width: 760px;
    padding: 28px 0 40px;
  }
  .sur-titre {
    margin: 0;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--sport-course);
  }
  h1 {
    margin: 0;
    font-size: clamp(32px, 6vw, 48px);
    line-height: 1.05;
  }
  .aide {
    margin: 0;
    font-size: 16px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .erreur {
    margin: 0;
    color: var(--danger);
  }
</style>
