# Đo số cho các @font-face fallback khớp kích thước trong src/render/font-faces.ts.
#
# Chạy lại khi re-drop một file font, rồi dán bốn con số vào FALLBACKS:
#   python3 scripts/ops/font-fallback-metrics.py      (cần: pip install fonttools brotli)
#
# size-adjust đo bằng bề rộng trung bình trên một mẫu Việt + Anh, đọc advance width từng
# glyph từ chính ba file woff2 đã ship (gộp như unicode-range gộp), đối chiếu font local
# trong máy. KHÔNG dùng OS/2.xAvgCharWidth: nó là trung bình a–z trần, sai cho tiếng Việt.
# Ba override = typo ascent/descent/line-gap của font chính chia (upm × size-adjust).
from fontTools.ttLib import TTFont

SAMPLE = (
  "Vincent van Gogh wrote more than nine hundred letters that survive, and the tool's "
  "behaviour outlives the neglect. "
  "Chữ để đọc phải giữ được nhịp của trang sách: dòng đủ dài, khoảng cách đủ thở, "
  "và dấu thanh tiếng Việt không được chạm vào dòng trên."
)

def load(paths):
    faces = [TTFont(p, fontNumber=0) for p in paths]
    upm = faces[0]['head'].unitsPerEm
    total = n = missing = 0
    for ch in SAMPLE:
        cp = ord(ch)
        w = None
        for f in faces:   # ưu tiên file đứng trước (vietnamese) như unicode-range
            g = f.getBestCmap().get(cp)
            if g is not None:
                w = f['hmtx'][g][0]; break
        if w is None: missing += 1; continue
        total += w; n += 1
    f0 = faces[0]
    os2, hhea = f0['OS/2'], f0['hhea']
    use_typo = bool(os2.fsSelection & 0x80)
    asc, desc, gap = (os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap) if use_typo \
        else (hhea.ascent, hhea.descent, hhea.lineGap)
    return dict(upm=upm, avg=total/n, asc=asc, desc=desc, gap=gap, missing=missing)

F = 'src/assets/static/fonts/'
fonts = {
  'Inter': [F+'inter-vietnamese.woff2', F+'inter-latin-ext.woff2', F+'inter-latin.woff2'],
  'Source Sans 3': [F+'sourcesans-vietnamese.woff2', F+'sourcesans-latin-ext.woff2', F+'sourcesans-latin.woff2'],
  'Literata': [F+'literata-vietnamese.woff2', F+'literata-latin-ext.woff2', F+'literata-latin.woff2'],
  'Source Serif 4': [F+'sourceserif-vietnamese.woff2', F+'sourceserif-latin-ext.woff2', F+'sourceserif-latin.woff2'],
  'Georgia': ['/System/Library/Fonts/Supplemental/Georgia.ttf'],
  'Arial': ['/System/Library/Fonts/Supplemental/Arial.ttf'],
}
m = {k: load(v) for k, v in fonts.items()}
for k, v in m.items():
    print(f"{k:15s} upm={v['upm']:4d} avg/em={v['avg']/v['upm']:.4f} asc={v['asc']} desc={v['desc']} gap={v['gap']} missing={v['missing']}")

def fallback(primary, local):
    p, l = m[primary], m[local]
    size_adjust = (p['avg']/p['upm']) / (l['avg']/l['upm'])
    scale = p['upm'] * size_adjust
    return (round(size_adjust*100,2), round(p['asc']/scale*100,2),
            round(abs(p['desc'])/scale*100,2), round(max(p['gap'],0)/scale*100,2))

print()
for primary, local in [('Inter','Arial'), ('Source Sans 3','Arial'),
                       ('Literata','Georgia'), ('Source Serif 4','Georgia')]:
    sa, a, d, g = fallback(primary, local)
    print(f"{primary:15s} ← {local:8s} size-adjust:{sa}%  ascent:{a}%  descent:{d}%  line-gap:{g}%")
