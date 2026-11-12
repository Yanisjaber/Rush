import { Renderer } from 'expo-three';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import * as THREE from 'three';
import { avecAlpha, rayon, type Palette } from '@/theme/couleurs';

// Expo Go ou un binaire installé avant le dernier prebuild peut ne pas embarquer ExpoGL.
// Le require est volontairement protégé : dans ce cas on affiche un aperçu animé au lieu de faire tomber la page.
let GLViewComponent: typeof import('expo-gl').GLView | null = null;
try {
  GLViewComponent = (require('expo-gl') as typeof import('expo-gl')).GLView;
} catch {
  GLViewComponent = null;
}

export type AvatarPart = 'heart' | 'lungs' | 'chest' | 'arms' | 'legs';

interface Props {
  palette: Palette;
  accent: string;
  selectedPart?: AvatarPart;
  onPartSelect?: (part: AvatarPart) => void;
}

interface LayoutSize {
  width: number;
  height: number;
}

interface PartMesh extends THREE.Object3D {
  userData: { part?: AvatarPart };
}

const PARTS: AvatarPart[] = ['heart', 'lungs', 'chest', 'arms', 'legs'];
const ORIGINE_Y = new THREE.Vector3(0, 1, 0);

function couleurHex(valeur: string): number {
  const propre = valeur.replace('#', '').slice(0, 6);
  const nombre = Number.parseInt(propre, 16);
  return Number.isFinite(nombre) ? nombre : 0xa2a7b3;
}

function segment(
  debut: THREE.Vector3,
  fin: THREE.Vector3,
  rayon: number,
  materiau: THREE.Material,
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(fin, debut);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rayon, rayon, direction.length(), 8), materiau);
  mesh.position.copy(debut).add(fin).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(ORIGINE_Y, direction.normalize());
  return mesh;
}

function spheroide(rayon: number, echelle: [number, number, number], materiau: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(rayon, 12, 8), materiau);
  mesh.scale.set(...echelle);
  return mesh;
}

function colorerPart(mesh: THREE.Object3D, part: AvatarPart): void {
  mesh.traverse((objet) => {
    const objetAvecDonnees = objet as PartMesh;
    objetAvecDonnees.userData.part = part;
  });
}

/**
 * Avatar procédural Three.js : il est composé de volumes 3D simples pour rester
 * léger sur mobile, mais chaque zone est une vraie géométrie sélectionnable.
 * Glisser tourne le personnage, toucher une zone la sélectionne.
 */
