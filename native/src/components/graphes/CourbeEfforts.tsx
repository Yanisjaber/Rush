import { Fragment } from 'react';
import Svg, { Circle, Line, Path, Rect, Text as TexteSvg } from 'react-native-svg';
import { ZoneTactile } from '@/components/graphes/ZoneTactile';
import { echelleRonde } from '@/data/outils/echelle';
import { formatNum } from '@/data/outils/format';
import { DUREE_MAX, DUREE_MIN, indexDureeProche, texteDuree, type PointCourbe } from '@/data/bilan/records';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La courbe des meilleurs efforts : la meilleure valeur de chaque durée (la puissance, la FC, la cadence…), de 1 s ou 1 min à 5 h, les durées sur une échelle logarithmique (comme partout en cyclisme : les efforts courts seraient
// sinon écrasés). La courbe pleine est la période choisie, les pointillés l'autre période. Poser le doigt (ou le faire glisser) choisit une durée : un point et un trait la marquent.
interface Props {
  courbe: PointCourbe[];
  /** L'autre période, en pointillés. */
  autre?: PointCourbe[];
  /** Une valeur écrite avec son unité (« 357 W ») : pour les valeurs des repères et pour la bulle. */
  formater: (v: number) => string;
  /** L'axe des valeurs ne part pas de zéro (la FC, la cadence) : sinon la courbe, qui reste entre 130 et 190, serait écrasée en haut. */
  serre?: boolean;
  /** La durée touchée (indice dans `courbe`), ou null. */
  selection: number | null;
  onSelection: (index: number | null) => void;
  couleur: string;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
}

const BULLE_H = 22;
const LARGEUR = 330;
const HAUTEUR = 210;
const GAUCHE = 40;
const DROITE = 10;
const HAUT = 14;
const BAS = 26; // la ligne de base, au-dessus des durées écrites
/** Les durées qu'on connaît, marquées sur la courbe avec leur valeur. */
const DUREES_CLES = [5, 30, 60, 300, 1200, 3600];
const REPERES_DUREE: [number, string][] = [
  [1, '1 s'],
  [10, '10 s'],
  [60, '1 min'],
  [600, '10 min'],
  [3600, '1 h'],
  [18000, '5 h'],
];

export function CourbeEfforts({ courbe, autre, selection, onSelection, couleur, etiquette, formater, serre = false }: Props) {
  const p = usePalette();
  const x = (secondes: number) => GAUCHE + ((Math.log(secondes) - Math.log(DUREE_MIN)) / (Math.log(DUREE_MAX) - Math.log(DUREE_MIN))) * (LARGEUR - GAUCHE - DROITE);
  /** La durée sous un point de l'axe (le contraire de x), pour le toucher. */
  const secondesDeX = (px: number) => Math.exp(Math.log(DUREE_MIN) + ((px - GAUCHE) / (LARGEUR - GAUCHE - DROITE)) * (Math.log(DUREE_MAX) - Math.log(DUREE_MIN)));
  const meilleurs = (c: PointCourbe[]) => c.filter((pt) => pt.top.length).map((pt) => ({ duree: pt.duree, valeur: pt.top[0].valeur }));
  const a = meilleurs(courbe);
  const b = autre ? meilleurs(autre) : [];
  const valeurs = [...a.map((pt) => pt.valeur), ...b.map((pt) => pt.valeur)];
  // Axe « serré » : il part d'un peu sous la plus basse valeur (une dizaine ronde), pas de zéro
  const plancher = serre && valeurs.length ? Math.max(0, Math.floor((Math.min(...valeurs) * 0.85) / 10) * 10) : 0;
  const { haut, pas } = echelleRonde(Math.max(0, Math.max(0, ...valeurs) - plancher));
  const etendue = Math.max(1, haut);
  const y = (w: number) => HAUTEUR - BAS - ((w - plancher) / etendue) * (HAUTEUR - BAS - HAUT);
  const trace = (pts: { duree: number; valeur: number }[]) => pts.map((pt, i) => `${i ? 'L' : 'M'}${x(pt.duree).toFixed(1)} ${y(pt.valeur).toFixed(1)}`).join(' ');
  const reperes = pas > 0 ? [pas, 2 * pas, 3 * pas].map((k) => plancher + k) : [];
  const choisi = selection != null ? courbe[selection] : null;
  const texteBulle = choisi && choisi.top.length ? `${texteDuree(choisi.duree)} · ${formater(choisi.top[0].valeur)}` : '';
  const bulleL = texteBulle.length * 6.2 + 18;
  const pointX = choisi ? x(choisi.duree) : 0;
  const pointY = choisi && choisi.top.length ? y(choisi.top[0].valeur) : 0;
  const bulleX = Math.min(LARGEUR - DROITE - bulleL, Math.max(GAUCHE, pointX - bulleL / 2));
  const bulleY = pointY - BULLE_H - 12 < 2 ? pointY + 12 : pointY - BULLE_H - 12;
  /** Le cadre d'une valeur de repère : sa largeur écrite, au-dessus du point. */
  const cadre = (pt: { duree: number; valeur: number }) => {
    const largeur = formater(pt.valeur).length * 6.4 + 6;
    return { g: x(pt.duree) - largeur / 2, d: x(pt.duree) + largeur / 2, h: y(pt.valeur) - 22, b: y(pt.valeur) - 8 };
  };
  const touche = (r: { g: number; d: number; h: number; b: number }, g: number, h: number, d: number, b: number) => r.g < d + 3 && r.d > g - 3 && r.h < b + 3 && r.b > h - 3;
  // Les valeurs de repère qu'on écrit : une valeur se cache quand elle toucherait la bulle, son point, ou une valeur déjà écrite (la bulle prime)
  const ecrites: number[] = [];
  const cadresEcrits: { g: number; d: number; h: number; b: number }[] = [];
  for (const pt of a.filter((q) => DUREES_CLES.includes(q.duree) && q.duree !== choisi?.duree)) {
    const r = cadre(pt);
    const gene = (choisi ? touche(r, bulleX, bulleY, bulleX + bulleL, bulleY + BULLE_H) || touche(r, pointX - 8, pointY - 8, pointX + 8, pointY + 8) : false) || cadresEcrits.some((c) => touche(r, c.g, c.h, c.d, c.b));
    if (!gene) {
      ecrites.push(pt.duree);
      cadresEcrits.push(r);
    }
  }
  const dessin = (
    <Svg width="100%" viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} style={{ aspectRatio: LARGEUR / HAUTEUR }} accessible accessibilityRole="image" accessibilityLabel={etiquette}>
      {[plancher, ...reperes].map((w) => (
        <Line key={w} x1={GAUCHE - 4} x2={LARGEUR - DROITE} y1={y(w)} y2={y(w)} stroke={p.trait} strokeWidth={1} />
      ))}
      {[plancher, ...reperes].map((w) => (
        <TexteSvg key={`v${w}`} x={GAUCHE - 8} y={y(w) + 3} fontSize={9.5} fontFamily={police.texte400} fill={p.texteMuet} textAnchor="end">
          {formatNum(w, 0)}
        </TexteSvg>
      ))}
      {REPERES_DUREE.map(([s, t]) => (
        <TexteSvg key={s} x={x(s)} y={HAUTEUR - 8} fontSize={10} fontFamily={police.texte400} fill={p.texteDoux} textAnchor="middle">
          {t}
        </TexteSvg>
      ))}
      {b.length > 1 ? <Path d={trace(b)} fill="none" stroke={p.texteMuet} strokeWidth={1.6} strokeDasharray="4 3" strokeLinejoin="round" strokeLinecap="round" /> : null}
      {a.length > 1 ? <Path d={`${trace(a)} L${x(a[a.length - 1].duree).toFixed(1)} ${y(plancher)} L${x(a[0].duree).toFixed(1)} ${y(plancher)} Z`} fill={couleur} fillOpacity={0.13} /> : null}
      {a.length ? <Path d={trace(a)} fill="none" stroke={couleur} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" /> : null}
      {/* Les durées clés : un point creux avec sa valeur (sauf près de la durée touchée, où la bulle parle) */}
      {a
        .filter((pt) => DUREES_CLES.includes(pt.duree) && pt.duree !== choisi?.duree)
        .map((pt) => (
          <Fragment key={`cle${pt.duree}`}>
            <Circle cx={x(pt.duree)} cy={y(pt.valeur)} r={3.5} fill={p.surface} stroke={couleur} strokeWidth={2} />
            {ecrites.includes(pt.duree) ? (
              <>
                {/* Un contour de la couleur du fond, pour que les pointillés ne barrent pas le chiffre */}
                <TexteSvg x={x(pt.duree)} y={y(pt.valeur) - 9} fontSize={10.5} fontFamily={police.titre700} fill={p.surface} stroke={p.surface} strokeWidth={4} strokeLinejoin="round" textAnchor="middle">
                  {formater(pt.valeur)}
                </TexteSvg>
                <TexteSvg x={x(pt.duree)} y={y(pt.valeur) - 9} fontSize={10.5} fontFamily={police.titre700} fill={p.texte} textAnchor="middle">
                  {formater(pt.valeur)}
                </TexteSvg>
              </>
            ) : null}
          </Fragment>
        ))}
      {choisi && choisi.top.length ? (
        <>
          <Circle cx={x(choisi.duree)} cy={y(choisi.top[0].valeur)} r={5.5} fill={couleur} stroke={p.surface} strokeWidth={2} />
          {/* La bulle : la durée et la valeur, au-dessus du point (en dessous quand le point est tout en haut) */}
          <Rect x={bulleX} y={bulleY} width={bulleL} height={BULLE_H} rx={BULLE_H / 2} fill={p.texte} />
          <TexteSvg x={bulleX + bulleL / 2} y={bulleY + 15} fontSize={11} fontFamily={police.titre700} fill={p.fond} textAnchor="middle">
            {texteBulle}
          </TexteSvg>
        </>
      ) : null}
    </Svg>
  );
  return (
    <ZoneTactile selection={selection} onSelection={onSelection} indexDe={(px, largeur) => (courbe.length ? indexDureeProche(courbe, secondesDeX((px / largeur) * LARGEUR)) : null)}>
      {dessin}
    </ZoneTactile>
  );
}
