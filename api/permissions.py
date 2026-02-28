from rest_framework.permissions import BasePermission


class IsFirebaseAdmin(BasePermission):
    message = "Admin privileges are required."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser or request.user.is_staff:
            return True

        claims = request.auth if isinstance(request.auth, dict) else {}

        if claims.get("admin") is True:
            return True

        role = claims.get("role")
        if isinstance(role, str) and role.lower() in {"admin", "superadmin"}:
            return True

        roles = claims.get("roles")
        if isinstance(roles, (list, tuple, set)):
            normalized = {str(item).lower() for item in roles}
            if {"admin", "superadmin"} & normalized:
                return True

        return False