from firebase_admin import firestore
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import firebase_auth, initialize_firebase
from .permissions import IsFirebaseAdmin

USERS_COLLECTION = "users"
FRIEND_REQUESTS_COLLECTION = "friendRequests"
RANK_OPTIONS = {"player", "unranked", "mod", "admin", "co-owner", "owner"}
FRIEND_REQUEST_STATUS = {"pending", "accepted", "declined"}


def _users_ref():
    initialize_firebase()
    return firestore.client().collection(USERS_COLLECTION)


def _friend_requests_ref():
    initialize_firebase()
    return firestore.client().collection(FRIEND_REQUESTS_COLLECTION)


def _auth_uid(request):
    return request.user.username


def _serialize_user(doc_snapshot):
    data = doc_snapshot.to_dict() or {}
    return {
        "uid": doc_snapshot.id,
        "username": data.get("username"),
        "email": data.get("email"),
        "rank": data.get("rank", "unranked"),
    }


def _serialize_profile(uid, email, data):
    return {
        "uid": uid,
        "email": data.get("email") or email or "",
        "username": data.get("username", ""),
        "rank": data.get("rank", "unranked"),
        "role": data.get("role", "player"),
        "level": data.get("level", 0),
        "currentStreak": data.get("currentStreak", 0),
        "longestStreak": data.get("longestStreak", data.get("longeststreak", 0)),
        "tutorialCompleted": bool(data.get("tutorialCompleted", False)),
    }


def _usernames_map(uids):
    users_ref = _users_ref()
    resolved = {}
    for uid in uids:
        if uid in resolved:
            continue
        snapshot = users_ref.document(uid).get()
        if snapshot.exists:
            data = snapshot.to_dict() or {}
            resolved[uid] = data.get("username") or uid
        else:
            resolved[uid] = uid
    return resolved


def _serialize_friend_request(snapshot, usernames_by_uid):
    data = snapshot.to_dict() or {}
    from_uid = data.get("fromuserid", "")
    to_uid = data.get("touserid", "")
    return {
        "id": snapshot.id,
        "fromuserid": from_uid,
        "touserid": to_uid,
        "fromUsername": usernames_by_uid.get(from_uid, from_uid),
        "toUsername": usernames_by_uid.get(to_uid, to_uid),
        "status": data.get("status", "pending"),
        "createdAt": data.get("createdAt"),
        "respondedAt": data.get("respondedAt"),
    }


def _find_user_by_identifier(identifier):
    users_ref = _users_ref()
    raw = str(identifier or "").strip()
    if not raw:
        return None

    direct = users_ref.document(raw).get()
    if direct.exists:
        return direct

    by_username = list(users_ref.where("username", "==", raw).limit(1).stream())
    if by_username:
        return by_username[0]

    by_email = list(users_ref.where("email", "==", raw.lower()).limit(1).stream())
    if by_email:
        return by_email[0]

    return None


class ProfileMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        uid = _auth_uid(request)
        email = request.user.email or ""
        snapshot = _users_ref().document(uid).get()
        data = snapshot.to_dict() if snapshot.exists else {}
        return Response({"profile": _serialize_profile(uid, email, data)})

    def patch(self, request):
        uid = _auth_uid(request)
        payload = request.data if isinstance(request.data, dict) else {}
        users_ref = _users_ref()
        updates = {}

        if "username" in payload:
            username = str(payload.get("username", "")).strip()
            if not username:
                raise ValidationError({"username": "Display name is required."})
            if not (2 <= len(username) <= 32):
                raise ValidationError({"username": "Display name must be between 2 and 32 characters."})

            existing_username = list(users_ref.where("username", "==", username).limit(1).stream())
            if existing_username and existing_username[0].id != uid:
                raise ValidationError({"username": "That display name is already taken."})
            updates["username"] = username

        if "email" in payload:
            email = str(payload.get("email", "")).strip().lower()
            if not email:
                raise ValidationError({"email": "Email is required."})

            try:
                validate_email(email)
            except DjangoValidationError as exc:
                raise ValidationError({"email": "Enter a valid email address."}) from exc

            existing_email = list(users_ref.where("email", "==", email).limit(1).stream())
            if existing_email and existing_email[0].id != uid:
                raise ValidationError({"email": "That email is already in use."})

            initialize_firebase()
            if firebase_auth is None:
                raise ValidationError({"email": "Email updates are unavailable right now."})
            try:
                firebase_auth.update_user(uid, email=email)
            except Exception as exc:
                raise ValidationError({"email": "Failed to update auth email."}) from exc

            if request.user.email != email:
                request.user.email = email
                request.user.save(update_fields=["email"])
            updates["email"] = email
        elif request.user.email:
            updates["email"] = request.user.email.lower()

        if "tutorialCompleted" in payload:
            tutorial_completed = payload.get("tutorialCompleted")
            if not isinstance(tutorial_completed, bool):
                raise ValidationError({"tutorialCompleted": "tutorialCompleted must be true or false."})
            updates["tutorialCompleted"] = tutorial_completed

        if not updates:
            raise ValidationError({"detail": "No valid profile fields were provided."})

        updates["lastactivedate"] = firestore.SERVER_TIMESTAMP
        updates["updatedAt"] = firestore.SERVER_TIMESTAMP

        user_ref = users_ref.document(uid)
        user_ref.set(updates, merge=True)
        updated = user_ref.get()
        return Response(
            {
                "profile": _serialize_profile(
                    uid,
                    request.user.email or "",
                    updated.to_dict() if updated.exists else {},
                )
            },
            status=status.HTTP_200_OK,
        )


class FriendRequestsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        uid = _auth_uid(request)
        requests_ref = _friend_requests_ref()

        outgoing = list(requests_ref.where("fromuserid", "==", uid).stream())
        incoming = list(requests_ref.where("touserid", "==", uid).stream())
        all_requests = outgoing + incoming

        user_ids = set()
        for entry in all_requests:
            data = entry.to_dict() or {}
            user_ids.add(data.get("fromuserid", ""))
            user_ids.add(data.get("touserid", ""))

        user_ids.discard("")
        usernames = _usernames_map(user_ids)

        serialized_outgoing = [_serialize_friend_request(entry, usernames) for entry in outgoing]
        serialized_incoming = [_serialize_friend_request(entry, usernames) for entry in incoming]
        return Response({"outgoing": serialized_outgoing, "incoming": serialized_incoming})

    def post(self, request):
        uid = _auth_uid(request)
        payload = request.data if isinstance(request.data, dict) else {}
        identifier = str(payload.get("identifier", "")).strip()
        if not identifier:
            raise ValidationError({"identifier": "Identifier is required."})

        target = _find_user_by_identifier(identifier)
        if target is None or not target.exists:
            raise NotFound("User not found.")

        target_uid = target.id
        if target_uid == uid:
            raise ValidationError({"identifier": "You cannot send a request to yourself."})

        requests_ref = _friend_requests_ref()
        existing = list(requests_ref.where("fromuserid", "==", uid).where("touserid", "==", target_uid).stream())
        existing += list(requests_ref.where("fromuserid", "==", target_uid).where("touserid", "==", uid).stream())

        for item in existing:
            state = (item.to_dict() or {}).get("status", "")
            if state == "pending":
                raise ValidationError({"identifier": "A pending friend request already exists."})
            if state == "accepted":
                raise ValidationError({"identifier": "You are already friends."})

        created_ref, _ = requests_ref.add(
            {
                "fromuserid": uid,
                "touserid": target_uid,
                "status": "pending",
                "createdAt": firestore.SERVER_TIMESTAMP,
            }
        )
        created = created_ref.get()
        usernames = _usernames_map({uid, target_uid})
        return Response({"request": _serialize_friend_request(created, usernames)}, status=status.HTTP_201_CREATED)


class FriendRequestDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, request_id):
        uid = _auth_uid(request)
        payload = request.data if isinstance(request.data, dict) else {}
        next_status = str(payload.get("status", "")).strip().lower()
        if next_status not in FRIEND_REQUEST_STATUS - {"pending"}:
            raise ValidationError({"status": "Status must be accepted or declined."})

        ref = _friend_requests_ref().document(request_id)
        snapshot = ref.get()
        if not snapshot.exists:
            raise NotFound("Friend request not found.")

        data = snapshot.to_dict() or {}
        if data.get("touserid") != uid:
            raise PermissionDenied("Only the recipient can respond to this request.")

        if data.get("status") != "pending":
            raise ValidationError({"status": "This request has already been handled."})

        ref.set({"status": next_status, "respondedAt": firestore.SERVER_TIMESTAMP}, merge=True)
        updated = ref.get()
        user_ids = {data.get("fromuserid", ""), data.get("touserid", "")}
        user_ids.discard("")
        usernames = _usernames_map(user_ids)
        return Response({"request": _serialize_friend_request(updated, usernames)}, status=status.HTTP_200_OK)


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
