import json
import re

import requests

from django.conf import settings

STYLES = {
    "exam": "考研难度的地道英文例句，长度 12-25 个单词",
    "daily": "日常口语场景的简单英文例句，使用常用简单词汇，长度 8-18 个单词",
    "funny": "轻松幽默、有趣的英文例句，长度 8-20 个单词",
    "business": "商务职场场景的英文例句（会议、邮件、谈判等），长度 10-20 个单词",
    "story": "叙事风格的英文例句，像讲一个小故事片段，长度 10-25 个单词",
    "tiktok": "TikTok 短视频风格的英文例句，像博主拍短视频时说的话，口语化、有网感、轻松有梗，可适当用缩写和流行说法，长度 8-20 个单词",
    "twitter": "推特（Twitter/X）发帖或评论风格的英文例句，日常简短、观点鲜明，像网友发推文或回复评论，可带 hashtag 语气，长度 8-25 个单词",
}


class DeepSeekError(Exception):
    pass


def _extract_json(text):
    if not text:
        return None
    t = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", t)
    if fence:
        t = fence.group(1).strip()
    start = t.find("{")
    end = t.rfind("}")
    if start >= 0 and end > start:
        t = t[start : end + 1]
    try:
        return json.loads(t)
    except (ValueError, TypeError):
        return None


def build_prompt(word, meaning, with_translation, style):
    desc = STYLES.get(style, STYLES["exam"])
    if with_translation:
        return (
            f"你是考研英语教学助手。请为单词生成一张学习例句卡片。\n"
            f"单词：{word}\n释义：{meaning}\n风格要求：{desc}\n\n"
            '请只输出一个 JSON 对象，不要输出任何其他内容，格式如下：\n'
            '{"english":"符合风格要求的英文例句（必须包含该单词）","chinese":"上面例句的准确中文翻译","distinction":"1-2 句近义词/易混词的中文辨析提示"}'
        )
    return (
        f"你是考研英语教学助手。请为单词生成一个考研难度英文例句。\n"
        f"单词：{word}\n释义：{meaning}\n风格要求：{desc}\n\n"
        '请只输出一个 JSON 对象，不要输出任何其他内容，格式如下：\n'
        '{"english":"符合风格要求的英文例句（必须包含该单词）"}\n\n'
        "严格要求：例句中不得包含任何中文字符，不要输出任何中文。"
    )


def fetch_example(word, meaning, with_translation, style):
    api_key = settings.DEEPSEEK_API_KEY
    if not api_key:
        raise DeepSeekError("服务端未配置 DEEPSEEK_API_KEY（请检查 server/.env）")
    messages = [
        {"role": "system", "content": "你是一个专业的考研英语教学助手，输出简洁、准确、适合背诵的内容。"},
        {"role": "user", "content": build_prompt(word, meaning, bool(with_translation), style)},
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
                "temperature": 0.8,
                "response_format": {"type": "json_object"},
            },
            timeout=30,
        )
    except requests.RequestException as exc:
        raise DeepSeekError(f"调用 DeepSeek API 失败: {exc}") from exc

    if resp.status_code != 200:
        raise DeepSeekError(f"DeepSeek API 错误 {resp.status_code}: {resp.text[:300]}")
    try:
        content = resp.json()["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise DeepSeekError("DeepSeek API 返回了无法解析的内容") from exc

    parsed = _extract_json(content)
    if not parsed or not isinstance(parsed.get("english"), str) or not parsed["english"].strip():
        raise DeepSeekError("模型未返回有效的例句 JSON")

    if with_translation:
        return {
            "english": parsed["english"].strip(),
            "chinese": (parsed.get("chinese") or "").strip(),
            "distinction": (parsed.get("distinction") or "").strip(),
            "withTranslation": True,
        }
    return {
        "english": parsed["english"].strip(),
        "chinese": "",
        "distinction": "",
        "withTranslation": False,
    }
