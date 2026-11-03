import { Fragment } from 'react';
import Svg, { Circle, Line, Path, Rect, Text as TexteSvg } from 'react-native-svg';
import { Bloc } from '@/components/feuilles/Bloc';
import type { FormeSaison as Forme, SemaineForme } from '@/data/bilan/forme-saison';
import { avecAlpha } from '@/theme/couleurs';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// « Forme par saison » (maquette 7, choisie par Yanis le 2 nov. 2026) : en haut, la forme de chaque semaine de l'année choisie avec sa marge d'erreur
// et la meilleure semaine cerclée ; en bas, les heures de vélo de chaque semaine, sur le même axe des mois. Calcul : data/bilan/forme-saison.ts.
interface Props {
  forme: Forme;
  couleur: string;
}

const LARGEUR = 300;
const G = 34;
const D = 10;
// La forme : de 18 (place pour le chiffre de la meilleure semaine) à 150
const F_HAUT = 18;
const F_BAS = 150;
// Les heures : de 180 à 226 (de l'air sous la forme pour que les deux échelles ne se touchent pas), puis les mois
const V_HAUT = 180;
const V_BAS = 226;
const HAUTEUR = 248;
const MOIS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Les suites de semaines notées (mesurées ou estimées) sans trou : seule une semaine sans aucun score coupe la courbe. */
function morceaux(semaines: readonly SemaineForme[]): SemaineForme[][] {
  const out: SemaineForme[][] = [];
  let cur: SemaineForme[] = [];
  for (const s of semaines) {
    if (s.score === null) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push(s);
  }
  if (cur.length) out.push(cur);
  return out;
}

const formatHeures = (h: number): string => (h >= 10 ? String(Math.round(h)) : String(Math.round(h * 10) / 10).replace('.', ','));

