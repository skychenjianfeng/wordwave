"""Compare espeak-ng-data from the official engine APK vs the project assets."""

import os


def walk(root: str):
    out = {}
    for dirpath, _dirnames, filenames in os.walk(root):
        for name in filenames:
            p = os.path.join(dirpath, name)
            rel = os.path.relpath(p, root).replace("\\", "/")
            out[rel] = os.path.getsize(p)
    return out


def main() -> None:
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = os.path.join(
        r"C:\tts_tmp\engine_apk\assets\vits-piper-en_US-lessac-medium",
        "espeak-ng-data",
    )
    dst = os.path.join(base, "mobile", "assets", "tts", "espeak-ng-data")
    a = walk(src)
    b = walk(dst)
    sa, sb = set(a), set(b)
    print("engine files:", len(a), "ours:", len(b))
    only_a = sorted(sa - sb)
    only_b = sorted(sb - sa)
    print("ONLY in engine:", len(only_a))
    for item in only_a[:40]:
        print("  ENGINE:", item)
    print("ONLY in ours:", len(only_b))
    for item in only_b[:40]:
        print("  OURS:", item)
    diff = sorted(k for k in sa & sb if a[k] != b[k])
    print("size differs:", len(diff))
    for k in diff[:40]:
        print("  DIFF", k, a[k], b[k])


if __name__ == "__main__":
    main()