export function ModeleAthlete3D({ palette, accent, selectedPart = 'heart', onPartSelect }: Props) {
  const selectedPartRef = useRef<AvatarPart>(selectedPart);
  const onPartSelectRef = useRef(onPartSelect);
  const layoutRef = useRef<LayoutSize>({ width: 174, height: 284 });
  const avatarRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const partsRef = useRef<Map<AvatarPart, THREE.Group>>(new Map());
  const cleanupRef = useRef<(() => void) | null>(null);
  const rotationDepartRef = useRef(0);
  const deplacementRef = useRef(false);

  useEffect(() => {
    selectedPartRef.current = selectedPart;
  }, [selectedPart]);

  useEffect(() => {
    onPartSelectRef.current = onPartSelect;
  }, [onPartSelect]);

  useEffect(() => () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  const selectionner = useCallback((part: AvatarPart) => {
    selectedPartRef.current = part;
    onPartSelectRef.current?.(part);
  }, []);

  const toucherModele = useCallback((event: GestureResponderEvent) => {
    const camera = cameraRef.current;
    const avatar = avatarRef.current;
    const raycaster = raycasterRef.current;
    if (!camera || !avatar || !raycaster) return;
    const x = event.nativeEvent.locationX;
    const y = event.nativeEvent.locationY;
    const { width, height } = layoutRef.current;
    if (!(width > 0 && height > 0) || typeof x !== 'number' || typeof y !== 'number') return;
    const souris = new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1);
    raycaster.setFromCamera(souris, camera);
    const touches = raycaster.intersectObject(avatar, true);
    const part = touches.find((touche) => (touche.object as PartMesh).userData.part)?.object as PartMesh | undefined;
    if (part?.userData.part) selectionner(part.userData.part);
  }, [selectionner]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        rotationDepartRef.current = avatarRef.current?.rotation.y ?? 0;
        deplacementRef.current = false;
      },
      onPanResponderMove: (_event, gesture) => {
        if (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4) deplacementRef.current = true;
        if (avatarRef.current) avatarRef.current.rotation.y = rotationDepartRef.current + gesture.dx * 0.012;
      },
      onPanResponderRelease: (event, gesture) => {
        if (!deplacementRef.current && Math.abs(gesture.dx) < 8 && Math.abs(gesture.dy) < 8) toucherModele(event);
      },
      onPanResponderTerminate: () => {
        deplacementRef.current = true;
      },
    }),
    [toucherModele],
  );

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) layoutRef.current = { width, height };
  }, []);

  const onContextCreate = useCallback((gl: any) => {
    cleanupRef.current?.();
    const largeur = gl.drawingBufferWidth || layoutRef.current.width;
    const hauteur = gl.drawingBufferHeight || layoutRef.current.height;
    const renderer = new Renderer({
      gl,
      antialias: true,
      width: largeur,
      height: hauteur,
      pixelRatio: 1,
      clearColor: palette.fond,
    });
    renderer.setSize(largeur, hauteur, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(couleurHex(palette.fond));
    scene.fog = new THREE.Fog(couleurHex(palette.fond), 6.5, 12);

    const camera = new THREE.PerspectiveCamera(32, largeur / hauteur, 0.1, 100);
    camera.position.set(0, 1.1, 8.2);
    camera.lookAt(0, 1.1, 0);
    cameraRef.current = camera;

    scene.add(new THREE.HemisphereLight(0xf4f7ff, 0x18202b, 2.2));
    const cle = new THREE.DirectionalLight(0xffffff, 2.2);
    cle.position.set(-3, 5, 5);
    cle.castShadow = true;
    scene.add(cle);
    const lueur = new THREE.PointLight(couleurHex(accent), 1.6, 8);
    lueur.position.set(2.4, 1.6, 2.8);
    scene.add(lueur);

    const avatar = new THREE.Group();
    avatar.position.y = -0.24;
    scene.add(avatar);
    avatarRef.current = avatar;
    const groupes = new Map<AvatarPart, THREE.Group>();
    partsRef.current = groupes;
    const groupe = (part: AvatarPart): THREE.Group => {
      const resultat = new THREE.Group();
      groupes.set(part, resultat);
      avatar.add(resultat);
      return resultat;
    };

    const corps = new THREE.MeshStandardMaterial({ color: couleurHex(accent), roughness: 0.45, metalness: 0.16 });
    const corpsClair = new THREE.MeshStandardMaterial({ color: 0xbac5d4, roughness: 0.5, metalness: 0.05 });
    const peau = new THREE.MeshStandardMaterial({ color: 0xd99370, roughness: 0.72, metalness: 0.02 });
    const peauOmbre = new THREE.MeshStandardMaterial({ color: 0x9d5b54, roughness: 0.75 });
    const muscle = new THREE.MeshStandardMaterial({ color: 0xff756b, roughness: 0.5, metalness: 0.05 });
    const muscleSombre = new THREE.MeshStandardMaterial({ color: 0xc94e59, roughness: 0.52 });
    const cardio = new THREE.MeshStandardMaterial({ color: 0xff475f, emissive: 0x4d0d1b, emissiveIntensity: 0.8, roughness: 0.35 });
    const poumons = new THREE.MeshStandardMaterial({ color: 0x57d7e8, emissive: 0x0c4e61, emissiveIntensity: 0.35, transparent: true, opacity: 0.72, roughness: 0.28 });
    const sombre = new THREE.MeshStandardMaterial({ color: 0x121821, roughness: 0.58, metalness: 0.22 });

    // Jambes : enveloppe et volumes de quadriceps/mollets distincts.
    const groupeJambes = groupe('legs');
    groupeJambes.add(segment(new THREE.Vector3(-0.24, 0.46, 0), new THREE.Vector3(-0.28, -0.43, 0), 0.22, corps));
    groupeJambes.add(segment(new THREE.Vector3(0.24, 0.46, 0), new THREE.Vector3(0.28, -0.43, 0), 0.22, corps));
    groupeJambes.add(segment(new THREE.Vector3(-0.28, -0.38, 0), new THREE.Vector3(-0.23, -1.23, 0), 0.17, corpsClair));
    groupeJambes.add(segment(new THREE.Vector3(0.28, -0.38, 0), new THREE.Vector3(0.23, -1.23, 0), 0.17, corpsClair));
    const quadGauche = spheroide(0.26, [0.72, 1.28, 0.68], muscle);
    quadGauche.position.set(-0.24, 0.02, 0.2);
    groupeJambes.add(quadGauche);
    const quadDroit = spheroide(0.26, [0.72, 1.28, 0.68], muscle);
    quadDroit.position.set(0.24, 0.02, 0.2);
    groupeJambes.add(quadDroit);
    const molletGauche = spheroide(0.2, [0.72, 1.05, 0.6], muscleSombre);
    molletGauche.position.set(-0.23, -0.82, 0.17);
    groupeJambes.add(molletGauche);
    const molletDroit = spheroide(0.2, [0.72, 1.05, 0.6], muscleSombre);
    molletDroit.position.set(0.23, -0.82, 0.17);
    groupeJambes.add(molletDroit);
    const chaussureGauche = spheroide(0.23, [1.3, 0.38, 1.8], sombre);
    chaussureGauche.position.set(-0.23, -1.43, 0.12);
    groupeJambes.add(chaussureGauche);
    const chaussureDroite = spheroide(0.23, [1.3, 0.38, 1.8], sombre);
    chaussureDroite.position.set(0.23, -1.43, 0.12);
    groupeJambes.add(chaussureDroite);
    colorerPart(groupeJambes, 'legs');

    // Bras : deltoïdes, biceps et avant-bras suivent la rotation du personnage.
    const groupeBras = groupe('arms');
    for (const cote of [-1, 1]) {
      const epaule = new THREE.Vector3(cote * 0.56, 1.76, 0);
      const coude = new THREE.Vector3(cote * 0.86, 1.15, 0);
      const main = new THREE.Vector3(cote * 0.78, 0.55, 0.02);
      const deltoide = spheroide(0.2, [1, 0.9, 0.95], muscle);
      deltoide.position.copy(epaule);
      groupeBras.add(deltoide);
      groupeBras.add(segment(epaule, coude, 0.15, peau));
      groupeBras.add(segment(coude, main, 0.12, peauOmbre));
      const biceps = spheroide(0.15, [0.7, 1.45, 0.68], muscle);
      biceps.position.copy(epaule).add(coude).multiplyScalar(0.5);
      groupeBras.add(biceps);
    }
    colorerPart(groupeBras, 'arms');

    // Buste, pectoraux et épaules.
    const groupeTorse = groupe('chest');
    const torse = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.86, 6, 12), corps);
    torse.scale.set(1, 0.84, 0.72);
    torse.position.set(0, 1.22, 0);
    groupeTorse.add(torse);
    const bassin = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 0.22, 5, 10), sombre);
    bassin.scale.set(1.05, 0.75, 0.78);
    bassin.position.set(0, 0.44, 0);
    groupeTorse.add(bassin);
    const pecGauche = spheroide(0.23, [1.15, 0.7, 0.52], muscle);
    pecGauche.position.set(-0.24, 1.48, 0.43);
    groupeTorse.add(pecGauche);
    const pecDroit = spheroide(0.23, [1.15, 0.7, 0.52], muscle);
    pecDroit.position.set(0.24, 1.48, 0.43);
    groupeTorse.add(pecDroit);
    const epauleGauche = spheroide(0.2, [1.15, 0.95, 0.9], muscleSombre);
    epauleGauche.position.set(-0.53, 1.74, 0);
    groupeTorse.add(epauleGauche);
    const epauleDroit = spheroide(0.2, [1.15, 0.95, 0.9], muscleSombre);
    epauleDroit.position.set(0.53, 1.74, 0);
    groupeTorse.add(epauleDroit);
    colorerPart(groupeTorse, 'chest');

    // Poumons translucides et cœur pulsant, chacun avec une vraie zone de hit-test.
    const groupePoumons = groupe('lungs');
    const poumonGauche = spheroide(0.24, [0.9, 1.45, 0.72], poumons);
    poumonGauche.position.set(-0.2, 1.45, 0.48);
    groupePoumons.add(poumonGauche);
    const poumonDroit = spheroide(0.24, [0.9, 1.45, 0.72], poumons);
    poumonDroit.position.set(0.2, 1.45, 0.48);
    groupePoumons.add(poumonDroit);
    colorerPart(groupePoumons, 'lungs');

    const groupeCoeur = groupe('heart');
    const coeurGauche = spheroide(0.13, [1, 1.1, 1], cardio);
    coeurGauche.position.set(-0.085, 1.5, 0.66);
    groupeCoeur.add(coeurGauche);
    const coeurDroit = spheroide(0.13, [1, 1.1, 1], cardio);
    coeurDroit.position.set(0.085, 1.5, 0.66);
    groupeCoeur.add(coeurDroit);
    const pointeCoeur = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.28, 8), cardio);
    pointeCoeur.rotation.z = Math.PI;
    pointeCoeur.position.set(0, 1.35, 0.66);
    groupeCoeur.add(pointeCoeur);
    colorerPart(groupeCoeur, 'heart');

    // Cou, tête et petites oreilles pour garder une silhouette humaine complète.
    const cou = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.3, 10), peauOmbre);
    cou.position.set(0, 2.03, 0);
    avatar.add(cou);
    const tete = spheroide(0.34, [0.92, 1.1, 0.88], peau);
    tete.position.set(0, 2.4, 0);
    avatar.add(tete);
    const cheveux = spheroide(0.33, [1, 0.44, 0.94], sombre);
    cheveux.position.set(0, 2.69, -0.01);
    avatar.add(cheveux);

    const sol = new THREE.Mesh(new THREE.CircleGeometry(1.12, 32), new THREE.MeshBasicMaterial({ color: couleurHex(accent), transparent: true, opacity: 0.1 }));
    sol.rotation.x = -Math.PI / 2;
    sol.position.y = -1.64;
    avatar.add(sol);

    const raycaster = new THREE.Raycaster();
    raycasterRef.current = raycaster;
    let vivant = true;
    let frame = 0;
    const depart = Date.now();
    const dessiner = () => {
      if (!vivant) return;
      const temps = (Date.now() - depart) / 1000;
      const groupeCoeurActuel = groupes.get('heart');
      if (groupeCoeurActuel) {
        const pulse = 1 + Math.max(0, Math.sin(temps * 5.2)) * 0.1;
        groupeCoeurActuel.scale.setScalar((selectedPartRef.current === 'heart' ? 1.08 : 1) * pulse);
      }
      for (const part of PARTS) {
        if (part === 'heart') continue;
        const groupePart = groupes.get(part);
        if (groupePart) groupePart.scale.setScalar(selectedPartRef.current === part ? 1.08 : 1);
      }
      renderer.render(scene, camera);
      gl.endFrameEXP();
      frame = requestAnimationFrame(dessiner);
    };
    dessiner();

    const nettoyer = () => {
      vivant = false;
      cancelAnimationFrame(frame);
      renderer.dispose();
      scene.traverse((objet) => {
        const mesh = objet as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const materiau = mesh.material;
        if (Array.isArray(materiau)) materiau.forEach((m) => m.dispose());
        else if (materiau) materiau.dispose();
      });
      avatarRef.current = null;
      cameraRef.current = null;
      raycasterRef.current = null;
      partsRef.current.clear();
    };
    cleanupRef.current = nettoyer;
  }, [accent, palette.fond]);

  return (
    !GLViewComponent ? <Avatar3DFallback palette={palette} accent={accent} /> :
    <View collapsable={false} accessible accessibilityLabel="Avatar 3D de l'athlète. Glisse pour le faire tourner, touche une zone pour afficher ses informations." onLayout={onLayout} style={styles.conteneur} {...panResponder.panHandlers}>
      <GLViewComponent style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      <View pointerEvents="none" style={styles.indicateur}>
        <View style={styles.poignee} />
      </View>
    </View>
  );
}

