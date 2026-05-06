import re
import sys
import zipfile
from pathlib import Path


def extract_docx_text(source: Path) -> str:
    with zipfile.ZipFile(source) as zf:
        xml = zf.read("word/document.xml").decode("utf-8", "ignore")

    text = re.sub(r"<w:tab[^>]*/>", "\t", xml)
    text = re.sub(r"</w:p>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\n\s*\n+", "\n", text)
    return text


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python extract_docx_to_txt.py <docx_path> [output_txt]")
        return 1

    source = Path(sys.argv[1])
    if not source.exists():
        print("FILE_NOT_FOUND")
        return 1

    if len(sys.argv) >= 3:
        target = Path(sys.argv[2])
    else:
        target = source.with_suffix(".txt")

    text = extract_docx_text(source)
    target.write_text(text, encoding="utf-8")
    print(f"EXPORTED {target} {len(text)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
