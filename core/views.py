from __future__ import annotations

import io
from datetime import date as dt_date, timedelta
from django.conf import settings
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie

import pandas as pd
from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import FileResponse, HttpResponse
from django.utils.encoding import smart_str
from rest_framework import permissions, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from rest_framework.response import Response
from rest_framework.reverse import reverse

from .models import AttendanceRecord, Employee, LeaveRequest, PerformanceReview
from .serializers import (
    AttendanceRecordSerializer,
    EmployeeSerializer,
    LeaveRequestSerializer,
    PerformanceReviewSerializer,
    UserSerializer,
)

# Serializer używany dla create/update może być opcjonalny; w razie braku używamy bazowego.
try:
    from .serializers import EmployeeManageSerializer  # type: ignore
except Exception:
    EmployeeManageSerializer = EmployeeSerializer  # fallback


UserModel = get_user_model()

# -------------------- Pomocnicze --------------------


class IsAdminOrReadOwn(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff or request.user.is_superuser:
            return True

        if isinstance(obj, Employee):
            return obj.user_id == request.user.id

        employee = getattr(obj, "employee", None)
        if isinstance(employee, Employee):
            return employee.user_id == request.user.id

        return False


def _user_employee_or_none(user) -> Employee | None:
    try:
        return Employee.objects.get(user=user)
    except Employee.DoesNotExist:
        return None


def count_workdays(start: dt_date, end: dt_date) -> int:
    """Zlicza dni robocze (pon–pt) włącznie z datami granicznymi."""
    if end < start:
        return 0
    days = 0
    cur = start
    one = timedelta(days=1)
    while cur <= end:
        if cur.weekday() < 5:
            days += 1
        cur = cur + one
    return days



# -------------------- Root API --------------------


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def api_root(request, format=None):
    return Response(
        {
            "employees": reverse("core:employee-list", request=request, format=format),
            "leave_requests": reverse("core:leaverequest-list", request=request, format=format),
            "performance": reverse("core:performancereview-list", request=request, format=format),
            "attendance": reverse("core:attendancerecord-list", request=request, format=format),
            "export_performance": request.build_absolute_uri(
                reverse("core:performancereview-list") + "export/"
            ),
        }
    )

@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@ensure_csrf_cookie
def csrf_token(request):
    """Ustawia ciasteczko CSRF dla przeglądarki (wymagane przy żądaniach POST/PUT/PATCH/DELETE w SPA)."""
    return Response({"csrftoken": get_token(request)})


# -------------------- Pracownicy --------------------


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.select_related("user").all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAdminOrReadOwn]
    lookup_value_regex = r"\d+"

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return EmployeeManageSerializer
        return EmployeeSerializer

    def get_queryset(self):
        if self.request.user.is_staff or self.request.user.is_superuser:
            return Employee.objects.select_related("user").all()
        emp = _user_employee_or_none(self.request.user)
        return (
            Employee.objects.select_related("user").filter(pk=emp.pk)
            if emp
            else Employee.objects.none()
        )

    def perform_create(self, serializer):
        if not (self.request.user.is_staff or self.request.user.is_superuser):
            raise PermissionDenied("Only staff can create employees.")
        serializer.save()


    @action(detail=False, methods=["post"], url_path="create-with-user", permission_classes=[permissions.IsAdminUser])
    def create_with_user(self, request):
        """
        Tworzy obiekt Employee razem z User (wygodne dla panelu administracyjnego).
        Nie zmienia istniejącej logiki create/update — to osobny endpoint:
          POST /api/employees/create-with-user/

        Payload (przykład):
        {
          "email": "john@example.com",
          "password": "Secret123!",   // opcjonalnie
          "first_name": "John",       // opcjonalnie
          "last_name": "Doe",         // opcjonalnie
          "phone_number": "+48 ...",  // wymagane (jak w modelu)
          "position": "Developer",    // wymagane
          "hire_date": "2026-01-07"   // wymagane (YYYY-MM-DD)
        }
        """
        email_raw = (request.data.get("email") or "").strip()
        if not email_raw:
            raise ValidationError({"email": "This field is required."})

        email = email_raw.lower()

        phone_number = (request.data.get("phone_number") or "").strip()
        position = (request.data.get("position") or "").strip()
        hire_date_raw = (request.data.get("hire_date") or "").strip()

        if not phone_number:
            raise ValidationError({"phone_number": "This field is required."})
        if not position:
            raise ValidationError({"position": "This field is required."})
        if not hire_date_raw:
            raise ValidationError({"hire_date": "This field is required."})

        try:
            hire_date = dt_date.fromisoformat(hire_date_raw)
        except ValueError:
            raise ValidationError({"hire_date": "Invalid date format. Use YYYY-MM-DD."})

        first_name = (request.data.get("first_name") or "").strip()
        last_name = (request.data.get("last_name") or "").strip()
        password = request.data.get("password") or None

        # Tworzymy / wykorzystujemy użytkownika po e-mailu (jeśli pole email istnieje),
        # w przeciwnym razie próbujemy po username.
        user_field_names = {f.name for f in UserModel._meta.get_fields() if hasattr(f, "name")}

        def _find_user_by_email() -> UserModel | None:
            if "email" in user_field_names:
                return UserModel.objects.filter(email__iexact=email).first()
            if "username" in user_field_names:
                return UserModel.objects.filter(username__iexact=email).first()
            return None

        with transaction.atomic():
            user = _find_user_by_email()
            if user is None:
                create_kwargs = {}
                if "username" in user_field_names:
                    create_kwargs["username"] = email
                if "email" in user_field_names:
                    create_kwargs["email"] = email
                if "first_name" in user_field_names:
                    create_kwargs["first_name"] = first_name
                if "last_name" in user_field_names:
                    create_kwargs["last_name"] = last_name

                try:
                    if hasattr(UserModel.objects, "create_user"):
                        user = UserModel.objects.create_user(**create_kwargs, password=password)
                    else:
                        user = UserModel.objects.create(**create_kwargs)
                        if password:
                            user.set_password(password)
                            user.save(update_fields=["password"])
                except Exception as e:
                    raise ValidationError({"detail": f"Cannot create user: {e}"})
            else:
                # Jeśli Employee już istnieje — nie duplikujemy.
                if Employee.objects.filter(user=user).exists():
                    raise ValidationError({"detail": "Employee for this user already exists."})

                # Jeżeli podano first_name/last_name, można zaktualizować dane użytkownika.
                update_fields = []
                if first_name and hasattr(user, "first_name"):
                    user.first_name = first_name
                    update_fields.append("first_name")
                if last_name and hasattr(user, "last_name"):
                    user.last_name = last_name
                    update_fields.append("last_name")
                if update_fields:
                    user.save(update_fields=update_fields)

                if password:
                    user.set_password(password)
                    user.save(update_fields=["password"])

            emp = Employee.objects.create(
                user=user,
                phone_number=phone_number,
                position=position,
                hire_date=hire_date,
            )

        return Response(EmployeeSerializer(emp).data, status=201)

    @action(detail=True, methods=["patch"], url_path="update-user", permission_classes=[permissions.IsAdminUser])
    def update_user(self, request, pk=None):
        """
        PATCH /api/employees/{id}/update-user/
        Aktualizacja podstawowych pól użytkownika (email/first_name/last_name/is_active).
        """
        emp = self.get_object()
        user = emp.user
        user_field_names = {f.name for f in UserModel._meta.get_fields() if hasattr(f, "name")}

        changed = []

        if "email" in request.data:
            new_email = (request.data.get("email") or "").strip().lower()
            if new_email:
                if "email" in user_field_names:
                    # Sprawdzenie unikalności, jeśli pole istnieje.
                    if UserModel.objects.filter(email__iexact=new_email).exclude(pk=user.pk).exists():
                        raise ValidationError({"email": "User with this email already exists."})
                    user.email = new_email
                    changed.append("email")
                elif "username" in user_field_names:
                    if UserModel.objects.filter(username__iexact=new_email).exclude(pk=user.pk).exists():
                        raise ValidationError({"email": "User with this username already exists."})
                    user.username = new_email
                    changed.append("username")

        if "first_name" in request.data and hasattr(user, "first_name"):
            user.first_name = (request.data.get("first_name") or "").strip()
            changed.append("first_name")

        if "last_name" in request.data and hasattr(user, "last_name"):
            user.last_name = (request.data.get("last_name") or "").strip()
            changed.append("last_name")

        if "is_active" in request.data and hasattr(user, "is_active"):
            user.is_active = bool(request.data.get("is_active"))
            changed.append("is_active")

        if changed:
            user.save(update_fields=sorted(set(changed)))

        emp.refresh_from_db()
        return Response(EmployeeSerializer(emp).data)

    @action(detail=True, methods=["post"], url_path="set-password", permission_classes=[permissions.IsAdminUser])
    def set_password(self, request, pk=None):
        """
        POST /api/employees/{id}/set-password/
        Body: {"password": "..."}
        """
        emp = self.get_object()
        user = emp.user
        pwd = request.data.get("password") or ""
        if not pwd:
            raise ValidationError({"password": "This field is required."})
        user.set_password(pwd)
        user.save(update_fields=["password"])
        return Response({"status": "ok"})


