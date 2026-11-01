# TideLine cosy diorama set: chunky angler (separate colour-slot parts, origin = joint pivot) + Australian coastal props.
#   /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/blender/tideline.py [-- --no-preview --only angler|props|trees]
# Writes assets/models/tideline_cosy.glb and playtest-shots/blender/{angler,angler_pose,props,jetty}.png
# Everything is modelled in THREE.JS coordinates (+Y up, +Z front); mesh data lives in Blender space via CB: (x,y,z) -> (x,-z,y).
import bpy, bmesh, sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, cosylib
importlib.reload(cosylib)
from cosylib import srgb, lin, mix, smoothstep, tris, decimate, link, vc_material
from mathutils import Vector, Matrix, Euler, Quaternion

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'models', 'tideline_cosy.glb')
SHOTS = os.path.join(ROOT, 'playtest-shots', 'blender')
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = '--no-preview' not in argv
ONLY = argv[argv.index('--only') + 1] if '--only' in argv else 'all'
TAU = math.tau

CB = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))   # three -> blender
CBI = CB.inverted()

def V(*a): return Vector(a)
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def T(p): return CB @ Vector(p)

def M3(c=(0, 0, 0), rot=None, s=(1, 1, 1)):
    """Placement matrix for a primitive built in the native frame (local axes = three axes via CB). c/rot/s are in three space."""
    m = Matrix.Translation(Vector(c))
    if rot is not None:
        if isinstance(rot, Quaternion): rot = rot.to_matrix()
        elif not isinstance(rot, Matrix): rot = Euler(rot, 'XYZ').to_matrix()
        m = m @ rot.to_4x4()
    m = m @ Matrix.Diagonal((s[0], s[1], s[2], 1))
    return CB @ m @ CBI

# ---------------------------------------------------------------- scratch primitives (return bmesh in the native frame)
def p_sphere(seg=16, rings=10):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0); return bm

def p_cyl(r0, r1, seg=12, caps=True):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=seg, radius1=r0, radius2=r1, depth=1.0); return bm

def p_rbox(size, bevel, seg=2):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=M3(s=size), verts=bm.verts)
    bevel = min(bevel, min(size) * 0.48)
    if bevel > 1e-4:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, offset_type='OFFSET', segments=seg, profile=0.5, affect='EDGES')
    return bm

def p_lathe(profile, seg=20, cols=None, scale=(1, 1), closed=False):
    """Solid of revolution about three +Y. profile = [(r, y), ...]; an open profile should start and end on the axis (r = 0)."""
    bm = bmesh.new(); lc = bm.verts.layers.float_color.new('Col')
    rows = []
    for i, (r, y) in enumerate(profile):
        if r < 1e-6:
            v = bm.verts.new(CB @ Vector((0, y, 0)))
            if cols: v[lc] = (*lin(srgb(cols[i])), 1.0)
            rows.append([v] * seg); continue
        ring = []
        for k in range(seg):
            a = k / seg * TAU
            v = bm.verts.new(CB @ Vector((math.cos(a) * r * scale[0], y, math.sin(a) * r * scale[1])))
            if cols: v[lc] = (*lin(srgb(cols[i])), 1.0)
            ring.append(v)
        rows.append(ring)
    n = len(profile)
    for i in (range(n) if closed else range(n - 1)):
        a, b = rows[i], rows[(i + 1) % n]
        for k in range(seg):
            q = []
            for v in (a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]):
                if v not in q: q.append(v)
            if len(q) >= 3:
                try: bm.faces.new(q)
                except ValueError: pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def p_prism(poly, length, axis_cols=None):
    """Extrude a closed 2D polygon [(u, v)] (three-space: u = x, v = y at z = 0) along three +Z by `length` (z from 0 to length)."""
    bm = bmesh.new()
    a = [bm.verts.new(CB @ Vector((u, v, 0))) for u, v in poly]
    b = [bm.verts.new(CB @ Vector((u, v, length))) for u, v in poly]
    n = len(poly)
    for i in range(n):
        try: bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
        except ValueError: pass
    try: bm.faces.new(a)
    except ValueError: pass
    try: bm.faces.new(list(reversed(b)))
    except ValueError: pass
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def p_sweep(path, radii, seg=8):
    """Smooth tube along a polyline lying in the YZ plane (three coords), with per-point radii."""
    bm = bmesh.new(); rings = []; ref = Vector((1, 0, 0))
    for i, (p, r) in enumerate(zip(path, radii)):
        p = Vector(p); t = (Vector(path[min(i + 1, len(path) - 1)]) - Vector(path[max(i - 1, 0)])).normalized(); b = t.cross(ref).normalized()
        rings.append([bm.verts.new(CB @ (p + (ref * math.cos(k / seg * TAU) + b * math.sin(k / seg * TAU)) * r)) for k in range(seg)])
    for i in range(len(rings) - 1):
        for k in range(seg): bm.faces.new((rings[i][k], rings[i][(k + 1) % seg], rings[i + 1][(k + 1) % seg], rings[i + 1][k]))
    bm.faces.new(rings[0]); bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def p_torus(R, r, seg=16, tseg=8):
    """Torus about three +Y axis."""
    bm = bmesh.new(); rows = []
    for i in range(seg):
        a = i / seg * TAU; ring = []
        for j in range(tseg):
            b = j / tseg * TAU; rr = R + r * math.cos(b)
            ring.append(bm.verts.new(CB @ Vector((math.cos(a) * rr, r * math.sin(b), math.sin(a) * rr))))
        rows.append(ring)
    for i in range(seg):
        for j in range(tseg):
            bm.faces.new((rows[i][j], rows[(i + 1) % seg][j], rows[(i + 1) % seg][(j + 1) % tseg], rows[i][(j + 1) % tseg]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

# ---------------------------------------------------------------- Mesh builder: merges coloured parts into one bmesh with a 'Col' layer
class Mesh:
    def __init__(self):
        self.bm = bmesh.new(); self.lc = self.bm.verts.layers.float_color.new('Col')

    def add(self, part, M=None, color=0xffffff):
        M = M if M is not None else Matrix.Identity(4)
        part.normal_update()
        src = part.verts.layers.float_color.get('Col')
        nm = M.to_3x3().inverted_safe().transposed()
        flip = M.determinant() < 0
        mp = {}
        for v in part.verts:
            p = M @ v.co
            n = nm @ v.normal
            if n.length > 0: n.normalize()
            nv = self.bm.verts.new(p)
            if src is not None and color is None: c = tuple(v[src])
            else:
                p3, n3 = Vector((p.x, p.z, -p.y)), Vector((n.x, n.z, -n.y))
                s = color(p3, n3) if callable(color) else (srgb(color) if isinstance(color, int) else color)
                c = (*lin(s), 1.0)
            nv[self.lc] = c; mp[v] = nv
        for f in part.faces:
            vs = [mp[v] for v in f.verts]
            if flip: vs.reverse()
            try: self.bm.faces.new(vs)
            except ValueError: pass
        part.free()

    def tint(self, fn):
        """Multiply the stored colours by fn(p3, n3) -> scalar or rgb."""
        self.bm.normal_update()
        for v in self.bm.verts:
            p, n = v.co, v.normal
            k = fn(Vector((p.x, p.z, -p.y)), Vector((n.x, n.z, -n.y)))
            if not isinstance(k, (tuple, list)): k = (k, k, k)
            c = v[self.lc]; v[self.lc] = (c[0] * k[0], c[1] * k[1], c[2] * k[2], 1.0)

    def rotate(self, c3, rot):
        """Rotate everything about three-space point c3 by quaternion/euler rot."""
        R = rot.to_matrix() if isinstance(rot, Quaternion) else Euler(rot, 'XYZ').to_matrix()
        c3 = Vector(c3)
        for v in self.bm.verts:
            p3 = Vector((v.co.x, v.co.z, -v.co.y)); q = c3 + R @ (p3 - c3); v.co = Vector((q.x, -q.z, q.y))

    def obj(self, name):
        me = bpy.data.meshes.new(name); self.bm.to_mesh(me); self.bm.free()
        o = bpy.data.objects.new(name, me); link(o); return o

# shape shortcuts (three space)
def ell(m, c, r, color, seg=16, rings=10, rot=None): m.add(p_sphere(seg, rings), M3(c, rot, r), color)
def rbox(m, c, size, color, bevel=0.02, seg=2, rot=None): m.add(p_rbox(size, bevel, seg), M3(c, rot), color)
def cyl(m, c, r, h, color, seg=12, r1=None, rot=None, caps=True): m.add(p_cyl(r, r if r1 is None else r1, seg, caps), M3(c, rot, (1, h, 1)), color)
def tube3(m, a, b, r0, r1, color, seg=8, caps=True):
    a, b = Vector(a), Vector(b); d = b - a
    if d.length < 1e-6: return
    q = Vector((0, 1, 0)).rotation_difference(d.normalized())
    m.add(p_cyl(r0, r1, seg, caps), M3((a + b) / 2, q, (1, d.length, 1)), color)
def lathe(m, profile, color=None, cols=None, seg=20, scale=(1, 1), c=(0, 0, 0), closed=False, rot=None):
    m.add(p_lathe(profile, seg, cols, scale, closed), M3(c, rot), None if cols else color)
def aim(n):  # rotation taking three +Z onto direction n
    return Vector((0, 0, 1)).rotation_difference(Vector(n).normalized())

def neutral(y0, y1, lo=0.86, hi=1.0):
    """Greyscale parameterised-slot shading: lighter toward the top of the part and on up-facing surfaces."""
    def f(p, n):
        t = clamp((p.y - y0) / (y1 - y0)); v = lo + (hi - lo) * (0.6 * t + 0.4 * clamp(n.y * 0.5 + 0.5))
        return (v, v, v)
    return f

# ---------------------------------------------------------------- AO bake variants + finishing
def bake(obj, strength, ground=True, occ=False, dist=None, samples=24):
    if strength <= 0: return
    sc = bpy.context.scene
    others = [o for o in sc.objects if o is not obj and o.type == 'MESH']
    hidden = []
    if not occ:
        for o in others: hidden.append((o, o.hide_render)); o.hide_render = True
    g = None
    if ground:
        zmin = min(v.co.z for v in obj.data.vertices)
        bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, zmin - 0.002)); g = bpy.context.active_object
        if occ: g.hide_render = False
    if sc.world is None: sc.world = bpy.data.worlds.new('bakeworld')
    sc.world.light_settings.distance = dist or max(0.05, max(obj.dimensions) * 0.35)
    sc.render.engine = 'CYCLES'; sc.cycles.samples = samples; sc.cycles.device = 'CPU'
    me = obj.data
    ao = me.color_attributes.new('AO', 'FLOAT_COLOR', 'POINT'); me.color_attributes.active_color = ao
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
    col = me.color_attributes['Col']
    for i in range(len(col.data)):
        k = 1 - strength * (1 - ao.data[i].color[0]); c = col.data[i].color
        col.data[i].color = (c[0] * k, c[1] * k, c[2] * k, 1.0)
    me.color_attributes.remove(me.color_attributes['AO'])
    me.color_attributes.active_color = me.color_attributes['Col']
    if g: bpy.data.objects.remove(g)
    for o, h in hidden: o.hide_render = h

