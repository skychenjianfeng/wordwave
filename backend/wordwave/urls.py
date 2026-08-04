from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404
from django.urls import include, path, re_path


def spa_view(request):
    """将非 API 请求回退到前端构建产物 index.html。"""
    root = getattr(settings, "WHITENOISE_ROOT", None)
    if not root:
        raise Http404("前端构建产物不存在（请先执行 npm run build）")
    index = root / "index.html"
    if not index.exists():
        raise Http404("dist/index.html 不存在")
    return FileResponse(index.open("rb"))

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("api.urls")),
]

# 生产模式：非 /api 与 /static 的路径回退到前端 SPA（dist/index.html）
if getattr(settings, "WHITENOISE_ROOT", None):
    urlpatterns += [
        re_path(r"^(?!api/|static/|admin/).*$", spa_view),
    ]
