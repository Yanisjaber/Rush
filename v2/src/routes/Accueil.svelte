<script>
  import Dossard from '../lib/components/Dossard.svelte';
  import Bloc from '../lib/components/Bloc.svelte';
  import ChipSport from '../lib/components/ChipSport.svelte';
  import StatCle from '../lib/components/StatCle.svelte';
  import Bouton from '../lib/components/Bouton.svelte';
  import BarresEmpilees from '../lib/components/charts/BarresEmpilees.svelte';
  import Anneau from '../lib/components/charts/Anneau.svelte';
  import { auth, deconnexion } from '../lib/stores/auth.svelte.js';
  import { chargerProfil, chargerMetriques, chargerSeances, chargerObjectifs } from '../lib/data/api.js';
  import { donneesDemo } from '../lib/data/demo.js';
  import { chargeParSemaine, conditionHebdo, formeActuelle, repartition7Jours, chargeSeance } from '../lib/data/synthese.js';
  import { familleAffichage } from '../lib/data/familles.js';
  import { SPORTS, couleurSport } from '../lib/sports.js';
  import { formatDuree, formatKm, formatDateCourte, formatDateLongue, joursAvant } from '../lib/utils/format.js';

  let { demo = false } = $props();

  let etat = $state({ chargement: true, erreur: '', profil: null, metriques: [], seances: [], objectifs: [] });
  let filtre = $state('tout');

  async function charger() {
    etat.chargement = true;
    etat.erreur = '';
    if (demo) {
      Object.assign(etat, donneesDemo(), { chargement: false });
      return;
    }
    const userId = auth.session?.user?.id;
    if (!userId) return;
    const [profil, metriques, seances, objectifs] = await Promise.all([
      chargerProfil(userId),
      chargerMetriques(userId),
      chargerSeances(userId),
      chargerObjectifs(userId),
    ]);
    etat.profil = profil.data;
    etat.metriques = metriques.data || [];
    etat.seances = seances.data || [];
    etat.objectifs = objectifs.data || [];
    etat.erreur = [profil, metriques, seances, objectifs].map((r) => r.erreur).find(Boolean) || '';
    etat.chargement = false;
  }
  $effect(() => {
    charger();
  });

  // --- Données dérivées pour l'affichage ---
  const prenom = $derived(etat.profil?.display_name || auth.session?.user?.email?.split('@')[0] || '');
  const familles = $derived([...new Set(etat.seances.map((s) => familleAffichage(s.sport)))].filter((f) => f !== 'autre'));
  const seancesVisibles = $derived(filtre === 'tout' ? etat.seances : etat.seances.filter((s) => familleAffichage(s.sport) === filtre));
  const forme = $derived(formeActuelle(etat.metriques));
  const charge = $derived(chargeParSemaine(seancesVisibles));
  const condition = $derived(conditionHebdo(etat.metriques));
  const repartition = $derived(repartition7Jours(seancesVisibles));
  const recentes = $derived(seancesVisibles.slice(0, 5));
  const objectif = $derived(etat.objectifs[0] || null);
  const chargeSemaine = $derived(charge.series.reduce((s, serie) => s + (serie.valeurs[serie.valeurs.length - 1] || 0), 0));
  const jours = $derived(objectif ? joursAvant(objectif.date) : null);

  function detailSeance(s) {
    const morceaux = [formatDateCourte(s.start_date_local), formatDuree(s.moving_time)];
    if (s.distance_km) morceaux.push(`${formatKm(s.distance_km)} km`);
    return morceaux.join(' · ');
  }
  function nomFamille(f) {
    return (SPORTS[f] || SPORTS.autre).court;
  }
</script>

