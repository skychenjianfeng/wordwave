"""一键翻译：DeepSeek 整篇翻译代理（带 Redis + MySQL 缓存）。"""

import hashlib

import requests

from django.conf import settings


class TranslateError(Exception):
    pass


def translate(text):
    text = (text or "").strip()
    if not text:
        raise TranslateError("没有可翻译的内容")
    if len(text) > 8000:
        raise TranslateError("文章过长，暂不支持翻译（限 8000 字符）")

    text_hash = hashlib.sha1(text.encode("utf-8")).hexdigest()
    cache_key = f"translate:{text_hash}"

    # Redis 热点缓存
    try:
        from django.core.cache import cache

        hit = cache.get(cache_key)
        if hit:
            return hit
    except Exception:
        hit = None

    # MySQL 持久缓存
    from .models import TranslationCache

    row = TranslationCache.objects.filter(key=cache_key).first()
    if row:
        try:
            cache.set(cache_key, row.payload, 60 * 60 * 24 * 30)
        except Exception:
            pass
        return row.payload

    api_key = settings.DEEPSEEK_API_KEY
    if not api_key:
        raise TranslateError("服务端未配置 DEEPSEEK_API_KEY")

    messages = [
        {
            "role": "system",
            "content": "你是一名专业的英语学习翻译助手。请把用户提供的英文文章翻译成准确、自然、通顺的中文，保留原文段落结构，不要添加任何解释。只输出译文本身。",
        },
        {"role": "user", "content": text},
    ]
    try:
        resp = requests.post(
            settings.DEEPSEEK_BASE_URL,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            json={
                "model": settings.DEEPSEEK_MODEL,
                "messages": messages,
                "temperature": 0.3,
            },
            timeout=60,
        )
    except requests.RequestException as exc:
        raise TranslateError(f"调用翻译服务失败: {exc}") from exc
    if resp.status_code != 200:
        raise TranslateError(f"翻译服务错误 {resp.status_code}: {resp.text[:200]}")
    try:
        translation = resp.json()["choices"][0]["message"]["content"].strip()
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise TranslateError("翻译服务返回了无法解析的内容") from exc
    if not translation:
        raise TranslateError("翻译结果为空")

    try:
        cache.set(cache_key, translation, 60 * 60 * 24 * 30)
    except Exception:
        pass
    TranslationCache.objects.update_or_create(
        key=cache_key,
        defaults={"text_hash": text_hash, "payload": translation},
    )
    return translation
