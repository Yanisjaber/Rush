<script>
  import { untrack } from 'svelte';
  import EnTete from '../lib/components/EnTete.svelte';
  import Bloc from '../lib/components/Bloc.svelte';
  import StatCle from '../lib/components/StatCle.svelte';
  import GraphiqueStream from '../lib/components/charts/GraphiqueStream.svelte';
  import GraphiqueDouble from '../lib/components/charts/GraphiqueDouble.svelte';
  import AnalyseSortie from '../lib/components/AnalyseSortie.svelte';
  import PrevuReel from '../lib/components/PrevuReel.svelte';
  import { auth } from '../lib/stores/auth.svelte.js';
  import { donnees, ouvrirModification } from '../lib/stores/edition.svelte.js';
  import { chargerSeance, chargerStreams, chargerProfil, chargerPuissance, chargerPlanifieeParId, chargerPlanifieesDuJour, lierPrevu } from '../lib/data/api.js';
  import { estLien, candidates as trouverCandidates } from '../lib/data/adherence.js';
  import { donneesDemo, streamsDemo, prevueDemo } from '../lib/data/demo.js';
  import { chargeSeance } from '../lib/data/synthese.js';
  import { familleAffichage } from '../lib/data/familles.js';
  import { extraireStream, reduire, tempsParZone, ZONES_PUISSANCE, ZONES_CARDIO } from '../lib/data/streams.js';
  import { SPORTS, couleurSport } from '../lib/sports.js';
  import { formatDuree, formatKm, formatAllure, formatDateLongue } from '../lib/utils/format.js';

  let { id, demo = false } = $props();

  let etat = $state({ chargement: true, erreur: '', seance: null, profil: null, streams: null, streamsEtat: 'attente', erreurStreams: '', prevue: null, candidates: [], erreurLien: '', envoiLien: false, records: [] });
  let curseur = $state(null);
  let superposer = $state(false); // un seul graphique avec la puissance et la FC superposées
  let numeroRequete = 0;

  async function charger(userId, idSeance) {
    const numero = ++numeroRequete;
    etat.chargement = true;
    etat.erreur = '';
    etat.streams = null;
    etat.streamsEtat = 'attente';
    etat.prevue = null;
    etat.candidates = [];
    etat.erreurLien = '';
    curseur = null;

    if (demo) {
      const d = donneesDemo();
      const seance = d.seances.find((s) => s.id === idSeance) || null;
      etat.seance = seance;
      etat.profil = d.profil;
      etat.records = d.puissance;
      etat.erreur = seance ? '' : 'Séance introuvable.';
      etat.chargement = false;
      if (seance) {
        if (seance.sport === 'Ride') etat.prevue = prevueDemo(seance); // démo : les sorties vélo ont une séance prévue liée
        const streams = streamsDemo(seance);
        etat.streams = streams;
        etat.streamsEtat = streams ? 'ok' : 'absent';
      }
      return;
    }
    if (!userId) return;

    const [s, p, rec] = await Promise.all([chargerSeance(userId, idSeance), chargerProfil(userId), chargerPuissance(userId)]);
    etat.records = rec.data || [];
    if (numero !== numeroRequete) return;
    etat.seance = s.data;
    etat.profil = p.data;
    etat.erreur = s.erreur;
    etat.chargement = false;
    if (!s.data) return;
    chercherPrevue(userId, s.data, numero);

    // Les courbes sont lourdes : on les charge après l'affichage de la séance
    etat.streamsEtat = 'chargement';
    const r = await chargerStreams(userId, idSeance);
    if (numero !== numeroRequete) return;
    etat.streams = r.data;
    etat.erreurStreams = r.erreur;
    etat.streamsEtat = r.erreur ? 'erreur' : r.data ? 'ok' : 'absent';
  }

  // Séance prévue liée à la sortie (planned_id), ou séances prévues du même jour à proposer
  async function chercherPrevue(userId, sortie, numero) {
    if (estLien(sortie.planned_id)) {
      const r = await chargerPlanifieeParId(userId, sortie.planned_id);
      if (numero === numeroRequete) etat.prevue = r.data;
    } else if (sortie.planned_id !== 'none') {
      const r = await chargerPlanifieesDuJour(userId, String(sortie.start_date_local).slice(0, 10));
      if (numero === numeroRequete) etat.candidates = trouverCandidates(r.data, sortie, familleAffichage);
    }
  }
  async function changerLien(valeur, prevue = null) {
    if (etat.envoiLien) return;
    etat.erreurLien = '';
    etat.envoiLien = true;
    const r = demo ? { erreur: '' } : await lierPrevu(userId, id, valeur);
    etat.envoiLien = false;
    if (r.erreur) return (etat.erreurLien = r.erreur);
    if (valeur === 'none') {
      etat.candidates = etat.prevue ? [etat.prevue] : [];
      etat.prevue = null;
    } else {
      etat.prevue = prevue;
      etat.candidates = [];
    }
  }

  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);
  $effect(() => {
    const u = userId;
    const i = id;
    void donnees.version; // se recharge quand une sortie est créée, retouchée ou supprimée
    untrack(() => charger(u, i));
  });

  // --- Dérivés ---
  const s = $derived(etat.seance);
  const famille = $derived(s ? familleAffichage(s.sport) : 'autre');
  const couleur = $derived(couleurSport(famille));
  const nomSport = $derived((SPORTS[famille] || SPORTS.autre).nom);
  const estCourse = $derived(famille === 'course');

  const watts = $derived(extraireStream(etat.streams, 'watts'));
  const cardio = $derived(extraireStream(etat.streams, 'heartrate'));
  const altitude = $derived(extraireStream(etat.streams, 'altitude'));
  const vitesseMs = $derived(extraireStream(etat.streams, 'velocity_smooth'));
  const temps = $derived(extraireStream(etat.streams, 'time'));
  const distance = $derived(extraireStream(etat.streams, 'distance'));

  const wattsR = $derived(watts ? reduire(watts) : []);
  const cardioR = $derived(cardio ? reduire(cardio) : []);
  const altitudeR = $derived(altitude ? reduire(altitude) : []);
  const vitesseR = $derived(vitesseMs ? reduire(vitesseMs.map((v) => (v == null ? null : v * 3.6))) : []);
  const tempsR = $derived(temps ? reduire(temps) : []);
  const distanceR = $derived(distance ? reduire(distance) : []);

  const ftp = $derived(etat.profil?.ftp || s?.ftp_at_time || null);
  const zonesP = $derived(watts && ftp ? tempsParZone(watts, ftp, ZONES_PUISSANCE) : null);
  const zonesC = $derived(cardio && etat.profil?.hr_max ? tempsParZone(cardio, etat.profil.hr_max, ZONES_CARDIO) : null);

  const lectureCurseur = $derived.by(() => {
    if (curseur === null || !tempsR.length) return '';
    const morceaux = [formatDuree(tempsR[curseur] || 0)];
    if (distanceR[curseur] != null) morceaux.push(`${formatKm(distanceR[curseur] / 1000)} km`);
    return morceaux.join(' · ');
  });

  const stats = $derived.by(() => {
    if (!s) return [];
    const l = [{ etiquette: 'Durée', valeur: formatDuree(s.moving_time) }];
    if (s.distance_km) l.push({ etiquette: 'Distance', valeur: formatKm(s.distance_km), unite: 'km' });
    if (s.total_elevation_gain) l.push({ etiquette: 'Dénivelé +', valeur: String(s.total_elevation_gain), unite: 'm' });
    if (s.distance_km && s.moving_time) {
      if (estCourse) l.push({ etiquette: 'Allure', valeur: formatAllure(s.moving_time / s.distance_km).replace('/km', ''), unite: '/km' });
      else if (s.avg_speed_kmh) l.push({ etiquette: 'Vitesse', valeur: formatKm(s.avg_speed_kmh), unite: 'km/h' });
    }
    if (s.avg_heartrate) l.push({ etiquette: 'Cardio moy.', valeur: String(s.avg_heartrate), unite: 'bpm', note: s.max_heartrate ? `max ${s.max_heartrate}` : '' });
    if (s.avg_watts) l.push({ etiquette: 'Puissance moy.', valeur: String(s.avg_watts), unite: 'W', note: s.np ? `normalisée ${s.np} W` : '' });
    l.push({ etiquette: 'Charge', valeur: String(chargeSeance(s)), unite: 'pts', note: s.tss ? 'TSS enregistré' : 'estimée' });
    if (s.kj) l.push({ etiquette: 'Énergie', valeur: String(s.kj), unite: 'kJ' });
    return l;
  });

  // Une teinte par zone : la couleur du sport, de plus en plus soutenue avec l'intensité
  const teinte = (i, n) => `color-mix(in srgb, ${couleur} ${Math.round(22 + (i / (n - 1)) * 78)}%, var(--surface-2))`;
