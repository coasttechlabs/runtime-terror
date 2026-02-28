from django.urls import path

from .views import AdminHealthView, AdminMeView, AdminUserRankView, AdminUsersView

urlpatterns = [
    path("admin/health", AdminHealthView.as_view(), name="admin-health"),
    path("admin/me", AdminMeView.as_view(), name="admin-me"),
    path("admin/users", AdminUsersView.as_view(), name="admin-users"),
    path("admin/users/<str:uid>/rank", AdminUserRankView.as_view(), name="admin-user-rank"),
]
