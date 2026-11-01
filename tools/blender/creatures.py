# Cosy-style small animals (inverts, seahorses, jellies) for build_sets.py. Conventions match the game's
# procedural versions: head toward +X, base at z = 0 for bottom-dwellers, bell top at z = 0 for jellies,
# siphonophore colony trailing along -X from its float at the origin.
import bpy, math, random
from mathutils import Vector
from cosylib import *

def ellipsoid(c, r, s=(1, 1, 1), seg=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=max(6, seg // 2), radius=r, location=c)
    o = bpy.context.active_object; o.scale = s; bpy.ops.object.transform_apply(scale=True)
    return o

def cosy_eye(c, r, side):
    """Big dark eye with a white highlight (matches the cosy fish)."""
    e = ellipsoid(c, r, seg=12)
    h = ellipsoid((c[0] + r * 0.35, c[1] + side * r * 0.7, c[2] + r * 0.4), r * 0.32, seg=8)
    return [e, h]

def colour_eyes(base_fn, eyes):
    """Wrap a colour function so vertices inside eye spheres are black / white highlights."""
    def f(co, n):
        for (c, r, hl) in eyes:
            if (co - Vector(hl)).length < r * 0.36: return (1, 1, 1)
            if (co - Vector(c)).length < r * 1.02: return srgb(0x141414)
        return base_fn(co, n)
    return f

def eye_pair(x, y, z, r):
    parts, spec = [], []
    for s in (-1, 1):
        c = (x, s * y, z); hl = (x + r * 0.35, s * (y + r * 0.7), z + r * 0.4)
        parts += cosy_eye(c, r, s); spec.append((Vector(c), r, hl))
    return parts, spec

# ---------------------------------------------------------------- rocky reef
def seadragon(name):
    """Weedy seadragon (Phyllopteryx taeniolatus): red body with yellow spots, purple bars, leafy appendages."""
    rnd = random.Random(1)
    elems = []
    for i in range(30):
        t = i / 29; x = 0.3 - t * 0.52
        z = 0.02 + 0.025 * math.sin(t * math.pi) - (0.04 * (t - 0.7) / 0.3 if t > 0.7 else 0)
        r = 0.012 + 0.014 * math.sin(math.pi * min(1, t * 1.6)) if t > 0.12 else 0.006
        elems.append((Vector((x, 0, z)), r * 1.6))
    body = metaball_mesh(name + '_b', elems, resolution=0.006)
    leaves = []
    for x in (0.12, 0.02, -0.08, -0.17):
        for s in (-1, 1):
            leaves.append(ellipsoid((x, s * 0.02, 0.05 + rnd.uniform(0, 0.02)), 0.02, (1.2, 0.25, 0.8), 10))
    eyes, spec = eye_pair(0.2, 0.011, 0.034, 0.006)
    o = join([body] + leaves + eyes, name)
    def col(co, n):
        if abs(co.y) > 0.012 and co.z > 0.045: return srgb(0xd8a048)                        # leafy appendages
        if 0.08 < co.x < 0.16 and co.z < 0.04: return srgb(0x6a5ac8)                       # purple chest bars
        if (math.sin(co.x * 180) * math.sin(co.z * 160)) > 0.75: return srgb(0xffe060)     # yellow spots
        return srgb(0xd0503a)
    vcolor(o, colour_eyes(col, spec))
    return finish(o, name)

def octopus(name):
    """Common Sydney octopus (Octopus tetricus): grey-brown mantle, white-ringed eyes, eight curling arms."""
    elems = [(Vector((-0.06, 0, 0.16)), 0.12), (Vector((-0.12, 0, 0.2)), 0.1), (Vector((0.04, 0, 0.08)), 0.08)]
    for k in range(8):
        a = k / 8 * math.tau + 0.2
        for s in range(1, 14):
            t = s / 13; r = 0.06 + t * 0.32; curl = max(0, t - 0.6) * 3
            elems.append((Vector((0.04 + math.cos(a + curl) * r, math.sin(a + curl) * r, 0.025 + 0.02 * math.sin(t * math.pi))), 0.045 * (1 - 0.75 * t)))
    body = metaball_mesh(name + '_b', elems, resolution=0.014)
    eyes, spec = eye_pair(0.05, 0.06, 0.13, 0.022)
    o = join([body] + eyes, name); budget(o, 2600)
    vcolor(o, colour_eyes(lambda co, n: mix(srgb(0x8a6a5a), srgb(0xc8a08a), smoothstep(0.02, 0.2, co.z)), spec))
    return finish(o, name)

def rock_lobster(name):
    """Eastern rock lobster (Sagmariasus verreauxi): green-olive spiny body, long antennae, no big claws."""
    elems = [(Vector((x, 0, 0.1)), 0.09 - abs(x - 0.15) * 0.08) for x in [i * 0.04 - 0.1 for i in range(9)]]
    elems += [(Vector((-0.12 - i * 0.05, 0, 0.08 - i * 0.008)), 0.065 - i * 0.008) for i in range(6)]
    body = metaball_mesh(name + '_b', elems, resolution=0.016)
    parts = [body]
    for s in (-1, 1):
        parts.append(tube((0.22, s * 0.04, 0.13), (0.45, s * 0.2, 0.18), 0.018, 0.012, 6))
        parts.append(tube((0.45, s * 0.2, 0.18), (0.73, s * 0.28, 0.12), 0.012, 0.004, 6))
        for i in range(5):
            x = 0.12 - i * 0.05
            parts.append(tube((x, s * 0.05, 0.07), (x + 0.02, s * 0.2, 0.0), 0.012, 0.008, 5))
    eyes, spec = eye_pair(0.24, 0.035, 0.15, 0.014)
    o = join(parts + eyes, name); budget(o, 2400)
    vcolor(o, colour_eyes(lambda co, n: mix(srgb(0x4a6a3a), srgb(0x9aa86a), smoothstep(0.06, 0.18, co.z)), spec))
    return finish(o, name)

# ---------------------------------------------------------------- seagrass
def seahorse(name):
    """White's seahorse (Hippocampus whitei): upright, curled tail, tube snout; brown-yellow."""
    elems = []
    for i in range(24):
        t = i / 23
        if t < 0.55:   # body, leaning forward
            p = Vector((0.012 + 0.01 * math.sin(t * 5), 0, 0.02 + t * 0.12)); r = 0.012 * math.sin(math.pi * (0.25 + t * 1.2)) + 0.006
        else:           # curled tail below
            a = (t - 0.55) / 0.45 * math.pi * 1.4
            p = Vector((0.0 + 0.02 * math.sin(a), 0, 0.02 - 0.02 * (1 - math.cos(a)) * 0.9)); r = 0.006 * (1 - (t - 0.55))
        elems.append((p, r * 1.5))
    elems += [(Vector((0.02, 0, 0.088)), 0.016), (Vector((0.035, 0, 0.09)), 0.008), (Vector((0.045, 0, 0.09)), 0.006)]
    body = metaball_mesh(name + '_b', elems, resolution=0.004)
    for v in body.data.vertices: v.co.z -= 0.03
    eyes, spec = eye_pair(0.026, 0.01, 0.065, 0.004)
    o = join([body] + eyes, name)
    vcolor(o, colour_eyes(lambda co, n: mix(srgb(0x8a6a3a), srgb(0xe0b860), smoothstep(-0.04, 0.07, co.z)), spec))
    return finish(o, name)

def crab(name, shell, legs, size=0.12, claw=1.0):
    """Swimming / mud / soldier crabs: a rounded shell, jointed legs and claws, big stalked eyes."""
    S = size
    parts = [ellipsoid((0, 0, S * 0.5), S, (1.0, 1.35, 0.5), 18)]
    for s in (-1, 1):
        for i in range(4):
            base = Vector(((i - 1.5) * S * 0.45, s * S * 0.9, S * 0.5)); knee = base + Vector(((i - 1.5) * S * 0.2, s * S * 0.55, S * 0.35))
            foot = knee + Vector(((i - 1.5) * S * 0.2, s * S * 0.45, -S * 0.82))
            parts += [tube(base, knee, S * 0.08, S * 0.07, 6), tube(knee, foot, S * 0.07, S * 0.03, 6)]
        sh = Vector((S * 0.85, s * S * 0.6, S * 0.5)); el = sh + Vector((S * 0.45, s * S * 0.35, S * 0.15))
        parts.append(tube(sh, el, S * 0.1, S * 0.09, 6))
        parts.append(ellipsoid((el.x + S * 0.3 * claw, el.y, el.z), S * 0.28 * claw, (1.6, 0.8, 0.9), 12))
    eyes, spec = eye_pair(S * 0.9, S * 0.3, S * 0.95, S * 0.12)
    o = join(parts + eyes, name); budget(o, 2000)
    sh_c, lg_c = srgb(shell), srgb(legs)
    vcolor(o, colour_eyes(lambda co, n: sh_c if (co.x / 1.0) ** 2 + (co.y / 1.35) ** 2 < (S * 1.05) ** 2 and co.z > S * 0.3 else lg_c, spec))
    return finish(o, name)

def seahare(name):
    """Sea hare (Aplysia): soft olive-brown slug with ear-like rhinophores and wing-like parapodia."""
    elems = [(Vector((x, 0, 0.05)), 0.055 * math.sin(math.pi * (x + 0.14) / 0.3 * 0.9 + 0.15)) for x in [i * 0.02 - 0.13 for i in range(15)]]
    elems += [(Vector((0.16, s * 0.025, 0.1)), 0.018) for s in (-1, 1)]
    o = metaball_mesh(name, elems, resolution=0.008)
    for v in o.data.vertices: v.co.z = max(v.co.z, 0.002)
    budget(o, 1500)
    vcolor(o, lambda co, n: srgb(0xc8b070) if (math.sin(co.x * 120) * math.sin(co.y * 140)) > 0.8 else mix(srgb(0x5a5a2a), srgb(0x8a7a3a), smoothstep(0.0, 0.1, co.z)))
    return finish(o, name)

def jelly(name, radius, dome, bell, rim, arms=0, arm_len=0.0, tentacles=0, tent_len=0.0, ring=None, seed=1):
    """Medusa with bell top at z = 0: dome, frilly oral arms and/or fine tentacles, optional gonad ring."""
    rnd = random.Random(seed)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=14, radius=radius, location=(0, 0, 0))
    b = bpy.context.active_object
    for v in b.data.vertices:
        if v.co.z < 0: v.co.z *= 0.12
        else: v.co.z *= dome
        v.co.z -= radius * dome
    b.data.update()
    parts = [b]
    for k in range(arms):
        a = k / arms * math.tau
        elems = [(Vector((math.cos(a) * radius * 0.25 + math.sin(t * 9) * 0.02, math.sin(a) * radius * 0.25, -radius * dome - t * arm_len * radius)), radius * 0.16 * (1 - 0.6 * t)) for t in [i / 12 for i in range(13)]]
        parts.append(metaball_mesh(f'{name}_a{k}', elems, resolution=radius * 0.06))
    for k in range(tentacles):
        a = k / tentacles * math.tau
        p0 = Vector((math.cos(a) * radius * 0.95, math.sin(a) * radius * 0.95, -radius * dome))
        parts.append(tube(p0, p0 + Vector((rnd.uniform(-0.02, 0.02), rnd.uniform(-0.02, 0.02), -tent_len * radius)), radius * 0.02, radius * 0.008, 4))
    o = join(parts, name); budget(o, 2600)
    bc, rc = srgb(bell), srgb(rim)
    gc = srgb(ring) if ring else None
    def col(co, n):
        r = math.hypot(co.x, co.y)
        if gc and co.z > -radius * dome * 0.6 and abs(r - radius * 0.35) < radius * 0.12: return gc
        return mix(bc, rc, smoothstep(radius * 0.6, radius, r)) if co.z > -radius * dome * 1.3 else rc
    vcolor(o, col)
    return finish(o, name)

# ---------------------------------------------------------------- pelagic
def bluebottle(name):
    """Bluebottle (Physalia utriculus): blue gas float with a crest, one long blue fishing tentacle."""
    f = ellipsoid((0, 0, 0.0), 0.05, (1.8, 0.9, 0.8), 18)
    crest = ellipsoid((0, 0, 0.035), 0.04, (1.6, 0.18, 0.7), 14)
    t = tube((0.03, 0, -0.03), (0.04, 0, -1.7), 0.008, 0.003, 6)
    o = join([f, crest, t], name)
    vcolor(o, lambda co, n: mix(srgb(0x3a7ae0), srgb(0xb8e0ff), smoothstep(-0.02, 0.06, co.z)) if co.z > -0.04 else srgb(0x2a5ad0))
    return finish(o, name)

def salp_chain(name, n=8):
    """Salp chain: clear barrel-shaped zooids linked in a line, each with a small orange gut."""
    parts = []
    for i in range(n):
        x = i * 0.065
        parts.append(ellipsoid((x, 0, 0), 0.03, (1.3, 0.9, 0.9), 12))
        parts.append(ellipsoid((x + 0.01, 0, -0.01), 0.008, seg=8))
    o = join(parts, name)
    vcolor(o, lambda co, n: srgb(0xe08a3a) if abs(co.z + 0.01) < 0.009 and abs(co.y) < 0.009 else srgb(0xd0e8f0))
    return finish(o, name)

# ---------------------------------------------------------------- deep sea
def vampire_squid(name):
    """Vampire squid (Vampyroteuthis infernalis): dark red-black, webbed 'cloak' between arms, big blue eyes, ear-like fins."""
    elems = [(Vector((0.02, 0, 0)), 0.07), (Vector((-0.04, 0, 0)), 0.06)]
    for k in range(8):
        a = k / 8 * math.tau
        for s in range(1, 7): elems.append((Vector((0.06 + s * 0.012, math.cos(a) * s * 0.018, math.sin(a) * s * 0.018)), 0.04))
    for s in (-1, 1): elems.append((Vector((-0.07, s * 0.06, 0.01)), 0.03))
    body = metaball_mesh(name + '_b', elems, resolution=0.01)
    eyes = []
    for s in (-1, 1): eyes.append(ellipsoid((0.04, s * 0.05, 0.02), 0.018, seg=12))
    o = join([body] + eyes, name); budget(o, 1800)
    vcolor(o, lambda co, n: srgb(0x60b0ff) if abs(abs(co.y) - 0.05) < 0.02 and abs(co.x - 0.04) < 0.02 and abs(co.z - 0.02) < 0.02 else mix(srgb(0x3a0a12), srgb(0x7a1a28), smoothstep(-0.05, 0.05, co.z)))
    return finish(o, name)

def siphonophore(name, length=4.8, n=26):
    """Siphonophore colony: a gas float at the front, then a long string of clear swimming bells and pink feeding parts."""
    parts = [ellipsoid((0.0, 0, 0.12), 0.05, (1.4, 1, 1), 12)]
    for i in range(n):
        x = -0.1 - i * length / n
        parts.append(ellipsoid((x, 0, 0.0 + 0.03 * math.sin(i)), 0.06, (1.2, 1, 0.9), 10))
        parts.append(ellipsoid((x - 0.05, 0, -0.08), 0.02, seg=8))
    o = join(parts, name)
    vcolor(o, lambda co, n: srgb(0xf090b0) if co.z < -0.05 else (srgb(0xffa040) if co.z > 0.08 else srgb(0xc8d8f0)))
    return finish(o, name)

def comb_jelly(name):
    """Comb jelly (ctenophore): clear oval with eight rainbow comb rows."""
    o = ellipsoid((0, 0, 0), 0.06, (1, 1, 1.5), 24)
    def col(co, n):
        a = math.atan2(co.y, co.x) * 8 / math.tau
        if abs(a - round(a)) < 0.12: return [srgb(0xff6ad0), srgb(0x6ad0ff), srgb(0xa0ff6a), srgb(0xffe06a)][int(round(a)) % 4]
        return srgb(0xe0eef8)
    vcolor(o, col)
    return finish(o, name)

def isopod(name):
    """Giant isopod (Bathynomus): segmented, armoured, lilac-grey; big compound eyes."""
    parts = []
    for i in range(9):
        x = 0.28 - i * 0.055
        parts.append(ellipsoid((x, 0, 0.045), 0.06, (0.55, 1.9 - abs(i - 4) * 0.12, 0.7), 16))
    parts.append(ellipsoid((-0.24, 0, 0.03), 0.05, (0.7, 1.4, 0.4), 12))
    o = join(parts, name); budget(o, 2000)
    vcolor(o, lambda co, n: srgb(0x2a2030) if co.x > 0.27 and abs(co.y) > 0.04 and co.z > 0.04 else mix(srgb(0x8a7a8a), srgb(0xc8b8c8), smoothstep(0.02, 0.08, co.z)))
    return finish(o, name)

def brittle_star(name):
    """Brittle star (ophiuroid): small round disc with five long, thin, snaking arms; orange-pink."""
    elems = [(Vector((0, 0, 0.012)), 0.035)]
    for k in range(5):
        a = k / 5 * math.tau
        for s in range(1, 16):
            t = s / 15; r = 0.025 + t * 0.15
            elems.append((Vector((math.cos(a + 0.4 * math.sin(t * 4)) * r, math.sin(a + 0.4 * math.sin(t * 4)) * r, 0.008)), 0.011 * (1 - 0.6 * t)))
    o = metaball_mesh(name, elems, resolution=0.004)
    for v in o.data.vertices: v.co.z = max(v.co.z, 0.001)
    budget(o, 1600)
    vcolor(o, lambda co, n: srgb(0xe07a5a) if math.hypot(co.x, co.y) < 0.04 else mix(srgb(0xf0a080), srgb(0xd0604a), (math.hypot(co.x, co.y) * 30) % 1 > 0.5))
    return finish(o, name)

def top_at_zero(o):
    zmax = max(v.co.z for v in o.data.vertices)
    for v in o.data.vertices: v.co.z -= zmax
    o.data.update(); return o

def waratah(name):
    """Waratah anemone (Actinia tenebrosa) at low tide: glossy red dome with a ring of blue acrorhagi."""
    o = ellipsoid((0, 0, 0), 0.035, (1, 1, 0.9), 20)
    for v in o.data.vertices: v.co.z = max(v.co.z, 0.0)
    o.data.update()
    beads = [ellipsoid((math.cos(a) * 0.033, math.sin(a) * 0.033, 0.004), 0.005, seg=8) for a in [k / 12 * math.tau for k in range(12)]]
    o = join([o] + beads, name)
    vcolor(o, lambda co, n: srgb(0x3a6ae0) if co.z < 0.01 and math.hypot(co.x, co.y) > 0.03 else srgb(0xa8121a))
    return finish(o, name)

def blue_sea_star(name):
    """Blue sea star (Linckia laevigata): small disc, five long smooth tubular arms, bright blue."""
    elems = [(Vector((0, 0, 0.015)), 0.035)]
    for k in range(5):
        a = k / 5 * math.tau
        for s in range(1, 12): elems.append((Vector((math.cos(a) * s * 0.012, math.sin(a) * s * 0.012, 0.012)), 0.018 * (1 - 0.35 * s / 11)))
    o = metaball_mesh(name, elems, resolution=0.006)
    for v in o.data.vertices: v.co.z = max(v.co.z, 0.0)
    o.data.update(); budget(o, 1200)
    vcolor(o, lambda co, n: mix(srgb(0x1a4ad8), srgb(0x5a8aff), smoothstep(0.0, 0.025, co.z)))
    return finish(o, name)

def christmas_tree_worm(name):
    """Christmas tree worm (Spirobranchus giganteus): a pair of small spiral crowns, red and orange."""
    parts = []
    for x, c in ((-0.013, 0xe8402a), (0.013, 0xff9a2a)):
        for i in range(7):
            t = i / 6; r = 0.016 * (1 - 0.8 * t)
            bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.0035, major_segments=12, minor_segments=5, location=(x, 0, 0.006 + t * 0.035))
            parts.append(bpy.context.active_object)
    o = join(parts, name)
    vcolor(o, lambda co, n: srgb(0xe8402a) if co.x < 0 else srgb(0xff9a2a))
    return finish(o, name, ao=0.3)
