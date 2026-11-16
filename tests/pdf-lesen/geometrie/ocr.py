"""Text unter den Notensystemen mit Tesseract lesen und den Noten zuordnen (Prototyp).

Braucht das Programm `tesseract` mit dem Sprachpaket `lat` (z. B. apt-get install tesseract-ocr tesseract-ocr-lat).
Kostenlos, laeuft lokal. Wird von geom.py aufgerufen, wenn GEOM_OCR=1 (Standard, sofern tesseract vorhanden).
"""
import os, re, shutil, subprocess, tempfile, unicodedata
import numpy as np
from PIL import Image

AVAILABLE = shutil.which('tesseract') is not None
SCALE = int(os.environ.get('GEOM_OCR_SCALE', 2))   # Textzeile vor dem Lesen vergroessern
BIN = os.environ.get('GEOM_OCR_BIN', '') != ''
UNIT_GAP = float(os.environ.get('GEOM_UNIT_GAP', 0.8))   # Noten mit kleinerem Abstand bilden eine feste Gruppe
SPLIT = float(os.environ.get('GEOM_SPLIT', 0.0))         # Strafe fuer eine Silbengrenze zwischen eng stehenden Noten
MINCONF = float(os.environ.get('GEOM_OCR_CONF', 0))

VOW = set('aeiouyáéíóúýàèìòùæœǽäëïöüAEIOUYÁÉÍÓÚÝÆŒǼ')
DIPH = ('ae', 'oe', 'au', 'áe', 'óe', 'áu')
LIQ = set('lrnm')


def _letters(s):
    return any(ch.isalpha() for ch in s)


# ── Lateinische Silbentrennung (liturgische Druckkonvention, vereinfacht) ──
def syllabify(word):
    """Trennt ein lateinisches Wort in Silben. Satzzeichen bleiben an der letzten Silbe.
    Regeln: V-CV; Doppelkonsonant getrennt; l/r/n/m vor Konsonant bleibt vorne (an-ge, san-cto), ausser mn;
    x bleibt vorne (ex-sul); sonst ganze Gruppe nach hinten (no-stra, Pa-tri, be-ne-di-ctum).
    ae/oe/au sind Diphthonge; qu und gu vor Vokal zaehlen als ein Konsonant."""
    w = word
    low = w.lower()
    n = len(w)
    # Vokalkerne finden
    nuclei = []
    i = 0
    while i < n:
        ch = low[i]
        if ch in VOW or ch in 'æœǽ':
            # u nach q/g als Konsonant
            if ch == 'u' and i > 0 and low[i - 1] in 'qg' and i + 1 < n and low[i + 1] in VOW:
                i += 1; continue
            j = i + 1
            if j < n and (low[i:j + 1] in DIPH):
                # Diphthong nur, wenn nicht durch Trema/Akzent auf dem zweiten Vokal getrennt
                j += 1
            nuclei.append((i, j)); i = j
        else:
            i += 1
    if len(nuclei) <= 1:
        return [w]
    cuts = []
    for (a0, a1), (b0, b1) in zip(nuclei, nuclei[1:]):
        cl = low[a1:b0]
        cons = [k for k in range(a1, b0) if low[k].isalpha()]
        if not cons:
            cuts.append(b0)
        elif len(cons) == 1:
            cuts.append(cons[0])
        else:
            c1, c2 = low[cons[0]], low[cons[1]]
            if c1 == c2 or c1 == 'x' or (c1 in LIQ and not (c1 == 'm' and c2 == 'n')):
                cuts.append(cons[1])
            else:
                cuts.append(cons[0])
    out = []; prev = 0
    for c in cuts:
        out.append(w[prev:c]); prev = c
    out.append(w[prev:])
    return [s for s in out if s]


