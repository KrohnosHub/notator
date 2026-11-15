#!/usr/bin/env python3
"""Geometrischer Weg fuer «PDF lesen» (Prototyp, nur Tonhoehen).

Misst die Tonhoehen aus dem Bild statt sie von der KI lesen zu lassen:
Notenlinien finden -> duenne Striche (Linien, Haelse, Text) wegfiltern ->
Notenkoepfe als Tintenflecken -> Hoehe relativ zu den vier Linien -> GABC-Buchstabe
(unterste Linie d, dann f, h, oberste j; Zwischenraeume e, g, i).

Aufruf:
  python3 tests/pdf-lesen/geometrie/geom.py [--series geom-v2] [--work DIR] [--debug]

Braucht: Python 3, numpy, Pillow, pdftoppm (poppler). Keine API-Aufrufe.
Liest cases/<fall>/scan.pdf, schreibt runs/<serie>/<fall>/run-01.json.
Zusaetzlich (GEOM_FULL=1, Standard): Schluessel, Trennstriche und Silbenraster aus dem Bild.
Nicht Teil dieses Prototyps: Lesen des Texts, Mora-Punkte, Vorzeichen, Stueckgrenzen.
Die Aufteilung der Systeme auf Stuecke wird aus expected.json uebernommen.
"""
import argparse, json, os, subprocess, sys, tempfile, time
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LET = 'abcdefghijklm'          # d = unterste Linie (Index 3), j = oberste (Index 9)
DPI = int(os.environ.get('GEOM_DPI', 300))
THR = 140                      # Grauwert-Schwelle «Tinte» fuer die Liniensuche
THR_NOTE = int(os.environ.get('GEOM_THR', 0))   # Schwelle fuer Notenkoepfe; 0 = je Seite automatisch (siehe run_case)
CLEF = float(os.environ.get('GEOM_CLEF', 1.2))   # Breite der Schluesselzone ab Linienanfang, in Linienabstaenden
WMIN = float(os.environ.get('GEOM_WMIN', 0.6))   # Mindestbreite eines Notenkopfs, Anteil der typischen Breite
FULL = os.environ.get('GEOM_FULL', '1') == '1'   # 1 = auch Schluessel, Trennstriche und Silbenraster; 0 = nur Tonhoehen (Stand geom-v1)
CLOSE = 0                      # Loecher schliessen (px); 0 = aus. Versuch mit 0.1 Linienabstand war deutlich schlechter (71 %)


# ── Notenlinien und Systeme (aus lesetest/cut.py uebernommen) ───────────
def linecands(dark, lo, hi):
    H, W = dark.shape
    cnt = dark[:, int(W * lo):int(W * hi)].sum(axis=1)
    peak = np.sort(cnt)[-20:].mean()
    rows = [y for y in range(H) if cnt[y] > 0.45 * peak]
    cl = []
    for y in rows:
        if cl and y - cl[-1][-1] <= 2: cl[-1].append(y)
        else: cl.append([y])
    return [(c[0] + c[-1]) / 2 for c in cl if len(c) <= 12]


