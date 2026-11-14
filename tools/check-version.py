#!/usr/bin/env python3
"""Prüft bei einem Pull Request, dass Build-Nummer (NOTATOR_BUILD_ID) und Cache-Version (sw.js) höher sind
als auf dem Ziel-Branch – verhindert doppelte Build-Nummern bei parallel entwickelten Branches.
Aufruf: python3 tools/check-version.py [Ziel-Ref, Standard origin/main]
Nur relevant, wenn index.html oder sw.js geändert wurden; sonst wird nichts verlangt."""
import re, subprocess, sys
base = sys.argv[1] if len(sys.argv) > 1 else 'origin/main'
def show(path):
    try:
        return subprocess.run(['git', 'show', base + ':' + path], capture_output=True, text=True, check=True).stdout
    except subprocess.CalledProcessError:
        sys.exit('Ziel-Branch ' + base + ' nicht gefunden (git fetch origin main?)')
def rd(p):
    with open(p, encoding='utf-8', newline='') as f:
        return f.read()
def num(rx, text, what):
    m = re.search(rx, text)
    if not m:
        sys.exit(what + ' nicht gefunden')
    return int(m.group(1))
idx, sw = rd('index.html'), rd('sw.js')
idx0, sw0 = show('index.html'), show('sw.js')
if idx == idx0 and sw == sw0:
    print('index.html und sw.js unverändert – keine neue Build-Nummer nötig'); sys.exit(0)
B = r"NOTATOR_BUILD_ID = '(\d+)'"
C = r"const CACHE = 'notator-v(\d+)'"
b, b0 = num(B, idx, 'NOTATOR_BUILD_ID'), num(B, idx0, 'NOTATOR_BUILD_ID (Ziel)')
c, c0 = num(C, sw, 'CACHE'), num(C, sw0, 'CACHE (Ziel)')
print('Build: PR %d | %s %d   Cache: PR v%d | %s v%d' % (b, base, b0, c, base, c0))
err = []
if b <= b0: err.append('NOTATOR_BUILD_ID muss höher sein als %d' % b0)
if c <= c0: err.append("CACHE in sw.js muss höher sein als notator-v%d" % c0)
if err:
    print('::error::' + '; '.join(err) + '. Vermutlich wurde main inzwischen weiterentwickelt: '
          'Branch auf main bringen, Nummern erhöhen (src/…, sw.js), python3 build.py.')
    sys.exit(1)
print('ok')
