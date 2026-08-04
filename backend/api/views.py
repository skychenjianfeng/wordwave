import json
import re
from datetime import date, timedelta

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core.cache import cache
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import AccessToken

from . import articles, deepseek, piper_tts, translate_service
from .models import DailyActivity, DictMeta, ExampleCache, ProgressBlob, UserProfile, Word, WordNote


def _public_user(user):
    return {
        "id": str(user.id),
        "username": user.username,
        "createdAt": user.date_joined.isoformat() if user.date_joined else None,
    }


def _profile(user):
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return {
        "nickname": profile.nickname or user.username,
        "bio": profile.bio,
        "dailyGoal": profile.daily_goal,
        "avatarColor": profile.avatar_color,
        "settings": profile.settings,
        "lastActiveAt": profile.last_active_at.isoformat() if profile.last_active_at else None,
        "createdAt": profile.created_at.isoformat() if profile.created_at else None,
    }


def _token_for(user):
    return str(AccessToken.for_user(user))


def _error(status, message):
    return Response({"ok": False, "error": message}, status=status)


class HealthView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        from django.conf import settings

        return Response(
            {
                "ok": True,
                "service": "wordwave-django",
                "model": settings.DEEPSEEK_MODEL,
                "hasKey": bool(settings.DEEPSEEK_API_KEY),
                "db": "mysql",
                "cache": "redis",
            }
        )


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        username = str(request.data.get("username", "")).strip()
        password = request.data.get("password", "")
        if not re.fullmatch(r"[\w\u4e00-\u9fa5]{2,20}", username):
            return _error(400, "用户名需为 2-20 位字母/数字/下划线/中文")
        if not isinstance(password, str) or not (6 <= len(password) <= 64):
            return _error(400, "密码长度需为 6-64 位")
        if User.objects.filter(username__iexact=username).exists():
            return _error(409, "用户名已存在")
        user = User.objects.create_user(username=username, password=password)
        UserProfile.objects.create(user=user, nickname=username)
        return Response({"ok": True, "token": _token_for(user), "user": _public_user(user)})


class LoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        username = str(request.data.get("username", "")).strip()
        password = request.data.get("password", "")
        user = authenticate(request, username=username, password=password)
        if user is None:
            return _error(401, "用户名或密码错误")
        # 旧 Express scrypt 哈希登录成功后升级为 Django PBKDF2
        if user.password.startswith("legacy_scrypt$"):
            user.set_password(password)
            user.save(update_fields=["password"])
        UserProfile.objects.get_or_create(user=user)
        UserProfile.objects.filter(user=user).update(last_active_at=timezone.now())
        return Response({"ok": True, "token": _token_for(user), "user": _public_user(user)})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # JWT 无状态；前端丢弃 token 即可。预留黑名单扩展位。
        return Response({"ok": True})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"ok": True, "user": _public_user(request.user)})


class ProgressView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        blob, _ = ProgressBlob.objects.get_or_create(user=request.user)
        return Response({"ok": True, "data": blob.payload})

    def put(self, request):
        body = request.data or {}
        records = body.get("records") if isinstance(body.get("records"), dict) else {}
        daily_words = body.get("dailyWords") if isinstance(body.get("dailyWords"), dict) else {}
        payload = {"records": records, "dailyWords": daily_words, "updatedAt": timezone.now().isoformat()}
        if len(json.dumps(payload, ensure_ascii=False).encode("utf-8")) > 5 * 1024 * 1024:
            return _error(413, "进度数据过大")
        blob, _ = ProgressBlob.objects.get_or_create(user=request.user)
        blob.payload = payload
        blob.save()
        UserProfile.objects.filter(user=request.user).update(last_active_at=timezone.now())
        _update_daily_activity(request.user, daily_words)
        return Response({"ok": True})


