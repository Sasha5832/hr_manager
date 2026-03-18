from datetime import timedelta

from django.contrib import admin
from django.utils.html import format_html

from .models import Employee, LeaveRequest, PerformanceReview, AttendanceRecord


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("id", "user_email", "user_name", "position", "phone_number", "hire_date")
    list_select_related = ("user",)
    search_fields = ("user__email", "user__first_name", "user__last_name", "position", "phone_number")
    list_filter = ("position", "hire_date")
    ordering = ("-id",)

    @admin.display(description="Email")
    def user_email(self, obj: Employee) -> str:
        return obj.user.email

    @admin.display(description="Imię i nazwisko")
    def user_name(self, obj: Employee) -> str:
        first = obj.user.first_name or ""
        last = obj.user.last_name or ""
        name = (first + " " + last).strip()
        return name or "—"


@admin.action(description="✅ Zatwierdź zaznaczone wnioski")
def approve_requests(modeladmin, request, queryset):
    queryset.update(status=LeaveRequest.STATUS_APPROVED)


@admin.action(description="❌ Odrzuć zaznaczone wnioski")
def reject_requests(modeladmin, request, queryset):
    queryset.update(status=LeaveRequest.STATUS_REJECTED)


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "employee_email", "period", "status_badge", "days", "created_at")
    list_select_related = ("employee", "employee__user")
    search_fields = ("employee__user__email", "reason")
    list_filter = ("status", "start_date", "end_date", "created_at")
    date_hierarchy = "start_date"
    ordering = ("-created_at", "-id")
    actions = (approve_requests, reject_requests)
    readonly_fields = ("created_at",)

    @admin.display(description="Pracownik (email)")
    def employee_email(self, obj: LeaveRequest) -> str:
        return obj.employee.user.email

    @admin.display(description="Okres")
    def period(self, obj: LeaveRequest) -> str:
        return f"{obj.start_date} → {obj.end_date}"

    @admin.display(description="Dni (robocze)")
    def days(self, obj: LeaveRequest) -> int:
        # Liczymy dni robocze (pon–pt) włącznie na podstawie dat.
        if not obj.start_date or not obj.end_date or obj.end_date < obj.start_date:
            return 0
        d = obj.start_date
        total = 0
        while d <= obj.end_date:
            if d.weekday() < 5:
                total += 1
            d += timedelta(days=1)
        return total

    @admin.display(description="Status")
    def status_badge(self, obj: LeaveRequest) -> str:
        color = {
            LeaveRequest.STATUS_PENDING: "#d97706",
            LeaveRequest.STATUS_APPROVED: "#16a34a",
            LeaveRequest.STATUS_REJECTED: "#dc2626",
        }.get(obj.status, "#374151")
        label = dict(LeaveRequest.STATUS_CHOICES).get(obj.status, obj.status)
        return format_html('<span style="color:{}; font-weight:600;">{}</span>', color, label)


@admin.register(PerformanceReview)
class PerformanceReviewAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "employee_email",
        "month",
        "year",
        "working_days",
        "absent_days",
        "attendance_score",
        "comments_short",
    )
    list_select_related = ("employee", "employee__user")
    search_fields = ("employee__user__email", "comments")
    list_filter = ("year", "month")
    ordering = ("-year", "-month", "-id")

    @admin.display(description="Pracownik (email)")
    def employee_email(self, obj: PerformanceReview) -> str:
        return obj.employee.user.email

    @admin.display(description="Komentarz")
    def comments_short(self, obj: PerformanceReview) -> str:
        if not obj.comments:
            return "—"
        txt = obj.comments.strip()
        return txt if len(txt) <= 60 else txt[:57] + "..."


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ("id", "date", "employee_email", "status", "minutes_worked", "notes")
    list_select_related = ("employee", "employee__user")
    search_fields = ("employee__user__email", "notes")
    list_filter = ("status", "date")
    date_hierarchy = "date"
    ordering = ("-date", "-id")

    @admin.display(description="Pracownik (email)")
    def employee_email(self, obj: AttendanceRecord) -> str:
        return obj.employee.user.email
