# Shared helpers for DeepSwell's cosy-style model sets (run inside Blender: see tools/blender/build_sets.py).
# Style rules: chunky rounded shapes, matte, pastel vertex colours, soft gradients toward growing tips/edges.
# Axes: Blender +Z up, +X forward; glTF export converts to three.js (+Y up). Units: metres, base at z = 0.
import bpy, bmesh, math, random
from mathutils import Vector, noise, Color

# ---------------------------------------------------------------- scene / colour utilities
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def srgb(h):
    return tuple(((h >> s) & 255) / 255 for s in (16, 8, 0))

def lin(c):
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

def vcolor(obj, fn):
    """Point colour attribute 'Col' from fn(co, normal) -> sRGB tuple."""
    me = obj.data
    for a in list(me.color_attributes): me.color_attributes.remove(a)
    attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for v in me.vertices:
        r, g, b = lin(fn(v.co, v.normal))
        attr.data[v.index].color = (r, g, b, 1.0)
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = 0

def vcolor_faces(obj, fn):
    """Colour per face (face-corner domain, from the face centre): crisp panel and stripe edges."""
    me = obj.data
    for a in list(me.color_attributes): me.color_attributes.remove(a)
    attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    for poly in me.polygons:
        r, g, b = lin(fn(poly.center, poly.normal))
        for li in poly.loop_indices: attr.data[li].color = (r, g, b, 1.0)
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = 0

_mat = None
def vc_material():
    global _mat
    try:
        if _mat and _mat.name in bpy.data.materials: return _mat
    except ReferenceError:  # removed when the scene was reset for the next site
        pass
    m = bpy.data.materials.new('VC')
    nt = m.node_tree if m.node_tree else None
    if nt is None:
        m.use_nodes = True; nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'Col'
    nt.links.new(a.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.85
    _mat = m
    return m

AO_STRENGTH = 0.8

def bake_ao(obj, strength=None):
    """Bake ambient occlusion (Cycles) into the vertex colours: crevices, branch forks, undersides and the contact
    with the ground darken softly. A temporary ground plane under the model gives the base its contact shadow."""
    strength = AO_STRENGTH if strength is None else strength
    if strength <= 0 or not obj.data.color_attributes.get('Col'): return obj
    sc = bpy.context.scene
    others = [o for o in sc.objects if o is not obj and o.type == 'MESH']
    for o in others: o.hide_render = True
    zmin = min(v.co.z for v in obj.data.vertices)
    bpy.ops.mesh.primitive_plane_add(size=50, location=(0, 0, zmin - 0.002)); ground = bpy.context.active_object
    if sc.world is None: sc.world = bpy.data.worlds.new('bakeworld')
    size = max(obj.dimensions) or 1
    sc.world.light_settings.distance = max(0.05, size * 0.35)
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.device = 'CPU'
    me = obj.data
    ao = me.color_attributes.new('AO', 'FLOAT_COLOR', 'POINT')
    me.color_attributes.active_color = ao
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
    col = me.color_attributes['Col']
    if col.domain == 'CORNER':
        for loop in me.loops:
            k = 1 - strength * (1 - ao.data[loop.vertex_index].color[0])
            c = col.data[loop.index].color
            col.data[loop.index].color = (c[0] * k, c[1] * k, c[2] * k, 1.0)
    else:
        for i in range(len(col.data)):
            k = 1 - strength * (1 - ao.data[i].color[0])
            c = col.data[i].color
            col.data[i].color = (c[0] * k, c[1] * k, c[2] * k, 1.0)
    me.color_attributes.remove(me.color_attributes['AO'])
    me.color_attributes.active_color = me.color_attributes['Col']
    bpy.data.objects.remove(ground)
    for o in others: o.hide_render = False
    return obj

def finish(obj, name, ao=None):
    obj.name = name; obj.data.name = name
    for p in obj.data.polygons: p.use_smooth = True
    obj.data.materials.clear(); obj.data.materials.append(vc_material())
    bake_ao(obj, ao)
    return obj

def link(obj):
    bpy.context.scene.collection.objects.link(obj); return obj

def apply_all(obj):
    bpy.context.view_layer.objects.active = obj
    for m in list(obj.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)

def decimate(obj, ratio):
    if ratio >= 1: return
    d = obj.modifiers.new('dec', 'DECIMATE'); d.ratio = ratio; apply_all(obj)

def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active; o.name = name
    return o

def tris(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)

def budget(obj, max_tris):
    """Decimate down to roughly max_tris triangles."""
    t = tris(obj)
    if t > max_tris: decimate(obj, max_tris / t)
    return obj

def remove_islands(obj, keep_ratio=0.04):
    bm = bmesh.new(); bm.from_mesh(obj.data); bm.verts.ensure_lookup_table()
    seen, groups = set(), []
    for v in bm.verts:
        if v.index in seen: continue
        stack, g = [v], []
        seen.add(v.index)
        while stack:
            a = stack.pop(); g.append(a)
            for e in a.link_edges:
                b = e.other_vert(a)
                if b.index not in seen: seen.add(b.index); stack.append(b)
        groups.append(g)
    n = len(bm.verts)
    bmesh.ops.delete(bm, geom=[v for g in groups if len(g) < n * keep_ratio for v in g], context='VERTS')
    bm.to_mesh(obj.data); bm.free()

def metaball_mesh(name, elems, resolution=0.04, threshold=0.5):
    """elems: list of (co, radius) -> one smooth blobby mesh."""
    mb = bpy.data.metaballs.new(name + '_mb'); mb.resolution = resolution; mb.render_resolution = resolution; mb.threshold = threshold
    o = link(bpy.data.objects.new(name + '_mbo', mb))
    for co, r in elems:
        e = mb.elements.new(); e.co = co; e.radius = r
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH')
    m = bpy.context.view_layer.objects.active
    for ob in list(bpy.data.objects):
        if ob.type == 'META': bpy.data.objects.remove(ob)
    remove_islands(m)
    return m

def mesh_from_bm(bm, name):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return link(bpy.data.objects.new(name, me))

# ---------------------------------------------------------------- shape builders
def pebble(name, size=(1.0, 0.8, 0.55), seed=1, top=0xb9c6cc, base=0xb0bec4 - 0x31372b, flat=-0.12, sub=4):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=0.5)
    o = bpy.context.active_object
    for v in o.data.vertices:
        p = v.co.copy()
        d = noise.noise(p * 1.6 + Vector((seed * 3.1, 0, 0))) * 0.12 + noise.noise(p * 3.5 + Vector((0, seed, 0))) * 0.03
        v.co = p * (1 + d)
        v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
        v.co.z = max(v.co.z, flat * size[2] * 2)
    o.data.update()
    t, b = srgb(top), srgb(base)
    vcolor(o, lambda co, n: mix(b, t, smoothstep(-0.4, 0.8, n.z)))
    return finish(o, name)

