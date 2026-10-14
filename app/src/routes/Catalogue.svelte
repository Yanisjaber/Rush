<script>
  // Catalogue du design system : montre chaque composant avec des données d'exemple,
  // en thème sombre ou clair. Sert de référence pour construire les écrans.
  import Dossard from '../lib/components/Dossard.svelte';
  import Bloc from '../lib/components/Bloc.svelte';
  import ChipSport from '../lib/components/ChipSport.svelte';
  import StatCle from '../lib/components/StatCle.svelte';
  import Bouton from '../lib/components/Bouton.svelte';
  import CourbeLissee from '../lib/components/charts/CourbeLissee.svelte';
  import BarresEmpilees from '../lib/components/charts/BarresEmpilees.svelte';
  import Anneau from '../lib/components/charts/Anneau.svelte';
  import CarteChaleur from '../lib/components/charts/CarteChaleur.svelte';
  import { SPORTS } from '../lib/sports.js';

  // --- Thème sombre / clair (mémorisé si le navigateur le permet) ---
  let theme = $state('sombre');
  try {
    const memo = localStorage.getItem('rush-theme');
    if (memo === 'clair' || memo === 'sombre') theme = memo;
  } catch (e) {
    /* stockage indisponible : on garde le thème par défaut */
  }
  $effect(() => {
    document.documentElement.dataset.theme = theme === 'clair' ? 'light' : 'dark';
    try {
      localStorage.setItem('rush-theme', theme);
    } catch (e) {
      /* ignoré */
    }
  });

  // --- Données d'exemple ---
  const forme = [26, 30, 34, 38, 36, 42, 46, 48, 52, 56, 55, 58];
  const semaines = Array.from({ length: 12 }, (_, i) => (i === 11 ? 'Auj.' : `S-${11 - i}`));
  const series = [
    { nom: 'Course', couleur: 'var(--sport-course)', valeurs: [70, 80, 85, 90, 70, 95, 100, 90, 95, 105, 90, 100] },
    { nom: 'Vélo', couleur: 'var(--sport-velo)', valeurs: [90, 100, 110, 120, 85, 125, 130, 115, 120, 135, 105, 112] },
    { nom: 'Musculation', couleur: 'var(--sport-muscu)', valeurs: [60, 62, 64, 66, 60, 70, 72, 68, 72, 76, 70, 100] },
  ];
  const repartition = [
    { nom: 'Course', valeur: 3.67, couleur: 'var(--sport-course)' },
    { nom: 'Vélo', valeur: 2.17, couleur: 'var(--sport-velo)' },
    { nom: 'Musculation', valeur: 3.0, couleur: 'var(--sport-muscu)' },
  ];
  const couleursHeat = ['var(--sport-course)', 'var(--sport-velo)', 'var(--sport-muscu)'];
  const profilSemaine = [3, 0, 2, 0, 3, 2, 0];
  const cases = [];
  for (let j = 0; j < 7; j++) {
    for (let w = 0; w < 12; w++) {
      let niveau = profilSemaine[j];
      if (niveau > 0 && (w * 5 + j * 3) % 7 === 0) niveau = 0;
      cases.push({ couleur: couleursHeat[(w + j) % 3], intensite: niveau });
    }
  }

  let sportActif = $state('course');
  const jetons = [
    ['Fond', '--fond'],
    ['Surface', '--surface'],
    ['Surface 2', '--surface-2'],
    ['Trait', '--trait'],
    ['Texte', '--texte'],
    ['Texte doux', '--texte-doux'],
    ['Dossard', '--dossard-fond'],
  ];
</script>