def smooth(obj, deg=50):
    for p in obj.data.polygons: p.use_smooth = True
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active = obj
    try: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(deg))
    except Exception as e: print('smooth_by_angle failed', e)

def prep(obj, name):
    obj.name = name; obj.data.name = name
    obj.data.materials.clear(); obj.data.materials.append(vc_material())
    return obj

def done(m, name, ao=0.8, deg=50, ground=True, occ=False, dist=None, bake_now=True):
    o = prep(m.obj(name), name)
    if bake_now: bake(o, ao, ground, occ, dist)
    smooth(o, deg)
    return o

def lo_copy(o, ratio=0.35):
    c = o.copy(); c.data = o.data.copy(); link(c); c.name = o.name + '_lo'; c.data.name = c.name
    decimate(c, ratio); c.data.validate(verbose=False); c.data.update(); return c

# ================================================================= A) ANGLER
PIV = {'hips': (0, .52, 0), 'torso': (0, .52, 0), 'head': (0, .98, 0),
       'armL': (.27, .90, 0), 'armR': (-.27, .90, 0), 'elbowL': (.27, .62, 0), 'elbowR': (-.27, .62, 0),
       'thighL': (.12, .50, 0), 'thighR': (-.12, .50, 0), 'kneeL': (.12, .26, 0), 'kneeR': (-.12, .26, 0),
       'ankleL': (.12, .07, 0), 'ankleR': (-.12, .07, 0)}
PARTS = {  # object name -> pivot key
    'ang_hips_shorts': 'hips', 'ang_torso_shirt': 'torso', 'ang_torso_skin': 'torso',
    'ang_head_skin': 'head', 'ang_head_hair': 'head', 'ang_head_face': 'head', 'ang_hat': 'head', 'ang_hat_band': 'head',
    'ang_armL_shirt': 'armL', 'ang_armL_skin': 'armL', 'ang_armR_shirt': 'armR', 'ang_armR_skin': 'armR',
    'ang_foreL_skin': 'elbowL', 'ang_foreR_skin': 'elbowR',
    'ang_thighL_shorts': 'thighL', 'ang_thighL_skin': 'thighL', 'ang_thighR_shorts': 'thighR', 'ang_thighR_skin': 'thighR',
    'ang_shinL_skin': 'kneeL', 'ang_shinR_skin': 'kneeR', 'ang_footL_shoe': 'ankleL', 'ang_footR_shoe': 'ankleR'}
HC, HR = (0, 1.17, 0), (0.235, 0.215, 0.225)      # head ellipsoid centre / radii

def head_sf(x, y):
    return HR[2] * math.sqrt(max(0.0, 1 - (x / HR[0]) ** 2 - ((y - HC[1]) / HR[1]) ** 2))
def head_normal(x, y):
    z = head_sf(x, y)
    return Vector((x / HR[0] ** 2, (y - HC[1]) / HR[1] ** 2, z / HR[2] ** 2)).normalized()

def a_head_skin():
    m = Mesh(); N = neutral(.95, 1.39)
    ell(m, HC, HR, N, 24, 14)
    for s in (-1, 1): ell(m, (s * .232, 1.165, -.005), (.03, .05, .04), N, 8, 5)
    ell(m, (0, 1.122, .212), (.036, .03, .032), N, 10, 6)
    return m

def a_head_face():
    m = Mesh()
    for s in (-1, 1):
        x, y = s * .088, 1.172; n = head_normal(x, y); z = head_sf(x, y)
        q = aim(n); c = Vector((x, y, z)) - n * .006
        ell(m, c, (.034, .045, .015), 0x2a2030, 10, 6, q)
        ell(m, c + Vector((s * .01, .017, .0)) + n * .0105, (.0125, .0135, .006), 0xffffff, 6, 4, q)
        ell(m, c + Vector((-s * .011, -.017, 0)) + n * .0095, (.0065, .0065, .004), 0xf4eef6, 5, 3, q)
        # brow: slightly arched, tilted up toward the outside
        bx, by = s * .088, 1.235; n2 = head_normal(bx, by); q2 = aim(n2)
        rz = Quaternion(n2, -s * .18).to_matrix()
        ell(m, Vector((bx, by, head_sf(bx, by))) - n2 * .004, (.036, .008, .01), 0x7a4e3a, 8, 5, (rz @ q2.to_matrix()))
    # small friendly smile
    pts = []
    for k in range(7):
        x = -.052 + k * .0173; y = 1.077 + .02 * (x / .052) ** 2 - 0.0
        pts.append(Vector((x, y, head_sf(x, y) - .002)))
    for a, b in zip(pts, pts[1:]): tube3(m, a, b, .0062, .0062, 0x8a4a46, 4)
    for p in (pts[0], pts[-1]): ell(m, p, (.0075, .0075, .0075), 0x8a4a46, 6, 4)
    return m

def a_head_hair():
    m = Mesh(); N = neutral(1.0, 1.4, .84, 1.0)
    part = p_sphere(28, 16)
    c0, r0 = Vector((0, 1.185, -.012)), Vector((.247, .232, .241))
    bmesh.ops.transform(part, matrix=M3(c0, None, r0), verts=part.verts)
    dele = []
    for v in part.verts:
        p = CBI @ v.co  # three coords (CBI = inverse of three->blender)
        p = Vector((v.co.x, v.co.z, -v.co.y))
        face = p.z > .035 and p.y < 1.272 + .014 * math.sin(p.x * 52)
        ear = abs(p.x) > .12 and -.07 < p.z < .075 and p.y < 1.255
        nape = p.y < 1.035 + .03 * math.sin(p.x * 35 + 1.0)
        if face or ear or nape: dele.append(v)
    bmesh.ops.delete(part, geom=dele, context='VERTS')
    m.add(part, None, N)
    # tousled fringe tufts peeking under the hat
    for i, x in enumerate((-.13, -.065, 0, .065, .13)):
        ell(m, (x, 1.268 - .008 * (i % 2), .198 - abs(x) * .45), (.052, .03, .04), N, 8, 5, (0.5, 0, 0))
    ell(m, (0, 1.06, -.19), (.13, .07, .06), N, 10, 6)   # back-of-neck tuft
    return m

def a_hat():
    m = Mesh(); N = neutral(1.15, 1.49, .84, 1.0)
    prof = [(0.0, 1.478), (.09, 1.472), (.165, 1.455), (.205, 1.425), (.226, 1.355), (.236, 1.285), (.262, 1.268), (.322, 1.248),
            (.372, 1.226), (.39, 1.21), (.383, 1.196), (.326, 1.21), (.262, 1.236), (.222, 1.262), (.2, 1.32), (.184, 1.405), (.09, 1.45), (0.0, 1.452)]
    lathe(m, prof, N, seg=26)
    m.rotate((0, 1.25, -.05), (-.2, 0, 0))
    return m

def a_hat_band():
    m = Mesh()
    prof = [(.224, 1.282), (.2395, 1.282), (.2425, 1.296), (.2395, 1.332), (.2325, 1.338), (.222, 1.336), (.221, 1.31)]
    lathe(m, prof, lambda p, n: (0.98, 0.95, 0.88) if n.y > -.4 else (0.9, 0.86, 0.78), seg=24, closed=True)
    m.rotate((0, 1.25, -.05), (-.2, 0, 0))
    return m

def a_torso_shirt():
    m = Mesh(); N = neutral(.46, .95, .84, 1.0)
    outer = [(.186, .462), (.196, .54), (.198, .62), (.19, .72), (.178, .81), (.15, .88), (.115, .918), (.092, .934)]
    inner = [(.07, .93), (.092, .912), (.13, .875), (.158, .81), (.17, .72), (.178, .62), (.176, .54), (.166, .462)]
    lathe(m, outer + inner, N, seg=28, scale=(1.26, .95), closed=True)
    return m

def a_torso_skin():
    m = Mesh(); N = neutral(.85, 1.0, .88, 1.0)
    cyl(m, (0, .93, 0), .062, .16, N, 14, .058)
    ell(m, (0, .905, .004), (.092, .028, .07), N, 14, 6)
    return m

def a_hips():
    m = Mesh(); N = neutral(.36, .56, .84, 1.0)
    prof = [(0, .563), (.12, .56), (.162, .548), (.172, .51), (.176, .45), (.16, .398), (.1, .366), (0, .358)]
    lathe(m, prof, N, seg=28, scale=(1.32, .94))
    return m

def a_arm_shirt(s):
    m = Mesh(); N = neutral(.7, .95, .84, 1.0); x = s * .27
    prof = [(0, .948), (.045, .943), (.075, .925), (.092, .89), (.098, .84), (.1, .78), (.106, .735), (.1, .72), (.082, .724), (.078, .76), (.074, .84), (0, .87)]
    lathe(m, prof, N, seg=18, c=(x, 0, 0), closed=True)
    return m

def a_arm_skin(s):
    m = Mesh(); N = neutral(.55, .9, .86, 1.0); x = s * .27
    tube3(m, (x, .625, 0), (x, .87, 0), .057, .064, N, 12)
    ell(m, (x, .622, 0), (.059, .06, .059), N, 12, 8)
    return m

def a_fore(s):
    m = Mesh(); N = neutral(.27, .64, .86, 1.0); x = s * .27
    tube3(m, (x, .39, 0), (x, .62, 0), .05, .058, N, 12)
    ell(m, (x, .622, 0), (.058, .058, .058), N, 12, 8)
    ell(m, (x, .338, .008), (.067, .072, .076), N, 16, 10)                 # fist
    ell(m, (x, .303, .026), (.056, .036, .056), N, 12, 8)                  # curled fingers
    ell(m, (x - s * .002, .352, .066), (.026, .032, .034), N, 10, 6, (0.35, 0, 0))  # thumb
    return m

def a_thigh_shorts(s):
    m = Mesh(); N = neutral(.3, .53, .84, 1.0); x = s * .12
    prof = [(.1, .525), (.105, .46), (.113, .385), (.118, .338), (.108, .328), (.088, .334), (.088, .40), (.09, .525)]
    lathe(m, prof, N, seg=20, c=(x, 0, 0), closed=True)
    return m

def a_thigh_skin(s):
    m = Mesh(); N = neutral(.22, .52, .86, 1.0); x = s * .12
    tube3(m, (x, .27, 0), (x, .46, 0), .068, .082, N, 14)
    ell(m, (x, .262, .004), (.069, .066, .07), N, 12, 8)
    return m