def branching(name, seed, base, tip, stems=5, length=0.3, radius=0.11, depth=3, spread=0.5, flatten=0.0, taper=0.3, shrink=0.8,
              res=0.04, tip_gamma=1.3, upward=(0.1, 0.6), jitter=0.9, max_tris=3000, corallites=True):
    """Chunky branching colony from metaballs (staghorn, deep-sea coral, sea fans with flatten ~1)."""
    rnd = random.Random(seed)
    elems = []
    def grow(p, d, L, r, dep):
        steps = max(2, int(L / (r * 0.7)))
        for s in range(1, steps + 1):
            q = p + d * (L * s / steps)
            rr = r * (1 - taper * s / steps)
            elems.append((q, rr))
            # Radial corallites: small bumps along the branch (the cups of individual polyps).
            if corallites and rnd.random() < 0.55:
                side = d.cross(Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1)))).normalized()
                elems.append((q + side * rr * 0.75 + d * rr * 0.3, rr * 0.38))
        end = p + d * L
        if dep == 0:
            elems.append((end + d * r * 0.25, r * (1 - taper) * 0.55))   # rounded, slightly pointed growing tip
            return
        for k in range(2 if dep > 1 else rnd.choice([1, 2])):
            nd = d + Vector((rnd.uniform(-jitter, jitter), rnd.uniform(-jitter, jitter) * (1 - flatten), rnd.uniform(*upward)))
            nd = nd.normalized()
            grow(end, nd, L * rnd.uniform(0.65, 0.85), r * shrink, dep - 1)
    for s in range(stems):
        a = s / stems * math.tau + rnd.uniform(0, 0.6)
        d = Vector((math.cos(a) * spread, math.sin(a) * spread * (1 - flatten), 1)).normalized()
        grow(Vector((math.cos(a) * 0.06, math.sin(a) * 0.06 * (1 - flatten), 0)), d, length, radius, depth)
    o = metaball_mesh(name, elems, resolution=res)
    budget(o, max_tris)
    zmax = max(v.co.z for v in o.data.vertices) or 1
    b, t = srgb(base), srgb(tip)
    vcolor(o, lambda co, n: mix(b, t, smoothstep(0.25, 1.0, co.z / zmax) ** tip_gamma))
    return finish(o, name)

