"""Generate sherpa-onnx compatible tokens.txt from Piper .onnx.json files."""

import io
import json
import os


def generate(onnx_json_path: str, tokens_out_path: str) -> None:
    with io.open(onnx_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    phoneme_map = data["phoneme_id_map"]
    lines = []
    for token, ids in phoneme_map.items():
        ident = ids[0] if isinstance(ids, list) else ids
        if token == " ":
            lines.append("%d" % ident)
        else:
            lines.append("%s %d" % (token, ident))
    lines.sort(key=lambda s: int(s.split()[-1]))
    with io.open(tokens_out_path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    print("WROTE %s lines=%d" % (tokens_out_path, len(lines)))


if __name__ == "__main__":
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = os.path.join(base, "backend", "models", "piper")
    out = os.path.join(base, "mobile", "assets", "tts")
    for voice in ("en_US-lessac-medium", "en_GB-cori-medium"):
        generate(
            os.path.join(src, voice + ".onnx.json"),
            os.path.join(out, voice + ".tokens.txt"),
        )
