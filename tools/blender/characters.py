# DeepSwell character parts + jet ski, cosy style (I Just Wanted to Fish look), built headless in Blender.
#   blender --background --factory-startup --python tools/blender/characters.py
# Writes assets/models/characters_cosy.glb and playtest-shots/blender-characters.png.
#
# Parts fit the game's articulated surfer rig (src/surf/surfer.js). Axes in three.js terms: +y up, the chest faces +z,
# limbs hang along -y from their joint. Blender is +z up and three's +z is Blender's -y, so below: Blender (x, y, z) =
# three (x, -z, y). Every part's origin is its joint.
import bpy, bmesh, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, cosylib
importlib.reload(cosylib)
from cosylib import *
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
T = lambda x, y, z: Vector((x, -z, y))   # three.js coords -> Blender coords

SUIT, PANEL, SKIN, HAIR, SOLE = 0x1d232b, 0x19a6b6, 0xd49c72, 0x3a2414, 0x2a2f36

def skin_tube(name, pts, radii, subdiv=2):
    """Smooth organic tube through points (three coords) with per-point radii (Skin + Subsurf modifiers)."""
    bm = bmesh.new()
    vs = [bm.verts.new(T(*p)) for p in pts]
    for a, b in zip(vs, vs[1:]): bm.edges.new((a, b))
    o = mesh_from_bm(bm, name)
    o.modifiers.new('skin', 'SKIN')
    for v, r in zip(o.data.skin_vertices[0].data, radii): v.radius = (r, r)
    o.data.skin_vertices[0].data[0].use_root = True
    sub = o.modifiers.new('sub', 'SUBSURF'); sub.levels = subdiv
    apply_all(o)
    return o

def blob_part(name, elems, res=0.012, thr=0.6):
    return metaball_mesh(name, [(T(*c), r) for c, r in elems], resolution=res, threshold=thr)