def group(lines):
    gaps = sorted(b - a for a, b in zip(lines, lines[1:]) if 12 < b - a < 60)
    if not gaps: return [], 0
    g = gaps[len(gaps) // 2]
    out = []; i = 0
    while i + 3 < len(lines):
        q = lines[i:i + 4]
        if all(abs((q[k + 1] - q[k]) - g) < 0.25 * g for k in range(3)): out.append(q); i += 4
        else: i += 1
    return out, g


def staves(im):
    """Deskew + vier Linien je System + waagrechte Ausdehnung. Gibt (Bild, Systeme, Linienabstand)."""
    W = im.width
    dark = np.array(im) < THR
    L, _ = group(linecands(dark, 0.25, 0.40)); R, _ = group(linecands(dark, 0.60, 0.75))
    ang = 0.0
    pairs = [(l, min(R, key=lambda r: abs(r[0] - l[0]))) for l in L] if R else []
    pairs = [(l, r) for l, r in pairs if abs(r[0] - l[0]) < 30]
    if pairs:
        dy = np.median([r[0] - l[0] for l, r in pairs])
        ang = float(np.degrees(np.arctan2(dy, 0.35 * W)))
        im = im.rotate(ang, resample=Image.BICUBIC, fillcolor=255); dark = np.array(im) < THR
    out, g = group(linecands(dark, 0.30, 0.70))
    res = []
    for q in out:
        ys = [int(round(y)) for y in q]
        cols = np.where(sum(dark[y - 4:y + 5].any(axis=0).astype(int) for y in ys) >= 4)[0]
        best = (0, 0); st0 = None; last = None
        for x in cols:                      # groesster zusammenhaengender Bereich (Luecken bis 40 px)
            if st0 is None: st0 = x
            elif x - last > 40:
                if last - st0 > best[1] - best[0]: best = (st0, last)
                st0 = x
            last = x
        if last is not None and last - st0 > best[1] - best[0]: best = (st0, last)
        res.append({'lines': q, 'x0': int(best[0]), 'x1': int(best[1])})
    return im, res, g, ang


# ── Morphologie ohne scipy ──────────────────────────────────────────────
def _erode1(a, k, axis):
    """Erosion mit einem k langen Strich entlang axis (zentriert)."""
    out = a.copy()
    for d in range(-(k // 2), k - k // 2):
        if d == 0: continue
        s = np.roll(a, d, axis=axis)
        if axis == 0:
            if d > 0: s[:d, :] = False
            else: s[d:, :] = False
        else:
            if d > 0: s[:, :d] = False
            else: s[:, d:] = False
        out &= s
    return out


def _dilate1(a, k, axis):
    out = a.copy()
    for d in range(-(k // 2), k - k // 2):
        if d == 0: continue
        s = np.roll(a, -d, axis=axis)
        if axis == 0:
            if -d > 0: s[:-d, :] = False
            else: s[-d:, :] = False
        else:
            if -d > 0: s[:, :-d] = False
            else: s[:, -d:] = False
        out |= s
    return out


def closing(a, k):
    d = _dilate1(_dilate1(a, k, 1), k, 0)
    return _erode1(_erode1(d, k, 1), k, 0)


def opening(a, kw, kh):
    """Behaelt nur Tinte, in die ein kw x kh grosses Rechteck passt."""
    e = _erode1(_erode1(a, kw, 1), kh, 0)
    return _dilate1(_dilate1(e, kw, 1), kh, 0)


def components(mask):
    """Zusammenhangskomponenten (8er-Nachbarschaft), lauflaengenbasiert. Gibt Liste von Pixel-Arrays (y, x)."""
    H, W = mask.shape
    parent = []
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]; i = parent[i]
        return i
    runs = []          # (y, x0, x1, label)
    prev = []
    for y in range(H):
        row = mask[y]
        if not row.any(): prev = []; continue
        d = np.diff(np.concatenate(([0], row.view(np.int8), [0])))
        starts = np.where(d == 1)[0]; ends = np.where(d == -1)[0] - 1
        cur = []
        for x0, x1 in zip(starts, ends):
            lab = None
            for (px0, px1, pl) in prev:
                if px0 <= x1 + 1 and px1 >= x0 - 1:
                    r = find(pl)
                    if lab is None: lab = r
                    elif r != lab: parent[r] = lab
            if lab is None:
                lab = len(parent); parent.append(lab)
            cur.append((int(x0), int(x1), lab)); runs.append((y, int(x0), int(x1), lab))
        prev = cur
    comps = {}
    for y, x0, x1, lab in runs:
        comps.setdefault(find(lab), []).append((y, x0, x1))
    return list(comps.values())


# ── Lokale Linienlage (Restschraege, Wellen im Scan) ────────────────────
def line_offsets(dark, st, g):
    """Senkrechter Versatz der vier Linien gegenueber st['lines'], als Funktion von x."""
    q = st['lines']; x0, x1 = st['x0'], st['x1']
    step = int(2 * g); half = int(3 * g)
    thick = []
    last = 0.0
    centers = list(range(x0 + half, x1 - half + 1, step)) or [(x0 + x1) // 2]
    mid = len(centers) // 2
    order = centers[mid:] + centers[:mid][::-1]
    est = {}
    for cx in order:
        # Startwert: Nachbarfenster Richtung Mitte
        nb = [est[c] for c in (cx - step, cx + step) if c in est]
        last = nb[0] if nb else 0.0
        ds = []
        for y in q:
            yc = y + last; r = int(0.3 * g)
            lo = int(round(yc)) - r
            band = dark[lo:lo + 2 * r + 1, max(0, cx - half):cx + half]
            if band.size == 0: continue
            cnt = band.sum(axis=1).astype(float)
            if cnt.max() < 0.4 * band.shape[1]: continue    # Linie hier nicht sichtbar
            top = np.where(cnt > 0.7 * cnt.max())[0]
            ds.append(lo + top.mean() - y); thick.append(int((cnt > 0.5 * cnt.max()).sum()))
        if ds: last = float(np.median(ds))
        est[cx] = last
    xs = sorted(est); offs = [est[x] for x in xs]
    t = float(np.median(thick)) if thick else 0.1 * g
    return (lambda x: float(np.interp(x, xs, offs))), t


# ── Notenkoepfe ─────────────────────────────────────────────────────────
def analyse_staff(dark, st, g, debug=None, ref=None):
    q = st['lines']; x0, x1 = st['x0'], st['x1']
    gl = (q[3] - q[0]) / 3.0            # Linienabstand dieses Systems
    hs = gl / 2.0                       # eine Tonstufe
    off, lt = line_offsets(dark, st, gl)
    top = int(q[0] - 2.2 * gl); bot = int(q[3] + 1.9 * gl)
    top = max(0, top); bot = min(dark.shape[0], bot)
    xa = max(0, x0 - int(0.3 * gl)); xb = min(dark.shape[1], x1 + int(0.3 * gl))
    reg = dark[top:bot, xa:xb]
    # Filterkern: hoeher als eine Notenlinie dick ist, sonst so klein wie moeglich (kleine Noten in schwachem Druck)
    kh = max(int(round(lt)) + 3, int(round(0.17 * gl))); kw = max(kh, int(round(0.2 * gl)))
    # kleine Loecher in den Notenkoepfen schliessen (hohl gedruckte Noten), dann duenne Striche entfernen
    kc = CLOSE
    op = opening(closing(reg, kc) if kc else reg, kw, kh)
    # Textzeilen ober- und unterhalb: dichte Tinte ueber die ganze Breite. Noten ausserhalb der Linien sind dagegen vereinzelt.
    dens = reg.mean(axis=1)
    ylo = bot; yhi = top
    r0 = int(q[3] + 0.6 * gl) - top
    for y in range(r0, reg.shape[0] - 3):
        if dens[y:y + 4].min() > 0.12: ylo = top + y; break
    r1 = int(q[0] - 0.6 * gl) - top
    for y in range(r1, 3, -1):
        if dens[y - 3:y + 1].min() > 0.12: yhi = top + y; break
    comps = components(op)
    blobs = []
    for runs in comps:
        ys = np.array([r[0] for r in runs]); xs0 = np.array([r[1] for r in runs]); xs1 = np.array([r[2] for r in runs])
        bx0, bx1 = int(xs0.min()), int(xs1.max()); by0, by1 = int(ys.min()), int(ys.max())
        area = int((xs1 - xs0 + 1).sum())
        sub = np.zeros((by1 - by0 + 1, bx1 - bx0 + 1), bool)
        for y, a, b in runs: sub[y - by0, a - bx0:b - bx0 + 1] = True
        blobs.append({'x0': bx0 + xa, 'x1': bx1 + xa, 'y0': by0 + top, 'y1': by1 + top, 'area': area, 'sub': sub})
    notes = []      # {'x','y','p' (Stufe, 0 = unterste Linie), 'kind'}
    inner = [b for b in blobs if b['y0'] > q[0] - 1.6 * gl and b['y1'] < q[3] + 1.2 * gl and x0 + 1.5 * gl < b['x0'] and b['x1'] < x1 - 0.8 * gl]
    sizes = [(b['area'], b['x1'] - b['x0'] + 1) for b in inner]
    if ref is None: return sizes, gl                 # 1. Durchgang: nur Groessen sammeln
    aref, wref = ref                                 # typische Notenkopf-Flaeche und -Breite der ganzen Seite
    step_of = lambda x, y: (q[3] + off(x) - y) / hs
    for b in blobs:
        w = b['x1'] - b['x0'] + 1; h = b['y1'] - b['y0'] + 1
        cx = (b['x0'] + b['x1']) / 2
        if b['x0'] < x0 + CLEF * gl: continue           # Schluessel am Zeilenanfang
        if b['y0'] <= top + 1 or b['y1'] >= bot - 2: continue      # ragt aus dem Streifen: Text, Titel
        if cx > x1 - 0.5 * gl: continue                 # Custos / Schlussstrich am Zeilenende
        cy = (b['y0'] + b['y1']) / 2
        if cy > ylo - 0.1 * gl or cy < yhi + 0.1 * gl: continue    # liegt in einer Textzeile
        if w < WMIN * wref or b['area'] < 0.45 * aref: continue    # Punkte, Reste von Vorzeichen, Flecken
        b['wref'] = wref
        notes.extend(split_blob(b, gl, hs, step_of))
    # Lesereihenfolge: von links nach rechts; uebereinander stehende Noten von unten nach oben
    notes.sort(key=lambda n: n['x'])
    # Bruchstuecke derselben Note zusammenfassen (hohl oder lueckenhaft gedruckte Notenkoepfe)
    merged = []
    for n in notes:
        m = merged[-1] if merged else None
        if (m and n['kind'] == 'note' and m['kind'] == 'note' and abs(n['p'] - m['p']) < 0.7
                and n['xa'] - m['xb'] < 0.25 * wref and n['xb'] - m['xa'] + 1 <= 1.35 * wref):
            wa, wb = m['w'], n['w']
            for key in ('y', 'p'): m[key] = (m[key] * wa + n[key] * wb) / (wa + wb)
            m['xb'] = n['xb']; m['x'] = (m['xa'] + m['xb']) / 2; m['w'] = wa + wb
        else: merged.append(n)
    notes = merged
    ordered = []
    i = 0
    while i < len(notes):
        j = i + 1
        while j < len(notes) and notes[j]['x'] - notes[i]['x'] < 0.22 * gl: j += 1
        ordered.extend(sorted(notes[i:j], key=lambda n: -n['y']))
        i = j
    out = []
    for n in ordered:
        p = int(round(n['p']))
        if p < -3 or p > 9: continue                    # ausserhalb a..m: kein Notenkopf (Text, Titel)
        n['letter'] = LET[p + 3]; out.append(n)
    if debug is not None:
        debug.append({'top': top, 'bot': bot, 'xa': xa, 'xb': xb, 'op': op, 'off': off, 'q': q})
    st['_ctx'] = {'top': top, 'bot': bot, 'xa': xa, 'xb': xb, 'op': op, 'reg': reg, 'step_of': step_of, 'ylo': ylo,
                  'blobs': blobs, 'gl': gl, 'wref': wref}
    return out, gl


# ── Schluessel, Trennstriche, Silbenraster (ohne Texterkennung) ─────────
def find_clef(st):
    """Schluessel aus den Tintenflecken am Zeilenanfang: Hoehe der Fleckengruppe -> Linie, Breite -> Do oder Fa.
    Fa-Schluessel ist mangels Testfall ungeprueft."""
    c = st['_ctx']; gl = c['gl']; q = st['lines']; x0 = st['x0']
    bl = [b for b in c['blobs'] if b['x0'] < x0 + 0.6 * gl and b['x1'] > x0 - 0.2 * gl
          and b['y0'] > q[0] - 0.8 * gl and b['y1'] < q[3] + 0.8 * gl and b['area'] > 0.3 * c['wref'] ** 2]
    if not bl: return ''
    ya = min(b['y0'] for b in bl); yb = max(b['y1'] for b in bl)
    xa = min(b['x0'] for b in bl); xb = max(b['x1'] for b in bl)
    p = c['step_of']((xa + xb) / 2, (ya + yb) / 2)
    line = int(round(p / 2.0)) + 1
    if line < 1 or line > 4: return ''
    return ('f' if (xb - xa) > 1.9 * c['wref'] else 'c') + str(line)


def find_bars(st):
    """Trennstriche: senkrechte duenne Striche, die an keinem Notenkopf haengen. Typ aus der Laenge."""
    c = st['_ctx']; gl = c['gl']; q = st['lines']; x0, x1 = st['x0'], st['x1']
    top, xa = c['top'], c['xa']
    ra = max(0, int(q[0] - 0.9 * gl) - top); rb = int(q[3] + 0.9 * gl) - top
    reg = c['reg'][ra:rb]
    k = max(5, int(round(0.55 * gl)))
    v = _dilate1(_erode1(reg, k, 0), k, 0)                     # nur senkrechte Laeufe >= 0.55 Linienabstand
    near = _dilate1(_dilate1(c['op'][ra:rb], 2 * int(0.3 * gl) + 1, 1), 2 * int(0.15 * gl) + 1, 0)
    bars = []
    for runs in components(v):
        ys = [r[0] for r in runs]; bx0 = min(r[1] for r in runs); bx1 = max(r[2] for r in runs)
        by0, by1 = min(ys), max(ys)
        if bx1 - bx0 + 1 > 0.35 * gl: continue                 # zu breit: Initiale, Notenstapel
        cx = (bx0 + bx1) / 2 + xa
        if cx < x0 + CLEF * gl: continue
        tot = sum(r[2] - r[1] + 1 for r in runs); hit = sum(int(near[r[0], r[1]:r[2] + 1].sum()) for r in runs)
        if hit > 0.25 * tot: continue                          # haengt an einem Notenkopf: Hals
        # einseitige Tinte neben dem Strich (Bauch eines b-Vorzeichens, Custos): kein Trennstrich. Notenlinien sind beidseitig.
        m = int(0.3 * gl); g2 = 2
        lft = reg[by0:by1 + 1, max(0, bx0 - m):max(0, bx0 - g2)].any(axis=1)
        rgt = reg[by0:by1 + 1, bx1 + g2 + 1:bx1 + m + 1].any(axis=1)
        if (by1 - by0 + 1) < 1.4 * gl and (lft ^ rgt).mean() > float(os.environ.get("GEOM_ASYM", 0.4)): continue
        L = (by1 - by0 + 1) / gl
        pm = c['step_of'](cx, (by0 + by1) / 2 + ra + top)
        if L >= 2.5: t = ':'
        elif L >= 1.4 and 0.5 < pm < 5.5: t = ';'
        elif 0.5 <= L < 1.4 and pm >= 4.5: t = ','
        else: continue
        bars.append({'x': cx, 'type': t})
    bars.sort(key=lambda b: b['x'])
    out = []
    for b in bars:
        if out and b['x'] - out[-1]['x'] < 0.8 * gl:
            if b['type'] == ':' and out[-1]['type'] in (':', '::'): out[-1]['type'] = '::'
            continue
        out.append(b)
    return out


def find_chunks(dark, st):
    """Silbenraster: Tintengruppen in der ersten Textzeile unter dem System, mit «endet auf Trennstrich».
    Kein Lesen des Texts. Silben ohne Luecke im Druck (fe-stum als «festum») bleiben eine Gruppe."""
    c = st['_ctx']; gl = c['gl']; x0, x1 = st['x0'], st['x1']
    ylo = c['ylo']
    if ylo >= c['bot']: return []
    xa = max(0, int(x0 - 0.5 * gl)); xb = min(dark.shape[1], int(x1 + 0.5 * gl))
    band = dark[ylo:min(dark.shape[0], int(ylo + 1.5 * gl)), xa:xb]
    dens = band.mean(axis=1)
    yb = len(dens)
    for y in range(int(0.4 * gl), len(dens)):
        if dens[y] < 0.01: yb = y; break                       # Ende der ersten Textzeile
    band = band[:yb]; dens = dens[:yb]
    body = np.where(dens > 0.5 * dens.max())[0] if dens.size and dens.max() > 0 else np.array([0])
    bt, bb = int(body[0]), int(body[-1])                       # Mittelband der Kleinbuchstaben
    cols = band.any(axis=0)
    d = np.diff(np.concatenate(([0], cols.view(np.int8), [0])))
    runs = list(zip(np.where(d == 1)[0], np.where(d == -1)[0] - 1))
    chunks = []
    for a, b in runs:
        if chunks and a - chunks[-1][-1][1] < 0.2 * gl: chunks[-1].append((a, b))
        else: chunks.append([(a, b)])
    out = []
    for ch in chunks:
        a, b = ch[-1]                                          # letztes Zeichen der Gruppe
        rows = np.where(band[:, a:b + 1].any(axis=1))[0]
        hyph = False
        if len(rows):
            h = rows[-1] - rows[0] + 1; mid = (rows[0] + rows[-1]) / 2.0
            hyph = h < 0.22 * gl and bt + 0.15 * (bb - bt) < mid < bb - 0.15 * (bb - bt)
        if len(ch) == 1 and hyph and out: out[-1]['hyphen'] = True; continue   # allein stehender Trennstrich
        out.append({'x0': ch[0][0] + xa, 'x1': ch[-1][1] + xa, 'hyphen': bool(hyph)})
    return out


def to_gabc_full(notes, bars, chunks, gl):
    """GABC-Zeile mit Platzhaltertext. Silbengrenze: Luecke zwischen Noten oder neue Textgruppe darunter.
    Wortgrenze: neue Textgruppe, deren Vorgaengerin nicht auf Trennstrich endet."""
    def chunk_of(x):
        k = -1
        for i, ch in enumerate(chunks):
            if ch['x0'] - 0.3 * gl <= x: k = i
            else: break
        return k
    groups = []         # [x, noten, wortanfang, textgruppe]
    for i, n in enumerate(notes):
        k = chunk_of(n['x'])
        if groups and k == groups[-1][3] and n['x'] - notes[i - 1]['x'] <= 0.9 * gl:
            groups[-1][1].append(n); continue
        newchunk = not groups or k != groups[-1][3]
        word = newchunk and not (k > 0 and chunks[k - 1]['hyphen'])
        groups.append([n['x'], [n], word, k])
    toks = []; xmax = -1e9
    for g in groups:
        xmax = max(xmax, g[0]); toks.append((xmax, len(toks), 'x(' + ''.join(n['letter'] for n in g[1]) + ')', g[2]))
    toks += [(b['x'], 1e6, '(' + b['type'] + ')', True) for b in bars]
    toks.sort(key=lambda t: (t[0], t[1]))
    s = ''
    for i, (x, _, t, word) in enumerate(toks):
        s += (' ' if i and (word or t[0] == '(' or toks[i - 1][2][0] == '(') else '') + t
    return s


def split_blob(b, gl, hs, step_of):
    """Zerlegt einen Tintenfleck in einzelne Noten (Spaltenanalyse)."""
    sub = b['sub']; H, W = sub.shape
    # je Spalte die Huelle (oberste und unterste Tinte); Streifen = Spaltenfolge mit stetiger Mitte und Hoehe
    cols = []
    for x in range(W):
        ys = np.where(sub[:, x])[0]
        if len(ys): cols.append((x, int(ys[0]), int(ys[-1])))
    done = []
    for c in cols:
        if done:
            _, pa, pc = done[-1][-1]
            if abs((c[1] + c[2]) / 2 - (pa + pc) / 2) < 0.16 * gl and abs((c[2] - c[1]) - (pc - pa)) < 0.3 * gl:
                done[-1].append(c); continue
        done.append([c])
    if not any(len(t) >= 0.5 * b['wref'] for t in done): done = [cols]
    res = []
    for t in done:
        ws = len(t)
        if ws < 0.5 * b['wref']: continue
        xs = np.array([c[0] for c in t]); mids = np.array([(c[1] + c[2]) / 2 for c in t]); hts = np.array([c[2] - c[1] + 1 for c in t])
        n3 = max(1, ws // 4)
        cs = float(np.median(mids[:n3])); ce = float(np.median(mids[-n3:]))
        hmed = float(np.median(hts))
        X = lambda i: b['x0'] + float(xs[i]); Y = lambda v: b['y0'] + v
        wref = b['wref']
        if abs(ce - cs) > 0.8 * hs and ws > 2.4 * wref:
            # Schraegbalken (Porrectus, Flexus-Balken): zwei Noten, Anfang und Ende
            xa_, xb_ = X(0) + 0.2 * gl, X(-1) - 0.2 * gl
            res.append({'x': xa_, 'y': Y(cs), 'p': step_of(xa_, Y(cs)), 'kind': 'bar'})
            res.append({'x': xb_, 'y': Y(ce), 'p': step_of(xb_, Y(ce)), 'kind': 'bar'})
            continue
        xm = (X(0) + X(-1)) / 2
        ytop = float(np.median([c[1] for c in t])); ybot = float(np.median([c[2] for c in t]))
        nstack = int(round(hmed / hs))
        if nstack >= 2 and hmed > 0.8 * gl:
            ink = sum(int(sub[c[1]:c[2] + 1, c[0]].sum()) for c in t) / float(hts.sum())
            if ink < 0.8: continue          # hohl: Vorzeichen (b) oder Schluesselrest, keine zwei Noten
            # zwei direkt uebereinander stehende Noten (Podatus mit Sekundschritt)
            nh = 0.45 * gl
            for yy in (ybot - nh / 2, ytop + nh / 2):
                res.append({'x': xm, 'y': Y(yy), 'p': step_of(xm, Y(yy)), 'kind': 'stack'})
            continue
        # breiter Streifen: mehrere direkt aneinander stossende Noten
        n = int(round(ws / wref)) if ws > 1.5 * wref else 1
        for k in range(n):
            part = t[k * ws // n:(k + 1) * ws // n]
            core = part[len(part) // 5:len(part) - len(part) // 5] or part
            ym = float(np.median([(c[1] + c[2]) / 2 for c in core]))
            xa_, xb_ = b['x0'] + part[0][0], b['x0'] + part[-1][0]
            xm = (xa_ + xb_) / 2
            res.append({'x': xm, 'y': Y(ym), 'p': step_of(xm, Y(ym)), 'kind': 'note', 'w': len(part), 'xa': xa_, 'xb': xb_})
    return res


def to_gabc(notes, gl):
    """Platzhalter-GABC: je Notengruppe (Luecke > 0.9 Linienabstand) eine Klammer."""
    if not notes: return ''
    groups = [[notes[0]]]
    for a, b in zip(notes, notes[1:]):
        if b['x'] - a['x'] > 0.9 * gl: groups.append([b])
        else: groups[-1].append(b)
    return ' '.join('x(' + ''.join(n['letter'] for n in gr) + ')' for gr in groups)


def otsu(a):
    """Schwelle zwischen Tinte und Papier nach Otsu (groesste Varianz zwischen den Klassen)."""
    h = np.bincount(a.ravel(), minlength=256).astype(float)
    w = np.cumsum(h); m = np.cumsum(h * np.arange(256))
    wb = w[:-1]; wf = w[-1] - wb
    ok = (wb > 0) & (wf > 0)
    var = np.zeros(255)
    var[ok] = wb[ok] * wf[ok] * (m[:-1][ok] / wb[ok] - (m[-1] - m[:-1][ok]) / wf[ok]) ** 2
    return int(np.argmax(var)) + 1


def render(pdf, out_png):
    base = out_png[:-4]
    subprocess.run(['pdftoppm', '-r', str(DPI), '-f', '1', '-l', '1', '-singlefile', '-gray', '-png', pdf, base], check=True)


def run_case(case, work, debug):
    cdir = os.path.join(ROOT, 'cases', case)
    exp = json.load(open(os.path.join(cdir, 'expected.json')))
    pdf = os.path.join(cdir, exp.get('scan', 'scan.pdf'))
    if not os.path.exists(pdf): return None
    png = os.path.join(work, case + '.png'); render(pdf, png)
    im = Image.open(png).convert('L')
    im, sts, g, ang = staves(im)
    arr = np.array(im)
    # Schwelle fuer Notenkoepfe: auf halbem Weg zwischen Otsu-Schwelle und Papierhelligkeit. Grosszuegig,
    # damit lueckenhaft gedruckte Notenkoepfe geschlossen bleiben; die Liniendicke wird ohnehin gemessen.
    thr = THR_NOTE or int((otsu(arr) + float(np.median(arr))) / 2)
    dark = np.array(im) < thr
    lines = []; dbg = []; clefs = []
    sizes = [sz for st in sts for sz in analyse_staff(dark, st, g)[0]]
    ref = (float(np.median([a for a, _ in sizes])), float(np.median([w for _, w in sizes]))) if sizes else (0.2 * g * g, 0.45 * g)
    for k, st in enumerate(sts):
        d = [] if debug else None
        notes, gl = analyse_staff(dark, st, g, d, ref)
        if FULL:
            bars = find_bars(st); chunks = find_chunks(dark, st)
            lines.append(to_gabc_full(notes, bars, chunks, gl)); clefs.append(find_clef(st))
            if debug: d[0]['bars'] = bars; d[0]['chunks'] = chunks
        else:
            lines.append(to_gabc(notes, gl)); clefs.append('')
        if debug: dbg.append((st, notes, d[0]))
    if debug:
        for k, (st, notes, d) in enumerate(dbg):
            crop = im.crop((d['xa'], d['top'], d['xb'], d['bot'])).convert('RGB')
            a = np.array(crop); a[d['op']] = (255, 150, 150); crop = Image.fromarray(a)
            dr = ImageDraw.Draw(crop)
            for n in notes:
                x = n['x'] - d['xa']; y = n['y'] - d['top']
                dr.line((x - 5, y, x + 5, y), fill=(0, 0, 255), width=2)
                dr.text((x - 3, 2 if int(x / 12) % 2 else 14), n['letter'], fill=(0, 0, 255))
            for b in d.get('bars', []):
                x = b['x'] - d['xa']; dr.line((x, 30, x, crop.height - 30), fill=(0, 160, 0), width=2); dr.text((x + 3, 30), b['type'], fill=(0, 130, 0))
            for ch in d.get('chunks', []):
                yy = crop.height - 4
                dr.line((ch['x0'] - d['xa'], yy, ch['x1'] - d['xa'], yy), fill=(255, 0, 255) if ch['hyphen'] else (0, 160, 0), width=3)
            crop.save(os.path.join(work, 'dbg-%s-%d.png' % (case, k + 1)))
    # Systeme auf Stuecke verteilen: Systemzahlen aus expected.json (Stueckgrenzen sind nicht Teil des Prototyps)
    pieces = []; i = 0
    for ep in exp['pieces']:
        n = len(ep['systems']) if 'systems' in ep else ep.get('systemCount', 0)
        cl = [c for c in clefs[i:i + n] if c]             # Mehrheit ueber die Systeme des Stuecks (Schluesselwechsel: nicht unterstuetzt)
        clef = max(set(cl), key=cl.count) if cl else ''
        pieces.append({'incipit': ep.get('incipit', ''), 'mode': '', 'clef': clef, 'hasDropCap': None, 'systems': lines[i:i + n]})
        i += n
    if i < len(lines) and pieces: pieces[-1]['systems'].extend(lines[i:])
    return {'pieces': pieces, 'staves': len(sts), 'skew': ang, 'gap': g, 'thr': thr}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--series', default='geom-v2')
    ap.add_argument('--work', default=None)
    ap.add_argument('--debug', action='store_true')
    ap.add_argument('--case', action='append')
    a = ap.parse_args()
    work = a.work or tempfile.mkdtemp(prefix='geom-')
    os.makedirs(work, exist_ok=True)
    cases = a.case or sorted(d for d in os.listdir(os.path.join(ROOT, 'cases')) if not d.startswith('_') and os.path.isdir(os.path.join(ROOT, 'cases', d)))
    for case in cases:
        t0 = time.time()
        r = run_case(case, work, a.debug)
        if r is None:
            print('%s: scan.pdf fehlt, uebersprungen' % case); continue
        out = {
            'model': 'keines (geometrisch)', 'effort': '',
            'pipeline': 'geometrie/geom.py: Notenkoepfe aus dem Bild gemessen; nur Tonhoehen, Text ist Platzhalter «x», Stueckaufteilung aus expected.json',
            'pieces': r['pieces'],
            'usage': {'input_tokens': 0, 'output_tokens': 0, 'costUsd': 0},
            'durationMs': int((time.time() - t0) * 1000),
        }
        d = os.path.join(ROOT, 'runs', a.series, case); os.makedirs(d, exist_ok=True)
        json.dump(out, open(os.path.join(d, 'run-01.json'), 'w'), ensure_ascii=False, indent=1)
        print('%s: %d Systeme, Schraege %.2f Grad, Linienabstand %.0f px, Schwelle %d, %.1f s' % (case, r['staves'], r['skew'], r['gap'], r['thr'], time.time() - t0))
    if a.debug: print('Debug-Bilder in', work)


if __name__ == '__main__':
    main()
