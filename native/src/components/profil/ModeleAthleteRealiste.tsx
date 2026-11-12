import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { loadTextureAsync, loaderClassForExtension, Renderer } from 'expo-three';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder,StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import * as THREE from 'three';
import { CAMERA, POINTS_MODELE, type ZoneAvatarCle } from '@/data/avatar/ancrages';
import { rayon, type Palette } from '@/theme/couleurs';

// Même protection que l'avatar procédural : Expo Go ou un ancien binaire peut ne pas embarquer ExpoGL.
let GLViewComponent: typeof import('expo-gl').GLView | null = null;
try {
  GLViewComponent = (require('expo-gl') as typeof import('expo-gl')).GLView;
} catch {
  GLViewComponent = null;
}

/** Mêmes zones que `ModeleAthlete3D` : les deux composants sont interchangeables. */
export type ZoneAvatar = ZoneAvatarCle;

interface Props {
  palette: Palette;
  /** Couleur de la surbrillance et des organes sélectionnés : la couleur du sport. */
  accent: string;
  selectedPart?: ZoneAvatar;
  onPartSelect?: (part: ZoneAvatar) => void;
  /** Taille de la vue (par défaut 174 × 284, comme l'ancien avatar). */
  largeur?: number | `${number}%`;
  hauteur?: number;
  /** Le t-shirt de l'avatar prend le dessin du maillot de vélo (même forme, seule la texture change). */
  maillot?: boolean;
}

const FICHIER_MODELE = require('../../../assets/avatar/athlete.glb');
const TEXTURE_COULEUR = require('../../../assets/avatar/athlete_color.jpg');
const TEXTURE_NORMALE = require('../../../assets/avatar/athlete_normal.jpg');
const TEXTURE_COULEUR_MAILLOT = require('../../../assets/avatar/athlete_color_maillot.jpg');

interface SurfaceMaterial {
  part: ZoneAvatar;
  materiau: THREE.MeshStandardMaterial;
  emissive: THREE.Color;
  intensite: number;
}

interface CibleModele {
  corps: THREE.Object3D;
  surfaces: SurfaceMaterial[];
}

function zoneDepuisMateriau(nom: string): ZoneAvatar | undefined {
  const normalise = nom.toLowerCase();
  if (normalise.includes('chest')) return 'chest';
  if (normalise.includes('arms')) return 'arms';
  if (normalise.includes('legs')) return 'legs';
  return undefined;
}

function zoneDepuisIntersection(intersection: THREE.Intersection): ZoneAvatar | undefined {
  const mesh = intersection.object as THREE.Mesh;
  const materiaux = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const index = typeof intersection.faceIndex === 'number' ? intersection.faceIndex * 3 : -1;
  const groupe = mesh.geometry.groups.find((g) => index >= g.start && index < g.start + g.count);
  const materiau = materiaux[groupe?.materialIndex ?? 0];
  return materiau ? zoneDepuisMateriau(materiau.name) : undefined;
}

/**
 * Lit le GLB avec GLTFLoader.parse (qui reçoit l'ArrayBuffer directement : FileLoader essaie sinon de
 * décoder le GLB comme du JSON sur certaines versions natives d'Expo).
 * Les images sont embarquées dans le GLB, mais React Native ne sait pas fabriquer un Blob depuis un
 * ArrayBuffer : GLTFLoader échouerait. On lui donne donc, via un plugin `loadTexture`, les deux
 * textures déjà chargées par Expo (source 0 du GLB = relief, source 1 = couleur). Rien de global n'est modifié.
 */
async function lireGlb(tampon: ArrayBuffer, textures: { couleur: THREE.Texture; normale: THREE.Texture }): Promise<any> {
  const GLTFLoader = loaderClassForExtension('gltf');
  const loader = new GLTFLoader();
  loader.register((parser: any) => ({
    name: 'RushTexturesExpo',
    loadTexture(index: number) {
      const source = parser.json.textures?.[index]?.source;
      return Promise.resolve(source === 1 ? textures.couleur : textures.normale);
    },
  }));
  return new Promise((resolve, reject) => {
    loader.parse(tampon, '', resolve, reject);
  });
}

function couleurHex(valeur: string): number {
  const nombre = Number.parseInt(valeur.replace('#', '').slice(0, 6), 16);
  return Number.isFinite(nombre) ? nombre : 0xa2a7b3;
}

const borne = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));
const ZOOM_MIN = 0.72;
const ZOOM_MAX = 1.85;

/**
 * Avatar réaliste : le vrai modèle scanné (≈42 000 triangles).
 * - Il se balance doucement de face ; glisser le fait tourner librement, il revient de face 2,5 s après.
 * - Toucher le torse, les bras ou les jambes les sélectionne (zones tirées des os du squelette d'origine).
 */
