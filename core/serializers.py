from datetime import date, timedelta
from django.contrib.auth import get_user_model
from rest_framework import serializers
from django.conf import settings


from .models import Employee, LeaveRequest, PerformanceReview, AttendanceRecord

User = get_user_model()

def count_workdays(start: date, end: date) -> int:
    """Count working days (Mon–Fri) inclusive."""
    if not start or not end or end < start:
        return 0
    d = start
    total = 0
    while d <= end:
        if d.weekday() < 5:
            total += 1
        d += timedelta(days=1)
    return total



class UserSerializer(serializers.ModelSerializer):
    """
    Użytkownik Django – używany w /api/me/ oraz jako zagnieżdżony obiekt w EmployeeSerializer.
    """

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "is_active", "is_staff", "is_superuser"]
        extra_kwargs = {"username": {"read_only": True}}


class EmployeeSerializer(serializers.ModelSerializer):
    """
    Pracownik – zwracamy zagnieżdżone dane użytkownika, żeby React mógł od razu
    wyświetlić np. e-mail pracownika.
    """

    user = UserSerializer(read_only=True)

    class Meta:
        model = Employee
        fields = ["id", "user", "phone_number", "position", "hire_date"]



class EmployeeManageSerializer(serializers.ModelSerializer):
    """
    Serializer do zarządzania pracownikami z poziomu React (CRUD).
    Pozwala tworzyć/edytować powiązanego użytkownika Django (email, imię, nazwisko, hasło).
    """

    # Pola użytkownika (write)
    email = serializers.EmailField(write_only=True)
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    # Read-only nested user, jak w EmployeeSerializer
    user = UserSerializer(read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id",
            "user",
            "email",
            "first_name",
            "last_name",
            "password",
            "phone_number",
            "position",
            "hire_date",
        ]

    def create(self, validated_data):
        email = validated_data.pop("email")
        first_name = validated_data.pop("first_name", "")
        last_name = validated_data.pop("last_name", "")
        password = validated_data.pop("password", "")

        # tworzymy użytkownika (username = email)
        user = User(username=email, email=email, first_name=first_name, last_name=last_name)
        if password:
            user.set_password(password)
        else:
            # jeśli nie podano hasła, ustawiamy losowe (admin może potem zresetować)
            user.set_unusable_password()
        user.save()

        employee = Employee.objects.create(user=user, **validated_data)
        return employee

    def update(self, instance, validated_data):
        email = validated_data.pop("email", None)
        first_name = validated_data.pop("first_name", None)
        last_name = validated_data.pop("last_name", None)
        password = validated_data.pop("password", None)

        u = instance.user
        if email:
            u.email = email
            u.username = email
        if first_name is not None:
            u.first_name = first_name
        if last_name is not None:
            u.last_name = last_name
        if password:
            u.set_password(password)
        u.save()

        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance

