#!/usr/bin/env python3
"""Baut index.html aus src/.

  python3 build.py          index.html schreiben
  python3 build.py --check  nur prüfen, ob index.html zu src/ passt (Exitcode 1, wenn nicht)

src/shell.html ist das Gerüst. Jede Zeile «@@include PFAD@@» wird ersetzt durch die Datei src/PFAD bzw. –
bei einem Ordner – durch alle Dateien darin, nach Dateinamen sortiert (010-…, 020-…), aneinandergehängt.
Die Dateien werden unverändert übernommen; es gibt keine weitere Verarbeitung.
"""
import os, re, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
INC = re.compile(r'^@@include ([^@\s]+)@@\n', re.M)


def _rd(p):
    with open(p, encoding='utf-8', newline='') as f:
        return f.read()


def files_for(target):
    p = os.path.join(SRC, target)
    if os.path.isdir(p):
        return [os.path.join(p, f) for f in sorted(os.listdir(p)) if not f.startswith('.')]
    return [p]


def assemble():
    shell = _rd(os.path.join(SRC, 'shell.html'))
    return INC.sub(lambda m: ''.join(_rd(f) for f in files_for(m.group(1))), shell)


if __name__ == '__main__':
    out = assemble()
    target = os.path.join(ROOT, 'index.html')
    if '--check' in sys.argv:
        ok = os.path.exists(target) and _rd(target) == out
        print('index.html passt zu src/' if ok else 'index.html passt NICHT zu src/ – python3 build.py ausführen (oder bei direkter Bearbeitung von index.html: python3 tools/split.py)')
        sys.exit(0 if ok else 1)
    with open(target, 'w', encoding='utf-8', newline='') as f:
        f.write(out)
    print('index.html gebaut (%d KB)' % (len(out.encode('utf-8')) // 1024))
