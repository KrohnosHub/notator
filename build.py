#!/usr/bin/env python3
"""Baut index.html aus src/.

  python3 build.py          index.html schreiben
  python3 build.py --check  nur prüfen, ob index.html zu src/ passt (Exitcode 1, wenn nicht)

src/shell.html ist das Gerüst. Jede Zeile «@@include PFAD@@» wird ersetzt durch die Datei src/PFAD bzw. –
bei einem Ordner – durch alle Dateien darin, nach Dateinamen sortiert (010-…, 020-…), aneinandergehängt.
Die Dateien werden unverändert übernommen. Einzige Nachbearbeitung: der Platzhalter CSP_SCRIPT_HASHES in der
Content-Security-Policy wird durch die SHA-256-Hashes aller Inline-Skripte ersetzt.
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


# Content-Security-Policy: Platzhalter in shell.html wird durch die Hashes aller Inline-Skripte ersetzt
CSP_PLACEHOLDER = 'CSP_SCRIPT_HASHES'
CSP_HASHES_RX = re.compile(r"'sha256-[A-Za-z0-9+/=]+'(?: 'sha256-[A-Za-z0-9+/=]+')*")
INLINE_SCRIPT_RX = re.compile(r'<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>')


def csp_hashes(html):
    import base64, hashlib
    return ' '.join("'sha256-" + base64.b64encode(hashlib.sha256(x.encode('utf-8')).digest()).decode() + "'"
                    for x in INLINE_SCRIPT_RX.findall(html))


def normalize(html):
    """Gegenstück zu den eingesetzten Hashes (für tools/split.py)."""
    return CSP_HASHES_RX.sub(CSP_PLACEHOLDER, html, count=1)


def assemble():
    shell = _rd(os.path.join(SRC, 'shell.html'))
    out = INC.sub(lambda m: ''.join(_rd(f) for f in files_for(m.group(1))), shell)
    if CSP_PLACEHOLDER in out:
        assert out.count(CSP_PLACEHOLDER) == 1, 'CSP-Platzhalter mehrfach vorhanden'
        out = out.replace(CSP_PLACEHOLDER, csp_hashes(out))
    return out


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
