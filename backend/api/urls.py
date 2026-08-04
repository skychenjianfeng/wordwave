from django.urls import path

from . import views

urlpatterns = [
    path("health", views.HealthView.as_view()),
    path("auth/register", views.RegisterView.as_view()),
    path("auth/login", views.LoginView.as_view()),
    path("auth/logout", views.LogoutView.as_view()),
    path("auth/me", views.MeView.as_view()),
    path("user/progress", views.ProgressView.as_view()),
    path("user/profile", views.ProfileView.as_view()),
    path("user/change-password", views.ChangePasswordView.as_view()),
    path("user/stats", views.StatsView.as_view()),
    path("user/notes", views.NotesView.as_view()),
    path("example", views.ExampleView.as_view()),
    path("example/cache", views.ExampleCacheView.as_view()),
    path("speech", views.SpeechView.as_view()),
    path("dicts", views.DictListView.as_view()),
    path("dicts/<str:dict_key>/words", views.DictWordsView.as_view()),
    path("dicts/<str:dict_key>/facets", views.DictFacetsView.as_view()),
    path("articles/rss/sources", views.RssSourcesView.as_view()),
    path("articles/rss", views.RssView.as_view()),
    path("articles/<str:article_id>", views.ArticleDetailView.as_view()),
    path("articles", views.ArticleListView.as_view()),
    path("translate", views.TranslateView.as_view()),
]
