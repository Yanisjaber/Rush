import { useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CarteTrace } from '@/components/graphes/CarteTrace';
import { EnteteFlottante, HAUT_ENTETE } from '@/components/graphes/EnteteFlottante';
import { ProfilCurseur } from '@/components/graphes/ProfilCurseur';
import { Dossard } from '@/components/ui/Dossard';
import { IconeSport } from '@/components/ui/IconeSport';
import type { PointCarte, RegionCarte } from '@/data/calendrier/apercu-import';
import { longueurKm, pointAuFraction } from '@/data/outils/trace';
import { espace, rayon, sombre } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'écran d'une sortie réalisée (maquette 3 « Pages qu'on balaie ») : la carte en plein fond (ou, sans GPS, un dossard avec le chiffre principal),
// le retour, le titre et le crayon flottants, et une feuille en bas avec les trois chiffres clés et le profil d'altitude. Balayer vers la gauche ouvre la page 2 : toutes les infos, sans carte.
// Sur le profil, on glisse le doigt sur la courbe : un point suit sur la carte (et le balayage des pages est suspendu). Les pastilles de pagination se touchent aussi.
interface ParcoursSortie {
  trace: PointCarte[];
  region: RegionCarte | null;
  profil: number[];
  altitudeMin: number | null;
  altitudeMax: number | null;
}

interface Props {
  /** La carte et le profil ; null sans GPS (ou tant qu'ils ne sont pas là). */
  parcours: ParcoursSortie | null;
  /** La carte est en cours de chargement (une sortie Strava la demande à Strava). */
  chargementCarte?: boolean;
  /** La distance enregistrée sur la sortie, pour l'axe quand la trace n'a pas sa propre longueur. */
  km: number | null;
  couleur: string;
  /** Clé de sport, pour la couleur du dossard sans GPS. */
  sport: string;
  titre: string;
  /** La date et l'heure, en petit au-dessus des chiffres (« MER 4 NOV · 20:19 »), après l'icône et le nom du sport. */
  date?: string;
  /** Le nom du sport (« Course à pied »), écrit après l'icône dans la couleur du sport. */
  nomSport?: string;
  /** Le chiffre principal du dossard sans GPS (la distance, ou la durée à défaut). */
  hero: { etiquette: string; valeur: string; unite?: string; detail?: string } | null;
  /** Les trois chiffres clés de la première page. */
  chiffres: ReactNode;
  /** La seconde page, sans carte : toutes les infos de la sortie (on y va en balayant vers la gauche). */
  pageDetails: (onGlisse: (actif: boolean) => void) => ReactNode;
  /** Les courbes de la page 2, fixes dans la zone du haut (entre la date et les pastilles) : reçoit la hauteur libre. Absent sans courbes. */
  /** Les répartitions par zones, en tête du contenu qui défile sous les pastilles. */
  repartitions?: ReactNode;
  graphesHaut?: (hauteur: number, onGlisse: (actif: boolean) => void) => ReactNode;
  onModifier?: () => void;
}

const HAUTEUR_PROFIL = 166; // la hauteur du profil (courbe et repères de distance)

export function VueSortie({ parcours, chargementCarte, km, couleur, sport, titre, date, nomSport, hero, chiffres, pageDetails, graphesHaut, repartitions, onModifier }: Props) {
  const p = usePalette();
  const { top: haut, bottom: bas } = useSafeAreaInsets();
  const { width: largeur, height: hauteur } = useWindowDimensions();
  const avecCarte = !!parcours?.region && parcours.trace.length > 1;
  const avecProfil = !!parcours && parcours.profil.length > 1 && parcours.altitudeMin != null && parcours.altitudeMax != null;

  const [feuille, setFeuille] = useState(0);
  const [fraction, setFraction] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [yPastilles, setYPastilles] = useState(0); // la place des pastilles dans la feuille : la page 2 les remet au même endroit de l'écran
  const [surCourbe, setSurCourbe] = useState(false); // le doigt est sur la courbe : on suspend le balayage des pages, sinon il emporterait la page avec lui
  const defilement = useRef<ComponentRef<typeof ScrollView>>(null);
  // L'axe va jusqu'à la distance de la sortie (celle de la tuile) : le bout du profil et « Distance » disent la même chose. La longueur mesurée sur la trace simplifiée ne sert que sans distance.
  const kmTrace = useMemo(() => (parcours ? longueurKm(parcours.trace) : 0), [parcours]);
  // Le point du curseur n'a de sens que sur la page 1
  const curseur = useMemo(() => (index === 0 && fraction != null && parcours ? pointAuFraction(parcours.trace, fraction) : null), [parcours, fraction, index]);
  // La trace doit rester entière dans la zone libre (sous l'en-tête, au-dessus de la feuille) : la carte la cadre avec ces marges
  // Les pastilles ne bougent pas d'une page à l'autre : même hauteur d'écran que dans la feuille de la page 1
  const yEcran = hauteur - feuille + yPastilles;
  // La zone des courbes : sous la ligne de date, au-dessus des pastilles
  const topGraphes = haut + HAUT_ENTETE + espace.e2 + 24;
  const hautGraphes = yEcran - topGraphes - espace.e2;
  const marges = useMemo(() => ({ haut: haut + HAUT_ENTETE, bas: feuille }), [haut, feuille]);

  const aller = (i: number) => {
    setIndex(i);
    setSurCourbe(false); // par sécurité : un doigt levé ailleurs ne doit pas laisser le défilement des pages bloqué
    defilement.current?.scrollTo({ x: i * largeur, animated: true });
  };
  const apresDefilement = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / largeur));
  const pastilles = (
    <View accessible={false} style={styles.pastilles}>
      {['Carte et profil', 'Toutes les infos'].map((nom, i) => (
        <Pressable
          key={nom}
          onPress={() => aller(i)}
          hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={`${nom}, page ${i + 1} sur 2`}
          accessibilityState={{ selected: i === index }}
          style={[styles.pastille, i === index ? { width: 22, backgroundColor: p.texte } : { backgroundColor: p.traitFort }]}
        />
      ))}
    </View>
  );

  const ligneDate = date ? (
    <View accessible accessibilityLabel={`${nomSport ?? ''} ${date}`.trim()} style={styles.ligneDate}>
      <View style={styles.gaucheDate}>
        <IconeSport sport={sport} taille={16} />
        {/* Le nom du sport dans sa couleur en thème sombre (en thème clair la couleur de sport reste réservée aux aplats : contraste insuffisant en petit texte, voir IDENTITE.md) */}
        {nomSport ? <Text style={[typo.petit, { color: p.fond === sombre.fond ? couleur : p.texteDoux }]}>{nomSport}</Text> : null}
      </View>
      <Text style={[typo.micro, { color: p.texte, letterSpacing: 1.2 }]}>{date}</Text>
    </View>
  ) : null;

  return (
    <View style={styles.page}>
      {/* bounces désactivé : sur la page 1, le balayage vers la droite part au bord gauche de l'écran (retour), pas dans ce défilement */}
      <ScrollView ref={defilement} horizontal pagingEnabled bounces={false} scrollEnabled={!surCourbe} showsHorizontalScrollIndicator={false} onMomentumScrollEnd={apresDefilement} style={{ flex: 1 }}>
        <View style={{ width: largeur, height: hauteur }}>
          {avecCarte && parcours && parcours.region ? (
            <CarteTrace plein trace={parcours.trace} region={parcours.region} couleur={couleur} curseur={curseur} marges={marges} />
          ) : (
            <View style={[styles.sansCarte, { paddingTop: haut + HAUT_ENTETE + espace.e4 }]}>
              {chargementCarte ? (
                <View accessible accessibilityLabel="Chargement de la carte" style={styles.attente}>
                  <ActivityIndicator color={p.texteDoux} />
                  <Text style={[typo.petit, { color: p.texteDoux }]}>Chargement de la carte…</Text>
                </View>
              ) : hero ? (
                <Dossard etiquette={hero.etiquette} valeur={hero.valeur} uniteValeur={hero.unite} detail={hero.detail} sport={sport} taille="l" chiffreMax={72} />
              ) : null}
            </View>
          )}

          <View onLayout={(e: LayoutChangeEvent) => setFeuille(e.nativeEvent.layout.height)} style={[styles.feuille, { backgroundColor: p.fond, borderColor: p.trait, paddingBottom: bas + espace.e3 }]}>
            {ligneDate}
            {chiffres}
            {/* La place des pastilles : la rangée elle-même est posée par-dessus le défilement, pour ne pas glisser avec les pages */}
            <View onLayout={(e: LayoutChangeEvent) => setYPastilles(e.nativeEvent.layout.y)} style={{ height: 20 }} />
            {avecProfil && parcours && parcours.altitudeMin != null && parcours.altitudeMax != null ? (
              <View style={{ height: HAUTEUR_PROFIL }}>
                <ProfilCurseur profil={parcours.profil} min={parcours.altitudeMin} max={parcours.altitudeMax} km={km != null && km > 0 ? km : kmTrace} couleur={couleur} hauteur={140} onChange={setFraction} onGlisse={setSurCourbe} />
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ width: largeur, height: hauteur, backgroundColor: p.fond }}>
          {/* Le haut de la page : la date sous l'en-tête, puis les pastilles à leur place de la page 1, puis le contenu qui défile */}
          <View style={{ position: 'absolute', left: espace.e4, right: espace.e4, top: haut + HAUT_ENTETE + espace.e2 }}>{ligneDate}</View>
          {graphesHaut ? (
            <View style={{ position: 'absolute', left: espace.e4, right: espace.e4, top: topGraphes, height: Math.max(0, hautGraphes) }}>{graphesHaut(Math.max(0, hautGraphes), setSurCourbe)}</View>
          ) : null}
          <ScrollView style={{ marginTop: yEcran + 20 + espace.e2 }} contentContainerStyle={{ paddingHorizontal: espace.e4, paddingBottom: bas + espace.e5, gap: espace.e3 }} showsVerticalScrollIndicator={false}>
            {repartitions}
            {pageDetails(setSurCourbe)}
          </ScrollView>
        </View>
      </ScrollView>

      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: yEcran }}>{pastilles}</View>

      <EnteteFlottante titre={titre} onModifier={onModifier} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  sansCarte: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, paddingHorizontal: espace.e4 },
  ligneDate: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  gaucheDate: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  attente: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  feuille: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: rayon.bloc, borderTopRightRadius: rayon.bloc, borderTopWidth: 1, paddingTop: espace.e4, paddingHorizontal: espace.e4, gap: espace.e2 },
  pastilles: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, height: 20 },
  pastille: { width: 8, height: 8, borderRadius: 4 },
});
