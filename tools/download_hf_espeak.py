"""Download the official sherpa-onnx espeak-ng-data from hf-mirror."""

import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed


REPO = "csukuangfj/vits-piper-en_US-lessac-medium"
BASE = "https://hf-mirror.com/%s/resolve/main/" % REPO
PREFIX = "espeak-ng-data/"


def fetch_one(repo_rel: str, local_rel: str) -> str:
    url = BASE + urllib.parse.quote(repo_rel)
    target = os.path.join(TARGET, local_rel)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    last = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "curl/8"})
            with urllib.request.urlopen(req, timeout=120) as resp, open(
                target, "wb"
            ) as f:
                while True:
                    chunk = resp.read(1 << 16)
                    if not chunk:
                        break
                    f.write(chunk)
            return repo_rel
        except Exception as exc:  # noqa: BLE001
            last = exc
    return "%s FAILED: %s" % (repo_rel, last)


def main() -> None:
    global TARGET
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    TARGET = os.path.join(base_dir, "mobile", "assets", "tts", "espeak-ng-data")
    hf_json = os.path.join(os.environ.get("TEMP", r"C:\Windows\Temp"), "hf_us.json")
    with open(hf_json, "r", encoding="utf-8") as f:
        data = json.load(f)
    files = sorted(
        s["rfilename"]
        for s in data["siblings"]
        if s["rfilename"].startswith(PREFIX)
    )
    print("Downloading", len(files), "files into", TARGET)
    failed = []
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = [
            pool.submit(fetch_one, repo_rel, repo_rel[len(PREFIX) :])
            for repo_rel in files
        ]
        done = 0
        for fut in as_completed(futures):
            result = fut.result()
            done += 1
            if "FAILED" in result:
                failed.append(result)
            if done % 50 == 0:
                print("progress", done, "/", len(files), flush=True)
    print("DONE. failures:", len(failed))
    for item in failed:
        print(item)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    import urllib.parse  # noqa: PLC0415

    main()