# -------------------- Wnioski urlopowe --------------------


class LeaveRequestViewSet(viewsets.ModelViewSet):
    queryset = LeaveRequest.objects.select_related("employee", "employee__user").all()
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAdminOrReadOwn]
    lookup_value_regex = r"\d+"

    def get_queryset(self):
        qs = LeaveRequest.objects.select_related("employee", "employee__user")
        if self.request.user.is_staff or self.request.user.is_superuser:
            return qs.order_by("-created_at", "-id")
        emp = _user_employee_or_none(self.request.user)
        return qs.filter(employee=emp).order_by("-created_at", "-id") if emp else qs.none()

    def perform_create(self, serializer):
        # Użytkownik niebędący adminem: tylko dla własnego profilu Employee.
        if not (self.request.user.is_staff or self.request.user.is_superuser):
            emp = _user_employee_or_none(self.request.user)
            if not emp:
                raise PermissionDenied("You don't have an Employee profile.")
            serializer.save(employee=emp, status=LeaveRequest.STATUS_PENDING)
            return

        # Staff/Admin: employee musi być podany, albo admin musi mieć własny profil Employee.
        emp = serializer.validated_data.get("employee")
        if emp is None:
            emp = _user_employee_or_none(self.request.user)
        if emp is None:
            raise ValidationError(
                {
                    "detail": (
                        "employee_id is required for admin users "
                        "(or create Employee profile for current user)."
                    )
                }
            )
        serializer.save(employee=emp, status=LeaveRequest.STATUS_PENDING)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAdminUser])
    def approve(self, request, pk=None):
        obj = self.get_object()

        # Ponowna walidacja po stronie serwera przed zatwierdzeniem:
        # - 0 dni roboczych (np. same weekendy)
        # - nakładanie się z innymi urlopami
        # - przekroczenie limitu w danym roku
        #
        # Logikę walidacji trzymamy w serializer.validate(), aby była wspólna
        # dla tworzenia/edycji oraz dla approve.
        if obj.status != LeaveRequest.STATUS_APPROVED:
            serializer = self.get_serializer(instance=obj, data={}, partial=True)
            serializer.is_valid(raise_exception=True)

            obj.status = LeaveRequest.STATUS_APPROVED
            obj.save(update_fields=["status"])

        return Response({"status": "approved"})

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAdminUser])
    def reject(self, request, pk=None):
        obj = self.get_object()
        obj.status = LeaveRequest.STATUS_REJECTED
        obj.save(update_fields=["status"])
        return Response({"status": "rejected"})


