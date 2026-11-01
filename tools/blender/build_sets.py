# Build DeepSwell's cosy-style model sets (one .glb per site) plus a review render for each.
# Run from the repo root:
#   blender --background --factory-startup --python tools/blender/build_sets.py -- <site|all> [--no-preview]
# Writes assets/models/<site>_cosy.glb and playtest-shots/blender-<site>.png.
# Colours follow the real animals/plants (pastel-shifted for the cosy style); sizes match the game's generators.
import bpy, sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, cosylib
importlib.reload(cosylib)
from cosylib import *
from mathutils import Vector
import creatures
importlib.reload(creatures)
from creatures import *

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['all']
SITES = ['gbr', 'rocky', 'seagrass', 'pelagic', 'deep'] if argv[0] == 'all' else [argv[0]]
PREVIEW = '--no-preview' not in argv

def fit(o, width=None, height=None):
    """Scale to a target footprint width (max of x/y) and/or height (z), keeping the base at z = 0."""
    xs = [v.co.x for v in o.data.vertices]; ys = [v.co.y for v in o.data.vertices]; zs = [v.co.z for v in o.data.vertices]
    w = max(max(xs) - min(xs), max(ys) - min(ys)) or 1; h = (max(zs) - min(zs)) or 1
    kx = (width / w) if width else (height / h if height else 1)
    kz = (height / h) if height else kx
    for v in o.data.vertices: v.co.x *= kx; v.co.y *= kx; v.co.z = (v.co.z - min(zs)) * kz + min(0, min(zs) * kz)
    o.data.update()
    return o

def lo(o, ratio=0.35):
    """Low-detail copy '<name>_lo' for distant tiles."""
    c = o.copy(); c.data = o.data.copy(); link(c); c.name = o.name + '_lo'; c.data.name = c.name
    decimate(c, ratio); return c


# ---------------------------------------------------------------- small reef creatures (static or slow animals)
def anemone(name, seed):
    """Magnificent sea anemone (Heteractis magnifica): coloured column, oral disc carpeted with blunt tentacles."""
    rnd = random.Random(seed)
    elems = [(Vector((0, 0, 0.06)), 0.2), (Vector((0, 0, 0.12)), 0.22)]
    tips = []
    for i in range(60):
        a, r = rnd.uniform(0, math.tau), math.sqrt(rnd.uniform(0.02, 1)) * 0.36
        base = Vector((math.cos(a) * r, math.sin(a) * r, 0.16))
        d = Vector((math.cos(a) * 0.5, math.sin(a) * 0.5, 1)).normalized()
        for s in range(4): elems.append((base + d * (0.03 * s), 0.035))
        tips.append(base + d * 0.1)
    o = metaball_mesh(name, elems, resolution=0.018); budget(o, 2600)
    col, tent, tip = srgb(0xb03a78), srgb(0x9a9a5a), srgb(0xe8e0a8)
    vcolor(o, lambda co, n: col if co.z < 0.13 else mix(tent, tip, smoothstep(0.18, 0.27, co.z)))
    return finish(o, name)

def cots(name, seed):
    """Crown-of-thorns starfish (Acanthaster planci): many-armed disc covered in stout spines, purple-grey with red tips."""
    rnd = random.Random(seed)
    elems = [(Vector((0, 0, 0.03)), 0.09)]
    for k in range(16):
        a = k / 16 * math.tau
        for s in range(1, 6): elems.append((Vector((math.cos(a) * 0.045 * s, math.sin(a) * 0.045 * s, 0.025)), 0.035 - 0.003 * s))
    body = metaball_mesh(name + '_b', elems, resolution=0.012)
    spines = []
    for i in range(70):
        a, r = rnd.uniform(0, math.tau), rnd.uniform(0.02, 0.22)
        p = Vector((math.cos(a) * r, math.sin(a) * r, 0.045))
        spines.append(tube(p, p + Vector((rnd.uniform(-0.01, 0.01), rnd.uniform(-0.01, 0.01), 0.035)), 0.007, 0.002, 5))
    o = join([body] + spines, name); budget(o, 2200)
    vcolor(o, lambda co, n: mix(srgb(0x7a6a9a), srgb(0xe0503a), smoothstep(0.055, 0.075, co.z)))
    return finish(o, name)

