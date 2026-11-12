#!/usr/bin/env python3
"""Überträgt index.html in die Quellen unter src/ (Gegenstück zu build.py).

  python3 tools/split.py --init   einmalig: src/ aus index.html neu anlegen (Aufteilung an «// ── …»-Überschriften)
  python3 tools/split.py          index.html → bestehende src/-Dateien zurückschreiben
                                   (für den Fall, dass index.html direkt bearbeitet wurde, z. B. von einem älteren
                                   Branch). Die Einteilung bleibt; jede Datei wird an ihrer ersten Zeile wiedergefunden.

In beiden Fällen wird danach geprüft, dass build.py wieder exakt dieselbe index.html erzeugt (Byte für Byte);
sonst bricht das Skript ohne Änderung ab.
"""
import os, re, sys, unicodedata
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sys.path.insert(0, ROOT)
import build  # noqa: E402

SRC = os.path.join(ROOT, 'src')
INC = re.compile(r'^@@include ([^@\s]+)@@\n', re.M)


def rd(p):
    with open(p, encoding='utf-8', newline='') as f:
        return f.read()


def wr(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


def slug(t):
    t = t.replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('Ä', 'Ae').replace('Ö', 'Oe').replace('Ü', 'Ue').replace('ß', 'ss')
    t = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode()
    t = re.sub(r'\([^)]*\)', '', t)
    t = re.sub(r'^\s*\d+\.\s*', '', t)
    t = re.sub(r'[^A-Za-z0-9]+', '-', t).strip('-').lower()
    return '-'.join(t.split('-')[:5]) or 'teil'


def chunks_by_headers(code, min_lines=60):
    """Teilt Skriptcode an Zeilen, die mit «// ── » beginnen (Spalte 0). Kleine Stücke werden angehängt."""
    lines = code.splitlines(keepends=True)
    starts = [0] + [i for i, l in enumerate(lines) if l.startswith('// ── ') and i > 0]
    parts = []
    for k, s in enumerate(starts):
        e = starts[k + 1] if k + 1 < len(starts) else len(lines)
        body = ''.join(lines[s:e])
        title = lines[s][6:].strip(' ─-=\n') if lines[s].startswith('// ── ') else 'anfang'
        if parts and (e - s) < min_lines:
            parts[-1][1] += body
        else:
            parts.append([title, body])
    # erstes Stück zu klein? an das zweite anhängen
    if len(parts) > 1 and parts[0][1].count('\n') < min_lines:
        parts[1][1] = parts[0][1] + parts[1][1]
        parts.pop(0)
    return parts


def init():
    html = rd(os.path.join(ROOT, 'index.html'))
    if os.path.exists(SRC):
        sys.exit('src/ existiert schon – --init nur einmalig (oder src/ vorher löschen)')
    # Blöcke: <style>…</style>, <body>…<script>, <script …>…</script>
    blocks = []  # (start, end, ziel)
    pos = 0
    n_style = 0
    for m in re.finditer(r'<style>\n(.*?)</style>', html, re.S):
        n_style += 1
        blocks.append((m.start(1), m.end(1), 'css/%d-stil.css' % n_style, None))
    bm = re.search(r'<body>\n', html)
    first_script = html.index('<script', bm.end())
    blocks.append((bm.end(), first_script, 'body.html', None))
    names = {0: 'js/1-start', 1: 'js/2-choral', 2: 'vendor/exsurge.js', 3: 'js/3-orgel-und-mehr'}
    scripts = list(re.finditer(r'<script(?: id="exsurge-lib")?>\n(.*?)</script>', html, re.S))
    if len(scripts) != 4:
        sys.exit('Erwartet 4 Inline-Skripte, gefunden %d – Aufteilung anpassen' % len(scripts))
    for i, m in enumerate(scripts):
        blocks.append((m.start(1), m.end(1), names[i], 'split' if names[i].startswith('js/') else None))
    blocks.sort()
    shell, last = [], 0
    for s, e, target, mode in blocks:
        shell.append(html[last:s])
        content = html[s:e]
        if mode == 'split':
            parts = chunks_by_headers(content)
            for k, (title, body) in enumerate(parts):
                wr(os.path.join(SRC, target, '%03d-%s.js' % ((k + 1) * 10, slug(title))), body)
        else:
            wr(os.path.join(SRC, target), content)
        shell.append('@@include %s@@\n' % target)
        last = e
    shell.append(html[last:])
    wr(os.path.join(SRC, 'shell.html'), ''.join(shell))


def update():
    real = rd(os.path.join(ROOT, 'index.html'))
    html = build.normalize(real)  # eingesetzte CSP-Hashes wieder als Platzhalter
    shell = rd(os.path.join(SRC, 'shell.html'))
    pieces = INC.split(shell)  # literal, ziel, literal, ziel, …, literal
    pos = 0
    out = {}
    lit0 = pieces[0]
    if not html.startswith(lit0):
        sys.exit('Anfang von index.html passt nicht zu src/shell.html – Kopfbereich bitte von Hand in shell.html übernehmen')
    pos = len(lit0)
    for i in range(1, len(pieces), 2):
        target, lit = pieces[i], pieces[i + 1]
        end = html.find(lit, pos) if i + 2 < len(pieces) else len(html) - len(lit)
        if end < 0 or (i + 2 >= len(pieces) and not html.endswith(lit)):
            sys.exit('Abschnitt nach %s nicht gefunden – shell.html wurde in index.html verändert; bitte von Hand übertragen' % target)
        content = html[pos:end]
        files = build.files_for(target)
        if len(files) == 1 and not os.path.isdir(os.path.join(SRC, target)):
            out[files[0]] = content
        else:
            # jede Datei an ihrer (unveränderten) ersten Zeile wiederfinden
            cur = 0
            starts = []
            for f in files:
                first = rd(f).split('\n', 1)[0] + '\n'
                k = 0 if not starts else content.find('\n' + first, cur) + 1
                if starts and k <= 0:
                    sys.exit('Erste Zeile von %s nicht gefunden – Datei-Anfang wurde geändert; bitte von Hand übertragen' % os.path.relpath(f, ROOT))
                starts.append(k)
                cur = k + 1
            for j, f in enumerate(files):
                out[f] = content[starts[j]:(starts[j + 1] if j + 1 < len(files) else len(content))]
        pos = end + len(lit)
    changed = [f for f, c in out.items() if rd(f) != c]
    backup = {f: rd(f) for f in changed}
    for f in changed:
        wr(f, out[f])
    new = build.assemble()
    if build.normalize(new) != html:
        for f, c in backup.items():
            wr(f, c)
        sys.exit('Rückübertragung ergibt nicht dieselbe index.html – nichts geändert')
    print('%d Datei(en) in src/ aktualisiert' % len(changed) + (':\n  ' + '\n  '.join(os.path.relpath(f, ROOT) for f in changed) if changed else ''))
    if new != real:  # nur die CSP-Hashes passten nicht (Skript direkt geändert): index.html mit richtigen Hashes neu schreiben
        wr(os.path.join(ROOT, 'index.html'), new)
        print('CSP-Hashes in index.html aktualisiert')


if __name__ == '__main__':
    if '--init' in sys.argv:
        init()
        if build.assemble() != rd(os.path.join(ROOT, 'index.html')):
            sys.exit('FEHLER: build.py ergibt nicht dieselbe index.html')
        print('src/ angelegt; build.py ergibt exakt dieselbe index.html')
    else:
        update()
