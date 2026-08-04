"""Compare full espeak-ng-data (MSI) vs sherpa espeak-ng-data."""

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
    full = walk(os.path.join(r"C:\tts_tmp\espeak_msi\eSpeak NG", "espeak-ng-data"))
    sherpa = walk(os.path.join(base, "mobile", "assets", "tts", "espeak-ng-data"))
    sf, ss = set(full), set(sherpa)
    print("full:", len(full), "sherpa:", len(sherpa))
    print("ONLY in full:", len(sf - ss))
    for item in sorted(sf - ss)[:60]:
        print("  FULL:", item)
    print("ONLY in sherpa:", len(ss - sf))
    for item in sorted(ss - sf)[:60]:
        print("  SHERPA:", item)
    diff = sorted(k for k in sf & ss if full[k] != sherpa[k])
    print("size differs:", len(diff))
    for k in diff[:60]:
        print("  DIFF", k, full[k], sherpa[k])


if __name__ == "__main__":
    main()
