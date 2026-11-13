// Mouvement « vivant » de l'avatar au repos : petites rotations des os du squelette selon le temps.
// Fonction pure (sans three.js) : testable avec node. Le composant 3D l'applique image par image.
//
// Repère du modèle (glTF) : X = côté gauche de la personne, Y = haut, Z = devant. Angles en radians,
// autour des axes du modèle (pas des axes propres à chaque os) : c'est le composant qui convertit.

export type Axe = 'x' | 'y' | 'z';

/** Os du squelette animés (noms du GLB). */
export type OsAnime =
  | 'Hips' | 'Spine02' | 'Spine01' | 'LeftUpLeg' | 'RightUpLeg'
  | 'LeftShoulder' | 'RightShoulder' | 'LeftArm' | 'RightArm' | 'LeftForeArm' | 'RightForeArm'
  | 'neck' | 'Head';

export interface PoseVivante {
  /** 0 (poumons vides) à 1 (inspiration complète). */
  souffle: number;
  /** Décalage du bassin sur le côté (m). */
  bassinX: number;
  rotations: Record<OsAnime, Partial<Record<Axe, number>>>;
}

/** Durée de chaque mouvement (s). Le souffle et le poids se recalent toutes les 8,4 s environ. */
export const PERIODES = { souffle: 4.2, poids: 8, bras: 5.2, regard: 11, regardVif: 6.3 } as const;

/** Hauteur de la hanche au-dessus du sol (m) : sert à garder les pieds plantés quand le bassin glisse. */
const HAUTEUR_HANCHE = 0.89;

const onde = (t: number, periode: number, phase = 0): number => Math.sin((2 * Math.PI * t) / periode + phase);

export function poseVivante(t: number): PoseVivante {
  // Respiration : montée douce puis descente (cosinus), jamais d'à-coup.
  const souffle = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / PERIODES.souffle);

  // Transfert du poids d'une jambe sur l'autre : le bassin glisse et penche, le dos compense.
  const poids = onde(t, PERIODES.poids);
  const bassinX = 0.012 * poids;
  const roulis = 0.022 * poids;
  // Les cuisses tournent à l'inverse du bassin (penché + décalé) : les pieds ne bougent pas.
  const jambe = -(roulis + Math.atan2(bassinX, HAUTEUR_HANCHE));

  // Épaules qui montent à l'inspiration ; les bras compensent pour rester le long du corps.
  const epaule = 0.028 * souffle;

  // Bras : léger balancier d'avant en arrière, gauche et droite décalés.
  const brasG = 0.03 * onde(t, PERIODES.bras);
  const brasD = 0.03 * onde(t, PERIODES.bras, 1.9);

  // Regard : la tête tourne un peu (deux rythmes mélangés pour ne pas faire mécanique) et hoche avec le souffle.
  const lacet = 0.08 * onde(t, PERIODES.regard) + 0.03 * onde(t, PERIODES.regardVif, 1.3);
  const hoche = 0.02 * onde(t, PERIODES.souffle, -0.6);

  return {
    souffle,
    bassinX,
    rotations: {
      Hips: { z: roulis },
      LeftUpLeg: { z: jambe },
      RightUpLeg: { z: jambe },
      Spine02: { z: -0.6 * roulis, x: -0.01 * souffle },
      Spine01: { z: -0.4 * roulis, x: -0.012 * souffle },
      LeftShoulder: { z: epaule },
      RightShoulder: { z: -epaule },
      LeftArm: { z: -epaule, x: brasG },
      RightArm: { z: epaule, x: brasD },
      LeftForeArm: { x: 0.6 * brasG },
      RightForeArm: { x: 0.6 * brasD },
      neck: { y: 0.4 * lacet, x: 0.4 * hoche + 0.004 * souffle },
      Head: { y: 0.6 * lacet, x: 0.6 * hoche },
    },
  };
}
