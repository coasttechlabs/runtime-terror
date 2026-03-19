from django.urls import path

from .views import (
    AdminHealthView,
    AdminMeView,
    AdminUserDetailView,
    AdminUserRankView,
    AdminUsersView,
    FriendChallengeDetailView,
    FriendChallengesView,
    FriendMatchActionView,
    FriendMatchDetailView,
    FriendRequestDetailView,
    FriendRequestsView,
    PvpLoadoutView,
    ProfileMeView,
)

urlpatterns = [
    path("admin/health", AdminHealthView.as_view(), name="admin-health"),
    path("admin/me", AdminMeView.as_view(), name="admin-me"),
    path("admin/users", AdminUsersView.as_view(), name="admin-users"),
    path("admin/users/<str:uid>", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("admin/users/<str:uid>/rank", AdminUserRankView.as_view(), name="admin-user-rank"),
    path("profile/me", ProfileMeView.as_view(), name="profile-me"),
    path("pvp/loadout", PvpLoadoutView.as_view(), name="pvp-loadout"),
    path("friends/requests", FriendRequestsView.as_view(), name="friend-requests"),
    path("friends/requests/<str:request_id>", FriendRequestDetailView.as_view(), name="friend-request-detail"),
    path("friends/challenges", FriendChallengesView.as_view(), name="friend-challenges"),
    path("friends/challenges/<str:challenge_id>", FriendChallengeDetailView.as_view(), name="friend-challenge-detail"),
    path("matches/<str:match_id>", FriendMatchDetailView.as_view(), name="friend-match-detail"),
    path("matches/<str:match_id>/actions", FriendMatchActionView.as_view(), name="friend-match-actions"),
]
