<script>
  import { onMount, onDestroy, untrack } from 'svelte';
  import { route, ouvrirPanneau, fermerPanneau } from '../routeur.svelte.js';
  import LogoApp from '../components/LogoApp.svelte';
  import PanneauLicence from '../components/PanneauLicence.svelte';
  import { palmares, initialiserPalmares, lierLicence, delierLicence } from '../stores/palmares.svelte.js';
  import { nomLicence } from '../data/opendossard.js';
  import Bouton from '../components/Bouton.svelte';
  import { auth } from '../stores/auth.svelte.js';
  import { retourStrava, effacerRetour } from '../stores/connexions.svelte.js';
  import {
    chargerConnexions, preparerConnexionStrava, importerActivitesStrava, traiterStreamsStrava, deconnecterStrava,
  } from '../data/integrations.js';
  import { statutConnexion, detailStrava, detailGarmin, messageErreurOAuth, progressionStreams } from '../data/connexions.js';

  // Onglet Connexions : Strava (activités), Garmin (à venir : connexion officielle) et Open Dossard.
  // En démo, les états sont fictifs et aucun bouton ne contacte le serveur.
  let { demo = false } = $props();

  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);
  let etat = $state({ chargement: true, erreur: '', strava: null, nbActivites: 0, nbNuits: 0 });
  let infoStrava = $state(''); // message sous la carte Strava (réussite, limite…)
  let erreurStrava = $state('');
  let sync = $state({ actif: false, pct: 0, etiquette: '' }); // import Strava en cours
  let choixDeconnexion = $state(false); // panneau « déconnecter seulement / supprimer aussi »
  let confirmerEffacement = $state(false);
  let arret = new AbortController(); // coupe les attentes si on quitte l'onglet

  async function charger() {
    if (demo) {
      etat = {
        chargement: false, erreur: '', nbActivites: 969, nbNuits: 61,
        strava: { athlete_name: 'Yanis J.', last_sync_at: new Date(Date.now() - 2 * 3600e3).toISOString(), last_sync_status: 'ok' },
      };
      return;
    }
    if (!userId) return;
    const r = await chargerConnexions(userId);
    etat = r.erreur ? { ...etat, chargement: false, erreur: r.erreur } : { chargement: false, erreur: '', ...r.data };
  }

  async function recharger() {
    etat = { ...etat, chargement: true, erreur: '' };
    await charger();
  }

  let licence = $state({ ouvert: false });
  async function choisirLicence(l) {
    fermerPanneau('licence');
    await lierLicence(userId, l, demo);
  }

  // Le panneau de licence est dans l'adresse (?licence=1)
  $effect(() => {
    const ouvert = route.q.licence === '1';
    untrack(() => {
      if (licence.ouvert !== ouvert) licence.ouvert = ouvert;
    });
  });

  onMount(async () => {
    initialiserPalmares(userId, demo);
    await charger();
    // Retour de Strava après l'autorisation : on prévient, et on lance l'import si c'est une première connexion
    if (retourStrava.erreur) {
      erreurStrava = messageErreurOAuth(retourStrava.erreur);
      effacerRetour();
    } else if (retourStrava.connecte) {
      effacerRetour();
      // Lecture en échec : on ne lance pas un import dont on ne verrait pas l'avancement
      if (etat.erreur) infoStrava = 'Strava est connecté. Recharge les connexions, puis clique sur « Re-synchroniser ».';
      else if (etat.nbActivites > 0) infoStrava = 'Strava reconnecté : tes données sont déjà là.';
      else lancerImport();
    }
  });
  onDestroy(() => arret.abort());

  // --- Strava ---
  async function connecter() {
    erreurStrava = '';
    if (demo) return (erreurStrava = 'Désactivé en mode démo.');
    const r = await preparerConnexionStrava();
    if (r.erreur) return (erreurStrava = r.erreur);
    location.href = r.url; // l'utilisateur quitte l'app pour autoriser sur strava.com, puis revient
  }

  async function lancerImport() {
    if (sync.actif) return;
    erreurStrava = '';
    infoStrava = '';
    if (demo) return (erreurStrava = 'Désactivé en mode démo.');
    sync = { actif: true, pct: 2, etiquette: 'Import des activités…' };
    // L'import des activités est un seul appel (~30 s) sans avancement : on anime une progression régulière plafonnée à 25 %
    const debut = Date.now();
    const minuteur = setInterval(() => (sync.pct = Math.max(sync.pct, Math.min(25, Math.round(((Date.now() - debut) / 30000) * 25)))), 300);
    try {
      const a = await importerActivitesStrava(arret.signal);
      clearInterval(minuteur);
      if (a.abandon) return (sync = { actif: false, pct: 0, etiquette: '' });
      if (a.aucuneConnexion) {
        sync = { actif: false, pct: 0, etiquette: '' };
        return (erreurStrava = "Aucun compte Strava n'est lié. Utilise « Connecter Strava ».");
      }
      if (a.erreur) {
        sync = { actif: false, pct: 0, etiquette: '' };
        return (erreurStrava = a.erreur);
      }
      sync = { actif: true, pct: 28, etiquette: `${a.importees} activités importées` };
      const s = await traiterStreamsStrava(userId, (traitees, total) => {
        const p = progressionStreams(total, total - traitees);
        sync = { actif: true, pct: p.pct, etiquette: `Courbes et records : ${p.traitees} / ${total} activités` };
      }, arret.signal);
      sync = { actif: false, pct: 0, etiquette: '' };
      if (s.erreur) erreurStrava = s.erreur;
      else if (s.limite) infoStrava = 'Limite Strava atteinte : la suite sera traitée à la prochaine synchro.';
      else if (s.fini) infoStrava = 'Synchronisation terminée.';
    } catch (_e) {
      // Panne imprévue : la synchro ne doit jamais rester affichée « en cours »
      erreurStrava = 'La synchronisation a été interrompue. Réessaie dans un instant.';
    } finally {
      clearInterval(minuteur);
      sync = { actif: false, pct: 0, etiquette: '' };
    }
    await charger();
  }

  async function deconnecter(effacer) {
    erreurStrava = '';
    if (demo) return (erreurStrava = 'Désactivé en mode démo.');
    const r = await deconnecterStrava(effacer);
    choixDeconnexion = false;
    confirmerEffacement = false;
    if (!r.ok) return (erreurStrava = r.erreur);
    infoStrava = effacer ? 'Strava déconnecté et données supprimées.' : 'Strava déconnecté. Tes données sont conservées.';
    await charger();
  }


  const statutS = $derived(statutConnexion(etat.strava));
