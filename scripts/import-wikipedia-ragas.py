#!/usr/bin/env python3
"""Import named raga scales from Wikipedia into public/raga-wiki-lexicon.js.

Sources (CC BY-SA 4.0): https://en.wikipedia.org/wiki/List_of_Janya_ragas and the raga articles in
Category:Hindustani ragas, Category:Janya ragas, Category:Carnatic ragas, and Category:Ragas.

Usage: python3 -I scripts/import-wikipedia-ragas.py <empty-download-dir> public/raga-wiki-lexicon.js
"""
import json, os, re, sys, time, unicodedata, urllib.parse, urllib.request

UA = "swaraga-raga-importer/1.0 (https://github.com/hemanth/swaraga)"
src_dir, out_path = sys.argv[1], sys.argv[2]
os.makedirs(src_dir, exist_ok=True)

def api(params):
    req = urllib.request.Request("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({**params, "format": "json"}),
                                 headers={"User-Agent": UA})
    return json.load(urllib.request.urlopen(req))

def category_members(cat):
    data = api({"action": "query", "list": "categorymembers", "cmtitle": f"Category:{cat}", "cmlimit": "500", "cmtype": "page"})
    json.dump(data, open(f"{src_dir}/cat_{cat}.json", "w"))
    return [m["title"] for m in data["query"]["categorymembers"]]

# --- fetch ---
janya_req = urllib.request.Request("https://en.wikipedia.org/w/index.php?title=List_of_Janya_ragas&action=raw", headers={"User-Agent": UA})
open(f"{src_dir}/List_of_Janya_ragas.wiki", "w", encoding="utf-8").write(urllib.request.urlopen(janya_req).read().decode("utf-8"))
titles = []
for cat in ["Hindustani_ragas", "Janya_ragas", "Carnatic_ragas", "Ragas"]:
    titles += category_members(cat)
titles = sorted(set(titles))
pages = {}
for i in range(0, len(titles), 50):
    data = api({"action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main",
                "formatversion": "2", "titles": "|".join(titles[i:i + 50])})
    for p in data["query"]["pages"]:
        if "revisions" in p:
            pages[p["title"]] = p["revisions"][0]["slots"]["main"]["content"]
    time.sleep(1)
json.dump(pages, open(f"{src_dir}/pages.json", "w"))

# --- parse ---
# Carnatic svaraC tokens and Hindustani svaraH tokens (lowercase = komal, m = shuddha Ma, M = tivra Ma)
# mapped to the pitch-based swara ids of SWARA_TABLE
C_MAP = {'S': 'S', 'R1': 'r1', 'R2': 'R2', 'R3': 'g2', 'G1': 'R2', 'G2': 'g2', 'G3': 'G3', 'M1': 'M1', 'M2': 'M2',
         'P': 'P', 'D1': 'd1', 'D2': 'D2', 'D3': 'n2', 'N1': 'D2', 'N2': 'n2', 'N3': 'N3'}
H_MAP = {'S': 'S', 'r': 'r1', 'R': 'R2', 'g': 'g2', 'G': 'G3', 'm': 'M1', 'M': 'M2', 'P': 'P',
         'd': 'd1', 'D': 'D2', 'n': 'n2', 'N': 'N3'}

def parse_template(text):
    """Return swara-id token list for the first svaraC/svaraH template in text, or None."""
    m = re.search(r"\{\{\s*svara([CH])\s*\|([^{}]*)\}\}", text)
    if not m:
        return None
    kind, body = m.group(1), m.group(2)
    table = C_MAP if kind == 'C' else H_MAP
    tokens = []
    for raw in body.split('|'):
        raw = raw.strip()
        if not raw or '=' in raw or raw in (',', '.', '-'):
            continue
        tok = raw.strip("'’‘.,()").strip()
        if kind == 'C':
            # Carnatic notation is case-insensitive and may use subscript digits (R₂)
            tok = tok.upper().translate(str.maketrans('₁₂₃', '123'))
        elif tok in ('M̄', 'M\u0304'):
            tok = 'M'
        if tok not in table:
            return None  # unknown token: reject the whole scale rather than guess
        tokens.append(table[tok])
    return tokens if tokens else None

def ascii_name(name):
    name = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", name)
    name = re.sub(r"\(.*?\)", "", name)
    name = re.sub(r"<.*?>", "", name)
    name = name.replace("'''", "").replace("''", "")
    name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode()
    name = re.sub(r"[^A-Za-z \-]", "", name).strip()
    return ' '.join(w[:1].upper() + w[1:].lower() for w in name.split())

def slug(name):
    return re.sub(r"[^a-z]+", "_", name.lower()).strip('_')

def valid(aroha, avaroha):
    sw = set(aroha) | set(avaroha)
    return 'S' in sw and len(sw) >= 4 and len(set(aroha)) >= 3 and len(set(avaroha)) >= 3

