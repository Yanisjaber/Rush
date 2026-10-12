<script>
  import { untrack } from 'svelte';
  import EnTete from '../lib/components/EnTete.svelte';
  import FormulaireSection from '../lib/components/FormulaireSection.svelte';
  import TableauZones from '../lib/components/TableauZones.svelte';
  import { auth } from '../lib/stores/auth.svelte.js';
  import { chargerProfilComplet, chargerPuissance, enregistrerProfil } from '../lib/data/api.js';
  import { donneesDemo } from '../lib/data/demo.js';
  import {
    SECTIONS, champsDe, valeursDepuis, validerSection, versPayload, estimerFtp, estimerLthr, wattsParKg, calculerAge, avatarSur,
  } from '../lib/data/profil.js';

  let { demo = false } = $props();

  // Sections éditables (les zones sont affichées à part : elles sont calculées, pas saisies)
  const ORDRE = ['identite', 'physiologie', 'zones'];
  const TITRES = { identite: 'Identité', physiologie: 'Physiologie', zones: 'Zones' };

  let etat = $state({ chargement: true, erreur: '' });
  let ligne = $state(null); // ligne user_profiles telle qu'enregistrée (colonnes + extras)
  let courbe = $state([]); // courbe de puissance mesurée (sert à estimer la FTP)
  let valeurs = $state({}); // { idSection: { cle: valeur } } : ce qui est tapé dans les formulaires
  let initial = $state({}); // { idSection: JSON } : valeurs au dernier enregistrement (pour savoir ce qui a changé)
  let erreurs = $state({});
  let envoi = $state({});
  let messages = $state({});
  let erreursGlobales = $state({});

  function initialiser(l) {
    ligne = l;
    for (const s of SECTIONS) {
      valeurs[s.id] = valeursDepuis(l, s);
      initial[s.id] = JSON.stringify(valeurs[s.id]);
    }
  }

  async function charger(userId) {
    if (demo) {
      const d = donneesDemo();
      initialiser({ ...d.profil, extras: {} });
      courbe = d.puissance;
      etat = { chargement: false, erreur: '' };
      return;
    }
    if (!userId) return;
    const [p, c] = await Promise.all([chargerProfilComplet(userId), chargerPuissance(userId)]);
    courbe = c.data || [];
    if (p.erreur) etat = { chargement: false, erreur: p.erreur };
    else {
      initialiser(p.data || { extras: {} });
      etat = { chargement: false, erreur: '' };
    }
  }
  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);
  $effect(() => {
    const u = userId;
    untrack(() => charger(u));
  });

  const sale = (id) => initial[id] !== undefined && JSON.stringify(valeurs[id]) !== initial[id];

  async function enregistrer(section) {
    const id = section.id;
    messages[id] = '';
    erreursGlobales[id] = '';
    const { propres, erreurs: e } = validerSection(section, valeurs[id]);
    erreurs[id] = e;
    if (Object.keys(e).length) return;
    envoi[id] = true;
    const { colonnes, extras } = versPayload(section, propres, ligne?.extras);
    let r;
    if (demo) r = { data: { ...ligne, ...colonnes, extras }, erreur: '' };
    else r = await enregistrerProfil(userId, colonnes, extras);
    envoi[id] = false;
    if (r.erreur) {
      erreursGlobales[id] = r.erreur;
      return;
    }
    // Les valeurs relues de la base deviennent la référence : « Enregistré », plus de modifications en attente
    ligne = r.data;
    valeurs[id] = valeursDepuis(ligne, section);
    initial[id] = JSON.stringify(valeurs[id]);
    messages[id] = 'Enregistré.';
  }

  // --- Aides et valeurs dérivées ---
  const nombre = (v) => Number(String(v ?? '').replace(',', '.')) || 0;
  const ftp = $derived(nombre(valeurs.physiologie?.ftp));
  const lthr = $derived(nombre(valeurs.physiologie?.lthr));
  const vitesseSeuil = $derived(nombre(valeurs.physiologie?.threshold_speed));
  const ftpEstimee = $derived(estimerFtp(courbe));
  const lthrEstimee = $derived(estimerLthr(valeurs.physiologie?.hr_max));
  const wkg = $derived(wattsParKg(ftp, valeurs.identite?.weight));
  const age = $derived(calculerAge(valeurs.identite?.birth_date));
  const avatar = $derived(ligne?.extras?.avatar_url);

  const aidesIdentite = $derived({
    ...(age != null ? { birth_date: { texte: `${age} ans` } } : {}),
  });
  const aidesPhysio = $derived({
    ...(!ftp && ftpEstimee ? { ftp: { texte: `Estimée à partir de tes sorties : ~${ftpEstimee} W.`, bouton: 'Utiliser', onbouton: () => (valeurs.physiologie.ftp = String(ftpEstimee)) } } : {}),
    ...(!lthr && lthrEstimee ? { lthr: { texte: `Estimée (92 % de ta FC max) : ~${lthrEstimee} bpm.`, bouton: 'Utiliser', onbouton: () => (valeurs.physiologie.lthr = String(lthrEstimee)) } } : {}),
  });
  const aides = $derived({ identite: aidesIdentite, physiologie: aidesPhysio });

  // Remplissage du profil : champs renseignés / champs proposés
  const remplissage = $derived.by(() => {
    let total = 0;
    let remplis = 0;
    for (const s of SECTIONS) {
      for (const c of champsDe(s)) {
        if (c.type === 'case') continue;
        total++;
        if (String(valeurs[s.id]?.[c.cle] ?? '').trim() !== '') remplis++;
      }
    }
    return total ? Math.round((remplis / total) * 100) : 0;
  });

  function aller(id) {
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
</script>

<div class="page">
  <EnTete actif="profil" {demo} />

  <header class="entete-page">
    <h1 class="titre">Mon profil</h1>
    {#if !etat.chargement && !etat.erreur}
      <p class="remplissage" aria-label="Profil rempli à {remplissage} %">
        <span class="jauge" aria-hidden="true"><span style:width="{remplissage}%"></span></span>
        Profil rempli à {remplissage} %
      </p>
    {/if}
  </header>

  {#if etat.chargement}
    <p class="info" role="status">Chargement du profil…</p>
  {:else if etat.erreur}
    <p class="alerte" role="alert">{etat.erreur}</p>
  {:else}
    <div class="disposition">
      <nav class="sommaire" aria-label="Sections du profil">
        {#each ORDRE as id (id)}
          <button type="button" onclick={() => aller(id)}>{TITRES[id]}</button>
        {/each}
      </nav>

      <div class="cartes">
        {#each SECTIONS as s (s.id)}
          <FormulaireSection
            section={s}
            bind:valeurs={valeurs[s.id]}
            erreurs={erreurs[s.id] || {}}
            sale={sale(s.id)}
            envoi={!!envoi[s.id]}
            message={messages[s.id] || ''}
            erreurGlobale={erreursGlobales[s.id] || ''}
            aides={aides[s.id] || {}}
            onenregistrer={() => enregistrer(s)}
          >
            {#snippet enTete()}
              {#if s.id === 'identite' && avatarSur(avatar)}
                <img class="avatar" src={avatar} alt="Ton avatar" width="72" height="72" />
              {/if}
              {#if s.id === 'physiologie' && wkg}
                <p class="derive"><strong>{String(wkg).replace('.', ',')}</strong> W/kg à ta FTP</p>
              {/if}
            {/snippet}
          </FormulaireSection>

          <!-- Les zones se placent juste après la physiologie : elles se recalculent en direct pendant la saisie -->
          {#if s.id === 'physiologie'}
            <section class="carte-zones" id="section-zones" aria-labelledby="titre-zones">
              <h2 class="titre" id="titre-zones">Zones d'entraînement</h2>
              <p class="intro">Calculées à partir de ta physiologie, en direct : modifie la FTP, la LTHR ou la vitesse seuil ci-dessus pour les voir bouger. Elles ne sont jamais enregistrées.</p>
              <div class="trois">
                <TableauZones modele="puissance" reference={ftp} />
                <TableauZones modele="cardio" reference={lthr} />
                <TableauZones modele="allure" reference={vitesseSeuil} />
              </div>
            </section>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .entete-page {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px 24px;
    margin-bottom: 16px;
  }
  h1 {
    font-size: clamp(32px, 6vw, 52px);
    line-height: 1.05;
  }
  .remplissage {
    display: flex;
    align-items: center;
    gap: 10px;
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
  .disposition {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }
  .sommaire {
    position: sticky;
    top: 16px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sommaire button {
    min-height: 44px;
    padding: 0 14px;
    border: 0;
    border-radius: var(--rayon);
    background: transparent;
    color: var(--texte-doux);
    font-size: 15px;
    text-align: left;
    cursor: pointer;
  }
  .sommaire button:hover {
    background: var(--surface);
    color: var(--texte);
  }
  .sommaire button:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .cartes {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }
  .carte-zones {
    scroll-margin-top: 16px;
    padding: 24px 26px;
    background: var(--surface);
    border-radius: var(--rayon);
  }
  .carte-zones h2 {
    font-size: 24px;
  }
  .intro {
    margin: 6px 0 18px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .trois {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 28px 24px;
  }
  .avatar {
    display: block;
    margin-bottom: 14px;
    border-radius: 50%;
    object-fit: cover;
  }
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
  @media (max-width: 900px) {
    .disposition {
      grid-template-columns: 1fr;
    }
    .sommaire {
      position: static;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 6px;
    }
    .sommaire button {
      border: 1px solid var(--trait-fort);
      border-radius: 999px;
    }
  }
</style>
