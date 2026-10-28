import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { GOUTTIERE, styleEmplacement, styles as stylesGrille } from '@/components/GrilleWidgets';
import { ECART_LIGNES } from '@/components/taille';
import { deplacerVers, elementSousPoint, vitesseDefilement, type BoiteGrille } from '@/data/sports/glisse';
import { placerGrille, solitaires } from '@/data/accueil/grille';
import type { Taille } from '@/data/types';
import { usePalette } from '@/theme/usePalette';

// La grille de l'accueil (voir GrilleWidgets) dont on réordonne les éléments en les glissant (comme l'écran d'accueil de l'iPhone) :
// un maintien très bref suffit, pour que le défilement reste possible.
// Chaque élément est déjà entouré et porte un crayon en haut à droite : il ouvre la fenêtre de modification (taille, suppression).
// Pendant le glissement, les autres éléments se rangent en direct comme ils le seront au lâcher, et un contour marque la place
// qui attend l'élément glissé. Près du haut ou du bas de l'écran, la liste défile toute seule.
// Pour VoiceOver : deux actions « Monter » et « Descendre » sur chaque élément.
interface Defilement {
  /** Position actuelle du défilement (mise à jour par le ScrollView parent). */
  decalage: RefObject<number>;
  /** Fait défiler le ScrollView parent à cette position. */
  vers: (y: number) => void;
  /** Zone visible à l'écran où le doigt peut aller avant que la liste défile (coordonnées de l'écran). */
  haut: number;
  bas: number;
}

interface Props {
  ids: string[];
  /** Appelé quand on touche le crayon d'un élément. */
  onModifier: (id: string) => void;
  /** Appelé une fois l'élément lâché : de l'index `de` vers l'index `vers`. */
  onDeplacer: (de: number, vers: number) => void;
  /** Dit au parent qu'un glissement est en cours (pour couper le défilement à la main). */
  onGlisse: (enCours: boolean) => void;
  defilement: Defilement;
  nom: (id: string) => string;
  taille: (id: string) => Taille;
  rendre: (id: string) => ReactNode;
}

const MAINTIEN_MS = 120;
// Le contour d'un widget en édition déborde de 4 pt autour de lui, sans changer sa taille ni sa place (l'édition est identique à l'accueil)
const DEBORD = 4;
// Après un échange, le suivant n'est possible qu'une fois le doigt déplacé de cette distance (évite les enchaînements en cascade)
const DISTANCE_ENTRE_ECHANGES = 36;