</script>

<div class="page">
  <EnTete actif="" {demo} />

  <a class="retour" href="#/calendrier">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    Calendrier
  </a>

  {#if etat.chargement}
    <p class="info" role="status">Chargement de la séance…</p>
  {:else if !s}
    <p class="alerte" role="alert">{etat.erreur || 'Séance introuvable.'}</p>
  {:else}
    <header class="entete-seance">
      <div class="sport"><span class="pastille" style:background={couleur}></span>{nomSport} · {formatDateLongue(s.start_date_local)}</div>
      <h1 class="titre">{s.name || nomSport}</h1>
      <div class="modifier"><button type="button" class="lien-action" onclick={() => ouvrirModification(s)}>Modifier cette sortie</button></div>
      {#if s.user_notes}<p class="notes">{s.user_notes}</p>{/if}
    </header>

    <Bloc>
      <div class="stats">
        {#each stats as st (st.etiquette)}
          <StatCle etiquette={st.etiquette} valeur={st.valeur} unite={st.unite || ''} note={st.note || ''} />
        {/each}
      </div>
    </Bloc>

    <PrevuReel
      prevue={etat.prevue}
      candidates={etat.candidates}
      seance={s}
      charge={chargeSeance(s)}
      {watts}
      {ftp}
      erreur={etat.erreurLien}
      envoi={etat.envoiLien}
      onlier={(pid) => changerLien(pid, etat.candidates.find((c) => c.id === pid))}
      odelier={() => changerLien('none')}
    />

    {#if etat.streamsEtat === 'chargement'}
      <p class="info" role="status">Chargement des courbes…</p>
    {:else if etat.streamsEtat === 'erreur'}
      <p class="alerte" role="alert">{etat.erreurStreams}</p>
    {:else if etat.streamsEtat === 'absent'}
      <p class="info">Pas de courbes pour cette séance (aucun capteur, ou pas encore synchronisée).</p>
    {:else if etat.streamsEtat === 'ok'}
      <div class="courbes">
        <Bloc titre="Courbes de la séance">
          {#snippet actions()}
            <span class="lecture" aria-live="off">{lectureCurseur || 'Survole un graphique pour voir un instant précis'}</span>
            {#if wattsR.length && cardioR.length}
              <button type="button" class="bascule" aria-pressed={superposer} onclick={() => (superposer = !superposer)}>Superposer puissance et FC</button>
            {/if}
          {/snippet}
          <div class="pile">
            {#if superposer && wattsR.length && cardioR.length}
              <GraphiqueDouble
                a={{ titre: 'Puissance', valeurs: wattsR, couleur, unite: 'W' }}
                b={{ titre: 'Fréquence cardiaque', valeurs: cardioR, couleur: 'var(--sport-muscu)', unite: 'bpm' }}
                {curseur}
                onsurvol={(i) => (curseur = i)}
              />
            {:else}
              {#if wattsR.length}
                <GraphiqueStream titre="Puissance" valeurs={wattsR} {couleur} unite="W" {curseur} onsurvol={(i) => (curseur = i)} min={0} />
              {/if}
              {#if cardioR.length}
                <GraphiqueStream titre="Fréquence cardiaque" valeurs={cardioR} couleur="var(--sport-muscu)" unite="bpm" {curseur} onsurvol={(i) => (curseur = i)} />
              {/if}
            {/if}
            {#if vitesseR.length}
              <GraphiqueStream titre="Vitesse" valeurs={vitesseR} {couleur} unite="km/h" formater={(v) => v.toFixed(1).replace('.', ',')} {curseur} onsurvol={(i) => (curseur = i)} min={0} />
            {/if}
            {#if altitudeR.length}
              <GraphiqueStream titre="Altitude" valeurs={altitudeR} couleur="var(--sport-neutre)" unite="m" {curseur} onsurvol={(i) => (curseur = i)} hauteur={90} />
            {/if}
          </div>
        </Bloc>
      </div>

      <div class="zones">
        {#each [{ titre: 'Zones de puissance', donnees: zonesP, absent: watts && !ftp ? 'Renseigne ta FTP dans ton profil pour voir les zones de puissance.' : '' }, { titre: 'Zones cardio', donnees: zonesC, absent: cardio && !etat.profil?.hr_max ? 'Renseigne ta fréquence cardiaque max dans ton profil pour voir les zones cardio.' : '' }] as bloc (bloc.titre)}
          {#if bloc.donnees || bloc.absent}
            <Bloc titre={bloc.titre}>
              {#if bloc.donnees}
                <div class="barre-zones" role="img" aria-label={bloc.titre}>
                  {#each bloc.donnees as z, i}
                    <span style:flex={Math.max(z.part, 0.004)} style:background={teinte(i, bloc.donnees.length)}></span>
                  {/each}
                </div>
                <ul class="legende-zones">
                  {#each bloc.donnees as z, i}
                    <li>
                      <span class="carre" style:background={teinte(i, bloc.donnees.length)}></span>
                      <span class="nomzone">{z.nom}</span>
                      <strong>{formatDuree(z.secondes)}</strong>
                      <span class="part">{Math.round(z.part * 100)} %</span>
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="info">{bloc.absent}</p>
              {/if}
            </Bloc>
          {/if}
        {/each}
      </div>

      {#if watts?.length}
        <AnalyseSortie {watts} {ftp} profil={etat.profil} records={etat.records} {curseur} onsurvol={(i) => (curseur = i)} {couleur} />
      {/if}
    {/if}
  {/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .retour {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
    min-height: var(--cible);
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-doux);
  }
  .retour:hover {
    color: var(--texte);
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
  .entete-seance .sport {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .pastille {
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }
  h1 {
    margin-top: 8px;
    font-size: clamp(32px, 6vw, 52px);
    line-height: 1.05;
  }
  .modifier {
    margin-top: 8px;
  }
  .lien-action {
    min-height: 44px;
    padding: 0 4px;
    border: 0;
    background: transparent;
    color: var(--texte-doux);
    font-size: 14px;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .lien-action:hover {
    color: var(--texte);
  }
  .lien-action:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .notes {
    margin-top: 12px;
    max-width: 640px;
    font-size: 16px;
    line-height: 1.5;
    color: var(--texte-doux);
    white-space: pre-line;
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 24px 40px;
  }
  .bascule {
    min-height: 44px;
    padding: 0 16px;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    background: transparent;
    color: var(--texte-doux);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .bascule[aria-pressed='true'] {
    background: var(--texte);
    border-color: var(--texte);
    color: var(--fond);
  }
  .bascule:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .lecture {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .pile {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .zones {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  .zones > :global(*) {
    flex: 1 1 360px;
    min-width: 0;
  }
  .barre-zones {
    display: flex;
    gap: 3px;
    height: 36px;
  }
  .barre-zones span {
    min-width: 3px;
    border-radius: 4px;
  }
  .legende-zones {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 16px;
    font-size: 14px;
  }
  .legende-zones li {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .carre {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex: none;
  }
  .nomzone {
    flex: 1;
    color: var(--texte-doux);
  }
  .part {
    flex: 0 0 44px;
    text-align: right;
    color: var(--texte-doux);
  }
</style>
