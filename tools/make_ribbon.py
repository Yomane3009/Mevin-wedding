"""Paint the raw-edged chiffon ribbon and bow as transparent images.

Each piece of the bow (band halves, loops, tails, knot) is its own image so the
page can untie it piece by piece. All images share one frame centred on the knot,
measured in sleeve widths (W): x from -0.56W to 0.56W, y from -0.32W to 0.48W.

    python3 tools/make_ribbon.py   # writes assets/ribbon/*.webp
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

PX = 1000  # pixels per sleeve width
X0, X1, Y0, Y1 = -0.56, 0.56, -0.32, 0.48
WIDTH, HEIGHT = round((X1 - X0) * PX), round((Y1 - Y0) * PX)
OUT = Path(__file__).resolve().parent.parent / "assets" / "ribbon"

COLOUR = np.array([238, 227, 205], dtype=float)  # undyed silk chiffon, from the real card
SHADOW = np.array([196, 178, 150], dtype=float)

gx, gy = np.meshgrid(np.arange(WIDTH) + 0.5, np.arange(HEIGHT) + 0.5)
X = gx / PX + X0
Y = gy / PX + Y0


def noise1(x, seed):
    """Smooth 1-D value noise in [-1, 1]."""
    rng = np.random.default_rng(seed)
    table = rng.uniform(-1, 1, 4096)
    i = np.floor(x).astype(int)
    f = x - i
    f = f * f * (3 - 2 * f)
    return table[i % 4096] * (1 - f) + table[(i + 1) % 4096] * f


def fbm1(x, seed, octaves=4):
    total, amp, norm = 0, 1.0, 0
    for k in range(octaves):
        total = total + amp * noise1(x * 2**k, seed + k)
        norm += amp
        amp *= 0.5
    return total / norm


def noise2(x, y, seed):
    rng = np.random.default_rng(seed)
    table = rng.uniform(-1, 1, (512, 512))
    i, j = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = x - i, y - j
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a = table[j % 512, i % 512]
    b = table[j % 512, (i + 1) % 512]
    c = table[(j + 1) % 512, i % 512]
    d = table[(j + 1) % 512, (i + 1) % 512]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def raw_edge(edge_px, along_px, seed, fringe=13, side=None):
    """Alpha for a torn chiffon edge: a soft unravelled margin with loose fibres."""
    pick = lambda f: f(seed) if side is None else np.where(side, f(seed), f(seed + 1))
    body = smooth(-2.5, 4, edge_px)
    out = np.clip(-edge_px, 0, None)
    # fibres lean and curl a little as they leave the edge
    lean = along_px + out * pick(lambda k: 0.6 * noise1(along_px / 40, k + 3))
    strands = pick(lambda k: noise1(lean / 1.1, k))
    strands = np.clip((strands - 0.5) / 0.5, 0, 1) ** 0.8
    reach = fringe * (0.25 + 0.75 * (0.5 + 0.5 * pick(lambda k: noise1(along_px / 6, k + 7))))
    wisp = strands * np.clip(1 - out / reach, 0, 1) ** 1.2 * (edge_px < 0)
    # the weave loosens just inside and outside the edge
    loose = pick(lambda k: noise1(along_px / 3.5, k + 11)) * 0.5 + 0.5
    halo = 0.3 * loose * np.clip(1 - out / (fringe * 0.45), 0, 1) ** 2 * (edge_px < 0)
    thin = 1 - 0.35 * loose * (1 - smooth(0, 7, edge_px))
    return np.maximum(body * thin, np.maximum(wisp * 0.85, halo))


def fabric(u, v, seed, gather=0.0, folds=5):
    """Brightness and density of the cloth from its soft creases.

    u runs along the ribbon (0 at the knot), v across it (-1..1)."""
    k = 1 + gather * (1 - np.clip(u, 0, 1)) ** 2
    h = np.zeros_like(u)
    dh = np.zeros_like(u)
    rng = np.random.default_rng(seed)
    for n in range(folds):
        f = rng.uniform(0.6, 2.4) * k
        ph = rng.uniform(0, 2 * np.pi)
        wander = 0.35 * fbm1(u * rng.uniform(2, 5) + n * 17, seed + n, 3)
        a = rng.uniform(0.4, 1.0) / (1 + n * 0.3)
        arg = np.pi * f * (v + wander) + ph
        h += a * np.sin(arg)
        dh += a * np.cos(arg)
    h /= folds * 0.45
    dh /= folds * 0.45
    weave = noise2(gx / 1.3, gy / 1.3, seed + 99) * 0.5 + noise2(gx / 5, gy / 5, seed + 98) * 0.5
    # crumples: chiffon never lies flat
    crumple = noise2(u * 14 + seed, v * 3.2 + seed, seed + 50) + 0.5 * noise2(u * 31, v * 7, seed + 51)
    light = 0.95 + 0.05 * h + 0.07 * dh + 0.02 * weave + 0.045 * crumple
    density = 0.8 + 0.12 * np.clip(h, -1, 1) + 0.06 * weave
    return light, density


def layer(alpha, light, opacity):
    alpha = np.clip(alpha * opacity, 0, 1)
    shade = np.clip(light, 0.6, 1.08)
    t = np.clip((1 - shade) / 0.35, 0, 1)[..., None]
    rgb = COLOUR * (1 - t) + SHADOW * t
    rgb = rgb * np.clip(shade, 1, 1.08)[..., None]
    return np.dstack([np.clip(rgb, 0, 255), alpha * 255])


def over(top, bottom):
    ta, ba = top[..., 3:] / 255, bottom[..., 3:] / 255
    oa = ta + ba * (1 - ta)
    rgb = (top[..., :3] * ta + bottom[..., :3] * ba * (1 - ta)) / np.maximum(oa, 1e-6)
    return np.dstack([rgb, oa * 255])


def bezier(p, n=400):
    t = np.linspace(0, 1, n)[:, None]
    p = [np.array(q, float) for q in p]
    return (1 - t) ** 3 * p[0] + 3 * (1 - t) ** 2 * t * p[1] + 3 * (1 - t) * t**2 * p[2] + t**3 * p[3]


def strip(path, half_width, seed, opacity=0.8, gather=0.0, torn_end=False, folds=5):
    """A length of ribbon laid along a centre line (W units), raw edges both sides."""
    pts = bezier(path)
    seg = np.diff(pts, axis=0)
    length = np.concatenate([[0], np.cumsum(np.hypot(seg[:, 0], seg[:, 1]))])
    tang = np.gradient(pts, axis=0)
    tang /= np.hypot(tang[:, 0], tang[:, 1])[:, None]
    total = length[-1]

    # nearest point on the centre line, refined along the local tangent
    best = np.full(X.shape, np.inf)
    idx = np.zeros(X.shape, int)
    for i in range(0, len(pts), 2):
        d = (X - pts[i, 0]) ** 2 + (Y - pts[i, 1]) ** 2
        m = d < best
        best[m], idx[m] = d[m], i
    px, py = pts[idx, 0], pts[idx, 1]
    tx, ty = tang[idx, 0], tang[idx, 1]
    dx, dy = X - px, Y - py
    s = length[idx] + dx * tx + dy * ty
    across = dx * -ty + dy * tx
    u = np.clip(s / total, 0, 1)

    hw = half_width(u) * (1 + 0.05 * fbm1(s * 40, seed + 1) + 0.07 * fbm1(s * 6, seed + 3)) + 0.004 * fbm1(s * 12, seed + 2)
    v = across / hw
    edge = (hw - np.abs(across)) * PX
    along = s * PX
    alpha = raw_edge(edge, along, seed * 10, side=across > 0)

    start = s * PX + 2  # the knot end hides under the knot
    alpha *= smooth(-2, 2, start)
    if torn_end:
        tear = (total - s) * PX + 14 * fbm1(across * 60, seed + 5) + 6
        alpha *= raw_edge(tear, across * PX, seed + 6, fringe=20)
    else:
        alpha *= smooth(-2, 1, (total - s) * PX)

    light, density = fabric(u, v, seed, gather, folds)
    return layer(alpha * density, light, opacity)


def lobe(direction, length, spread, seed, tilt=0.0, tone=1.0, opacity=0.95):
    """One loop of the bow: a soft puff of folded chiffon gathered at the knot.

    The rounded end is the fold, the two sides are the raw edges."""
    ang = np.arctan2(Y, X)
    r = np.hypot(X, Y)
    rel = (ang - direction + np.pi) % (2 * np.pi) - np.pi
    t = rel / spread
    asym = 1 + tilt * t
    reach = length * asym * np.sqrt(np.clip(1 - np.abs(t) ** 2.4, 0, 1)) * (1 + 0.03 * fbm1(t * 6, seed))
    reach = np.maximum(reach, 1e-4)
    u = r / reach

    side_edge = (spread - np.abs(rel)) * r * PX
    along = r * PX
    alpha = raw_edge(side_edge, along, seed * 10, fringe=10, side=rel > 0)
    alpha *= smooth(-3, 4, (reach - r) * PX)
    alpha *= np.abs(t) < 1.4

    light, density = fabric(np.clip(u, 0, 1), t, seed, gather=2.5, folds=6)
    # the loop puffs out: brighter in the belly, shadowed where it is pinched
    puff = np.exp(-(((u - 0.62) / 0.3) ** 2)) * (1 - 0.6 * t * t)
    light = light * (0.84 + 0.16 * smooth(0.05, 0.55, u)) + 0.05 * puff
    # the folded rim is two layers thick
    rim = smooth(0.78, 0.97, u) * (1 - smooth(0.97, 1.02, u))
    density = density + 0.18 * rim
    return layer(alpha * np.clip(density, 0, 1.2), light * tone, opacity)


def knot():
    # a short length of ribbon wrapped round the middle and pulled tight
    return strip([(0.004, -0.036), (-0.008, -0.012), (0.01, 0.016), (0.0, 0.04)],
                 lambda u: 0.03 + 0.008 * np.sin(np.pi * u), 41, 0.93, gather=3, folds=7)


def save(name, rgba):
    img = Image.fromarray(rgba.astype(np.uint8), "RGBA")
    img = img.filter(ImageFilter.GaussianBlur(0.5))
    img.save(OUT / f"{name}.webp", quality=88, method=6)
    print(name, (OUT / f"{name}.webp").stat().st_size // 1024, "KB")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    # the band wraps round the sleeve and is gathered into the knot
    save("band-left", strip([(0, 0.005), (-0.14, 0.01), (-0.34, -0.012), (-0.503, 0.004)],
                            lambda u: 0.042 + 0.045 * smooth(0, 0.35, u), 11, 0.9, gather=1.5))
    save("band-right", strip([(0, 0.0), (0.15, -0.012), (0.34, 0.006), (0.503, -0.01)],
                             lambda u: 0.042 + 0.045 * smooth(0, 0.35, u), 12, 0.9, gather=1.5))
    # tails hang from the knot, widening and very sheer, with torn ends
    save("tail-left", strip([(0, 0.02), (-0.03, 0.1), (-0.09, 0.19), (-0.15, 0.3)],
                            lambda u: 0.024 + 0.05 * smooth(0, 0.7, u), 21, 0.8, gather=2, torn_end=True))
    save("tail-right", strip([(0, 0.02), (0.04, 0.12), (0.1, 0.24), (0.19, 0.36)],
                             lambda u: 0.024 + 0.058 * smooth(0, 0.7, u), 22, 0.78, gather=2, torn_end=True))
    # loops point up and out like the real bow
    # each loop is the back fold with the front fold over it
    save("loop-left", over(lobe(np.radians(-150), 0.235, np.radians(37), 31, tilt=0.12),
                           lobe(np.radians(-156), 0.225, np.radians(34), 33, tone=0.93, opacity=0.7)))
    save("loop-right", over(lobe(np.radians(-31), 0.25, np.radians(36), 32, tilt=-0.1),
                            lobe(np.radians(-24), 0.24, np.radians(33), 34, tone=0.93, opacity=0.7)))
    save("knot", knot())


if __name__ == "__main__":
    main()
