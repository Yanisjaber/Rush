<script>
  import { untrack } from 'svelte';
  import EnTete from '../lib/components/EnTete.svelte';
  import Bloc from '../lib/components/Bloc.svelte';
  import Dossard from '../lib/components/Dossard.svelte';
  import StatCle from '../lib/components/StatCle.svelte';
  import CourbeLissee from '../lib/components/charts/CourbeLissee.svelte';
  import { auth } from '../lib/stores/auth.svelte.js';
  import { chargerSommeil } from '../lib/data/api.js';
  import { sommeilDemo } from '../lib/data/demo.js';
  import { phases, efficacite, moyenne, moyenneCoucher, heureDe, heureDepuisMinutes, triees, tendance } from '../lib/data/sommeil.js';
  import { formatDuree, formatDateLongue } from '../lib/utils/format.js';

  let { demo = false } = $props();

  let etat = $state({ chargement: true, erreur: '', nuits: [] });
  let choisie = $state(null); // date de la nuit sélectionnée (null = la plus récente)

  async function charger(userId) {
    if (demo) {
      etat = { chargement: false, erreur: '', nuits: sommeilDemo() };
      return;
    }
    if (!userId) return;
    const r = await chargerSommeil(userId, 60);
    etat = { chargement: false, erreur: r.erreur, nuits: r.data || [] };
  }
  $effect(() => {
    const u = auth.session?.user?.id;
    untrack(() => charger(u));
  });

  const nuits = $derived(triees(etat.nuits));
  const nuit = $derived(nuits.find((n) => n.date === choisie) || nuits[0] || null);
  const trente = $derived(nuits.slice(0, 30).reverse()); // de la plus ancienne à la plus récente
  const dernieres7 = $derived(nuits.slice(0, 7));

  const phasesNuit = $derived(phases(nuit));
  const eff = $derived(efficacite(nuit));
  const hauteurMax = $derived(Math.max(8 * 3600, ...trente.map((n) => n.total_sec || 0)));
  const coucherMoyen = $derived(heureDepuisMinutes(moyenneCoucher(dernieres7)));
  const dureeMoy = $derived(moyenne(dernieres7, 'total_sec'));

  const COULEURS = {
    profond: 'color-mix(in srgb, var(--texte) 95%, var(--surface))',
    rem: 'color-mix(in srgb, var(--texte) 65%, var(--surface))',
    leger: 'color-mix(in srgb, var(--texte) 35%, var(--surface))',
    eveille: 'var(--sport-course)',
  };
  const LIBELLE_TENDANCE = { hausse: 'en hausse', baisse: 'en baisse', stable: 'stable' };
  // Navigation nuit par nuit (les barres sont trop fines pour le doigt sur téléphone)
  const indice = $derived(nuit ? nuits.findIndex((n) => n.date === nuit.date) : -1);
  const aller = (delta) => {
    const cible = nuits[indice + delta];
    if (cible) choisie = cible.date;
  };
  const serie = (champ) => trente.map((n) => (n[champ] == null ? null : Number(n[champ])));
</script>

