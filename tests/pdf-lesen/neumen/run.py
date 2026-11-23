import json, base64, subprocess, sys, re, os
S = sys.argv[1]; model = sys.argv[2]; effort = sys.argv[3]; tag = sys.argv[4]
sy = json.load(open(S + '/neu/systeme.json'))
PROMPT = """The image shows one line (staff) of Gregorian chant in square notation from a printed book (Solesmes style), split into two halves shown one above the other. Below each half, red numbers with small red ticks mark note heads that were already found; the tick points at the horizontal position of that note head (stacked note heads share nearly the same position; numbers alternate between two rows only to avoid overlap).
For every numbered note, look closely at the printed shape at that position and report:
- shape: "punctum" (plain square), "virga" (square with a thin vertical stem on its RIGHT side going down), "quilisma" (jagged, wavy/zigzag note), "liquescent" (small/reduced note head or a note with a small curved tail, usually the last note of a neume), "oriscus" (note with a wavy/hooked outline, often at the end of a neume or repeated note), "inclinatum" (diamond / rhombus), "stropha" or "other". Notes connected by thin lines (pes, clivis, porrectus) are still "punctum" unless one of the special shapes applies.
- episema: true if a short horizontal dash is printed directly above or below this note (not a staff line).
- ictus: true if a small vertical stroke is printed directly below (or above) this note head (not a stem connecting two notes).
- flat_before: true if a flat sign (b) is printed immediately before this note.
Return one entry for every number shown."""
schema = {'type': 'object', 'properties': {'notes': {'type': 'array', 'items': {'type': 'object', 'properties': {
    'n': {'type': 'integer'}, 'shape': {'type': 'string', 'enum': ['punctum', 'virga', 'quilisma', 'liquescent', 'oriscus', 'inclinatum', 'stropha', 'other']},
    'episema': {'type': 'boolean'}, 'ictus': {'type': 'boolean'}, 'flat_before': {'type': 'boolean'}},
    'required': ['n', 'shape', 'episema', 'ictus', 'flat_before'], 'additionalProperties': False}}},
    'required': ['notes'], 'additionalProperties': False}
os.makedirs(S + '/neu/' + tag, exist_ok=True); tot = 0
for s in sy:
    png = S + '/neu/%s-%d.png' % (s['c'][:8], s['k'])
    body = {'model': model, 'max_tokens': 16000, 'output_config': {'effort': effort, 'format': {'type': 'json_schema', 'schema': schema}},
            'messages': [{'role': 'user', 'content': [{'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/png', 'data': base64.b64encode(open(png, 'rb').read()).decode()}},
                         {'type': 'text', 'text': PROMPT + '\nThere are %d numbered notes.' % len(s['notes'])}]}]}
    open(S + '/neu/_req.json', 'w').write(json.dumps(body))
    r = json.loads(subprocess.run(['curl', '-sS', 'https://api.anthropic.com/v1/messages', '-H', 'content-type: application/json', '-H', 'x-api-key: ' + os.environ['NOTATOR_API_KEY'],
                                   '-H', 'anthropic-version: 2023-06-01', '--data-binary', '@' + S + '/neu/_req.json'], capture_output=True, text=True).stdout)
    if 'content' not in r: print(r); continue
    u = r['usage']; pr = {'claude-sonnet-5-5': (2, 10), 'claude-opus-5-5': (4, 20)}[model]; usd = (u['input_tokens'] * pr[0] + u['output_tokens'] * pr[1]) / 1e6; tot += usd
    ans = json.loads(''.join(b['text'] for b in r['content'] if b['type'] == 'text'))
    json.dump({'usage': u, 'usd': usd, 'notes': ans['notes']}, open(S + '/neu/%s/%s-%d.json' % (tag, s['c'][:8], s['k']), 'w'))
    print(s['c'][:8], s['k'], 'Token', u['input_tokens'], u['output_tokens'], '%.4f USD' % usd)
print('Summe %.3f USD' % tot)
