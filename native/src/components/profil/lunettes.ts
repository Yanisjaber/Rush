import * as THREE from 'three';

/**
 * Lunettes posées sur le visage de l'avatar, fabriquées en code (aucun fichier à embarquer).
 *
 * On lance des rayons horizontaux vers la tête, à hauteur des yeux, tous les quelques degrés autour d'elle :
 * chaque point touché, repoussé de quelques millimètres, devient un sommet du verre, de la monture ou des branches.
 * Les lunettes épousent donc le nez, les pommettes et les tempes de CET avatar.
 *
 * Repère du modèle (three, y vers le haut) : le visage regarde vers +z, les yeux sont à y ≈ 1,66 m.
 */

/** Hauteur des yeux et centre de la tête (dans le repère du modèle, en mètres). */
const YEUX = { y: 1.656, x: 0, z: 0 };
const DECALAGE = 0.006; // le verre flotte à 6 mm de la peau
const DECALAGE_MONTURE = 0.0045; // la monture est un peu plus près : le verre la recouvre sans scintiller
const RAYON_TETE = 0.085; // sert seulement à convertir une largeur en angle

const degres = (d: number): number => (d * Math.PI) / 180;

/** Un verre : un secteur autour de la tête (angles en radians, 0 = de face) et ses bords bas et haut (m, relatifs aux yeux). */
export interface Lentille {
  a0: number;
  a1: number;
  bas: (angle: number) => number;
  haut: (angle: number) => number;
}

export interface StyleLunettes {
  nom: string;
  couleurVerre: number;
  opaciteVerre: number;
  metalVerre: number;
  couleurMonture: number;
  /** Monture autour du verre, seulement en haut, ou aucune (verre sans cadre). */
  cadre: 'complet' | 'haut' | 'aucun';
  /** Épaisseur de la monture (m). */
  epaisseurCadre: number;
  lentilles: Lentille[];
  /** Petite barre entre deux verres séparés. */
  pont: boolean;
  /** Angle où les branches quittent le verre (rad). */
  attacheBranche: number;
}

/** Verre en ovale ou en carré arrondi (exposant 2 = ellipse, plus grand = plus carré). `goutte` agrandit le bas (aviateur). */
function lentilleOvale(centre: number, demiLargeur: number, demiHauteur: number, exposant: number, decalageY = 0, goutte = 0): Lentille {
  const profil = (angle: number): number => {
    const t = Math.min(1, Math.abs(angle - centre) / demiLargeur);
    return Math.pow(Math.max(0, 1 - Math.pow(t, exposant)), 1 / exposant);
  };
  return {
    a0: centre - demiLargeur,
    a1: centre + demiLargeur,
    bas: (angle) => decalageY - demiHauteur * (1 + goutte) * profil(angle),
    haut: (angle) => decalageY + demiHauteur * (1 - goutte * 0.5) * profil(angle),
  };
}

/** Deux verres symétriques, de part et d'autre du nez. */
function deuxVerres(centre: number, demiLargeur: number, demiHauteur: number, exposant: number, decalageY = 0, goutte = 0): Lentille[] {
  return [
    lentilleOvale(-centre, demiLargeur, demiHauteur, exposant, decalageY, goutte),
    lentilleOvale(centre, demiLargeur, demiHauteur, exposant, decalageY, goutte),
  ];
}

/** Masque d'un seul tenant : s'amincit vers les tempes et remonte au centre pour laisser passer le nez. */
function masque(limite: number, demiHauteur: number): Lentille[] {
  const fin = (angle: number): number => 1 - 0.5 * Math.pow(Math.abs(angle) / limite, 2.5);
  const nez = (angle: number): number => {
    const t = Math.max(0, 1 - Math.abs(angle) / degres(13));
    return 0.014 * t * t * (3 - 2 * t);
  };
  return [{
    a0: -limite,
    a1: limite,
    bas: (angle) => -demiHauteur * 0.9 * fin(angle) + nez(angle),
    haut: (angle) => demiHauteur * fin(angle),
  }];
}