def _update_daily_activity(user, daily_words):
    today = timezone.localdate()
    for day_str, words in daily_words.items():
        try:
            day = date.fromisoformat(day_str)
        except ValueError:
            continue
        if abs((today - day).days) > 400:
            continue
        activity, _ = DailyActivity.objects.get_or_create(user=user, date=day)
        activity.words_reviewed = max(activity.words_reviewed, len(words) if isinstance(words, list) else 0)
        activity.save()


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"ok": True, "user": _public_user(request.user), "profile": _profile(request.user)})

    def patch(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        data = request.data or {}
        if "nickname" in data and isinstance(data["nickname"], str):
            nickname = data["nickname"].strip()[:50]
            if nickname:
                profile.nickname = nickname
        if "bio" in data and isinstance(data["bio"], str):
            profile.bio = data["bio"][:200]
        if "dailyGoal" in data:
            try:
                profile.daily_goal = max(1, min(500, int(data["dailyGoal"])))
            except (TypeError, ValueError):
                pass
        if "avatarColor" in data and isinstance(data["avatarColor"], str):
            profile.avatar_color = data["avatarColor"][:20]
        if "settings" in data and isinstance(data["settings"], dict):
            merged = dict(profile.settings or {})
            merged.update(data["settings"])
            profile.settings = merged
        profile.save()
        return Response({"ok": True, "profile": _profile(request.user)})


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        old = request.data.get("oldPassword", "")
        new = request.data.get("newPassword", "")
        if not isinstance(new, str) or not (6 <= len(new) <= 64):
            return _error(400, "新密码长度需为 6-64 位")
        if not request.user.check_password(old):
            return _error(400, "原密码错误")
        request.user.set_password(new)
        request.user.save(update_fields=["password"])
        return Response({"ok": True})


class StatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        blob, _ = ProgressBlob.objects.get_or_create(user=request.user)
        records = blob.payload.get("records") or {}
        daily_words = blob.payload.get("dailyWords") or {}
        today = timezone.localdate().isoformat()
        yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()

        learned = len(records)
        mastered = sum(1 for r in records.values() if isinstance(r, dict) and r.get("status") == "mastered")
        wrong = sum(1 for r in records.values() if isinstance(r, dict) and (r.get("wrongCount") or 0) > 0)
        due_today = sum(
            1
            for r in records.values()
            if isinstance(r, dict)
            and isinstance(r.get("review"), dict)
            and str(r["review"].get("nextReview", "9999-99-99")) <= today
        )

        # 连续学习天数
        days = {d for d in daily_words if isinstance(d, str) and daily_words[d]}
        streak = 0
        cursor = timezone.localdate()
        if today not in days and yesterday in days:
            cursor -= timedelta(days=1)
        while cursor.isoformat() in days:
            streak += 1
            cursor -= timedelta(days=1)

        last30 = []
        for i in range(29, -1, -1):
            day = (timezone.localdate() - timedelta(days=i)).isoformat()
            last30.append({"date": day, "count": len(daily_words.get(day) or [])})

        activities = {
            a.date.isoformat(): {"words": a.words_reviewed, "new": a.words_new, "wrong": a.words_wrong}
            for a in DailyActivity.objects.filter(user=request.user, date__gte=timezone.localdate() - timedelta(days=400))
        }
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        return Response(
            {
                "ok": True,
                "stats": {
                    "learned": learned,
                    "mastered": mastered,
                    "wrong": wrong,
                    "dueToday": due_today,
                    "todayLearned": len(daily_words.get(today) or []),
                    "streak": streak,
                    "dailyGoal": profile.daily_goal,
                    "last30": last30,
                    "activities": activities,
                },
            }
        )


class NotesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        dict_key = request.query_params.get("dictId", "kaoyan")
        word = request.query_params.get("word", "")
        qs = WordNote.objects.filter(user=request.user, dict_key=dict_key)
        if word:
            qs = qs.filter(word__iexact=word)
        return Response(
            {
                "ok": True,
                "data": [
                    {
                        "dictId": n.dict_key,
                        "word": n.word,
                        "note": n.note,
                        "syllableNotes": n.syllable_notes,
                        "updatedAt": n.updated_at.isoformat() if n.updated_at else None,
                    }
                    for n in qs[:500]
                ],
            }
        )

    def put(self, request):
        dict_key = str(request.data.get("dictId", "kaoyan"))
        word = str(request.data.get("word", "")).strip()
        if not word:
            return _error(400, "缺少 word")
        note, _ = WordNote.objects.get_or_create(user=request.user, dict_key=dict_key, word=word)
        if "note" in request.data and isinstance(request.data["note"], str):
            note.note = request.data["note"][:5000]
        if "syllableNotes" in request.data and isinstance(request.data["syllableNotes"], list):
            note.syllable_notes = request.data["syllableNotes"][:50]
        note.save()
        return Response({"ok": True})


class ExampleView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        word = str(request.data.get("word", "")).strip()
        if not word:
            return _error(400, "缺少 word 参数")
        meaning = str(request.data.get("meaning", "")).strip()
        with_translation = bool(request.data.get("withTranslation", False))
        style = str(request.data.get("style", "exam"))
        if style not in deepseek.STYLES:
            style = "exam"
        cache_key = f"example:{word.lower()}::{with_translation}::{style}"

        # Redis 一级缓存
        try:
            hit = cache.get(cache_key)
            if hit:
                return Response({"ok": True, "data": hit, "fromCache": True})
        except Exception:
            hit = None

        # MySQL 二级缓存
        row = ExampleCache.objects.filter(key=cache_key).first()
        if row:
            try:
                cache.set(cache_key, row.payload, 60 * 60 * 24 * 30)
            except Exception:
                pass
            return Response({"ok": True, "data": row.payload, "fromCache": True})

        try:
            data = deepseek.fetch_example(word, meaning, with_translation, style)
        except deepseek.DeepSeekError as exc:
            return _error(502, str(exc))

        try:
            cache.set(cache_key, data, 60 * 60 * 24 * 30)
        except Exception:
            pass
        ExampleCache.objects.update_or_create(
            key=cache_key,
            defaults={
                "word": word.lower(),
                "with_translation": with_translation,
                "style": style,
                "payload": data,
            },
        )
        return Response({"ok": True, "data": data, "fromCache": False})


class ExampleCacheView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        count = ExampleCache.objects.all().delete()[0]
        try:
            cache.delete_pattern("example:*")
        except Exception:
            pass
        return Response({"ok": True, "deleted": count})


class SpeechView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        text = str(request.query_params.get("text", "")).strip()
        lang = request.query_params.get("lang", "en")
        accent = request.query_params.get("accent", "us")
        if not text or len(text) > 500:
            return _error(400, "invalid text")
        try:
            audio, _ = piper_tts.synth(text, lang=lang, accent=accent)
        except Exception as exc:
            return _error(502, f"本地 Piper 语音合成失败: {exc}")
        resp = HttpResponse(audio, content_type="audio/wav")
        resp["Cache-Control"] = "public, max-age=31536000, immutable"
        resp["X-Speech-Engine"] = "piper-local"
        return resp


class DictListView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        qs = DictMeta.objects.filter(enabled=True).order_by("sort", "id")
        return Response(
            {
                "ok": True,
                "data": [
                    {
                        "id": d.key,
                        "name": d.name,
                        "description": d.description,
                        "count": d.count,
                        "difficulty": d.difficulty,
                        "category": d.category,
                        "tags": d.tags,
                        "source": d.source,
                    }
                    for d in qs
                ],
            }
        )


def _word_json(w):
    return {
        "id": w.wid,
        "freq": w.freq,
        "word": w.word,
        "meaning": w.meaning,
        "alt": w.alt,
        "category": w.category,
        "subcategory": w.subcategory,
        "ipa": w.ipa,
    }


class DictWordsView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, dict_key):
        meta = DictMeta.objects.filter(key=dict_key).first()
        if not meta:
            return _error(404, "词库不存在")
        qs = Word.objects.filter(dict_meta=meta).order_by("freq", "id")
        q = str(request.query_params.get("q", "")).strip()
        category = str(request.query_params.get("category", "")).strip()
        subcategory = str(request.query_params.get("subcategory", "")).strip()
        if q:
            qs = qs.filter(Q(word__icontains=q) | Q(meaning__icontains=q) | Q(word_lower__icontains=q.lower()))
        if category:
            qs = qs.filter(category=category)
        if subcategory:
            qs = qs.filter(subcategory=subcategory)
        try:
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = min(500, max(1, int(request.query_params.get("pageSize", 100))))
        except (TypeError, ValueError):
            page, page_size = 1, 100
        total = qs.count()
        start = (page - 1) * page_size
        items = [_word_json(w) for w in qs[start : start + page_size]]
        return Response(
            {
                "ok": True,
                "data": {
                    "dict": {"id": meta.key, "name": meta.name, "count": meta.count},
                    "total": total,
                    "page": page,
                    "pageSize": page_size,
                    "items": items,
                },
            }
        )


