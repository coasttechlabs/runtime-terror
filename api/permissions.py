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

        admin_like_roles = {"admin", "superadmin", "owner", "co-owner", "coowner"}

        role = claims.get("role")
        if isinstance(role, str) and role.strip().lower().replace("_", "-").replace(" ", "-") in admin_like_roles:
            return True

        roles = claims.get("roles")
        if isinstance(roles, (list, tuple, set)):
            normalized = {
                str(item).strip().lower().replace("_", "-").replace(" ", "-")
                for item in roles
            }
            if admin_like_roles & normalized:
                return True

        return False
