from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    api_root,
    EmployeeViewSet,
    LeaveRequestViewSet,
    PerformanceReviewViewSet,
    AttendanceRecordViewSet,
    current_user,
    csrf_token,
)

app_name = "core"

router = DefaultRouter()
router.register(r"employees", EmployeeViewSet, basename="employee")
router.register(r"leave-requests", LeaveRequestViewSet, basename="leaverequest")
router.register(r"performance", PerformanceReviewViewSet, basename="performancereview")
router.register(r"attendance", AttendanceRecordViewSet, basename="attendancerecord")

urlpatterns = [
    path("", api_root, name="api-root"),
    path("", include(router.urls)),
    path("me/", current_user, name="api-me"),
    path("csrf/", csrf_token, name="api-csrf"),
]