class LeaveRequestSerializer(serializers.ModelSerializer):
    days = serializers.SerializerMethodField(read_only=True)
    """
    Wniosek urlopowy.
    - employee      – tylko do odczytu (zagnieżdżony EmployeeSerializer, dla Reacta)
    - employee_id   – ID pracownika do zapisu (np. w panelu admina / API)
    """

    employee = EmployeeSerializer(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(),
        source="employee",
        write_only=True,
        required=False,
    )

    def get_days(self, obj):
        return count_workdays(obj.start_date, obj.end_date)


    def validate(self, attrs):
        """
        Walidacja wniosku urlopowego (backend):
        1) Daty muszą być poprawne (end >= start)
        2) Urlop musi obejmować co najmniej 1 dzień roboczy (pon–pt)
        3) Zakres nie może kolidować z innym wnioskiem pracownika (pending/approved)
        4) W każdym roku (gdy urlop przechodzi przez koniec roku) nie może zostać przekroczony limit
           dni urlopu (domyślnie 26), licząc również wnioski oczekujące (pending) jako "zarezerwowane".
        """
        start = attrs.get("start_date") or getattr(self.instance, "start_date", None)
        end = attrs.get("end_date") or getattr(self.instance, "end_date", None)

        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "End date must be greater than or equal to start date."})

        # Ustalamy pracownika:
        # - dla admina może przyjść employee_id (czyli attrs['employee'])
        # - dla zwykłego usera bierzemy z request.user
        emp = attrs.get("employee") or getattr(self.instance, "employee", None)
        if emp is None:
            req = self.context.get("request")
            user = getattr(req, "user", None) if req else None
            if user and user.is_authenticated:
                emp = Employee.objects.filter(user=user).first()

        # Jeśli nie mamy emp albo dat — nie mamy jak walidować
        if emp is None or not start or not end:
            return attrs

        # (2) Urlop musi mieć co najmniej 1 dzień roboczy
        total_req_days = count_workdays(start, end)
        if total_req_days <= 0:
            raise serializers.ValidationError(
                {"detail": "Urlop musi obejmować co najmniej 1 dzień roboczy (pon–pt)."}
            )

        # (3) Brak kolizji z innymi wnioskami (pending/approved) tego pracownika
        conflicts = (
            LeaveRequest.objects.filter(employee=emp)
            .exclude(status=LeaveRequest.STATUS_REJECTED)
            .filter(start_date__lte=end, end_date__gte=start)
        )
        if self.instance and getattr(self.instance, "pk", None):
            conflicts = conflicts.exclude(pk=self.instance.pk)

        if conflicts.exists():
            c = conflicts.order_by("start_date", "id").first()
            raise serializers.ValidationError(
                {
                    "detail": (
                        "Zakres urlopu koliduje z innym wnioskiem urlopowym tego pracownika "
                        f"({c.start_date} – {c.end_date}, status: {c.status})."
                    )
                }
            )

        limit_days = settings.HR_DEFAULT_ANNUAL_LEAVE_LIMIT_DAYS

        def workdays_in_year(s: date, e: date, year: int) -> int:
            ys = date(year, 1, 1)
            ye = date(year, 12, 31)
            s2 = max(s, ys)
            e2 = min(e, ye)
            if e2 < s2:
                return 0
            return count_workdays(s2, e2)

        def used_workdays(year: int) -> int:
            """Suma dni roboczych już wykorzystanych / zarezerwowanych w danym roku."""
            ys = date(year, 1, 1)
            ye = date(year, 12, 31)
            qs = (
                LeaveRequest.objects.filter(
                    employee=emp,
                    status__in=[LeaveRequest.STATUS_PENDING, LeaveRequest.STATUS_APPROVED],
                    start_date__lte=ye,
                    end_date__gte=ys,
                )
                .exclude(status=LeaveRequest.STATUS_REJECTED)
            )
            if self.instance and getattr(self.instance, "pk", None):
                qs = qs.exclude(pk=self.instance.pk)

            total = 0
            for lr in qs.distinct():
                total += workdays_in_year(lr.start_date, lr.end_date, year)
            return total

        # (4) Limit roczny liczony osobno dla każdego roku w zakresie urlopu
        for y in range(start.year, end.year + 1):
            req_days = workdays_in_year(start, end, y)
            if req_days <= 0:
                continue
            used = used_workdays(y)
            if used + req_days > limit_days:
                remaining = max(limit_days - used, 0)
                raise serializers.ValidationError(
                    {
                        "detail": (
                            f"Brak wystarczającej liczby dni urlopu w roku {y}. "
                            f"Pozostało: {remaining}, próbujesz zarezerwować: {req_days}."
                        )
                    }
                )

        return attrs

    class Meta:
        model = LeaveRequest
        fields = [
            "id",
            "employee",
            "employee_id",
            "start_date",
            "end_date",
            "reason",
            "status",
            "days",
            "created_at",
        ]
        read_only_fields = ["id", "status", "days", "created_at", "employee"]


class PerformanceReviewSerializer(serializers.ModelSerializer):
    """
    Ocena miesięczna wygenerowana z obecności.
    Zakładam, że w modelu masz pola: year, month, working_days, absent_days, comments
    i property attendance_score.
    """

    employee = EmployeeSerializer(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(),
        source="employee",
        write_only=True,
        required=False,
    )
    attendance_score = serializers.FloatField(read_only=True)

    class Meta:
        model = PerformanceReview
        fields = [
            "id",
            "employee",
            "employee_id",
            "year",
            "month",
            "working_days",
            "absent_days",
            "attendance_score",
            "comments",
        ]
        read_only_fields = ["id", "attendance_score", "employee"]


class AttendanceRecordSerializer(serializers.ModelSerializer):
    """
    Pojedynczy wpis obecności – endpoint /api/attendance/.
    """

    employee = EmployeeSerializer(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(),
        source="employee",
        write_only=True,
        required=False,
    )

    class Meta:
        model = AttendanceRecord
        fields = [
            "id",
            "employee",
            "employee_id",
            "date",
            "status",
            "minutes_worked",
            "notes",
        ]
        read_only_fields = ["id", "employee"]