def prickly_redfish(name, seed):
    """Prickly redfish sea cucumber (Thelenota ananas): long orange-red body with star-shaped clusters of papillae."""
    rnd = random.Random(seed)
    elems = [(Vector((x, 0, 0.06)), 0.07) for x in [i * 0.035 - 0.21 for i in range(13)]]
    body = metaball_mesh(name + '_b', elems, resolution=0.015)
    for v in body.data.vertices: v.co.z = max(v.co.z, 0.005); v.co.y *= 1.1
    bumps = []
    for i in range(22):
        x = rnd.uniform(-0.2, 0.2); a = rnd.uniform(-1.2, 1.2)
        c = Vector((x, math.sin(a) * 0.06, 0.06 + math.cos(a) * 0.06))
        for k in range(3):
            d = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 1.2)).normalized()
            bumps.append(tube(c, c + d * 0.03, 0.009, 0.002, 5))
    o = join([body] + bumps, name); budget(o, 2000)
    vcolor(o, lambda co, n: mix(srgb(0xc04a2a), srgb(0xf08a4a), smoothstep(0.08, 0.13, co.z)))
    return finish(o, name)

def longspine_urchin(name, seed):
    """Long-spined sea urchin (Centrostephanus rodgersii): dark purple-black test with long spines."""
    rnd = random.Random(seed)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=0.06, location=(0, 0, 0.045))
    t = bpy.context.active_object; t.scale = (1, 1, 0.75); bpy.ops.object.transform_apply(scale=True)
    parts = [t]
    for i in range(46):
        d = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(0.0, 1.0))).normalized()
        p0 = Vector((0, 0, 0.045)) + d * 0.05
        parts.append(tube(p0, p0 + d * rnd.uniform(0.12, 0.18), 0.008, 0.002, 5))
    o = join(parts, name); budget(o, 1800)
    vcolor(o, lambda co, n: mix(srgb(0x2a1a34), srgb(0x6a3a7a), smoothstep(0.05, 0.2, (co - Vector((0, 0, 0.045))).length)))
    return finish(o, name)

