import Svg, { Circle, Path } from 'react-native-svg';

// Le petit logo d'une note, selon son type : trois barres (note), une croix (maladie), un X (blessure), un cercle barré (indisponible).
// Dessins simples et traits épais pour rester lisibles à 8 px dans une case du calendrier ; dans la couleur de la note.
export function LogoNote({ type, couleur, taille = 14 }: { type: string; couleur: string; taille?: number }) {
  const trait = { stroke: couleur, strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <Svg width={taille} height={taille} viewBox="0 0 16 16" accessible={false}>
      {type === 'maladie' ? (
        <Path d="M8 2.5v11M2.5 8h11" {...trait} strokeWidth={3.6} />
      ) : type === 'blessure' ? (
        <Path d="M3.5 3.5l9 9M12.5 3.5l-9 9" {...trait} strokeWidth={3.6} />
      ) : type === 'indisponible' ? (
        <>
          <Circle cx={8} cy={8} r={5.6} {...trait} strokeWidth={2.8} />
          <Path d="M4.5 11.5l7-7" {...trait} strokeWidth={2.8} />
        </>
      ) : (
        <Path d="M3 4h10M3 8h10M3 12h6" {...trait} strokeWidth={2.8} />
      )}
    </Svg>
  );
}