def sphere(c, r, s=(1, 1, 1), seg=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=max(8, seg // 2), radius=r, location=T(*c))
    o = bpy.context.active_object; o.scale = (s[0], s[2], s[1]); bpy.ops.object.transform_apply(scale=True)
    return o

def tcol(fn):
    """Colour function in three coords."""
    return lambda co, n: fn(Vector((co.x, co.z, -co.y)), Vector((n.x, n.z, -n.y)))

def paint(o, fn):
    vcolor(o, tcol(fn))  # smooth vertex colours on dense meshes: clean edges

def solid(o, hexcol):
    vcolor(o, lambda co, n: srgb(hexcol)); return o

# ---------------------------------------------------------------- body parts
def chest():
    # Torso from the hips (y 0) to the neck (y 0.56): broad shoulders, tapered waist, chest faces +z.
    o = blob_part('char_chest', [((0, 0.05, 0), 0.15), ((0, 0.16, 0.005), 0.16), ((0, 0.28, 0.01), 0.18), ((0.1, 0.38, 0), 0.15), ((-0.1, 0.38, 0), 0.15),
                                 ((0.17, 0.46, -0.01), 0.1), ((-0.17, 0.46, -0.01), 0.1), ((0, 0.45, 0.01), 0.15), ((0, 0.54, 0), 0.07)], res=0.007)
    for v in o.data.vertices: v.co.y *= 0.82  # flatten front-to-back (Blender y = three -z)
    o.data.update(); budget(o, 9000)
    def col(p, n):
        if abs(p.x) < 0.01 and p.z < 0 and p.y > 0.15: return srgb(0x3a424c)                # back zip
        if p.y > 0.4 + 0.25 * max(0, 0.2 - abs(p.x)) and abs(p.x) > 0.06: return srgb(PANEL)  # shoulder yokes
        if p.y > 0.52: return srgb(PANEL)                                                    # collar
        return srgb(SUIT)
    paint(o, (col))
    return finish(o, 'char_chest', ao=0.5)

def hips():
    o = blob_part('char_hips', [((0.07, -0.02, 0), 0.11), ((-0.07, -0.02, 0), 0.11), ((0, 0.04, 0), 0.13)], res=0.012)
    for v in o.data.vertices: v.co.y *= 0.85
    o.data.update(); budget(o, 4000)
    vcolor(o, lambda co, n: srgb(SUIT))
    return finish(o, 'char_hips', ao=0.5)

def head():
    # Slightly big, friendly head: rounded skull, softer jaw, ears, simple eyes and brows, short tufted hair.
    parts = []
    skull = sphere((0, 0.11, 0), 0.115, (0.92, 1.05, 1.0), 32)
    for v in skull.data.vertices:
        p = Vector((v.co.x, v.co.z, -v.co.y))
        if p.y < 0.08: v.co.x *= 0.92 - (0.08 - p.y) * 1.2  # narrower jaw and chin
    parts.append(skull)
    parts.append(sphere((0, 0.1, 0.105), 0.022, (0.8, 1.0, 1.0), 12))                      # nose
    for s in (-1, 1):
        parts.append(sphere((s * 0.105, 0.105, -0.005), 0.026, (0.5, 1.0, 0.8), 12))       # ears
    # Hair: a cap with soft tufts, swept back.
    hair = blob_part('char_hair', [((0, 0.19, -0.01), 0.1), ((0, 0.17, 0.05), 0.08), ((0.06, 0.18, -0.03), 0.075), ((-0.06, 0.18, -0.03), 0.075),
                                   ((0.03, 0.2, 0.07), 0.05), ((-0.04, 0.2, 0.06), 0.05), ((0, 0.14, -0.07), 0.085), ((0.07, 0.13, -0.05), 0.06), ((-0.07, 0.13, -0.05), 0.06)], res=0.008, thr=0.62)
    parts.append(hair)
    for o in parts[:-1]: solid(o, SKIN)
    solid(hair, HAIR)
    # Eyes, highlights and brows as small real shapes (crisp, no painted edges).
    for s in (-1, 1):
        parts.append(solid(sphere((s * 0.04, 0.122, 0.1), 0.017, (0.85, 1.1, 0.5), 14), 0x1a1a22))
        parts.append(solid(sphere((s * 0.04 + 0.006, 0.128, 0.109), 0.005, (1, 1, 1), 8), 0xffffff))
        parts.append(solid(tube(T(s * 0.022, 0.152, 0.103), T(s * 0.058, 0.149, 0.097), 0.005, 0.004, 6), HAIR))
    parts.append(solid(tube(T(-0.018, 0.074, 0.106), T(0.018, 0.074, 0.106), 0.004, 0.004, 6), 0xa8604a))  # mouth
    o = join(parts, 'char_head')
    return finish(o, 'char_head', ao=0.4)

def upper_arm():
    o = skin_tube('char_upperarm', [(0, 0.04, 0), (0, -0.15, 0), (0, -0.33, 0)], [0.058, 0.05, 0.046])
    budget(o, 900)
    paint(o, (lambda p, n: srgb(PANEL) if p.y > -0.06 else srgb(SUIT)))
    return finish(o, 'char_upperarm', ao=0.3)

def forearm():
    # Wetsuit sleeve to the wrist, then a hand: palm, thumb, curled fingers (mitten-like, cosy style).
    arm = skin_tube('fa', [(0, 0.035, 0), (0, -0.14, 0), (0, -0.25, 0)], [0.046, 0.038, 0.032])
    hand = blob_part('hand', [((0, -0.3, 0), 0.042), ((0, -0.34, 0.005), 0.04), ((0.0, -0.37, 0.012), 0.032), ((0.03, -0.3, 0.02), 0.022), ((0.042, -0.325, 0.03), 0.018)], res=0.006)
    o = join([arm, hand], 'char_forearm'); budget(o, 1600)
    paint(o, (lambda p, n: srgb(SKIN) if p.y < -0.262 else srgb(SUIT)))
    return finish(o, 'char_forearm', ao=0.3)

def thigh():
    o = skin_tube('char_thigh', [(0, 0.04, 0), (0, -0.2, 0.005), (0, -0.45, 0)], [0.085, 0.072, 0.062])
    budget(o, 1000)
    paint(o, (lambda p, n: srgb(PANEL) if abs(p.x) > 0.06 and -0.3 < p.y < -0.1 else srgb(SUIT)))
    return finish(o, 'char_thigh', ao=0.3)

def shin():
    leg = skin_tube('sh', [(0, 0.03, 0), (0, -0.18, -0.01), (0, -0.4, 0)], [0.062, 0.054, 0.04])
    foot = blob_part('foot', [((0, -0.43, 0.0), 0.05), ((0, -0.445, 0.07), 0.05), ((0, -0.45, 0.13), 0.042)], res=0.008)
    for v in foot.data.vertices:
        if v.co.z < T(0, -0.465, 0).z: v.co.z = T(0, -0.465, 0).z  # flat sole
    o = join([leg, foot], 'char_shin'); budget(o, 1600)
    paint(o, (lambda p, n: (srgb(SOLE) if p.y < -0.455 else srgb(SKIN)) if p.y < -0.39 else srgb(SUIT)))
    return finish(o, 'char_shin', ao=0.3)

def vest():
    # Lifejacket (PFD) worn over the chest: orange foam panels, black straps and buckles.
    o = blob_part('char_vest', [((0, 0.16, 0), 0.19), ((0, 0.3, 0.01), 0.2), ((0.11, 0.42, 0), 0.13), ((-0.11, 0.42, 0), 0.13)], res=0.008)
    for v in o.data.vertices: v.co.y *= 0.95
    o.data.update(); budget(o, 6000)
    def col(p, n):
        if (0.18 < p.y < 0.22 or 0.29 < p.y < 0.33) and p.z > -0.05: return srgb(0x1c1c20)  # straps
        if abs(p.x) < 0.012 and p.z > 0: return srgb(0x2a2a30)                     # zip
        return srgb(0xff7a1a)
    paint(o, (col))
    return finish(o, 'char_vest', ao=0.4)

# ---------------------------------------------------------------- jet ski (nose toward three -z, waterline y ~ 0.1)
def jetski():
    L = 3.0
    rings, seg_side = 36, 7
    bm = bmesh.new()
    rows = []
    for i in range(rings + 1):
        t = i / rings                     # 0 stern .. 1 bow
        z3 = (0.5 - t) * L                # three z: stern +1.5 .. bow -1.5
        w = 0.56 * (math.sin(math.pi * min(1, 0.12 + t * 0.95)) ** 0.45) * (0.92 if t < 0.05 else 1)
        rise = 0.32 * max(0, t - 0.65) ** 2 * 8      # bow lifts
        keel = -0.12 + rise * 0.9
        deck = 0.38 + 0.12 * max(0, t - 0.55) * 2     # deck rises toward the hood
        # Cross-section, left to right: keel, chine, gunwale, deck edge, deck centre (mirrored).
        half = [(0.0, keel), (w * 0.55, keel + 0.06), (w * 0.95, 0.04 + rise * 0.5), (w, 0.2 + rise * 0.3), (w * 0.92, deck - 0.04), (w * 0.55, deck), (0.0, deck + 0.02)]
        pts = [(-x, y) for x, y in reversed(half[1:])] + half
        rows.append([bm.verts.new(T(x, y, z3)) for x, y in pts])
    n = len(rows[0])
    for i in range(rings):
        for j in range(n - 1):
            bm.faces.new((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]))
    bm.faces.new(rows[0][::-1])
    hull = mesh_from_bm(bm, 'hull')
    sub = hull.modifiers.new('sub', 'SUBSURF'); sub.levels = 3; apply_all(hull)
    def hullcol(p, n):
        if n.y > 0.6 and p.y > 0.28: return srgb(0xd8dcde)                         # non-slip deck (light grey)
        if p.y < 0.03: return srgb(0x2a3038)                                         # hull bottom
        k = (p.y - 0.11) / 0.07                                                     # side stripe, wider toward the bow
        if abs(k) < 1.0 + max(0, -p.z) * 0.3: return srgb(0x16b4c6)
        return srgb(0xf6f4ee)
    paint(hull, hullcol)
    parts = [hull]
    # Hood / cowl over the front, seat, steering column, handlebars with grips and mirrors, footwell rails, jet nozzle.
    parts.append(solid(sphere((0, 0.55, -0.75), 0.42, (1.0, 0.45, 1.3), 40), 0x16b4c6))
    bpy.ops.mesh.primitive_cube_add(size=1, location=T(0, 0.55, 0.35)); seat = bpy.context.active_object
    seat.scale = (0.3, 0.95, 0.14); bpy.ops.object.transform_apply(scale=True)
    bev = seat.modifiers.new('b', 'BEVEL'); bev.width = 0.08; bev.segments = 4; s2 = seat.modifiers.new('s', 'SUBSURF'); s2.levels = 1; apply_all(seat)
    parts.append(solid(seat, 0x262c34))
    parts.append(solid(tube(T(0, 0.6, -0.42), T(0, 0.86, -0.52), 0.06, 0.05, 12), 0x2a3038))
    parts.append(solid(tube(T(-0.36, 0.88, -0.5), T(0.36, 0.88, -0.5), 0.024, 0.024, 10), 0x3a424c))
    for s in (-1, 1):
        parts.append(solid(tube(T(s * 0.27, 0.88, -0.5), T(s * 0.4, 0.88, -0.5), 0.034, 0.034, 10), 0x16181c))   # grips
        parts.append(solid(tube(T(s * 0.33, 0.75, -0.72), T(s * 0.44, 0.92, -0.74), 0.012, 0.012, 6), 0x2a3038))  # mirror stalk
        parts.append(solid(sphere((s * 0.46, 0.95, -0.74), 0.05, (1.3, 0.8, 0.4), 12), 0x2a3038))                # mirror
        parts.append(solid(tube(T(s * 0.4, 0.32, 0.9), T(s * 0.4, 0.32, -0.1), 0.02, 0.02, 6), 0x9aa0a8))         # footwell rail
    parts.append(solid(tube(T(0, 0.02, 1.48), T(0, 0.02, 1.62), 0.09, 0.07, 14), 0x2a3038))                       # jet nozzle
    parts.append(solid(tube(T(0, 0.3, 1.5), T(0, 0.3, 1.58), 0.03, 0.03, 8), 0x9aa0a8))                           # tow eye
    o = join(parts, 'jetski'); budget(o, 22000)
    return finish(o, 'jetski', ao=0.5)

reset()
parts = [chest(), hips(), head(), upper_arm(), forearm(), thigh(), shin(), vest(), jetski()]

# Review render: assemble a standing surfer and a seated jet-ski rider from the parts (preview only).
def place(name, loc3, rot3=(0, 0, 0)):
    src = bpy.data.objects[name]
    o = src.copy(); o.data = src.data; bpy.context.scene.collection.objects.link(o)
    o.location = T(*loc3); o.rotation_euler = (rot3[0], -rot3[2], rot3[1])
    return o
preview_objs = []
def assemble(ox, oy, seated=False, vest_on=False):
    out = []
    hipY = 0.55 if seated else 0.9
    out.append(place('char_hips', (ox, oy + hipY, 0)))
    out.append(place('char_chest', (ox, oy + hipY, 0)))
    if vest_on: out.append(place('char_vest', (ox, oy + hipY, 0)))
    out.append(place('char_head', (ox, oy + hipY + 0.56, 0)))
    for s in (-1, 1):
        out.append(place('char_upperarm', (ox + s * 0.2, oy + hipY + 0.47, 0), (-1.0 if seated else 0, 0, s * 0.15)))
        out.append(place('char_forearm', (ox + s * 0.21, oy + hipY + 0.47 - (0.16 if seated else 0.3), 0.25 if seated else 0), (-1.4 if seated else -0.3, 0, 0)))
        out.append(place('char_thigh', (ox + s * 0.1, oy + hipY - 0.04, 0), (-1.5 if seated else 0, 0, 0)))
        out.append(place('char_shin', (ox + s * 0.1, oy + hipY - 0.04 + (0 if seated else -0.42), 0.42 if seated else 0), (0, 0, 0)))
    return out
for o in parts: o.location.x += 50  # keep the export originals out of the review render
preview_objs += assemble(-1.3, 0)
js = bpy.data.objects['jetski']; js.location = T(1.2, 0, 0); js.location.x = 1.2
preview_objs += assemble(1.2, 0.08, seated=True, vest_on=True)
preview([js] + preview_objs[:1], os.path.join(ROOT, 'playtest-shots', 'blender-characters.png'), cols=2, spacing=2.6) if False else None
# Custom framing: keep the assembled positions.
sc = bpy.context.scene
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, -0.01)); g = bpy.context.active_object
gm = bpy.data.materials.new('g'); gm.use_nodes = True; gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*lin(srgb(0xead7ad)), 1); g.data.materials.append(gm)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (*lin(srgb(0x9fd8e8)), 1)
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.5; sun.angle = math.radians(12); so = link(bpy.data.objects.new('sun', sun)); so.rotation_euler = (math.radians(40), math.radians(15), math.radians(30))
cam = bpy.data.cameras.new('cam'); cam.lens = 40; co = link(bpy.data.objects.new('cam', cam)); sc.camera = co
co.location = (0.3, -6.2, 2.4); co.rotation_euler = (math.radians(74), 0, 0)
for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
    try: sc.render.engine = eng; break
    except TypeError: pass
sc.render.resolution_x, sc.render.resolution_y = 1400, 800
sc.render.filepath = os.path.join(ROOT, 'playtest-shots', 'blender-characters.png')
bpy.ops.render.render(write_still=True)
for o in preview_objs: bpy.data.objects.remove(o)
for o in (g, so, co): bpy.data.objects.remove(o)
for o in parts: o.location = (0, 0, 0)
export(parts, os.path.join(ROOT, 'assets', 'models', 'characters_cosy.glb'))
