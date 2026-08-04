from django.contrib import admin

from .models import DailyActivity, DictMeta, ExampleCache, ProgressBlob, UserProfile, Word, WordNote


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "nickname", "daily_goal", "last_active_at")


@admin.register(ProgressBlob)
class ProgressBlobAdmin(admin.ModelAdmin):
    list_display = ("user", "updated_at")


@admin.register(DictMeta)
class DictMetaAdmin(admin.ModelAdmin):
    list_display = ("key", "name", "count", "difficulty", "enabled")


@admin.register(Word)
class WordAdmin(admin.ModelAdmin):
    list_display = ("word", "dict_meta", "category", "freq")
    search_fields = ("word", "meaning")
    list_filter = ("dict_meta", "category")


@admin.register(ExampleCache)
class ExampleCacheAdmin(admin.ModelAdmin):
    list_display = ("word", "style", "with_translation", "created_at")


@admin.register(WordNote)
class WordNoteAdmin(admin.ModelAdmin):
    list_display = ("user", "word", "dict_key", "updated_at")


@admin.register(DailyActivity)
class DailyActivityAdmin(admin.ModelAdmin):
    list_display = ("user", "date", "words_new", "words_reviewed", "words_wrong")
