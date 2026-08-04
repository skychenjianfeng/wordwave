from django.contrib.auth.models import User
from django.db import models


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    nickname = models.CharField("昵称", max_length=50, blank=True, default="")
    bio = models.CharField("简介", max_length=200, blank=True, default="")
    daily_goal = models.PositiveIntegerField("每日目标", default=20)
    avatar_color = models.CharField(max_length=20, blank=True, default="emerald")
    settings = models.JSONField("设置", default=dict, blank=True)
    last_active_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "用户资料"
        verbose_name_plural = "用户资料"


class ProgressBlob(models.Model):
    """兼容现有前端的学习进度快照（records + dailyWords JSON 整体同步）。"""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="progress_blob")
    payload = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "学习进度"
        verbose_name_plural = "学习进度"


class DictMeta(models.Model):
    key = models.CharField("词库标识", max_length=64, unique=True)
    name = models.CharField("词库名称", max_length=100)
    description = models.TextField("描述", blank=True, default="")
    count = models.PositiveIntegerField("词条数", default=0)
    difficulty = models.CharField(max_length=32, blank=True, default="")
    category = models.CharField(max_length=64, blank=True, default="")
    tags = models.JSONField(default=list, blank=True)
    source = models.CharField(max_length=200, blank=True, default="")
    enabled = models.BooleanField("启用", default=True)
    sort = models.PositiveIntegerField("排序", default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "词库"
        verbose_name_plural = "词库"


class Word(models.Model):
    dict_meta = models.ForeignKey(DictMeta, on_delete=models.CASCADE, related_name="words")
    wid = models.PositiveIntegerField("词内序号")
    word = models.CharField(max_length=200)
    word_lower = models.CharField(max_length=200, db_index=True)
    meaning = models.TextField(blank=True, default="")
    alt = models.CharField(max_length=200, blank=True, null=True)
    category = models.CharField(max_length=100, blank=True, default="")
    subcategory = models.CharField(max_length=100, blank=True, null=True)
    freq = models.IntegerField(default=0)
    ipa = models.CharField(max_length=200, blank=True, null=True)

    class Meta:
        verbose_name = "单词"
        verbose_name_plural = "单词"
        unique_together = [("dict_meta", "word_lower")]
        indexes = [
            models.Index(fields=["dict_meta", "word_lower"]),
            models.Index(fields=["dict_meta", "category"]),
            models.Index(fields=["dict_meta", "freq"]),
        ]


class ExampleCache(models.Model):
    """AI 例句持久缓存（MySQL），Redis 作为第一层热点缓存。"""

    key = models.CharField(max_length=255, unique=True)
    word = models.CharField(max_length=100)
    with_translation = models.BooleanField()
    style = models.CharField(max_length=20)
    payload = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "例句缓存"
        verbose_name_plural = "例句缓存"


class WordNote(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="word_notes")
    dict_key = models.CharField(max_length=64, default="kaoyan")
    word = models.CharField(max_length=200)
    note = models.TextField(blank=True, default="")
    syllable_notes = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "单词笔记"
        verbose_name_plural = "单词笔记"
        unique_together = [("user", "dict_key", "word")]


class DailyActivity(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="daily_activities")
    date = models.DateField()
    words_new = models.PositiveIntegerField(default=0)
    words_reviewed = models.PositiveIntegerField(default=0)
    words_wrong = models.PositiveIntegerField(default=0)
    seconds = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "每日活动"
        verbose_name_plural = "每日活动"
        unique_together = [("user", "date")]


class TranslationCache(models.Model):
    """文章一键翻译缓存（MySQL 持久层，Redis 为热点缓存）。"""

    key = models.CharField(max_length=64, unique=True)
    text_hash = models.CharField(max_length=64)
    payload = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "翻译缓存"
        verbose_name_plural = "翻译缓存"
