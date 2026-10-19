"""Build/check the mobile timetable UI font without changing application dependencies.

Use FontTools 4.61.1 and Brotli 1.2.0 in an isolated build-tool directory.
Run with --source PATH/TO/PretendardVariable.woff2; add --check to verify outputs.
Source: https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2
characters.txt contains the audited ko/en 390px UI, ASCII, and weather states;
course names are deliberately left to the unchanged original font fallback.
"""

import argparse
import hashlib
import io
import json
from pathlib import Path

import brotli
import fontTools
from fontTools import subset
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = ROOT / "app/fonts/syu-timetable-ui"
FONT_PATH = FONT_DIR / "SyuTimetableUI.woff2"
CSS_PATH = ROOT / "app/academic/timetable/timetable-font.css"
SOURCE_SHA = "9599f12fd42fc0bce1cd50b47a0c022e108d7aa64dd0d1bb0ed44f3282d900b4"
FAMILY = "SYU Timetable UI"


def unicode_ranges(codepoints):
    groups = []
    for codepoint in sorted(codepoints):
        if groups and codepoint == groups[-1][1] + 1:
            groups[-1][1] = codepoint
        else:
            groups.append([codepoint, codepoint])
    return ", ".join(
        f"U+{start:X}" + (f"-{end:X}" if start != end else "")
        for start, end in groups
    )


def axes(font):
    return [(axis.axisTag, axis.minValue, axis.defaultValue, axis.maxValue)
            for axis in font["fvar"].axes]


def line_metrics(font):
    return [getattr(font[table], field) for table, field in (
        ("head", "unitsPerEm"), ("hhea", "ascent"), ("hhea", "descent"),
        ("hhea", "lineGap"), ("OS/2", "sTypoAscender"),
        ("OS/2", "sTypoDescender"), ("OS/2", "sTypoLineGap"),
        ("OS/2", "usWinAscent"), ("OS/2", "usWinDescent"),
    )]


def verify(source, output, codepoints):
    original_cmap = source.getBestCmap()
    cmap = output.getBestCmap()
    assert codepoints <= cmap.keys(), "Generated font is missing requested characters"
    assert axes(output) == axes(source), "Variable font axes changed"
    assert line_metrics(output) == line_metrics(source), "Line metrics changed"
    assert output["head"].created == source["head"].created
    assert output["head"].modified == source["head"].modified
    assert output["name"].getDebugName(1) == FAMILY
    assert output["name"].getDebugName(16) == FAMILY
    assert all("Pretendard" not in record.toUnicode() for record in output["name"].names
               if record.nameID in (1, 3, 4, 6, 16, 25)), "Reserved font name remains in a primary name"
    source_features = {record.FeatureTag for record in source["GSUB"].table.FeatureList.FeatureRecord}
    features = {record.FeatureTag for record in output["GSUB"].table.FeatureList.FeatureRecord}
    assert {"tnum", "pnum", "zero"} & source_features <= features, "Numeric OpenType features were removed"
    for weight in (400, 600, 700):
        original_glyphs = source.getGlyphSet(location={"wght": weight})
        glyphs = output.getGlyphSet(location={"wght": weight})
        for codepoint in codepoints:
            original = original_glyphs[original_cmap[codepoint]]
            glyph = glyphs[cmap[codepoint]]
            original_pen = DecomposingRecordingPen(original_glyphs)
            pen = DecomposingRecordingPen(glyphs)
            original.draw(original_pen)
            glyph.draw(pen)
            assert pen.value == original_pen.value, f"Outline changed: U+{codepoint:04X} at {weight}"
            assert glyph.width == original.width, f"Advance changed: U+{codepoint:04X} at {weight}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    assert fontTools.version == "4.61.1" and brotli.__version__ == "1.2.0", "Use the pinned build-tool versions"
    assert hashlib.sha256(args.source.read_bytes()).hexdigest() == SOURCE_SHA, "Unexpected original font"
    assert (FONT_DIR / "LICENSE.txt").read_bytes() == (ROOT / "app/fonts/pretendard-v1.3.9/LICENSE.txt").read_bytes(), "Original OFL license must be preserved"
    codepoints = {ord(character) for character in (FONT_DIR / "characters.txt").read_text(encoding="utf-8") if ord(character) >= 32}
    source = TTFont(args.source, recalcTimestamp=False)
    assert codepoints <= source.getBestCmap().keys(), "Original font is missing requested characters"
    font = TTFont(args.source, recalcTimestamp=False)
    options = subset.Options()
    options.recalc_timestamp = False
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.glyph_names = True
    options.layout_features = ["*"]
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    names = {
        1: FAMILY, 3: "1.309;SYU;SyuTimetableUI", 4: FAMILY,
        6: "SyuTimetableUI-Regular", 16: FAMILY, 25: "SyuTimetableUI",
    }
    for record in list(font["name"].names):
        if record.nameID in names:
            font["name"].setName(names[record.nameID], record.nameID,
                                 record.platformID, record.platEncID, record.langID)
    font.flavor = "woff2"
    buffer = io.BytesIO()
    font.save(buffer)
    data = buffer.getvalue()
    output = TTFont(io.BytesIO(data), recalcTimestamp=False)
    verify(source, output, codepoints)
    css = f'''/* Generated by scripts/build_timetable_ui_font.py. Original fallback fonts are unchanged. */
@font-face {{
  font-family: "{FAMILY}";
  src: url("../../fonts/syu-timetable-ui/SyuTimetableUI.woff2") format("woff2-variations");
  font-style: normal;
  font-weight: 45 920;
  font-display: swap;
  unicode-range: {unicode_ranges(codepoints)};
}}

@media (max-width: 1023px) {{
  body:has(.timetable-page) {{
    font-family: "{FAMILY}", "Pretendard Variable", "Pretendard", -apple-system,
      BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }}
}}
'''
    if args.check:
        assert FONT_PATH.read_bytes() == data, "Font needs regeneration"
        assert CSS_PATH.read_text(encoding="utf-8") == css, "CSS needs regeneration"
    else:
        FONT_PATH.write_bytes(data)
        CSS_PATH.write_text(css, encoding="utf-8", newline="\n")
    print(json.dumps({
        "checked": args.check, "bytes": len(data), "characters": len(codepoints),
        "sha256": hashlib.sha256(data).hexdigest(), "axes": axes(output),
        "lineMetrics": line_metrics(output), "outlineAndAdvanceWeights": [400, 600, 700],
        "numericFeatures": sorted({record.FeatureTag for record in output["GSUB"].table.FeatureList.FeatureRecord} & {"tnum", "pnum", "zero"}),
    }))


if __name__ == "__main__":
    main()
