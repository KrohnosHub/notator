#!/usr/bin/env python3
"""Übernimmt shared/gd-core.js in den Block zwischen /* gd-core:begin … */ und /* gd-core:end */ in index.html.
Aufruf (im Repo-Hauptordner): python3 tools/gd-core-sync.py        → schreibt index.html
                               python3 tools/gd-core-sync.py --check → prüft nur (Exitcode 1, wenn veraltet)"""
import re, sys, os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
core = open(os.path.join(root, 'shared', 'gd-core.js'), encoding='utf-8').read().rstrip('\n') + '\n'
p = os.path.join(root, 'index.html')
s = open(p, encoding='utf-8').read()
pat = re.compile(r'(/\* gd-core:begin[^\n]*\*/\n)(.*?)(/\* gd-core:end \*/)', re.S)
m = pat.search(s)
if not m:
    sys.exit('gd-core-Markierungen in index.html nicht gefunden')
if '</script' in core.lower():
    sys.exit('gd-core.js darf kein </script enthalten')
if '--check' in sys.argv:
    ok = m.group(2) == core
    print('gd-core in index.html ist aktuell' if ok else 'gd-core in index.html ist VERALTET – python3 tools/gd-core-sync.py ausführen')
    sys.exit(0 if ok else 1)
s = s[:m.start(2)] + core + s[m.end(2):]
open(p, 'w', encoding='utf-8').write(s)
print('gd-core in index.html übernommen')
