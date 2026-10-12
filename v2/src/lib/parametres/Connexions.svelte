<script>
  import { onMount, onDestroy } from 'svelte';
  import Bloc from '../components/Bloc.svelte';
  import Bouton from '../components/Bouton.svelte';
  import { auth } from '../stores/auth.svelte.js';
  import { retourStrava, effacerRetour } from '../stores/connexions.svelte.js';
  import {
    chargerConnexions, preparerConnexionStrava, importerActivitesStrava, traiterStreamsStrava, deconnecterStrava, synchroniserGarmin,
  } from '../data/integrations.js';
  import { statutConnexion, detailStrava, detailGarmin, messageErreurOAuth, progressionStreams } from '../data/connexions.js';

  // Onglet Connexions : Strava (activités) et Garmin (sommeil, via le Raspberry Pi).
  // En démo, les états sont fictifs et aucun bouton ne contacte le serveur.
  let { demo = false } = $props();

  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);
  let etat = $state({ chargement: true, erreur: '', strava: null, garmin: null, nbActivites: 0, nbNuits: 0 });
  let infoStrava = $state(''); // message sous la carte Strava (réussite, limite…)
  let erreurStrava = $state('');
  let sync = $state({ actif: false, pct: 0, etiquette: '' }); // import Strava en cours
  let choixDeconnexion = $state(false); // panneau « déconnecter seulement / supprimer aussi »
  let confirmerEffacement = $state(false);
  let garmin = $state({ actif: false, texte: '', erreur: false });
  let arret = new AbortController(); // coupe les attentes si on quitte l'onglet

  async function charger() {
    if (demo) {
      etat = {
        chargement: false, erreur: '', nbActivites: 969, nbNuits: 61,
        strava: { athlete_name: 'Yanis J.', last_sync_at: new Date(Date.now() - 2 * 3600e3).toISOString(), last_sync_status: 'ok' },
        garmin: { last_sync_at: new Date(Date.now() - 26 * 3600e3).toISOString(), last_sync_status: 'ok' },
      };
      return;
    }
    if (!userId) return;
    const r = await chargerConnexions(userId);
    etat = r.erreur ? { ...etat, chargement: false, erreur: r.erreur } : { chargement: false, erreur: '', ...r.data };
  }

  onMount(async () => {
    await charger();
    // Retour de Strava après l'autorisation : on prévient, et on lance l'import si c'est une première connexion
    if (retourStrava.erreur) {
      erreurStrava = messageErreurOAuth(retourStrava.erreur);
      effacerRetour();
    } else if (retourStrava.connecte) {
      effacerRetour();
      if (etat.nbActivites > 0) infoStrava = 'Strava reconnecté : tes données sont déjà là.';
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

  // --- Garmin ---
  async function synchroGarmin() {
    if (garmin.actif) return;
    if (demo) return (garmin = { actif: false, texte: 'Désactivé en mode démo.', erreur: true });
    garmin = { actif: true, texte: 'Demande envoyée…', erreur: false };
    const r = await synchroniserGarmin(userId, (e) => (garmin = { actif: true, texte: e.texte, erreur: false }), arret.signal);
    garmin = { actif: false, texte: r.ok ? `Sommeil synchronisé : ${r.nuits} nuit${r.nuits > 1 ? 's' : ''}.` : r.erreur, erreur: !r.ok && !!r.erreur };
    if (r.ok) await charger();
  }

  const statutS = $derived(statutConnexion(etat.strava));
  const statutG = $derived(statutConnexion(etat.garmin));
</script>

<div class="onglet">
  {#if etat.chargement}
    <p class="info" role="status">Chargement des connexions…</p>
  {:else if etat.erreur}
    <p class="alerte" role="alert">{etat.erreur}</p>
  {:else}
    <Bloc titre="Strava">
      <div class="entete-carte">
        <span class="pastille {statutS.cle}">{statutS.texte}</span>
      </div>
      <p class="detail">{detailStrava(etat.strava, etat.nbActivites)}</p>

      {#if sync.actif}
        <div class="progression" role="status" aria-live="polite">
          <div class="ligne"><span>{sync.etiquette}</span><strong>{sync.pct} %</strong></div>
          <div class="piste" aria-hidden="true"><span style:width="{sync.pct}%"></span></div>
          <p class="aide">Tu peux rester sur cette page : la synchro continue.</p>
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
            <Bouton onclick={connecter}>Connecter Strava</Bouton>
          {/if}
        </div>
      {/if}

      {#if erreurStrava}<p class="erreur" role="alert">{erreurStrava}</p>{/if}
      {#if infoStrava}<p class="succes" role="status">{infoStrava}</p>{/if}
    </Bloc>

    <Bloc titre="Garmin">
      <div class="entete-carte">
        <span class="pastille {statutG.cle}">{statutG.texte}</span>
      </div>
      <p class="detail">{detailGarmin(etat.garmin, etat.nbNuits)}</p>
      {#if etat.garmin}
        <div class="actions">
          <Bouton onclick={synchroGarmin}>{garmin.actif ? 'Synchro en cours…' : 'Synchroniser'}</Bouton>
        </div>
      {:else}
        <p class="aide">Garmin n'a pas de connexion publique : la synchro passe par ton Raspberry Pi. Voir <code>tools/garmin_auth.py</code> pour la configurer.</p>
      {/if}
      {#if garmin.texte}<p class={garmin.erreur ? 'erreur' : 'succes'} role="status" aria-live="polite">{garmin.texte}</p>{/if}
    </Bloc>

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
  .entete-carte {
    margin-bottom: 8px;
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
  .pastille.ok {
    color: var(--succes, #5fb87a);
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
  code {
    font-size: 12px;
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