export function ModeleAthleteRealiste({ palette, accent, selectedPart = 'heart', onPartSelect, largeur = 174, hauteur = 284, maillot = false }: Props) {
  const selectedPartRef = useRef<ZoneAvatar>(selectedPart);
  const onPartSelectRef = useRef(onPartSelect);
  const layoutRef = useRef({ width: 174, height: 284 });
  const groupeRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cibleRef = useRef<CibleModele | null>(null);
  const nettoyerRef = useRef<(() => void) | null>(null);
  const rotationDepartRef = useRef(0);
  const rotationLibreRef = useRef(false);
  const zoomRef = useRef(1);
  const zoomDepartRef = useRef(1);
  const derniereMainRef = useRef(0);
  const [etat, setEtat] = useState<'chargement' | 'pret' | 'erreur'>('chargement');
  const [messageErreur, setMessageErreur] = useState('');
  // Taille réelle de la vue : le GLView n'est créé qu'une fois connue (sinon surface 0×0 au 1er affichage = écran vide).
  const [taille, setTaille] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => { selectedPartRef.current = selectedPart; }, [selectedPart]);
  useEffect(() => { onPartSelectRef.current = onPartSelect; }, [onPartSelect]);
  useEffect(() => () => { nettoyerRef.current?.(); nettoyerRef.current = null; }, []);

  const toucher = useCallback((x: number, y: number) => {
    const camera = cameraRef.current;
    const groupe = groupeRef.current;
    const cible = cibleRef.current;
    if (!camera || !groupe || !cible) return;
    const { width, height } = layoutRef.current;
    if (!(width > 0 && height > 0)) return;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1), camera);
    let part: ZoneAvatar | undefined;
    if (!part) {
      const touche = raycaster.intersectObject(cible.corps, true)[0];
      if (touche) part = zoneDepuisIntersection(touche);
    }
    if (!part) return;
    selectedPartRef.current = part;
    onPartSelectRef.current?.(part);
  }, []);

  const appliquerZoom = useCallback((valeur: number) => {
    const camera = cameraRef.current;
    const zoom = borne(valeur, ZOOM_MIN, ZOOM_MAX);
    zoomRef.current = zoom;
    if (camera) {
      camera.position.z = CAMERA.distance / zoom;
      camera.updateProjectionMatrix();
    }
  }, []);

  const pincementDepartRef = useRef<number | null>(null);
  const deplacementRef = useRef(false);
  const decalageDxRef = useRef<number | null>(null); // doigt restant après un pincement : on repart de zéro (pas de saut)

  const distanceEntreTouches = (event: GestureResponderEvent): number | null => {
    const touches = event.nativeEvent.touches;
    if (touches.length < 2) return null;
    const [premiere, deuxieme] = touches;
    return Math.hypot(deuxieme.pageX - premiere.pageX, deuxieme.pageY - premiere.pageY);
  };

  const panResponder = useMemo(
    () => PanResponder.create({
      // Le GLView natif peut intercepter le toucher : le responder est donc
      // installé sur le conteneur, comme pour l'ancien avatar qui fonctionnait.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        rotationDepartRef.current = groupeRef.current?.rotation.y ?? 0;
        zoomDepartRef.current = zoomRef.current;
        pincementDepartRef.current = null;
        decalageDxRef.current = 0;
        deplacementRef.current = false;
        rotationLibreRef.current = true;
        derniereMainRef.current = Date.now();
      },
      onPanResponderMove: (event, gesture) => {
        derniereMainRef.current = Date.now();
        const distance = distanceEntreTouches(event);
        if (distance !== null) {
          if (pincementDepartRef.current === null) pincementDepartRef.current = distance;
          if (pincementDepartRef.current > 0) appliquerZoom(zoomDepartRef.current * (distance / pincementDepartRef.current));
          deplacementRef.current = true;
          decalageDxRef.current = null;
          return;
        }
        pincementDepartRef.current = null;
        if (decalageDxRef.current === null) {
          // premier mouvement à un doigt après un pincement : nouvelle origine
          decalageDxRef.current = gesture.dx;
          rotationDepartRef.current = groupeRef.current?.rotation.y ?? 0;
        }
        if (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4) deplacementRef.current = true;
        if (groupeRef.current) groupeRef.current.rotation.y = rotationDepartRef.current + (gesture.dx - decalageDxRef.current) * 0.012;
      },
      onPanResponderRelease: (event, gesture) => {
        pincementDepartRef.current = null;
        rotationLibreRef.current = false; // après 2,5 s sans doigt, l'avatar revient de face
        derniereMainRef.current = Date.now();
        if (!deplacementRef.current && Math.abs(gesture.dx) < 8 && Math.abs(gesture.dy) < 8) {
          toucher(event.nativeEvent.locationX, event.nativeEvent.locationY);
        }
      },
      onPanResponderTerminate: () => {
        pincementDepartRef.current = null;
        rotationLibreRef.current = false;
        deplacementRef.current = true;
        derniereMainRef.current = Date.now();
      },
    }),
    [appliquerZoom, toucher],
  );

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      layoutRef.current = { width, height };
      setTaille((t) => (t && Math.abs(t.width - width) < 1 && Math.abs(t.height - height) < 1 ? t : { width, height }));
    }
  }, []);

  const onContextCreate = useCallback(async (gl: any) => {
    nettoyerRef.current?.();
    setEtat('chargement');
    setMessageErreur('');
    const largeurGL = gl.drawingBufferWidth || layoutRef.current.width;
    const hauteurGL = gl.drawingBufferHeight || layoutRef.current.height;
    const renderer = new Renderer({ gl, antialias: true, alpha: true, width: largeurGL, height: hauteurGL, pixelRatio: 1 });
    // Le GLView doit se fondre dans le décor de l'écran : seul le mannequin
    // est dessiné, sans rectangle opaque derrière lui.
    renderer.setClearColor(0x000000, 0);
    renderer.setClearAlpha(0);
    renderer.setSize(largeurGL, hauteurGL, false);

    const scene = new THREE.Scene();
    scene.background = null;
    // Caméra droite, centrée sur la mi-hauteur de l'avatar : c'est ce que suppose `data/avatar/ancrages.ts`.
    const camera = new THREE.PerspectiveCamera(CAMERA.fov, largeurGL / hauteurGL, 0.1, 50);
    camera.position.set(0, 0, CAMERA.distance / zoomRef.current);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    scene.add(new THREE.HemisphereLight(0xf4f7ff, 0x2a303a, 1.6));
    const cle = new THREE.DirectionalLight(0xffffff, 2.4);
    cle.position.set(-2, 3, 4);
    scene.add(cle);

    const groupe = new THREE.Group();
    groupe.position.y = -CAMERA.hauteurModele / 2;   // modèle posé pieds à 0 : on le centre dans le cadre
    scene.add(groupe);
    groupeRef.current = groupe;

    let vivant = true;
    let frame = 0;
    let modele: THREE.Group | null = null;
    let animations: THREE.AnimationClip[] = [];
    let mixer: THREE.AnimationMixer | null = null;
    const ressources: { dispose: () => void }[] = [];
    nettoyerRef.current = () => {
      vivant = false;
      cancelAnimationFrame(frame);
      mixer?.stopAllAction();
      if (modele) {
        modele.traverse((objet) => {
          const mesh = objet as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          const materiaux = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
          for (const materiau of materiaux) {
            const texture = materiau as THREE.MeshStandardMaterial;
            texture.map?.dispose();
            texture.normalMap?.dispose();
            materiau.dispose();
          }
        });
      }
      ressources.forEach((r) => r.dispose());
      renderer.dispose();
      modele = null;
      mixer = null;
      groupeRef.current = null; cameraRef.current = null; cibleRef.current = null;
    };

    // Chaque étape est limitée à 12 s : plus de rond qui tourne sans fin sans savoir pourquoi.
    const etape = async <T,>(nom: string, tache: () => Promise<T>): Promise<T> =>
      Promise.race([
        tache(),
        new Promise<never>((_, rejeter) => setTimeout(() => rejeter(new Error(`étape « ${nom} » trop longue (12 s)`)), 12000)),
      ]);

    let couleur: THREE.Texture;
    let normale: THREE.Texture;
    try {
      const actif = Asset.fromModule(FICHIER_MODELE);
      await etape('téléchargement du GLB', () => actif.downloadAsync());
      const tampon = await etape('lecture du GLB', () => new File(actif.localUri ?? actif.uri).arrayBuffer());
      couleur = (await etape('texture couleur', () => loadTextureAsync({ asset: maillot ? TEXTURE_COULEUR_MAILLOT : TEXTURE_COULEUR }))) as THREE.Texture;
      normale = (await etape('texture relief', () => loadTextureAsync({ asset: TEXTURE_NORMALE }))) as THREE.Texture;
      // Les UV glTF utilisent l'origine opposée à l'image native Expo : flipY doit être réglé AVANT le parse.
      couleur.flipY = false;
      normale.flipY = false;
      couleur.colorSpace = THREE.SRGBColorSpace;
      const textures = { couleur, normale };
      const gltf = await etape('parse du GLB', () => lireGlb(tampon, textures));
      if (!gltf?.scene) throw new Error('Le GLB ne contient aucune scène.');
      modele = gltf.scene as THREE.Group;
      animations = Array.isArray(gltf.animations) ? gltf.animations : [];
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : String(erreur);
      console.warn('[ModeleAthleteRealiste] chargement impossible :', message);
      if (vivant) { setMessageErreur(message); setEtat('erreur'); }
      return;
    }
    if (!vivant || !modele) return;
    couleur.needsUpdate = true;
    normale.needsUpdate = true;
    ressources.push(couleur, normale);

    const surfaces: SurfaceMaterial[] = [];
    modele.traverse((objet) => {
      const mesh = objet as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const materiaux = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const materiau of materiaux) {
        const standard = materiau as THREE.MeshStandardMaterial;
        if (!standard.isMeshStandardMaterial) continue;
        // Le GLB a déjà chargé sa couleur avec `flipY = false`. On la garde
        // pour conserver exactement les UV glTF ; la texture Expo sert de
        // secours uniquement si un viewer n'a pas chargé la map embarquée.
        standard.map = standard.map ?? couleur;
        standard.normalMap = normale;
        standard.roughness = 0.72;
        standard.metalness = 0;
        standard.needsUpdate = true;
        const part = zoneDepuisMateriau(standard.name);
        if (part) surfaces.push({ part, materiau: standard, emissive: standard.emissive.clone(), intensite: standard.emissiveIntensity });
      }
    });
    groupe.add(modele);
    mixer = animations.length ? new THREE.AnimationMixer(modele) : null;
    const idle = animations.find((animation) => animation.name === 'IdleSway') ?? animations[0];
    if (mixer && idle) mixer.clipAction(idle).play();

    cibleRef.current = { corps: modele, surfaces };
    if (vivant) setEtat('pret');

    const couleurAccent = new THREE.Color(couleurHex(accent));
    const depart = Date.now();
    let precedent = depart;
    const dessiner = () => {
      if (!vivant) return;
      try {
        const maintenant = Date.now();
        const temps = (maintenant - depart) / 1000;
        const dt = Math.min(0.1, (maintenant - precedent) / 1000);
        precedent = maintenant;
        mixer?.update(dt);

        // Sans doigt depuis 2,5 s : l'avatar revient de face et se balance doucement (± 24°).
        if (!rotationLibreRef.current && maintenant - derniereMainRef.current > 2500) {
          const a = Math.atan2(Math.sin(groupe.rotation.y), Math.cos(groupe.rotation.y));
          const cibleAngle = Math.sin(temps * 0.6) * 0.42;
          groupe.rotation.y = a + (cibleAngle - a) * Math.min(1, dt * 1.8);
        }
        groupe.scale.y = 1 + Math.sin(temps * 1.7) * 0.004;

        const choisie = selectedPartRef.current;
        for (const surface of surfaces) {
          const active = surface.part === choisie;
          surface.materiau.emissive.copy(active ? couleurAccent : surface.emissive);
          surface.materiau.emissiveIntensity = active ? 0.58 : surface.intensite;
        }

        renderer.render(scene, camera);
        gl.endFrameEXP();
      } catch (erreur) {
        console.warn('[ModeleAthleteRealiste] le rendu a échoué :', erreur instanceof Error ? erreur.message : String(erreur));
        return;
      }
      frame = requestAnimationFrame(dessiner);
    };
    dessiner();
  }, [accent, palette.fond, maillot]);

  const conteneur = [styles.conteneur, { width: largeur, height: hauteur }];
  if (!GLViewComponent) {
    return (
      <View style={[...conteneur, styles.centre]}>
        <Text style={[styles.message, { color: palette.texteMuet }]}>Aperçu 3D indisponible dans cette version de l'app.</Text>
      </View>
    );
  }
  return (
    <View collapsable={false} accessible accessibilityLabel="Avatar 3D de l'athlète. Glisse pour le faire tourner, pince pour zoomer et dézoomer." onLayout={onLayout} style={conteneur}>
      {taille ? (
        <GLViewComponent key={`${Math.round(taille.width)}x${Math.round(taille.height)}`} style={[StyleSheet.absoluteFill, styles.glTransparent]} onContextCreate={onContextCreate} />
      ) : null}
      <View {...panResponder.panHandlers} pointerEvents="box-only" collapsable={false} style={StyleSheet.absoluteFill} />
      {etat === 'chargement' ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centre]}>
          <ActivityIndicator color={accent} />
        </View>
      ) : null}
      {etat === 'erreur' ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centre]}>
          <Text style={[styles.message, { color: palette.texteMuet }]}>Le modèle 3D n'a pas pu se charger.{__DEV__ && messageErreur ? `\n${messageErreur}` : ''}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { borderRadius: rayon.carte, overflow: 'hidden', backgroundColor: 'transparent' },
  glTransparent: { backgroundColor: 'transparent' },
  centre: { alignItems: 'center', justifyContent: 'center', padding: 12 },
  message: { fontSize: 12, textAlign: 'center' },
});
