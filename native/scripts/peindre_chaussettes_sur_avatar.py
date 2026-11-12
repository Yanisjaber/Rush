"""Peint des chaussettes sur les jambes de l'avatar (les pieds sont nus dans la texture d'origine).

Même principe que `peindre_maillot_sur_avatar.py` : on retrouve le point 3D de chaque pixel de la texture
(rastérisation des triangles dans l'espace UV), et tout ce qui est sous la hauteur de la chaussette est repeint.
La forme de l'avatar ne change pas ; on garde l'ombrage d'origine pour que les volumes restent lisibles.

  /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/peindre_chaussettes_sur_avatar.py -- \
      assets/avatar/athlete.glb <texture_entree.jpg> <texture_sortie.jpg>
Repère Blender : z vers le haut, sol à z = 0, pointe du pied vers -y.
"""
import sys

import bpy
import numpy as np

arguments = sys.argv[sys.argv.index('--') + 1:]
avatar_glb, entree, sortie = arguments[:3]

# Hauteurs en mètres (cet avatar mesure 1,80 m ; le genou est vers 0,5 m, le short commence vers 0,6 m).
Z_HAUT = 0.33          # haut de la chaussette (mi-mollet)
Z_REVERS = 0.295       # début du revers coloré
BLANC = np.array([0.93, 0.93, 0.92], dtype=np.float32)
REVERS = np.array([0.78, 0.07, 0.08], dtype=np.float32)   # rouge du maillot
FLOU = 0.006           # transition douce (m) entre les zones


def lire_image(chemin):
    img = bpy.data.images.load(chemin)
    img.colorspace_settings.name = 'Non-Color'  # valeurs brutes déjà en sRGB : aucune conversion
    w, h = img.size
    return img, np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=avatar_glb)
objet = [o for o in bpy.data.objects if o.type == 'MESH'][0]
me = objet.data
me.calc_loop_triangles()
uv_couche = me.uv_layers.active.data
m = objet.matrix_world
pts, uvs = [], []
for t in me.loop_triangles:
    pts.append([np.array(m @ me.vertices[v].co) for v in t.vertices])
    uvs.append([np.array(uv_couche[l].uv) for l in t.loops])
pts, uvs = np.array(pts), np.array(uvs)

img, atlas = lire_image(entree)
H, W = atlas.shape[:2]

# Point 3D de chaque pixel : on ne rastérise que les triangles dont un sommet est assez bas.
pos = np.zeros((H, W, 3), dtype=np.float64)
rempli = np.zeros((H, W), dtype=bool)
for tri in range(len(uvs)):
    if pts[tri][:, 2].min() > Z_HAUT + 0.05:
        continue
    p = uvs[tri] * np.array([W, H])
    x0, x1 = int(max(0, np.floor(p[:, 0].min()))), int(min(W - 1, np.ceil(p[:, 0].max())))
    y0, y1 = int(max(0, np.floor(p[:, 1].min()))), int(min(H - 1, np.ceil(p[:, 1].max())))
    if x1 < x0 or y1 < y0:
        continue
    gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    d = (p[1, 1] - p[2, 1]) * (p[0, 0] - p[2, 0]) + (p[2, 0] - p[1, 0]) * (p[0, 1] - p[2, 1])
    if abs(d) < 1e-12:
        continue
    l0 = ((p[1, 1] - p[2, 1]) * (gx - p[2, 0]) + (p[2, 0] - p[1, 0]) * (gy - p[2, 1])) / d
    l1 = ((p[2, 1] - p[0, 1]) * (gx - p[2, 0]) + (p[0, 0] - p[2, 0]) * (gy - p[2, 1])) / d
    l2 = 1 - l0 - l1
    dedans = (l0 >= -0.02) & (l1 >= -0.02) & (l2 >= -0.02)
    if not dedans.any():
        continue
    xyz = l0[..., None] * pts[tri, 0] + l1[..., None] * pts[tri, 1] + l2[..., None] * pts[tri, 2]
    pos[y0:y1 + 1, x0:x1 + 1][dedans] = xyz[dedans]
    rempli[y0:y1 + 1, x0:x1 + 1][dedans] = True

z = pos[:, :, 2]
# Poids de chaque zone, avec une transition douce.
def rampe(valeur, seuil, flou):
    return np.clip((seuil - valeur) / flou + 0.5, 0, 1)

dans_chaussette = rempli & (z < Z_HAUT + FLOU)
poids_chaussette = rampe(z, Z_HAUT, FLOU) * dans_chaussette
poids_revers = rampe(-z, -Z_REVERS, FLOU) * dans_chaussette  # 1 au-dessus de Z_REVERS

rgb = atlas[:, :, :3]
lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
ref = float(np.median(lum[dans_chaussette & (z < Z_REVERS)]))
ombre = np.clip(lum / max(ref, 1e-3), 0.55, 1.1)[..., None]  # plis et volumes d'origine
chaussette = np.where((poids_revers > 0.5)[..., None], REVERS, BLANC) * ombre
res = atlas.copy()
poids = poids_chaussette[..., None]
res[:, :, :3] = np.clip(rgb * (1 - poids) + chaussette * poids, 0, 1)

# Les pixels de marge (entre îlots, hors de tout triangle) restent de la peau : on les peint comme leurs voisins.
fait = dans_chaussette & (poids_chaussette > 0.99)
for _ in range(3):
    somme = np.zeros((H, W, 3), dtype=np.float32)
    n = np.zeros((H, W), dtype=np.float32)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        v = np.roll(fait, (dy, dx), axis=(0, 1))
        somme += np.roll(res[:, :, :3], (dy, dx), axis=(0, 1)) * v[..., None]
        n += v
    prend = ~rempli & ~fait & (n > 0)
    res[:, :, :3][prend] = (somme / np.maximum(n, 1)[..., None])[prend]
    fait |= prend
print(f'{int(dans_chaussette.sum())} pixels de chaussette sur {W}x{H}')

img.pixels = res.reshape(-1).tolist()
img.filepath_raw = sortie
img.file_format = 'JPEG'
bpy.context.scene.render.image_settings.quality = 92
img.save()
print('Écrit :', sortie)
