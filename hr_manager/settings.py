"""Ustawienia Django dla projektu HR Manager.

Cel (dla dyplomu):
- konfiguracja przez plik .env (bez trzymania sekretów w repozytorium),
- backend (Django + DRF) + frontend (React/Vite) jako SPA.
"""

from __future__ import annotations

import os
from pathlib import Path
import dj_database_url  # Импорт для работы с БД на Railway

BASE_DIR = Path(__file__).resolve().parent.parent


# -----------------------------------------------------------------------------
# Konfiguracja .env (prosty loader bez dodatkowych zależności)
# -----------------------------------------------------------------------------
def _load_dotenv(dotenv_path: Path) -> None:
    """Wczytuje pary KEY=VALUE z pliku .env do os.environ (jeśli zmienne nie są już ustawione)."""
    if not dotenv_path.exists():
        return

    for raw_line in dotenv_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def _env_bool(name: str, default: bool) -> bool:
    v = os.environ.get(name)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "y", "on"}


def _env_list(name: str, default: list[str]) -> list[str]:
    v = os.environ.get(name)
    if not v:
        return default
    return [x.strip() for x in v.split(",") if x.strip()]


_load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "django-insecure-change-me")

# На Railway DEBUG должен быть False. В локалке подтянется из .env или True по умолчанию.
DEBUG = _env_bool("DJANGO_DEBUG", os.environ.get("DEBUG", "False") == "True")

# Добавляем "*" для Railway или берем список из настроек
ALLOWED_HOSTS = _env_list("DJANGO_ALLOWED_HOSTS", ["127.0.0.1", "localhost", ".railway.app"])
if not DEBUG:
    ALLOWED_HOSTS = ["*"]

# Domyślny limit urlopu rocznego (dni robocze). Możesz nadpisać w .env.
HR_DEFAULT_ANNUAL_LEAVE_LIMIT_DAYS = int(os.environ.get("HR_DEFAULT_ANNUAL_LEAVE_LIMIT_DAYS", "26"))


# -----------------------------------------------------------------------------
# Frontend (React/Vite) – ścieżki do builda (frontend/dist)
# -----------------------------------------------------------------------------
FRONTEND_DIR = BASE_DIR / "frontend"
FRONTEND_DIST_DIR = FRONTEND_DIR / "dist"


# -----------------------------------------------------------------------------
# Aplikacje
# -----------------------------------------------------------------------------
INSTALLED_APPS = [
    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    # Zewnętrzne
    "rest_framework",
    "rest_framework.authtoken",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "corsheaders",
    "whitenoise.runserver_nostatic", # Оптимизация для разработки
    # Własne
    "core",
]

SITE_ID = 1


# -----------------------------------------------------------------------------
# Middleware
# -----------------------------------------------------------------------------
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware", # WhiteNoise для раздачи статики
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "hr_manager.urls"


# -----------------------------------------------------------------------------
# Szablony – FRONTEND_DIST_DIR pozwala zwrócić dist/index.html dla SPA
# -----------------------------------------------------------------------------
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates", FRONTEND_DIST_DIR],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",  # wymagane przez allauth
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "hr_manager.wsgi.application"
ASGI_APPLICATION = "hr_manager.asgi.application"


# -----------------------------------------------------------------------------
# Baza danych (Авто-настройка для Railway + SQLite как запасной вариант)
# -----------------------------------------------------------------------------
DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600
    )
}


# -----------------------------------------------------------------------------
# Walidatory haseł (domyślne)
# -----------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# -----------------------------------------------------------------------------
# I18N / strefa czasowa
# -----------------------------------------------------------------------------
LANGUAGE_CODE = "pl"
TIME_ZONE = "Europe/Warsaw"
USE_I18N = True
USE_TZ = True


# -----------------------------------------------------------------------------
# Static / Media
# -----------------------------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles" # Обязательно для Railway

# Настройка WhiteNoise для сжатия статики
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

STATICFILES_DIRS: list[Path] = []
if (BASE_DIR / "static").exists():
    STATICFILES_DIRS.append(BASE_DIR / "static")
if (FRONTEND_DIST_DIR / "assets").exists():
    STATICFILES_DIRS.append(FRONTEND_DIST_DIR / "assets")


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# -----------------------------------------------------------------------------
# Django REST Framework
# -----------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}


# -----------------------------------------------------------------------------
# django-allauth (logowanie po e-mailu)
# -----------------------------------------------------------------------------
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

LOGIN_URL = "/accounts/login/"
LOGIN_REDIRECT_URL = "/"
ACCOUNT_LOGOUT_REDIRECT_URL = "/"

ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
ACCOUNT_EMAIL_VERIFICATION = "none"

ACCOUNT_LOGOUT_ON_GET = True


# -----------------------------------------------------------------------------
# CORS / CSRF (dla SPA na Vite w trybie developerskim i produkcyjnym)
# -----------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = _env_list(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
)
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = _env_list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
)

# Если мы на Railway, добавляем публичный URL в доверенные
RAILWAY_PUBLIC_URL = os.environ.get("RAILWAY_PUBLIC_DOMAIN")
if RAILWAY_PUBLIC_URL:
    CSRF_TRUSTED_ORIGINS.append(f"https://{RAILWAY_PUBLIC_URL}")
    CORS_ALLOWED_ORIGINS.append(f"https://{RAILWAY_PUBLIC_URL}")