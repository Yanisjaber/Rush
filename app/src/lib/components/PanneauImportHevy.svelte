<script>
  import Panneau from './Panneau.svelte';
  import Bouton from './Bouton.svelte';
  import { route, fermerPanneau } from '../routeur.svelte.js';
  import { auth } from '../stores/auth.svelte.js';
  import { rafraichir } from '../stores/edition.svelte.js';
  import { lireExportHevy, resumerPlan, LIMITE_OCTETS } from '../data/hevy.js';
  import { preparerImport, lancerImport } from '../data/hevy-import.js';
  import { formatDateCourte } from '../utils/format.js';

  // Importer un export CSV de Hevy : 1) choisir le fichier, 2) vérifier l'aperçu, 3) importer, 4) voir le bilan.
  // Le fichier est lu dans ton navigateur : il n'est envoyé nulle part, seules les séances et séries retenues sont enregistrées dans TON compte.
  // L'ouverture est dans l'adresse (?hevy=1).
  let { demo = false } = $props();

  const ouvert = $derived(route.q.hevy === '1');
  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);

  let etape = $state('choix'); // 'choix' | 'apercu' | 'import' | 'fin'
  let nomFichier = $state('');
  let erreur = $state('');
  let occupe = $state(false);
  let analyse = $state(null);
  let plan = $state([]);
  let resume = $state(null);
  let progres = $state({ fait: 0, total: 0 });
  let bilan = $state(null);
  let annule = false;

  // À chaque ouverture : on repart de zéro
  $effect(() => {
    if (!ouvert) return;
    etape = 'choix';
    nomFichier = '';
    erreur = '';
    occupe = false;
    analyse = null;
    plan = [];
    resume = null;
    bilan = null;
    annule = false;
  });

  async function choisirFichier(e) {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = ''; // permet de rechoisir le même fichier
    if (!f) return;
    erreur = '';
    if (f.size > LIMITE_OCTETS) return (erreur = 'Le fichier est trop gros (5 Mo au plus). Un export Hevy est bien plus léger : est-ce le bon fichier ?');
    if (!/\.csv$/i.test(f.name) && f.type !== 'text/csv') return (erreur = 'Choisis le fichier .csv exporté depuis Hevy.');
    occupe = true;
    nomFichier = f.name.slice(0, 80);
    try {
      const texte = await f.text();
      const r = lireExportHevy(texte);
      if (r.erreur) return (erreur = r.erreur);
      const p = await preparerImport({ userId: userId, demo, seances: r.seances });
      if (p.erreur) return (erreur = p.erreur);
      analyse = r;
      plan = p.plan;
      resume = resumerPlan(p.plan);
      etape = 'apercu';
    } catch (err) {
      erreur = 'Impossible de lire ce fichier.';
    } finally {
      occupe = false;
    }
  }

  async function importer() {
    if (occupe || !resume || resume.creer + resume.attacher === 0) return;
    occupe = true;
    annule = false;
    etape = 'import';
    progres = { fait: 0, total: resume.creer + resume.attacher };
    bilan = await lancerImport({ userId, demo, plan, progres: (fait, total) => (progres = { fait, total }), annule: () => annule });
    occupe = false;
    etape = 'fin';
    rafraichir(); // les pages (journal, widgets) se rechargent
  }

  const inconnus = $derived.by(() => {
    const noms = new Map();
    for (const p of plan) if (p.action !== 'deja') for (const e of p.seance.exercices) if (!e.reconnu) noms.set(e.cle, e.nom);
    return [...noms.values()];
  });
  const date = (iso) => formatDateCourte(iso) + ' ' + iso.slice(0, 4);
  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
</script>

