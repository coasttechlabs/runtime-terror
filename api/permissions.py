from rest_framework.permissions import BasePermission

from .authentication import initialize_firebase

try:
    from firebase_admin import firestore
except ImportError:  # pragma: no cover - handled by initialize_firebase at runtime
    firestore = None


USERS_COLLECTION = "users"


def _normalize_role(value):
    return str(value).strip().lower().replace("_", "-").replace(" ", "-")


def _is_admin_like_profile(profile, admin_like_roles):
    if not isinstance(profile, dict):
        return False
    profile_role = profile.get("role")
    profile_rank = profile.get("rank")
    if isinstance(profile_role, str) and _normalize_role(profile_role) in admin_like_roles:
        return True
    if isinstance(profile_rank, str) and _normalize_role(profile_rank) in admin_like_roles:
        return True
    return False


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
        if isinstance(role, str) and _normalize_role(role) in admin_like_roles:
            return True

        roles = claims.get("roles")
        if isinstance(roles, (list, tuple, set)):
            normalized = {_normalize_role(item) for item in roles}
            if admin_like_roles & normalized:
                return True

        uid = getattr(request.user, "username", "")
        if uid and firestore is not None:
            try:
                initialize_firebase()
                users_ref = firestore.client().collection(USERS_COLLECTION)

                snapshot = users_ref.document(uid).get()
                if snapshot.exists and _is_admin_like_profile(snapshot.to_dict() or {}, admin_like_roles):
                    return True

                profile_uid_hits = list(users_ref.where("uid", "==", uid).limit(1).stream())
                if profile_uid_hits and _is_admin_like_profile(profile_uid_hits[0].to_dict() or {}, admin_like_roles):
                    return True

                email = getattr(request.user, "email", "")
                if email:
                    email_hits = list(users_ref.where("email", "==", str(email).strip().lower()).limit(1).stream())
                    if email_hits and _is_admin_like_profile(email_hits[0].to_dict() or {}, admin_like_roles):
                        return True

                username_hits = list(users_ref.where("username", "==", uid).limit(1).stream())
                if username_hits and _is_admin_like_profile(username_hits[0].to_dict() or {}, admin_like_roles):
                    return True
            except Exception:
                # Keep permission checks fail-closed if Firestore read fails.
                pass

        return False
