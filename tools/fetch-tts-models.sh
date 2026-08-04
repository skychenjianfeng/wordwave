#!/usr/bin/env bash
# 下载离线语音模型到 mobile/assets/tts（云构建 CI 用，模型不入 git 仓库）
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../mobile/assets/tts" && pwd)"
BASE_HF="https://huggingface.co/csukuangfj"
BASE_MIRROR="https://hf-mirror.com/csukuangfj"

fetch() {
  local repo="$1" file="$2"
  if [ -f "$DIR/$file" ] && [ -s "$DIR/$file" ]; then
    echo "已存在 $file"
    return 0
  fi
  for base in "$BASE_HF" "$BASE_MIRROR"; do
    echo "下载 $file <- $base ..."
    if curl -L --fail --retry 2 -o "$DIR/$file" "$base/$repo/resolve/main/$file"; then
      echo "完成 $file"
      return 0
    fi
  done
  echo "失败 $file" >&2
  return 1
}

fetch vits-piper-en_US-lessac-medium en_US-lessac-medium.onnx
fetch vits-piper-en_GB-cori-medium en_GB-cori-medium.onnx
fetch vits-piper-en_US-danny-low en_US-danny-low.onnx
fetch vits-piper-en_GB-alba-medium en_GB-alba-medium.onnx
fetch vits-piper-zh_CN-huayan-medium zh_CN-huayan-medium.onnx
echo "语音模型就绪"