# ── Tesseract ───────────────────────────────────────────────────────────
def _tesseract_words(img):
    with tempfile.TemporaryDirectory() as td:
        f = os.path.join(td, 'line.png'); img.save(f)
        out = subprocess.run(['tesseract', f, '-', '-l', 'lat', '--psm', '7', 'tsv'],
                             capture_output=True, text=True).stdout
    words = []
    for row in out.splitlines()[1:]:
        p = row.split('\t')
        if len(p) < 12 or p[0] != '5': continue
        txt = p[11].strip()
        if not txt: continue
        words.append({'text': txt, 'x0': int(p[6]), 'x1': int(p[6]) + int(p[8]), 'conf': float(p[10])})
    return words


def _tesseract_char(img):
    with tempfile.TemporaryDirectory() as td:
        f = os.path.join(td, 'c.png'); img.save(f)
        out = subprocess.run(['tesseract', f, '-', '-l', 'eng', '--psm', '10',
                              '-c', 'tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVXYZ'], capture_output=True, text=True).stdout
    s = ''.join(ch for ch in out if ch.isalpha())
    return s[:1].upper()


def clean_token(t):
    t = t.replace('—', '-').replace('–', '-').replace('|', '').replace('*', '')
    t = re.sub(r'^[^\wÀ-ÿæœǽÆŒ\-]+', '', t)            # Anfuehrungs- und Stoerzeichen vorne
    t = re.sub(r'[^\wÀ-ÿæœǽÆŒ\-,.;:!?]+$', '', t)      # Stoerzeichen hinten
    t = t.replace('1', 'i').replace('0', 'o')         # haeufige Verwechslungen
    t = re.sub(r'\d', '', t)                           # andere Ziffern sind im Liedtext Lesefehler
    t = re.sub(r'(?<=[a-zA-Zíéáóú\-])z[es]?(?=[,.;:!?]*$)|^z[es]?(?=[,.;:!?]*$)', 'æ', t)
    return t


def text_top(dark, st, gl):
    """Oberkante der ersten Textzeile unter dem System (erste dichte Zeilengruppe unter der untersten Linie)."""
    q = st['lines']; xa, xb = int(st['x0']), int(st['x1'])
    ya = int(q[3] + 0.6 * gl); yb = min(dark.shape[0], int(q[3] + 5 * gl))
    dens = dark[ya:yb, xa:xb].mean(axis=1)
    k = max(4, int(0.3 * gl))                          # Textzeile: ueber 0.3 Linienabstaende dicht; Noten unter dem System sind lockerer
    for y in range(len(dens) - k):
        if dens[y:y + k].min() > 0.07:
            while y > 0 and dens[y - 1] > 0.02: y -= 1  # bis zur Oberkante der Oberlaengen zurueck
            return ya + y
    return None


