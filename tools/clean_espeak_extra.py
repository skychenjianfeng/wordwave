"""Remove espeak-ng-data files that are not part of the official HF repo set."""

import json
import os


def main() -> None:
    hf_json = os.path.join(os.environ.get("TEMP", r"C:\Windows\Temp"), "hf_us.json")
    with open(hf_json, "r", encoding="utf-8") as f:
        data = json.load(f)
    keep = {
        s["rfilename"][len("espeak-ng-data/") :]
        for s in data["siblings"]
        if s["rfilename"].startswith("espeak-ng-data/")
    }
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    root = os.path.join(base, "mobile", "assets", "tts", "espeak-ng-data")
    removed = []
    for dirpath, _dirnames, filenames in os.walk(root):
        for name in filenames:
            rel = os.path.relpath(os.path.join(dirpath, name), root).replace("\\", "/")
            if rel not in keep:
                os.remove(os.path.join(dirpath, name))
                removed.append(rel)
    print("Removed", len(removed), "extra files")
    for item in sorted(removed):
        print("REMOVED:", item)
    remaining = sum(len(files) for _, _, files in os.walk(root))
    print("Remaining files:", remaining)


if __name__ == "__main__":
    main()