</script>

<div class="onglet">
  {#if etat.chargement}
    <p class="info" role="status">Chargement des connexions…</p>
  {:else}
  <div class="grille">
    <article class="case">
      <div class="logo strava"><LogoApp app="strava" /></div>
      <div class="corps">
      <div class="entete-carte">
        <h2 class="titre">Strava</h2>
        {#if !etat.erreur}<span class="pastille {statutS.cle}">{statutS.texte}</span>{/if}
      </div>
      {#if etat.erreur}
        <!-- La lecture a échoué : on ne sait pas si Strava est connecté, on ne l'affirme pas. Les autres cartes restent utilisables. -->
        <p class="erreur" role="alert">{etat.erreur}</p>
        <div class="actions"><Bouton onclick={recharger}>Réessayer</Bouton></div>
      {:else}
      <p class="detail">{detailStrava(etat.strava, etat.nbActivites)}</p>

      {#if sync.actif}
        <div class="progression" role="status" aria-live="polite">
          <div class="ligne"><span>{sync.etiquette}</span><strong>{sync.pct} %</strong></div>
          <div class="piste" aria-hidden="true"><span style:width="{sync.pct}%"></span></div>
          <p class="aide">Reste sur cette page jusqu'à la fin : si tu la quittes, la synchro s'arrête et reprendra là où elle s'est arrêtée.</p>
        </div>
      {:else if choixDeconnexion}
        <div class="choix">
          <p><strong>Déconnecter Strava</strong></p>
          {#if confirmerEffacement}
            <p class="alerte-texte">Action irréversible : toutes tes activités, ta charge et tes records seront supprimés. Tu devras tout re-télécharger.</p>
            <div class="actions">
              <Bouton variante="discret" onclick={() => deconnecter(true)}>Oui, tout supprimer</Bouton>
              <Bouton variante="texte" onclick={() => (confirmerEffacement = false)}>Non, retour</Bouton>
            </div>
          {:else}
            <div class="options">
              <button type="button" onclick={() => deconnecter(false)}>
                <strong>Déconnecter seulement</strong>
                <span>Coupe la synchro mais garde tes données déjà importées. Tu pourras reconnecter sans tout re-télécharger.</span>
              </button>
              <button type="button" class="danger" onclick={() => (confirmerEffacement = true)}>
                <strong>Déconnecter et supprimer les données</strong>
                <span>Coupe la synchro et efface définitivement tes données Strava.</span>
              </button>
            </div>
            <Bouton variante="texte" onclick={() => (choixDeconnexion = false)}>Annuler</Bouton>
          {/if}
        </div>
      {:else}
        <div class="actions">
          {#if etat.strava}
            <Bouton onclick={lancerImport}>Re-synchroniser</Bouton>
            {#if statutS.cle === 'erreur'}<Bouton variante="discret" onclick={connecter}>Reconnecter</Bouton>{/if}
            <Bouton variante="texte" onclick={() => (choixDeconnexion = true)}>Déconnecter</Bouton>
          {:else}
            <!-- Bouton officiel de la charte Strava : fichier fourni par Strava, jamais modifié (48 px de haut) -->
            <button type="button" class="btn-strava" onclick={connecter} aria-label="Connecter Strava">
              <img src="{import.meta.env.BASE_URL}strava/btn_strava_connect_with_orange.svg" alt="Connect with Strava" width="237" height="48" />
            </button>
          {/if}
        </div>
      {/if}
      {/if}

      {#if erreurStrava}<p class="erreur" role="alert">{erreurStrava}</p>{/if}
      {#if infoStrava}<p class="succes" role="status">{infoStrava}</p>{/if}
      <!-- Mention de la charte Strava : logo officiel, petit, séparé du nom de l'app -->
      <!-- blanc sur le thème sombre, orange (texte noir) sur le thème clair -->
      <img class="powered sombre" src="{import.meta.env.BASE_URL}strava/api_logo_pwrdBy_strava_horiz_white.svg" alt="Powered by Strava" width="146" height="15" />
      <img class="powered clair" src="{import.meta.env.BASE_URL}strava/api_logo_pwrdBy_strava_horiz_orange.svg" alt="Powered by Strava" width="146" height="15" />
      </div>
    </article>

    <article class="case">
      <div class="logo garmin"><LogoApp app="garmin" /></div>
      <div class="corps">
      <div class="entete-carte">
        <h2 class="titre">Garmin</h2>
        <span class="pastille bientot">Bientôt disponible</span>
      </div>
      <p class="detail">{detailGarmin(etat.nbNuits)}</p>
      </div>
    </article>

    <article class="case">
      <div class="logo import" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" /></svg>
      </div>
      <div class="corps">
        <div class="entete-carte">
          <h2 class="titre">Hevy</h2>
          <span class="pastille bientot">Import par fichier</span>
        </div>
        <p class="detail">Importe tes séances de musculation depuis l'export CSV de Hevy : séries, charges et répétitions, sans doublon avec Strava.</p>
        <div class="actions">
          <Bouton onclick={() => ouvrirPanneau({ hevy: '1' })}>Importer un export Hevy</Bouton>
        </div>
      </div>
    </article>

    <article class="case">
      <div class="logo opendossard"><LogoApp app="opendossard" /></div>
      <div class="corps">
        <div class="entete-carte">
          <h2 class="titre">Open Dossard</h2>
          <span class="pastille {palmares.licence ? 'ok' : 'non'}">{palmares.licence ? 'Connecté' : 'Non connecté'}</span>
        </div>
        <p class="detail">
          {#if palmares.licence}{nomLicence(palmares.licence)}{palmares.licence.numero ? ` · N° ${palmares.licence.numero}` : ''}{palmares.licence.club ? ` · ${palmares.licence.club}` : ''} · {palmares.officiels.length} résultat{palmares.officiels.length > 1 ? 's' : ''}
          {:else}Importe ton palmarès et tes résultats officiels (FSGT, UFOLEP…).{/if}
        </p>
        <div class="actions">
          {#if palmares.licence}
            <Bouton variante="discret" onclick={() => ouvrirPanneau({ licence: '1' })}>Changer de licence</Bouton>
            <Bouton variante="texte" onclick={() => delierLicence(userId)}>Délier</Bouton>
          {:else}
            <Bouton onclick={() => ouvrirPanneau({ licence: '1' })}>Lier ma licence</Bouton>
          {/if}
        </div>
        {#if palmares.erreur}<p class="erreur" role="alert">{palmares.erreur}</p>{/if}
      </div>
    </article>
  </div>

    <PanneauLicence ouvert={licence.ouvert} {demo} onfermer={() => fermerPanneau('licence')} onchoisir={choisirLicence} />

    <p class="pied">Tes jetons d'accès restent stockés côté serveur et ne sont jamais affichés ici.</p>
  {/if}
</div>

<style>
  .onglet {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .info {
    color: var(--texte-doux);
  }
  .alerte {
    padding: 10px 14px;
    border: 1px solid var(--danger);
    border-radius: var(--rayon-l);
    background: var(--surface);
    font-size: 14px;
  }
  .grille {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
    gap: 16px;
    align-items: start;
  }
  .case {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface);
    border-radius: var(--rayon);
  }
  /* Le logo de l'app occupe le haut de la case, sur la couleur de sa marque */
  .logo {
    display: grid;
    place-items: center;
    height: 132px;
  }
  .logo.strava {
    background: #fc4c02;
    color: #fff;
  }
  .logo.garmin {
    background: #f3f2ee; /* fond clair fixe : le logo Garmin est noir, il doit rester lisible en thème clair comme en sombre */
    color: #000;
  }
  .logo.import {
    background: var(--surface-2);
    color: var(--texte);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .logo.opendossard {
    background: var(--surface-2);
    color: var(--texte-doux);
  }
  .btn-strava {
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: none;
    cursor: pointer;
    line-height: 0; /* pas d'espace autour de l'image : le bouton garde ses 48 px */
  }
  .btn-strava:focus-visible {
    outline: 3px solid var(--texte);
    outline-offset: 3px;
  }
  .btn-strava img {
    display: block;
  }
  .powered {
    display: block;
    margin-top: 18px;
    height: 15px;
    width: auto;
  }
  .powered.clair {
    display: none;
  }
  :global(:root[data-theme='light']) .powered.sombre {
    display: none;
  }
  :global(:root[data-theme='light']) .powered.clair {
    display: block;
  }
  .corps {
    padding: 20px 22px 24px;
  }
  .entete-carte {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 12px;
    margin-bottom: 8px;
  }
  .entete-carte h2 {
    font-size: 24px;
  }
  .pastille {
    display: inline-block;
    padding: 4px 12px;
    border: 1px solid var(--trait-fort);
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    color: var(--texte-doux);
  }
  .pastille.bientot {
    color: var(--texte-doux);
  }
  .pastille.ok {
    color: var(--ok);
    border-color: currentColor;
  }
  .pastille.erreur {
    color: var(--danger);
    border-color: currentColor;
  }
  .detail {
    margin-bottom: 16px;
    font-size: 15px;
    color: var(--texte-doux);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .progression {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ligne {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 14px;
  }
  .piste {
    height: 8px;
    border-radius: 4px;
    background: var(--trait);
    overflow: hidden;
  }
  .piste span {
    display: block;
    height: 100%;
    background: var(--texte);
    transition: width 0.3s;
  }
  .aide,
  .pied {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .choix {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    background: var(--surface-2);
  }
  .options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 10px;
  }
  .options button {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 44px;
    padding: 12px 14px;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    background: var(--fond);
    color: var(--texte);
    text-align: left;
    cursor: pointer;
  }
  .options button.danger {
    border-color: var(--danger);
  }
  .options span {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .alerte-texte {
    font-size: 14px;
    color: var(--danger);
  }
  .erreur {
    margin-top: 12px;
    font-size: 14px;
    color: var(--danger);
  }
  .succes {
    margin-top: 12px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  button:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
</style>
