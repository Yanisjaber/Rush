<script>
  import { untrack } from 'svelte';
  import EnTete from '../lib/components/EnTete.svelte';
  import Bloc from '../lib/components/Bloc.svelte';
  import StatCle from '../lib/components/StatCle.svelte';
  import GraphiqueStream from '../lib/components/charts/GraphiqueStream.svelte';
  import { auth } from '../lib/stores/auth.svelte.js';
  import { chargerSeance, chargerStreams, chargerProfil } from '../lib/data/api.js';
  import { donneesDemo, streamsDemo } from '../lib/data/demo.js';
  import { chargeSeance } from '../lib/data/synthese.js';
  import { familleAffichage } from '../lib/data/familles.js';
  import { extraireStream, reduire, tempsParZone, ZONES_PUISSANCE, ZONES_CARDIO } from '../lib/data/streams.js';
  import { SPORTS, couleurSport } from '../lib/sports.js';
  import { formatDuree, formatKm, formatAllure, formatDateLongue } from '../lib/utils/format.js';

  let { id, demo = false } = $props();

  let etat = $state({ chargement: true, erreur: '', seance: null, profil: null, streams: null, streamsEtat: 'attente', erreurStreams: '' });
  let curseur = $state(null);
  let numeroRequete = 0;

  async function charger(userId, idSeance) {
    const numero = ++numeroRequete;
    etat.chargement = true;
    etat.erreur = '';
    etat.streams = null;
    etat.streamsEtat = 'attente';
    curseur = null;

    if (demo) {
      const d = donneesDemo();
      const seance = d.seances.find((s) => s.id === idSeance) || null;
      etat.seance = seance;
      etat.profil = d.profil;
      etat.erreur = seance ? '' : 'Séance introuvable.';
      etat.chargement = false;
      if (seance) {
        const streams = streamsDemo(seance);
        etat.streams = streams;
        etat.streamsEtat = streams ? 'ok' : 'absent';
      }
      return;
    }
    if (!userId) return;

    const [s, p] = await Promise.all([chargerSeance(userId, idSeance), chargerProfil(userId)]);
    if (numero !== numeroRequete) return;
    etat.seance = s.data;
    etat.profil = p.data;
    etat.erreur = s.erreur;
    etat.chargement = false;
    if (!s.data) return;

    // Les courbes sont lourdes : on les charge après l'affichage de la séance
    etat.streamsEtat = 'chargement';
    const r = await chargerStreams(userId, idSeance);
    if (numero !== numeroRequete) return;
    etat.streams = r.data;
    etat.erreurStreams = r.erreur;
    etat.streamsEtat = r.erreur ? 'erreur' : r.data ? 'ok' : 'absent';
  }

  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);
  $effect(() => {
    const u = userId;
    const i = id;
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
      {#if s.user_notes}<p class="notes">{s.user_notes}</p>{/if}
    </header>

    <Bloc>
      <div class="stats">
        {#each stats as st (st.etiquette)}
          <StatCle etiquette={st.etiquette} valeur={st.valeur} unite={st.unite || ''} note={st.note || ''} />
        {/each}
      </div>
    </Bloc>

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
          {/snippet}
          <div class="pile">
            {#if wattsR.length}
              <GraphiqueStream titre="Puissance" valeurs={wattsR} {couleur} unite="W" {curseur} onsurvol={(i) => (curseur = i)} min={0} />
            {/if}
            {#if cardioR.length}
              <GraphiqueStream titre="Fréquence cardiaque" valeurs={cardioR} couleur="var(--sport-muscu)" unite="bpm" {curseur} onsurvol={(i) => (curseur = i)} />
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
