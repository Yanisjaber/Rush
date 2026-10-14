<script>
  import { untrack } from 'svelte';
  import EnTete from '../lib/components/EnTete.svelte';
  import Bloc from '../lib/components/Bloc.svelte';
  import { auth } from '../lib/stores/auth.svelte.js';
  import { lireForce } from '../lib/data/force-acces.js';
  import { resumeProgramme } from '../lib/data/force.js';

  // Enregistrer une séance de muscu : on part d'un modèle (un de tes programmes) ou de rien,
  // puis on arrive sur l'enregistreur (chrono, exercices, séries, charges : écran ForceSeance).
  let { demo = false } = $props();

  let etat = $state({ chargement: true, erreur: '', programmes: [] });
  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);

  async function charger(u) {
    if (!u) return;
    const r = await lireForce(demo, u);
    etat = { chargement: false, erreur: r.erreur || '', programmes: r.data?.programmes || [] };
  }
  $effect(() => {
    const u = userId;
    untrack(() => charger(u));
  });
</script>

<main class="page">
  <EnTete actif="accueil" {demo} />

  <p class="retour"><a href="#/muscu">← Retour à Muscu</a></p>
  <header class="entete">
    <h1 class="titre">Enregistrer une séance</h1>
    <p class="sous-titre">Comment tu veux partir ? Le chrono démarre dès que tu arrives sur la séance.</p>
  </header>

  <div class="choix">
    <Bloc titre="Sans rien">
      <p class="texte">Une séance vide : tu ajoutes tes exercices, tes séries et tes charges au fur et à mesure.</p>
      <a class="gros" href="#/force/seance/libre">Séance vide <span aria-hidden="true">→</span></a>
    </Bloc>

    <Bloc titre="À partir d'un modèle">
      {#if etat.chargement}
        <p class="texte" role="status">Chargement de tes modèles…</p>
      {:else if etat.erreur}
        <p class="erreur" role="alert">{etat.erreur}</p>
      {:else if etat.programmes.length}
        <p class="texte">Les exercices, séries et dernières charges sont préremplis, tu corriges ce qui a changé.</p>
        <ul class="modeles">
          {#each etat.programmes as p (p.id)}
            {@const r = resumeProgramme(p)}
            <li>
              <a href={`#/force/seance/${p.id}`}>
                <span class="nom">{p.name}</span>
                <span class="detail">{r.exercices} exercice{r.exercices > 1 ? 's' : ''} · {r.series} séries · environ {r.minutes} min</span>
              </a>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="texte">Un modèle, c'est une séance type (Push, Pull, Legs…). Tu n'en as pas encore : <a class="lien" href="#/muscu/programmes">crée ton premier modèle</a>.</p>
      {/if}
    </Bloc>
  </div>

  <p class="apres">Tu as déjà fait ta séance ? <a class="lien" href="#/force/apres/libre">Ajoute-la après coup</a> (date et durée libres).</p>
</main>

<style>
  .retour {
    margin: 4px 0 0;
    font-size: 14px;
  }
  .retour a {
    color: var(--texte-doux);
  }
  .entete {
    padding: 8px 0 20px;
  }
  h1 {
    font-size: clamp(30px, 5vw, 42px);
    line-height: 1;
  }
  .sous-titre {
    margin-top: 8px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .choix {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    align-items: start;
  }
  .texte {
    margin: 0 0 16px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .erreur {
    color: var(--danger);
    font-size: 14px;
  }
  .gros {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 56px;
    padding: 0 18px;
    border-radius: var(--rayon-l);
    background: var(--sport-muscu);
    color: var(--encre-sur-couleur);
    font-family: var(--police-titre);
    font-size: 18px;
    font-weight: 700;
    text-decoration: none;
  }
  .gros:focus-visible,
  .modeles a:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .modeles {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .modeles a {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    min-height: 56px;
    padding: 8px 16px;
    border-left: 4px solid var(--sport-muscu);
    background: var(--surface-2);
    border-radius: 0 var(--rayon-l) var(--rayon-l) 0;
    color: var(--texte);
    text-decoration: none;
  }
  .modeles a:hover {
    background: color-mix(in srgb, var(--sport-muscu) 14%, var(--surface-2));
  }
  .nom {
    font-family: var(--police-titre);
    font-size: 17px;
    font-weight: 700;
  }
  .detail {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .apres {
    margin-top: 20px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .lien {
    color: var(--texte);
    text-decoration: underline;
  }
</style>
