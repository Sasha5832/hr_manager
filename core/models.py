from datetime import date, timedelta
from calendar import monthrange
from django.db import models
from django.contrib.auth import get_user_model
from django.db.models import Q, F

User = get_user_model()


class Employee(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    phone_number = models.CharField(max_length=20)
    position = models.CharField(max_length=50)
    hire_date = models.DateField()

    def __str__(self):
        return f"{self.user.email} – {self.position}"


# -----------------------------
# Wniosek urlopowy
# -----------------------------
class LeaveRequest(models.Model):
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Oczekuje"),
        (STATUS_APPROVED, "Zaakceptowany"),
        (STATUS_REJECTED, "Odrzucony"),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE)
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["employee", "start_date"]),
            models.Index(fields=["employee", "end_date"]),
            models.Index(fields=["status"]),
        ]
        constraints = [
            # Upewniamy się, że zakres dat jest poprawny: koniec >= początek
            models.CheckConstraint(
                condition=models.Q(end_date__gte=models.F("start_date")),
                name="leave_dates_order",
            )
        ]

    @property
    def days(self) -> int:
        """Liczba dni urlopu w dniach roboczych (pon–pt), inkluzywnie."""
        d = self.start_date
        end = self.end_date
        total = 0
        while d <= end:
            if d.weekday() < 5:
                total += 1
            d += timedelta(days=1)
        return total

    def __str__(self):
        return f"{self.employee} | {self.start_date} → {self.end_date}"


# -----------------------------
# Rejestr obecności (dziennej)
# -----------------------------
class AttendanceRecord(models.Model):
    STATUS_PRESENT = "present"
    STATUS_ABSENT = "absent"
    STATUS_REMOTE = "remote"
    STATUS_SICK = "sick"
    STATUS_VACATION = "vacation"

    STATUS_CHOICES = [
        (STATUS_PRESENT, "Obecny"),
        (STATUS_REMOTE, "Zdalnie"),
        (STATUS_SICK, "Chorobowe"),
        (STATUS_VACATION, "Urlop"),
        (STATUS_ABSENT, "Nieobecny"),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE)
    date = models.DateField()
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PRESENT)
    minutes_worked = models.PositiveIntegerField(default=0, help_text="Łączna liczba minut pracy w tym dniu")
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-date", "-id"]
        unique_together = (("employee", "date"),)
        indexes = [
            models.Index(fields=["employee", "date"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"{self.employee} @ {self.date} [{self.status}]"


# -----------------------------
# Ocena miesięczna (1..12)
# -----------------------------
def current_year() -> int:
    return date.today().year


class PerformanceReview(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE)
    year = models.PositiveIntegerField(default=current_year)
    month = models.PositiveSmallIntegerField()  # 1..12
    working_days = models.PositiveIntegerField()
    absent_days = models.PositiveIntegerField()
    comments = models.TextField(blank=True)

    class Meta:
        ordering = ["-year", "-month", "-id"]
        indexes = [models.Index(fields=["employee", "year", "month"])]
        constraints = [
            models.UniqueConstraint(fields=["employee", "year", "month"], name="uniq_employee_year_month"),
            # absent_days nie może przekroczyć working_days
            models.CheckConstraint(
                condition=models.Q(absent_days__lte=models.F("working_days")),
                name="absent_le_working",
            ),
            # miesiąc musi być w zakresie 1..12
            models.CheckConstraint(
                condition=models.Q(month__gte=1) & models.Q(month__lte=12),
                name="month_between_1_12",
            ),
        ]

    @property
    def attendance_score(self) -> float:
        if self.working_days == 0:
            return 0.0
        present = self.working_days - self.absent_days
        return round(100 * present / self.working_days, 2)

    def __str__(self):
        return f"{self.employee} | {self.month:02d}/{self.year}"

    @staticmethod
    def recompute_from_attendance(employee: Employee, year: int, month: int) -> "PerformanceReview":
        """Przelicza metryki na podstawie AttendanceRecord w danym miesiącu."""
        start = date(year, month, 1)
        end = date(year, month, monthrange(year, month)[1])

        qs = AttendanceRecord.objects.filter(employee=employee, date__range=(start, end))

        working_days = qs.values("date").distinct().count()
        absent_days = qs.filter(status=AttendanceRecord.STATUS_ABSENT).values("date").distinct().count()

        obj, _ = PerformanceReview.objects.update_or_create(
            employee=employee,
            year=year,
            month=month,
            defaults={"working_days": working_days, "absent_days": absent_days},
        )
        return obj
