"""Text unter den Notensystemen von der KI lesen lassen, Lage aus Tesseract (Prototyp, Weg 2).

Ein API-Aufruf je Seite: alle Textzeilen der Seite (je System die erste Zeile unter den Linien) werden
untereinander in ein Bild gesetzt und nummeriert; die KI gibt den Text je Zeile mit Silbentrennung zurueck.
Die waagrechte Lage der Woerter kommt von Tesseract (lokal); die KI-Woerter werden darauf ausgerichtet.
Danach verteilt ocr.to_gabc_text die Noten auf die Silben.

Modi (GEOM_TEXT): ki = echter Aufruf (API-Key in NOTATOR_API_KEY, sonst ANTHROPIC_API_KEY),
                  dry = nur Bild und Kostenschaetzung, kein Aufruf,
                  mock = Soll-Text aus expected.json statt KI-Antwort (misst die Zuordnung allein).
"""
import base64, io, json, os, re, time
import numpy as np
from PIL import Image, ImageDraw

import ocr

MODEL = os.environ.get('GEOM_KI_MODEL', 'claude-sonnet-5-5')
EFFORT = os.environ.get('GEOM_KI_EFFORT', 'low')
# USD je 1 Mio. Token (Eingabe, Ausgabe), Stand 11/2026
PRICES = {'claude-sonnet-5-5': (2.0, 10.0), 'claude-haiku-5-5': (0.10, 0.50), 'claude-opus-5-5': (4.0, 20.0)}
LINE_H = int(os.environ.get('GEOM_KI_LINE_H', 64))   # Hoehe einer Textzeile im Bild (px)
BOTTOM = float(os.environ.get('GEOM_KI_BOTTOM', 1.6))  # unterer Rand in Linienabstaenden (Unterlaengen, Kommas)
SPLIT = os.environ.get('GEOM_KI_SPLIT', '1') != '0'  # lange Zeilen in zwei Teile statt verkleinern

PROMPT = """The image shows numbered strips. Each strip is one line of Latin chant text, cut from under a staff of \
square notation in a printed book. Strip 0, if present, is the large decorated initial letter of the piece; it \
belongs in front of the first word of strip 1: write it directly before that word's first letters, with no \
hyphen and no space (e.g. initial "S" + "Al-ve" -> "SAl-ve").
A long strip may be cut into two parts shown on consecutive rows; the second part is marked "N+" and continues \
strip N on the same line. Return such a strip as one entry.

Transcribe the text of every numbered strip exactly as printed:
- Separate words with one space. Mark EVERY syllable boundary inside a word with "-". The print shows hyphens only \
where notes separate the syllables; add the missing ones yourself with the usual syllable division of liturgical \
Latin. Examples: printed "Surré-xit" -> "Sur-ré-xit", "appá-ru-it" -> "ap-pá-ru-it", "omnes" -> "o-mnes", \
"benedícta" -> "be-ne-dí-cta", "GAUDEAMUS" -> "GAU-DE-A-MUS". Do not copy the spacing of the print: no space \
after a hyphen inside a word ("Gló-ri- a" -> "Gló-ri-a").
- Chant books divide before the consonant groups ct, gn, mn, pt, ps, x+consonant stays: "San-ctus", "a-gnus", \
"ó-mni-um", "re-ctos", "ex-sul-tá-te". In "alleluia" the final "ia" is one syllable: "Al-le-lú-ia".
- Keep accents (á é í ó ú ý ǽ) and the ligatures æ œ exactly as printed. Keep punctuation (, . ; : ! ?) at the end of \
its word; look closely to tell a comma (with a small tail below the line) from a full stop.
- Leave out the asterisk *, crosses, verse numbers, and the signs ℣ ℟ and "Ps.".
- If a strip contains no chant text, return an empty string for it.
Return one entry per strip number 1..N."""


