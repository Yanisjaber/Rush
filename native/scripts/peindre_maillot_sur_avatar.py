"""Peint le dessin du maillot sur le t-shirt de l'avatar, sans changer sa forme.

Le t-shirt gris est cuit dans la texture de l'avatar (un « puzzle » d'îlots mélangés à la peau et au short).
Pour chaque pixel gris :
  1. on retrouve son point 3D sur l'avatar (rastérisation des triangles dans l'espace UV) ;
  2. on ajuste le maillot (largeur et hauteur du t-shirt) et on prend le point le plus proche sur sa surface ;
  3. on lit sa couleur dans la texture du maillot, en gardant l'ombrage des plis du t-shirt d'origine.
Le reste de la texture (peau, short, cheveux) n'est pas touché.

Se lance sans interface (ne touche pas à une scène Blender ouverte) :
  /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/peindre_maillot_sur_avatar.py -- \
      assets/avatar/athlete.glb assets/avatar/athlete_color.jpg \
      <maillot.glb> <texture_maillot.jpg> assets/avatar/athlete_color_maillot.jpg
Le maillot.glb vient de `scripts/convert_maillot_to_glb.mjs`.
"""
import sys

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree
from mathutils import Vector

arguments = sys.argv[sys.argv.index('--') + 1:]
avatar_glb, atlas_jpg, maillot_glb, maillot_jpg, sortie = arguments[:5]
taille = int(arguments[5]) if len(arguments) > 5 else None  # agrandit l'atlas (ex. 2048) pour un dessin plus net


def importer(chemin):
    avant = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=chemin)
    return [o for o in bpy.data.objects if o not in avant and o.type == 'MESH']


def lire_image(chemin, cote=None):
    img = bpy.data.images.load(chemin)
    img.colorspace_settings.name = 'Non-Color'  # valeurs brutes (déjà en sRGB) : on ne veut aucune conversion
    if cote:
        img.scale(cote, cote)
    w, h = img.size
    return img, np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)


def triangles_monde(objets):
    """Sommets (monde) + UV par triangle, pour tous les maillages donnés."""
    pts, uvs = [], []
    for o in objets:
        me = o.data
        me.calc_loop_triangles()
        uv = me.uv_layers.active.data
        m = o.matrix_world
        for t in me.loop_triangles:
            pts.append([np.array(m @ me.vertices[v].co) for v in t.vertices])
            uvs.append([np.array(uv[l].uv) for l in t.loops])
    return np.array(pts, dtype=np.float64), np.array(uvs, dtype=np.float64)


bpy.ops.wm.read_factory_settings(use_empty=True)
avatar = importer(avatar_glb)
maillot = importer(maillot_glb)
assert avatar and maillot, 'Import glTF : aucun maillage trouvé.'
pts_a, uv_a = triangles_monde(avatar)
pts_m, uv_m = triangles_monde(maillot)

img_atlas, atlas = lire_image(atlas_jpg, taille)
H, W = atlas.shape[:2]
_, tex_m = lire_image(maillot_jpg)
HM, WM = tex_m.shape[:2]

# --- 1. Où est le t-shirt dans l'atlas ? (peu saturé et clair)
rgb = atlas[:, :, :3]
lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
# Le t-shirt est un gris chaud (≈ 162, 149, 141 : saturation ≈ 0,13, rouge > bleu) ; la peau est à ≈ 0,38 de saturation,
# le short est sombre et froid (bleu > rouge). Les ombres du t-shirt restent chaudes, donc on ne se fie pas qu'à la clarté.
sat = (rgb.max(axis=2) - rgb.min(axis=2)) / np.maximum(rgb.max(axis=2), 1e-6)
chaud = rgb[:, :, 0] - rgb[:, :, 2]
base = (sat < 0.22) & (chaud > -0.008) & (lum > 0.28)  # chaud ≈ 0 : doublure grise neutre du t-shirt (ourlet, bord des manches)
# Les pixels de bord d'îlot sont des mélanges : on élargit d'un pixel vers les voisins encore grisâtres.
voisin = np.zeros_like(base)
for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
    voisin |= np.roll(base, (dy, dx), axis=(0, 1))
masque = base | (voisin & (sat < 0.30) & (chaud > -0.008) & (lum > 0.28))
print(f'Atlas {W}x{H} : {int(masque.sum())} pixels de t-shirt ({100 * masque.mean():.1f} %)')

# --- 2. Point 3D de chaque pixel de t-shirt (rastérisation des triangles de l'avatar dans l'espace UV)
pos3d = np.zeros((H, W, 3), dtype=np.float64)
rempli = np.zeros((H, W), dtype=bool)
for tri in range(len(uv_a)):
    p = uv_a[tri] * np.array([W, H])
    x0, x1 = int(max(0, np.floor(p[:, 0].min()))), int(min(W - 1, np.ceil(p[:, 0].max())))
    y0, y1 = int(max(0, np.floor(p[:, 1].min()))), int(min(H - 1, np.ceil(p[:, 1].max())))
    if x1 < x0 or y1 < y0 or not masque[y0:y1 + 1, x0:x1 + 1].any():
        continue
    gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    d = (p[1, 1] - p[2, 1]) * (p[0, 0] - p[2, 0]) + (p[2, 0] - p[1, 0]) * (p[0, 1] - p[2, 1])
    if abs(d) < 1e-12:
        continue
    l0 = ((p[1, 1] - p[2, 1]) * (gx - p[2, 0]) + (p[2, 0] - p[1, 0]) * (gy - p[2, 1])) / d
    l1 = ((p[2, 1] - p[0, 1]) * (gx - p[2, 0]) + (p[0, 0] - p[2, 0]) * (gy - p[2, 1])) / d
    l2 = 1 - l0 - l1
    dedans = (l0 >= -0.02) & (l1 >= -0.02) & (l2 >= -0.02) & masque[y0:y1 + 1, x0:x1 + 1]
    if not dedans.any():
        continue
    xyz = l0[..., None] * pts_a[tri, 0] + l1[..., None] * pts_a[tri, 1] + l2[..., None] * pts_a[tri, 2]
    sous_pos = pos3d[y0:y1 + 1, x0:x1 + 1]
    sous_rempli = rempli[y0:y1 + 1, x0:x1 + 1]
    sous_pos[dedans] = xyz[dedans]
    sous_rempli[dedans] = True
