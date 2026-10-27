<script>
  // Écran affiché à la place de toute l'app web pendant la refonte (l'app native prend le relais).
</script>

<main class="refonte">
  <div class="dossard">
    <span class="point haut-gauche"></span>
    <span class="point haut-droite"></span>
    <span class="point bas-gauche"></span>
    <span class="point bas-droite"></span>
    <p class="nom">Rush</p>
    <h1>En refonte</h1>
    <p class="texte">Le site fait peau neuve. Il revient bientôt, reste dans les parages.</p>
  </div>
</main>

<style>
  .refonte {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
  }
  .dossard {
    position: relative;
    width: min(100%, 420px);
    padding: 40px 32px;
    background: var(--dossard-fond);
    color: var(--dossard-texte);
    border-radius: 6px;
    transform: rotate(-1.5deg);
  }
  .point {
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--fond);
  }
  .haut-gauche { top: 12px; left: 12px; }
  .haut-droite { top: 12px; right: 12px; }
  .bas-gauche { bottom: 12px; left: 12px; }
  .bas-droite { bottom: 12px; right: 12px; }
  .nom {
    font-family: var(--police-titre, 'Bricolage Grotesque Variable', sans-serif);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.9rem;
    margin-bottom: 8px;
  }
  h1 {
    font-family: var(--police-titre, 'Bricolage Grotesque Variable', sans-serif);
    font-size: clamp(2.4rem, 12vw, 3.4rem);
    line-height: 1;
    margin-bottom: 16px;
  }
  .texte {
    font-size: 1.05rem;
  }
</style>