def read_line(im, dark, st, gl):
    """Liest die erste Textzeile unter dem System. Gibt Silben [{'text','x','word'}] in Seitenkoordinaten."""
    yt = text_top(dark, st, gl)
    if yt is None: return []
    x0 = int(st['x0'] - 0.5 * gl); x1 = int(st['x1'] + 0.5 * gl)
    y0 = int(yt - 0.35 * gl); y1 = int(yt + 1.25 * gl)
    crop = im.crop((x0, y0, x1, y1))
    crop = crop.resize((crop.width * SCALE, crop.height * SCALE), Image.LANCZOS)
    if BIN:                                            # Variante: vor dem Lesen binarisieren
        thr = int(os.environ.get('GEOM_OCR_BIN', 0)) or int(np.percentile(np.array(crop), 50) * 0.6)
        crop = crop.point(lambda v: 0 if v < thr else 255)
    words = []
    for w in _tesseract_words(crop):                    # «AMUS*omnes» u. ae. am Stern auftrennen
        parts = re.split(r'[*✠†]', w['text'])
        if len(parts) == 1: words.append(w); continue
        per = (w['x1'] - w['x0']) / max(1, len(w['text'])); pos = 0
        for p in parts:
            if p: words.append({'text': p, 'x0': w['x0'] + pos * per, 'x1': w['x0'] + (pos + len(p)) * per, 'conf': w['conf']})
            pos += len(p) + 1
    syls = []
    pending_hyphen = False
    for w in words:
        t = clean_token(w['text'])
        if not _letters(t) or w['conf'] < MINCONF:
            if t.strip('-') == '' and t: pending_hyphen = True   # allein stehender Trennstrich
            continue
        wx0 = x0 + w['x0'] / SCALE; wx1 = x0 + w['x1'] / SCALE
        lead = len(t) - len(t.lstrip('-'))
        trail_h = t.endswith('-')
        parts = [p for p in t.split('-')]
        # Zeichenpositionen proportional zur Wortbreite
        per = (wx1 - wx0) / max(1, len(t))
        pos = 0; first = True
        last = max((k for k, pt in enumerate(parts) if pt), default=0)
        for k, part in enumerate(parts):
            if part == '':
                pos += 1; continue
            shown = part if k == last else re.sub(r'[,.;:!?]', '', part)   # Satzzeichen nur am Wortende
            for s in syllabify(shown):
                syls.append({'text': s, 'x': wx0 + pos * per, 'x1': wx0 + (pos + len(s)) * per,
                             'word': first and not pending_hyphen and lead == 0,
                             'lead': first and lead > 0})
                pos += len(s); first = False
            pos += len(part) - len(shown) + 1          # entfernte Zeichen und der Trennstrich
        pending_hyphen = trail_h
    # Satzzeichen mitten im Wort (Trennstrich als Punkt gelesen) entfernen
    for a, b in zip(syls, syls[1:]):
        if not b['word'] and not b.get('lead'): a['text'] = re.sub(r'[,.;:!?]+$', '', a['text']) or a['text']
    # «a.» vor kleingeschriebenem Wort ist fast immer «a,»
    for a, b in zip(syls, syls[1:]):
        if a['text'].endswith('.') and b['word'] and b['text'][:1].islower(): a['text'] = a['text'][:-1] + ','
    return syls


def dropcap_box(dark, st, gl, components, others=None):
    """Umrandung der Initiale (Seitenkoordinaten, mit Rand) oder None."""
    q = st['lines']
    yt = text_top(dark, st, gl) or int(q[3] + 2 * gl)
    xa = max(0, int(st['x0'] - 16 * gl)); xb = int(st['x0'] - 0.1 * gl)
    ya = max(0, int(q[0] - 3.5 * gl)); yb = int(min(dark.shape[0], yt + 2.5 * gl))
    if xb - xa < gl: return None
    blocked0 = []
    for o in others or []:
        if o is st: continue
        og = (o['lines'][3] - o['lines'][0]) / 3.0
        blocked0.append((o['x0'] - xa, o['lines'][0] - og - ya, o['x1'] - xa, o['lines'][3] + 2.5 * og - ya))
    def in_other0(b):
        return any(b[0] < q[2] and q[0] < b[2] and b[1] < q[3] and q[1] < b[3] for q in blocked0)
    best = None; boxes = []
    ybx = int(min(dark.shape[0], yb + 6 * gl))         # erweitert: grosse Zier-Initialen reichen bis zum naechsten System
    for runs in components(dark[ya:ybx, xa:xb]):
        y0 = min(r[0] for r in runs); y1 = max(r[0] for r in runs)
        x0 = min(r[1] for r in runs); x1 = max(r[2] for r in runs)
        boxes.append([x0, y0, x1, y1])
        if y0 < yb - ya and y1 - y0 >= 2.5 * gl and not in_other0([x0, y0, x1, y1]) and (best is None or y1 - y0 > best[3] - best[1]): best = [x0, y0, x1, y1]
    if best is None: return None
    # Verzierte Initialen bestehen aus mehreren Teilen (Bogen, Fuellung): alle groesseren Teile dazunehmen,
    # die den Kasten beruehren oder knapp darunter liegen; wiederholen, bis nichts mehr dazukommt.
    # Bereiche anderer Systeme (Linien und Textzeile) gehoeren nicht zur Initiale
    blocked = []
    for o in others or []:
        if o is st: continue
        og = (o['lines'][3] - o['lines'][0]) / 3.0
        blocked.append((o['x0'] - xa, o['lines'][0] - og - ya, o['x1'] - xa, o['lines'][3] + 2.5 * og - ya))
    def in_other(b):
        return any(b[0] < q[2] and q[0] < b[2] and b[1] < q[3] and q[1] < b[3] for q in blocked)
    m = 0.3 * gl; mv = 1.5 * gl; grown = True
    while grown:
        grown = False
        for b in boxes:
            if max(b[3] - b[1], b[2] - b[0]) < 0.3 * gl or in_other(b): continue
            if b[0] > best[2] + m or b[2] < best[0] - m or b[1] > best[3] + mv or b[3] < best[1] - mv: continue
            if b[3] < best[1] and b[3] - b[1] < 1.2 * gl: continue   # kleine Angabe darueber (Modus «VIII», «5»): nicht dazu
            nb = [min(best[0], b[0]), min(best[1], b[1]), max(best[2], b[2]), max(best[3], b[3])]
            if nb != best: best = nb; grown = True
    pad = int(0.3 * gl)
    return (xa + best[0] - pad, ya + best[1] - pad, xa + best[2] + pad, ya + best[3] + pad)