<div class="page">
  <EnTete actif="sommeil" {demo} />

  {#if etat.chargement}
    <p class="info" role="status">Chargement du sommeil…</p>
  {:else if etat.erreur}
    <p class="alerte" role="alert">{etat.erreur}</p>
  {:else if !nuit}
    <p class="info">Aucune nuit pour l'instant. Lance une synchro Garmin pour récupérer ton sommeil.</p>
  {:else}
    <Dossard
      etiquette={nuit === nuits[0] ? 'Dernière nuit' : 'Nuit sélectionnée'}
      nom={formatDateLongue(nuit.date)}
      valeur={formatDuree(nuit.total_sec || 0)}
      detail={[nuit.score != null ? `score ${nuit.score}` : '', heureDe(nuit.bedtime) ? `couché ${heureDe(nuit.bedtime)}` : '', heureDe(nuit.wake_time) ? `levé ${heureDe(nuit.wake_time)}` : ''].filter(Boolean).join(' · ')}
    />

    <Bloc titre="Phases de la nuit">
      {#if phasesNuit.length}
        <div class="barre-phases" role="img" aria-label="Répartition des phases de sommeil">
          {#each phasesNuit as p (p.cle)}
            <span style:flex={Math.max(p.part, 0.004)} style:background={COULEURS[p.cle]}></span>
          {/each}
        </div>
        <ul class="legende">
          {#each phasesNuit as p (p.cle)}
            <li>
              <span class="carre" style:background={COULEURS[p.cle]}></span>
              <span class="nom">{p.nom}</span>
              <strong>{formatDuree(p.secondes)}</strong>
              <span class="part">{Math.round(p.part * 100)} %</span>
            </li>
          {/each}
        </ul>
        {#if eff != null}<p class="info">Efficacité : {Math.round(eff * 100)} % du temps au lit passé à dormir.</p>{/if}
      {:else}
        <p class="info">Pas de détail des phases pour cette nuit.</p>
      {/if}
    </Bloc>

    <Bloc titre="30 dernières nuits">
      {#snippet actions()}
        <div class="nav-nuits">
          <button class="fleche" aria-label="Nuit précédente" disabled={indice >= nuits.length - 1} onclick={() => aller(1)}>‹</button>
          <button class="fleche" aria-label="Nuit suivante" disabled={indice <= 0} onclick={() => aller(-1)}>›</button>
        </div>
      {/snippet}
      <div class="nuits" role="group" aria-label="Durée de sommeil des 30 dernières nuits">
        {#each trente as n (n.date)}
          <button
            class="colonne"
            class:active={n.date === nuit.date}
            aria-pressed={n.date === nuit.date}
            aria-label="{formatDateLongue(n.date)} : {formatDuree(n.total_sec || 0)}"
            onclick={() => (choisie = n.date)}
          >
            <span class="fut" style:height="{Math.round(((n.total_sec || 0) / hauteurMax) * 100)}%"></span>
          </button>
        {/each}
      </div>
      <p class="info">Touche une barre ou utilise les flèches pour changer de nuit.</p>
    </Bloc>

    <div class="stats">
      <Bloc>
        <StatCle etiquette="Moyenne 7 nuits" valeur={dureeMoy ? formatDuree(dureeMoy) : '—'} note={coucherMoyen ? `couché vers ${coucherMoyen}` : ''} />
      </Bloc>
      <Bloc titre="HRV nocturne">
        <StatCle etiquette="Moyenne 7 nuits" valeur={moyenne(dernieres7, 'hrv_avg') ? String(Math.round(moyenne(dernieres7, 'hrv_avg'))) : '—'} unite="ms" note={tendance(nuits, 'hrv_avg') ? LIBELLE_TENDANCE[tendance(nuits, 'hrv_avg')] : ''} />
        <CourbeLissee valeurs={serie('hrv_avg').map((v) => v ?? 0)} etiquette="HRV sur 30 nuits" couleur="var(--sport-neutre)" />
      </Bloc>
      <Bloc titre="FC au repos">
        <StatCle etiquette="Moyenne 7 nuits" valeur={moyenne(dernieres7, 'resting_heart_rate') ? String(Math.round(moyenne(dernieres7, 'resting_heart_rate'))) : '—'} unite="bpm" note={tendance(nuits, 'resting_heart_rate') ? LIBELLE_TENDANCE[tendance(nuits, 'resting_heart_rate')] : ''} />
        <CourbeLissee valeurs={serie('resting_heart_rate').map((v) => v ?? 0)} etiquette="FC au repos sur 30 nuits" couleur="var(--sport-muscu)" />
      </Bloc>
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 32px 64px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .info {
    margin-top: 12px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .alerte {
    padding: 10px 14px;
    border: 1px solid var(--danger);
    border-radius: var(--rayon-l);
    background: var(--surface);
    font-size: 14px;
  }
  .barre-phases {
    display: flex;
    gap: 3px;
    height: 36px;
  }
  .barre-phases span {
    min-width: 3px;
    border-radius: 4px;
  }
  .legende {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 16px;
    font-size: 14px;
  }
  .legende li {
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
  .nom {
    flex: 1;
    color: var(--texte-doux);
  }
  .part {
    flex: 0 0 44px;
    text-align: right;
    color: var(--texte-doux);
  }
  .nuits {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 140px;
  }
  .colonne {
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    align-items: flex-end;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .fut {
    display: block;
    width: 100%;
    min-height: 3px;
    border-radius: 3px 3px 0 0;
    background: var(--trait-fort);
  }
  .colonne:hover .fut {
    background: var(--texte-doux);
  }
  .colonne.active .fut {
    background: var(--texte);
  }
  .colonne:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .nav-nuits {
    display: flex;
    gap: 8px;
  }
  .fleche {
    width: 44px;
    height: 44px;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    background: transparent;
    color: var(--texte);
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
  }
  .fleche:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .fleche:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  .stats > :global(*) {
    flex: 1 1 260px;
    min-width: 0;
  }
  @media (max-width: 600px) {
    .page {
      padding: 0 16px 48px;
    }
  }
</style>
