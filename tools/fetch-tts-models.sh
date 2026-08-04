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
  local tmp
  tmp="$DIR/.$file.tmp"
  rm -f "$tmp"
  for base in "$BASE_HF" "$BASE_MIRROR"; do
    echo "下载 $file <- $base ..."
    if curl -L --fail --retry 5 --retry-all-errors --connect-timeout 30 \
        --max-time 900 -o "$tmp" "$base/$repo/resolve/main/$file"; then
      if [ -s "$tmp" ]; then
        mv -f "$tmp" "$DIR/$file"
        echo "完成 $file ($(du -h "$DIR/$file" | cut -f1))"
        return 0
      fi
      rm -f "$tmp"
    else
      echo "源失败: $base (退出码 $?)"
      rm -f "$tmp"
    fi
  done
  echo "所有源均失败: $file" >&2
  return 1
}

# 文件数量与预期不符时直接报错，便于排查
check_all() {
  local expected=5
  local got=0
  for f in "$DIR"/*.onnx; do
    [ -s "$f" ] && got=$((got + 1))
  done
  echo "onnx 模型数量: $got / $expected"
  if [ "$got" -lt "$expected" ]; then
    echo "模型下载不完整" >&2
    return 1
  fi
}

fetch vits-piper-en_US-lessac-medium en_US-lessac-medium.onnx
fetch vits-piper-en_GB-cori-medium en_GB-cori-medium.onnx
fetch vits-piper-en_US-danny-low en_US-danny-low.onnx
fetch vits-piper-en_GB-alba-medium en_GB-alba-medium.onnx
fetch vits-piper-zh_CN-huayan-medium zh_CN-huayan-medium.onnx
check_all
echo "语音模型就绪"
