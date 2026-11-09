import { useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
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
// le retour, le titre et le crayon flottants, et une feuille en bas avec les trois chiffres clés puis trois pages qu'on balaie : Profil, Tours, Notes et données.
// Sur la page Profil, on glisse le doigt sur la courbe : un point suit sur la carte. Les pastilles de pagination se touchent aussi.
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
  /** Les trois chiffres clés, sous la pastille de pagination. */
  chiffres: ReactNode;
  pageTours: ReactNode;
  pageDonnees: ReactNode;
  onModifier?: () => void;
}

const HAUTEUR_PAGE = 166; // juste la hauteur du profil (courbe et repères de distance) ; les pages Tours et Notes défilent dedans

export function VueSortie({ parcours, chargementCarte, km, couleur, sport, titre, date, nomSport, hero, chiffres, pageTours, pageDonnees, onModifier }: Props) {
  const p = usePalette();
  const { top: haut, bottom: bas } = useSafeAreaInsets();
  const avecCarte = !!parcours?.region && parcours.trace.length > 1;
  const avecProfil = !!parcours && parcours.profil.length > 1 && parcours.altitudeMin != null && parcours.altitudeMax != null;
  const pages = useMemo(() => [...(avecProfil ? (['profil'] as const) : []), 'tours' as const, 'donnees' as const], [avecProfil]);
  const NOMS = { profil: 'Profil', tours: 'Tours', donnees: 'Notes et données' } as const;

  const [dims, setDims] = useState({ feuille: 0, pager: 0 });
  const [fraction, setFraction] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [surCourbe, setSurCourbe] = useState(false); // le doigt est sur la courbe : on suspend le balayage des pages, sinon il emporterait la page avec lui
  const defilement = useRef<ComponentRef<typeof ScrollView>>(null);
  // L'axe va jusqu'à la distance de la sortie (celle de la tuile) : le bout du profil et « Distance » disent la même chose. La longueur mesurée sur la trace simplifiée ne sert que sans distance.
  const kmTrace = useMemo(() => (parcours ? longueurKm(parcours.trace) : 0), [parcours]);
  const pageActuelle = pages[Math.min(index, pages.length - 1)];
  // Le point du curseur n'a de sens que sur la page Profil
  const curseur = useMemo(() => (pageActuelle === 'profil' && fraction != null && parcours ? pointAuFraction(parcours.trace, fraction) : null), [parcours, fraction, pageActuelle]);
  // La trace doit rester entière dans la zone libre (sous l'en-tête, au-dessus de la feuille) : la carte la cadre avec ces marges
  const marges = useMemo(() => ({ haut: haut + HAUT_ENTETE, bas: dims.feuille }), [haut, dims.feuille]);

  const aller = (i: number) => {
    setIndex(i);
    setSurCourbe(false); // par sécurité : un doigt levé ailleurs ne doit pas laisser le défilement des pages bloqué
    defilement.current?.scrollTo({ x: i * dims.pager, animated: true });
  };
  // Le haut de la feuille (date, chiffres, pastilles) change de page lui aussi : glisser vers la gauche va à la page suivante, vers la droite à la précédente.
  // (Sur la première page, la droite ne fait rien ici : c'est le retour par le bord de l'écran qui s'en charge.)
  const etatPages = useRef({ index, nombre: pages.length, aller });
  etatPages.current = { index, nombre: pages.length, aller };
  // Détection directe (début et fin du doigt) plutôt que le système de gestes, qui peut se faire voler le toucher par les éléments voisins
  const debutDoigt = useRef<{ x: number; y: number } | null>(null);
  const balayage = {
    onTouchStart: (e: GestureResponderEvent) => {
      debutDoigt.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    },
    onTouchEnd: (e: GestureResponderEvent) => {
      const d = debutDoigt.current;
      debutDoigt.current = null;
      if (!d) return;
      const dx = e.nativeEvent.pageX - d.x;
      const dy = e.nativeEvent.pageY - d.y;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return; // un vrai balayage horizontal, pas un appui ni un geste vertical
      const { index: i, nombre, aller: va } = etatPages.current;
      if (dx < 0 && i < nombre - 1) va(i + 1);
      else if (dx > 0 && i > 0) va(i - 1);
    },
    onTouchCancel: () => {
      debutDoigt.current = null;
    },
  };
  const apresDefilement = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (dims.pager > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / dims.pager));
  };

  return (
    <View style={styles.page}>
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

      <EnteteFlottante titre={titre} onModifier={onModifier} />

      <View
        onLayout={(e: LayoutChangeEvent) => setDims((d) => ({ ...d, feuille: e.nativeEvent.layout.height }))}
        style={[styles.feuille, { backgroundColor: p.fond, borderColor: p.trait, paddingBottom: bas + espace.e3 }]}
      >
        <View {...balayage} style={{ gap: espace.e2 }}>
        {date ? (
          <View accessible accessibilityLabel={`${nomSport ?? ''} ${date}`.trim()} style={styles.ligneDate}>
            <IconeSport sport={sport} taille={16} />
            {/* Le nom du sport dans sa couleur en thème sombre (en thème clair la couleur de sport reste réservée aux aplats : contraste insuffisant en petit texte, voir IDENTITE.md), puis la date et l'heure en blanc et en capitales */}
            {nomSport ? <Text style={[typo.petit, { color: p.fond === sombre.fond ? couleur : p.texteDoux }]}>{nomSport}</Text> : null}
            <Text style={[typo.micro, { color: p.texte, letterSpacing: 1.2 }]}>{nomSport ? '· ' : ''}{date}</Text>
          </View>
        ) : null}
        {chiffres}

        <View accessible={false} style={styles.pastilles}>
          {pages.map((nom, i) => (
            <Pressable
              key={nom}
              onPress={() => aller(i)}
              hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={`${NOMS[nom]}, page ${i + 1} sur ${pages.length}`}
              accessibilityState={{ selected: i === index }}
              style={[styles.pastille, i === index ? { width: 22, backgroundColor: p.texte } : { backgroundColor: p.traitFort }]}
            />
          ))}
        </View>
        <Text style={[typo.micro, { color: p.texteMuet, letterSpacing: 1.2 }]}>
          {NOMS[pageActuelle].toUpperCase()} · PAGE {Math.min(index, pages.length - 1) + 1} SUR {pages.length}
        </Text>
        </View>

        <View style={{ height: HAUTEUR_PAGE }} onLayout={(e: LayoutChangeEvent) => setDims((d) => ({ ...d, pager: e.nativeEvent.layout.width }))}>
          {dims.pager > 0 ? (
            <ScrollView ref={defilement} horizontal pagingEnabled scrollEnabled={!surCourbe} showsHorizontalScrollIndicator={false} onMomentumScrollEnd={apresDefilement} style={{ flex: 1 }}>
              {pages.map((nom) => (
                <View key={nom} style={{ width: dims.pager, height: HAUTEUR_PAGE }}>
                  {nom === 'profil' && parcours && parcours.altitudeMin != null && parcours.altitudeMax != null ? (
                    <ProfilCurseur profil={parcours.profil} min={parcours.altitudeMin} max={parcours.altitudeMax} km={km != null && km > 0 ? km : kmTrace} couleur={couleur} hauteur={140} onChange={setFraction} onGlisse={setSurCourbe} />
                  ) : (
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator contentContainerStyle={{ paddingBottom: espace.e2 }}>
                      {nom === 'tours' ? pageTours : pageDonnees}
                    </ScrollView>
                  )}
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  sansCarte: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, paddingHorizontal: espace.e4 },
  ligneDate: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attente: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  feuille: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: rayon.bloc, borderTopRightRadius: rayon.bloc, borderTopWidth: 1, paddingTop: espace.e4, paddingHorizontal: espace.e4, gap: espace.e2 },
  pastilles: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, height: 20 },
  pastille: { width: 8, height: 8, borderRadius: 4 },
});
