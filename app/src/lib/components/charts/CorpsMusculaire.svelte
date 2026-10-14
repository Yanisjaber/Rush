<script>
  import { onMount } from 'svelte';

  // Corps humain en 3D (three.js) découpé en groupes musculaires : plus la zone est foncée, plus tu l'as travaillée.
  // Le corps est fabriqué en code (formes simples assemblées, aucun modèle ni image externe). Il tourne doucement,
  // on le fait tourner au doigt ; on touche une zone (ou sa ligne dans la liste) pour voir le détail.
  // groupes : [{ groupe, nom, series, parSemaine, cible: [bas, haut], etat, pct, exercices: [{ nom, series }] }]
  let { groupes = [], etiquette = 'Corps humain en 3D' } = $props();

  let conteneur;
  let choisi = $state(null); // clé du groupe sélectionné
  let webgl = $state(true);
  let api = null; // { teindre, surligner } fournis par la scène une fois chargée

  const NOM_ETAT = { oublie: 'Oublié', sous: 'Sous la zone visée', zone: 'Dans la zone visée', 'au-dessus': 'Au-dessus de la zone visée' };
  const detail = $derived(groupes.find((g) => g.groupe === choisi) || null);
  const virgule = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

  // La scène se reteint quand les données ou la sélection changent
  $effect(() => {
    const g = groupes;
    api?.teindre(g);
  });
  $effect(() => {
    api?.surligner(choisi);
  });

  onMount(() => {
    let annule = false;
    let liberer = () => {};
    (async () => {
      try {
        const [THREE, { OrbitControls }] = await Promise.all([import('three'), import('three/addons/controls/OrbitControls.js')]);
        if (annule) return;
        liberer = construire(THREE, OrbitControls);
      } catch {
        webgl = false; // pas de WebGL : la liste à droite reste complète
      }
    })();
    return () => {
      annule = true;
      liberer();
    };
  });

  function construire(THREE, OrbitControls) {
    const css = (nom) => getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
    const couleurs = () => ({ accent: new THREE.Color(css('--sport-muscu') || '#ff5a4f'), base: new THREE.Color(css('--trait-fort') || '#3a3f4c'), neutre: new THREE.Color(css('--surface-2') || '#1b1e25') });

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', etiquette);
    conteneur.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    camera.position.set(0, 0.98, 3.85);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 1.15));
    const soleil = new THREE.DirectionalLight(0xffffff, 1.6);
    soleil.position.set(2.5, 3.5, 3);
    scene.add(soleil);
    const contre = new THREE.DirectionalLight(0xffffff, 0.7);
    contre.position.set(-2.5, 2, -3);
    scene.add(contre);

    const corps = new THREE.Group();
    scene.add(corps);
    const parGroupe = new Map(); // clé du groupe → liste de meshes
    const neutres = [];

    const ajouter = (geo, groupe, x, y, z, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) => {
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.scale.set(sx, sy, sz);
      m.userData.groupe = groupe;
      corps.add(m);
      if (groupe) {
        if (!parGroupe.has(groupe)) parGroupe.set(groupe, []);
        parGroupe.get(groupe).push(m);
      } else neutres.push(m);
      return m;
    };
    const sph = (r) => new THREE.SphereGeometry(r, 32, 24);
    const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 10, 20);
    const cote = (f) => [-1, 1].forEach(f);

    // Tête, cou, bassin (neutres)
    ajouter(sph(0.105), null, 0, 1.7, 0.01, { sy: 1.12 });
    ajouter(new THREE.CylinderGeometry(0.048, 0.055, 0.12, 20), null, 0, 1.57, 0);
    ajouter(sph(1), null, 0, 0.98, 0, { sx: 0.175, sy: 0.1, sz: 0.1 });
    // Tronc de base (neutre), les muscles par-dessus
    ajouter(sph(1), null, 0, 1.28, 0, { sx: 0.165, sy: 0.25, sz: 0.095 });
    // Pectoraux, épaules, tronc, dos
    cote((s) => ajouter(sph(1), 'pectoraux', s * 0.09, 1.4, 0.065, { sx: 0.092, sy: 0.075, sz: 0.06, rz: s * -0.15 }));
    cote((s) => ajouter(sph(0.07), 'epaules', s * 0.215, 1.47, 0, { sy: 1.1 }));
    ajouter(sph(1), 'tronc', 0, 1.14, 0.045, { sx: 0.125, sy: 0.15, sz: 0.06 });
    cote((s) => ajouter(sph(1), 'tronc', s * 0.145, 1.14, 0.0, { sx: 0.04, sy: 0.14, sz: 0.075 }));
    ajouter(sph(1), 'dos', 0, 1.34, -0.075, { sx: 0.19, sy: 0.21, sz: 0.05 });
    ajouter(sph(1), 'dos', 0, 1.5, -0.05, { sx: 0.12, sy: 0.05, sz: 0.05 });
    // Bras (haut du bras, avant-bras) et mains
    cote((s) => ajouter(cap(0.045, 0.2), 'bras', s * 0.27, 1.31, 0, { rz: s * 0.08 }));
    cote((s) => ajouter(cap(0.037, 0.2), 'bras', s * 0.305, 1.04, 0.01, { rz: s * 0.05 }));
    cote((s) => ajouter(sph(0.04), null, s * 0.32, 0.88, 0.01, { sy: 1.2 }));
    // Jambes : fessiers, cuisses, genoux (neutres), mollets, pieds (neutres)
    cote((s) => ajouter(sph(1), 'jambes', s * 0.09, 0.93, -0.055, { sx: 0.09, sy: 0.09, sz: 0.08 }));
    cote((s) => ajouter(cap(0.078, 0.3), 'jambes', s * 0.1, 0.72, 0.005, { rz: s * 0.025 }));
    cote((s) => ajouter(sph(0.062), null, s * 0.105, 0.49, 0.01));
    cote((s) => ajouter(cap(0.056, 0.28), 'jambes', s * 0.105, 0.27, -0.005));
    cote((s) => ajouter(sph(1), null, s * 0.105, 0.04, 0.045, { sx: 0.05, sy: 0.035, sz: 0.1 }));

    const controles = new OrbitControls(camera, renderer.domElement);
    controles.target.set(0, 0.95, 0);
    controles.enablePan = false;
    controles.enableZoom = false; // la molette sert à faire défiler la page
    controles.enableDamping = true;
    controles.minPolarAngle = controles.maxPolarAngle = Math.PI / 2; // rotation horizontale seulement
    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    controles.autoRotate = !reduit;
    controles.autoRotateSpeed = 1.4;
    controles.addEventListener('start', () => (controles.autoRotate = false));
    renderer.domElement.style.touchAction = 'pan-y'; // sur téléphone, un glissement vertical fait défiler la page
    renderer.domElement.style.cursor = 'grab';

    // Teinte : du gris (zone jamais travaillée) au corail du muscu (130 % de la zone visée ou plus)
    let donnees = [];
    const teindre = (liste) => {
      donnees = liste;
      const { accent, base, neutre } = couleurs();
      for (const m of neutres) m.material.color.copy(neutre).lerp(base, 0.8);
      for (const [cle, meshes] of parGroupe) {
        const g = liste.find((x) => x.groupe === cle);
        const t = g ? Math.min(Math.max(g.pct, 0), 130) / 130 : 0;
        for (const m of meshes) m.material.color.copy(base).lerp(accent, t);
      }
    };
    const surligner = (cle) => {
      const { accent } = couleurs();
      // sélection par simple lueur : on ne touche pas aux tailles des formes
      for (const [k, meshes] of parGroupe) for (const m of meshes) {
        m.material.emissive.copy(accent).multiplyScalar(k === cle ? 0.32 : 0);
      }
    };
    api = { teindre, surligner };
    teindre(groupes);
    surligner(choisi);

    // Toucher une zone la sélectionne ; toucher le vide la désélectionne
    const rayon = new THREE.Raycaster();
    const pointeur = new THREE.Vector2();
    let depart = null;
    const sous = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointeur.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rayon.setFromCamera(pointeur, camera);
      return rayon.intersectObjects(corps.children, false)[0]?.object.userData.groupe || null;
    };
    const onDown = (e) => (depart = { x: e.clientX, y: e.clientY });
    const onUp = (e) => {
      if (!depart || Math.hypot(e.clientX - depart.x, e.clientY - depart.y) > 6) return; // c'était un glissement, pas un toucher
      const g = sous(e);
      choisi = g === choisi ? null : g;
    };
    const onMove = (e) => {
      if (e.buttons) return;
      renderer.domElement.style.cursor = sous(e) ? 'pointer' : 'grab';
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointermove', onMove);

    const redimensionner = () => {
      const w = conteneur.clientWidth || 300;
      const h = conteneur.clientHeight || 440;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    redimensionner();
    const obs = new ResizeObserver(redimensionner);
    obs.observe(conteneur);
    // Changement de thème (clair/sombre) : on reteint
    const theme = new MutationObserver(() => {
      teindre(donnees);
      surligner(choisi);
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

    renderer.setAnimationLoop(() => {
      controles.update();
      renderer.render(scene, camera);
    });

    return () => {
      api = null;
      renderer.setAnimationLoop(null);
      obs.disconnect();
      theme.disconnect();
      controles.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointermove', onMove);
      for (const m of corps.children) {
        m.geometry.dispose();
        m.material.dispose();
      }
      renderer.dispose();
      renderer.domElement.remove();
    };
  }
</script>

<div class="corps">
  <div class="scene" bind:this={conteneur}>
    {#if !webgl}<p class="repli">Ton navigateur n'affiche pas la 3D : la liste à côté donne les mêmes chiffres.</p>{/if}
  </div>

  <div class="infos">
    <ul class="liste">
      {#each groupes as g (g.groupe)}
        <li>
          <button type="button" class:actif={choisi === g.groupe} aria-pressed={choisi === g.groupe} onclick={() => (choisi = choisi === g.groupe ? null : g.groupe)}>
            <span class="ligne"><span class="nom">{g.nom}</span><span class="pct">{g.pct} %</span></span>
            <span class="barre" aria-hidden="true"><span style:width="{Math.min(g.pct, 130) / 1.3}%"></span></span>
          </button>
        </li>
      {/each}
    </ul>

    <div class="detail" aria-live="polite">
      {#if detail}
        <h4>{detail.nom}</h4>
        <p class="grand">{detail.pct} % <span>de la zone visée</span></p>
        <p class="texte">{virgule(detail.parSemaine)} séries par semaine pour une zone de {detail.cible[0]} à {detail.cible[1]} : <strong>{NOM_ETAT[detail.etat]}</strong>.</p>
        {#if detail.exercices.length}
          <p class="mini">{detail.exercices.length} exercice{detail.exercices.length > 1 ? 's' : ''} sur 4 semaines</p>
          <ul class="exos">
            {#each detail.exercices.slice(0, 6) as x (x.nom)}<li><span>{x.nom}</span><b>{x.series}</b></li>{/each}
          </ul>
        {:else}
          <p class="texte">Aucun exercice sur ce groupe ces 4 dernières semaines.</p>
        {/if}
      {:else}
        <p class="texte">Touche une zone du corps (ou une ligne de la liste) pour voir le détail. Fais glisser le corps pour le tourner.</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .corps {
    display: grid;
    grid-template-columns: minmax(240px, 1fr) minmax(260px, 1fr);
    gap: 20px 32px;
    align-items: start;
  }
  .scene {
    position: relative;
    height: clamp(360px, 52vw, 500px);
    border-radius: var(--rayon-l);
    background: var(--surface-2);
    overflow: hidden;
  }
  .repli {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 20px;
    text-align: center;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .liste {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .liste button {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid transparent;
    border-radius: var(--rayon-l);
    background: var(--surface-2);
    color: var(--texte);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .liste button:hover {
    border-color: var(--trait-fort);
  }
  .liste button.actif {
    border-color: var(--sport-muscu);
  }
  .liste button:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .ligne {
    display: flex;
    justify-content: space-between;
    font-size: 15px;
  }
  .nom {
    font-weight: 600;
  }
  .pct {
    font-family: var(--police-titre);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .barre {
    display: block;
    height: 4px;
    border-radius: 2px;
    background: var(--trait-fort);
    overflow: hidden;
  }
  .barre span {
    display: block;
    height: 100%;
    background: var(--sport-muscu);
  }
  .detail {
    margin-top: 16px;
    padding: 14px 16px;
    border-radius: var(--rayon-l);
    border: 1px solid var(--trait);
  }
  .detail h4 {
    font-size: 16px;
  }
  .grand {
    margin: 4px 0 0;
    font-family: var(--police-titre);
    font-size: 32px;
    font-weight: 700;
    line-height: 1.1;
  }
  .grand span {
    font-family: var(--police-texte);
    font-size: 14px;
    font-weight: 400;
    color: var(--texte-doux);
  }
  .texte {
    margin: 8px 0 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .texte strong {
    color: var(--texte);
  }
  .mini {
    margin: 12px 0 4px;
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-muet);
  }
  .exos {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .exos li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 5px 0;
    border-bottom: 1px solid var(--trait);
    font-size: 14px;
  }
  .exos li:last-child {
    border-bottom: 0;
  }
  @media (max-width: 640px) {
    .corps {
      grid-template-columns: 1fr;
    }
  }
</style>