export function FormeSaison({ forme, couleur }: Props) {
  const p = usePalette();
  const notees = forme.semaines.filter((s) => s.score !== null);
  const plusBas = Math.min(...notees.map((s) => s.bas!)) - 5;
  const pas = 100 - plusBas > 50 ? 20 : 10;
  const min = Math.max(0, Math.floor(plusBas / pas) * pas);
  const max = 105; // un peu d'air au-dessus des 100 pour la marge
  // Une semaine i occupe [i, i + 1] sur 52 ; son point est au milieu
  const x = (t: number): number => G + (t / 52) * (LARGEUR - G - D);
  const xs = (s: SemaineForme): number => x(s.index + 0.5);
  const y = (v: number): number => F_HAUT + ((max - Math.max(min, Math.min(max, v))) / (max - min)) * (F_BAS - F_HAUT);
  const reperes: number[] = [];
  for (let v = min; v <= 100; v += pas) reperes.push(v);

  // Les barres du bas : des heures (vélo, course) ou des tonnes (musculation)
  const uniteBarres = forme.unite ?? 'h';
  const heuresMax = Math.max(2, Math.ceil(Math.max(...forme.semaines.map((s) => s.heures)) / 2) * 2);
  const yh = (h: number): number => V_BAS - (h / heuresMax) * (V_BAS - V_HAUT);
  const largeurBarre = ((LARGEUR - G - D) / 52) * 0.7;

  const meilleure = forme.semaines[forme.meilleure];
  const mesurees = notees.filter((s) => !s.estimee);
  const derniere = mesurees[mesurees.length - 1];
  const nbEstimees = notees.length - mesurees.length;
  const moisDe = (s: SemaineForme): string => NOMS_MOIS[Number(s.debut.slice(5, 7)) - 1];
  const totalHeures = forme.semaines.reduce((t, s) => t + s.heures, 0);
  const etiquette =
    `Forme par semaine en ${forme.annee}, sur 100 : meilleure semaine ${Math.round(meilleure.score!)} début ${moisDe(meilleure)}, ` +
    `dernière semaine mesurée ${Math.round(derniere.score!)} début ${moisDe(derniere)}. ` +
    (nbEstimees ? `${nbEstimees} semaine${nbEstimees > 1 ? 's' : ''} estimée${nbEstimees > 1 ? 's' : ''} sans assez de sorties, en pointillé. ` : '') +
    `${uniteBarres === 't' ? 'Tonnage' : 'Heures'} : ${formatHeures(totalHeures)} ${uniteBarres} sur ${forme.semaines.length} semaines, jusqu'à ${formatHeures(Math.max(...forme.semaines.map((s) => s.heures)))} ${uniteBarres} en une semaine.`;

  return (
    <Bloc titre="Forme par saison">
      <Svg accessible accessibilityRole="image" accessibilityLabel={etiquette} width="100%" viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} style={{ aspectRatio: LARGEUR / HAUTEUR }}>
        {reperes.map((v) => (
          <Fragment key={v}>
            <Line x1={G} x2={LARGEUR - D} y1={y(v)} y2={y(v)} stroke={v === 100 ? couleur : p.trait} strokeWidth={v === 100 ? 1.4 : 1} strokeDasharray={v === 100 ? '4 4' : undefined} />
            <TexteSvg x={G - 7} y={y(v) + 4} fontSize={12} fontFamily={v === 100 ? police.texte600 : police.texte400} fill={v === 100 ? couleur : p.texteMuet} textAnchor="end">{v}</TexteSvg>
          </Fragment>
        ))}
        {morceaux(forme.semaines).map((m) => (
          <Fragment key={m[0].index}>
            {m.length > 1 ? (
              <Path
                d={`${m.map((s, i) => `${i ? 'L' : 'M'}${xs(s)} ${y(s.haut!)}`).join(' ')} ${[...m].reverse().map((s) => `L${xs(s)} ${y(s.bas!)}`).join(' ')} Z`}
                fill={avecAlpha(couleur, 0.18)}
              />
            ) : null}
            {m.length > 1 ? (
              <>
                {/* Trait plein sur les semaines mesurées, pointillé vers et sur les semaines estimées */}
                {m.slice(1).map((s, i) => {
                  const a = m[i];
                  const estimee = s.estimee || a.estimee;
                  return (
                    <Path
                      key={s.index}
                      d={`M${xs(a)} ${y(a.score!)} L${xs(s)} ${y(s.score!)}`}
                      fill="none"
                      stroke={couleur}
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      strokeDasharray={estimee ? '2 4' : undefined}
                    />
                  );
                })}
              </>
            ) : (
              <Circle cx={xs(m[0])} cy={y(m[0].score!)} r={2.6} fill={couleur} />
            )}
          </Fragment>
        ))}
        <Circle cx={xs(meilleure)} cy={y(meilleure.score!)} r={5} fill={p.surface} stroke={couleur} strokeWidth={2.4} />
        <TexteSvg x={Math.min(LARGEUR - D - 8, Math.max(G + 8, xs(meilleure)))} y={y(meilleure.score!) - 10} fontSize={12} fontFamily={police.texte600} fill={p.texte} textAnchor="middle">
          {Math.round(meilleure.score!)}
        </TexteSvg>

        <TexteSvg x={G - 7} y={V_HAUT + 4} fontSize={12} fontFamily={police.texte400} fill={p.texteMuet} textAnchor="end">{`${heuresMax} ${uniteBarres}`}</TexteSvg>
        <TexteSvg x={G - 7} y={V_BAS} fontSize={12} fontFamily={police.texte400} fill={p.texteMuet} textAnchor="end">0</TexteSvg>
        <Line x1={G} x2={LARGEUR - D} y1={V_BAS} y2={V_BAS} stroke={p.trait} strokeWidth={1} />
        {forme.semaines.map((s) =>
          s.heures > 0 ? <Rect key={s.index} x={xs(s) - largeurBarre / 2} y={yh(s.heures)} width={largeurBarre} height={V_BAS - yh(s.heures)} rx={1} fill={p.texteMuet} /> : null,
        )}
        {MOIS.map((l, i) => (
          <TexteSvg key={i} x={x(((i + 0.5) * 365) / 12 / 7)} y={HAUTEUR - 6} fontSize={12} fontFamily={police.texte500} fill={p.texteDoux} textAnchor="middle">{l}</TexteSvg>
        ))}
      </Svg>
    </Bloc>
  );
}