def grooved_dome(name, ridge, groove, freq=6.0, amp=0.07, squash=0.72, seg=96, max_tris=4200, seed=0):
    """Brain coral: a dome with meandering ridges and grooves (colour follows the same pattern)."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=0.5)
    o = bpy.context.active_object
    off = Vector((seed * 1.7, seed * 0.3, 0))
    def g_at(p):
        # Domain-warped stripes; abs(sin) gives rounded ridges with narrow valleys between them (meanders).
        w = p * freq + Vector((noise.noise(p * 2.2 + off) * 3.0, noise.noise(p * 2.2 + Vector((5, 0, 0)) + off) * 3.0, noise.noise(p * 1.5 + off) * 2.0))
        return 1.0 - 2.0 * (1.0 - abs(math.sin(w.x + math.sin(w.y * 0.9) * 1.8 + w.z * 0.6))) ** 3
    gv = {}
    for v in o.data.vertices:
        p = v.co.copy(); g = g_at(p); gv[v.index] = g
        p *= 1 + amp * g
        p.z = p.z * squash if p.z > 0 else p.z * 0.12
        v.co = p
    o.data.update()
    budget(o, max_tris)
    r, gr = srgb(ridge), srgb(groove)
    vcolor(o, lambda co, n: mix(gr, r, smoothstep(-0.6, 0.2, g_at(Vector((co.x, co.y, co.z / squash if co.z > 0 else co.z))))))
    return finish(o, name)

def lumpy_dome(name, col_top, col_base, bumps=26, size=(1.0, 1.0, 0.7), seed=3, max_tris=2200):
    """Massive boulder coral (Porites): a lumpy hummock of rounded lobes."""
    rnd = random.Random(seed)
    elems = [(Vector((0, 0, 0.12)), 0.42)]
    for i in range(bumps):
        a, r = rnd.uniform(0, math.tau), rnd.uniform(0.0, 0.42)
        z = 0.1 + 0.32 * math.sqrt(max(0, 1 - (r / 0.45) ** 2))
        elems.append((Vector((math.cos(a) * r, math.sin(a) * r, z)), rnd.uniform(0.12, 0.2)))
    o = metaball_mesh(name, elems, resolution=0.035)
    for v in o.data.vertices: v.co.x *= size[0]; v.co.y *= size[1]; v.co.z = max(v.co.z * size[2] * 1.4 - 0.05, -0.05)
    o.data.update(); budget(o, max_tris)
    t, b = srgb(col_top), srgb(col_base)
    zmax = max(v.co.z for v in o.data.vertices) or 1
    vcolor(o, lambda co, n: mix(b, t, smoothstep(0.0, 0.9, co.z / zmax) * (0.6 + 0.4 * max(0, n.z))))
    return finish(o, name)

def table(name, plate, rim, stalk, radius=0.75, height=0.42, max_tris=1800):
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=radius, depth=0.12)
    o = bpy.context.active_object
    bev = o.modifiers.new('bev', 'BEVEL'); bev.width = 0.05; bev.segments = 3
    apply_all(o)
    for v in o.data.vertices:
        r = math.hypot(v.co.x, v.co.y)
        v.co.z += height + 0.08 * (r / radius) ** 2 + noise.noise(v.co * 3) * 0.02
    o.data.update()
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.1 * radius / 0.75, depth=height, location=(0, 0, height / 2))
    o = join([o, bpy.context.active_object], name)
    budget(o, max_tris)
    p, rm, s = srgb(plate), srgb(rim), srgb(stalk)
    vcolor(o, lambda co, n: s if co.z < height - 0.06 else mix(p, rm, smoothstep(radius * 0.72, radius * 1.02, math.hypot(co.x, co.y))))
    return finish(o, name)

def scroll_plates(name, inner, edge, plates=5, seed=2, max_tris=2000):
    """Foliose (plate) coral: overlapping, upturned scrolls rising in tiers."""
    rnd = random.Random(seed)
    parts = []
    for i in range(plates):
        a = i / plates * math.tau + rnd.uniform(-0.3, 0.3)
        R = rnd.uniform(0.25, 0.4)
        bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=R, depth=0.05)
        o = bpy.context.active_object
        bev = o.modifiers.new('bev', 'BEVEL'); bev.width = 0.02; bev.segments = 2; apply_all(o)
        cx, cy, cz = math.cos(a) * 0.22, math.sin(a) * 0.22, 0.12 + i * 0.07
        for v in o.data.vertices:
            r = math.hypot(v.co.x, v.co.y)
            v.co.z += (r / R) ** 2 * 0.12 + noise.noise(v.co * 4) * 0.015
        o.data.update()
        o.rotation_euler = (rnd.uniform(-0.35, 0.35), rnd.uniform(-0.35, 0.35), a)
        o.location = (cx, cy, cz)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        parts.append(o)
    o = join(parts, name); budget(o, max_tris)
    i_c, e_c = srgb(inner), srgb(edge)
    vcolor(o, lambda co, n: mix(i_c, e_c, smoothstep(0.25, 0.55, math.hypot(co.x, co.y))))
    return finish(o, name)

def mushroom(name, cap, stalk, rim=None, radius=0.38, height=0.28, folds=7, max_tris=1800):
    """Leather coral (Sarcophyton): a thick stalk with a wavy, folded cap."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=radius, depth=0.06)
    c = bpy.context.active_object
    bev = c.modifiers.new('bev', 'BEVEL'); bev.width = 0.025; bev.segments = 3
    sub = c.modifiers.new('sub', 'SUBSURF'); sub.levels = 1; apply_all(c)
    for v in c.data.vertices:
        r = math.hypot(v.co.x, v.co.y); a = math.atan2(v.co.y, v.co.x)
        v.co.z += height + (r / radius) ** 2 * 0.06 * math.sin(a * folds) + (r / radius) ** 2 * 0.04
    c.data.update()
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius * 0.45, depth=height, location=(0, 0, height / 2))
    s = bpy.context.active_object
    o = join([c, s], name); budget(o, max_tris)
    cp, st, rm = srgb(cap), srgb(stalk), srgb(rim if rim else cap)
    vcolor(o, lambda co, n: st if co.z < height - 0.03 else mix(cp, rm, smoothstep(radius * 0.6, radius, math.hypot(co.x, co.y))))
    return finish(o, name)

