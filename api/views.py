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
from .pvp import (
    CHALLENGE_TTL_MS,
    advance_match_state,
    create_match_record,
    default_loadout,
    normalize_loadout,
    now_ms,
    serialize_loadout_document,
)

USERS_COLLECTION = "users"
FRIEND_REQUESTS_COLLECTION = "friendRequests"
PVP_LOADOUTS_COLLECTION = "pvpLoadouts"
FRIEND_CHALLENGES_COLLECTION = "friendChallenges"
FRIEND_MATCHES_COLLECTION = "friendMatches"
RANK_OPTIONS = {"player", "unranked", "mod", "admin", "co-owner", "owner", "banned"}
FRIEND_REQUEST_STATUS = {"pending", "accepted", "declined"}
CHALLENGE_RESPONSE_STATUS = {"accepted", "declined"}
CHALLENGE_ACTIVE_STATUS = {"pending", "accepted"}
MATCH_ACTIVE_STATUS = {"active"}


def _users_ref():
    initialize_firebase()
    return firestore.client().collection(USERS_COLLECTION)


def _friend_requests_ref():
    initialize_firebase()
    return firestore.client().collection(FRIEND_REQUESTS_COLLECTION)


def _pvp_loadouts_ref():
    initialize_firebase()
    return firestore.client().collection(PVP_LOADOUTS_COLLECTION)


def _friend_challenges_ref():
    initialize_firebase()
    return firestore.client().collection(FRIEND_CHALLENGES_COLLECTION)


def _friend_matches_ref():
    initialize_firebase()
    return firestore.client().collection(FRIEND_MATCHES_COLLECTION)


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


def _normalize_timestamp_ms(value):
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    seconds = getattr(value, "timestamp", None)
    if callable(seconds):
        return int(seconds() * 1000)
    return None


def _accepted_friend_uids(uid):
    requests_ref = _friend_requests_ref()
    outgoing = list(
        requests_ref.where("fromuserid", "==", uid).where("status", "==", "accepted").stream()
    )
    incoming = list(
        requests_ref.where("touserid", "==", uid).where("status", "==", "accepted").stream()
    )
    accepted = set()
    for entry in outgoing:
        target_uid = (entry.to_dict() or {}).get("touserid")
        if target_uid:
            accepted.add(target_uid)
    for entry in incoming:
        source_uid = (entry.to_dict() or {}).get("fromuserid")
        if source_uid:
            accepted.add(source_uid)
    return accepted


def _serialize_friend_user(uid, usernames):
    users_ref = _users_ref()
    snapshot = users_ref.document(uid).get()
    data = snapshot.to_dict() if snapshot.exists else {}
    return {
        "uid": uid,
        "username": usernames.get(uid, data.get("username") or uid),
        "email": data.get("email", ""),
        "rank": data.get("rank", "unranked"),
    }


def _expire_stale_challenge(snapshot, ref=None):
    data = snapshot.to_dict() or {}
    if data.get("status") != "pending":
        return data
    expires_at_ms = data.get("expiresAtMs")
    if expires_at_ms is None:
        created_at_ms = _normalize_timestamp_ms(data.get("createdAt")) or now_ms()
        expires_at_ms = created_at_ms + CHALLENGE_TTL_MS
    if expires_at_ms > now_ms():
        return data
    updates = {
        "status": "expired",
        "expiredAt": firestore.SERVER_TIMESTAMP,
        "expiredAtMs": now_ms(),
    }
    target_ref = ref or _friend_challenges_ref().document(snapshot.id)
    target_ref.set(updates, merge=True)
    refreshed = target_ref.get()
    return refreshed.to_dict() or data


def _serialize_challenge(snapshot, usernames_by_uid):
    data = _expire_stale_challenge(snapshot)
    return {
        "id": snapshot.id,
        "challengerUid": data.get("challengerUid"),
        "challengerUsername": usernames_by_uid.get(data.get("challengerUid"), data.get("challengerUid")),
        "recipientUid": data.get("recipientUid"),
        "recipientUsername": usernames_by_uid.get(data.get("recipientUid"), data.get("recipientUid")),
        "status": data.get("status", "pending"),
        "matchId": data.get("matchId"),
        "createdAtMs": data.get("createdAtMs"),
        "expiresAtMs": data.get("expiresAtMs"),
        "respondedAtMs": data.get("respondedAtMs"),
    }