export const STYLES_LUNETTES: Record<string, StyleLunettes> = {
  masqueFume: {
    nom: 'Masque fumé', couleurVerre: 0x1b2631, opaciteVerre: 0.5, metalVerre: 0.15, couleurMonture: 0x101014,
    cadre: 'complet', epaisseurCadre: 0.005, lentilles: masque(degres(60), 0.018), pont: false, attacheBranche: degres(60),
  },
  masqueMiroirBleu: {
    nom: 'Masque miroir bleu', couleurVerre: 0x2f6fd0, opaciteVerre: 0.62, metalVerre: 0.5, couleurMonture: 0xf3f2ee,
    cadre: 'haut', epaisseurCadre: 0.006, lentilles: masque(degres(62), 0.019), pont: false, attacheBranche: degres(62),
  },
  masqueOrange: {
    nom: 'Masque orange clair', couleurVerre: 0xf08a24, opaciteVerre: 0.5, metalVerre: 0.1, couleurMonture: 0x16161a,
    cadre: 'aucun', epaisseurCadre: 0, lentilles: masque(degres(60), 0.019), pont: false, attacheBranche: degres(60),
  },
  sportDoubleRouge: {
    nom: 'Sport double verre, monture rouge', couleurVerre: 0x2b2024, opaciteVerre: 0.5, metalVerre: 0.2, couleurMonture: 0xc8102e,
    cadre: 'complet', epaisseurCadre: 0.004, lentilles: deuxVerres(degres(25), degres(14.5), 0.019, 2.6, -0.002, 0.15), pont: true, attacheBranche: degres(43),
  },
  rondRetro: {
    nom: 'Rond rétro', couleurVerre: 0x3a4a3a, opaciteVerre: 0.48, metalVerre: 0.1, couleurMonture: 0xb8963e,
    cadre: 'complet', epaisseurCadre: 0.0025, lentilles: deuxVerres(degres(25), degres(13), 0.022, 2, -0.002), pont: true, attacheBranche: degres(39),
  },
  aviateur: {
    nom: 'Aviateur', couleurVerre: 0x40382c, opaciteVerre: 0.5, metalVerre: 0.2, couleurMonture: 0xc9ccd2,
    cadre: 'complet', epaisseurCadre: 0.0025, lentilles: deuxVerres(degres(25), degres(14.5), 0.021, 2, -0.002, 0.35), pont: true, attacheBranche: degres(41),
  },
  carreNoir: {
    nom: 'Carré noir épais', couleurVerre: 0x15191f, opaciteVerre: 0.58, metalVerre: 0.1, couleurMonture: 0x0c0c0e,
    cadre: 'complet', epaisseurCadre: 0.0065, lentilles: deuxVerres(degres(25), degres(14.5), 0.017, 5, -0.001), pont: true, attacheBranche: degres(41),
  },
  demiMonture: {
    nom: 'Demi-monture sport', couleurVerre: 0x9fb4c4, opaciteVerre: 0.32, metalVerre: 0.3, couleurMonture: 0x2fa7a3,
    cadre: 'haut', epaisseurCadre: 0.005, lentilles: deuxVerres(degres(25), degres(15), 0.019, 3, -0.001), pont: true, attacheBranche: degres(42),
  },
};

export const STYLE_PAR_DEFAUT = 'masqueFume';

export interface Lunettes {
  groupe: THREE.Group;
  /** À libérer quand l'avatar est détruit. */
  ressources: { dispose: () => void }[];
}

interface Bande {
  a0: number;
  a1: number;
  h0: (angle: number) => number;
  h1: (angle: number) => number;
  materiau: THREE.Material;
  decalage: number;
}