def bubbles(name, seed, cols, count=14, spread=0.35, size=(0.09, 0.16), height=0.45, max_tris=1600):
    rnd = random.Random(seed)
    elems, centres = [], []
    for k in range(count):
        a, r = rnd.uniform(0, math.tau), rnd.uniform(0, spread)
        c = Vector((math.cos(a) * r, math.sin(a) * r, rnd.uniform(0.08, height) * (1 - r / max(spread, 1e-3) * 0.6)))
        elems.append((c, rnd.uniform(*size))); centres.append((c, srgb(cols[k % len(cols)])))
    o = metaball_mesh(name, elems, resolution=0.03)
    budget(o, max_tris)
    def col(co, n):
        best = min(centres, key=lambda e: (co - e[0]).length)
        return mix(best[1], (1, 1, 1), 0.12 * max(0, n.z))
    vcolor(o, col)
    return finish(o, name)

def vase(name, profile, outer, inner, rim=None, wobble=0.04, lobes=5, seed=0, max_tris=1800):
    """Lathe-based sponge/vase: profile = [(r, z), ...] bottom to rim. Inside darker."""
    bm = bmesh.new()
    seg = 40
    rows = []
    for (r, z) in profile:
        row = []
        for s in range(seg):
            a = s / seg * math.tau
            rr = r * (1 + wobble * math.sin(a * lobes + seed) + wobble * 0.5 * noise.noise(Vector((math.cos(a) * 2, math.sin(a) * 2, z * 3 + seed))))
            row.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, z)))
        rows.append(row)
    for i in range(len(rows) - 1):
        for s in range(seg):
            bm.faces.new((rows[i][s], rows[i][(s + 1) % seg], rows[i + 1][(s + 1) % seg], rows[i + 1][s]))
    bm.faces.new(list(reversed(rows[0])))
    o = mesh_from_bm(bm, name)
    so = o.modifiers.new('so', 'SOLIDIFY'); so.thickness = 0.035; so.offset = 1
    sub = o.modifiers.new('sub', 'SUBSURF'); sub.levels = 1
    apply_all(o); budget(o, max_tris)
    oc, ic, rc = srgb(outer), srgb(inner), srgb(rim if rim else outer)
    zmax = profile[-1][1]
    def col(co, n):
        r = math.hypot(co.x, co.y)
        out_r = next((pr for pr, pz in profile if pz >= co.z), profile[-1][0])
        inside = r < out_r * 0.97 and co.z > 0.05
        c = ic if inside else oc
        return mix(c, rc, smoothstep(zmax * 0.85, zmax, co.z))
    vcolor(o, col)
    return finish(o, name)

