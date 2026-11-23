import json, re, sys, collections
S = sys.argv[1]; tag = sys.argv[2]
sy = json.load(open(S + '/neu/systeme.json'))
def soll_tokens(line):
    out = []
    for g in re.findall(r'\(([^)]*)\)', line):
        if re.fullmatch(r'[cf]b?[1-4]', g) or g.strip() in (',', ';', ':', '::'): continue
        g = re.sub(r'\[[^\]]*\]', '', g).replace('z0', ''); g = re.sub(r'[a-m]\+', '', g)
        flat = False; i = 0
        while i < len(g):
            ch = g[i]
            if ch in 'abcdefghijklm' and i + 1 < len(g) and g[i + 1] in 'xy#':
                flat = flat or g[i + 1] == 'x'; i += 2; continue
            if ch.lower() in 'abcdefghijklm':
                j = i + 1
                while j < len(g) and g[j].lower() not in 'abcdefghijklm': j += 1
                mod = g[i + 1:j]
                shape = 'quilisma' if 'w' in mod else 'liquescent' if re.search(r'[~<>]', mod) else 'oriscus' if re.search(r'[oO]', mod) else \
                        'virga' if re.search(r'[vV]', mod) else 'inclinatum' if ch.isupper() else 'stropha' if 's' in mod else 'punctum'
                out.append({'l': ch.lower(), 'shape': shape, 'episema': '_' in mod, 'ictus': "'" in mod, 'flat_before': flat}); flat = False; i = j; continue
            i += 1
    return out
def align(A, B):
    D = [[0] * (len(B) + 1) for _ in range(len(A) + 1)]
    for i in range(len(A) + 1): D[i][0] = i
    for j in range(len(B) + 1): D[0][j] = j
    for i in range(1, len(A) + 1):
        for j in range(1, len(B) + 1): D[i][j] = min(D[i-1][j] + 1, D[i][j-1] + 1, D[i-1][j-1] + (A[i-1] != B[j-1]))
    i, j, pairs = len(A), len(B), []
    while i and j:
        if D[i][j] == D[i-1][j-1] + (A[i-1] != B[j-1]): pairs.append((i-1, j-1)); i -= 1; j -= 1
        elif D[i][j] == D[i-1][j] + 1: i -= 1
        else: j -= 1
    return pairs[::-1]
tp = collections.Counter(); fp = collections.Counter(); fn = collections.Counter(); conf = collections.Counter(); usd = 0
for s in sy:
    exp = json.load(open('tests/pdf-lesen/cases/%s/expected.json' % s['c'])); line = [l for p in exp['pieces'] for l in p.get('systems', [])][s['k'] - 1]
    T = soll_tokens(line); r = json.load(open(S + '/neu/%s/%s-%d.json' % (tag, s['c'][:8], s['k']))); usd += r['usd']
    ki = {e['n']: e for e in r['notes']}
    for i, j in align([n['l'] for n in s['notes']], [t['l'] for t in T]):
        k = ki.get(i + 1); t = T[j]
        if not k: continue
        if t['shape'] != 'punctum' or k['shape'] != 'punctum': conf[(t['shape'], k['shape'])] += 1
        for feat in ('quilisma', 'liquescent', 'oriscus', 'virga', 'inclinatum'):
            a = t['shape'] == feat; b = k['shape'] == feat
            tp[feat] += a and b; fn[feat] += a and not b; fp[feat] += b and not a
        for feat in ('episema', 'ictus', 'flat_before'):
            a = t[feat]; b = k[feat]; tp[feat] += a and b; fn[feat] += a and not b; fp[feat] += b and not a
print('%s: Kosten %.3f USD' % (tag, usd))
print('%-12s %6s %8s %8s' % ('Zeichen', 'Soll', 'gefunden', 'falsch+'))
for f in ('quilisma', 'liquescent', 'oriscus', 'virga', 'inclinatum', 'episema', 'ictus', 'flat_before'):
    print('%-12s %6d %8d %8d' % (f, tp[f] + fn[f], tp[f], fp[f]))
print('Verwechslungen (Soll → KI):', ', '.join('%s→%s %d' % (a, b, n) for (a, b), n in conf.most_common(12)))
