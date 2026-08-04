"""Diff the local espeak-ng-data assets against the HF model repo file list."""

import json
import os


def main() -> None:
    hf_json = os.path.join(os.environ.get("TEMP", r"C:\Windows\Temp"), "hf_us.json")
    with open(hf_json, "r", encoding="utf-8") as f:
        us = json.load(f)
    hf_files = set(s["rfilename"] for s in us["siblings"])

    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    local_root = os.path.join(base, "mobile", "assets", "tts", "espeak-ng-data")
    local = set()
    for dirpath, _dirnames, filenames in os.walk(local_root):
        for name in filenames:
            rel = os.path.relpath(os.path.join(dirpath, name), local_root)
            local.add(rel.replace("\\", "/"))

    missing = sorted(hf_files - local)
    extra = sorted(local - hf_files)
    print("HF files:", len(hf_files), "local files:", len(local))
    print("MISSING count:", len(missing))
    for m in missing:
        print("MISSING:", m)
    print("EXTRA count:", len(extra))
    for e in extra[:30]:
        print("EXTRA:", e)


if __name__ == "__main__":
    main()
