"""Test zh_CN-huayan Piper model with sherpa-onnx (Windows)."""

import os
import time

import sherpa_onnx


def main() -> None:
    base = r"C:\tts_tmp"
    config = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                model=os.path.join(base, "zh_model", "zh.onnx"),
                tokens=os.path.join(base, "zh_model", "tokens.txt"),
                data_dir=os.path.join(base, "assets", "espeak-ng-data"),
            ),
            num_threads=2,
            debug=False,
        ),
    )
    tts = sherpa_onnx.OfflineTts(config)
    for text in ("重要的", "重要的是坚持每天背单词", "necessary"):
        t0 = time.time()
        audio = tts.generate(text=text, sid=0, speed=1.0)
        dur = len(audio.samples) / audio.sample_rate
        print("text:", text, "samples:", len(audio.samples), "dur:", round(dur, 2), "elapsed:", round(time.time() - t0, 3))


if __name__ == "__main__":
    main()