export function ListeTriable({ ids, onModifier, onDeplacer, onGlisse, defilement, nom, taille, rendre }: Props) {
  const p = usePalette();
  const boites = useRef<Record<string, BoiteGrille>>({});
  const largeur = useRef(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const [actif, setActif] = useState<{ id: string; de: number; vers: number } | null>(null);
  // Le dernier état du glissement, lu par la boucle de défilement automatique
  const suivi = useRef<{ id: string; de: number; vers: number; dx: number; dy: number; doigtY: number; decalageDepart: number; dernier: { x: number; y: number } | null } | null>(null);
  const minuteur = useRef<ReturnType<typeof setInterval> | null>(null);

  // La place de départ de chaque élément : calculée avec les mêmes règles que la grille (placerGrille) à partir de ses seules tailles mesurées.
  // (La position mesurée par onLayout ne sert pas : elle est inexacte dans une grille qui passe à la ligne.)
  const liste = useCallback((): BoiteGrille[] => {
    const cases = ids.map((id) => ({ taille: taille(id), w: boites.current[id]?.w ?? 0, h: boites.current[id]?.h ?? 0 }));
    const origines = placerGrille(cases, largeur.current);
    return cases.map((c, i) => ({ x: origines[i].x, y: origines[i].y, w: c.w, h: c.h }));
  }, [ids, taille]);

  const recalculer = useCallback(() => {
    const s = suivi.current;
    if (!s) return;
    const total = s.dy + ((defilement.decalage.current ?? 0) - s.decalageDepart);
    tx.value = s.dx;
    ty.value = total;
    const b = liste();
    // Le centre du widget glissé, dans le repère de la grille
    const cx = (b[s.de]?.x ?? 0) + (b[s.de]?.w ?? 0) / 2 + s.dx;
    const cy = (b[s.de]?.y ?? 0) + (b[s.de]?.h ?? 0) / 2 + total;
    // Un échange à la fois : on ne change de place qu'en passant sur un autre widget, à l'endroit où il est affiché MAINTENANT
    if (s.dernier && Math.hypot(cx - s.dernier.x, cy - s.dernier.y) < DISTANCE_ENTRE_ECHANGES) return;
    const ordre = deplacerVers(ids, s.de, s.vers);
    const places = placerGrille(ordre.map((id) => ({ taille: taille(id), w: boites.current[id]?.w ?? 0, h: boites.current[id]?.h ?? 0 })), largeur.current);
    const maintenant = ordre.map((id, i) => ({ x: places[i].x, y: places[i].y, w: boites.current[id]?.w ?? 0, h: boites.current[id]?.h ?? 0 }));
    const sous = elementSousPoint(maintenant, s.vers, cx, cy);
    if (sous >= 0 && sous !== s.vers) {
      s.vers = sous;
      s.dernier = { x: cx, y: cy };
      setActif({ id: s.id, de: s.de, vers: sous });
    }
  }, [defilement.decalage, ids, liste, taille, tx, ty]);

  const arreterDefilement = () => {
    if (minuteur.current) clearInterval(minuteur.current);
    minuteur.current = null;
  };
  useEffect(() => arreterDefilement, []);

  const debut = useCallback(
    (id: string, index: number) => {
      suivi.current = { id, de: index, vers: index, dx: 0, dy: 0, doigtY: 0, decalageDepart: defilement.decalage.current ?? 0, dernier: null };
      tx.value = 0;
      ty.value = 0;
      setActif({ id, de: index, vers: index });
      onGlisse(true);
      arreterDefilement();
      // Près du bord de l'écran, la liste défile toute seule tant que le doigt y reste
      minuteur.current = setInterval(() => {
        const s = suivi.current;
        if (!s) return;
        const v = vitesseDefilement(s.doigtY, defilement.haut, defilement.bas);
        if (v === 0) return;
        defilement.vers(Math.max(0, (defilement.decalage.current ?? 0) + v));
        recalculer();
      }, 16);
    },
    [defilement, onGlisse, recalculer, tx, ty],
  );

  const bouge = useCallback(
    (dx: number, dy: number, doigtY: number) => {
      const s = suivi.current;
      if (!s) return;
      s.dx = dx;
      s.dy = dy;
      s.doigtY = doigtY;
      recalculer();
    },
    [recalculer],
  );

  const fin = useCallback(() => {
    const s = suivi.current;
    suivi.current = null;
    arreterDefilement();
    setActif(null);
    tx.value = 0;
    ty.value = 0;
    onGlisse(false);
    if (s && s.vers !== s.de) onDeplacer(s.de, s.vers);
  }, [onDeplacer, onGlisse, tx, ty]);

  const seuls = solitaires(ids.map(taille));

  // Aperçu : où chaque élément se rangera si on lâchait maintenant. Les autres se poussent jusque-là ; l'élément glissé suit le doigt.
  const ordre = actif ? deplacerVers(ids, actif.de, actif.vers) : ids;
  const places = actif
    ? placerGrille(
        ordre.map((id) => ({ taille: taille(id), w: boites.current[id]?.w ?? 0, h: boites.current[id]?.h ?? 0 })),
        largeur.current,
      )
    : [];
  const placeDe = (id: string) => places[ordre.indexOf(id)];
  const origines = actif ? liste() : [];
  const pousseDe = (id: string) => {
    const b = origines[ids.indexOf(id)];
    const pl = placeDe(id);
    return actif && b && pl && actif.id !== id ? { x: pl.x - b.x, y: pl.y - b.y } : { x: 0, y: 0 };
  };
  const place = actif ? placeDe(actif.id) : undefined;
  const boiteActive = actif ? boites.current[actif.id] : undefined;

  return (
    <View style={stylesGrille.grille} onLayout={(e) => (largeur.current = e.nativeEvent.layout.width)}>
      {/* La place qui attend l'élément glissé */}
      {place && boiteActive ? (
        <View
          pointerEvents="none"
          style={[styles.place, { left: place.x + GOUTTIERE - DEBORD, top: place.y - DEBORD, width: boiteActive.w - 2 * GOUTTIERE + 2 * DEBORD, height: boiteActive.h - ECART_LIGNES + 2 * DEBORD, borderColor: p.sportNeutre }]}
        />
      ) : null}
      {ids.map((id, index) => (
        <Triable
          key={id}
          id={id}
          index={index}
          total={ids.length}
          nom={nom(id)}
          taille={taille(id)}
          seul={seuls[index]}
          leve={actif?.id === id}
          pousse={pousseDe(id)}
          anime={!!actif}
          tx={tx}
          ty={ty}
          onModifier={onModifier}
          onDeplacer={onDeplacer}
          onMesure={(b) => {
            boites.current[id] = b;
          }}
          onDebut={debut}
          onBouge={bouge}
          onFin={fin}
        >
          {rendre(id)}
        </Triable>
      ))}
    </View>
  );
}

interface TriableProps {
  id: string;
  index: number;
  total: number;
  nom: string;
  taille: Taille;
  seul: boolean;
  leve: boolean;
  /** De combien l'élément est poussé pour faire de la place à celui qu'on glisse. */
  pousse: { x: number; y: number };
  /** Un glissement est en cours : les déplacements s'animent (au lâcher, ils sont immédiats : la grille a déjà changé). */
  anime: boolean;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  onModifier: (id: string) => void;
  onDeplacer: (de: number, vers: number) => void;
  onMesure: (b: BoiteGrille) => void;
  onDebut: (id: string, index: number) => void;
  onBouge: (dx: number, dy: number, doigtY: number) => void;
  onFin: () => void;
  children: ReactNode;
}

function Triable({ id, index, total, nom, taille, seul, leve, pousse, anime, tx, ty, onModifier, onDeplacer, onMesure, onDebut, onBouge, onFin, children }: TriableProps) {
  const p = usePalette();
  const pan = usePanGesture({
    activateAfterLongPress: MAINTIEN_MS,
    runOnJS: true,
    onActivate: () => onDebut(id, index),
    onUpdate: (e) => onBouge(e.translationX, e.translationY, e.absoluteY),
    onFinalize: () => onFin(),
  });
  // Pas de tableau de dépendances : sur mobile Reanimated suit tout seul ce que le style lit (`leve`, `pousse`, `tx`, `ty`)
  const style = useAnimatedStyle(() => ({
      transform: [
        { translateX: leve ? tx.value : anime ? withTiming(pousse.x, { duration: 180 }) : pousse.x },
        { translateY: leve ? ty.value : anime ? withTiming(pousse.y, { duration: 180 }) : pousse.y },
        { scale: withTiming(leve ? 1.03 : 1, { duration: 120 }) },
      ],
      zIndex: leve ? 10 : 0,
      opacity: leve ? 0.92 : 1,
  }));

  return (
    <Animated.View
        onLayout={(e) => onMesure({ x: 0, y: 0, w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={[styleEmplacement(taille, seul), style]}
        accessible
        accessibilityLabel={`${nom}, position ${index + 1} sur ${total}`}
        accessibilityHint="Glisse pour déplacer. L'action Modifier ouvre la taille et la suppression."
        accessibilityActions={[
          ...(index > 0 ? [{ name: 'moveUp', label: 'Monter' }] : []),
          ...(index < total - 1 ? [{ name: 'moveDown', label: 'Descendre' }] : []),
          // Le crayon est dans un élément déjà « accessible » : VoiceOver ne le voit pas seul, on l'expose comme action
          { name: 'modifier', label: 'Modifier la taille ou supprimer' },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'moveUp') onDeplacer(index, index - 1);
          if (e.nativeEvent.actionName === 'moveDown') onDeplacer(index, index + 1);
          if (e.nativeEvent.actionName === 'modifier') onModifier(id);
        }}
      >
        {/* Seul le corps du widget déclenche le glisser : le crayon est à côté, un appui lent dessus ne lance jamais un déplacement */}
        <GestureDetector gesture={pan}>
          <View collapsable={false} style={styles.zone}>
            <View style={styles.inerte}>{children}</View>
          </View>
        </GestureDetector>
        {/* Le contour est dessiné par-dessus : il ne prend pas de place, le widget garde exactement sa taille et sa position de l'accueil */}
        <View pointerEvents="none" style={[styles.contour, { borderColor: p.texte }]} />
        {/* Le crayon : entouré comme un bouton sélectionné, il ouvre la fenêtre de modification */}
        <Pressable
          onPress={() => onModifier(id)}
          accessibilityRole="button"
          accessibilityLabel={`Modifier ${nom}`}
          hitSlop={10}
          style={[styles.crayon, { backgroundColor: p.surface, borderColor: p.texte }]}
        >
          <Text style={[styles.glyphe, { color: p.texte }]}>✎</Text>
        </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Le contenu d'un widget est inerte en édition : un appui ne l'atteint pas, seul le crayon répond
  zone: { flex: 1 },
  inerte: { flex: 1, pointerEvents: 'none' },
  // À cheval sur le coin haut droit : il ne cache pas le contenu du widget
  crayon: { position: 'absolute', top: -6, right: 0, width: 24, height: 24, borderRadius: 12, zIndex: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  glyphe: { fontSize: 12, lineHeight: 14 },
  // Le contour de la place d'arrivée, derrière les éléments
  place: { position: 'absolute', borderWidth: 3, borderRadius: 22, opacity: 0.8 },
  contour: { position: 'absolute', top: -DEBORD, bottom: ECART_LIGNES - DEBORD, left: GOUTTIERE - DEBORD, right: GOUTTIERE - DEBORD, borderWidth: 2, borderStyle: 'dashed', borderRadius: 22 },
});
