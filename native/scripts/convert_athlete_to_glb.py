"""Convert Rush's compact athlete mesh into a portable, textured GLB.

The compact RAT1 binary remains the source mesh because it is easy to version
and test. The app consumes the exported GLB; the same file can also be opened
in Blender, a browser viewer, or another engine later.

Run with:
    blender --background --python scripts/convert_athlete_to_glb.py -- \
      --input assets/avatar/athlete.bin \
      --color assets/avatar/athlete_color.jpg \
      --normal assets/avatar/athlete_normal.jpg \
      --output assets/avatar/athlete.glb
"""

from __future__ import annotations

import argparse
import struct
import sys
from pathlib import Path

import bpy


HEADER_SIZE = 36
VERTEX_SIZE = 32


def arguments() -> argparse.Namespace:
    # Blender keeps its own arguments before the `--` separator.
    raw = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--color", required=True, type=Path)
    parser.add_argument("--normal", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args(raw)


def read_rat1(path: Path) -> tuple[list[tuple[float, float, float]], list[tuple[float, float, float]], list[tuple[float, float]], list[tuple[int, int, int]], list[int]]:
    data = path.read_bytes()
    if len(data) < HEADER_SIZE or data[:4] != b"RAT1":
        raise ValueError(f"Unsupported athlete mesh: {path}")

    vertex_count, triangle_count = struct.unpack_from("<II", data, 4)
    expected = HEADER_SIZE + vertex_count * VERTEX_SIZE + triangle_count * 6 + triangle_count
    if len(data) != expected:
        raise ValueError(f"Unexpected RAT1 size: {len(data)} (expected {expected})")

    positions: list[tuple[float, float, float]] = []
    normals: list[tuple[float, float, float]] = []
    uvs: list[tuple[float, float]] = []
    offset = HEADER_SIZE
    # RAT1 stores three contiguous arrays (positions, normals, UVs), not one
    # interleaved struct per vertex. Blender is Z-up while the source mesh and
    # the app are Y-up, so convert to Blender coordinates on the way in.
    for _ in range(vertex_count):
        px, py, pz = struct.unpack_from("<3f", data, offset)
        offset += 12
        positions.append((px, -pz, py))
    for _ in range(vertex_count):
        nx, ny, nz = struct.unpack_from("<3f", data, offset)
        offset += 12
        normals.append((nx, -nz, ny))
    for _ in range(vertex_count):
        u, v = struct.unpack_from("<2f", data, offset)
        offset += 8
        uvs.append((u, v))

    faces: list[tuple[int, int, int]] = []
    for _ in range(triangle_count):
        faces.append(struct.unpack_from("<3H", data, offset))
        offset += 6
    zones = list(data[offset : offset + triangle_count])
    return positions, normals, uvs, faces, zones


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for block in list(collection):
            collection.remove(block)


def make_material(name: str, color_path: Path, normal_path: Path, tint: tuple[float, float, float, float]) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (620, 0)
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.location = (300, 0)
    shader.inputs["Roughness"].default_value = 0.72
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Base Color"].default_value = tint

    color_image = bpy.data.images.load(str(color_path), check_existing=True)
    color_image.name = "athlete_color.jpg"
    color_image.colorspace_settings.name = "sRGB"
    color_image.pack()
    color = nodes.new("ShaderNodeTexImage")
    color.location = (-420, 80)
    color.image = color_image
    color.label = "Athlete color"

    normal_image = bpy.data.images.load(str(normal_path), check_existing=True)
    normal_image.name = "athlete_normal.jpg"
    normal_image.colorspace_settings.name = "Non-Color"
    normal_image.pack()
    normal = nodes.new("ShaderNodeTexImage")
    normal.location = (-420, -170)
    normal.image = normal_image
    normal.label = "Athlete normal"
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.location = (-80, -170)
    normal_map.inputs["Strength"].default_value = 0.65

    links.new(color.outputs["Color"], shader.inputs["Base Color"])
    links.new(normal.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


def build_mesh(
    positions: list[tuple[float, float, float]],
    normals: list[tuple[float, float, float]],
    uvs: list[tuple[float, float]],
    faces: list[tuple[int, int, int]],
    zones: list[int],
    materials: list[bpy.types.Material],
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new("RushAthleteMesh")
    mesh.from_pydata(positions, [], faces)
    mesh.update()
    for material in materials:
        mesh.materials.append(material)

    uv_layer = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        polygon.use_smooth = True
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            uv_layer.data[loop_index].uv = uvs[vertex_index]

    # Preserve the source normals instead of making Blender recalculate the
    # scan's shading. Blender applies this to split loop normals on export.
    try:
        mesh.normals_split_custom_set_from_vertices(normals)
    except (AttributeError, RuntimeError):
        pass

    try:
        zone_attribute = mesh.attributes.new(name="rush_zone", type="INT", domain="FACE")
        for index, zone in enumerate(zones):
            zone_attribute.data[index].value = int(zone)
    except (AttributeError, RuntimeError):
        # The material and geometry remain valid on Blender versions that do
        # not expose generic face attributes to the Python API.
        pass
    for index, polygon in enumerate(mesh.polygons):
        # Four material slots become four glTF primitives. This gives the app
        # a stable way to identify chest, arms, and legs after GLB loading.
        polygon.material_index = min(int(zones[index]), len(materials) - 1)
    mesh["rush_zone_legend"] = "0=rest, 1=chest, 2=arms, 3=legs"
    mesh["rush_source_format"] = "RAT1"

    obj = bpy.data.objects.new("RushAthlete", mesh)
    bpy.context.collection.objects.link(obj)
    obj["rush_asset"] = "athlete"
    obj["rush_interaction"] = "Rotate the root; select chest, arms, or legs by zone."
    return obj


def add_root_animation(obj: bpy.types.Object) -> bpy.types.Object:
    root = bpy.data.objects.new("AthleteRoot", None)
    bpy.context.collection.objects.link(root)
    obj.parent = root

    root.rotation_mode = "XYZ"
    # Blender Z becomes glTF Y after the axis conversion above.
    root.rotation_euler = (0.0, 0.0, -0.07)
    root.keyframe_insert(data_path="rotation_euler", frame=1, index=2)
    root.rotation_euler = (0.0, 0.0, 0.07)
    root.keyframe_insert(data_path="rotation_euler", frame=45, index=2)
    root.rotation_euler = (0.0, 0.0, -0.07)
    root.keyframe_insert(data_path="rotation_euler", frame=90, index=2)

    action = root.animation_data.action
    if action:
        action.name = "IdleSway"
        curves = list(action.fcurves) if hasattr(action, "fcurves") else []
        # Blender 4.4+ stores curves inside layered actions.
        if not curves and hasattr(action, "layers"):
            for layer in action.layers:
                for strip in layer.strips:
                    for channelbag in strip.channelbags:
                        curves.extend(channelbag.fcurves)
        for curve in curves:
            for keyframe in curve.keyframe_points:
                keyframe.interpolation = "BEZIER"
        action.use_fake_user = True
    return root


def main() -> None:
    args = arguments()
    for path in (args.input, args.color, args.normal):
        if not path.exists():
            raise FileNotFoundError(path)
    args.output.parent.mkdir(parents=True, exist_ok=True)

    clear_scene()
    positions, normals, uvs, faces, zones = read_rat1(args.input)
    base_material = make_material("AthleteBase", args.color, args.normal, (1.0, 1.0, 1.0, 1.0))
    materials = [base_material]
    for name in ("AthleteChest", "AthleteArms", "AthleteLegs"):
        copy = base_material.copy()
        copy.name = name
        materials.append(copy)
    athlete = build_mesh(positions, normals, uvs, faces, zones, materials)
    root = add_root_animation(athlete)

    # A neutral rest pose and clean axis make the asset predictable in viewers.
    athlete.rotation_mode = "XYZ"
    root.rotation_mode = "XYZ"
    bpy.context.view_layer.objects.active = root
    root.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=str(args.output),
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_animations=True,
    )
    print(f"Wrote {args.output} ({args.output.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
