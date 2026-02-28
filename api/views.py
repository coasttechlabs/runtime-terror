from firebase_admin import firestore
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import initialize_firebase
from .permissions import IsFirebaseAdmin

USERS_COLLECTION = "users"
RANK_OPTIONS = {"player", "unranked", "mod", "admin", "co-owner", "owner"}


def _users_ref():
    initialize_firebase()
    return firestore.client().collection(USERS_COLLECTION)


def _serialize_user(doc_snapshot):
    data = doc_snapshot.to_dict() or {}
    return {
        "uid": doc_snapshot.id,
        "username": data.get("username"),
        "email": data.get("email"),
        "rank": data.get("rank", "unranked"),
    }


class AdminHealthView(APIView):
    permission_classes = [IsAuthenticated, IsFirebaseAdmin]

    def get(self, request):
        return Response({"ok": True})


class AdminMeView(APIView):
    permission_classes = [IsAuthenticated, IsFirebaseAdmin]

    def get(self, request):
        claims = request.auth if isinstance(request.auth, dict) else {}

        return Response(
            {
                "uid": request.user.username,
                "email": request.user.email,
                "admin": claims.get("admin", False),
                "role": claims.get("role"),
                "roles": claims.get("roles", []),
            }
        )


class AdminUsersView(APIView):
    permission_classes = [IsAuthenticated, IsFirebaseAdmin]

    def get(self, request):
        users_ref = _users_ref()
        search = (request.query_params.get("search") or "").strip()
        try:
            requested_limit = int(request.query_params.get("limit", 50))
        except (TypeError, ValueError) as exc:
            raise ValidationError({"limit": "Limit must be an integer."}) from exc
        limit = min(max(requested_limit, 1), 200)

        if not search:
            docs = list(users_ref.limit(limit).stream())
            return Response({"users": [_serialize_user(entry) for entry in docs]})

        hits = {}

        direct = users_ref.document(search).get()
        if direct.exists:
            hits[direct.id] = _serialize_user(direct)

        by_username = users_ref.where("username", "==", search).limit(limit).stream()
        for entry in by_username:
            hits[entry.id] = _serialize_user(entry)

        by_email = users_ref.where("email", "==", search.lower()).limit(limit).stream()
        for entry in by_email:
            hits[entry.id] = _serialize_user(entry)

        return Response({"users": list(hits.values())})


class AdminUserRankView(APIView):
    permission_classes = [IsAuthenticated, IsFirebaseAdmin]

    def patch(self, request, uid):
        rank_value = str(request.data.get("rank", "")).strip()
        normalized_rank = rank_value.lower()
        if normalized_rank not in RANK_OPTIONS:
            raise ValidationError({"rank": "Invalid rank value."})

        users_ref = _users_ref()
        target_ref = users_ref.document(uid)
        current = target_ref.get()
        if not current.exists:
            raise NotFound("User not found.")

        target_ref.set(
            {
                "rank": rank_value,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )

        updated = target_ref.get()
        return Response({"user": _serialize_user(updated)}, status=status.HTTP_200_OK)