THAATS = {'kalyan': 'Kalyan', 'kalyaan': 'Kalyan', 'bilawal': 'Bilawal', 'bilaval': 'Bilawal', 'khamaj': 'Khamaj',
          'bhairav': 'Bhairav', 'poorvi': 'Poorvi', 'purvi': 'Poorvi', 'marwa': 'Marwa', 'marva': 'Marwa', 'kafi': 'Kafi',
          'asavari': 'Asavari', 'bhairavi': 'Bhairavi', 'todi': 'Todi'}

# Rows whose source scale contradicts the raga's established grammar
KNOWN_SOURCE_ERRORS = {
    'amritvarshini': 'Hindustani article writes shuddha Ma (m); the raga uses tivra Ma',
}

rows = {}
mela_aliases = {}

# 1. Janya list (Carnatic), grouped under melakarta header rows
janya = open(f"{src_dir}/List_of_Janya_ragas.wiki", encoding='utf-8').read()
mela = None
for line in janya.splitlines():
    if not line.startswith('|') or line.startswith('|-') or line.startswith('|}'):
        continue
    cells = line[1:].split('||')
    if len(cells) < 3:
        continue
    name_cell = cells[0]
    header = re.match(r"\s*'''\s*(\d{1,2})\s+(.*?)'''", name_cell)
    if header:
        mela = int(header.group(1))
        mela_aliases.setdefault(mela, set()).add(ascii_name(header.group(2)))
        continue
    name = ascii_name(name_cell)
    aroha, avaroha = parse_template(cells[1]), parse_template(cells[2])
    if not name or mela is None or not aroha or not avaroha or not valid(aroha, avaroha):
        continue
    sid = slug(name)
    if sid not in rows:
        rows[sid] = {'id': sid, 'name': name, 'trad': 'C', 'parent': mela,
                     'aroha': ' '.join(aroha), 'avaroha': ' '.join(avaroha), 'source': 'List of Janya ragas'}

# 2. Individual raga articles with infobox templates
pages = json.load(open(f"{src_dir}/pages.json", encoding='utf-8'))
hindustani_titles = {m['title'] for m in json.load(open(f"{src_dir}/cat_Hindustani_ragas.json"))['query']['categorymembers']}
for title, text in pages.items():
    a = re.search(r"\|\s*(?:arohana|arohanam|aarohanam)\s*=\s*(.*)", text, re.I)
    v = re.search(r"\|\s*(?:avarohana|avarohanam|avrohana|abarohana)\s*=\s*(.*)", text, re.I)
    if not a or not v:
        continue
    aroha, avaroha = parse_template(a.group(1)), parse_template(v.group(1))
    if not aroha or not avaroha or not valid(aroha, avaroha):
        continue
    name = ascii_name(title)
    sid = slug(name)
    trad = 'H' if title in hindustani_titles else 'C'
    thaat = re.search(r"\|\s*thaat\s*=\s*\[*([A-Za-z]+)", text, re.I)
    mela_m = re.search(r"\|\s*(?:mela|melakarta)\s*=[^|\n]*?(\d{1,2})", text, re.I)
    if trad == 'H':
        parent = THAATS.get(thaat.group(1).lower()) if thaat else None
    else:
        parent = int(mela_m.group(1)) if mela_m and 1 <= int(mela_m.group(1)) <= 72 else None
    rows.setdefault(sid, {'id': sid, 'name': name, 'trad': trad, 'parent': parent,
                          'aroha': ' '.join(aroha), 'avaroha': ' '.join(avaroha), 'source': title})


# --- emit ---
for bad in KNOWN_SOURCE_ERRORS:
    rows.pop(bad, None)
out_rows = []
for r in sorted(rows.values(), key=lambda r: r['id']):
    out_rows.append([r['id'], r['name'], r['trad'], r['parent'], r['aroha'], r['avaroha']])
with open(out_path, 'w', encoding='utf-8') as f:
    f.write("// GENERATED by scripts/import-wikipedia-ragas.py — do not edit by hand.\n")
    f.write("// Raga scales from Wikipedia (List of Janya ragas and raga articles), CC BY-SA 4.0:\n")
    f.write("// https://en.wikipedia.org/wiki/List_of_Janya_ragas\n")
    f.write("// Rows: [id, name, tradition, parent (melakarta number, thaat name, or null), aroha, avaroha]\n")
    f.write("// Only {{svaraC}}/{{svaraH}} template scales are imported; plain-text notation is ambiguous.\n\n")
    f.write("export const WIKI_RAGA_ROWS = [\n")
    f.write(",\n".join("  " + json.dumps(r, ensure_ascii=True) for r in out_rows))
    f.write("\n];\n\nexport const WIKI_MELAKARTA_ALIASES = ")
    f.write(json.dumps({str(k): sorted(v) for k, v in sorted(mela_aliases.items())}, indent=2))
    f.write(";\n")
print(len(out_rows), 'rows;', sum(1 for r in out_rows if r[2] == 'H'), 'hindustani')
