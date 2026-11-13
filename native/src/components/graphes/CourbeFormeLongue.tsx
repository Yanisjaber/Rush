import { Fragment, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as TexteSvg } from 'react-native-svg';
import { picCondition, type PointCondition } from '@/data/bilan/forme-longue';
import { dateCourte, jourMois } from '@/data/bilan/records-texte';
import { espace } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La courbe de forme : la condition (CTL, ta charge d'entraînement lissée sur environ 6 semaines) semaine après semaine, avec ton pic marqué.
// On voit les 3 dernières années. Le geste est le même que sur les courbes d'une sortie :
//   - un doigt : un curseur qui lit la condition de la semaine touchée ;
//   - deux doigts : on entoure une portion, et quand on les lève la courbe se recalcule dessus (les zooms se composent) ;
//   - un double-tap change de vue : 3 ans → toute l'histoire → 3 ans (une portion zoomée revient aux 3 ans).
interface Props {
  semaines: PointCondition[];
  /** La couleur de la courbe : celle du sport quand le filtre en choisit un, sinon la couleur du texte. */
  couleur?: string;
}

const HAUTEUR = 170;
const G = 30; // la place des notes à gauche
const MARGE = 8;
const H = 12;
const B = 24; // la place des repères en bas
const SEMAINES_DEPART = 52 * 3; // la vue de départ : 3 ans
const ECART_MIN = 0.05; // une portion fait au moins 5 % de la vue
const POINTS_MIN = 8;
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function CourbeFormeLongue({ semaines, couleur }: Props) {
  const p = usePalette();
  const trait = couleur ?? p.texte;
  const n = semaines.length;
  const depart = (): [number, number] => [n > SEMAINES_DEPART ? 1 - SEMAINES_DEPART / (n - 1) : 0, 1];

  const [largeur, setLargeur] = useState(0);
  const [vue, setVue] = useState<[number, number]>(depart);
  const [fraction, setFraction] = useState<number | null>(null); // le curseur à un doigt, dans la vue
  const [sel, setSel] = useState<[number, number] | null>(null); // la portion entourée à deux doigts, dans la vue
  const bloc = useRef<ComponentRef<typeof View>>(null);
  const gauche = useRef(0); // le bord gauche du bloc à l'écran : pageX est stable d'un bout à l'autre du geste
  const geste = useRef<'curseur' | 'plage' | null>(null);
  const tap = useRef({ debut: 0, x: 0, bouge: false, dernier: 0 }); // pour reconnaître un double-tap
  const refs = useRef({ largeur: 0, sel, vue, depart });
  refs.current = { largeur, sel, vue, depart };

  // La partie affichée : les points de la vue (au moins 8, pour que la courbe reste une courbe)
  const [d0, d1] = n > 1 ? vue : ([0, 1] as [number, number]);
  const ia = n > POINTS_MIN ? Math.min(n - POINTS_MIN, Math.max(0, Math.floor(d0 * (n - 1)))) : 0;
  const ib = n > POINTS_MIN ? Math.max(ia + POINTS_MIN - 1, Math.min(n - 1, Math.ceil(d1 * (n - 1)))) : n - 1;
  const visibles = semaines.slice(ia, ib + 1);
  const m = visibles.length;
  const toutVoir = ia === 0 && ib === n - 1;
  const [dep0] = depart();
  const estDepart = Math.abs(d0 - dep0) < 1e-6 && Math.abs(d1 - 1) < 1e-6;

  const zone = Math.max(1, largeur - G - 2 * MARGE);
  const x = (i: number): number => G + MARGE + (m > 1 ? (i / (m - 1)) * zone : zone / 2);
  const picVue = picCondition(visibles);
  // L'échelle : de 0 au plus haut de la vue (arrondi à la dizaine au-dessus)
  const maxi = Math.max(10, Math.ceil((picVue?.ctl ?? 10) / 10) * 10);
  const y = (v: number): number => H + ((maxi - v) / maxi) * (HAUTEUR - H - B);
  const picTout = picCondition(semaines);
  const indexPic = picTout ? visibles.findIndex((s) => s.lundi === picTout.lundi) : -1;

  const versFraction = (xPos: number) => Math.min(1, Math.max(0, (xPos - G - MARGE) / Math.max(1, refs.current.largeur - G - 2 * MARGE)));
  const traiter = (xs: number[]) => {
    if (xs.length >= 2) {
      // Deux doigts : la portion entre eux (le curseur disparaît)
      geste.current = 'plage';
      setFraction(null);
      const a = versFraction(Math.min(xs[0], xs[1]));
      const b = versFraction(Math.max(xs[0], xs[1]));
      setSel(b - a < ECART_MIN ? [Math.max(0, Math.min(a, 1 - ECART_MIN)), Math.max(0, Math.min(a, 1 - ECART_MIN)) + ECART_MIN] : [a, b]);
    } else if (geste.current !== 'plage') {
      if (geste.current === null) tap.current = { ...tap.current, debut: Date.now(), x: xs[0], bouge: false };
      else if (Math.abs(xs[0] - tap.current.x) > 8) tap.current.bouge = true;
      geste.current = 'curseur';
      setFraction(versFraction(xs[0]));
    }
  };
  const fin = () => {
    // Tous les doigts sont levés : si on entourait une portion, la vue se recalcule dessus (les zooms se composent)
    const s = refs.current.sel;
    const t = tap.current;
    const bref = geste.current === 'curseur' && !t.bouge && Date.now() - t.debut < 250;
    if (bref) {
      // Un toucher bref : le deuxième, dans les 350 ms, change de vue : 3 ans → toute l'histoire → 3 ans (et une portion zoomée revient aux 3 ans)
      if (Date.now() - t.dernier < 350) {
        const [v0, v1] = refs.current.vue;
        const [dep0] = refs.current.depart();
        const estDep = Math.abs(v0 - dep0) < 1e-6 && Math.abs(v1 - 1) < 1e-6;
        setVue(estDep && dep0 > 0 ? [0, 1] : refs.current.depart());
        t.dernier = 0;
      } else t.dernier = Date.now();
    }
    if (geste.current === 'plage' && s) {
      const [v0, v1] = refs.current.vue;
      setVue([v0 + s[0] * (v1 - v0), v0 + s[1] * (v1 - v0)]);
    }
    geste.current = null;
    setSel(null);
    setFraction(null);
  };
  const xsDe = (touches: readonly { pageX: number }[]) => touches.map((t) => t.pageX - gauche.current);

  const i = fraction == null ? null : Math.round(fraction * (m - 1));
  const choisie = i != null ? visibles[i] : null;
  const xCurseur = i != null ? x(i) : null;
  const xa = sel ? G + MARGE + sel[0] * zone : 0;
  const xb = sel ? G + MARGE + sel[1] * zone : 0;

  const d = visibles.map((s, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)} ${y(s.ctl).toFixed(1)}`).join(' ');
  const surface = m > 1 ? `${d} L${x(m - 1).toFixed(1)} ${y(0).toFixed(1)} L${x(0).toFixed(1)} ${y(0).toFixed(1)} Z` : '';

  // Les repères en bas : un trait à chaque début d'année ; quand la vue est courte (moins de 18 mois), un trait à chaque début de mois, avec son nom
  const reperes: { cle: string; i: number; texte: string; fort: boolean }[] = [];
  let anPrec = '';
  let moisPrec = '';
  const court = m <= 78;
  visibles.forEach((s, k) => {
    const an = s.lundi.slice(0, 4);
    const mois = s.lundi.slice(0, 7);
    if (an !== anPrec && k > 0) reperes.push({ cle: `a${an}`, i: k, texte: an, fort: true });
    else if (court && mois !== moisPrec && k > 0 && an === anPrec) reperes.push({ cle: `m${mois}`, i: k, texte: MOIS_COURTS[Number(s.lundi.slice(5, 7)) - 1], fort: false });
    anPrec = an;
    moisPrec = mois;
  });
  // Les repères trop serrés s'écrasent : on garde ceux qui ont de la place (au moins 34 pt avec le précédent écrit)
  const ecrits: typeof reperes = [];
  let dernierX = -100;
  for (const r of reperes) {
    if (x(r.i) - dernierX >= 34 || r.fort) {
      ecrits.push(r);
      dernierX = x(r.i);
    }
  }

  const bornes = visibles.length ? `${dateCourte(visibles[0].lundi)} – ${dateCourte(visibles[m - 1].lundi)}` : '';
  const dernier = semaines[n - 1];
  const etiquette = `Courbe de forme, de ${dateCourte(semaines[0]?.lundi ?? '')} à ${dateCourte(dernier?.lundi ?? '')}. ${picTout ? `Pic de forme ${picTout.ctl}, semaine du ${dateCourte(picTout.lundi)}.` : ''} Un doigt pour lire une semaine, deux doigts pour zoomer sur une portion.`;

  return (
    <View style={{ gap: espace.e3 }}>
      <View
        ref={bloc}
        onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)}
        // Le doigt se pose : le curseur apparaît tout de suite ; il suit le doigt (pageX). Un second doigt entoure une portion.
        onTouchStart={(e) => {
          const pageX = e.nativeEvent.touches.map((t) => t.pageX);
          bloc.current?.measureInWindow((x0) => {
            gauche.current = x0;
            traiter(pageX.map((v) => v - x0));
          });
        }}
        onTouchMove={(e) => traiter(xsDe(e.nativeEvent.touches))}
        onTouchEnd={(e) => {
          if (e.nativeEvent.touches.length === 0) fin();
        }}
        onTouchCancel={fin}
        accessible
        accessibilityLabel={etiquette}
      >
        {largeur > 0 && m > 1 ? (
          <Svg width="100%" height={HAUTEUR} viewBox={`0 0 ${largeur} ${HAUTEUR}`}>
            {[0, maxi / 2, maxi].map((v) => (
              <Fragment key={v}>
                <Line x1={G} x2={largeur - MARGE} y1={y(v)} y2={y(v)} stroke={v === maxi ? p.texteDoux : p.trait} strokeWidth={v === maxi ? 1.2 : 1} strokeDasharray={v === maxi ? '4 4' : undefined} />
                <TexteSvg x={G - 6} y={y(v) + 4} fontSize={11} fontFamily={v === maxi ? police.texte600 : police.texte400} fill={v === maxi ? p.texte : p.texteMuet} textAnchor="end">
                  {Math.round(v)}
                </TexteSvg>
              </Fragment>
            ))}
            {ecrits.map((r) => (
              <Fragment key={r.cle}>
                <Line x1={x(r.i)} x2={x(r.i)} y1={H} y2={HAUTEUR - B} stroke={p.trait} strokeWidth={r.fort ? 1 : 0.6} />
                <TexteSvg x={x(r.i) + 4} y={HAUTEUR - 6} fontSize={11} fontFamily={r.fort ? police.texte600 : police.texte500} fill={r.fort ? p.texte : p.texteDoux} textAnchor="start">
                  {r.texte}
                </TexteSvg>
              </Fragment>
            ))}
            <Path d={surface} fill={trait} opacity={0.1} />
            <Path d={d} fill="none" stroke={trait} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
            {/* Ton pic, quand il est dans la vue : un rond creux sur la courbe */}
            {picTout && indexPic >= 0 ? <Circle cx={x(indexPic)} cy={y(picTout.ctl)} r={5.5} fill={p.fond} stroke={trait} strokeWidth={2.4} /> : null}
            {/* La portion qu'on entoure à deux doigts */}
            {sel ? <Rect x={xa} y={H} width={Math.max(1, xb - xa)} height={HAUTEUR - H - B} fill={trait} opacity={0.18} /> : null}
            {/* Le curseur à un doigt */}
            {xCurseur != null && choisie ? (
              <>
                <Line x1={xCurseur} x2={xCurseur} y1={H} y2={HAUTEUR - B} stroke={p.texteMuet} strokeWidth={1} strokeDasharray="3 3" />
                <Circle cx={xCurseur} cy={y(choisie.ctl)} r={4.5} fill={trait} stroke={p.fond} strokeWidth={1.5} />
              </>
            ) : null}
          </Svg>
        ) : (
          <View style={{ height: HAUTEUR }} />
        )}
      </View>

      {/* La lecture : la semaine touchée, sinon ton pic de forme et ta forme d'aujourd'hui (sur toute l'histoire, quelle que soit la vue) */}
      <View style={{ gap: espace.e1 }}>
        {!estDepart && !toutVoir ? <Text style={[typo.micro, { color: p.texteMuet }]}>{bornes.toUpperCase()}</Text> : null}
        {choisie ? (
          <View style={styles.ligne}>
            <View style={{ flex: 1 }}>
              <Text style={[typo.corpsFort, { color: p.texte }]}>Semaine du {jourMois(choisie.lundi)} {choisie.lundi.slice(0, 4)}</Text>
              <Text style={[typo.petit, { color: p.texteMuet }]}>Condition de la semaine</Text>
            </View>
            <Text style={[styles.valeur, { color: p.texte }]}>{choisie.ctl}</Text>
          </View>
        ) : null}
        {!choisie && picTout ? (
          <View style={styles.ligne}>
            <View style={{ flex: 1 }}>
              <Text style={[typo.corpsFort, { color: p.texte }]}>Ton pic de forme</Text>
              <Text style={[typo.petit, { color: p.texteMuet }]}>Semaine du {dateCourte(picTout.lundi)}</Text>
            </View>
            <Text style={[styles.valeur, { color: p.texte }]}>{picTout.ctl}</Text>
          </View>
        ) : null}
        {!choisie && dernier ? (
          <View style={styles.ligne}>
            <View style={{ flex: 1 }}>
              <Text style={[typo.corpsFort, { color: p.texte }]}>Aujourd'hui</Text>
              <Text style={[typo.petit, { color: p.texteMuet }]}>Semaine du {dateCourte(dernier.lundi)}</Text>
            </View>
            <Text style={[styles.valeur, { color: p.texteDoux }]}>{dernier.ctl}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  valeur: { fontFamily: police.titre800, fontSize: 28, lineHeight: 32, fontVariant: ['tabular-nums'], minWidth: 48, textAlign: 'right' },
});