<div class="page">
  <header class="barre">
    <div class="gauche">
      <span class="logo titre" aria-hidden="true">CI</span>
      <nav class="puces" aria-label="Filtrer par sport">
        <ChipSport label="Tout" sport="autre" actif={filtre === 'tout'} onclick={() => (filtre = 'tout')} />
        {#each familles as f}
          <ChipSport sport={f} actif={filtre === f} onclick={() => (filtre = f)} />
        {/each}
      </nav>
    </div>
    <div class="droite">
      {#if demo}
        <span class="etiquette-demo">Mode démo</span>
        <Bouton variante="discret" href="./">Se connecter</Bouton>
      {:else}
        <Bouton variante="discret" onclick={deconnexion}>Se déconnecter</Bouton>
      {/if}
    </div>
  </header>

  {#if etat.chargement}
    <p class="info" role="status">Chargement de tes données…</p>
  {:else}
    {#if etat.erreur}<p class="alerte" role="alert">{etat.erreur}</p>{/if}

    <section class="accroche">
      <h1 class="titre">Salut{prenom ? ` ${prenom}` : ''}.</h1>
      {#if forme}
        <p>
          Ta forme est de <strong class="ok">{forme.tsb > 0 ? '+' : ''}{forme.tsb}</strong> ({forme.libelle.toLowerCase()}).
          {#if chargeSemaine}Tu as encaissé <strong>{chargeSemaine} points de charge</strong> ces 7 derniers jours.{/if}
        </p>
      {:else}
        <p>Dès que tes séances sont synchronisées, ta forme et ta charge s'affichent ici.</p>
      {/if}
    </section>

    <div class="ligne">
      <div class="col objectif">
        {#if objectif}
          <Dossard
            etiquette="Prochain objectif"
            nom={objectif.name}
            valeur={`J-${jours}`}
            detail={`${formatDateLongue(objectif.date)}${objectif.km ? ` · ${formatKm(objectif.km, 2)} km` : ''}${objectif.duration ? ` · objectif ${objectif.duration} min` : ''}`}
          />
        {:else}
          <Dossard etiquette="Prochain objectif" nom="Aucun objectif" valeur="—" detail="Ajoute une compétition pour voir ton compte à rebours." />
        {/if}
      </div>

      <div class="col large">
        <Bloc titre="Charge d'entraînement">
          {#if charge.series.length}
            <BarresEmpilees
              series={charge.series}
              etiquettes={charge.etiquettes}
              ligne={condition}
              hauteur={220}
              etiquette="Charge par semaine et par sport sur 12 semaines, avec la courbe de condition"
            />
            <ul class="legende">
              {#each charge.series as s}
                <li><span class="pastille" style:background={s.couleur}></span>{nomFamille(s.nom)}</li>
              {/each}
              {#if condition.length}<li><span class="trait"></span>Condition</li>{/if}
            </ul>
          {:else}
            <p class="vide">Pas encore de séance sur les 12 dernières semaines.</p>
          {/if}
        </Bloc>
      </div>
    </div>

    <div class="ligne">
      <div class="col">
        <Bloc titre="Forme">
          {#if forme}
            <div class="stats">
              <StatCle etiquette="Forme" valeur={`${forme.tsb > 0 ? '+' : ''}${forme.tsb}`} note={forme.libelle} couleur={forme.tsb >= 5 ? 'var(--ok)' : ''} />
              <StatCle etiquette="Condition" valeur={String(forme.ctl)} />
              <StatCle etiquette="Fatigue" valeur={String(forme.atl)} />
            </div>
          {:else}
            <p class="vide">Pas encore de données de forme.</p>
          {/if}
        </Bloc>
      </div>

      <div class="col">
        <Bloc titre="Volume, 7 derniers jours">
          {#if repartition.totalSecondes}
            <div class="centre">
              <Anneau segments={repartition.segments} taille={170} etiquette="Répartition du temps d'entraînement par sport sur 7 jours">
                <div class="titre gros">{formatDuree(repartition.totalSecondes)}</div>
                <div class="petit">cette semaine</div>
              </Anneau>
            </div>
            <ul class="legende vertical">
              {#each repartition.segments as s}
                <li><span class="pastille" style:background={s.couleur}></span><span class="nomsport">{nomFamille(s.nom)}</span><strong>{formatDuree(s.valeur)}</strong></li>
              {/each}
            </ul>
          {:else}
            <p class="vide">Aucune séance sur les 7 derniers jours.</p>
          {/if}
        </Bloc>
      </div>

      <div class="col">
        <Bloc titre="Dernières séances">
          {#if recentes.length}
            <ul class="seances">
              {#each recentes as s (s.id)}
                <li>
                  <span class="barre-sport" style:background={couleurSport(familleAffichage(s.sport))}></span>
                  <div class="infos">
                    <div class="nom">{s.name || nomFamille(familleAffichage(s.sport))}</div>
                    <div class="detail">{detailSeance(s)}</div>
                  </div>
                  <div class="points"><span class="titre">{chargeSeance(s)}</span><span class="petit">pts</span></div>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="vide">Aucune séance à afficher.</p>
          {/if}
        </Bloc>
      </div>
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 1360px;
    margin: 0 auto;
    padding: 0 32px 64px;
  }
  .barre {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 24px;
    padding: 20px 0;
  }
  .gauche,
  .droite {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }
  .logo {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--dossard-fond);
    color: var(--dossard-texte);
    border-radius: var(--rayon);
    font-size: 17px;
    letter-spacing: 0;
  }
  .puces {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .etiquette-demo {
    padding: 6px 10px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-rond);
    font-size: 12px;
    color: var(--texte-doux);
  }

  .accroche {
    padding: 20px 0 28px;
  }
  h1 {
    font-size: clamp(36px, 6vw, 52px);
    line-height: 1;
  }
  .accroche p {
    margin-top: 12px;
    max-width: 720px;
    font-size: 18px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .accroche strong {
    color: var(--texte);
    font-weight: 600;
  }
  .accroche .ok {
    color: var(--ok);
  }

  .info,
  .vide {
    color: var(--texte-doux);
  }
  .alerte {
    padding: 10px 14px;
    margin-bottom: 16px;
    border: 1px solid var(--danger);
    border-radius: var(--rayon-l);
    background: var(--surface);
    font-size: 14px;
  }

  .ligne {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 16px;
  }
  .col {
    flex: 1 1 320px;
    min-width: 0;
  }
  .col.large {
    flex: 2 1 560px;
  }
  .col.objectif :global(.dossard) {
    height: 100%;
  }

  .legende {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    margin: 14px 0 0;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .legende li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .legende.vertical {
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
    color: var(--texte);
  }
  .legende.vertical li {
    gap: 10px;
  }
  .nomsport {
    flex: 1;
  }
  .pastille {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex: none;
  }
  .trait {
    width: 16px;
    height: 3px;
    background: var(--texte);
    border-radius: 2px;
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 28px;
  }
  .centre {
    display: flex;
    justify-content: center;
    margin-bottom: 16px;
  }
  .gros {
    font-size: 30px;
    line-height: 1;
  }
  .petit {
    font-size: 12px;
    color: var(--texte-doux);
  }

  .seances li {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 60px;
    border-top: 1px solid var(--trait);
  }
  .seances li:first-child {
    border-top: 0;
  }
  .barre-sport {
    width: 6px;
    height: 36px;
    border-radius: 3px;
    flex: none;
  }
  .infos {
    flex: 1;
    min-width: 0;
  }
  .nom {
    font-size: 15px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail {
    font-size: 12px;
    color: var(--texte-doux);
  }
  .points {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .points .titre {
    font-size: 20px;
    line-height: 1;
    letter-spacing: 0;
  }

  @media (max-width: 600px) {
    .page {
      padding: 0 16px 48px;
    }
  }
</style>
