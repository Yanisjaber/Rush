// Les chiffres du ski calculés depuis les flux d'une sortie : le dénivelé descendu, le nombre de descentes, la vitesse max et l'altitude max.
// On lisse l'altitude, puis on repère les sommets et les creux (un mouvement de moins de 8 m n'est que du bruit). Une descente est une baisse d'au moins 40 m
// parcourue à plus de 7 km/h en moyenne (une remontée en télésiège ou à peaux ne descend pas). Fonction pure, aucun écran, aucun réseau.
import type { FluxBruts } from './courbes-sortie.ts';

export interface StatsSki {
  /** Somme de toutes les baisses (m, entier). */
  descenteM: number;
  /** Les descentes d'au moins 40 m. */
  descentes: number;
  /** Vitesse la plus haute (km/h, entier), sans les points aberrants. */
  vmaxKmh: number | null;
  /** Altitude la plus haute (m, entier). */
  altMax: number | null;
}

const SEUIL_BRUIT_M = 8;
const DESCENTE_MIN_M = 40;
const VITESSE_MIN_MS = 2; // 7 km/h
const VITESSE_MAX_KMH = 150; // au-delà, un point de GPS faux

const fini = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function lisser(a: number[], fenetre: number): number[] {
  const demi = Math.floor(fenetre / 2);
  return a.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let j = Math.max(0, i - demi); j <= Math.min(a.length - 1, i + demi); j++) {
      if (fini(a[j])) {
        s += a[j];
        n++;
      }
    }
    return n ? s / n : NaN;
  });
}

/** Les sommets et les creux de l'altitude lissée : on suit l'extrême courant, et on le valide quand l'altitude s'en éloigne de plus que le bruit. */
function sommets(alt: number[]): { i: number; v: number }[] {
  const points: { i: number; v: number }[] = [];
  let ext = { i: 0, v: alt.find(fini) ?? 0 };
  let sens = 0; // 0 = pas encore décidé, 1 = on monte (on cherche un sommet), -1 = on descend (on cherche un creux)
  alt.forEach((v, i) => {
    if (!fini(v)) return;
    if (sens === 0) {
      if (v - ext.v >= SEUIL_BRUIT_M || ext.v - v >= SEUIL_BRUIT_M) {
        points.push(ext);
        sens = v > ext.v ? 1 : -1;
        ext = { i, v };
      }
    } else if (sens === 1) {
      if (v > ext.v) ext = { i, v };
      else if (ext.v - v >= SEUIL_BRUIT_M) {
        points.push(ext);
        sens = -1;
        ext = { i, v };
      }
    } else if (v < ext.v) ext = { i, v };
    else if (v - ext.v >= SEUIL_BRUIT_M) {
      points.push(ext);
      sens = 1;
      ext = { i, v };
    }
  });
  points.push(ext);

  return points;
}

export function statsSki(brut: FluxBruts | null | undefined): StatsSki | null {
  const altBrute = brut?.altitude;
  if (!brut || !altBrute || altBrute.length < 30) return null;
  const alt = lisser(altBrute, 7);
  const vit = brut.vitesse && brut.vitesse.length === alt.length ? brut.vitesse : null;

  const points = sommets(alt);

  let descenteM = 0;
  let descentes = 0;
  for (let k = 1; k < points.length; k++) {
    const baisse = points[k - 1].v - points[k].v;
    if (baisse <= 0) continue;
    descenteM += baisse;
    if (baisse < DESCENTE_MIN_M) continue;
    if (vit) {
      const tranche = vit.slice(points[k - 1].i, points[k].i + 1).filter(fini);
      if (!tranche.length || tranche.reduce((a, b) => a + b, 0) / tranche.length < VITESSE_MIN_MS) continue;
    }
    descentes++;
  }

  const vmax = vit ? Math.max(0, ...vit.filter((v) => fini(v) && v * 3.6 <= VITESSE_MAX_KMH)) * 3.6 : 0;
  const altitudes = alt.filter(fini);
  return {
    descenteM: Math.round(descenteM),
    descentes,
    vmaxKmh: vmax > 0 ? Math.round(vmax) : null,
    altMax: altitudes.length ? Math.round(Math.max(...altitudes)) : null,
  };
}

export interface EtapeSki {
  type: 'montee' | 'descente';
  /** Secondes depuis le début de la sortie. */
  debutS: number;
  dureeS: number;
  /** Dénivelé monté (montée) ou descendu (descente), en mètres. */
  deniveleM: number;
  /** Vitesse max de la descente (km/h) ; null pour une montée ou sans vitesse. */
  vmaxKmh: number | null;
}

/**
 * La journée de ski en étapes : remontées (télésiège, peaux, marche) et descentes, dans l'ordre. Une baisse trop courte ou trop lente n'est pas une descente :
 * elle se fond dans la montée qui l'entoure. Null sans altitude ni temps.
 */
export function journeeSki(brut: FluxBruts | null | undefined): EtapeSki[] | null {
  const altBrute = brut?.altitude;
  const temps = brut?.temps;
  if (!brut || !altBrute || !temps || altBrute.length < 30 || temps.length !== altBrute.length) return null;
  const alt = lisser(altBrute, 7);
  const vit = brut.vitesse && brut.vitesse.length === alt.length ? brut.vitesse : null;
  const points = sommets(alt);
  if (points.length < 2) return null;

  const etapes: EtapeSki[] = [];
  for (let k = 1; k < points.length; k++) {
    const [a, b] = [points[k - 1], points[k]];
    const delta = b.v - a.v;
    const tranche = vit ? vit.slice(a.i, b.i + 1).filter(fini) : [];
    const moyenne = tranche.length ? tranche.reduce((x, y) => x + y, 0) / tranche.length : null;
    const descente = -delta >= DESCENTE_MIN_M && (moyenne == null || moyenne >= VITESSE_MIN_MS);
    const duree = Math.max(0, temps[b.i] - temps[a.i]);
    const vmax = descente && tranche.length ? Math.max(...tranche.filter((v) => v * 3.6 <= VITESSE_MAX_KMH)) * 3.6 : 0;
    const dernier = etapes[etapes.length - 1];
    if (descente) etapes.push({ type: 'descente', debutS: temps[a.i], dureeS: duree, deniveleM: Math.round(-delta), vmaxKmh: vmax > 0 ? Math.round(vmax) : null });
    else if (dernier?.type === 'montee') {
      dernier.dureeS += duree;
      if (delta > 0) dernier.deniveleM += Math.round(delta);
    } else etapes.push({ type: 'montee', debutS: temps[a.i], dureeS: duree, deniveleM: Math.max(0, Math.round(delta)), vmaxKmh: null });
  }
  return etapes.filter((e) => e.type === 'descente' || (e.dureeS >= 30 && e.deniveleM >= 10));
}
