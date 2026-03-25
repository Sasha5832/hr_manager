from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.decorators.cache import never_cache
from django.views.static import serve as static_serve

from .views import spa_index


urlpatterns = [
    path("admin/", admin.site.urls),

    # allauth
    path("accounts/", include("allauth.urls")),

    # API
    path("api/", include("core.urls")),

    # DRF browser login
    path("api-auth/", include("rest_framework.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += [
        re_path(
            r"^assets/(?P<path>.*)$",
            static_serve,
            {"document_root": settings.FRONTEND_DIST_DIR / "assets"},
        )
    ]

urlpatterns += [
    re_path(r"^$", never_cache(spa_index)),
    re_path(
        r"^(?!api/|admin/|accounts/|api-auth/|static/|media/|assets/).*$",
        never_cache(spa_index),
    ),
]