<div class="page">
  <header class="entete">
    <div>
      <div class="sur-titre">Rush</div>
      <h1 class="titre">Design system</h1>
      <p class="intro">Les briques de l'app. La couleur désigne le sport, partout.</p>
    </div>
    <div class="theme" role="group" aria-label="Thème">
      <button type="button" aria-pressed={theme === 'sombre'} onclick={() => (theme = 'sombre')}>Sombre</button>
      <button type="button" aria-pressed={theme === 'clair'} onclick={() => (theme = 'clair')}>Clair</button>
    </div>
  </header>

  <section class="section">
    <h2 class="titre">Couleurs</h2>
    <div class="nuancier">
      {#each jetons as [nom, variable]}
        <div class="nuance">
          <span class="echantillon" style:background="var({variable})"></span>
          <span class="nom">{nom}</span>
          <code>{variable}</code>
        </div>
      {/each}
    </div>
    <div class="nuancier">
      {#each Object.entries(SPORTS).slice(0, 9) as [cle, sport]}
        <div class="nuance">
          <span class="echantillon" style:background={sport.couleur}></span>
          <span class="nom">{sport.nom}</span>
          <code>{cle}</code>
        </div>
      {/each}
    </div>
  </section>

  <section class="section">
    <h2 class="titre">Typographie</h2>
    <div class="typo">
      <div class="titre grand">J-63 · PUSH · 41'12"</div>
      <div class="titre moyen">Bricolage Grotesque, pour les titres et les chiffres</div>
      <p class="texte">Instrument Sans, pour tout le texte courant : lisible sur un téléphone en plein soleil, même en petit.</p>
    </div>
  </section>

  <section class="section">
    <h2 class="titre">Dossard</h2>
    <div class="ligne">
      <div class="col">
        <Dossard etiquette="Prochain objectif" nom="Ronde de Ramonville" valeur="J-63" detail="Dimanche 13 décembre · 10,15 km · objectif 40'00&quot;" />
      </div>
      <div class="col">
        <Dossard etiquette="Séance du jour" nom="Lundi 12 octobre" valeur="PUSH" detail="6 exercices · 22 séries · environ 65 min">
          <div class="espace"></div>
          <Bouton variante="sur-dossard">Démarrer la séance</Bouton>
        </Dossard>
      </div>
      <div class="col etroite">
        <Dossard taille="m" etiquette="Hyrox Open" valeur="J-27" detail="Dim. 8 nov." />
      </div>
    </div>
  </section>

  <section class="section">
    <h2 class="titre">Blocs, chiffres clés et boutons</h2>
    <div class="ligne">
      <div class="col">
        <Bloc titre="Surface">
          <div class="stats">
            <StatCle etiquette="Forme" valeur="+5" note="Frais" couleur="var(--ok)" />
            <StatCle etiquette="Condition" valeur="12" />
            <StatCle etiquette="Distance" valeur="38" unite="km" />
          </div>
        </Bloc>
      </div>
      <div class="col">
        <Bloc couleur="var(--sport-course)">
          <StatCle etiquette="Prédiction 10 km" valeur="41'12&quot;" note="+1'12&quot; sur l'objectif" />
        </Bloc>
      </div>
      <div class="col">
        <Bloc titre="Boutons">
          <div class="boutons">
            <Bouton>Continuer</Bouton>
            <Bouton variante="discret">Synchroniser</Bouton>
            <Bouton variante="texte">Passer cette étape</Bouton>
          </div>
        </Bloc>
      </div>
    </div>
  </section>

  <section class="section">
    <h2 class="titre">Puces de sport</h2>
    <div class="puces">
      <ChipSport label="Tout" sport="autre" actif={sportActif === 'tout'} onclick={() => (sportActif = 'tout')} />
      {#each ['course', 'velo', 'muscu', 'natation', 'hyrox'] as s}
        <ChipSport sport={s} actif={sportActif === s} onclick={() => (sportActif = s)} />
      {/each}
    </div>
  </section>

  <section class="section">
    <h2 class="titre">Graphiques</h2>
    <div class="ligne">
      <div class="col large">
        <Bloc titre="Charge d'entraînement, tous sports">
          <BarresEmpilees {series} etiquettes={semaines} ligne={forme} etiquette="Charge hebdomadaire par sport avec la courbe de condition" />
        </Bloc>
      </div>
      <div class="col">
        <Bloc titre="Volume par sport">
          <div class="centre">
            <Anneau segments={repartition} taille={170} etiquette="Répartition du volume entre course, vélo et musculation">
              <div class="titre gros">8h50</div>
              <div class="petit">cette semaine</div>
            </Anneau>
          </div>
        </Bloc>
      </div>
    </div>
    <div class="ligne">
      <div class="col">
        <Bloc titre="Courbe lissée">
          <CourbeLissee valeurs={[5.42, 5.4, 5.41, 5.36, 5.35, 5.32, 5.3, 5.25, 5.22, 5.18, 5.16, 5.12].map((v) => -v)} couleur="var(--sport-course)" hauteur={110} etiquette="Allure en endurance à cardio égal, en amélioration" />
        </Bloc>
      </div>
      <div class="col">
        <Bloc titre="Régularité">
          <CarteChaleur {cases} />
        </Bloc>
      </div>
    </div>
  </section>
</div>

<style>
  .entete {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    padding: 40px 0 24px;
  }
  .sur-titre {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--texte-doux);
  }
  h1 {
    font-size: 56px;
    line-height: 1;
    margin-top: 6px;
  }
  .intro {
    margin-top: 10px;
    color: var(--texte-doux);
  }
  .theme {
    display: inline-flex;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    overflow: hidden;
  }
  .theme button {
    min-height: var(--cible);
    padding: 0 20px;
    background: transparent;
    border: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-doux);
    cursor: pointer;
  }
  .theme button[aria-pressed='true'] {
    background: var(--texte);
    color: var(--fond);
  }

  .section {
    margin-top: 48px;
  }
  .section > h2 {
    font-size: 26px;
    margin-bottom: 16px;
    letter-spacing: -0.01em;
  }

  .nuancier {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 12px;
  }
  .nuance {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 120px;
    font-size: 13px;
  }
  .echantillon {
    height: 56px;
    border-radius: var(--rayon);
    border: 1px solid var(--trait);
  }
  .nuance code {
    font-size: 11px;
    color: var(--texte-doux);
  }

  .grand {
    font-size: 64px;
    line-height: 1;
  }
  .moyen {
    margin-top: 12px;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0;
  }
  .texte {
    margin-top: 10px;
    max-width: 560px;
    color: var(--texte-doux);
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
  .col.etroite {
    flex: 0 1 300px;
  }
  .espace {
    height: 8px;
  }
  .stats {
    display: flex;
    gap: 28px;
    flex-wrap: wrap;
  }
  .boutons {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .puces {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .centre {
    display: flex;
    justify-content: center;
  }
  .gros {
    font-size: 30px;
    line-height: 1;
  }
  .petit {
    font-size: 12px;
    color: var(--texte-doux);
  }

  @media (max-width: 600px) {
    h1 {
      font-size: 40px;
    }
  }
</style>
