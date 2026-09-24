"""
PDF gate checker (spec Part 8): python scripts/pdf/check_pdf.py <file.pdf> <expected.json>
Extracts text with pypdf and asserts every expected string is present, no emoji, no banned words.
"""
import json
import re
import sys

from pypdf import PdfReader

BANNED = ["institutional-grade", "comprehensive", "robust", "cutting-edge", "seamless", "powerful",
          "state-of-the-art", "ai-powered", "certified"]
EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿️‍]")


def main():
    pdf, exp_path = sys.argv[1:3]
    reader = PdfReader(pdf)
    text = "\n".join(p.extract_text() or "" for p in reader.pages)
    flat = re.sub(r"\s+", " ", text)
    exp = json.load(open(exp_path, encoding="utf-8"))
    failures = 0
    print(f"pages: {len(reader.pages)}, characters extracted: {len(text)}")
    for item in exp["required"]:
        ok = item["text"] in flat
        failures += 0 if ok else 1
        print(f"{'ok ' if ok else 'MISSING'}  {item['label']}: {item['text']}")
    emojis = EMOJI.findall(text)
    print(f"emoji characters: {len(emojis)} {emojis[:10]}")
    low = flat.lower()
    banned = [w for w in BANNED if w in low]
    print(f"banned words found: {banned}")
    summary = {"pages": len(reader.pages), "missing": failures, "required": len(exp["required"]), "emoji": len(emojis), "banned": banned}
    print(json.dumps(summary))
    sys.exit(1 if failures or emojis or banned else 0)


if __name__ == "__main__":
    main()