def a_shin(s):
    m = Mesh(); N = neutral(.05, .28, .86, 1.0); x = s * .12
    tube3(m, (x, .09, 0), (x, .26, 0), .047, .065, N, 14)
    ell(m, (x, .262, .004), (.064, .06, .064), N, 12, 8)
    return m

def a_shoe(s):
    m = Mesh(); x = s * .12
    CAN, CAP, SOLE, TON = 0xf6f1e6, 0xfffdf8, 0xdccfb2, 0xcfe0e6
    rbox(m, (x, .026, .066), (.14, .052, .322), SOLE, .024, 2)
    ell(m, (x, .088, .07), (.073, .068, .15), CAN, 18, 10)
    ell(m, (x, .105, -.03), (.073, .076, .082), CAN, 14, 8)
    ell(m, (x, .058, .19), (.06, .03, .05), CAP, 12, 6)
    ell(m, (x, .135, .062), (.04, .026, .056), TON, 10, 6, (-.5, 0, 0))
    m.tint(lambda p, n: 1.0 - .08 * (1 - clamp(n.y * .5 + .5)))
    return m

def build_angler():
    """Returns {name: obj} with geometry in WORLD standing pose, AO baked with the whole figure present (call recenter() afterwards)."""
    B = {'ang_head_skin': a_head_skin(), 'ang_head_face': a_head_face(), 'ang_head_hair': a_head_hair(), 'ang_hat': a_hat(), 'ang_hat_band': a_hat_band(),
         'ang_torso_shirt': a_torso_shirt(), 'ang_torso_skin': a_torso_skin(), 'ang_hips_shorts': a_hips()}
    for sd, s in (('L', 1), ('R', -1)):
        B[f'ang_arm{sd}_shirt'] = a_arm_shirt(s); B[f'ang_arm{sd}_skin'] = a_arm_skin(s); B[f'ang_fore{sd}_skin'] = a_fore(s)
        B[f'ang_thigh{sd}_shorts'] = a_thigh_shorts(s); B[f'ang_thigh{sd}_skin'] = a_thigh_skin(s)
        B[f'ang_shin{sd}_skin'] = a_shin(s); B[f'ang_foot{sd}_shoe'] = a_shoe(s)
    objs = {}
    for name, m in B.items():
        objs[name] = done(m, name, bake_now=False)
    for name, o in objs.items():
        slot = name.split('_')[-1]
        if slot == 'face': continue
        bake(o, 0.24 if slot in ('skin', 'hair', 'hat', 'shirt', 'shorts') else (0.5 if slot == 'shoe' else 0.25),
             ground=(slot == 'shoe'), occ=True, dist=0.16)
    return objs

def recenter(objs):
    """Subtract each part's pivot from its vertices so object origin = pivot = (0,0,0) in the exported file."""
    for name, o in objs.items():
        pv = T(PIV[PARTS[name]])
        for v in o.data.vertices: v.co -= pv
        o.data.update()

# ================================================================= preview scene helpers
def lin3(h): return lin(srgb(h))

def inst(obj, loc3=(0, 0, 0), rot3=None, scale=1.0, tint=None, parent=None, local=False):
    d = obj.copy(); d.data = obj.data.copy() if tint else obj.data
    link(d)
    if tint:
        t = lin3(tint) if isinstance(tint, int) else lin(tint)
        a = d.data.color_attributes['Col']
        for i in range(len(a.data)):
            c = a.data[i].color; a.data[i].color = (c[0] * t[0] * 1.0, c[1] * t[1], c[2] * t[2], 1.0)
    d.location = T(loc3) if not local else CB.to_3x3() @ Vector(loc3)
    if rot3 is not None:
        R = Euler(rot3, 'XYZ').to_matrix().to_4x4(); Rb = CB @ R @ CBI
        d.rotation_euler = Rb.to_euler()
    d.scale = (scale, scale, scale)
    if parent: d.parent = parent
    return d

def scene_clear_previews(objs, originals=()):
    for o in originals: o.hide_render = False
    for o in objs:
        try: bpy.data.objects.remove(o)
        except Exception: pass