# -------------------- Oceny okresowe --------------------


class PerformanceReviewViewSet(viewsets.ModelViewSet):
    queryset = PerformanceReview.objects.select_related("employee", "employee__user").all()
    serializer_class = PerformanceReviewSerializer
    permission_classes = [IsAdminOrReadOwn]
    lookup_value_regex = r"\d+"

    def get_queryset(self):
        qs = PerformanceReview.objects.select_related("employee", "employee__user")
        if self.request.user.is_staff or self.request.user.is_superuser:
            return qs.order_by("-year", "-month", "-id")
        emp = _user_employee_or_none(self.request.user)
        return qs.filter(employee=emp).order_by("-year", "-month", "-id") if emp else qs.none()

    def perform_create(self, serializer):
        if not (self.request.user.is_staff or self.request.user.is_superuser):
            raise PermissionDenied("Only staff can create reviews.")
        serializer.save()

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        """
        /api/performance/export/?file=csv|xlsx|pdf
        PDF działa, jeśli dostępny jest reportlab; w przeciwnym razie następuje fallback do CSV.
        """
        fmt = (request.query_params.get("file") or "csv").lower()
        qs = self.get_queryset()
        data = [
            {
                "id": r.id,
                "employee": r.employee.user.email,
                "year": r.year,
                "month": r.month,
                "working_days": r.working_days,
                "absent_days": r.absent_days,
                "attendance_score": r.attendance_score,
                "comments": r.comments or "",
            }
            for r in qs
        ]
        df = pd.DataFrame(data)

        if fmt == "xlsx":
            buf = io.BytesIO()
            with pd.ExcelWriter(buf, engine="openpyxl") as writer:
                df.to_excel(writer, index=False, sheet_name="reviews")
            buf.seek(0)
            return FileResponse(
                buf,
                as_attachment=True,
                filename="performance.xlsx",
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )

        if fmt == "pdf":
            try:
                from reportlab.lib import colors
                from reportlab.lib.pagesizes import A4
                from reportlab.lib.styles import getSampleStyleSheet
                from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

                buf = io.BytesIO()
                doc = SimpleDocTemplate(buf, pagesize=A4)
                styles = getSampleStyleSheet()
                story = [Paragraph("Performance Reviews", styles["Heading2"]), Spacer(1, 10)]

                headers = ["ID", "Email", "Rok", "Mies.", "Robocze", "Nieob.", "Frekw.%", "Komentarz"]
                table_data = [headers] + [
                    [
                        row["id"],
                        row["employee"],
                        row["year"],
                        row["month"],
                        row["working_days"],
                        row["absent_days"],
                        row["attendance_score"],
                        row["comments"],
                    ]
                    for row in data
                ]

                table = Table(table_data, repeatRows=1)
                table.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                            ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ]
                    )
                )
                story.append(table)
                doc.build(story)
                buf.seek(0)
                return FileResponse(
                    buf,
                    as_attachment=True,
                    filename="performance.pdf",
                    content_type="application/pdf",
                )
            except Exception:
                pass  # fallback do CSV poniżej

        csv_data = df.to_csv(index=False).encode("utf-8")
        resp = HttpResponse(csv_data, content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="{smart_str("performance.csv")}"'
        return resp


# -------------------- Obecności --------------------


class AttendanceRecordViewSet(viewsets.ModelViewSet):
    queryset = AttendanceRecord.objects.select_related("employee", "employee__user").all()
    serializer_class = AttendanceRecordSerializer
    permission_classes = [IsAdminOrReadOwn]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    lookup_value_regex = r"\d+"

    def get_queryset(self):
        qs = AttendanceRecord.objects.select_related("employee", "employee__user")
        if self.request.user.is_staff or self.request.user.is_superuser:
            return qs.order_by("-date", "-id")
        emp = _user_employee_or_none(self.request.user)
        return qs.filter(employee=emp).order_by("-date", "-id") if emp else qs.none()

    def perform_create(self, serializer):
        if self.request.user.is_staff or self.request.user.is_superuser:
            rec = serializer.save()
        else:
            emp = _user_employee_or_none(self.request.user)
            if not emp:
                raise PermissionDenied("You don't have an Employee profile.")
            rec = serializer.save(employee=emp)

        PerformanceReview.recompute_from_attendance(rec.employee, rec.date.year, rec.date.month)

    def perform_update(self, serializer):
        old = self.get_object()
        old_emp = old.employee
        old_year = old.date.year
        old_month = old.date.month

        rec = serializer.save()

        # Przeliczamy miesiąc sprzed zmiany oraz miesiąc po zmianie (gdyby zmieniła się data/pracownik).
        touched = {(old_emp.id, old_year, old_month), (rec.employee.id, rec.date.year, rec.date.month)}
        for emp_id, y, m in touched:
            emp = Employee.objects.filter(id=emp_id).first()
            if emp:
                PerformanceReview.recompute_from_attendance(emp, y, m)

    def perform_destroy(self, instance):
        emp = instance.employee
        y, m = instance.date.year, instance.date.month
        super().perform_destroy(instance)
        PerformanceReview.recompute_from_attendance(emp, y, m)


    @action(
        detail=False,
        methods=["post"],
        url_path="import",
        permission_classes=[permissions.IsAdminUser],
    )
    def import_csv(self, request):
        """
        Import CSV: email,date,status,minutes,notes
        Endpoint: /api/attendance/import/
        """
        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "No file provided."}, status=400)

        try:
            text = io.TextIOWrapper(file.file, encoding="utf-8")
        except Exception:
            return Response({"detail": "Cannot read file."}, status=400)

        import csv as _csv

        reader = _csv.DictReader(text)
        required = {"email", "date", "status", "minutes", "notes"}
        if reader.fieldnames is None or not set(reader.fieldnames).issuperset(required):
            return Response(
                {"detail": "CSV must have columns: email,date,status,minutes,notes"},
                status=400,
            )

        created = 0
        updated = 0
        errors = []

        allowed_statuses = {k for k, _ in AttendanceRecord.STATUS_CHOICES}

        for i, row in enumerate(reader, start=2):
            email = (row.get("email") or "").strip()
            d = (row.get("date") or "").strip()
            status_val = (row.get("status") or "").strip()
            minutes_raw = ((row.get("minutes_worked") or row.get("minutes")) or "").strip()
            notes = (row.get("notes") or "").strip()

            if not email or not d:
                errors.append({"row": i, "message": "missing email/date"})
                continue

            # Walidacja statusu (zgodnie z choices w modelu).
            if not status_val:
                status_val = AttendanceRecord.STATUS_PRESENT
            if status_val not in allowed_statuses:
                errors.append(
                    {"row": i,
                     "message": f"invalid status: {status_val} (allowed: {', '.join(sorted(allowed_statuses))})"}
                )
                continue

            # Walidacja minut (ochrona przed 500 przy wartościach ujemnych / nienumerycznych).
            if minutes_raw == "":
                minutes_int = 0
            else:
                try:
                    minutes_int = int(float(minutes_raw))
                except ValueError:
                    errors.append({"row": i, "message": f"minutes is not a number: {minutes_raw}"})
                    continue

            if minutes_int < 0:
                errors.append({"row": i, "message": f"minutes must be >= 0: {minutes_int}"})
                continue

            # Ograniczenie długości notatki (żeby uniknąć błędów DB).
            if len(notes) > 255:
                errors.append({"row": i, "message": f"notes too long (max 255), got {len(notes)}"})
                continue

            try:
                emp = Employee.objects.select_related("user").get(user__email=email)
            except Employee.DoesNotExist:
                errors.append({"row": i, "message": f"employee not found: {email}"})
                continue

            try:
                rec_date = dt_date.fromisoformat(d)
            except ValueError:
                errors.append({"row": i, "message": f"bad date: {d}"})
                continue

            try:
                _, was_created = AttendanceRecord.objects.update_or_create(
                    employee=emp,
                    date=rec_date,
                    defaults={
                        "status": status_val,
                        "minutes_worked": minutes_int,
                        "notes": notes,
                    },
                )
                if was_created:
                    created += 1
                else:
                    updated += 1

                try:
                    PerformanceReview.recompute_from_attendance(emp, rec_date.year, rec_date.month)
                except Exception as e:
                    errors.append({"row": i, "message": f"saved, but recompute failed: {e}"})

            except Exception as e:
                errors.append({"row": i, "message": f"save failed: {e}"})
                continue

        return Response(
            {
                "created": created,
                "updated": updated,
                "error_rows": len(errors),
                "errors": errors,
            }
        )


