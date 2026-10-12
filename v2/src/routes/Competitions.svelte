<script>
  import { untrack } from 'svelte';
  import EnTete from '../lib/components/EnTete.svelte';
  import Bloc from '../lib/components/Bloc.svelte';
  import Bouton from '../lib/components/Bouton.svelte';
  import Dossard from '../lib/components/Dossard.svelte';
  import PanneauCompetition from '../lib/components/PanneauCompetition.svelte';
  import Palmares from '../lib/components/Palmares.svelte';
  import PanneauLicence from '../lib/components/PanneauLicence.svelte';
  import { palmares, initialiserPalmares, lierLicence } from '../lib/stores/palmares.svelte.js';
  import { fusionner, resultatsManuels, resultatDuJour, texteClassement, nomLicence } from '../lib/data/opendossard.js';
  import { auth } from '../lib/stores/auth.svelte.js';
  import { donnees } from '../lib/stores/edition.svelte.js';
  import { ouvrirApercu } from '../lib/stores/apercu.svelte.js';
  import { chargerCompetitions, chargerMetriques } from '../lib/data/api.js';
  import { competitionsDemo, donneesDemo } from '../lib/data/demo.js';
  import { repartir, prochainObjectif, prioriteDe, nomPriorite, phaseDepuis, NOM_PHASE, formeDepuisTsb, conseilPreparation } from '../lib/data/competitions.js';
  import { familleAffichage } from '../lib/data/familles.js';
  import { SPORTS, couleurSport } from '../lib/sports.js';
  import { formatDateLongue, formatDateCourte, formatKm, formatDuree, joursAvant, dateIsoLocale } from '../lib/utils/format.js';
  import { texteObjectif } from '../lib/data/competitions.js';

  let { demo = false } = $props();

  const aujourdhui = dateIsoLocale();
  let etat = $state({ chargement: true, erreur: '', prevues: [], courues: [], tsb: null });
  let panneau = $state({ ouvert: false, competition: null, date: aujourdhui });

  async function charger(userId) {
    if (demo) {
      const c = competitionsDemo();
      const m = donneesDemo().metriques;
      etat = { chargement: false, erreur: '', prevues: c.prevues, courues: c.courues, tsb: m.length ? m[m.length - 1].tsb : null };
      return;
    }
    if (!userId) return;
    const [c, m] = await Promise.all([chargerCompetitions(userId), chargerMetriques(userId, 30)]);
    const serie = m.data || [];
    etat = c.erreur
      ? { ...etat, chargement: false, erreur: c.erreur }
      : { chargement: false, erreur: '', prevues: c.data.prevues, courues: c.data.courues, tsb: serie.length ? serie[serie.length - 1].tsb : null };
  }
  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);
  // Palmarès Open Dossard (la licence est liée depuis ici ou depuis Paramètres > Connexions)
  $effect(() => {
    const u = userId;
    untrack(() => initialiserPalmares(u, demo));
  });
  let licence = $state({ ouvert: false });
  async function choisirLicence(l) {
    licence.ouvert = false;
    await lierLicence(userId, l, demo);
  }
  const resultats = $derived(fusionner(palmares.officiels, resultatsManuels(etat.courues)));
  $effect(() => {
    const u = userId;
    void donnees.version; // se recharge quand une sortie est créée, retouchée ou supprimée
    untrack(() => charger(u));
  });

  // À venir et passées. Les compétitions prévues dont la date est passée restent listées avec les passées (sans résultat).
  const reparties = $derived(repartir(etat.prevues, aujourdhui));
  const aVenir = $derived(reparties.aVenir);
  const passeesPrevues = $derived(reparties.passees);
  const prochain = $derived(prochainObjectif(aVenir));
  const jours = $derived(prochain ? joursAvant(prochain.date) : null);
  const phase = $derived(phaseDepuis(jours, etat.tsb));
  const forme = $derived(formeDepuisTsb(etat.tsb));
  const nomFamille = (sport) => (SPORTS[familleAffichage(sport)] || SPORTS.autre).court;

  const detailProchain = $derived(
    prochain ? `${formatDateLongue(prochain.date)}${prochain.km ? ` · ${formatKm(prochain.km, 2)} km` : ''}${prochain.duration ? ` · objectif ${texteObjectif(prochain.duration)}` : ''}` : '',
  );

  function nouvelle() {
    panneau = { ouvert: true, competition: null, date: aujourdhui };
  }
  function ouvrir(c) {
    panneau = { ouvert: true, competition: c, date: c.date };
  }
  function apresEnregistrement(ligne) {
    if (panneau.competition && panneau.competition.id === ligne.id) panneau.competition = ligne;
    etat.prevues = [...etat.prevues.filter((c) => c.id !== ligne.id), ligne];
    if (!demo) charger(userId);
  }
  function apresSuppression(id) {
    etat.prevues = etat.prevues.filter((c) => c.id !== id);
  }