def line_words(im, dark, st, gl):
    """Tesseract-Woerter der Textzeile in Seitenkoordinaten (nur fuer die Lage). Gibt (Woerter, x0, x1)."""
    yt = text_top(dark, st, gl)
    x0 = int(st['x0'] - 0.5 * gl); x1 = int(st['x1'] + 0.5 * gl)
    if yt is None or not AVAILABLE: return [], x0, x1
    crop = im.crop((x0, int(yt - 0.35 * gl), x1, int(yt + 1.25 * gl)))
    crop = crop.resize((crop.width * SCALE, crop.height * SCALE), Image.LANCZOS)
    out = []
    for w in _tesseract_words(crop):
        t = clean_token(w['text'])
        if _letters(t): out.append({'text': t, 'x0': x0 + w['x0'] / SCALE, 'x1': x0 + w['x1'] / SCALE})
    return out, x0, x1


def find_dropcap(im, dark, st, gl, components):
    """Initiale links vom ersten System: hoechster Tintenfleck links der Linien (ueber 2.5 Linienabstaende).
    Gibt den Buchstaben oder ''."""
    q = st['lines']
    yt = text_top(dark, st, gl) or int(q[3] + 2 * gl)
    xa = max(0, int(st['x0'] - 9 * gl)); xb = int(st['x0'] - 0.1 * gl)
    ya = max(0, int(q[0] - 3.5 * gl)); yb = int(min(dark.shape[0], yt + 2.5 * gl))
    if xb - xa < gl: return ''
    reg = dark[ya:yb, xa:xb]
    best = None
    for runs in components(reg):
        y0 = min(r[0] for r in runs); y1 = max(r[0] for r in runs)
        x0 = min(r[1] for r in runs); x1 = max(r[2] for r in runs)
        if y1 - y0 >= 2.5 * gl and (best is None or y1 - y0 > best[3] - best[1]): best = [x0, y0, x1, y1]
    if best is None: return ''
    # binarisiert, auf 120 px Hoehe, mit Rand; englisches Modell liest Zierbuchstaben hier besser als das lateinische
    m = reg[best[1]:best[3] + 1, best[0]:best[2] + 1]
    bw = Image.fromarray(np.where(m, 0, 255).astype(np.uint8))
    f = 120.0 / bw.height
    bw = bw.resize((max(1, int(bw.width * f)), 120))
    pad = Image.new('L', (bw.width + 80, bw.height + 80), 255); pad.paste(bw, (40, 40))
    return _tesseract_char(pad)


