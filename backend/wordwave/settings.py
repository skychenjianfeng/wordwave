import os
from pathlib import Path

import pymysql
from dotenv import load_dotenv

pymysql.install_as_MySQLdb()

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BASE_DIR.parent

# 读取 server/.env（DeepSeek 密钥）与 server/.env.django（数据库/Redis/安全配置）
load_dotenv(REPO_DIR / "server" / ".env")
load_dotenv(REPO_DIR / "server" / ".env.django")


def env_bool(name, default=False):
    return os.environ.get(name, str(default)).lower() in ("1", "true", "yes", "on")


SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-dev-only-change-me-wordwave",
)
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")
    if h.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "api",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "wordwave.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "wordwave.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": os.environ.get("MYSQL_DATABASE", "wordwave"),
        "USER": os.environ.get("MYSQL_USER", "wordwave"),
        "PASSWORD": os.environ.get("MYSQL_PASSWORD", "wordwave_dev_password"),
        "HOST": os.environ.get("MYSQL_HOST", "localhost"),
        "PORT": os.environ.get("MYSQL_PORT", "3306"),
        "CONN_MAX_AGE": 60,
        "OPTIONS": {"charset": "utf8mb4"},
    }
}

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": f"redis://{os.environ.get('REDIS_HOST', 'localhost')}:{os.environ.get('REDIS_PORT', '6379')}/0",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "PARSER_CLASS": "redis.connection.HiredisParser",
            "CONNECTION_POOL_KWARGS": {"max_connections": 50},
        },
    }
}

if env_bool("DJANGO_USE_LOCMEM_CACHE", False):
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 6}},
]

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
    "api.auth_hashers.LegacyScryptPasswordHasher",
]

LANGUAGE_CODE = "zh-hans"
TIME_ZONE = "Asia/Shanghai"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = REPO_DIR / "staticfiles"
STATICFILES_DIRS = []
if (REPO_DIR / "dist").exists():
    STATICFILES_DIRS.append(REPO_DIR / "dist")
WHITENOISE_ROOT = REPO_DIR / "dist"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 100,
}

from datetime import timedelta  # noqa: E402

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=90),
    "ROTATE_REFRESH_TOKENS": False,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOW_ALL_ORIGINS = env_bool("CORS_ALLOW_ALL", True)
if not CORS_ALLOW_ALL_ORIGINS:
    CORS_ALLOWED_ORIGINS = [
        o.strip()
        for o in os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3101").split(",")
        if o.strip()
    ]
CORS_ALLOW_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
CORS_ALLOW_HEADERS = ["*"]

# 请求体上限（进度同步可能较大）
DATA_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024

# DeepSeek 配置（密钥只从环境变量读取，严禁硬编码）
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com/chat/completions")

SPEECH_CACHE_DIR = REPO_DIR / "server" / ".speech-cache"
SPEECH_MODELS_DIR = BASE_DIR / "models" / "piper"