def page_strips(im, dark, sts, components):
    """Schneidet je System die Textzeile aus. Gibt (Bild fuer die KI, Liste je System: dict mit Ausschnitt-Koordinaten)."""
    rows = []
    for k, st in enumerate(sts):
        gl = (st['lines'][3] - st['lines'][0]) / 3.0
        yt = ocr.text_top(dark, st, gl)
        if yt is None:
            rows.append(None); continue
        box = (int(st['x0'] - 0.5 * gl), int(yt - 0.35 * gl), int(st['x1'] + 0.5 * gl), int(yt + BOTTOM * gl))
        rows.append({'box': box, 'gl': gl})
    crops = []
    dc = ocr.dropcap_box(dark, sts[0], (sts[0]['lines'][3] - sts[0]['lines'][0]) / 3.0, components) if sts else None
    if dc: crops.append((0, im.crop(dc)))
    for k, r in enumerate(rows):
        if r: crops.append((k + 1, im.crop(r['box'])))
    W = 1600
    parts = []
    for n, c in crops:
        h = LINE_H if n else 2 * LINE_H
        f = h / c.height
        c = c.resize((max(1, int(c.width * f)), h), Image.LANCZOS)
        if n and SPLIT and c.width > W - 70:
            # Lange Zeile an einer Wortluecke nahe der Mitte teilen statt verkleinern (Kommas bleiben lesbar)
            for half in split_strip(c): parts.append((n, half))
            continue
        if c.width > W - 70: c = c.resize((W - 70, int(c.height * (W - 70) / c.width)), Image.LANCZOS)
        parts.append((n, c))
    H = sum(c.height + 10 for _, c in parts) + 10
    img = Image.new('L', (W, H), 255); d = ImageDraw.Draw(img); y = 10
    prev = None
    for n, c in parts:
        d.text((8, y + c.height // 2 - 6), str(n) + ('+' if n == prev else ''), fill=0)
        if n != prev: d.line((0, y - 5, W, y - 5), fill=180)
        img.paste(c, (60, y)); y += c.height + 10; prev = n
    return img, rows


def split_strip(c, maxw=1530):
    """Teilt einen Streifen an der hellsten Spalte (Wortluecke) im mittleren Drittel; Teile hoechstens maxw breit."""
    a = 255 - np.asarray(c.convert('L'), dtype=np.float32)
    col = a.sum(axis=0)
    w = c.width
    lo, hi = w // 3, 2 * w // 3
    k = np.ones(15) / 15
    sm = np.convolve(col, k, mode='same')
    cut = lo + int(np.argmin(sm[lo:hi]))
    out = []
    for part in (c.crop((0, 0, cut, c.height)), c.crop((cut, 0, w, c.height))):
        if part.width > maxw: part = part.resize((maxw, int(part.height * maxw / part.width)), Image.LANCZOS)
        out.append(part)
    return out


def estimate_tokens(img, nlines):
    tin = int(img.width * img.height / 750) + 450          # Bild + Prompt (Faustregel Breite*Hoehe/750)
    tout = 40 * nlines + 300                               # Text + etwas Denken bei effort low [Annahme]
    return tin, tout


def call(img, nlines):
    """Ein Aufruf je Seite. Gibt (Liste Textzeilen, usage-dict)."""
    import anthropic
    buf = io.BytesIO(); img.save(buf, format='PNG')
    data = base64.standard_b64encode(buf.getvalue()).decode('ascii')
    # Basis-URL fest auf die oeffentliche API: ANTHROPIC_BASE_URL der Umgebung ist nicht fuer diese Aufrufe gedacht.
    # Ohne Key-Variable: Platzhalter; der Netzwerk-Proxy der Cloud-Umgebung setzt den hinterlegten Key ein.
    client = anthropic.Anthropic(base_url='https://api.anthropic.com',
                                 api_key=os.environ.get('NOTATOR_API_KEY') or os.environ.get('ANTHROPIC_API_KEY') or 'sk-ant-proxy-placeholder')
    schema = {
        'type': 'object',
        'properties': {'lines': {'type': 'array', 'items': {
            'type': 'object',
            'properties': {'n': {'type': 'integer'}, 'text': {'type': 'string'}},
            'required': ['n', 'text'], 'additionalProperties': False}}},
        'required': ['lines'], 'additionalProperties': False,
    }
    kw = dict(
        model=MODEL, max_tokens=8000,
        output_config={'effort': EFFORT, 'format': {'type': 'json_schema', 'schema': schema}},
        messages=[{'role': 'user', 'content': [
            {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/png', 'data': data}},
            {'type': 'text', 'text': PROMPT + '\nN = %d' % nlines},
        ]}],
    )
    t0 = time.time()
    if MODEL.startswith('claude-haiku'):
        r = client.messages.create(**kw)                   # Haiku: keine serverseitige Ausweichstufe
    else:
        r = client.beta.messages.create(betas=['server-side-fallback-2026-07-01'], fallbacks='default', **kw)
    ms = int((time.time() - t0) * 1000)
    u = r.usage
    pin, pout = PRICES.get(r.model, PRICES.get(MODEL, (0, 0)))
    usage = {'input_tokens': u.input_tokens, 'output_tokens': u.output_tokens,
             'costUsd': (u.input_tokens * pin + u.output_tokens * pout) / 1e6, 'model': r.model, 'ms': ms}
    if r.stop_reason == 'refusal':
        raise RuntimeError('KI hat abgelehnt: %s' % getattr(r, 'stop_details', None))
    if r.stop_reason == 'max_tokens':
        raise RuntimeError('Antwort abgeschnitten (max_tokens)')
    text = ''.join(b.text for b in r.content if b.type == 'text')
    got = {e['n']: e['text'] for e in json.loads(text)['lines']}
    return [clean_line(got.get(k + 1, '')) for k in range(nlines)], usage


def clean_line(t):
    """Gedruckte Abstaende nach Trennstrichen entfernen («Gló-ri- a» -> «Gló-ri-a»); Trennstrich am Zeilenende bleibt."""
    return re.sub(r'-\s+(?=\S)', '-', t.strip())


def mock_lines(exp, nsys):
    """Soll-Text als «KI-Antwort»: Silben mit '-', Woerter mit Leerzeichen, ohne Trennstriche und Noten."""
    out = []
    for p in exp['pieces']:
        for line in p.get('systems', [''] * p.get('systemCount', 0)):
            words = []; cur = ''
            for m in re.finditer(r'([^\s(]*)\(([^)]*)\)(\s*)', line):
                syl, sp = m.group(1), m.group(3)
                syl = re.sub(r'<[^>]*>|[{}]', '', syl)
                if syl: cur = cur + ('-' if cur else '') + syl
                if sp and cur: words.append(cur); cur = ''
            if cur: words.append(cur)
            out.append(' '.join(words))
    return (out + [''] * nsys)[:nsys]


# ── KI-Woerter auf Tesseract-Wortkaesten ausrichten ─────────────────────
def _plain(s):
    import unicodedata
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(ch for ch in s if ch.isalpha() and not unicodedata.combining(ch))
    return s.replace('æ', 'ae').replace('œ', 'oe')


def _dist(a, b):
    a, b = _plain(a), _plain(b)
    if not a or not b: return 1.0
    n, m = len(a), len(b)
    D = list(range(m + 1))
    for i in range(1, n + 1):
        prev, D[0] = D[0], i
        for j in range(1, m + 1):
            cur = min(D[j] + 1, D[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))
            prev, D[j] = D[j], cur
    return D[m] / max(n, m)


def syllables_from_text(text, tess_words, x0, x1):
    """KI-Zeile (Silben mit '-', Woerter mit ' ') -> Silben mit Lage. Lage der Woerter aus den Tesseract-Kaesten,
    per Folgen-Ausrichtung zugeordnet; nicht zugeordnete Woerter werden zwischen den Nachbarn verteilt."""
    kw = [w for w in text.split() if any(ch.isalpha() for ch in w)]
    if not kw: return []
    tw = [w for w in tess_words if any(ch.isalpha() for ch in w['text'])]
    n, m = len(kw), len(tw)
    # Ausrichtung (Editierdistanz auf Wortebene): passen = Buchstaben-Abstand, Luecke = 0.7
    G = 0.7
    D = [[0.0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1): D[i][0] = i * G
    for j in range(1, m + 1): D[0][j] = j * G
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            D[i][j] = min(D[i - 1][j] + G, D[i][j - 1] + G, D[i - 1][j - 1] + _dist(kw[i - 1], tw[j - 1]['text']))
    match = [None] * n
    i, j = n, m
    while i and j:
        if D[i][j] == D[i - 1][j - 1] + _dist(kw[i - 1], tw[j - 1]['text']): match[i - 1] = j - 1; i -= 1; j -= 1
        elif D[i][j] == D[i - 1][j] + G: i -= 1
        else: j -= 1
    # Kaesten: zugeordnet -> Tesseract; sonst Luecke zwischen den Nachbarn nach Buchstabenzahl aufteilen
    boxes = [None] * n
    for k in range(n):
        if match[k] is not None and _dist(kw[k], tw[match[k]]['text']) < 0.75:
            boxes[k] = (tw[match[k]]['x0'], tw[match[k]]['x1'])
    k = 0
    while k < n:
        if boxes[k]: k += 1; continue
        e = k
        while e < n and not boxes[e]: e += 1
        left = boxes[k - 1][1] if k > 0 else x0
        right = boxes[e][0] if e < n else x1
        tot = sum(len(kw[q]) + 1 for q in range(k, e)); pos = left
        for q in range(k, e):
            w = (right - left) * (len(kw[q]) + 1) / max(1, tot)
            boxes[q] = (pos, pos + w * 0.85); pos += w
        k = e
    syls = []
    for k, w in enumerate(kw):
        parts = [p for p in w.split('-') if p]
        a, b = boxes[k]; per = (b - a) / max(1, len(w.replace('-', '')))
        pos = 0
        for q, p in enumerate(parts):
            syls.append({'text': p, 'x': a + pos * per, 'x1': a + (pos + len(p)) * per, 'word': q == 0})
            pos += len(p)
    return syls


# ── Silben auf die Tintengruppen der Textzeile legen (ohne Tesseract) ───
def text_chunks(dark, st, gl):
    """Tintengruppen der ersten Textzeile (Luecke >= 0.2 Linienabstand trennt). Gibt Liste {x0,x1,hyphen}."""
    yt = ocr.text_top(dark, st, gl)
    if yt is None: return []
    xa = max(0, int(st['x0'] - 0.5 * gl)); xb = min(dark.shape[1], int(st['x1'] + 0.5 * gl))
    band = dark[int(yt):min(dark.shape[0], int(yt + 1.3 * gl)), xa:xb]
    dens = band.mean(axis=1)
    yb = len(dens)
    for y in range(int(0.5 * gl), len(dens)):
        if dens[y] < 0.01: yb = y; break
    band = band[:yb]; dens = dens[:yb]
    if not band.size: return []
    body = np.where(dens > 0.5 * dens.max())[0]
    bt, bb = int(body[0]), int(body[-1])
    cols = band.any(axis=0)
    d = np.diff(np.concatenate(([0], cols.view(np.int8), [0])))
    runs = list(zip(np.where(d == 1)[0], np.where(d == -1)[0] - 1))
    groups = []
    for a, b in runs:
        if groups and a - groups[-1][-1][1] < 0.2 * gl: groups[-1].append((a, b))
        else: groups.append([(a, b)])
    out = []
    for g in groups:
        a, b = g[-1]
        rows = np.where(band[:, a:b + 1].any(axis=1))[0]
        hy = False
        if len(rows):
            h = rows[-1] - rows[0] + 1; mid = (rows[0] + rows[-1]) / 2.0
            hy = h < 0.22 * gl and bt + 0.15 * (bb - bt) < mid < bb - 0.15 * (bb - bt) and (b - a) < 0.6 * gl
        if len(g) == 1 and hy:                         # allein stehender Trennstrich gehoert zur Gruppe davor
            if out: out[-1]['hyphen'] = True
            continue
        x1 = g[-2][1] if hy and len(g) > 1 else g[-1][1]   # Trennstrich nicht zur Breite zaehlen
        out.append({'x0': g[0][0] + xa, 'x1': x1 + xa, 'hyphen': hy})
    return out


def syllables_from_chunks(text, chunks, gl, dropcap=False):
    """KI-Silben (Woerter mit ' ', Silben mit '-') auf Tintengruppen legen. Dynamische Programmierung:
    jede Gruppe traegt 1..4 aufeinanderfolgende Silben; Kosten = Breite der Gruppe gegen geschaetzte Breite der Silben,
    Strafe fuer Gruppen ohne Silbe (Stoerzeichen, Sternchen) und fuer Gruppen, die ueber eine Wortgrenze reichen."""
    syls = []
    for w in text.split():
        if not any(ch.isalpha() for ch in w): continue
        parts = [p for p in w.split('-') if p]
        for q, p in enumerate(parts):
            syls.append({'text': p, 'word': q == 0, 'wend': q == len(parts) - 1,
                         'n': len(re.sub(r'[^\w]', '', p)) or 1})
    if not syls: return []
    if dropcap and syls[0]['n'] > 0:
        syls[0]['n'] -= 1                              # erster Buchstabe steht als Initiale ausserhalb der Zeile
    S, C = len(syls), len(chunks)
    if C == 0:
        return None
    cw = sum(c['x1'] - c['x0'] for c in chunks) / max(1, sum(s['n'] for s in syls))   # mittlere Zeichenbreite
    INF = 1e18; L = 4; SKIP = 1.0
    # f[i][j]: Silben 0..i-1 und Gruppen 0..j-1 verbraucht
    f = [[INF] * (C + 1) for _ in range(S + 1)]; bk = [[None] * (C + 1) for _ in range(S + 1)]
    f[0][0] = 0.0
    start = 0
    if syls[0]['n'] == 0:                              # Initiale ist eine ganze Silbe («A-ve»)
        f[1][0] = 0.0; bk[1][0] = ('drop',)
    for i in range(S + 1):
        for j in range(C + 1):
            if f[i][j] >= INF: continue
            if j < C and f[i][j] + SKIP < f[i][j + 1]:             # Gruppe ohne Silbe
                f[i][j + 1] = f[i][j] + SKIP; bk[i][j + 1] = ('skip', i, j)
            if j >= C: continue
            c = chunks[j]; w = c['x1'] - c['x0']
            for r in range(1, L + 1):
                if i + r > S: break
                run = syls[i:i + r]
                est = cw * sum(s['n'] for s in run)
                cost = abs(w - est) / max(cw * 2.5, 1e-6)
                cost += 2.0 * sum(1 for s in run[1:] if s['word'])            # Gruppe ueber eine Wortgrenze
                if c['hyphen'] and run[-1]['wend']: cost += 0.5               # Trennstrich, aber Wortende
                if not c['hyphen'] and not run[-1]['wend']: cost += 0.3       # Wort geht weiter ohne sichtbaren Strich
                if f[i][j] + cost < f[i + r][j + 1]:
                    f[i + r][j + 1] = f[i][j] + cost; bk[i + r][j + 1] = ('take', i, j, r)
    # Ende: alle Silben verbraucht, restliche Gruppen uebersprungen (schon in f enthalten)
    j = min(range(C + 1), key=lambda jj: f[S][jj] + SKIP * (C - jj))
    i = S; assign = {}
    while i > 0 or j > 0:
        b = bk[i][j]
        if b is None: break
        if b[0] == 'drop': i = 0; break
        if b[0] == 'skip': i, j = b[1], b[2]; continue
        _, pi, pj, r = b
        assign[pj] = (pi, r); i, j = pi, pj
    for cj, (pi, r) in assign.items():
        c = chunks[cj]; run = syls[pi:pi + r]; tot = sum(s['n'] for s in run); pos = 0
        for s in run:
            s['x'] = c['x0'] + (c['x1'] - c['x0']) * pos / max(1, tot)
            s['x1'] = c['x0'] + (c['x1'] - c['x0']) * (pos + s['n']) / max(1, tot); pos += s['n']
    # Silben ohne Gruppe: zwischen die Nachbarn legen
    for k, s in enumerate(syls):
        if 'x' not in s:
            left = next((syls[q]['x1'] for q in range(k - 1, -1, -1) if 'x' in syls[q]), chunks[0]['x0'] - gl)
            s['x'] = left + 0.1 * gl; s['x1'] = s['x'] + 0.5 * gl
    return [{'text': s['text'], 'x': s['x'], 'x1': s['x1'], 'word': s['word']} for s in syls]