/** Repli visuel pour Expo Go / ancien binaire : aucune dépendance native, donc pas de crash. */
function Avatar3DFallback({ palette, accent }: Pick<Props, 'palette' | 'accent'>) {
  const rotation = useRef(new Animated.Value(0)).current;
  const flottement = useRef(new Animated.Value(0)).current;
  const angle = useRef(0);
  const angleDepart = useRef(0);

  useEffect(() => {
    const souffle = Animated.loop(
      Animated.sequence([
        Animated.timing(flottement, { toValue: 1, duration: 1700, useNativeDriver: true }),
        Animated.timing(flottement, { toValue: 0, duration: 1700, useNativeDriver: true }),
      ]),
    );
    souffle.start();
    return () => souffle.stop();
  }, [flottement]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { angleDepart.current = angle.current; },
    onPanResponderMove: (_event, gesture) => {
      angle.current = Math.max(-24, Math.min(24, angleDepart.current + gesture.dx * 0.35));
      rotation.setValue(angle.current);
    },
  }), [rotation]);
  const rotationY = rotation.interpolate({ inputRange: [-24, 24], outputRange: ['-24deg', '24deg'] });
  const translationY = flottement.interpolate({ inputRange: [0, 1], outputRange: [1, -4] });

  return (
    <View style={styles.conteneur} {...pan.panHandlers}>
      <Animated.View style={[styles.fallbackModele, { transform: [{ perspective: 800 }, { rotateY: rotationY }, { translateY: translationY }] }]}>
        <Svg width="174" height="284" viewBox="0 0 240 330">
          <Defs>
            <LinearGradient id="fallbackBody" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={palette.texte} />
              <Stop offset="0.55" stopColor={accent} />
              <Stop offset="1" stopColor={avecAlpha(accent, 0.42)} />
            </LinearGradient>
            <LinearGradient id="fallbackSkin" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#f6c7a6" />
              <Stop offset="1" stopColor="#8c4e50" />
            </LinearGradient>
          </Defs>
          <Ellipse cx="120" cy="306" rx="62" ry="11" fill={avecAlpha(palette.texte, 0.17)} />
          <G stroke={avecAlpha(palette.fond, 0.55)} strokeWidth="2" strokeLinejoin="round">
            <Path d="M94 176l-3 68-18 48 20 5 28-48 7-65z" fill="url(#fallbackBody)" />
            <Path d="M146 176l3 68 18 48-20 5-28-48-7-65z" fill={avecAlpha(palette.texte, 0.48)} />
            <Path d="M75 285l17 3 10 14-32 0zM165 285l-17 3-10 14 32 0z" fill={palette.texte} />
            <Path d="M87 92l-21 18-25 61 16 6 31-54 16-17zM153 92l21 18 25 61-16 6-31-54-16-17z" fill="url(#fallbackBody)" />
            <Circle cx="53" cy="173" r="10" fill="url(#fallbackSkin)" />
            <Circle cx="187" cy="173" r="10" fill="url(#fallbackSkin)" />
            <Path d="M89 84q31-20 62 0l15 85q-15 18-46 18t-46-18z" fill="url(#fallbackBody)" />
            <Path d="M91 148q29 11 58 0l7 28q-16 11-36 11t-36-11z" fill={avecAlpha(palette.texte, 0.82)} />
            <Path d="M108 78v18q12 8 24 0V78z" fill="url(#fallbackSkin)" />
            <Circle cx="116" cy="48" r="28" fill="url(#fallbackSkin)" />
            <Path d="M91 47q4-30 30-29 25 2 29 29-13-14-31-8-14 5-28 8z" fill={palette.texte} />
            <Circle cx="107" cy="49" r="2.4" fill={palette.fond} stroke="none" />
            <Circle cx="128" cy="49" r="2.4" fill={palette.fond} stroke="none" />
            <Ellipse cx="108" cy="132" rx="15" ry="10" fill={palette.danger} stroke="none" />
            <Ellipse cx="132" cy="132" rx="15" ry="10" fill={palette.danger} stroke="none" />
            <Ellipse cx="120" cy="127" rx="7" ry="14" fill={palette.danger} stroke="none" />
          </G>
          <Path d="M102 91q14-7 21-3l-8 80-18-5z" fill={avecAlpha(palette.texte, 0.17)} />
        </Svg>
      </Animated.View>
      <View pointerEvents="none" style={styles.fallbackBadge}>
        <View style={styles.liveDot} />
        <View><View style={styles.fallbackBadgeLine} /><View style={styles.fallbackBadgeLineShort} /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { width: 174, height: 284, borderRadius: rayon.carte, overflow: 'hidden', backgroundColor: 'transparent' },
  indicateur: { position: 'absolute', left: 0, right: 0, bottom: 7, alignItems: 'center' },
  poignee: { width: 28, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  fallbackModele: { width: 174, height: 284, alignItems: 'center', justifyContent: 'center' },
  fallbackBadge: { position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 5, opacity: 0.75 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' },
  fallbackBadgeLine: { width: 25, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.5)' },
  fallbackBadgeLineShort: { width: 16, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 3 },
});
