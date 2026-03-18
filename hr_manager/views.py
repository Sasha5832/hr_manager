from pathlib import Path

from django.conf import settings
from django.http import HttpResponse, HttpResponseNotFound
from django.middleware.csrf import get_token


def spa_index(request):
    """
    Zwraca frontend/dist/index.html, aby React Router działał poprawnie na dowolnych ścieżkach.
    Dodatkowo wywołuje get_token(request), żeby Django ustawiło ciasteczko csrftoken
    (wymagane dla żądań POST z CSRF przy użyciu session cookie).
    """
    # Wymusza ustawienie ciasteczka csrftoken dla SPA.
    get_token(request)

    index_path = Path(settings.FRONTEND_DIST_DIR) / "index.html"
    if not index_path.exists():
        return HttpResponseNotFound(
            "React build not found. Run `npm run build` inside the frontend folder."
        )

    return HttpResponse(index_path.read_text(encoding="utf-8"))