<Panneau {ouvert} titre="Importer mes séances Hevy" grand onfermer={() => (occupe ? null : fermerPanneau('hevy'))}>
  {#if etape === 'choix'}
    <p class="intro">Dans Hevy : <strong>Paramètres → Exporter les données</strong> (sur le site hevy.com ou dans l'app). Tu reçois un fichier <code>.csv</code> avec toutes tes séances. Choisis-le ici.</p>
    <ul class="points">
      <li>Le fichier est lu dans ton navigateur, il n'est envoyé nulle part.</li>
      <li>Les échauffements ne sont pas comptés (comme dans Hevy). Le poids du corps compte pour 0 kg.</li>
      <li>Une séance déjà synchronisée par Strava reçoit ses séries (pas de doublon). Réimporter le même fichier ne duplique rien.</li>
    </ul>
    <label class="fichier">
      <span class="bouton-fichier">{occupe ? 'Lecture…' : 'Choisir le fichier CSV'}</span>
      <input type="file" accept=".csv,text/csv" onchange={choisirFichier} disabled={occupe} />
    </label>
    {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
  {:else if etape === 'apercu' && resume}
    <p class="intro"><strong>{nomFichier}</strong> : {pluriel(resume.total, 'séance')} du {date(resume.du)} au {date(resume.au)}.</p>
    <dl class="chiffres">
      <div><dt>Nouvelles séances</dt><dd>{resume.creer}</dd></div>
      <div><dt>Rattachées à Strava</dt><dd>{resume.attacher}</dd></div>
      <div><dt>Déjà importées</dt><dd>{resume.deja}</dd></div>
      <div><dt>Séries à enregistrer</dt><dd>{resume.series}</dd></div>
    </dl>
    <p class="detail">{pluriel(resume.exercices, 'exercice')} dont {resume.reconnus} reconnus dans ta bibliothèque.</p>
    {#if inconnus.length}
      <details class="inconnus">
        <summary>{pluriel(inconnus.length, 'exercice')} ajouté{inconnus.length > 1 ? 's' : ''} tel{inconnus.length > 1 ? 's' : ''} quel{inconnus.length > 1 ? 's' : ''}</summary>
        <p>Pas dans la bibliothèque de l'app : ils sont gardés avec leur nom Hevy et un groupe musculaire deviné.</p>
        <ul>{#each inconnus.slice(0, 25) as n (n)}<li>{n}</li>{/each}{#if inconnus.length > 25}<li>… et {inconnus.length - 25} autres</li>{/if}</ul>
      </details>
    {/if}
    {#if analyse}
      {@const ig = analyse.ignorees}
      {#if ig.echauffement || ig.sansRepetitions || ig.horsLimites || ig.dateInvalide || ig.seancesSansSerie}
        <p class="ignorees">
          Non importé :
          {[ig.echauffement && `${ig.echauffement} série${ig.echauffement > 1 ? 's' : ''} d'échauffement`, ig.sansRepetitions && `${ig.sansRepetitions} sans répétitions (gainage, cardio…)`, ig.horsLimites && `${ig.horsLimites} hors limites`, ig.dateInvalide && `${ig.dateInvalide} ligne${ig.dateInvalide > 1 ? 's' : ''} à la date illisible`, ig.seancesSansSerie && `${ig.seancesSansSerie} séance${ig.seancesSansSerie > 1 ? 's' : ''} sans série`].filter(Boolean).join(' · ')}.
        </p>
      {/if}
    {/if}
    <div class="actions">
      <Bouton onclick={importer} disabled={resume.creer + resume.attacher === 0}>
        {resume.creer + resume.attacher === 0 ? 'Rien de nouveau à importer' : `Importer ${pluriel(resume.creer + resume.attacher, 'séance')}`}
      </Bouton>
      <Bouton variante="discret" onclick={() => (etape = 'choix')}>Changer de fichier</Bouton>
    </div>
  {:else if etape === 'import'}
    <p class="intro">Import en cours… ne ferme pas cette fenêtre.</p>
    <progress max={progres.total || 1} value={progres.fait} aria-label="Avancement de l'import"></progress>
    <p class="detail" role="status">{progres.fait} / {progres.total} séances</p>
    <div class="actions"><Bouton variante="discret" onclick={() => (annule = true)}>Arrêter après la séance en cours</Bouton></div>
  {:else if etape === 'fin' && bilan}
    <p class="intro" role="status">
      {#if bilan.creees + bilan.rattachees > 0}C'est fait : {pluriel(bilan.creees, 'séance')} créée{bilan.creees > 1 ? 's' : ''}{bilan.rattachees ? `, ${pluriel(bilan.rattachees, 'séance')} Strava enrichie${bilan.rattachees > 1 ? 's' : ''} de leurs séries` : ''}.{:else}Aucune séance n'a été importée.{/if}
    </p>
    {#if bilan.echecs.length}
      <p class="erreur" role="alert">{pluriel(bilan.echecs.length, 'séance')} n'ont pas pu être enregistrée{bilan.echecs.length > 1 ? 's' : ''} (tu peux relancer l'import : ce qui est déjà fait ne sera pas refait) :</p>
      <ul class="liste-echecs">{#each bilan.echecs.slice(0, 8) as e, i (i)}<li>{e.titre} · {date(e.date)}</li>{/each}</ul>
    {/if}
    <div class="actions">
      <Bouton href="#/muscu/journal" onclick={() => fermerPanneau('hevy')}>Voir mon journal Muscu</Bouton>
      <Bouton variante="discret" onclick={() => fermerPanneau('hevy')}>Fermer</Bouton>
    </div>
  {/if}
</Panneau>

<style>
  .intro {
    margin: 0 0 14px;
    font-size: 15px;
    line-height: 1.55;
  }
  .points {
    margin: 0 0 18px;
    padding-left: 18px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--texte-doux);
  }
  code {
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--surface-2);
    font-size: 13px;
  }
  .fichier {
    display: inline-block;
    cursor: pointer;
  }
  .fichier input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  .fichier:focus-within .bouton-fichier {
    outline: 3px solid var(--texte);
    outline-offset: 2px;
  }
  .bouton-fichier {
    display: inline-flex;
    align-items: center;
    min-height: var(--cible);
    padding: 0 22px;
    border-radius: var(--rayon-rond);
    background: var(--texte);
    color: var(--fond);
    font-weight: 600;
  }
  .erreur {
    margin-top: 14px;
    padding: 10px 14px;
    border: 1px solid var(--danger);
    border-radius: var(--rayon);
    font-size: 14px;
  }
  .chiffres {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 10px;
    margin: 0 0 14px;
  }
  .chiffres div {
    padding: 12px 14px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon);
  }
  .chiffres dt {
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-doux);
  }
  .chiffres dd {
    margin: 4px 0 0;
    font-family: var(--police-titre, inherit);
    font-size: 28px;
    font-weight: 700;
  }
  .detail,
  .ignorees {
    margin: 0 0 12px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .inconnus {
    margin: 0 0 12px;
    font-size: 14px;
  }
  .inconnus summary {
    min-height: 32px;
    cursor: pointer;
    font-weight: 600;
  }
  .inconnus p {
    margin: 6px 0;
    color: var(--texte-doux);
  }
  .inconnus ul,
  .liste-echecs {
    margin: 6px 0 0;
    padding-left: 18px;
    font-size: 13px;
    color: var(--texte-doux);
    columns: 2;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 18px;
  }
  progress {
    width: 100%;
    height: 10px;
    accent-color: var(--ok);
  }
</style>