class DictFacetsView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, dict_key):
        meta = DictMeta.objects.filter(key=dict_key).first()
        if not meta:
            return _error(404, "词库不存在")
        categories = (
            Word.objects.filter(dict_meta=meta)
            .values("category")
            .annotate(total=Count("id"))
            .order_by("-total")
        )
        return Response(
            {
                "ok": True,
                "data": {
                    "categories": [{"name": c["category"] or "未分类", "count": c["total"]} for c in categories],
                },
            }
        )


class ArticleListView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        level = request.query_params.get("level", "")
        q = request.query_params.get("q", "")
        return Response(
            {
                "ok": True,
                "data": {
                    "levels": ["初中", "高中", "四级", "六级", "考研", "雅思"],
                    "articles": articles.list_articles(level=level, q=q),
                },
            }
        )


class ArticleDetailView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, article_id):
        art = articles.get_article(article_id)
        if not art:
            return _error(404, "文章不存在")
        return Response({"ok": True, "data": art})


class RssView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        source = str(request.query_params.get("source", "xinhua"))
        try:
            limit = max(1, min(30, int(request.query_params.get("limit", 15))))
        except (TypeError, ValueError):
            limit = 15
        try:
            data = articles.fetch_rss(source, limit)
        except Exception as exc:
            return _error(502, str(exc))
        return Response({"ok": True, "data": data})


class RssSourcesView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"ok": True, "data": articles.list_sources()})


class TranslateView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        text = str(request.data.get("text", "")).strip()
        try:
            translation = translate_service.translate(text)
        except translate_service.TranslateError as exc:
            return _error(502, str(exc))
        return Response({"ok": True, "data": {"translation": translation}})