def _serialize_match(snapshot, usernames_by_uid):
    data = snapshot.to_dict() or {}
    snapshot_data = data.get("snapshot") or {}
    players = snapshot_data.get("players") or {}
    return {
        "id": snapshot.id,
        "challengeId": data.get("challengeId"),
        "status": data.get("status"),
        "playerAUid": data.get("playerAUid"),
        "playerAUsername": usernames_by_uid.get(data.get("playerAUid"), data.get("playerAUsername") or data.get("playerAUid")),
        "playerBUid": data.get("playerBUid"),
        "playerBUsername": usernames_by_uid.get(data.get("playerBUid"), data.get("playerBUsername") or data.get("playerBUid")),
        "winnerUid": data.get("winnerUid"),
        "terminationReason": data.get("terminationReason"),
        "createdAtMs": data.get("createdAtMs"),
        "acceptedAtMs": data.get("acceptedAtMs"),
        "completedAtMs": data.get("completedAtMs"),
        "snapshot": snapshot_data,
        "players": players,
    }


def _clean_uids(*items):
    return {uid for uid in items if uid}


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


class PvpLoadoutView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        uid = _auth_uid(request)
        snapshot = _pvp_loadouts_ref().document(uid).get()
        if not snapshot.exists:
            return Response({"loadout": serialize_loadout_document(uid, default_loadout())})
        return Response({"loadout": serialize_loadout_document(uid, snapshot.to_dict() or {})})

    def patch(self, request):
        uid = _auth_uid(request)
        payload = request.data if isinstance(request.data, dict) else {}
        try:
            loadout = normalize_loadout(payload)
        except ValueError as exc:
            raise ValidationError({"loadout": str(exc)}) from exc
        doc_ref = _pvp_loadouts_ref().document(uid)
        doc_ref.set(
            {
                **loadout,
                "updatedAt": firestore.SERVER_TIMESTAMP,
                "updatedAtMs": now_ms(),
            },
            merge=True,
        )
        updated = doc_ref.get()
        return Response({"loadout": serialize_loadout_document(uid, updated.to_dict() or {})}, status=status.HTTP_200_OK)


class FriendChallengesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        uid = _auth_uid(request)
        accepted_uids = _accepted_friend_uids(uid)
        usernames = _usernames_map(set(accepted_uids) | {uid})
        friends = [_serialize_friend_user(friend_uid, usernames) for friend_uid in sorted(accepted_uids)]

        challenges_ref = _friend_challenges_ref()
        outgoing = list(challenges_ref.where("challengerUid", "==", uid).stream())
        incoming = list(challenges_ref.where("recipientUid", "==", uid).stream())
        relevant_challenges = outgoing + incoming
        challenge_user_ids = {uid}
        for entry in relevant_challenges:
            data = entry.to_dict() or {}
            challenge_user_ids.add(data.get("challengerUid"))
            challenge_user_ids.add(data.get("recipientUid"))
        challenge_user_ids.discard(None)
        usernames.update(_usernames_map({item for item in challenge_user_ids if item}))
        serialized_outgoing = [_serialize_challenge(entry, usernames) for entry in outgoing]
        serialized_incoming = [_serialize_challenge(entry, usernames) for entry in incoming]

        matches_ref = _friend_matches_ref()
        matches = list(matches_ref.where("playerAUid", "==", uid).stream())
        matches += list(matches_ref.where("playerBUid", "==", uid).stream())
        serialized_matches = [_serialize_match(entry, usernames) for entry in matches]

        return Response(
            {
                "friends": friends,
                "outgoing": serialized_outgoing,
                "incoming": serialized_incoming,
                "matches": serialized_matches,
            }
        )

    def post(self, request):
        uid = _auth_uid(request)
        payload = request.data if isinstance(request.data, dict) else {}
        recipient_uid = str(payload.get("recipientUid", "")).strip()
        if not recipient_uid:
            raise ValidationError({"recipientUid": "recipientUid is required."})
        if recipient_uid == uid:
            raise ValidationError({"recipientUid": "You cannot challenge yourself."})
        accepted_uids = _accepted_friend_uids(uid)
        if recipient_uid not in accepted_uids:
            raise PermissionDenied("You can only challenge accepted friends.")

        challenger_loadout = _pvp_loadouts_ref().document(uid).get()
        recipient_loadout = _pvp_loadouts_ref().document(recipient_uid).get()
        if not challenger_loadout.exists or not recipient_loadout.exists:
            raise ValidationError({"recipientUid": "Both players need a synced PvP loadout before challenging."})

        for snapshot in list(_friend_challenges_ref().where("challengerUid", "==", uid).where("recipientUid", "==", recipient_uid).stream()):
            data = _expire_stale_challenge(snapshot)
            if data.get("status") in CHALLENGE_ACTIVE_STATUS:
                raise ValidationError({"recipientUid": "An active challenge already exists for this friend."})
        for snapshot in list(_friend_challenges_ref().where("challengerUid", "==", recipient_uid).where("recipientUid", "==", uid).stream()):
            data = _expire_stale_challenge(snapshot)
            if data.get("status") in CHALLENGE_ACTIVE_STATUS:
                raise ValidationError({"recipientUid": "An active challenge already exists for this friend."})

        matches = list(_friend_matches_ref().where("playerAUid", "==", uid).stream())
        matches += list(_friend_matches_ref().where("playerBUid", "==", uid).stream())
        for match in matches:
            data = match.to_dict() or {}
            if data.get("status") in MATCH_ACTIVE_STATUS:
                raise ValidationError({"recipientUid": "You are already in an active friend match."})
        recipient_matches = list(_friend_matches_ref().where("playerAUid", "==", recipient_uid).stream())
        recipient_matches += list(_friend_matches_ref().where("playerBUid", "==", recipient_uid).stream())
        for match in recipient_matches:
            data = match.to_dict() or {}
            if data.get("status") in MATCH_ACTIVE_STATUS:
                raise ValidationError({"recipientUid": "That friend is already in an active match."})

        created_ref, _ = _friend_challenges_ref().add(
            {
                "challengerUid": uid,
                "recipientUid": recipient_uid,
                "status": "pending",
                "createdAt": firestore.SERVER_TIMESTAMP,
                "createdAtMs": now_ms(),
                "expiresAtMs": now_ms() + CHALLENGE_TTL_MS,
            }
        )
        created = created_ref.get()
        usernames = _usernames_map({uid, recipient_uid})
        return Response({"challenge": _serialize_challenge(created, usernames)}, status=status.HTTP_201_CREATED)


class FriendChallengeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, challenge_id):
        uid = _auth_uid(request)
        snapshot = _friend_challenges_ref().document(challenge_id).get()
        if not snapshot.exists:
            raise NotFound("Challenge not found.")
        data = snapshot.to_dict() or {}
        if uid not in {data.get("challengerUid"), data.get("recipientUid")}:
            raise PermissionDenied("You do not have access to this challenge.")
        usernames = _usernames_map(_clean_uids(data.get("challengerUid"), data.get("recipientUid")))
        return Response({"challenge": _serialize_challenge(snapshot, usernames)})

    def patch(self, request, challenge_id):
        uid = _auth_uid(request)
        payload = request.data if isinstance(request.data, dict) else {}
        next_status = str(payload.get("status", "")).strip().lower()
        if next_status not in CHALLENGE_RESPONSE_STATUS:
            raise ValidationError({"status": "Status must be accepted or declined."})

        challenge_ref = _friend_challenges_ref().document(challenge_id)
        snapshot = challenge_ref.get()
        if not snapshot.exists:
            raise NotFound("Challenge not found.")
        data = _expire_stale_challenge(snapshot, ref=challenge_ref)
        if data.get("recipientUid") != uid:
            raise PermissionDenied("Only the invited friend can respond to this challenge.")
        if data.get("status") != "pending":
            raise ValidationError({"status": "This challenge can no longer be updated."})

        updates = {
            "status": next_status,
            "respondedAt": firestore.SERVER_TIMESTAMP,
            "respondedAtMs": now_ms(),
        }
        match_snapshot = None
        if next_status == "accepted":
            challenger_uid = data.get("challengerUid")
            recipient_uid = data.get("recipientUid")
            existing_matches = list(_friend_matches_ref().where("playerAUid", "==", challenger_uid).stream())
            existing_matches += list(_friend_matches_ref().where("playerBUid", "==", challenger_uid).stream())
            existing_matches += list(_friend_matches_ref().where("playerAUid", "==", recipient_uid).stream())
            existing_matches += list(_friend_matches_ref().where("playerBUid", "==", recipient_uid).stream())
            for match in existing_matches:
                match_data = match.to_dict() or {}
                if match_data.get("status") in MATCH_ACTIVE_STATUS:
                    raise ValidationError({"status": "One of the players is already in an active friend match."})
            challenger_loadout = _pvp_loadouts_ref().document(challenger_uid).get()
            recipient_loadout = _pvp_loadouts_ref().document(recipient_uid).get()
            if not challenger_loadout.exists or not recipient_loadout.exists:
                raise ValidationError({"status": "Both players need a synced PvP loadout before the match can start."})
            usernames = _usernames_map(_clean_uids(challenger_uid, recipient_uid))
            match_data = create_match_record(
                challenge_id,
                challenger_uid,
                usernames.get(challenger_uid, challenger_uid),
                challenger_loadout.to_dict() or {},
                recipient_uid,
                usernames.get(recipient_uid, recipient_uid),
                recipient_loadout.to_dict() or {},
            )
            match_ref, _ = _friend_matches_ref().add(
                {
                    **match_data,
                    "createdAt": firestore.SERVER_TIMESTAMP,
                    "acceptedAt": firestore.SERVER_TIMESTAMP,
                }
            )
            updates["matchId"] = match_ref.id
            match_snapshot = match_ref.get()

        challenge_ref.set(updates, merge=True)
        updated = challenge_ref.get()
        usernames = _usernames_map(_clean_uids(data.get("challengerUid"), data.get("recipientUid")))
        response_payload = {"challenge": _serialize_challenge(updated, usernames)}
        if match_snapshot is not None:
            response_payload["match"] = _serialize_match(match_snapshot, usernames)
        return Response(response_payload, status=status.HTTP_200_OK)


class FriendMatchDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, match_id):
        uid = _auth_uid(request)
        match_ref = _friend_matches_ref().document(match_id)
        snapshot = match_ref.get()
        if not snapshot.exists:
            raise NotFound("Match not found.")
        data = snapshot.to_dict() or {}
        if uid not in {data.get("playerAUid"), data.get("playerBUid")}:
            raise PermissionDenied("You do not have access to this match.")
        advanced = advance_match_state(data, actor_uid=uid)
        if advanced != data:
            match_ref.set(advanced, merge=False)
            snapshot = match_ref.get()
            data = snapshot.to_dict() or {}
        usernames = _usernames_map(_clean_uids(data.get("playerAUid"), data.get("playerBUid")))
        return Response({"match": _serialize_match(snapshot, usernames)})


class FriendMatchActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, match_id):
        uid = _auth_uid(request)
        payload = request.data if isinstance(request.data, dict) else {}
        match_ref = _friend_matches_ref().document(match_id)
        snapshot = match_ref.get()
        if not snapshot.exists:
            raise NotFound("Match not found.")
        data = snapshot.to_dict() or {}
        if uid not in {data.get("playerAUid"), data.get("playerBUid")}:
            raise PermissionDenied("You do not have access to this match.")
        if data.get("status") != "active":
            raise ValidationError({"detail": "This match is no longer accepting actions."})
        advanced = advance_match_state(data, actor_uid=uid, input_payload=payload)
        match_ref.set(advanced, merge=False)
        updated = match_ref.get()
        usernames = _usernames_map(_clean_uids(advanced.get("playerAUid"), advanced.get("playerBUid")))
        return Response({"match": _serialize_match(updated, usernames)}, status=status.HTTP_200_OK)


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


class AdminUserDetailView(APIView):
    permission_classes = [IsAuthenticated, IsFirebaseAdmin]

    def get(self, request, uid):
        users_ref = _users_ref()
        snapshot = users_ref.document(uid).get()
        if not snapshot.exists:
            raise NotFound("User not found.")
        data = snapshot.to_dict() or {}
        return Response({"user": _serialize_profile(uid, data.get("email", ""), data)})

    def patch(self, request, uid):
        payload = request.data if isinstance(request.data, dict) else {}
        if not payload:
            raise ValidationError({"detail": "No fields provided."})

        users_ref = _users_ref()
        target_ref = users_ref.document(uid)
        current = target_ref.get()
        if not current.exists:
            raise NotFound("User not found.")

        updates = {}

        if "level" in payload:
            try:
                level = int(payload.get("level"))
            except (TypeError, ValueError) as exc:
                raise ValidationError({"level": "Level must be an integer."}) from exc
            if level < 1:
                raise ValidationError({"level": "Level must be at least 1."})
            updates["level"] = level

        if "currentStreak" in payload:
            try:
                current_streak = int(payload.get("currentStreak"))
            except (TypeError, ValueError) as exc:
                raise ValidationError({"currentStreak": "currentStreak must be an integer."}) from exc
            if current_streak < 0:
                raise ValidationError({"currentStreak": "currentStreak must be 0 or greater."})
            updates["currentStreak"] = current_streak

        if "longestStreak" in payload:
            try:
                longest_streak = int(payload.get("longestStreak"))
            except (TypeError, ValueError) as exc:
                raise ValidationError({"longestStreak": "longestStreak must be an integer."}) from exc
            if longest_streak < 0:
                raise ValidationError({"longestStreak": "longestStreak must be 0 or greater."})
            updates["longestStreak"] = longest_streak

        if "tutorialCompleted" in payload:
            tutorial_completed = payload.get("tutorialCompleted")
            if not isinstance(tutorial_completed, bool):
                raise ValidationError({"tutorialCompleted": "tutorialCompleted must be true or false."})
            updates["tutorialCompleted"] = tutorial_completed

        if not updates:
            raise ValidationError({"detail": "No supported fields provided."})

        updates["updatedAt"] = firestore.SERVER_TIMESTAMP
        target_ref.set(updates, merge=True)

        updated = target_ref.get()
        updated_data = updated.to_dict() or {}
        return Response({"user": _serialize_profile(uid, updated_data.get("email", ""), updated_data)}, status=status.HTTP_200_OK)


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
