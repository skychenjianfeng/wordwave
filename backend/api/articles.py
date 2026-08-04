"""阅读中心：分级文章（内置公开版权语料）+ 实时新闻 RSS 代理。

轮子参考：
- fluent-reader-lite（Flutter RSS 阅读器）
- word-hunter/flow-read（Flutter 英语阅读 + 查词 + EPUB）
- feedparser（Python RSS/Atom 解析）
"""

import time
import socket
from datetime import datetime, timezone
from pathlib import Path

import feedparser

from django.conf import settings

ARTICLES_DIR = settings.REPO_DIR / "public" / "data" / "articles"

NEWS_SOURCES = {
    "xinhua": {
        "name": "新华社英文",
        "url": "http://www.xinhuanet.com/english/rss/worldrss.xml",
        "tag": "新闻",
    },
    "bbc": {
        "name": "BBC News",
        "url": "https://feeds.bbci.co.uk/news/world/rss.xml",
        "tag": "新闻",
    },
    "bbc6min": {
        "name": "BBC 6 Minute English",
        "url": "https://feeds.bbci.co.uk/learningenglish/features/6min/rss.xml",
        "tag": "学习",
    },
    "voa": {
        "name": "VOA Learning English",
        "url": "https://learningenglish.voanews.com/api/zmrj",
        "tag": "学习",
    },
    "guardian": {
        "name": "The Guardian",
        "url": "https://www.theguardian.com/world/rss",
        "tag": "新闻",
    },
    "nytimes": {
        "name": "NYT World",
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
        "tag": "新闻",
    },
}


def _load_bundled():
    index = ARTICLES_DIR / "index.json"
    if not index.exists():
        return []
    try:
        return __import__("json").loads(index.read_text(encoding="utf-8"))
    except Exception:
        return []


def list_articles(level=None, q=None):
    arts = _load_bundled()
    if level and level != "全部":
        arts = [a for a in arts if a.get("level") == level]
    if q:
        arts = [
            a
            for a in arts
            if q.lower() in a.get("title", "").lower() or q.lower() in a.get("summary", "").lower()
        ]
    for a in arts:
        a.setdefault("summary", (a.get("content") or "")[:160].replace("\n", " "))
        a.pop("content", None)
    return arts


def get_article(article_id):
    for a in _load_bundled():
        if str(a.get("id")) == str(article_id):
            return a
    return None


def _cache_get(key):
    try:
        from django.core.cache import cache

        return cache.get(key)
    except Exception:
        return None


def _cache_set(key, value, ttl=1800):
    try:
        from django.core.cache import cache

        cache.set(key, value, ttl)
    except Exception:
        pass


def fetch_rss(source, limit=20):
    cfg = NEWS_SOURCES.get(source)
    if not cfg:
        raise ValueError(f"未知新闻源: {source}")
    cache_key = f"rss:{source}:{limit}"
    hit = _cache_get(cache_key)
    if hit:
        return hit
    socket.setdefaulttimeout(18)
    feed = feedparser.parse(cfg["url"], request_headers={"User-Agent": "WordWave/1.0"})
    if feed.bozo and not feed.entries:
        raise RuntimeError("新闻源暂时无法访问，请稍后重试")
    items = []
    for entry in feed.entries[:limit]:
        pub = None
        if getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None):
            t = entry.published_parsed or entry.updated_parsed
            try:
                pub = datetime(*t[:6], tzinfo=timezone.utc).isoformat()
            except Exception:
                pub = None
        items.append(
            {
                "id": f"{source}:{entry.get('id') or entry.get('link')}",
                "title": (entry.get("title") or "").strip(),
                "link": entry.get("link") or "",
                "summary": (entry.get("summary") or entry.get("description") or "").strip()[:500],
                "pubDate": pub,
                "source": source,
                "sourceName": cfg["name"],
            }
        )
    result = {"source": source, "sourceName": cfg["name"], "items": items}
    _cache_set(cache_key, result)
    return result


def list_sources():
    return [
        {"id": k, "name": v["name"], "tag": v["tag"]}
        for k, v in NEWS_SOURCES.items()
    ]
