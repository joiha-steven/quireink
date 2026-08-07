#!/usr/bin/env python3
"""Rebuild the self-hosted webfont subsets in src/assets/static/fonts/.

THIS FILE IS THE THING docs/performance.md USED TO CITE AND NOT HAVE. That doc told you to
"run scripts/subset-font-axes.py after replacing any font file" against a path that has
never existed in this tree, so the one operation nobody could reproduce was the one the
whole font budget rests on. This is that script, written back, and it does more than the
axis trimming the old name implied.

    pip install fonttools brotli zopfli
    python3 scripts/ops/subset-fonts.py --check      # report, write nothing
    python3 scripts/ops/subset-fonts.py --write      # rebuild the files

Sources are downloaded from upstream on each run and cached under .tmp/. They are not
committed: they are 1-2 MB each, they are only needed when a face is rebuilt, and pinning
a copy in the repository is how the shipped subsets drifted from upstream in the first
place.

WHAT THIS DOES, AND WHY EACH PART IS HERE

  Axes.     opsz is PINNED to 18 and wght is CLAMPED to 400-700 (ADR 0009). The optical
            size axis stores a delta per glyph across its whole range and doubled both book
            serifs; 18 is the reading size this site sets. Pinning it is the single largest
            saving in the pipeline and it is not free -- a 32px heading now draws outlines
            drawn for 18px. That trade is the ADR's, recorded there.

  Features. The DEFAULT pyftsubset feature set, plus or minus a named few. Passing an
            explicit list instead is a trap that cost a whole debugging pass here: an
            explicit --layout-features drops every feature not named, and kern/mark/mkmk
            live in GPOS, so a subset built that way loses ALL KERNING. It looks like a 26%
            saving and it is a broken font. GPOS is asserted below for exactly that reason.

  onum.     Restored to the two book serifs. islands.css.ts asks book mode for
            font-feature-settings:"onum" 1,"dlig" 1 -- and no shipped face carried either,
            so the one typographic flourish book mode advertises had never rendered once.
            It costs about 2.8 KB on literata-latin, which is the honest price of the
            feature the stylesheet was already promising.

  calt.     Dropped from JetBrains Mono. That feature is the code-ligature set: it draws
            `=>` as an arrow and `!==` as a struck-through equals WITH NO EXCLAMATION MARK
            ON SCREEN. Fine in an editor where you typed the line; wrong on a page where a
            reader copies it. It is also half the file -- 30,164 B to 14,356 B -- and
            --font-mono resolves to this family on every install, so any post with code
            pays for it whatever typeface the owner picked.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "src", "assets", "static", "fonts")
CACHE = os.path.join(ROOT, ".tmp", "font-sources")

# The unicode ranges, copied from src/render/font-faces.ts. They must agree exactly: a
# range the CSS claims and the file does not carry is a glyph hole, and the reader gets a
# fallback face for that one character with nothing anywhere reporting it.
TEXT = {
    "latin": "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,"
             "U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,"
             "U+2215,U+FEFF,U+FFFD",
    "latin-ext": "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,"
                 "U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,"
                 "U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF,U+FB00-FB06",
    # The combining marks are declared, not implied: Vietnamese stacks a tone mark on a
    # vowel and GPOS `mark` attachment positions it, so a subset carrying no mark to attach
    # loses the feature and sets Vietnamese wrong. MONO already declared them; TEXT did not,
    # and the latin files were carrying them out-of-range to cover for it.
    "vietnamese": "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,"
                  "U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,"
                  "U+1EA0-1EF9,U+20AB",
}
MONO = {
    "latin": TEXT["latin"].replace("U+2074,", ""),
    "latin-ext": TEXT["latin-ext"].replace(",U+FB00-FB06", ""),
    "vietnamese": TEXT["vietnamese"],
}

OPSZ_PIN = 18
WGHT_RANGE = (400, 400, 700)

# THE FEATURE POLICY BELONGS TO THE SUBSET, not to the family, because whether a feature
# can do anything depends on which characters the subset carries. `onum` substitutes digits
# and every ASCII digit lives in `latin`, so asking for it on `latin-ext` buys nothing --
# measured on Literata: +3,700 B for oldstyle forms of numerals that subset does not have.
# `dlig` costs nothing either way and is left to the default.
BOOK_SERIFS = ("literata", "sourceserif")


def features(slug: str, subset: str) -> str:
    if slug == "jetbrainsmono":
        return "--layout-features-=calt"
    # ...and only the BOOK serifs, because only they have oldstyle figures to restore.
    # Inter has none and a monospace has none, so asking is not merely useless there, it
    # makes the build fail its own check for a feature the source never carried.
    if slug in BOOK_SERIFS and subset == "latin":
        return "--layout-features+=onum,dlig"
    return ""


GF = "https://github.com/google/fonts/raw/main/ofl"

# One entry per FILE the site serves, because the mapping is not one-per-family: IBM Plex
# Mono has no variable axis, so its two weights are two sources and two outputs. Keyed by
# the slug src/render/font-faces.ts asks for.
#
#   url  -- upstream source, or None to re-subset the file already shipped
#   axes -- "trim" to instance the variable axes, None to leave a static font alone
#
# Everything comes from upstream. The first pass fed the SHIPPED file back in for JetBrains
# Mono, on the argument that removing one feature from a known-good file is a smaller claim
# than a rebuild -- true, but it made the script non-idempotent: subsetting its own output
# re-rolls the compression and every run produced a diff of about thirty bytes. From
# upstream it is reproducible, 432 B larger, and covers five more of its own declared
# codepoints.
FAMILIES = {
    "literata": (f"https://github.com/googlefonts/literata/raw/main/fonts/variable/"
                 f"Literata%5Bopsz,wght%5D.ttf", TEXT, "trim"),
    "sourceserif": (f"{GF}/sourceserif4/SourceSerif4%5Bopsz,wght%5D.ttf", TEXT, "trim"),
    "inter": (f"{GF}/inter/Inter%5Bopsz,wght%5D.ttf", TEXT, "trim"),
    "sourcesans": (f"{GF}/sourcesans3/SourceSans3%5Bwght%5D.ttf", TEXT, "trim"),
    "plexmono-400": (f"{GF}/ibmplexmono/IBMPlexMono-Regular.ttf", MONO, None),
    "plexmono-600": (f"{GF}/ibmplexmono/IBMPlexMono-SemiBold.ttf", MONO, None),
    "jetbrainsmono": (f"{GF}/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf", MONO, "trim"),
}


def fetch(url: str) -> str:
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, url.rsplit("/", 1)[-1].replace("%5B", "[").replace("%5D", "]"))
    if not os.path.exists(path):
        print(f"   fetching {url}")
        with urllib.request.urlopen(url) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def build(src: str, dest: str, unicodes: str, feature_arg: str, axis_policy: str | None) -> None:
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer

    font = TTFont(src)
    if axis_policy == "trim" and "fvar" in font:
        # wght is CLAMPED, not pinned: the product sets 400, 500, 600 and 700 (FONT_WEIGHTS
        # in themes.ts) and nothing outside them, so the deltas past either end are weight
        # nobody can select. opsz is PINNED, which is the bigger and more contentious saving
        # -- ADR 0009 records that a 32px heading now draws outlines drawn for 18px.
        axes: dict[str, object] = {"wght": WGHT_RANGE}
        if any(a.axisTag == "opsz" for a in font["fvar"].axes):
            axes["opsz"] = OPSZ_PIN
        font = instancer.instantiateVariableFont(font, axes, updateFontNames=False)
    # `head` carries a created/modified timestamp and fontTools stamps `modified` with the
    # clock on every save, so pin both: a rebuild should not differ because of when it ran.
    #
    # That does NOT make the output byte-reproducible, and it is worth writing down so the
    # next person does not go looking. Two runs over the same source still differ by up to
    # ~0.3% -- measured, and not fixed by PYTHONHASHSEED either, so the variance is inside
    # woff2 compression rather than anything this script controls. Re-running therefore
    # produces a small diff even when nothing changed. Do not re-run it for no reason.
    font["head"].created = font["head"].modified = 0
    tmp = dest + ".tmp.ttf"
    font.save(tmp)
    cmd = [sys.executable, "-m", "fontTools.subset", tmp, f"--unicodes={unicodes}",
           "--flavor=woff2", "--with-zopfli", f"--output-file={dest}"]
    if feature_arg:
        cmd.append(feature_arg)
    subprocess.run(cmd, check=True, capture_output=True)
    os.remove(tmp)


def codepoints(declared: str) -> set[int]:
    """The set a `unicode-range` string names, so coverage can be checked against the CSS."""
    out: set[int] = set()
    for part in declared.split(","):
        part = part.strip().removeprefix("U+")
        if "-" in part:
            lo, hi = part.split("-")
            out.update(range(int(lo, 16), int(hi, 16) + 1))
        else:
            out.add(int(part, 16))
    return out


def verify(path: str, source: str, shipped: str, declared: str,
           want: set[str], banned: set[str]) -> list[str]:
    """A rebuilt face keeps its positioning, carries what it was rebuilt for, and covers
    exactly the range the stylesheet claims for it."""
    from fontTools.ttLib import TTFont

    problems: list[str] = []
    f = TTFont(path, lazy=False)
    src = TTFont(source, lazy=False)
    old = TTFont(shipped, lazy=False) if os.path.exists(shipped) else None

    def gpos_features(font) -> set[str]:
        if "GPOS" not in font:
            return set()
        return {fr.FeatureTag for fr in font["GPOS"].table.FeatureList.FeatureRecord}

    # GPOS holds kerning AND mark attachment, so no absolute size means "healthy": a
    # proportional serif carries ~24 KB of kerning and a MONOSPACE carries none at all by
    # definition, only marks. What means something is that no positioning feature the
    # source had has gone missing -- an explicit --layout-features list drops kern/mark/mkmk
    # and yields a font that measures 26% smaller and sets badly. That happened here once.
    lost = (gpos_features(old) if old else set()) - gpos_features(f)
    if lost:
        problems.append(f"lost GPOS features {sorted(lost)}")

    feats = {fr.FeatureTag for fr in f["GSUB"].table.FeatureList.FeatureRecord} if "GSUB" in f else set()
    # onum substitutes DIGITS and every ASCII digit is in `latin`, so pyftsubset drops the
    # feature from a subset that cannot reach one. That is correct, not a failure.
    for t in want - feats:
        if t == "onum" and ord("0") not in f.getBestCmap():
            continue
        problems.append(f"missing feature {t}")
    for t in banned & feats:
        problems.append(f"feature {t} survived and should not have")

    # The file must cover what the CSS claims for it. The shipped subsets did not:
    # literata-latin lacked 11 codepoints inside its own declared range -- dagger,
    # double dagger, per-mille, figure space, superscript four -- while jetbrainsmono-latin
    # carried six Vietnamese combining marks that belong to the vietnamese file. A declared
    # range the file lacks is a silent fallback face for that one character.
    #
    # Compared against what the SOURCE can supply: a range may legitimately name codepoints
    # no font in the world draws (U+FEFF is a zero-width no-break space), so the standard is
    # "everything the source had and the range asks for", not "the whole range".
    reachable = codepoints(declared) & set(src.getBestCmap())
    missing = sorted(reachable - set(f.getBestCmap()))
    if missing:
        problems.append(f"{len(missing)} declared codepoints dropped, e.g. "
                        + " ".join(f"U+{c:04X}" for c in missing[:6]))
    return problems


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="replace the files in src/")
    ap.add_argument("--check", action="store_true", help="build to .tmp/ and report only")
    args = ap.parse_args()
    if not (args.write or args.check):
        ap.error("pass --write or --check")

    stage = os.path.join(ROOT, ".tmp", "font-build")
    os.makedirs(stage, exist_ok=True)
    total_before = total_after = 0
    failed = False

    for slug, (url, ranges, axis_policy) in FAMILIES.items():
        print(f"\n{slug}")
        for subset, unicodes in ranges.items():
            arg = features(slug, subset)
            want = {"onum"} if "+=onum" in arg else set()
            banned = {"calt"} if "-=calt" in arg else set()
            shipped = os.path.join(OUT, f"{slug}-{subset}.woff2")
            src = fetch(url) if url else shipped
            dest = os.path.join(stage, f"{slug}-{subset}.woff2")
            build(src, dest, unicodes, arg, axis_policy)

            before = os.path.getsize(shipped) if os.path.exists(shipped) else 0
            after = os.path.getsize(dest)
            total_before += before
            total_after += after
            problems = verify(dest, src, shipped, unicodes, want, banned)
            flag = "  ** " + "; ".join(problems) if problems else ""
            print(f"   {subset:11s} {before:7d} -> {after:7d} B  ({after - before:+7d}){flag}")
            failed = failed or bool(problems)
            if args.write and not problems:
                os.replace(dest, shipped)

    delta = total_after - total_before
    print(f"\n   total       {total_before:7d} -> {total_after:7d} B  ({delta:+7d})")
    print("   written" if args.write and not failed else "   nothing written")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
