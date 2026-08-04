"""本地开源神经语音引擎（rhasspy/piper-tts）。

完全离线：模型文件随仓库分发（backend/models/piper/），不调用任何在线语音服务。
英文：美式 en_US-lessac-medium / 英式 en_GB-cori-medium。
中文释义由前端本地系统语音朗读（同样离线），不走本接口。
"""

import hashlib
import io
import logging
import threading
import wave

from django.conf import settings

logger = logging.getLogger(__name__)

_voices = {}
_lock = threading.Lock()
_missing = set()

VOICE_MAP = {
    ("en", "us"): "en_US-lessac-medium",
    ("en", "uk"): "en_GB-cori-medium",
}


def _load_voice(model_name):
    model = settings.SPEECH_MODELS_DIR / f"{model_name}.onnx"
    config = settings.SPEECH_MODELS_DIR / f"{model_name}.onnx.json"
    if not model.exists() or not config.exists():
        logger.warning("Piper 模型缺失: %s / %s", model, config)
        return None
    try:
        from piper import PiperVoice
    except ImportError as exc:
        logger.warning("piper-tts 未安装（pip install piper-tts）：%s", exc)
        return None
    try:
        return PiperVoice.load(str(model), config_path=str(config))
    except Exception as exc:  # noqa: BLE001
        logger.warning("Piper 模型 %s 加载失败: %s", model_name, exc)
        return None


def synth(text, lang="en", accent="us"):
    """本地 Piper 合成语音，返回 (wav bytes, 是否来自缓存)。"""
    if not text or len(text) > 500:
        raise ValueError("invalid text")
    if lang != "en":
        raise RuntimeError("仅支持英文语音（中文由前端本地系统语音朗读）")
    voice_key = ("en", accent if accent in ("us", "uk") else "us")
    model_name = VOICE_MAP.get(voice_key)
    if model_name is None:
        raise RuntimeError(f"不支持的语音: {voice_key}")

    with _lock:
        voice = _voices.get(model_name)
        if voice is None and model_name not in _missing:
            voice = _load_voice(model_name)
            if voice is None:
                _missing.add(model_name)
            else:
                _voices[model_name] = voice
    if voice is None:
        raise RuntimeError(f"本地 Piper 模型 {model_name} 不可用")

    cache = settings.SPEECH_CACHE_DIR / f"{hashlib.sha1(f'{model_name}:{text}'.encode('utf-8')).hexdigest()}.wav"
    if cache.exists() and cache.stat().st_size > 0:
        return cache.read_bytes(), True

    buf = io.BytesIO()
    with _lock:
        with wave.open(buf, "wb") as wav:
            try:
                # piper-tts >= 1.6（新版接口）
                voice.synthesize_wav(text, wav)
            except (AttributeError, TypeError):
                # piper-tts 1.2（经典接口）
                voice.synthesize(text, wav)
    data = buf.getvalue()
    if not data:
        raise RuntimeError("Piper 合成结果为空")
    try:
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_bytes(data)
    except OSError:
        pass
    return data, False
