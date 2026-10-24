import Svg, { Circle, Path, SvgXml } from 'react-native-svg';
import { typeADessiner } from '@/data/catalogue-sports';
import { DESSINS } from '@/data/dessins-sports';
import { familleSport } from '@/data/familles';
import { couleurSport } from '@/theme/sports';
import { usePalette } from '@/theme/usePalette';

// Le petit logo d'un sport, en traits, dans la couleur du sport : un dessin par sport du catalogue (data/dessins-sports.ts).
// Dessiné sur une grille de 24 : simple et lisible dès 16 pt. Décoratif : le nom du sport est toujours écrit à côté.
interface Props {
  /** Le sport brut (Run, TrailRun, Rowing…) ou une famille (course, velo…). Une famille donne le dessin et la couleur de son sport de base. */
  sport: string;
  taille?: number;
  /** Le vélo épais (formes nettes, trait plein) des grands emplacements, comme le bandeau de l'aperçu d'import. Sans effet sur les autres sports. */
  epais?: boolean;
}

// Triathlon et duathlon : un anneau en trois arcs, un par discipline
function arcs(couleur: string, taille: number) {
  const r = 8.5;
  const pt = (a: number) => `${(12 + r * Math.cos((a * Math.PI) / 180)).toFixed(2)} ${(12 + r * Math.sin((a * Math.PI) / 180)).toFixed(2)}`;
  const arc = (a0: number, a1: number) => `M${pt(a0)} A${r} ${r} 0 0 1 ${pt(a1)}`;
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[[-85, 25], [35, 145], [155, 265]].map(([a0, a1]) => (
        <Path key={a0} d={arc(a0, a1)} stroke={couleur} strokeWidth={3} strokeLinecap="round" fill="none" />
      ))}
    </Svg>
  );
}

export function IconeSport({ sport, taille = 18, epais = false }: Props) {
  const p = usePalette();
  const type = typeADessiner(sport);
  const couleur = couleurSport(p, type);
  const trait = { stroke: couleur, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  // Le vélo épais est plus large que haut (grille de 100 sur 80) : `taille` en est la hauteur
  if (epais && familleSport(type) === 'velo') {
    const gras = { ...trait, strokeWidth: 5 };
    return (
      <Svg width={taille * 1.25} height={taille} viewBox="0 0 100 80" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Circle cx={22} cy={54} r={17} {...gras} />
        <Circle cx={78} cy={54} r={17} {...gras} />
        <Path d="M22 54 L33 26 L66 26 L78 54 M22 54 L42 54 L33 26 M42 54 L66 26 M27 19 L40 19 M66 26 L64 15 L75 15" {...gras} />
      </Svg>
    );
  }

  if (type === 'Triathlon' || type === 'Duathlon') return arcs(couleur, taille);

  const dessin = (DESSINS[type] ?? DESSINS.Other).replaceAll('currentColor', couleur);
  const xml = `<svg viewBox="0 0 24 24" stroke="${couleur}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">${dessin}</svg>`;
  return <SvgXml xml={xml} width={taille} height={taille} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

/** Le dessin du jour de repos : une lune et un petit « z ». Neutre (pas de sport, donc pas de couleur de sport). */
export function IconeRepos({ taille = 30 }: { taille?: number }) {
  const p = usePalette();
  const trait = { stroke: p.texteMuet, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M19.5 14.2 A8 8 0 1 1 9.8 4.5 A6.4 6.4 0 0 0 19.5 14.2 Z" {...trait} />
      <Path d="M14.5 3.5 H18.5 L14.5 8 H18.5" {...trait} />
    </Svg>
  );
}