def abalone_shell(name, seed):
    """Blacklip abalone (Haliotis rubra): low ear-shaped shell with a row of respiratory holes, black-lipped foot."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.08, location=(0, 0, 0))
    o = bpy.context.active_object
    for v in o.data.vertices:
        v.co.x *= 1.4; v.co.z = max(0.0, v.co.z) * 0.45 + 0.004
        v.co.x += 0.02 * (v.co.z / 0.036) ** 2
    o.data.update(); o = finish(o, name)
    holes = lambda co: abs(co.y - 0.045) < 0.009 and (co.x * 60) % 1 < 0.35
    vcolor(o, lambda co, n: srgb(0x1a1a1a) if co.z < 0.008 else (srgb(0x4a3a30) if holes(co) else mix(srgb(0x8a6a48), srgb(0xb88a68), smoothstep(0.01, 0.035, co.z))))
    return o

def cunjevoi_clump(name, seed):
    """Cunjevoi (Pyura praeputialis): leathery brown-red sea squirts packed together, each with two siphons."""
    rnd = random.Random(seed)
    elems = []
    for i in range(6):
        a, r = rnd.uniform(0, math.tau), rnd.uniform(0, 0.1)
        h = rnd.uniform(0.08, 0.15); c = Vector((math.cos(a) * r, math.sin(a) * r, 0))
        for s in range(4): elems.append((c + Vector((0, 0, h * s / 3)), 0.06))
    o = metaball_mesh(name, elems, resolution=0.014); budget(o, 1500)
    zmax = max(v.co.z for v in o.data.vertices) or 1
    vcolor(o, lambda co, n: mix(srgb(0x6a3a2a), srgb(0xb8705a), smoothstep(0.3, 1.0, co.z / zmax)))
    return finish(o, name)

# ---------------------------------------------------------------- Great Barrier Reef (outer reef, Queensland)
def gbr():
    out = []
    # Acropora staghorn: real colonies are brown, green, blue or purple, often with paler growing tips.
    out.append(fit(branching('staghorn_0', 7, 0x8a6fb3, 0xf3b5d8), 1.6, 1.15))
    out.append(fit(branching('staghorn_1', 11, 0x5e9e86, 0xd8f0a0), 1.7, 1.1))
    out.append(fit(branching('staghorn_2', 19, 0x6f88c8, 0xb8e4ff), 1.6, 1.2))
    # Corymbose ("bush") Acropora: short, dense, upright branchlets.
    out.append(fit(branching('bush_0', 23, 0xb0739a, 0xffc0dc, stems=9, length=0.16, radius=0.07, depth=2, spread=1.2, res=0.03), 1.0, 0.42))
    out.append(fit(branching('bush_1', 29, 0x9a9a5a, 0xf6efa0, stems=9, length=0.16, radius=0.07, depth=2, spread=1.2, res=0.03), 1.0, 0.4))
    # Brain coral (e.g. Platygyra): meandering ridges, contrasting valleys.
    out.append(fit(grooved_dome('brain_0', 0xc9d98a, 0x7a8f52, freq=11, amp=0.05, seed=1), 1.05, 0.48))
    out.append(fit(grooved_dome('brain_1', 0xe0c890, 0x8f6f4f, freq=13, amp=0.05, seed=4), 1.0, 0.45))
    # Massive Porites: cream/tan lumpy boulders.
    out.append(fit(lumpy_dome('porites_0', 0xe8d6a8, 0xb8a27a, seed=3), 2.0, 0.95))
    out.append(fit(lumpy_dome('porites_1', 0xd8c8b8, 0xa89488, seed=8), 1.8, 0.85))
    # Table Acropora: olive/teal plate with a pale growing rim on a short stalk.
    out.append(fit(table('table_0', 0x7fb8a8, 0xf0e6b8, 0x8c8a78), 1.6, 0.52))
    out.append(fit(table('table_1', 0x9aa86a, 0xf4ecc4, 0x8a8470), 1.5, 0.5))
    # Foliose plate coral (Montipora / Turbinaria): upturned scrolls.
    out.append(fit(scroll_plates('plate_0', 0x6f8f6a, 0xd6e6a0, seed=2), 1.0, 0.55))
    out.append(fit(scroll_plates('plate_1', 0x7a6a9a, 0xc8b8e8, seed=5), 0.95, 0.55))
    # Leather coral (Sarcophyton): cream-olive folded cap.
    out.append(fit(mushroom('leather_0', 0xd8cc98, 0xbab088, rim=0xece4c0), 0.8, 0.3))
    out.append(fit(mushroom('leather_1', 0xa8c4a0, 0x98a888, rim=0xd0e4c8, folds=9), 0.75, 0.28))
    # Soft tree corals (Dendronephthya): bubbly pastel bunches.
    out.append(fit(bubbles('softcoral_0', 3, [0xb48ee0, 0xd9a3e8, 0x8f7fd6]), 0.4, 0.55))
    out.append(fit(bubbles('softcoral_1', 5, [0xf2a0b8, 0xffd27a, 0xf6b0c8]), 0.4, 0.55))
    # Barrel sponge (Xestospongia): big reddish-brown barrel with ridges.
    out.append(fit(vase('barrel_0', [(0.28, 0), (0.36, 0.25), (0.4, 0.55), (0.36, 0.8)], 0xb87a6a, 0x7a4a40, rim=0xd09a88, wobble=0.07, lobes=9), 0.8, 0.8))
    # Sea fan (gorgonian): a flat fan of fine branches, orange-red.
    out.append(fit(branching('seafan_0', 31, 0xc8563c, 0xffa070, stems=7, length=0.22, radius=0.03, depth=5, spread=1.1, flatten=1.0, res=0.016, upward=(0.25, 0.55), jitter=1.0, taper=0.15, shrink=0.9, corallites=False, max_tris=3000), 1.6, 1.25))
    # Reef rock: grey-lilac (pink coralline crusts).
    out.append(fit(pebble('rock_0', (1.0, 0.8, 0.55), 1, top=0xc6c0cc, base=0x8e8898), 1.1, 0.45))
    out.append(fit(pebble('rock_1', (0.8, 0.7, 0.7), 2, top=0xbcc4cc, base=0x86909a), 1.0, 0.45))
    out.append(fit(pebble('rock_2', (1.2, 0.9, 0.45), 3, top=0xcab8c0, base=0x8f8088), 1.1, 0.4))
    out.append(fit(anemone('anemone_0', 3), 0.9, 0.3))
    out.append(fit(cots('cots_0', 4), 0.5, 0.1))
    out.append(fit(prickly_redfish('seacucumber_0', 5), 0.56, 0.14))
    out += [blue_sea_star('blueseastar_0'), christmas_tree_worm('xmasworm_0')]
    return out

# ---------------------------------------------------------------- NSW rocky reef & kelp (Illawarra)
def kelp_plant(name, seed, height=1.0):
    """Golden kelp (Ecklonia radiata): a stiff stipe, then a long central blade (primary lamina) with paired,
    strap-like lateral blades along both edges, drooping in the swell. Golden- to olive-brown, darker at the base."""
    rnd = random.Random(seed)
    stipe_h = height * rnd.uniform(0.4, 0.55)
    lean = Vector((rnd.uniform(-0.15, 0.15), rnd.uniform(-0.15, 0.15), 1)).normalized()
    top = lean * stipe_h
    parts = [tube((0, 0, 0), top, 0.03, 0.022, 8)]
    a = rnd.uniform(0, math.tau); L = height * 0.75
    ts = [k / 10 for k in range(11)]
    centre = [top + Vector((math.cos(a) * L * t * 0.7, math.sin(a) * L * t * 0.7, L * (0.55 * math.sin(t * math.pi * 0.75) - 0.25 * t * t))) for t in ts]
    parts.append(strap(centre, [0.13 * math.sin(math.pi * min(1, 0.1 + t * 0.95)) ** 0.5 + 0.03 for t in ts], thick=0.02, twist=rnd.uniform(-0.4, 0.4)))
    for k in range(2, 10, 2):
        t = k / 10; c = centre[k]
        d_main = (centre[min(k + 1, 10)] - centre[k - 1]).normalized()
        side = d_main.cross(Vector((0, 0, 1)))
        if side.length < 1e-3: side = Vector((1, 0, 0))
        side.normalize()
        ln = height * (0.18 + 0.32 * math.sin(math.pi * t)) * rnd.uniform(0.85, 1.1)
        us = [m / 6 for m in range(7)]
        for sgn in (-1, 1):
            out = (side * sgn * 0.85 + d_main * 0.35 + Vector((0, 0, -0.25))).normalized()
            pts = [c + out * ln * u + Vector((0, 0, -0.18 * ln * u * u)) for u in us]
            parts.append(strap(pts, [0.085 * math.sin(math.pi * min(1, 0.15 + u * 0.9)) ** 0.6 + 0.02 for u in us], thick=0.016, twist=rnd.uniform(-0.5, 0.5)))
    o = join(parts, name); budget(o, 2600)
    base, gold = srgb(0x4a3418), srgb(0x9a7234)
    vcolor(o, lambda co, n: mix(base, gold, smoothstep(stipe_h * 0.6, stipe_h + height * 0.4, co.z + math.hypot(co.x, co.y) * 0.4)) if co.z > stipe_h * 0.8 else srgb(0x3e2c14))
    return finish(o, name)

def crayweed_plant(name, seed):
    """Crayweed (Phyllospora comosa): tall, bushy olive-brown strands with short leaflets."""
    rnd = random.Random(seed)
    parts = []
    for s in range(5):
        a = rnd.uniform(0, math.tau); H = rnd.uniform(1.1, 1.6)
        pts = [Vector((math.cos(a) * 0.25 * t * H + math.sin(t * 5 + s) * 0.05, math.sin(a) * 0.25 * t * H, t * H)) for t in [i / 10 for i in range(11)]]
        parts.append(strap(pts, [0.06] * 11, thick=0.025, twist=1.5))
        for i in range(2, 10, 2):
            d = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0.4)).normalized()
            parts.append(strap([pts[i], pts[i] + d * 0.16], [0.05, 0.02], thick=0.014))
    o = join(parts, name); budget(o, 2000)
    lo_c, hi_c = srgb(0x4f4520), srgb(0x9a8a3a)
    vcolor(o, lambda co, n: mix(lo_c, hi_c, smoothstep(0.0, 1.5, co.z)))
    return finish(o, name)

def rocky():
    out = []
    out += [fit(kelp_plant(f'kelp_{i}', 40 + i * 7), 1.4, 1.1) for i in range(4)]
    out += [fit(crayweed_plant(f'crayweed_{i}', 60 + i), 0.6, 1.6) for i in range(2)]
    out.append(fit(fingers('fingersponge_0', 5, 0xe08a30, 0xffc070), 0.4, 0.5))
    out.append(fit(fingers('fingersponge_1', 9, 0xd8b030, 0xfff090, count=5), 0.35, 0.45))
    out.append(fit(vase('vasesponge_0', [(0.12, 0), (0.16, 0.15), (0.24, 0.35), (0.26, 0.42)], 0xe07a3a, 0xa04a2a, rim=0xf0a060), 0.5, 0.42))
    out.append(fit(vase('vasesponge_1', [(0.1, 0), (0.15, 0.2), (0.2, 0.4), (0.22, 0.48)], 0xd8c8a0, 0x988868, rim=0xf0e4c4, lobes=3), 0.45, 0.48))
    # Sandstone boulders, turf-dusted (grey-brown, olive tops).
    out.append(fit(pebble('boulder_0', (1.0, 0.85, 0.6), 4, top=0x8f9468, base=0x6f665c), 1.1, 0.55))
    out.append(fit(pebble('boulder_1', (1.1, 0.8, 0.5), 6, top=0x9a9070, base=0x726a60), 1.1, 0.5))
    out.append(fit(pebble('boulder_2', (0.9, 0.9, 0.7), 9, top=0x8a9070, base=0x6a645a), 1.0, 0.6))
    out.append(fit(longspine_urchin('urchin_0', 6), 0.45, 0.3))
    out.append(fit(abalone_shell('abalone_0', 7), 0.22, 0.045))
    out.append(fit(cunjevoi_clump('cunjevoi_0', 8), 0.32, 0.17))
    out += [seadragon('seadragon_0'), octopus('octopus_0'), rock_lobster('rocklobster_0')]
    # Beach and rock platform: smooth-handed ghost crab (pale sand colour, tall eye stalks) and Waratah anemone (closed at low tide).
    out += [crab('crab_ghost', 0xe8d8b0, 0xdccca4, 0.05, 1.2), fit(waratah('waratah_0'), 0.07, 0.035)]
    return out

# ---------------------------------------------------------------- Moreton Bay seagrass & mangroves
def eelgrass(name, seed, blades=16):
    """Zostera muelleri: a clump of soft, thick ribbon blades."""
    rnd = random.Random(seed)
    parts = []
    for b in range(blades):
        a = rnd.uniform(0, math.tau); r = rnd.uniform(0, 0.25); H = rnd.uniform(0.3, 0.5); lean = rnd.uniform(0.2, 0.7)
        p0 = Vector((math.cos(a) * r, math.sin(a) * r, 0))
        pts = [p0 + Vector((math.cos(a) * lean * H * t * t, math.sin(a) * lean * H * t * t, H * t)) for t in [i / 6 for i in range(7)]]
        parts.append(strap(pts, [0.03] * 6 + [0.012], thick=0.008, twist=rnd.uniform(-0.8, 0.8)))
    o = join(parts, name); budget(o, 1600)
    lo_c, hi_c = srgb(0x3f7a3a), srgb(0x9ad06a)
    vcolor(o, lambda co, n: mix(lo_c, hi_c, smoothstep(0.0, 0.45, co.z)))
    return finish(o, name)

def paddleweed(name, seed):
    """Halophila ovalis: pairs of small oval leaves on short stalks along a runner."""
    rnd = random.Random(seed)
    parts = []
    for i in range(7):
        x = (i - 3) * 0.07; y = rnd.uniform(-0.05, 0.05)
        for s in (-1, 1):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.02, location=(x + s * 0.012, y + s * 0.02, 0.025))
            l = bpy.context.active_object; l.scale = (0.7, 1.25, 0.25); l.rotation_euler = (0.4 * s, 0, rnd.uniform(-0.6, 0.6))
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); parts.append(l)
        parts.append(tube((x, y, 0), (x, y, 0.025), 0.003, 0.002, 4))
    o = join(parts, name); budget(o, 900)
    vcolor(o, lambda co, n: mix(srgb(0x4f8a3a), srgb(0xa8d878), smoothstep(0.0, 0.03, co.z)))
    return finish(o, name)

def mangrove_tree(name, seed):
    """Grey mangrove (Avicennia marina): pale grey trunk and rounded grey-green canopy."""
    rnd = random.Random(seed)
    elems = []
    trunk_top = Vector((rnd.uniform(-0.2, 0.2), rnd.uniform(-0.2, 0.2), 2.4))
    for i in range(34): elems.append((trunk_top * (i / 33), 0.2 - 0.06 * i / 33))
    for k in range(5):
        a = k / 5 * math.tau
        end = trunk_top + Vector((math.cos(a) * 1.2, math.sin(a) * 1.2, rnd.uniform(0.3, 0.9)))
        for i in range(16): elems.append((trunk_top.lerp(end, i / 15), 0.12 - 0.03 * i / 15))
    trunk = metaball_mesh(name + '_t', elems, resolution=0.06)
    blobs = []
    for k in range(9):
        a, r = rnd.uniform(0, math.tau), rnd.uniform(0.3, 1.5)
        blobs.append((trunk_top + Vector((math.cos(a) * r, math.sin(a) * r, rnd.uniform(0.6, 1.6))), rnd.uniform(0.7, 1.0)))
    canopy = metaball_mesh(name + '_c', blobs, resolution=0.12)
    o = join([trunk, canopy], name); budget(o, 2600)
    bark, leaf_lo, leaf_hi = srgb(0xa8a49a), srgb(0x5f7a58), srgb(0x9ab090)
    vcolor(o, lambda co, n: bark if co.z < 2.6 and math.hypot(co.x, co.y) < 0.35 else mix(leaf_lo, leaf_hi, smoothstep(-0.3, 0.8, n.z)))
    return finish(o, name)

def pegs(name, seed, count=18):
    """Pneumatophores: pencil-like breathing roots poking up from the mud around a mangrove."""
    rnd = random.Random(seed)
    parts = []
    for i in range(count):
        a, r = rnd.uniform(0, math.tau), rnd.uniform(0.05, 0.7)
        x, y, h = math.cos(a) * r, math.sin(a) * r, rnd.uniform(0.15, 0.32)
        parts.append(tube((x, y, 0), (x + rnd.uniform(-0.03, 0.03), y + rnd.uniform(-0.03, 0.03), h), 0.022, 0.012, 7))
        bpy.ops.mesh.primitive_uv_sphere_add(segments=7, ring_count=4, radius=0.012, location=parts[-1].data.vertices[0].co * 0 + Vector((x, y, h))); parts.append(bpy.context.active_object)
    o = join(parts, name)
    vcolor(o, lambda co, n: mix(srgb(0x5a4a3a), srgb(0x9a8a72), smoothstep(0.0, 0.3, co.z)))
    return finish(o, name)

def seagrass():
    out = [fit(eelgrass(f'zostera_{i}', 70 + i), 1.2, 0.48) for i in range(3)]
    out += [fit(paddleweed(f'halophila_{i}', 80 + i), 0.5, 0.05) for i in range(2)]
    out += [fit(mangrove_tree(f'mangrove_{i}', 90 + i), 4.5, 5.6) for i in range(3)]
    out += [fit(pegs(f'pneumato_{i}', 95 + i), 1.5, 0.34) for i in range(2)]
    out += [seahorse('seahorse_0'), crab('crab_blueswimmer', 0x3a6ad0, 0x6a9ae0, 0.1, 1.1), crab('crab_mud', 0x3f4a30, 0x5a6040, 0.13, 1.5),
            crab('crab_soldier', 0x8ab8ff, 0xb070c0, 0.03, 0.6), seahare('seahare_0'),
            jelly('jelly_blubber', 0.2, 0.75, 0xd8d0e8, 0xf0e8ff, arms=8, arm_len=1.6)]
    return out

def pelagic():
    return [bluebottle('bluebottle_0'), salp_chain('salp_0'),
            jelly('jelly_moon', 0.18, 0.4, 0xd8e0f2, 0xf2f2ff, arms=4, arm_len=1.2, tentacles=24, tent_len=0.6, ring=0xe0b8e8)]

# ---------------------------------------------------------------- Tasmanian seamount (deep sea)
def deep():
    out = []
    # Solenosmilia variabilis reef: fine, bushy, pale peach-white branches.
    out += [fit(branching(f'deepcoral_{i}', 101 + i, 0xd8b8a8, 0xfff0e8, stems=7, length=0.18, radius=0.045, depth=4, spread=0.9, res=0.02, jitter=1.1, taper=0.15, shrink=0.88, max_tris=2600), 0.85, 0.46) for i in range(3)]
    # Bamboo coral (Isididae): white calcite segments with dark nodes.
    def bamboo(name, seed):
        o = branching(name, seed, 0xf2eee6, 0xffffff, stems=1, length=0.6, radius=0.035, depth=3, spread=0.15, res=0.02, upward=(0.6, 1.0), jitter=0.5, taper=0.15, shrink=0.88, corallites=False, max_tris=1800)
        vcolor(o, lambda co, n: srgb(0x5a3a2a) if (co.z * 9) % 1 < 0.12 else srgb(0xf0ece4))
        return o
    out += [fit(bamboo(f'bamboo_{i}', 111 + i), 0.7, 1.7) for i in range(2)]
    out.append(fit(vase('glasssponge_0', [(0.08, 0), (0.12, 0.25), (0.15, 0.55), (0.14, 0.75)], 0xe8e0c8, 0xb8b098, rim=0xfff8e8, lobes=6, wobble=0.05), 0.36, 0.75))
    out += [fit(pebble(f'deeprock_{i}', (1.0, 0.8, 0.55), 20 + i, top=0x5a5650, base=0x3a3834), 1.1, 0.45) for i in range(2)]
    out += [vampire_squid('vampiresquid_0'), jelly('jelly_atolla', 0.12, 0.35, 0x80141c, 0xb02030, tentacles=20, tent_len=1.5, ring=0x4a90ff),
            siphonophore('siphonophore_0'), comb_jelly('combjelly_0'), isopod('isopod_0'), brittle_star('brittlestar_0')]
    return out

for site in SITES:
    reset()
    objs = globals()[site]()
    if PREVIEW: preview(objs, os.path.join(ROOT, 'playtest-shots', f'blender-{site}.png'), sky=0x9fd8e8 if site != 'deep' else 0x203040, ground=0xead7ad if site != 'deep' else 0x504840)
    small = [o for o in objs if max(o.dimensions) < 1.25 and o.name.split('_')[0] in ('seadragon', 'octopus', 'rocklobster', 'seahorse', 'crab', 'seahare', 'jelly', 'bluebottle', 'salp', 'vampiresquid', 'siphonophore', 'combjelly', 'isopod', 'brittlestar', 'anemone', 'cots', 'seacucumber', 'urchin', 'abalone', 'cunjevoi')]
    if PREVIEW and small:
        for o in small:
            if o.name.startswith('jelly') or o.name.startswith('bluebottle'): o.scale = (0.6, 0.6, 0.6)
        preview(small, os.path.join(ROOT, 'playtest-shots', f'blender-{site}-small.png'), sky=0x9fd8e8 if site != 'deep' else 0x405060, ground=0xead7ad if site != 'deep' else 0x706860, cols=4, spacing=0.75)
        for o in small: o.scale = (1, 1, 1)
    lows = [lo(o) for o in objs if tris(o) > 1200]
    export(objs + lows, os.path.join(ROOT, 'assets', 'models', f'{site}_cosy.glb'))
