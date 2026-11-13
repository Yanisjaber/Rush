"""Ajoute un squelette à l'avatar de l'app et met les bras le long du corps (pose de repos).

Recette utilisée le 13 nov. 2026, à lancer dans Blender (onglet Scripting) sur le fichier qui contient
le scan d'origine : `AVATAR_STATIC` (corps allégé, avec les poids des os) et `GRAB3D_Armature`
(squelette de 24 os du scan, à l'échelle 0,01 et décalé de 2 m en X).

Étapes :
1. importe `assets/avatar/athlete.glb` (le corps de l'app : 4 zones de matériaux, UV, textures) dans une scène neuve ;
2. recopie sur chaque point les poids d'`AVATAR_STATIC` (mêmes positions au point près) ;
3. copie le squelette, le ramène à l'origine, applique son échelle et raccourcit les os (bouts à 8 cm) ;
4. oriente les bras : quasi verticaux, coudes légèrement fléchis vers l'avant, mains qui pendent ;
5. fige cette pose comme pose de repos, puis réexporte le GLB (avec squelette, sans animation).

Le mouvement « vivant » n'est pas dans le GLB : l'app le calcule (`src/data/avatar/pose-vivante.ts`).
"""

from pathlib import Path

import bpy
from mathutils import Matrix, Vector
from mathutils.kdtree import KDTree

GLB = Path(bpy.path.abspath("//")) / "native/assets/avatar/athlete.glb"  # à adapter si le .blend est ailleurs

# Direction de chaque os (repère Blender : X = gauche de la personne, -Y = devant, Z = haut).
BRAS = {
    "Arm": (0.17, 0.03, -1.0),
    "ForeArm": (0.07, -0.26, -1.0),
    "Hand": (0.03, -0.18, -1.0),
}


def scene_neuve() -> bpy.types.Scene:
    scene = bpy.data.scenes.get("RushRig") or bpy.data.scenes.new("RushRig")
    bpy.context.window.scene = scene
    for objet in list(scene.objects):
        bpy.data.objects.remove(objet)
    return scene


def importer_corps(scene: bpy.types.Scene) -> bpy.types.Object:
    bpy.ops.import_scene.gltf(filepath=str(GLB))
    corps = scene.objects["RushAthlete"]
    racine = corps.parent
    if racine is not None:
        # L'ancien GLB avait une racine animée (IdleSway, ± 4°) : on la retire.
        racine.animation_data_clear()
        racine.rotation_mode = "QUATERNION"
        racine.rotation_quaternion = (1, 0, 0, 0)
        bpy.context.view_layer.update()
        monde = corps.matrix_world.copy()
        corps.parent = None
        corps.matrix_world = monde
        bpy.data.objects.remove(racine)
    return corps


def copier_poids(corps: bpy.types.Object, source: bpy.types.Object) -> None:
    arbre = KDTree(len(source.data.vertices))
    for i, v in enumerate(source.data.vertices):
        arbre.insert(source.matrix_world @ v.co, i)
    arbre.balance()
    # La source a chaque groupe en double (« Hips » et « Hips.001 ») : on les additionne.
    noms = {g.index: g.name.split(".")[0] for g in source.vertex_groups}
    for groupe in list(corps.vertex_groups):
        corps.vertex_groups.remove(groupe)
    groupes = {nom: corps.vertex_groups.new(name=nom) for nom in sorted(set(noms.values()))}
    for v in corps.data.vertices:
        _, j, distance = arbre.find(corps.matrix_world @ v.co)
        assert distance < 1e-4, "le corps de l'app ne correspond plus à AVATAR_STATIC"
        poids: dict[str, float] = {}
        for g in source.data.vertices[j].groups:
            poids[noms[g.group]] = poids.get(noms[g.group], 0.0) + g.weight
        total = sum(poids.values()) or 1.0
        for nom, w in poids.items():
            if w / total > 0.001:
                groupes[nom].add([v.index], w / total, "REPLACE")


def copier_squelette(scene: bpy.types.Scene, source: bpy.types.Object) -> bpy.types.Object:
    rig = bpy.data.objects.new("RushRig", source.data.copy())
    scene.collection.objects.link(rig)
    rig.location = (0, 0, 0)  # le corps de l'app = le scan moins la position du squelette
    rig.scale = source.scale.copy()
    bpy.context.view_layer.update()
    for objet in scene.objects:
        objet.select_set(False)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    for os in rig.data.edit_bones:
        direction = os.tail - os.head
        roulis = os.roll
        if direction.length > 0:
            os.tail = os.head + direction.normalized() * 0.08
            os.roll = roulis
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.data.pose_position = "POSE"
    for os in rig.pose.bones:
        os.rotation_mode = "QUATERNION"
        os.rotation_quaternion = (1, 0, 0, 0)
        os.location = (0, 0, 0)
    return rig


def orienter(rig: bpy.types.Object, nom: str, cible: tuple[float, float, float]) -> None:
    os = rig.pose.bones[nom]
    bpy.context.view_layer.update()
    m = os.matrix.copy()
    tete = m.to_translation()
    direction = (m.to_3x3() @ Vector((0, 1, 0))).normalized()
    rotation = direction.rotation_difference(Vector(cible).normalized())
    os.matrix = Matrix.Translation(tete) @ rotation.to_matrix().to_4x4() @ Matrix.Translation(-tete) @ m
    bpy.context.view_layer.update()


def main() -> None:
    source_corps = bpy.data.objects["AVATAR_STATIC"]
    source_rig = bpy.data.objects["GRAB3D_Armature"]
    scene = scene_neuve()
    corps = importer_corps(scene)
    copier_poids(corps, source_corps)
    rig = copier_squelette(scene, source_rig)
    corps.parent = rig
    for mod in list(corps.modifiers):
        corps.modifiers.remove(mod)
    corps.modifiers.new("Squelette", "ARMATURE").object = rig

    for cote, signe in (("Left", 1), ("Right", -1)):
        for os, (x, y, z) in BRAS.items():
            orienter(rig, cote + os, (x * signe, y, z))

    # Pose actuelle -> pose de repos : on applique la déformation au corps, puis au squelette.
    for objet in scene.objects:
        objet.select_set(False)
    bpy.context.view_layer.objects.active = corps
    corps.select_set(True)
    bpy.ops.object.modifier_apply(modifier="Squelette")
    corps.select_set(False)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    corps.modifiers.new("Squelette", "ARMATURE").object = rig

    for objet in scene.objects:
        objet.select_set(objet in (rig, corps))
    bpy.ops.export_scene.gltf(
        filepath=str(GLB), export_format="GLB", use_selection=True, export_apply=False,
        export_texcoords=True, export_normals=True, export_materials="EXPORT",
        export_skins=True, export_animations=False, export_yup=True,
    )
    print(f"Écrit {GLB}")


main()