def render(path, cam3, look3, lens=50, res=(1000, 1100), sky=0x9fd8e8, ground=0xead7ad, sun_rot=(40, 15, 35), ground_size=60, ground_y=0.0):
    sc = bpy.context.scene
    bpy.ops.mesh.primitive_plane_add(size=ground_size, location=T((0, ground_y - .003, 0))); g = bpy.context.active_object
    gm = bpy.data.materials.new('ground'); gm.use_nodes = True
    gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*lin3(ground), 1)
    gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
    g.data.materials.append(gm)
    w = bpy.data.worlds.new('pw'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (*lin3(sky), 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.95
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.2; sun.angle = math.radians(12)
    so = link(bpy.data.objects.new('sun', sun)); so.rotation_euler = tuple(math.radians(a) for a in sun_rot)
    cam = bpy.data.cameras.new('cam'); cam.lens = lens; cam.clip_end = 400
    co = link(bpy.data.objects.new('cam', cam)); sc.camera = co
    co.location = T(cam3)
    co.rotation_euler = (T(look3) - T(cam3)).to_track_quat('-Z', 'Y').to_euler()
    for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try: sc.render.engine = eng; break
        except TypeError: pass
    sc.render.resolution_x, sc.render.resolution_y = res
    vts = [i.identifier for i in sc.view_settings.bl_rna.properties['view_transform'].enum_items]
    sc.view_settings.view_transform = 'AgX' if 'AgX' in vts else 'Standard'
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for ob in (g, so, co): bpy.data.objects.remove(ob)

TEST = dict(skin=0xc98f5f, hair=0x6b4226, hat=0xe8d3a0, shirt=0xff7a5c, shorts=0x24406e)
def tint_for(name):
    slot = name.split('_')[-1]
    return TEST.get(slot)

def angler_rig(objs, x=0.0, z=0.0, yaw=0.0, pose=None, tint=True):
    """Instantiate the posed angler for previews. pose: {pivotkey: (rx,ry,rz)} rotations (three axes, radians) applied about the pivot, parented along the chain."""
    pose = pose or {}
    chain = {'head': 'torso', 'armL': 'torso', 'armR': 'torso', 'elbowL': 'armL', 'elbowR': 'armR',
             'thighL': 'hips', 'thighR': 'hips', 'kneeL': 'thighL', 'kneeR': 'thighR', 'ankleL': 'kneeL', 'ankleR': 'kneeR', 'torso': None, 'hips': None}
    root = bpy.data.objects.new('rigroot', None); link(root); root.location = T((x, 0, z)); root.rotation_euler = (0, 0, math.radians(yaw))
    pivots = {}
    for k in PIV:  # empties for each pivot
        e = bpy.data.objects.new('piv_' + k, None); link(e); pivots[k] = e
    for k, e in pivots.items():
        par = chain[k]
        e.parent = pivots[par] if par else root
        base = Vector(PIV[k]) - (Vector(PIV[par]) if par else Vector((0, 0, 0)))
        e.location = T(base)
        r = pose.get(k)
        if r:
            R = Euler(r, 'XYZ').to_matrix().to_4x4(); e.rotation_euler = (CB @ R @ CBI).to_euler()
    made = [root] + list(pivots.values())
    for o in objs.values(): o.hide_render = True
    for name, o in objs.items():
        d = o.copy(); d.data = o.data.copy() if tint else o.data; link(d)
        d.parent = pivots[PARTS[name]]; d.hide_render = False
        t = tint_for(name) if tint else None
        if t:
            tt = lin3(t); a = d.data.color_attributes['Col']
            for i in range(len(a.data)):
                c = a.data[i].color; a.data[i].color = (c[0] * tt[0], c[1] * tt[1], c[2] * tt[2], 1.0)
        made.append(d)
    return made

def preview_angler(objs):
    os.makedirs(SHOTS, exist_ok=True)
    made = angler_rig(objs)
    render(os.path.join(SHOTS, 'angler.png'), (1.55, 1.45, 3.1), (0, .72, 0), lens=55, res=(900, 1100))
    scene_clear_previews(made, objs.values())
    pose = {'armL': (math.radians(-120), 0, math.radians(-8)), 'elbowL': (math.radians(-40), 0, 0), 'armR': (math.radians(25), 0, 0), 'elbowR': (math.radians(-35), 0, 0),
            'thighL': (math.radians(-28), 0, 0), 'kneeL': (math.radians(35), 0, 0), 'thighR': (math.radians(18), 0, 0), 'head': (math.radians(8), math.radians(-18), 0),
            'torso': (math.radians(-4), math.radians(10), 0)}
    made = angler_rig(objs, yaw=0, pose=pose)
    render(os.path.join(SHOTS, 'angler_pose.png'), (1.9, 1.5, 3.0), (0, .75, 0), lens=55, res=(900, 1100))
    scene_clear_previews(made, objs.values())

# ================================================================= B) PROPS
def hex_mix(a, b, t): return mix(srgb(a), srgb(b), clamp(t))

def finish_prop(m, name, ao=0.8, deg=55, dist=None, ground=True):
    return done(m, name, ao=ao, deg=deg, ground=ground, dist=dist)

# ---- Norfolk Island pine: whorled tiers of lobed branch discs on a straight trunk
def p_star(L, lobes, thick, tip, rot, ftier):
    bm = bmesh.new(); lc = bm.verts.layers.float_color.new('Col')
    N = lobes * 4; us = (0.38, 0.74, 1.0)
    def colr(u, top):
        if top:
            base = mix(srgb(0x3c7f4e), srgb(0x58a458), ftier)
            tipc = mix(srgb(0x7cc062), srgb(0xaedd7e), ftier)
            return mix(base, tipc, smoothstep(0.15, 1.0, u) ** 1.2)
        return mix(srgb(0x2c6648), srgb(0x3f8052), smoothstep(0.0, 1.0, u))
    def vtx(x, y, z, c):
        v = bm.verts.new(CB @ Vector((x, y, z))); v[lc] = (*lin(c), 1.0); return v
    ct = vtx(0, thick, 0, colr(0, True)); cb = vtx(0, -thick * .8, 0, colr(0, False))
    top, bot = [], []
    for ui, u in enumerate(us):
        rt, rb = [], []
        for k in range(N):
            a = k / N * TAU
            r = u * L * (0.80 + 0.20 * math.cos(lobes * (a - rot)))
            r = r * (1 if ui < 2 else 1)
            yt = thick * (1 - u * u) ** 0.6 + tip * u * u + (thick * .3 if ui == 2 else 0)
            yb = -thick * .8 * (1 - u * u) ** 0.6 + tip * u * u - (thick * .3 if ui == 2 else 0)
            x, z = math.cos(a) * r, math.sin(a) * r
            rt.append(vtx(x, yt, z, colr(u, True)))
            rb.append(vtx(x, yb, z, colr(u, False)))
        top.append(rt); bot.append(rb)
    for k in range(N):
        k2 = (k + 1) % N
        bm.faces.new((ct, top[0][k2], top[0][k]))
        bm.faces.new((cb, bot[0][k], bot[0][k2]))
        for i in range(2):
            bm.faces.new((top[i][k], top[i][k2], top[i + 1][k2], top[i + 1][k]))
            bm.faces.new((bot[i][k2], bot[i][k], bot[i + 1][k], bot[i + 1][k2]))
        bm.faces.new((top[2][k], top[2][k2], bot[2][k2], bot[2][k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def norfolk_pine(name, H, tiers, base_r, seed):
    rnd = random.Random(seed); m = Mesh()
    tr = lambda p, n: hex_mix(0x6b5444, 0xa58b73, p.y / (H * .5))
    tube3(m, (0, 0, 0), (0, H * .985, 0), .30, .07, tr, 10)
    ell(m, (0, .12, 0), (.42, .3, .42), 0x735a48, 10, 6)  # root flare
    y0, y1 = H * .24, H * .93
    for i in range(tiers):
        f = i / (tiers - 1)
        y = y0 + (y1 - y0) * f ** 0.95
        L = base_r * (1 - f) ** 0.9 * (1 - .08 * f) + .45
        thick = .17 + .12 * L / base_r
        tip = L * (-.07 + .17 * f)
        lobes = 5
        rot = rnd.uniform(0, TAU)
        m.add(p_star(L, lobes, thick, tip, rot, f), M3((0, y, 0)), None)
    # spire: tidy pointed new growth
    cyl(m, (0, H * .93 + (H * .07) / 2 - .02, 0), .17, H * .075, 0xa2dc7a, 8, r1=.0)
    ell(m, (0, H * .935, 0), (.3, .22, .3), 0x8ed06c, 8, 5)
    return finish_prop(m, name, ao=.85, deg=60, dist=min(1.6, H * .12))

# ---- Casuarina (she-oak): slender leaning trunk, drooping feathery clumps
def casuarina(name, H, lean, seed):
    rnd = random.Random(seed); m = Mesh()
    def tp(t): return Vector((lean * t * t * 1.0, H * .78 * t, .22 * math.sin(t * 3.2)))
    pts = [tp(i / 9) for i in range(10)]
    for i in range(9):
        a, b = pts[i], pts[i + 1]; r0 = .20 - .10 * i / 9; r1 = .20 - .10 * (i + 1) / 9
        tube3(m, a, b, r0, r1, lambda p, n: hex_mix(0x8c5a44, 0xb98467, p.y / 6.5), 8)
        ell(m, b, (r1 * 1.02, r1 * 1.02, r1 * 1.02), 0x9a6850, 6, 4)
    ell(m, (0, .1, 0), (.3, .22, .3), 0x80533f, 8, 5)
    top = pts[-1]
    def foliage(p, n):
        k = clamp((top.y + .6 - p.y) / 4.2)
        c = mix(srgb(0x76996f), srgb(0x93b07e), clamp(n.y * .5 + .5) * .7)
        return mix(c, srgb(0xc3d79c), k ** 1.5 * .85)
    limbs = 7
    for i in range(limbs):
        a = i / limbs * TAU + rnd.uniform(-.25, .25)
        base = tp(rnd.uniform(.62, .95) if i % 2 else rnd.uniform(.5, .7))
        reach = rnd.uniform(1.3, 2.0) * (1.15 - (base.y / (H * .8)) * .4)
        end = base + Vector((math.cos(a) * reach, rnd.uniform(.5, .9), math.sin(a) * reach))
        tube3(m, base, end, .07, .045, 0x9a6a50, 6)
        ell(m, end + Vector((0, .1, 0)), (.8, .5, .8), foliage, 8, 5)            # leafy top of the clump
        for kk in range(4):                                                         # drooping feathery fingers
            ka = kk / 4 * TAU + rnd.uniform(0, 1)
            L = rnd.uniform(1.0, 1.7)
            c = end + Vector((math.cos(ka) * .36, -L * .5 + .1, math.sin(ka) * .36))
            ell(m, c, (.38, L * .5, .38), foliage, 7, 4)
    ell(m, top + Vector((0, .25, 0)), (.75, .5, .75), foliage, 8, 5)
    for kk in range(4):
        ka = kk / 4 * TAU + .4
        c = top + Vector((math.cos(ka) * .5, -.45, math.sin(ka) * .5))
        ell(m, c, (.3, .85, .3), foliage, 7, 4)
    tube3(m, top, top + Vector((.0, .5, 0)), .07, .04, 0x9a6a50, 6)
    return finish_prop(m, name, ao=.85, deg=60, dist=1.0)

# ---- Coastal banksia: gnarled short trunk, dense rounded crown, silvery undersides, cream-yellow cones
def banksia(name, seed, scale=1.0):
    rnd = random.Random(seed); m = Mesh()
    bark = lambda p, n: hex_mix(0x6f5748, 0x9a8470, p.y / 2.0)
    pts = [(0, 0, 0), (.1, .7, .05), (-.05, 1.3, 0)]
    tube3(m, pts[0], pts[1], .3, .24, bark, 9); tube3(m, pts[1], pts[2], .24, .2, bark, 9)
    ell(m, (0, .12, 0), (.42, .3, .42), 0x6a5444, 9, 5)
    for k, a in enumerate((0.4, 2.4, 4.3)):
        a += rnd.uniform(-.3, .3)
        e = Vector((math.cos(a) * .75, 2.15 + rnd.uniform(-.1, .2), math.sin(a) * .75))
        mid = Vector((pts[2][0], 1.3, pts[2][2])).lerp(e, .5) + Vector((rnd.uniform(-.1, .1), -.05, rnd.uniform(-.1, .1)))
        tube3(m, pts[2], mid, .17, .13, bark, 7); tube3(m, mid, e, .13, .09, bark, 7)
        ell(m, mid, (.15, .15, .15), 0x7a6350, 7, 4)
    def leaf(p, n):
        dark, light, silver = srgb(0x3d7352), srgb(0x6aa066), srgb(0xc9d8c2)
        # patchy light clumps (fake noise), dark top, silvery rim and underside
        w = .5 + .5 * math.sin(p.x * 3.3 + p.z * 2.1) * math.sin(p.y * 4.1 - p.x * 1.7)
        c = mix(dark, light, clamp(w * .75) * clamp(n.y * .5 + .6))
        under = smoothstep(.15, -.45, n.y)
        return mix(c, silver, clamp(under * .95 + .12 * max(0, 1 - abs(n.y) * 2.2) * w))
    blobs = [((0, 2.8, 0), (1.25, .95, 1.2)), ((.1, 3.3, -.1), (.85, .6, .85))]
    for k in range(7):
        a = k / 7 * TAU + rnd.uniform(-.2, .2); r = rnd.uniform(.95, 1.25)
        blobs.append(((math.cos(a) * r, 2.45 + rnd.uniform(0, .5), math.sin(a) * r), (rnd.uniform(.7, .95), rnd.uniform(.55, .72), rnd.uniform(.7, .95))))
    for c, r in blobs: ell(m, c, r, leaf, 14, 8)
    # cone-like flower spikes
    for k in range(5):
        a = k / 5 * TAU + rnd.uniform(-.4, .4); r = rnd.uniform(.1, .8)
        x, z = math.cos(a) * r, math.sin(a) * r
        y = 3.1 + .55 * max(0, 1 - r / 1.2) - .1
        tilt = Vector((math.cos(a) * .2, 1, math.sin(a) * .2)).normalized()
        base = Vector((x, y, z)); tipp = base + tilt * .66
        band = lambda p, n: mix(srgb(0xf4e089), srgb(0xe8b54f), .5 + .5 * math.sin(p.y * 52))
        tube3(m, base, tipp, .19, .11, band, 9)
        ell(m, tipp, (.112, .09, .112), 0xf4dd7c, 9, 5)
        ell(m, base, (.15, .05, .15), 0x5d8e55, 8, 4)
    if scale != 1: m.tint(lambda p, n: 1.0)
    return finish_prop(m, name, ao=.85, deg=60, dist=.9)

# ---- Jetty (planks run across X; sections tile along Z at 2.0 m pitch)
PLANKS = [0xcfa77a, 0xc39a6c, 0xd8b588, 0xb98e63, 0xc8a273, 0xb4977a, 0xd1ae80, 0xbf9b70]
def plank_row(m, nplank, z0, pitch, width=2.4, seed=1, thick=.075):
    rnd = random.Random(seed)
    for i in range(nplank):
        zc = z0 + pitch * (i + .5)
        base = PLANKS[rnd.randrange(len(PLANKS))]; ph = rnd.uniform(0, 6)
        col = lambda p, n, base=base, ph=ph: tuple(c * (.95 + .05 * math.sin(p.x * 2.6 + ph)) * (1.0 if n.y > .3 else .78) for c in srgb(base))
        rbox(m, (0, -thick / 2, zc), (width, thick, pitch - .026), col, .016, 2)

def jetty_deck():
    m = Mesh()
    plank_row(m, 10, -1.0, .2, seed=4)
    rbox(m, (0, -.095, 0), (2.36, .03, 2.0), 0x3a2c26, .005, 1)
    for x in (-.8, .8): rbox(m, (x, -.16, 0), (.2, .18, 2.0), lambda p, n: hex_mix(0x8c6b4e, 0x6f5440, clamp(-p.y * 4 - .3)), .02, 2)
    return finish_prop(m, 'jetty_deck', ao=.8, deg=45, dist=.25)

def jetty_end():
    m = Mesh()
    plank_row(m, 2, -.31, .2, seed=9)
    rbox(m, (0, -.095, -.1), (2.36, .03, .4), 0x3a2c26, .005, 1)
    for x in (-.8, .8): rbox(m, (x, -.16, -.1), (.2, .18, .42), 0x8c6b4e, .02, 2)
    rbox(m, (0, -.125, .2), (2.44, .25, .2), lambda p, n: tuple(c * (1.0 if n.y > .4 or n.z > .4 else .8) for c in srgb(0x9a7653)), .03, 2)
    iron = lambda p, n: hex_mix(0x41666f, 0x6f949b, smoothstep(.0, .3, p.y))
    for x in (-.85, .85):
        lathe(m, [(0, 0), (.13, 0), (.115, .04), (.085, .13), (.075, .19), (.115, .235), (.125, .285), (.095, .325), (0, .335)], iron, seg=14, c=(x, 0, -.02))
    return finish_prop(m, 'jetty_end', ao=.8, deg=45, dist=.25)

def jetty_post():
    m = Mesh()
    def col(p, n):
        t = hex_mix(0x8f7357, 0xb89c7a, smoothstep(-1.0, .75, p.y))
        wet = smoothstep(-1.6, -2.1, p.y)
        return mix(t, srgb(0x55645e), wet)
    prof = [(0, -3.4), (.17, -3.4), (.205, -3.3), (.215, -2.3), (.2, -1.0), (.19, .5), (.19, .68), (.165, .75), (.1, .79), (0, .8)]
    lathe(m, prof, col, seg=14)
    rnd = random.Random(7)
    for k in range(18):
        a = rnd.uniform(0, TAU); y = rnd.uniform(-2.85, -2.0)
        c = Vector((math.cos(a) * .205, y, math.sin(a) * .205))
        ell(m, c, (.045, .035, .045), 0xe3dcc8, 6, 4, aim(Vector((c.x, 0, c.z)) ))
    for y in (.38, .46): m.add(p_torus(.2, .026, 14, 6), M3((0, y, 0)), 0xe9dab5)
    return finish_prop(m, 'jetty_post', ao=.7, deg=55, dist=.35, ground=False)

def jetty_rope():
    m = Mesh()
    def rope(p, n):
        a = math.atan2(p.z, p.x); return mix(srgb(0xeadcb6), srgb(0xc9b48a), .5 + .5 * math.sin(a * 11 + p.y * 40))
    for i, (R, y) in enumerate(((.2, .028), (.185, .07), (.165, .108))):
        m.add(p_torus(R, .028, 18, 6), M3((0, y, 0)), rope)
    tube3(m, (.2, .03, 0), (.42, .026, .1), .024, .024, 0xdccba2, 6)
    tube3(m, (.42, .026, .1), (.58, .026, .0), .024, .024, 0xdccba2, 6)
    ell(m, (.6, .03, -.02), (.04, .03, .04), 0xcdb98e, 6, 4)
    return finish_prop(m, 'jetty_rope', ao=.7, deg=60, dist=.12)

# ---- helpers for structures
def p_prism_x(poly, x0, x1):
    """Extrude a closed polygon [(z, y)] along three X from x0 to x1 (profile in the Z/Y plane)."""
    bm = bmesh.new()
    a = [bm.verts.new(CB @ Vector((x0, y, z))) for z, y in poly]
    b = [bm.verts.new(CB @ Vector((x1, y, z))) for z, y in poly]
    n = len(poly)
    for i in range(n):
        try: bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
        except ValueError: pass
    try: bm.faces.new(a)
    except ValueError: pass
    try: bm.faces.new(list(reversed(b)))
    except ValueError: pass
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def RY(a): return Matrix.Rotation(a, 3, 'Y')
def RZ(a): return Matrix.Rotation(a, 3, 'Z')
def RX(a): return Matrix.Rotation(a, 3, 'X')

# ---- Tinnie (aluminium dinghy)
def tinnie():
    m = Mesh()
    NS = 16; L = 3.6; top = .45
    F = [0, .03, .13, .30, .50, .565, .585, .78, .80, .93, 1.0]
    G = [0, .35, .70, .86, .93, .955, .96, .985, .99, .997, 1.0]
    bm = bmesh.new(); lc = bm.verts.layers.float_color.new('Col')
    SIL, STRIPE = srgb(0xcfe3ee), srgb(0x78d1b0)
    st = []
    for i in range(NS + 1):
        t = i / NS; z = -L / 2 + L * t
        w = max(.04, .76 * (1 - max(0, (t - .36) / .64) ** 1.75))
        yb = -.25 + .30 * smoothstep(.70, 1.0, t) ** 1.4
        yt = top
        R = []
        for k, (f, g) in enumerate(zip(F, G)):
            y = yb + (yt - yb) * f; x = w * g
            c = STRIPE if f in (.585, .78) else mix(srgb(0xaec8d6), SIL, smoothstep(0, .5, f)) if f < .56 else SIL
            col = (*lin(c), 1.0)
            r = bm.verts.new(CB @ Vector((x, y, z))); r[lc] = col
            l = r if k == 0 else bm.verts.new(CB @ Vector((-x, y, z)))
            if k: l[lc] = col
            R.append((r, l))
        st.append(R)
    for i in range(NS):
        for k in range(len(F) - 1):
            for side in (0, 1):
                a, b = st[i][k][side], st[i][k + 1][side]; c, d = st[i + 1][k + 1][side], st[i + 1][k][side]
                q = []
                for v in (a, b, c, d):
                    if v not in q: q.append(v)
                if len(q) >= 3: bm.faces.new(q if side == 0 else list(reversed(q)))
    for i in (0, NS):   # transom / stem plates
        for k in range(len(F) - 1):
            q = []
            for v in (st[i][k][0], st[i][k + 1][0], st[i][k + 1][1], st[i][k][1]):
                if v not in q: q.append(v)
            if len(q) >= 3:
                try: bm.faces.new(q if i == 0 else list(reversed(q)))
                except ValueError: pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # make sure the keel faces point down
    kf = min(bm.faces, key=lambda f: f.calc_center_median().z)
    if kf.normal.z > 0: bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=-.04)
    m.add(bm, None, None)
    def halfw(z, y):
        t = (z + L / 2) / L; w = max(.04, .76 * (1 - max(0, (t - .36) / .64) ** 1.75)); f = (y + .25) / .7
        g = G[min(range(len(F)), key=lambda i: abs(F[i] - f))]; return w * g
    # gunwale rolled rim
    rim = lambda p, n: (.9, .95, .97)
    for side in (1, -1):
        for i in range(NS):
            t0, t1 = i / NS, (i + 1) / NS
            def pt(t):
                w = max(.04, .76 * (1 - max(0, (t - .36) / .64) ** 1.75)); return Vector((side * w, top, -L / 2 + L * t))
            tube3(m, pt(t0), pt(t1), .028, .028, rim, 6)
    # seats
    wood = lambda p, n: hex_mix(0xcfa270, 0xe3be88, clamp(n.y * .5 + .5))
    for z in (.45, -.65):
        w = halfw(z, .1) * 1.92
        rbox(m, (0, .12, z), (w, .05, .3), wood, .015, 2)
        for sx in (-1, 1): rbox(m, (sx * (w / 2 - .12), -.05, z), (.06, .3, .22), 0x9ab4c2, .01, 1)
    # outboard motor on the transom
    cow = 0xe9705e; dark = 0x4b5c66
    rbox(m, (0, .5, -L / 2 - .02), (.3, .12, .09), 0x8da7b5, .02, 1)
    rbox(m, (0, .72, -L / 2 - .2), (.3, .36, .36), lambda p, n: hex_mix(0xf0806c, 0xe5634f, clamp((.9 - p.y) * 2)), .08, 3)
    rbox(m, (0, .55, -L / 2 - .2), (.12, .5, .16), dark, .02, 2)
    cyl(m, (0, -.1, -L / 2 - .25), .045, .9, 0xd5e1e6, 8)
    ell(m, (0, -.52, -L / 2 - .25), (.07, .075, .17), 0xd5e1e6, 10, 6)
    rbox(m, (0, -.52, -L / 2 - .43), (.015, .17, .09), 0xd5e1e6, .004, 1)
    tube3(m, (0, .82, -L / 2 - .3), (0, .86, -L / 2 + .45), .022, .022, 0x39464f, 6)
    ell(m, (0, .86, -L / 2 + .46), (.035, .035, .035), 0x39464f, 6, 4)
    # bow eye + mooring rope draped over the stem
    m.add(p_torus(.05, .014, 10, 5), M3((0, .35, L / 2 - .06), RX(math.pi / 2)), 0x4b5c66)
    rope = 0xf0e4c6; prev = Vector((0, .35, L / 2 - .06))
    for s in range(1, 8):
        u = s / 7; p = Vector((.12 * u * math.sin(u * 3), .35 - .5 * u ** 1.4, L / 2 - .06 + .7 * u))
        tube3(m, prev, p, .02, .02, rope, 5); prev = p
    ell(m, prev, (.035, .035, .035), 0xd9c7a0, 6, 4)
    return finish_prop(m, 'tinnie', ao=.5, deg=50, dist=.5, ground=False)

# ---- Bait & tackle hut
def bait_hut():
    m = Mesh()
    W, D, WH = 4.2, 3.2, 2.6
    CREAM, TEAL, CORAL, TRIM = 0xf3e5c4, 0x62b8b4, 0xe9806e, 0xfbf4e2
    # plinth + inner core
    rbox(m, (0, .06, 0), (W + .16, .12, D + .16), 0x9a8b7a, .03, 2)
    rbox(m, (0, 1.36, 0), (W - .04, WH - .12, D - .04), CREAM, .0, 1)
    pitch, y0 = .177, .12
    n = int((WH - y0) / pitch)
    prof = [(0, y0)]
    for i in range(n):
        y = y0 + i * pitch; prof += [(.036, y), (.012, y + pitch)]
    ytop = y0 + n * pitch
    prof += [(0, ytop)]
    def boardcol(p, nn):
        fr = ((p.y - y0) / pitch) % 1.0
        base = srgb(TEAL) if p.y < 1.07 else srgb(CREAM)
        k = .93 + .09 * (1 - fr) ** 2 - .05 * fr
        return tuple(c * k for c in base)
    for (c, ry, ln) in (((0, 0, D / 2), 0, W), ((0, 0, -D / 2), math.pi, W), ((W / 2, 0, 0), math.pi / 2, D), ((-W / 2, 0, 0), -math.pi / 2, D)):
        m.add(p_prism_x(prof, -ln / 2, ln / 2), M3(c, RY(ry)), boardcol)
    for sx in (-1, 1):
        for sz in (-1, 1): rbox(m, (sx * (W / 2 + .03), 1.36, sz * (D / 2 + .03)), (.12, WH - .12, .12), TRIM, .025, 2)
    # gables
    ang = math.atan2(1.1, W / 2)
    gab = lambda p, nn: hex_mix(0xe9d9b4, 0xf7ecd0, clamp((p.y - 2.6) / 1.1))
    for (zz, ry) in ((D / 2, 0), (-D / 2, math.pi)):
        m.add(p_prism([(-W / 2 - .02, WH), (W / 2 + .02, WH), (0, WH + 1.1 + .02)], .05), M3((0, 0, zz - (.0 if ry == 0 else .05)), RY(ry) if ry else None), gab)
    # corrugated roof
    per, amp, th = .15, .028, .022
    Lr = D + .8; npr = int(Lr / per); Lr = npr * per
    zs = [-Lr / 2 + i * per / 4 for i in range(npr * 4 + 1)]
    top_ = [(z, amp * math.sin(z / per * TAU)) for z in zs]
    poly = top_ + [(z, h - th) for z, h in reversed(top_)]
    slope = math.hypot(W / 2 + .38, 1.1 + .2)
    for sg in (1, -1):
        R = RZ(-ang) if sg == 1 else RZ(ang) @ RY(math.pi)
        col = lambda p, nn: hex_mix(0x86d0b8, 0xa6e2cb, clamp(.5 + .5 * nn.y)) if True else None
        m.add(p_prism_x(poly, 0, slope), M3((0, WH + 1.1 + .03, 0), R), col)
    rbox(m, (0, WH + 1.1 + .06, 0), (.28, .09, Lr + .06), 0x5db5a0, .03, 2)
    # front: door, serving window, awning, sign
    dx = -1.3
    for i in range(5):
        rbox(m, (dx - .36 + .18 * i, 1.12, D / 2 + .06), (.172, 1.98, .045), lambda p, nn, i=i: tuple(c * (1 - .04 * (i % 2)) for c in srgb(CORAL)), .012, 2)
    for (x, y, sx, sy) in ((dx, 2.14, 1.0, .1), (dx - .5, 1.12, .1, 2.1), (dx + .5, 1.12, .1, 2.1)): rbox(m, (x, y, D / 2 + .075), (sx, sy, .05), TRIM, .015, 1)
    ell(m, (dx + .3, 1.08, D / 2 + .11), (.035, .035, .035), 0xf2d27a, 8, 5)
    rbox(m, (dx, .06, D / 2 + .26), (1.1, .12, .45), 0xb89468, .025, 2)
    wx, wy = .75, 1.6
    rbox(m, (wx, wy, D / 2 + .04), (1.7, 1.0, .03), 0x34454c, .01, 1)
    for (x, y, sx, sy) in ((wx, wy + .55, 1.9, .1), (wx, wy - .55, 1.9, .1), (wx - .9, wy, .1, 1.1), (wx + .9, wy, .1, 1.1)): rbox(m, (x, y, D / 2 + .075), (sx, sy, .05), TRIM, .015, 1)
    rbox(m, (wx, wy - .6, D / 2 + .22), (2.0, .06, .36), lambda p, nn: hex_mix(0xc79d6b, 0xe0b985, clamp(nn.y)), .02, 2)
    for k in range(7):   # striped awning slats
        x = wx - .95 + k * .3167
        col = CORAL if k % 2 == 0 else 0xfdf3e0
        rbox(m, (x, wy + .94, D / 2 + .36), (.3, .035, .8), col, .012, 1, rot=(.42, 0, 0))
        rbox(m, (x, wy + .72, D / 2 + .70), (.3, .15, .035), col, .01, 1)
    for sx in (-1, 1): tube3(m, (wx + sx * .98, wy + .75, D / 2 + .1), (wx + sx * .98, wy + .98, D / 2 + .62), .02, .02, 0x8a6a4a, 5)
    # painted sign with a fish (blank: no text)
    sy_, sz_ = 3.02, D / 2 + .075
    rbox(m, (0, sy_, sz_), (1.5, .56, .05), 0x3b979d, .03, 2)
    rbox(m, (0, sy_, sz_ + .02), (1.4, .46, .04), 0xfbf3dc, .025, 2)
    ell(m, (-.06, sy_, sz_ + .05), (.3, .13, .025), 0x3b979d, 14, 8)
    m.add(p_prism([(0, 0), (.22, .14), (.22, -.14)], .03), M3((.22, sy_, sz_ + .04)), 0x3b979d)
    ell(m, (-.2, sy_ + .03, sz_ + .068), (.025, .025, .012), 0xfbf3dc, 8, 5)
    # side details: buoys on a peg bar (+X), rod rack (-X)
    rbox(m, (W / 2 + .06, 2.28, 0), (.08, .08, 2.2), 0xa6794c, .02, 1)
    for z, cc in ((-.8, 0xe8695c), (-.1, 0xf3d57a), (.65, 0x58b9b2)):
        tube3(m, (W / 2 + .1, 2.26, z), (W / 2 + .1, 1.85, z), .013, .013, 0xdccba2, 5)
        cy = 1.67
        ell(m, (W / 2 + .1, cy, z), (.17, .2, .17), lambda p, nn, cc=cc: (.98, .97, .93) if abs(p.y - cy) < .035 else srgb(cc), 14, 9)
    rbox(m, (-W / 2 - .05, 1.6, 0), (.07, .08, 2.1), 0xa6794c, .02, 1)
    rbox(m, (-W / 2 - .05, .75, 0), (.07, .08, 2.1), 0xa6794c, .02, 1)
    for i, z in enumerate((-.8, -.28, .24, .76)):
        sh = [.0, .06, -.05, .03][i]
        tube3(m, (-W / 2 - .16, .05, z), (-W / 2 - .2, 2.4 + sh, z), .02, .01, 0x37505b, 6)
        tube3(m, (-W / 2 - .16, .05, z), (-W / 2 - .17, .62, z), .03, .03, 0xdbb27c, 7)
        ell(m, (-W / 2 - .24, 1.0, z), (.04, .035, .04), 0xf0a24e, 6, 4)
    # crates by the window
    rbox(m, (1.8, .27, D / 2 + .5), (.55, .3, .42), lambda p, nn: hex_mix(0x7fb5cf, 0xa5d0e3, clamp(nn.y)), .03, 2, rot=(0, .12, 0))
    rbox(m, (1.8, .58, D / 2 + .5), (.5, .3, .4), lambda p, nn: hex_mix(0xe6a850, 0xf5c978, clamp(nn.y)), .03, 2, rot=(0, -.1, 0))
    return finish_prop(m, 'bait_hut', ao=.8, deg=40, dist=.6)

# ---- Fish-cleaning table
def cleaning_table():
    m = Mesh()
    wood = lambda p, n: hex_mix(0x9c7650, 0xc49a68, clamp(n.y * .5 + .5) * .7 + clamp((p.y - .5) / 1.0) * .3)
    steel, steel_d = 0xd0dce2, 0x93aab6
    H = .95; T_ = .06
    # top boards with a hole for the sink (x -0.75..-0.25, z -0.25..0.25)
    rbox(m, (-.875, H - T_ / 2, 0), (.25, T_, .8), wood, .015, 2)
    rbox(m, (.375, H - T_ / 2, 0), (1.25, T_, .8), wood, .015, 2)
    rbox(m, (-.5, H - T_ / 2, .325), (.5, T_, .15), wood, .015, 2)
    rbox(m, (-.5, H - T_ / 2, -.325), (.5, T_, .15), wood, .015, 2)
    for sx in (-1, 1):
        for sz in (-1, 1): rbox(m, (sx * .9, (H - T_) / 2, sz * .32), (.1, H - T_, .1), wood, .02, 2)
    for sz in (-1, 1): rbox(m, (0, .3, sz * .32), (1.7, .07, .06), wood, .015, 1)
    rbox(m, (0, .3, 0), (.06, .07, .6), wood, .015, 1)
    rbox(m, (.4, .22, 0), (.9, .04, .62), lambda p, n: hex_mix(0x8a6a48, 0xa98457, clamp(n.y)), .01, 1)   # lower shelf
    # sink bowl
    sc = [steel, steel, steel_d, steel_d, steel_d, 0x7c93a0]
    lathe(m, [(.27, H + .02), (.255, H + .02), (.225, H - .08), (.15, H - .17), (0, H - .19), (.14, H - .2), (.24, H - .09), (.275, H)],
          cols=[0xe6eef2, 0xe6eef2, 0xa4b9c4, 0x8fa6b2, 0x7c93a0, 0x8fa6b2, 0xb8c9d1, 0xe6eef2][:0] or None,
          color=lambda p, n: hex_mix(0xe3edf1, 0x8aa2af, clamp((H + .02 - p.y) * 4)), seg=20, c=(-.5, 0, 0), closed=False)
    # tap on a pipe
    tube3(m, (-.5, H, -.3), (-.5, H + .3, -.3), .028, .028, steel, 8)
    tube3(m, (-.5, H + .3, -.3), (-.5, H + .34, -.2), .026, .026, steel, 8)
    tube3(m, (-.5, H + .34, -.2), (-.5, H + .32, -.04), .026, .026, steel, 8)
    ell(m, (-.5, H + .3, -.3), (.04, .04, .04), steel, 8, 5)
    tube3(m, (-.5, H + .3, -.04), (-.5, H + .26, -.04), .022, .022, 0x9fb4be, 8)
    tube3(m, (-.53, H + .3, -.3), (-.45, H + .3, -.3), .014, .014, 0xe8695c, 6)
    for sx in (-.545, -.455): ell(m, (sx, H + .3, -.3), (.026, .022, .026), 0xe8695c, 6, 4)
    # cutting board + a knife
    rbox(m, (.45, H + .018, .02), (.62, .036, .36), lambda p, n: hex_mix(0xe0c28c, 0xf0d9a8, clamp(n.y)), .012, 2)
    rbox(m, (.45 + .3, H + .018, .02), (.1, .036, .1), 0xe0c28c, .02, 1)
    rbox(m, (.2, H + .045, .2), (.22, .012, .035), 0xcfdde4, .004, 1)
    rbox(m, (.07, H + .05, .2), (.1, .03, .035), 0x5a4a44, .01, 1)
    # bucket beside the table
    bk = bucket_mesh(0xf2a65a, 0x8e9aa2)
    m.add(bk, M3((1.38, 0, .12)), None)
    return finish_prop(m, 'cleaning_table', ao=.8, deg=45, dist=.5)

def bucket_bm(body, handle):
    """Returns a Mesh builder result (bmesh) for a 0.3 m bucket, base at y=0."""
    b = Mesh()
    out = lambda p, n: hex_mix(body, int(body) + 0x0, 0)
    lathe(b, [(0, 0), (.115, 0), (.125, .02), (.15, .29), (.162, .3), (.165, .315), (.152, .312), (.14, .295), (.115, .045), (0, .04)],
          lambda p, n: tuple(c * (.78 if (p.y > .02 and (math.hypot(p.x, p.z) < .125 + .13 * (p.y / .3) - .02)) else 1.0) for c in srgb(body)), seg=18)
    pts = [Vector((math.cos(a) * .165, .3 + math.sin(a) * .16, 0)) for a in [math.pi * i / 8 for i in range(9)]]
    for a_, b_ in zip(pts, pts[1:]): tube3(b, a_, b_, .011, .011, handle, 5)
    return b

def bucket_mesh(body, handle):
    b = bucket_bm(body, handle); bm = b.bm; bm.verts.layers.float_color.get('Col'); return bm

def bucket():
    m = Mesh()
    m.add(bucket_mesh(0xb6dcee, 0x8e9aa2), None, None)
    return finish_prop(m, 'bucket', ao=.8, deg=50, dist=.12)

# ---- Esky (cooler box)
def esky():
    m = Mesh()
    rbox(m, (0, .14, 0), (.7, .28, .45), lambda p, n: hex_mix(0xdc4f48, 0xf0665d, clamp(p.y / .3)), .045, 3)
    rbox(m, (0, .34, 0), (.73, .13, .48), lambda p, n: hex_mix(0xf1ece0, 0xfffcf4, clamp(n.y * .5 + .5)), .05, 3)
    rbox(m, (0, .2, .232), (.2, .07, .02), 0xf6f1e6, .008, 1)
    for sx in (-1, 1): rbox(m, (sx * .37, .24, 0), (.04, .07, .22), 0x3c4b53, .015, 2)
    rbox(m, (0, .409, 0), (.5, .012, .3), 0xe6e0d2, .005, 1)
    return finish_prop(m, 'esky', ao=.8, deg=45, dist=.2)

# ---- Rod parts (fixed palette)
def rod_reel():
    m = Mesh()
    body = lambda p, n: hex_mix(0xaebcc4, 0xe3ecf0, clamp(n.y * .5 + .5))
    rbox(m, (0, 0, .006), (.034, .05, .014), 0x6a7c86, .004, 1)                        # reel foot on the seat
    tube3(m, (0, .0, .006), (0, .0, .035), .008, .008, 0x6a7c86, 6)
    ell(m, (0, -.008, .052), (.03, .036, .03), body, 12, 8)                            # housing
    cyl(m, (0, .034, .052), .036, .018, 0x35b3ad, 14, rot=None)                         # spool toward the tip
    cyl(m, (0, .046, .052), .039, .006, 0xd6e4e8, 14)
    cyl(m, (0, .015, .052), .034, .016, 0xc4d3d9, 14)                                   # rotor
    tube3(m, (.026, -.008, .052), (.082, -.008, .052), .0085, .0075, 0xaebcc4, 6)      # crank arm toward +X
    tube3(m, (.082, -.008, .052), (.082, -.008, .076), .008, .008, 0xaebcc4, 6)
    ell(m, (.082, -.008, .084), (.013, .013, .015), 0xf2a24c, 8, 6)                    # handle knob
    return finish_prop(m, 'rod_reel', ao=.3, deg=55, dist=.03, ground=False)

def rod_grip():
    m = Mesh()
    ring = lambda p, n: tuple(c * (.94 + .06 * math.sin(p.y * 210)) for c in hex_mix(0xcf9a5e, 0xe3b97b, clamp(n.x * .3 + .5)))
    lathe(m, [(0, 0), (.032, 0), (.037, .012), (.0355, .028), (.035, .27), (.034, .278), (.03, .28), (0, .28)], ring, seg=16)
    cyl(m, (0, .008, 0), .0372, .016, 0x3b3130, 16)
    cyl(m, (0, .272, 0), .0345, .014, 0x4a3d3a, 16)
    return finish_prop(m, 'rod_grip', ao=.3, deg=60, dist=.04, ground=False)

# ---- Lifeguard (surf patrol) tower
def lifeguard_tower():
    m = Mesh()
    WHT, RED, YEL, WOOD = 0xf6f1e6, 0xdb4a3e, 0xf5c94a, 0xd2a671
    post = lambda p, n: hex_mix(0xcfc6b2, WHT, smoothstep(.0, .9, p.y))
    DK = 1.9   # deck top
    for sx in (-1, 1):
        for sz in (-1, 1):
            tube3(m, (sx * 1.12, 0, sz * 1.12), (sx * .95, DK - .02, sz * .95), .085, .07, post, 8)
    # cross braces
    for sx in (-1, 1):
        tube3(m, (sx * 1.07, .35, -1.07), (sx * .99, 1.5, 1.0 * 1.0 - .0), .03, .03, WHT, 6) if False else None
    for (a, b) in (((-1.07, .3, 1.07), (1.0, 1.45, 1.0)), ((1.07, .3, 1.07), (-1.0, 1.45, 1.0)),
                   ((-1.07, .3, -1.07), (1.0, 1.45, -1.0)), ((1.07, .3, -1.07), (-1.0, 1.45, -1.0)),
                   ((1.07, .3, -1.07), (1.0, 1.45, 1.0)), ((1.07, .3, 1.07), (1.0, 1.45, -1.0)),
                   ((-1.07, .3, -1.07), (-1.0, 1.45, 1.0)), ((-1.07, .3, 1.07), (-1.0, 1.45, -1.0))):
        tube3(m, a, b, .03, .03, 0xe9e2d2, 6)
    rbox(m, (0, DK - .06, 0), (2.36, .12, 2.36), lambda p, n: hex_mix(0xb48d5f, 0xd8b078, clamp(n.y * .5 + .5)), .03, 2)
    # cabin (back half of the deck)
    cz, cd = -.38, 1.42
    rbox(m, (0, DK + .475, cz), (1.8, .95, cd), lambda p, n: hex_mix(0xe9e3d3, WHT, clamp((p.y - DK) / .9)), .035, 2)
    rbox(m, (0, DK + .17, cz), (1.84, .22, cd + .04), RED, .03, 2)                       # red skirt
    rbox(m, (0, DK + .36, cz), (1.83, .07, cd + .035), YEL, .02, 2)                      # yellow stripe
    # lookout windows facing +Z (a long glazed band + posts)
    fz = cz + cd / 2
    rbox(m, (0, DK + .66, fz + .012), (1.52, .42, .03), lambda p, n: hex_mix(0x8fcfe2, 0xc4eaf3, clamp((p.y - DK - .45) / .4)), .01, 1)
    for x in (-.78, -.26, .26, .78): rbox(m, (x, DK + .66, fz + .03), (.06, .46, .05), WHT, .012, 1)
    rbox(m, (0, DK + .9, fz + .03), (1.62, .06, .05), WHT, .012, 1)
    rbox(m, (0, DK + .43, fz + .03), (1.62, .05, .06), WHT, .012, 1)
    for sx in (-1, 1): rbox(m, (sx * .91, DK + .66, cz + .2), (.03, .36, .5), 0x9fd6e6, .01, 1)
    # roof (slight forward pitch) with red and a white fascia
    rbox(m, (0, DK + 1.03, cz + .04), (2.1, .09, 1.82), lambda p, n: hex_mix(0xc83e34, 0xe8574a, clamp(n.y * .5 + .5)), .035, 2, rot=(-.07, 0, 0))
    rbox(m, (0, DK + 1.0, cz + .94), (2.1, .07, .05), WHT, .015, 1, rot=(-.07, 0, 0))
    # veranda rail (open to the front centre for the ladder)
    rail = WHT
    for (x, z) in ((-1.05, 1.07), (-1.05, .35), (1.05, 1.07), (1.05, .35), (-.5, 1.07), (.5, 1.07)):
        tube3(m, (x, DK, z), (x, DK + .52, z), .026, .026, rail, 6)
    tube3(m, (-1.05, DK + .52, .35), (-1.05, DK + .52, 1.07), .028, .028, RED, 6)
    tube3(m, (1.05, DK + .52, .35), (1.05, DK + .52, 1.07), .028, .028, RED, 6)
    tube3(m, (-1.05, DK + .52, 1.07), (-.5, DK + .52, 1.07), .028, .028, RED, 6)
    tube3(m, (1.05, DK + .52, 1.07), (.5, DK + .52, 1.07), .028, .028, RED, 6)
    # front ladder
    for sx in (-.26, .26): tube3(m, (sx, 0, 1.7), (sx, DK + .02, 1.1), .035, .032, WOOD, 6)
    for i in range(1, 8):
        t = i / 8.3; y = t * DK
        rbox(m, (0, y, 1.7 - .6 * t), (.54, .045, .05), WOOD, .01, 1)
    # flagpole + red/yellow flag facing +Z
    px, pz = .7, -.7
    tube3(m, (px, DK + 1.06, pz), (px, 3.34, pz), .028, .02, WHT, 6)
    ell(m, (px, 3.35, pz), (.04, .04, .04), 0xf5c94a, 8, 5)
    rbox(m, (px - .31, 3.17, pz), (.58, .3, .018), lambda p, n: srgb(RED) if p.y > 3.17 else srgb(YEL), .006, 1)
    return finish_prop(m, 'lifeguard_tower', ao=.8, deg=45, dist=.5)

# ---- Australian pelican (standing, facing +Z)
def pelican():
    m = Mesh()
    WH, BLK, EYE, LEG = 0xf8f5ef, 0x30343d, 0xf4d447, 0xee9a56
    body = lambda p, n: hex_mix(0xdde3e8, WH, clamp((p.y - .38) / .45) * .5 + clamp(n.y * .5 + .5) * .5)
    ell(m, (0, .55, -.04), (.22, .2, .36), body, 12, 8, (-.28, 0, 0))                           # body, breast lifted
    ell(m, (0, .64, .2), (.17, .17, .17), body, 9, 6)                                           # chest
    path = [Vector((0, .70 + .38 * (t / 8), .2 - .09 * math.sin(t / 8 * math.pi * .9) - .05 * (t / 8))) for t in range(9)]   # S-curved neck, one smooth sweep
    m.add(p_sweep(path, [.095 - .022 * (t / 8) for t in range(9)], 9), None, body)
    ell(m, (0, 1.1, .12), (.105, .1, .125), body, 10, 7)                                         # head
    bill = lambda p, n: hex_mix(0xdcb5a8, 0xf3d6c9, clamp(n.y * .5 + .5))
    ell(m, (0, 1.065, .36), (.048, .03, .26), bill, 10, 6, (.1, 0, 0))                           # upper mandible
    tube3(m, (0, 1.045, .58), (0, 1.0, .665), .022, .006, 0xc98f7c, 5)                           # hooked tip
    ell(m, (0, 1.0, .33), (.06, .058, .23), lambda p, n: hex_mix(0xf0b0a0, 0xf9d0c2, clamp(n.y * .5 + .5)), 10, 6, (.1, 0, 0))  # pouch
    for s in (-1, 1):
        ell(m, (s * .097, 1.13, .17), (.022, .03, .03), EYE, 7, 5)
        ell(m, (s * .113, 1.13, .175), (.011, .016, .016), 0x25252a, 5, 4)
    for s in (-1, 1):                                                                            # folded wings: white coverts, black flight feathers
        ell(m, (s * .215, .58, -.07), (.07, .17, .32), lambda p, n: srgb(WH) if p.z > .02 or p.y > .66 else srgb(BLK), 10, 6, (-.28, 0, s * -.05))
        ell(m, (s * .2, .5, -.34), (.055, .08, .2), BLK, 8, 5, (-.4, 0, 0))
    ell(m, (0, .5, -.42), (.1, .04, .2), BLK, 8, 4, (-.35, 0, 0))                               # tail
    for s in (-1, 1):
        tube3(m, (s * .09, .06, 0), (s * .09, .4, -.02), .026, .034, LEG, 6)
        ell(m, (s * .09, .02, .07), (.075, .02, .12), LEG, 8, 4)
    return finish_prop(m, 'pelican', ao=.6, deg=80, dist=.25)

# ================================================================= review renders
SC_DIR = os.environ.get('TIDELINE_SCRATCH', os.path.join(__import__('tempfile').gettempdir(), 'tideline_shots'))

def view_one(obj, path, d=None, el=28, az=None, res=(900, 700), lens=45):
    """Single-prop review render (iteration aid, only with --shots)."""
    xs = [v.co for v in obj.data.vertices]
    mn = Vector((min(v.x for v in xs), min(v.y for v in xs), min(v.z for v in xs))); mx = Vector((max(v.x for v in xs), max(v.y for v in xs), max(v.z for v in xs)))
    size = max((mx - mn).length, .2)
    az = float(argv[argv.index('--az') + 1]) if '--az' in argv else (35 if az is None else az)
    ctr3 = Vector(((mn.x + mx.x) / 2, (mn.z + mx.z) / 2, -(mn.y + mx.y) / 2))
    dist = d or size * 1.7
    cam = ctr3 + Vector((math.sin(math.radians(az)) * math.cos(math.radians(el)), math.sin(math.radians(el)), math.cos(math.radians(az)) * math.cos(math.radians(el)))) * dist
    hid = [(o, o.hide_render) for o in bpy.context.scene.objects if o.type == 'MESH']
    for o, _ in hid: o.hide_render = True
    d_ = inst(obj); d_.hide_render = False
    render(path, tuple(cam), tuple(ctr3), lens=lens, res=res, ground_size=200)
    bpy.data.objects.remove(d_)
    for o, h in hid: o.hide_render = h

def hide_all(): 
    h = [(o, o.hide_render) for o in bpy.context.scene.objects if o.type == 'MESH']
    for o, _ in h: o.hide_render = True
    return h
def unhide(h):
    for o, v in h: o.hide_render = v

def preview_props(P):
    hid = hide_all(); made = []
    def put(n, x, z, ry=0.0, sc=1.0):
        d = inst(P[n], (x, 0, z), (0, ry, 0), sc); d.hide_render = False; made.append(d); return d
    # row 1: trees (back), row 2: structures (middle), row 3: small things (front)
    for n, x in (('norfolk_pine_0', -17), ('norfolk_pine_1', -11), ('casuarina_0', -5), ('casuarina_1', 1), ('banksia_0', 6.5), ('banksia_1', 11)): put(n, x, -6)
    put('bait_hut', -11, 6, 0.4); put('lifeguard_tower', -3.5, 6, -0.3); put('tinnie', 3.5, 6, 0.9); put('cleaning_table', 10.5, 6, -.3)
    put('pelican', -8.5, 12.5, .5); put('esky', -6.4, 12.5, .3); put('bucket', -5.2, 12.5); put('jetty_post', -3.2, 12.5)
    put('jetty_end', -.3, 12.5); put('jetty_rope', 2, 12.5); put('jetty_deck', 5, 12.5, math.pi / 2)
    put('rod_reel', 8.0, 12.5, 0, 6.0); put('rod_grip', 9.0, 12.5, 0, 3.0)
    render(os.path.join(SHOTS, 'props.png'), (-2, 19, 33), (-3, 1.2, 2.5), lens=35, res=(1600, 950), ground_size=300)
    # close-up of the small props
    for d in made: bpy.data.objects.remove(d)
    made = []
    put('pelican', -.9, 0, .6, 2.4); put('esky', 1.0, 0, .3, 2.4); put('bucket', 2.1, 0, 0, 2.4); put('rod_reel', 3.1, 0, 0, 14.0); put('rod_grip', 4.0, 0, 0, 5.0)
    put('jetty_rope', 0.1, 1.5, 0, 2.4); put('jetty_post', 2.5, 1.7, 0, .8)
    render(os.path.join(SHOTS, 'props_small.png'), (1.2, 4.8, 8.0), (1.7, 1.0, .3), lens=45, res=(1400, 800), ground_size=60)
    for d in made: bpy.data.objects.remove(d)
    unhide(hid)

def preview_jetty(P):
    hid = hide_all(); made = []
    def put(n, x, y, z, ry=0.0, sc=1.0):
        d = inst(P[n], (x, y, z), (0, ry, 0), sc); d.hide_render = False; made.append(d); return d
    for k in range(5): put('jetty_deck', 0, 0, 1.0 + 2.0 * k)
    put('jetty_end', 0, 0, 10.3)
    for z in (2.0, 5.0, 8.0):
        for sx in (-1, 1): put('jetty_post', sx * 1.28, 0, z)
    put('jetty_rope', .8, 0, 10.1, .6); put('pelican', -1.28, .79, 5.0, -.5); put('bucket', .7, 0, 3.2); put('esky', -.7, 0, 6.5, .2)
    put('tinnie', 4.0, 0, 6.5, math.pi / 2 + .1)
    put('bait_hut', -6.0, 0, 1.0, -math.pi / 2 + .1)
    # water plane + sand
    sc = bpy.context.scene
    bpy.ops.mesh.primitive_plane_add(size=80, location=T((0, -.01, 5))); w = bpy.context.active_object
    wm = bpy.data.materials.new('water'); wm.use_nodes = True
    wm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*lin3(0x4fb7c6), 1)
    wm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .9
    w.data.materials.append(wm)
    bpy.ops.mesh.primitive_plane_add(size=40, location=T((-27, 0, 5))); sd = bpy.context.active_object   # beach strip on the -X side
    sm = bpy.data.materials.new('sand'); sm.use_nodes = True
    sm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*lin3(0xf0dca8), 1)
    sd.data.materials.append(sm); sd.hide_render = False
    sd.location = T((-24, .02, 5))
    render(os.path.join(SHOTS, 'jetty.png'), (7.5, 11.5, -2.5), (-.5, 0, 6.5), lens=42, res=(1400, 900), ground_size=300, ground=0x4fb7c6, ground_y=-1.6)
    bpy.data.objects.remove(w); bpy.data.objects.remove(sd)
    for d in made: bpy.data.objects.remove(d)
    unhide(hid)

REQUIRED = list(PARTS) + ['norfolk_pine_0', 'norfolk_pine_1', 'casuarina_0', 'casuarina_1', 'banksia_0', 'banksia_1'] + \
    [f'{n}_lo' for n in ('norfolk_pine_0', 'norfolk_pine_1', 'casuarina_0', 'casuarina_1', 'banksia_0', 'banksia_1')] + \
    ['jetty_deck', 'jetty_post', 'jetty_end', 'tinnie', 'bait_hut', 'cleaning_table', 'lifeguard_tower', 'pelican', 'esky', 'bucket', 'rod_reel', 'rod_grip']
OPTIONAL = ['jetty_rope']

def main():
    cosylib.reset()
    os.makedirs(SHOTS, exist_ok=True)
    allobjs, P = {}, {}
    ang = {}
    if ONLY in ('all', 'angler'):
        ang = build_angler(); recenter(ang); allobjs.update(ang)
    if ONLY in ('all', 'props', 'trees', 'jetty'):
        fns = {'norfolk_pine_0': lambda: norfolk_pine('norfolk_pine_0', 11, 10, 2.5, 1), 'norfolk_pine_1': lambda: norfolk_pine('norfolk_pine_1', 14, 13, 2.8, 2),
               'casuarina_0': lambda: casuarina('casuarina_0', 9.9, 1.0, 3), 'casuarina_1': lambda: casuarina('casuarina_1', 10.4, -.9, 4),
               'banksia_0': lambda: banksia('banksia_0', 5), 'banksia_1': lambda: banksia('banksia_1', 6)}
        for n in ('jetty_deck', 'jetty_post', 'jetty_end', 'jetty_rope', 'tinnie', 'bait_hut', 'cleaning_table', 'lifeguard_tower', 'pelican', 'esky', 'bucket', 'rod_reel', 'rod_grip'):
            fns[n] = globals()[n]
        only = [a for a in argv if a in fns]
        for n, f in fns.items():
            if only and n not in only: continue
            P[n] = f()
        for n in [k for k in P if k.split('_')[0] in ('norfolk', 'casuarina', 'banksia')]:
            P[n + '_lo'] = lo_copy(P[n], .35)
        allobjs.update(P)
    if '--shots' in argv:
        os.makedirs(SC_DIR, exist_ok=True)
        for n, o in P.items(): view_one(o, os.path.join(SC_DIR, n + '.png'))
        if ang: pass
    # ---- export
    glb = [o for o in allobjs.values()]
    if ONLY == 'all': cosylib.export(glb, OUT)
    print('--- OBJECTS / TRIANGLES')
    for n, o in allobjs.items(): print(f'{n:22s} {tris(o):6d}')
    print('angler total', sum(tris(o) for o in ang.values()), '| trees max', max([tris(o) for n, o in allobjs.items() if n.split('_')[0] in ('norfolk', 'casuarina', 'banksia') and not n.endswith('_lo')] or [0]))
    # ---- neutral-slot sanity (parameterised slots must be hue-free greys in ~0.75..1.0 sRGB)
    def to_srgb(c): return 12.92 * c if c <= .0031308 else 1.055 * c ** (1 / 2.4) - .055
    for n, o in ang.items():
        if n.split('_')[-1] in ('skin', 'hair', 'hat', 'shirt', 'shorts'):
            vals = [to_srgb(d.color[0]) for d in o.data.color_attributes['Col'].data]
            hue = max(max(abs(d.color[0] - d.color[1]), abs(d.color[1] - d.color[2])) for d in o.data.color_attributes['Col'].data)
            print(f'neutral {n:20s} min {min(vals):.2f} max {max(vals):.2f} hue-spread {hue:.4f}')
    # ---- verification
    missing = [n for n in REQUIRED if n not in allobjs]
    print('--- VERIFY required names')
    for n in REQUIRED: print(('OK      ' if n in allobjs else 'MISSING ') + n)
    for n in OPTIONAL: print(('OK      ' if n in allobjs else 'MISSING ') + n + ' (optional)')
    print('ALL REQUIRED PRESENT' if not missing and ONLY == 'all' else f'MISSING: {missing}' if ONLY == 'all' else '(partial build)')
    # ---- previews
    if PREVIEW:
        if ang:
            hid = hide_all(); preview_angler(ang); unhide(hid)
        if len(P) >= 10: preview_props(P)
        if 'jetty_deck' in P and 'jetty_post' in P and ONLY in ('all', 'jetty'): preview_jetty(P)
main()
