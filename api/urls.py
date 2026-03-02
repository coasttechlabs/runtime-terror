from django.urls import path

from .views import (
    AdminHealthView,
    AdminMeView,
    AdminUserRankView,
    AdminUsersView,
    FriendRequestDetailView,
    FriendRequestsView,
    ProfileMeView,
)

urlpatterns = [
    path("admin/health", AdminHealthView.as_view(), name="admin-health"),
    path("admin/me", AdminMeView.as_view(), name="admin-me"),
    path("admin/users", AdminUsersView.as_view(), name="admin-users"),
    path("admin/users/<str:uid>/rank", AdminUserRankView.as_view(), name="admin-user-rank"),
    path("profile/me", ProfileMeView.as_view(), name="profile-me"),
    path("friends/requests", FriendRequestsView.as_view(), name="friend-requests"),
    path("friends/requests/<str:request_id>", FriendRequestDetailView.as_view(), name="friend-request-detail"),
]
