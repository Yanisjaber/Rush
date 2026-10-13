<script>
  import FormulaireSection from '../components/FormulaireSection.svelte';
  import Bloc from '../components/Bloc.svelte';
  import Bouton from '../components/Bouton.svelte';
  import { auth, deconnexion, supprimerCompte } from '../stores/auth.svelte.js';
  import { exporterMesDonnees, telechargerJson } from '../data/export.js';
  import { profil, estSale, enregistrerSection } from '../stores/profil.svelte.js';
  import { SECTIONS, champsDe, calculerAge, avatarSur } from '../data/profil.js';

  // Onglet Général : identité et compte.
  let { demo = false, userId } = $props();

  const section = SECTIONS.find((s) => s.id === 'identite');
  const email = $derived(demo ? 'Compte de démonstration' : auth.session?.user?.email || '');
  const age = $derived(calculerAge(profil.valeurs.identite?.birth_date));
  const aides = $derived(age != null ? { birth_date: { texte: `${age} ans` } } : {});
  const avatar = $derived(profil.ligne?.extras?.avatar_url);

  // Remplissage : champs renseignés / champs proposés (identité + physiologie)
  const remplissage = $derived.by(() => {
    let total = 0;
    let remplis = 0;
    for (const s of SECTIONS) {
      for (const c of champsDe(s)) {
        if (c.type === 'case') continue;
        total++;
        if (String(profil.valeurs[s.id]?.[c.cle] ?? '').trim() !== '') remplis++;
      }
    }
    return total ? Math.round((remplis / total) * 100) : 0;
  });

  // --- Données : export et suppression du compte ---
  let export_ = $state({ enCours: false, message: '' });
  async function exporter() {
    if (export_.enCours) return;
    export_ = { enCours: true, message: '' };
    const r = await exporterMesDonnees(auth.session?.user?.id, auth.session?.user?.email || '');
    telechargerJson(r.contenu, `coach-ia-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`);
    export_ = {
      enCours: false,
      message: r.avertissements.length ? `Fichier téléchargé. Ces parties n'ont pas pu être lues : ${r.avertissements.join(', ')}.` : 'Fichier téléchargé.',
    };
  }
  let suppression = $state({ ouvert: false, texte: '', enCours: false, message: '' });
  async function supprimer(e) {
    e.preventDefault();
    if (suppression.enCours) return;
    suppression.enCours = true;
    suppression.message = '';
    const r = await supprimerCompte(suppression.texte.trim());
    suppression.enCours = false;
    if (!r.ok) suppression.message = r.message;
    // En cas de succès, la session est fermée : l'app affiche l'écran de connexion toute seule.
  }
</script>

<div class="onglet">
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
      <p class="remplissage"><span class="jauge" aria-hidden="true"><span style:width="{remplissage}%"></span></span>Profil rempli à {remplissage} %</p>
      {#if avatarSur(avatar)}<img class="avatar" src={avatar} alt="Ton avatar" width="72" height="72" />{/if}
    {/snippet}
  </FormulaireSection>

  <Bloc titre="Compte">
    <dl class="compte">
      <dt>Connecté en tant que</dt>
      <dd>{email}</dd>
    </dl>
    {#if demo}
      <Bouton variante="discret" href="./">Se connecter</Bouton>
    {:else}
      <div class="actions-compte">
        <Bouton variante="discret" href="#/mot-de-passe">Changer mon mot de passe</Bouton>
        <Bouton variante="discret" onclick={deconnexion}>Se déconnecter</Bouton>
      </div>
    {/if}
  </Bloc>

  {#if !demo}
    <Bloc titre="Mes données">
      <p class="aide">Tes données restent privées. Tu peux les récupérer ou tout supprimer quand tu veux. <a href="#/parametres/confidentialite">Lire la page Confidentialité</a>.</p>
      <div class="actions-compte">
        <Bouton variante="discret" onclick={exporter}>{export_.enCours ? 'Préparation…' : 'Exporter mes données'}</Bouton>
      </div>
      {#if export_.message}<p class="retour" role="status">{export_.message}</p>{/if}

      <div class="zone-danger">
        {#if !suppression.ouvert}
          <Bouton variante="texte" onclick={() => (suppression.ouvert = true)}>Supprimer mon compte et mes données</Bouton>
        {:else}
          <form onsubmit={supprimer}>
            <p><strong>Action définitive.</strong> Ton compte, tes séances, ton sommeil, tes programmes, tes tests et tous tes réglages seront effacés, et l'accès de Coach IA à ton compte Strava sera retiré. Il n'y a aucun retour en arrière : pense à exporter tes données avant.</p>
            <label for="confirmer-suppression">Pour confirmer, tape <strong>SUPPRIMER</strong></label>
            <input id="confirmer-suppression" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" bind:value={suppression.texte} />
            {#if suppression.message}<p class="erreur" role="alert">{suppression.message}</p>{/if}
            <div class="actions-compte">
              <Bouton type="submit" variante="discret">{suppression.enCours ? 'Suppression…' : 'Supprimer définitivement'}</Bouton>
              <Bouton variante="texte" onclick={() => (suppression = { ouvert: false, texte: '', enCours: false, message: '' })}>Annuler</Bouton>
            </div>
          </form>
        {/if}
      </div>
    </Bloc>
  {/if}
</div>

<style>
  .aide {
    margin: 0 0 14px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .aide a {
    color: var(--texte);
  }
  .retour {
    margin: 10px 0 0;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .zone-danger {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--trait);
  }
  .zone-danger form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 14px;
    line-height: 1.5;
  }
  .zone-danger p {
    margin: 0;
  }
  .zone-danger input {
    box-sizing: border-box;
    width: 100%;
    height: 48px;
    padding: 0 14px;
    background: var(--fond);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    font-size: 16px;
  }
  .zone-danger input:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .erreur {
    color: var(--danger);
  }
  .actions-compte {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .onglet {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .remplissage {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: -6px 0 16px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .jauge {
    width: 120px;
    height: 8px;
    border-radius: 4px;
    background: var(--trait);
    overflow: hidden;
  }
  .jauge span {
    display: block;
    height: 100%;
    background: var(--texte);
  }
  .avatar {
    display: block;
    margin-bottom: 14px;
    border-radius: 50%;
    object-fit: cover;
  }
  .compte {
    margin-bottom: 16px;
  }
  .compte dt {
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-doux);
  }
  .compte dd {
    margin-top: 4px;
    font-size: 16px;
    word-break: break-all;
  }
</style>
