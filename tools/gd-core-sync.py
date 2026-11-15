#!/usr/bin/env python3
"""Übernimmt shared/gd-core.js in den Block zwischen /* gd-core:begin … */ und /* gd-core:end */ (in src/js/…)
und baut danach index.html neu.
Aufruf (im Repo-Hauptordner): python3 tools/gd-core-sync.py        → schreibt die Quelldatei + index.html
                               python3 tools/gd-core-sync.py --check → prüft nur (Exitcode 1, wenn veraltet)"""
import re, sys, os, glob
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sys.path.insert(0, root)
import build  # noqa: E402


def rd(p):
    with open(p, encoding='utf-8', newline='') as f:
        return f.read()


core = rd(os.path.join(root, 'shared', 'gd-core.js')).rstrip('\n') + '\n'
pat = re.compile(r'(/\* gd-core:begin[^\n]*\*/\n)(.*?)(/\* gd-core:end \*/)', re.S)
hits = [p for p in glob.glob(os.path.join(root, 'src', '**', '*.js'), recursive=True) if pat.search(rd(p))]
if len(hits) != 1:
    sys.exit('gd-core-Markierungen in src/ %s' % ('nicht gefunden' if not hits else 'mehrfach gefunden: ' + ', '.join(hits)))
p = hits[0]
s = rd(p)
m = pat.search(s)
if '</script' in core.lower():
    sys.exit('gd-core.js darf kein </script enthalten')
if '--check' in sys.argv:
    ok = m.group(2) == core
    print('gd-core in %s ist aktuell' % os.path.relpath(p, root) if ok else 'gd-core ist VERALTET – python3 tools/gd-core-sync.py ausführen')
    sys.exit(0 if ok else 1)
with open(p, 'w', encoding='utf-8', newline='') as f:
    f.write(s[:m.start(2)] + core + s[m.end(2):])
with open(os.path.join(root, 'index.html'), 'w', encoding='utf-8', newline='') as f:
    f.write(build.assemble())
print('gd-core in %s übernommen, index.html neu gebaut' % os.path.relpath(p, root))
