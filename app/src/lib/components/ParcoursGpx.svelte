<script>
  import StatCle from './StatCle.svelte';
  import CarteGpx from './CarteGpx.svelte';
  import GraphiqueStream from './charts/GraphiqueStream.svelte';
  import { lireGpx, profil, statistiques, reduire, detecterMontees, textePente } from '../data/gpx.js';
  import { formatKm } from '../utils/format.js';

  // Parcours GPX d'une séance prévue ou d'une compétition : chiffres clés, profil d'altitude, carte, montées détectées.
  // Tout vient du fichier, traité comme non fiable (voir data/gpx.js) ; rien n'est inséré comme HTML.
  //  contenu : texte du fichier GPX · nom : nom du parcours · tours : nombre de tours d'un circuit (distance et dénivelé multipliés)
  let { contenu = '', nom = '', tours = 1 } = $props();

  const lu = $derived(lireGpx(contenu));
  const serie = $derived(profil(lu.points));
  const stats = $derived(statistiques(serie, 0, Infinity, tours));
  const montees = $derived(detecterMontees(serie));
  const reduite = $derived(reduire(serie, 400)); // un point sur n : le profil et la carte restent fluides sur de longs parcours
  const altitudes = $derived(reduite.map((p) => p.ele));
  const aAltitude = $derived(altitudes.some((a) => a != null));

  let curseur = $state(null);
  let choisie = $state(null); // indice de la montée mise en valeur
  const portion = $derived.by(() => {
    if (choisie == null || !montees[choisie]) return null;
    const m = montees[choisie];
    const de = reduite.findIndex((p) => p.km >= m.debutKm);
    let a = reduite.findLastIndex((p) => p.km <= m.finKm);
    if (de < 0) return null;
    if (a <= de) a = Math.min(reduite.length - 1, de + 1);
    return { de, a };
  });
  const dec = (v, n = 0) => Number(v).toLocaleString('fr-FR', { maximumFractionDigits: n });
</script>

{#if lu.erreur}
  <p class="erreur" role="alert">{lu.erreur}</p>
{:else if stats}
  <div class="parcours">
    {#if nom}<p class="nom">{nom}</p>{/if}
    <div class="tuiles">
      <StatCle etiquette="Distance" valeur={formatKm(stats.distanceKm, 1)} unite="km" />
      <StatCle etiquette="Dénivelé +" valeur={dec(stats.gain)} unite="m" />
      <StatCle etiquette="Dénivelé −" valeur={dec(stats.perte)} unite="m" />
      <StatCle etiquette="Pente max" valeur={textePente(stats.penteMax)} />
      {#if stats.altMax != null}<StatCle etiquette="Altitude" valeur={`${dec(stats.altMin)}–${dec(stats.altMax)}`} unite="m" />{/if}
    </div>

    <CarteGpx points={reduite} {curseur} {portion} />

    {#if aAltitude}
      <div class="profil">
        <GraphiqueStream titre="Profil d'altitude" valeurs={altitudes} couleur="var(--sport-neutre)" unite="m" {curseur} onsurvol={(i) => (curseur = i)} hauteur={110} />
        <p class="aide">Survole le profil pour suivre ta position sur la carte.</p>
      </div>
    {/if}

    {#if montees.length}
      <section aria-label="Montées détectées">
        <h4>Montées détectées</h4>
        <ul class="montees">
          {#each montees as m, i (i)}
            <li>
              <button type="button" class="montee" class:choisie={choisie === i} aria-pressed={choisie === i} onclick={() => (choisie = choisie === i ? null : i)}>
                <span class="num">{i + 1}</span>
                <span class="corps">
                  <strong>{formatKm(m.distanceKm, 1)} km à {textePente(m.pente)}</strong>
                  <span>km {formatKm(m.debutKm, 1)} → {formatKm(m.finKm, 1)} · +{dec(m.gain)} m · {dec(m.altDebut)} → {dec(m.altFin)} m</span>
                </span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  </div>
{/if}

<style>
  .parcours {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .nom {
    font-size: 14px;
    color: var(--texte-doux);
    overflow-wrap: anywhere;
  }
  .tuiles {
    display: flex;
    flex-wrap: wrap;
    gap: 16px 28px;
    padding: 14px 16px;
    border-radius: var(--rayon-l);
    background: var(--surface-2);
  }
  .aide {
    margin-top: 4px;
    font-size: 12.5px;
    color: var(--texte-muet);
  }
  h4 {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-muet);
  }
  .montees {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .montee {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 52px;
    padding: 8px 12px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon);
    background: var(--surface-2);
    color: var(--texte);
    text-align: left;
    cursor: pointer;
  }
  .montee.choisie {
    border-color: var(--ok);
  }
  .montee:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .num {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--trait-fort);
    font-size: 13px;
    font-weight: 700;
    flex: none;
  }
  .corps {
    display: flex;
    flex-direction: column;
    min-width: 0;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .corps strong {
    font-size: 15px;
    color: var(--texte);
  }
  .erreur {
    font-size: 14px;
    color: var(--danger);
  }
</style>