/** Crée les lunettes, ou `null` si la tête n'est pas trouvée sous les rayons. */
export function creerLunettes(modele: THREE.Object3D, style: StyleLunettes = STYLES_LUNETTES[STYLE_PAR_DEFAUT]): Lunettes | null {
  // Le parent (le groupe décalé de la scène) et tous les sous-objets doivent être à jour avant de lancer des rayons.
  modele.updateWorldMatrix(true, true);
  const raycaster = new THREE.Raycaster();
  const ressources: { dispose: () => void }[] = [];

  const verre = new THREE.MeshStandardMaterial({
    color: style.couleurVerre, roughness: 0.12, metalness: style.metalVerre, transparent: true, opacity: style.opaciteVerre, side: THREE.DoubleSide,
  });
  const monture = new THREE.MeshStandardMaterial({ color: style.couleurMonture, roughness: 0.5, metalness: 0.15, side: THREE.DoubleSide });
  ressources.push(verre, monture);

  /** Point de la peau (ou des cheveux) vu depuis l'axe de la tête, à l'angle et à la hauteur donnés. */
  const surface = (angle: number, hauteur: number, decalage: number): THREE.Vector3 | null => {
    const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const centre = new THREE.Vector3(YEUX.x, hauteur, YEUX.z);
    const origine = modele.localToWorld(centre.clone().addScaledVector(dir, 0.5));
    const versCentre = modele.localToWorld(centre.clone()).sub(origine).normalize();
    raycaster.set(origine, versCentre);
    const touche = raycaster.intersectObject(modele, true)[0];
    if (!touche) return null;
    return modele.worldToLocal(touche.point.clone()).addScaledVector(dir, decalage);
  };

  const fabriquer = ({ a0, a1, h0, h1, materiau, decalage }: Bande): THREE.Mesh | null => {
    const colonnes = Math.max(3, Math.round(Math.abs(a1 - a0) / degres(2.5)));
    const lignes = 6;
    const positions: number[] = [];
    for (let j = 0; j <= lignes; j++) {
      for (let i = 0; i <= colonnes; i++) {
        const angle = a0 + ((a1 - a0) * i) / colonnes;
        const bas = h0(angle);
        const p = surface(angle, YEUX.y + bas + ((h1(angle) - bas) * j) / lignes, decalage);
        if (!p) return null;
        positions.push(p.x, p.y, p.z);
      }
    }
    const indices: number[] = [];
    for (let j = 0; j < lignes; j++) {
      for (let i = 0; i < colonnes; i++) {
        const a = j * (colonnes + 1) + i;
        const b = a + 1;
        const c = a + colonnes + 1;
        indices.push(a, c, b, b, c, c + 1);
      }
    }
    const geometrie = new THREE.BufferGeometry();
    geometrie.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometrie.setIndex(indices);
    geometrie.computeVertexNormals();
    ressources.push(geometrie);
    const mesh = new THREE.Mesh(geometrie, materiau);
    mesh.renderOrder = materiau === verre ? 6 : 5;
    return mesh;
  };

  const bandes: Bande[] = [];
  const e = style.epaisseurCadre;
  const de = e / RAYON_TETE; // épaisseur de monture convertie en angle
  for (const l of style.lentilles) {
    bandes.push({ a0: l.a0, a1: l.a1, h0: l.bas, h1: l.haut, materiau: verre, decalage: DECALAGE });
    if (style.cadre === 'complet') {
      // La monture est le même contour, un peu plus grand, posé juste dessous : seul le bord dépasse.
      bandes.push({ a0: l.a0 - de, a1: l.a1 + de, h0: (a) => l.bas(a) - e, h1: (a) => l.haut(a) + e, materiau: monture, decalage: DECALAGE_MONTURE });
    } else if (style.cadre === 'haut') {
      bandes.push({ a0: l.a0 - de, a1: l.a1 + de, h0: l.haut, h1: (a) => l.haut(a) + e * 1.2, materiau: monture, decalage: DECALAGE_MONTURE });
    }
  }
  if (style.pont && style.lentilles.length === 2) {
    const [gauche, droite] = style.lentilles;
    bandes.push({ a0: gauche.a1 - de, a1: droite.a0 + de, h0: () => 0.003, h1: () => 0.003 + Math.max(0.004, e * 1.4), materiau: monture, decalage: DECALAGE_MONTURE });
  }
  // Branches : du bord extérieur du verre jusqu'au-dessus de l'oreille.
  const bordHaut = Math.max(...style.lentilles.map((l) => l.a1));
  const attache = Math.max(style.attacheBranche, bordHaut);
  const exterieure = style.lentilles.reduce((a, b) => (b.a1 > a.a1 ? b : a));
  const hauteurBranche = (exterieure.haut(bordHaut - 0.02) + exterieure.bas(bordHaut - 0.02)) / 2 + 0.002;
  for (const signe of [1, -1]) {
    const a0 = signe > 0 ? attache : -degres(98);
    const a1 = signe > 0 ? degres(98) : -attache;
    bandes.push({ a0, a1, h0: () => hauteurBranche - 0.003, h1: () => hauteurBranche + 0.003, materiau: monture, decalage: DECALAGE_MONTURE });
  }

  const groupe = new THREE.Group();
  groupe.name = 'Lunettes';
  for (const bande of bandes) {
    const mesh = fabriquer(bande);
    if (!mesh) {
      ressources.forEach((r) => r.dispose());
      return null;
    }
    groupe.add(mesh);
  }
  modele.add(groupe);
  return { groupe, ressources };
}
