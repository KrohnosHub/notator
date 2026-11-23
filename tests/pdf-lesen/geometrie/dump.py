#!/usr/bin/env python3
"""Referenz fuer den JS-Test (tests/pdf-geometrie.test.js): Zwischenergebnisse je System als JSON.
Aufruf: python3 tests/pdf-lesen/geometrie/dump.py BILD.pgm AUSGABE.json [KI-ANTWORT.json]"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('GEOM_TEXT', 'cache')
import numpy as np
from PIL import Image
import geom, ocr, text_ki

im = Image.open(sys.argv[1]).convert('L')
im, sts, g, ang = geom.staves(im)
if os.environ.get('DUMP_ROT'): im.save(os.environ['DUMP_ROT'])
arr = np.array(im)
thr = int((geom.otsu(arr) + float(np.median(arr))) / 2)
dark = arr < thr
sizes = [sz for st in sts for sz in geom.analyse_staff(dark, st, g)[0]]
ref = (float(np.median([a for a, _ in sizes])), float(np.median([w for _, w in sizes]))) if sizes else (0.2 * g * g, 0.45 * g)
dcs = []
for st in sts:
    d = ocr.dropcap_box(dark, st, (st['lines'][3] - st['lines'][0]) / 3.0, geom.components, sts)
    if d and any(p and d[0] < p[2] and p[0] < d[2] and d[1] < p[3] and p[1] < d[3] for p in dcs): d = None
    dcs.append(d)
ki = json.load(open(sys.argv[3]))['lines'] if len(sys.argv) > 3 else None
out = {'angle': ang, 'gap': g, 'thr': thr, 'ref': ref, 'staves': []}
for k, st in enumerate(sts):
    notes, gl = geom.analyse_staff(dark, st, g, None, ref)
    bars = geom.find_bars(st)
    chunks = text_ki.text_chunks(dark, st, gl)
    e = {'lines': [float(v) for v in st['lines']], 'x0': st['x0'], 'x1': st['x1'],
         'letters': ''.join(n['letter'] for n in notes), 'noteX': [round(n['x'], 1) for n in notes],
         'bars': [[round(b['x'], 1), b['type']] for b in bars], 'clef': geom.find_clef(st),
         'dropcap': list(dcs[k]) if dcs[k] else None, 'textTop': ocr.text_top(dark, st, gl),
         'chunks': [[c['x0'], c['x1'], c['hyphen']] for c in chunks]}
    if ki is not None:
        syls = text_ki.syllables_from_chunks(text_ki.clean_line(ki[k]), chunks, gl, dropcap=(dcs[k] is not None))
        e['gabc'] = ocr.to_gabc_text(notes, bars, syls, gl) if syls is not None else None
    out['staves'].append(e)
json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1, default=lambda o: o.item() if hasattr(o, 'item') else str(o))
print('%s: %d Systeme' % (sys.argv[1], len(sts)))
