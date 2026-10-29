import Svg, { Path } from 'react-native-svg';

// Une coupe pour les trois premières places d'un classement : or, argent, bronze (les couleurs d'une médaille, pas celles d'un sport).
const MEDAILLES = ['#D9A520', '#9CA5B4', '#B9733A'] as const;

/** `rang` : 1, 2 ou 3. */
export function Coupe({ rang, taille = 24 }: { rang: 1 | 2 | 3; taille?: number }) {
  const c = MEDAILLES[rang - 1];
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24" accessible={false}>
      <Path d="M6.5 3h11v5.5a5.5 5.5 0 0 1-11 0V3z" fill={c} />
      <Path d="M6.5 5H3.5v1.8a3.2 3.2 0 0 0 3.2 3.2M17.5 5h3v1.8a3.2 3.2 0 0 1-3.2 3.2" fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 14v4M8 21h8" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