def fingers(name, seed, base, tip, count=7, height=(0.35, 0.7), radius=0.06, max_tris=1600):
    """Finger sponge / pegs: upright rounded fingers from one base."""
    rnd = random.Random(seed)
    elems = []
    for i in range(count):
        a, r = rnd.uniform(0, math.tau), rnd.uniform(0, 0.14)
        h = rnd.uniform(*height); lean = Vector((rnd.uniform(-0.25, 0.25), rnd.uniform(-0.25, 0.25), 1)).normalized()
        p0 = Vector((math.cos(a) * r, math.sin(a) * r, 0))
        n = max(3, int(h / (radius * 0.8)))
        for s in range(n + 1): elems.append((p0 + lean * (h * s / n), radius * (1.05 - 0.15 * s / n)))
    o = metaball_mesh(name, elems, resolution=0.025)
    budget(o, max_tris)
    zmax = max(v.co.z for v in o.data.vertices) or 1
    b, t = srgb(base), srgb(tip)
    vcolor(o, lambda co, n: mix(b, t, smoothstep(0.2, 1.0, co.z / zmax)))
    return finish(o, name)

def strap(points, widths, thick=0.02, twist=0.0, name='strap'):
    """Thick rounded blade along a polyline (kelp blades, seagrass): strip + solidify + subsurf."""
    bm = bmesh.new()
    left, right = [], []
    for i, (p, w) in enumerate(zip(points, widths)):
        p = Vector(p)
        d = (Vector(points[min(i + 1, len(points) - 1)]) - Vector(points[max(i - 1, 0)])).normalized()
        side = d.cross(Vector((0, 0, 1)))
        if side.length < 1e-4: side = Vector((1, 0, 0))
        side.normalize()
        ang = twist * i / max(1, len(points) - 1)
        side = side * math.cos(ang) + d.cross(side) * math.sin(ang)
        left.append(bm.verts.new(p - side * w / 2)); right.append(bm.verts.new(p + side * w / 2))
    for i in range(len(points) - 1):
        bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
    o = mesh_from_bm(bm, name)
    so = o.modifiers.new('so', 'SOLIDIFY'); so.thickness = thick; so.offset = 0
    sub = o.modifiers.new('sub', 'SUBSURF'); sub.levels = 1
    apply_all(o)
    return o

def tube(a, b, r0, r1, verts=8):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r0, radius2=r1, depth=d.length, location=(a + b) / 2)
    o = bpy.context.active_object
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o

# ---------------------------------------------------------------- export and review render
def export(objs, path):
    for o in objs: o.location = (0, 0, 0); o.rotation_euler = (0, 0, 0); o.scale = (1, 1, 1)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_materials='NONE', export_yup=True)
    try: bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
    except TypeError: bpy.ops.export_scene.gltf(**kw, export_colors=True)
    print('EXPORTED', path, {o.name: tris(o) for o in objs})

def preview(objs, path, ground=0xead7ad, sky=0x9fd8e8, cols=5, spacing=1.6, cam_dist=None):
    """Grid layout + EEVEE review render (game-like 3/4 view)."""
    n = len(objs)
    rows = (n + cols - 1) // cols
    for i, o in enumerate(objs):
        o.location = ((i % cols - (cols - 1) / 2) * spacing, (rows - 1 - i // cols - (rows - 1) / 2) * spacing, 0)
    sc = bpy.context.scene
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -0.01)); g = bpy.context.active_object
    gm = bpy.data.materials.new('ground'); gm.use_nodes = True
    gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*lin(srgb(ground)), 1)
    g.data.materials.append(gm)
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (*lin(srgb(sky)), 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.5; sun.angle = math.radians(12)
    so = link(bpy.data.objects.new('sun', sun)); so.rotation_euler = (math.radians(40), math.radians(15), math.radians(30))
    cam = bpy.data.cameras.new('cam'); cam.lens = 35
    co = link(bpy.data.objects.new('cam', cam)); sc.camera = co
    span = max(cols, rows) * spacing
    dist = cam_dist or span * 0.95
    co.location = (0, -dist * 1.05, dist * 0.75); co.rotation_euler = (math.radians(55), 0, 0)
    for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try: sc.render.engine = eng; break
        except TypeError: pass
    sc.render.resolution_x, sc.render.resolution_y = 1400, 800
    vts = [i.identifier for i in sc.view_settings.bl_rna.properties['view_transform'].enum_items]
    sc.view_settings.view_transform = 'AgX' if 'AgX' in vts else 'Standard'
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for ob in (g, so, co): bpy.data.objects.remove(ob)
