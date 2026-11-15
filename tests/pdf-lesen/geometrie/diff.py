#!/usr/bin/env python3
"""Zeigt je System Soll- und Ist-Tonhoehenfolge nebeneinander (Fehlersuche).
Aufruf: python3 tests/pdf-lesen/geometrie/diff.py [serie]
Die massgebliche Auswertung macht evaluate.js; dies ist nur eine Lesehilfe."""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
series = sys.argv[1] if len(sys.argv) > 1 else 'geom-v1'


def notes(line):
    out = []
    for f in re.findall(r'\(([^)]*)\)', line or ''):
        if re.fullmatch(r'(?:c|f)b?[1-4]', f): continue
        f = re.sub(r'\[[^\]]*\]|z0|[a-m]\+|[a-m][xy#]', '', f)
        out.append(''.join(re.findall(r'[a-m]', f.lower())))
    return [g for g in out if g]


def align(a, b):
    n, m = len(a), len(b)
    D = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1): D[i][0] = i
    for j in range(m + 1): D[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            D[i][j] = min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (a[i - 1] != b[j - 1]))
    i, j, ra, rb = n, m, [], []
    while i or j:
        if i and j and D[i][j] == D[i - 1][j - 1] + (a[i - 1] != b[j - 1]): ra.append(a[i - 1]); rb.append(b[j - 1]); i -= 1; j -= 1
        elif i and D[i][j] == D[i - 1][j] + 1: ra.append(a[i - 1]); rb.append('-'); i -= 1
        else: ra.append('-'); rb.append(b[j - 1]); j -= 1
    return ''.join(ra[::-1]), ''.join(rb[::-1]), D[n][m]


tot = err = 0
for case in sorted(os.listdir(os.path.join(ROOT, 'cases'))):
    rf = os.path.join(ROOT, 'runs', series, case, 'run-01.json')
    if not os.path.exists(rf): continue
    exp = json.load(open(os.path.join(ROOT, 'cases', case, 'expected.json'))); run = json.load(open(rf))
    for pi, ep in enumerate(exp['pieces']):
        if 'systems' not in ep: continue
        act = run['pieces'][pi]['systems'] if pi < len(run['pieces']) else []
        for si, el in enumerate(ep['systems']):
            e = ''.join(notes(el)); a = ''.join(notes(act[si] if si < len(act) else ''))
            ra, rb, d = align(e, a); tot += len(e); err += d
            mark = ''.join(' ' if x == y else '^' for x, y in zip(ra, rb))
            print('%s %d.%d  Soll %s  (%d Noten, %d Fehler)\n%s Ist  %s\n%s      %s' % (case, pi + 1, si + 1, ra, len(e), d, ' ' * (len(case) + 4), rb, ' ' * (len(case) + 4), mark))
print('Gesamt: %d Noten, %d Fehler, %.0f %% (je System ausgerichtet)' % (tot, err, 100 * (1 - err / max(1, tot))))