# -------------------- Aktualny użytkownik --------------------


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def current_user(request):
    """Aktualny użytkownik + (opcjonalnie) dane Employee + saldo urlopu."""
    user_data = UserSerializer(request.user).data
    get_token(request)
    employee_data = None
    leave_data = None

    try:
        emp = Employee.objects.get(user=request.user)
        employee_data = {
            "id": emp.id,
            "position": emp.position,
            "phone_number": emp.phone_number,
            "hire_date": emp.hire_date,
            "annual_leave_limit": getattr(emp, "annual_leave_limit", 26),
        }

        # Saldo urlopu liczymy w dniach roboczych (pon–pt) i osobno dla bieżącego roku.
        # Zgodnie z logiką walidacji wniosku (serializer.validate) traktujemy wnioski
        # "pending" jako zarezerwowane – dzięki temu UI pokazuje spójne saldo z backendem.
        year = dt_date.today().year
        limit_days = settings.HR_DEFAULT_ANNUAL_LEAVE_LIMIT_DAYS

        year_start = dt_date(year, 1, 1)
        year_end = dt_date(year, 12, 31)

        # Wybieramy wszystkie wnioski, które nachodzą na bieżący rok.
        overlap_qs = LeaveRequest.objects.filter(
            employee=emp,
            status__in=[LeaveRequest.STATUS_PENDING, LeaveRequest.STATUS_APPROVED],
            start_date__lte=year_end,
            end_date__gte=year_start,
        )

        used_total = 0
        used_approved = 0
        reserved_pending = 0

        for lr in overlap_qs.distinct():
            s = max(lr.start_date, year_start)
            e = min(lr.end_date, year_end)
            if e < s:
                continue
            d = count_workdays(s, e)
            used_total += d
            if lr.status == LeaveRequest.STATUS_APPROVED:
                used_approved += d
            elif lr.status == LeaveRequest.STATUS_PENDING:
                reserved_pending += d

        leave_data = {
            "year": year,
            "limit": limit_days,
            # used = wykorzystane + zarezerwowane (approved + pending)
            "used": used_total,
            "remaining": max(limit_days - used_total, 0),
            # pola pomocnicze (frontend może je wykorzystać opcjonalnie)
            "used_approved": used_approved,
            "reserved_pending": reserved_pending,
        }
    except Employee.DoesNotExist:
        pass

    return Response({"user": user_data, "employee": employee_data, "leave": leave_data})