print(f'{int(rempli.sum())} pixels de t-shirt retrouvés en 3D')

# --- 3. Ajuster le maillot à la taille du t-shirt (largeur x et hauteur z en repère Blender ; profondeur = moyenne)
# Le t-shirt de CET avatar couvre environ 0,92 à 1,49 m de hauteur : plus bas c'est le short, plus haut la tête.
Z_BAS, Z_HAUT = 0.88, 1.55
pts_t = pos3d[rempli]
# Quelques pixels clairs ne sont pas du t-shirt (dents, reflets…) : on écarte les valeurs extrêmes (hors 0,5 % – 99,5 %).
pts_t = pts_t[(pts_t[:, 2] >= Z_BAS) & (pts_t[:, 2] <= Z_HAUT)]
bas, haut = np.percentile(pts_t, 0.5, axis=0), np.percentile(pts_t, 99.5, axis=0)
dehors = rempli & ((pos3d < bas - 0.005).any(axis=2) | (pos3d > haut + 0.005).any(axis=2) | (pos3d[:, :, 2] < Z_BAS) | (pos3d[:, :, 2] > Z_HAUT))
print(f'{int(dehors.sum())} pixels hors zone écartés')
rempli &= ~dehors
masque &= ~dehors
pts_t = pos3d[rempli]
a_min, a_max = pts_t.min(axis=0), pts_t.max(axis=0)
m_tous = pts_m.reshape(-1, 3)
m_min, m_max = m_tous.min(axis=0), m_tous.max(axis=0)
echelle = (a_max - a_min) / np.maximum(m_max - m_min, 1e-9)
echelle[1] = (echelle[0] + echelle[2]) / 2  # profondeur (y Blender) : ni écrasé ni gonflé
a_c, m_c = (a_min + a_max) / 2, (m_min + m_max) / 2
print('t-shirt', np.round(a_min, 3), np.round(a_max, 3), '| maillot', np.round(m_min, 3), np.round(m_max, 3), '| échelle', np.round(echelle, 3))

verts = [Vector(v) for v in pts_m.reshape(-1, 3)]
bvh = BVHTree.FromPolygons(verts, [(i * 3, i * 3 + 1, i * 3 + 2) for i in range(len(pts_m))])

# --- 4. Couleur du maillot pour chaque pixel de t-shirt
ys, xs = np.nonzero(rempli)
res = atlas.copy()
ref = float(np.median(lum[rempli]))
for y, x in zip(ys, xs):
    q = (pos3d[y, x] - a_c) / echelle + m_c  # point de l'avatar ramené dans le repère du maillot
    hit = bvh.find_nearest(Vector(q))
    if hit[0] is None:
        continue
    tri = hit[2]
    a, b, c = pts_m[tri]
    pt = np.array(hit[0])
    v0, v1, v2 = b - a, c - a, pt - a
    d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1
    den = d00 * d11 - d01 * d01
    if abs(den) < 1e-18:
        continue
    l1 = (d11 * d20 - d01 * d21) / den
    l2 = (d00 * d21 - d01 * d20) / den
    l0 = 1 - l1 - l2
    u, v = l0 * uv_m[tri, 0] + l1 * uv_m[tri, 1] + l2 * uv_m[tri, 2]
    fx, fy = (u % 1.0) * WM - 0.5, (v % 1.0) * HM - 0.5
    ix, iy = int(np.floor(fx)), int(np.floor(fy))
    tx, ty = fx - ix, fy - iy
    ix0, ix1, iy0, iy1 = ix % WM, (ix + 1) % WM, iy % HM, (iy + 1) % HM
    couleur = (tex_m[iy0, ix0, :3] * (1 - tx) * (1 - ty) + tex_m[iy0, ix1, :3] * tx * (1 - ty)
               + tex_m[iy1, ix0, :3] * (1 - tx) * ty + tex_m[iy1, ix1, :3] * tx * ty)
    ombre = min(1.12, max(0.6, lum[y, x] / ref))  # les plis du t-shirt d'origine restent visibles
    res[y, x, :3] = np.clip(couleur * ombre, 0, 1)

# --- 5. Remplir les bords des îlots (pixels de marge gris que les triangles ne couvrent pas) à partir de leurs voisins
reste = masque & ~rempli
fait = rempli.copy()
for _ in range(6):
    if not reste.any():
        break
    somme = np.zeros((H, W, 3), dtype=np.float32)
    n = np.zeros((H, W), dtype=np.float32)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        v_fait = np.roll(fait, (dy, dx), axis=(0, 1))
        somme += np.roll(res[:, :, :3], (dy, dx), axis=(0, 1)) * v_fait[..., None]
        n += v_fait
    prend = reste & (n > 0)
    res[:, :, :3][prend] = (somme / np.maximum(n, 1)[..., None])[prend]
    fait |= prend
    reste &= ~prend

# --- 6. Écriture (valeurs brutes, JPEG)
img_atlas.pixels = res.reshape(-1).tolist()
img_atlas.filepath_raw = sortie
img_atlas.file_format = 'JPEG'
bpy.context.scene.render.image_settings.quality = 92
img_atlas.save()
print('Écrit :', sortie)
