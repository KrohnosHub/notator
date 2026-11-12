#!/usr/bin/env python3
"""Erzeugt src/js/1-start/005-handler.js aus den data-on…-Attributen in src/body.html.

Hintergrund: Die Content-Security-Policy erlaubt keine Inline-Handler (onclick="…"). In body.html steht der
Handler-Code deshalb als data-onclick="…" (data-oninput, data-onchange, …). Diese Datei macht daraus echte
Funktionen und setzt sie beim Start als Eigenschaft (el.onclick = function (event) {…}) – gleiches Verhalten
wie vorher: this = Element, event verfügbar, «return false» verhindert die Standardaktion.

  python3 tools/handlers.py          Datei neu schreiben (nach Änderungen an data-on…-Attributen in body.html)
  python3 tools/handlers.py --check  nur prüfen (Exitcode 1, wenn veraltet) – läuft in der GitHub Action
"""
import json, os, re, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
BODY = os.path.join(ROOT, 'src', 'body.html')
OUT = os.path.join(ROOT, 'src', 'js', '1-start', '005-handler.js')
ATTR = re.compile(r'\bdata-on([a-z]+)="([^"]*)"')


def rd(p):
    with open(p, encoding='utf-8', newline='') as f:
        return f.read()


def generate():
    body = rd(BODY)
    if re.search(r'\son[a-z]+\s*=', re.sub(r'<script[\s\S]*?</script>', '', body)):
        sys.exit('body.html enthält Inline-Handler (on…=) – als data-on…="…" schreiben (CSP)')
    pairs = sorted(set((ev, code) for ev, code in ATTR.findall(body)))
    if any('&' in c for _, c in pairs):
        sys.exit('HTML-Entities in data-on…-Code werden nicht unterstützt')
    events = sorted(set(ev for ev, _ in pairs))
    lines = [
        '// AUTOMATISCH ERZEUGT von tools/handlers.py aus den data-on…-Attributen in src/body.html – nicht von Hand ändern.',
        '// (Content-Security-Policy: keine Inline-Handler; Code steht als Funktion hier, gesetzt als el.on… = function.)',
        'const NT_INLINE_HANDLERS = {',
    ]
    for ev in events:
        lines.append('  %s: {' % ev)
        for e2, code in pairs:
            if e2 == ev:
                lines.append('    %s: function (event) { %s },' % (json.dumps(code, ensure_ascii=False), code))
        lines.append('  },')
    lines += [
        '};',
        '(function ntBindInlineHandlers() {',
        '  for (const ev in NT_INLINE_HANDLERS) {',
        "    document.querySelectorAll('[data-on' + ev + ']').forEach(el => {",
        "      const fn = NT_INLINE_HANDLERS[ev][el.getAttribute('data-on' + ev)];",
        "      if (fn) el['on' + ev] = fn; else console.warn('Handler fehlt für', ev, el);",
        '    });',
        '  }',
        '})();',
        '',
    ]
    return '\n'.join(lines)


if __name__ == '__main__':
    out = generate()
    if '--check' in sys.argv:
        ok = os.path.exists(OUT) and rd(OUT) == out
        print('005-handler.js ist aktuell' if ok else '005-handler.js ist VERALTET – python3 tools/handlers.py ausführen')
        sys.exit(0 if ok else 1)
    with open(OUT, 'w', encoding='utf-8', newline='') as f:
        f.write(out)
    print('005-handler.js geschrieben (%d Handler)' % out.count('function (event)'))