def attach_dropcap(syls, letter):
    if not letter or not syls: return syls
    if syls[0].get('lead'):
        # «-ve»: die Initiale ist eine eigene Silbe, sie steht vor dem Trennstrich
        syls[0]['word'] = False
        return [{'text': letter, 'x': syls[0]['x'] - 1.0, 'word': True}] + syls
    syls[0]['text'] = letter + syls[0]['text']
    return syls


def to_gabc_text(notes, bars, syls, gl):
    """GABC-Zeile mit gelesenem Text. Zuordnung Noten -> Silben ueber dynamische Programmierung:
    Notengruppen (Luecke > 0.8 Linienabstand) monoton auf Silben verteilen; Kosten = Abstand der Gruppe zum
    Bereich unter der Silbe, Strafe fuer jede Silbe ohne Note."""
    if not syls:
        return None
    units = []
    for n in notes:
        if units and n['x'] - units[-1][-1]['x'] <= UNIT_GAP * gl: units[-1].append(n)
        else: units.append([n])
    S = len(syls); U = len(units)
    a = [s['x'] - 0.4 * gl for s in syls]
    b = [a[i + 1] if i + 1 < S else 1e9 for i in range(S)]
    a[0] = -1e9
    def cost(j, i):
        x = units[j][0]['x']
        return 0.0 if a[i] <= x < b[i] else min(abs(x - a[i]), abs(x - b[i])) / gl
    P = 0.8                                             # Strafe fuer eine Silbe ohne Note (in Linienabstaenden)
    INF = 1e18
    groups = [[] for _ in syls]
    if U:
        f = [[INF] * S for _ in range(U)]; bk = [[-1] * S for _ in range(U)]
        for i in range(S): f[0][i] = cost(0, i) + P * i
        for j in range(1, U):
            dx = units[j][0]['x'] - units[j - 1][-1]['x']
            split = SPLIT * max(0.0, 1.0 - dx / (0.9 * gl))   # eng stehende Noten gehoeren eher zur selben Silbe
            M = INF; Mk = -1                            # min ueber k < i von f[j-1][k] - P*k
            for i in range(S):
                cand, ci = f[j - 1][i], i               # gleiche Silbe wie die vorige Gruppe
                if Mk >= 0 and M + P * (i - 1) + split < cand: cand, ci = M + P * (i - 1) + split, Mk
                f[j][i] = cand + cost(j, i); bk[j][i] = ci
                if f[j - 1][i] - P * i < M: M, Mk = f[j - 1][i] - P * i, i
        end = min(range(S), key=lambda i: f[U - 1][i] + P * (S - 1 - i))
        i = end
        for j in range(U - 1, -1, -1):
            groups[i] = units[j] + groups[i]
            i = bk[j][i] if j > 0 else i
    toks = []
    for i, s in enumerate(syls):
        x = groups[i][0]['x'] if groups[i] else s['x']
        toks.append((x, i, s['text'] + '(' + ''.join(n['letter'] for n in groups[i]) + ')', s['word']))
    # Reihenfolge der Silben bleibt; Trennstriche nach x dazwischen
    toks.sort(key=lambda t: t[1])
    xs = []; m = -1e9
    for t in toks: m = max(m, t[0]); xs.append(m)
    toks = [(xs[k],) + t[1:] for k, t in enumerate(toks)]
    toks += [(bb['x'], 1e6, '(' + bb['type'] + ')', True) for bb in bars]
    toks.sort(key=lambda t: (t[0], t[1]))
    out = ''
    for i, (x, _, t, word) in enumerate(toks):
        out += (' ' if i and (word or t[0] == '(' or toks[i - 1][2][0] == '(') else '') + t
    return out