</script>

<div class="page">
  <EnTete actif="competitions" {demo} />

  <header class="entete-page">
    <h1 class="titre">Compétitions</h1>
    <Bouton onclick={nouvelle}>Nouvelle compétition</Bouton>
  </header>

  {#if etat.chargement}
    <p class="info" role="status">Chargement…</p>
  {:else if etat.erreur}
    <p class="alerte" role="alert">{etat.erreur}</p>
  {:else}
    <div class="haut">
      <div class="dossard-cadre">
        {#if prochain}
          <Dossard etiquette={`Prochain objectif · ${nomPriorite(prochain.priority)}`} nom={prochain.name} valeur={jours === 0 ? 'J' : `J-${jours}`} detail={detailProchain} />
        {:else}
          <Dossard etiquette="Prochain objectif" nom="Aucune compétition prévue" valeur="—" detail="Ajoute une compétition pour voir ton compte à rebours." />
        {/if}
      </div>
      <Bloc titre="Où tu en es">
        {#if prochain}
          <dl class="prepa">
            <div><dt>Phase</dt><dd>{NOM_PHASE[phase]}</dd></div>
            <div><dt>Forme</dt><dd class="ton {forme.ton}">{forme.texte}{#if etat.tsb != null} <span class="tsb">(TSB {Math.round(etat.tsb)})</span>{/if}</dd></div>
          </dl>
          <p class="conseil">{conseilPreparation(phase, etat.tsb)}</p>
        {:else}
          <p class="conseil">Dès que tu auras une compétition à venir, tu verras ici ta phase de préparation et un conseil adapté à ta forme.</p>
        {/if}
      </Bloc>
    </div>

    {#if resultats.length}
      <div class="palmares"><Palmares {resultats} /></div>
    {:else if !palmares.licence}
      <Bloc titre="Mon palmarès">
        <p class="vide">Lie ta licence Open Dossard pour importer tes résultats officiels (victoires, podiums, saison par saison).</p>
        <Bouton variante="discret" onclick={() => (licence.ouvert = true)}>Lier ma licence</Bouton>
      </Bloc>
    {/if}
    {#if palmares.erreur}<p class="alerte" role="alert">{palmares.erreur}</p>{/if}

    <section aria-labelledby="titre-venir">
      <h2 class="titre" id="titre-venir">À venir</h2>
      {#if aVenir.length}
        <ul class="liste">
          {#each aVenir as c (c.id)}
            <li>
              <button type="button" class="ligne" onclick={() => ouvrir(c)}>
                <span class="date"><b>{new Date(c.date + 'T12:00:00').getDate()}</b><i>{formatDateCourte(c.date).replace(/^\d+\s*/, '')}</i></span>
                <span class="corps">
                  <span class="nom"><span class="sport-point" style:background={couleurSport(familleAffichage(c.sport))}></span>{c.name}</span>
                  <span class="sous">
                    {nomFamille(c.sport)}{#if c.km} · {formatKm(c.km, 2)} km{/if}{#if c.d_plus} · {c.d_plus} m D+{/if}{#if c.duration} · objectif {texteObjectif(c.duration)}{/if}
                  </span>
                </span>
                <span class="droite">
                  <span class="badge {prioriteDe(c.priority) === 'A' ? 'objectif' : 'prepa'}">{nomPriorite(c.priority)}</span>
                  <span class="jours">J-{joursAvant(c.date)}</span>
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="vide">Aucune compétition à venir. Ajoute-en une avec « Nouvelle compétition ».</p>
      {/if}
    </section>

    <section aria-labelledby="titre-passees">
      <h2 class="titre" id="titre-passees">Déjà courues</h2>
      {#if etat.courues.length || passeesPrevues.length}
        <ul class="liste">
          {#each etat.courues as c (c.id)}
            <li>
              <button type="button" class="ligne" onclick={() => ouvrirApercu(c)}>
                <span class="date"><b>{new Date(String(c.start_date_local).slice(0, 10) + 'T12:00:00').getDate()}</b><i>{formatDateCourte(String(c.start_date_local).slice(0, 10)).replace(/^\d+\s*/, '')}</i></span>
                <span class="corps">
                  <span class="nom"><span class="sport-point" style:background={couleurSport(familleAffichage(c.sport))}></span>{c.name}</span>
                  <span class="sous">{nomFamille(c.sport)}{#if c.distance_km} · {formatKm(c.distance_km)} km{/if} · {formatDuree(c.moving_time)}{#if texteClassement(resultatDuJour(resultats, String(c.start_date_local).slice(0, 10)))} · <strong>{texteClassement(resultatDuJour(resultats, String(c.start_date_local).slice(0, 10)))}</strong>{/if}</span>
                </span>
                <span class="droite"><span class="badge {prioriteDe(c.priority) === 'A' ? 'objectif' : 'prepa'}">{nomPriorite(c.priority)}</span></span>
              </button>
            </li>
          {/each}
          {#each passeesPrevues as c (c.id)}
            <li>
              <button type="button" class="ligne" onclick={() => ouvrir(c)}>
                <span class="date"><b>{new Date(c.date + 'T12:00:00').getDate()}</b><i>{formatDateCourte(c.date).replace(/^\d+\s*/, '')}</i></span>
                <span class="corps">
                  <span class="nom"><span class="sport-point" style:background={couleurSport(familleAffichage(c.sport))}></span>{c.name}</span>
                  <span class="sous">Prévue, sans résultat enregistré</span>
                </span>
                <span class="droite"><span class="badge prepa">{nomPriorite(c.priority)}</span></span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="vide">Pas encore de compétition courue. Une sortie marquée « compétition » apparaîtra ici.</p>
      {/if}
    </section>
  {/if}
</div>

<PanneauLicence ouvert={licence.ouvert} {demo} onfermer={() => (licence.ouvert = false)} onchoisir={choisirLicence} />

<PanneauCompetition
  ouvert={panneau.ouvert}
  competition={panneau.competition}
  dateInitiale={panneau.date}
  {userId}
  {demo}
  onfermer={() => (panneau.ouvert = false)}
  enregistree={apresEnregistrement}
  supprimee={apresSuppression}
/>

<style>
  .entete-page {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 24px;
    margin-bottom: 16px;
  }
  h1 {
    font-size: clamp(32px, 6vw, 52px);
    line-height: 1.05;
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
  .haut {
    display: grid;
    grid-template-columns: minmax(280px, 380px) minmax(0, 1fr);
    gap: 16px;
    margin-bottom: 28px;
  }
  @media (max-width: 760px) {
    .haut {
      grid-template-columns: 1fr;
    }
  }
  .dossard-cadre :global(.dossard) {
    height: 100%;
  }
  .prepa {
    display: flex;
    flex-wrap: wrap;
    gap: 16px 40px;
    margin-bottom: 14px;
  }
  dt {
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-muet);
  }
  dd {
    margin: 4px 0 0;
    font-family: var(--police-titre);
    font-size: 26px;
    font-weight: 700;
  }
  .ton.bon {
    color: var(--succes, #5fb87a);
  }
  .ton.mauvais {
    color: var(--danger);
  }
  .tsb {
    font-family: var(--police-texte);
    font-size: 13px;
    font-weight: 400;
    color: var(--texte-doux);
  }
  .conseil {
    font-size: 15px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  section h2 {
    margin: 0 0 12px;
    font-size: 24px;
  }
  section {
    margin-bottom: 28px;
  }
  .liste {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ligne {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    min-height: 64px;
    padding: 10px 18px 10px 12px;
    border: 0;
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
    text-align: left;
    cursor: pointer;
  }
  .ligne:hover {
    background: var(--surface-2);
  }
  .ligne:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .date {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 48px;
    line-height: 1.1;
  }
  .date b {
    font-family: var(--police-titre);
    font-size: 26px;
  }
  .date i {
    font-style: normal;
    font-size: 11px;
    text-transform: uppercase;
    color: var(--texte-doux);
  }
  .corps {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .nom {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sport-point {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex: none;
  }
  .sous {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .droite {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }
  .badge {
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }
  .badge.objectif {
    background: var(--dossard-fond, #f3f2ee);
    color: var(--dossard-texte, #0c0d10);
  }
  .badge.prepa {
    border: 1px solid var(--trait-fort);
    color: var(--texte-doux);
  }
  .jours {
    font-family: var(--police-titre);
    font-size: 16px;
    font-weight: 700;
  }
  .vide {
    margin-bottom: 12px;
    color: var(--texte-doux);
  }
  .palmares {
    margin-bottom: 28px;
  }
  .sous strong {
    color: var(--texte);
  }
</style>
