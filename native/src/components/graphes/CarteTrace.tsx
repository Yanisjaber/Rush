import { useEffect, useState } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import type { PointCarte, RegionCarte } from '@/data/calendrier/apercu-import';
import { rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { RepliSiErreur } from '@/components/ecrans/RepliSiErreur';

// La carte d'un parcours : Apple Plans sur iPhone (react-native-maps), avec la trace dans la couleur du sport, un point de départ et un point d'arrivée.
// Le module natif est chargé au moment d'afficher la carte : tant que l'app n'a pas été reconstruite avec lui, on dessine la trace seule (sans fond de carte).
interface Props {
  trace: PointCarte[];
  region: RegionCarte;
  couleur: string;
  hauteur?: number;
}

export function CarteTrace(props: Props) {
  const p = usePalette();
  const { hauteur = 240 } = props;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Carte du parcours" style={[styles.cadre, { height: hauteur, backgroundColor: p.surface2 }]}>
      <RepliSiErreur repli={<TraceSeule {...props} />}>
        <CarteNative {...props} />
      </RepliSiErreur>
    </View>
  );
}

function CarteNative({ trace, region, couleur }: Props) {
  const p = usePalette();
  const sombre = useColorScheme() !== 'light';
  const [cartes, setCartes] = useState<typeof import('react-native-maps') | null | false>(null);
  useEffect(() => {
    let vivant = true;
    import('react-native-maps').then(
      (m) => vivant && setCartes(m),
      () => vivant && setCartes(false),
    );
    return () => {
      vivant = false;
    };
  }, []);
  if (cartes === false) throw new Error('react-native-maps indisponible'); // → le garde-fou affiche la trace seule
  if (!cartes) return null;
  const { default: MapView, Polyline: Ligne, Marker } = cartes;
  const point = (fond: string) => <View style={[styles.point, { backgroundColor: fond, borderColor: p.fond }]} />;
  return (
    <MapView
      style={StyleSheet.absoluteFill}
      initialRegion={region}
      userInterfaceStyle={sombre ? 'dark' : 'light'}
      rotateEnabled={false}
      pitchEnabled={false}
      showsUserLocation={false}
      toolbarEnabled={false}
    >
      <Ligne coordinates={trace} strokeColor={couleur} strokeWidth={4} lineCap="round" lineJoin="round" />
      <Marker coordinate={trace[0]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} accessibilityLabel="Départ">
        {point(p.texte)}
      </Marker>
      <Marker coordinate={trace[trace.length - 1]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} accessibilityLabel="Arrivée">
        {point(couleur)}
      </Marker>
    </MapView>
  );
}

// Repli : la trace seule, projetée à plat (la longitude est raccourcie selon la latitude pour que la forme reste juste).
function TraceSeule({ trace, region, couleur }: Props) {
  const p = usePalette();
  const L = 320;
  const H = 240;
  const k = Math.cos((region.latitude * Math.PI) / 180);
  const x = (lon: number) => (lon - region.longitude) * k;
  const y = (lat: number) => -(lat - region.latitude);
  const xs = trace.map((t) => x(t.longitude));
  const ys = trace.map((t) => y(t.latitude));
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const echelle = Math.min((L - 32) / Math.max(maxX - minX, 1e-9), (H - 32) / Math.max(maxY - minY, 1e-9));
  const ox = (L - (maxX - minX) * echelle) / 2 - minX * echelle;
  const oy = (H - (maxY - minY) * echelle) / 2 - minY * echelle;
  const pts = xs.map((px, i) => `${(px * echelle + ox).toFixed(1)},${(ys[i] * echelle + oy).toFixed(1)}`);
  const [dx, dy] = pts[0].split(',').map(Number);
  const [fx, fy] = pts[pts.length - 1].split(',').map(Number);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${L} ${H}`}>
        <Polyline points={pts.join(' ')} fill="none" stroke={couleur} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={dx} cy={dy} r={6} fill={p.texte} stroke={p.fond} strokeWidth={2} />
        <Circle cx={fx} cy={fy} r={6} fill={couleur} stroke={p.fond} strokeWidth={2} />
      </Svg>
      <Text style={[typo.micro, styles.note, { color: p.texteMuet }]}>Trace sans fond de carte</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { borderRadius: rayon.bloc, overflow: 'hidden' },
  point: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  note: { position: 'absolute', left: 12, bottom: 8 },
});
