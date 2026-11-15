#!/usr/bin/env python3
"""Pack the app into one HTML file (styles and scripts inlined).

    python3 tools/single-file.py out.html

VexFlow is not inlined: the packed page loads it from the jsDelivr CDN instead of vendor/.
Useful for hosts that take a single page; the files in this repository are the source.
"""
import pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")
CDN = "https://cdn.jsdelivr.net/npm/vexflow@5.0.0/build/cjs/vexflow-bravura.js"

html = html.replace('<script src="vendor/vexflow-bravura.js"></script>', f'<script src="{CDN}"></script>')
html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">',
              lambda m: "<style>\n" + (root / m.group(1)).read_text(encoding="utf-8") + "</style>", html)
scripts = re.findall(r'<script src="(js/[^"]+)"></script>\n', html)
joined = "".join((root / s).read_text(encoding="utf-8") for s in scripts)
first = f'<script src="{scripts[0]}"></script>\n'
html = html.replace(first, "<script>\n" + joined + "</script>\n")
for s in scripts[1:]:
    html = html.replace(f'<script src="{s}"></script>\n', "")
assert 'src="js/' not in html.split("<script>")[0] + html.split("</script>")[-1], "a script tag was left behind"

out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "single.html")
out.write_text(html, encoding="utf-8")
print(f"wrote {out} ({len(html.encode('utf-8'))//1024} KB)")
