from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate

from api.authentication import FirebaseAuthentication
from api.permissions import IsFirebaseAdmin
from api.views import (
    FriendChallengeDetailView,
    FriendChallengesView,
    FriendMatchActionView,
    FriendMatchDetailView,
    PvpLoadoutView,
)


class FakeSnapshot:
    def __init__(self, doc_id, data, exists=True):
        self.id = doc_id
        self._data = deepcopy(data) if data is not None else None
        self.exists = exists

    def to_dict(self):
        return deepcopy(self._data) if self._data is not None else None


class FakeDocumentRef:
    def __init__(self, collection, doc_id):
        self.collection = collection
        self.id = doc_id

    def get(self):
        data = self.collection._docs.get(self.id)
        return FakeSnapshot(self.id, data, exists=data is not None)

    def set(self, data, merge=False):
        if merge and self.id in self.collection._docs:
            current = deepcopy(self.collection._docs[self.id])
            current.update(deepcopy(data))
            self.collection._docs[self.id] = current
        else:
            self.collection._docs[self.id] = deepcopy(data)


class FakeQuery:
    def __init__(self, collection, filters=None, limit_value=None):
        self.collection = collection
        self.filters = filters or []
        self.limit_value = limit_value

    def where(self, field, operator, value):
        return FakeQuery(self.collection, self.filters + [(field, operator, value)], self.limit_value)

    def limit(self, value):
        return FakeQuery(self.collection, self.filters, value)

    def stream(self):
        docs = []
        for doc_id, data in self.collection._docs.items():
            if self._matches(data):
                docs.append(FakeSnapshot(doc_id, data, exists=True))
        if self.limit_value is not None:
            docs = docs[: self.limit_value]
        return docs

    def _matches(self, data):
        for field, operator, value in self.filters:
            if operator != "==":
                raise AssertionError(f"Unsupported fake query operator: {operator}")
            if data.get(field) != value:
                return False
        return True


class FakeCollection(FakeQuery):
    def __init__(self, name, docs=None):
        self.name = name
        self._docs = deepcopy(docs or {})
        super().__init__(self)

    def document(self, doc_id):
        return FakeDocumentRef(self, doc_id)

    def add(self, data):
        next_id = f"{self.name}-{len(self._docs) + 1}"
        self._docs[next_id] = deepcopy(data)
        return FakeDocumentRef(self, next_id), None


class FirebaseAuthenticationTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    @patch("api.authentication.initialize_firebase")
    @patch("api.authentication.firebase_auth")
    def test_authenticate_creates_or_updates_user(self, firebase_auth_mock, initialize_mock):
        firebase_auth_mock.verify_id_token.return_value = {
            "uid": "firebase-uid-1",
            "email": "admin@example.com",
            "admin": True,
        }

        request = self.factory.get("/api/admin/me", HTTP_AUTHORIZATION="Bearer token-value")
        result = FirebaseAuthentication().authenticate(request)

        self.assertIsNotNone(result)
        user, claims = result
        self.assertEqual(user.username, "firebase-uid-1")
        self.assertEqual(user.email, "admin@example.com")
        self.assertEqual(claims["admin"], True)


class IsFirebaseAdminTests(TestCase):
    def test_allows_admin_claim(self):
        request = APIRequestFactory().get("/api/admin/me")
        request.user = SimpleNamespace(is_authenticated=True, is_staff=False, is_superuser=False)
        request.auth = {"admin": True}

        allowed = IsFirebaseAdmin().has_permission(request, view=None)
        self.assertTrue(allowed)

    def test_blocks_non_admin_claims(self):
        request = APIRequestFactory().get("/api/admin/me")
        request.user = SimpleNamespace(is_authenticated=True, is_staff=False, is_superuser=False)
        request.auth = {"role": "user"}

        allowed = IsFirebaseAdmin().has_permission(request, view=None)
        self.assertFalse(allowed)


class FriendPvpApiTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        user_model = get_user_model()
        self.alice = user_model.objects.create_user(username="alice", email="alice@example.com")
        self.bob = user_model.objects.create_user(username="bob", email="bob@example.com")
        self.charlie = user_model.objects.create_user(username="charlie", email="charlie@example.com")
        self.fake_now = 1_700_000_000_000

        self.users = FakeCollection(
            "users",
            {
                "alice": {"username": "alice", "email": "alice@example.com"},
                "bob": {"username": "bob", "email": "bob@example.com"},
                "charlie": {"username": "charlie", "email": "charlie@example.com"},
            },
        )
        self.friend_requests = FakeCollection(
            "friendRequests",
            {
                "fr-1": {
                    "fromuserid": "alice",
                    "touserid": "bob",
                    "status": "accepted",
                }
            },
        )
        self.loadouts = FakeCollection("pvpLoadouts")
        self.challenges = FakeCollection("friendChallenges")
        self.matches = FakeCollection("friendMatches")

        self.patchers = [
            patch("api.views._users_ref", return_value=self.users),
            patch("api.views._friend_requests_ref", return_value=self.friend_requests),
            patch("api.views._pvp_loadouts_ref", return_value=self.loadouts),
            patch("api.views._friend_challenges_ref", return_value=self.challenges),
            patch("api.views._friend_matches_ref", return_value=self.matches),
            patch("api.views.now_ms", side_effect=lambda: self.fake_now),
            patch("api.pvp.now_ms", side_effect=lambda: self.fake_now),
        ]
        for patcher in self.patchers:
            patcher.start()
        self.addCleanup(self.stop_patchers)

    def stop_patchers(self):
        for patcher in reversed(self.patchers):
            patcher.stop()

    def auth_request(self, method, path, user, data=None, view=None, **kwargs):
        request_method = getattr(self.factory, method)
        request = request_method(path, data=data or {}, format="json")
        force_authenticate(request, user=user, token={"uid": user.username})
        response = view(request, **kwargs)
        response.render()
        return response

    def sync_loadout(self, user, modules=None, berserks=None):
        payload = {
            "playerBotKey": "acid",
            "modules": modules or {"damage": 1, "health": 1, "armor": 0, "speed": 0},
            "berserks": berserks or [],
            "equippedBerserk": "elemental" if (berserks and "elemental" in berserks) else None,
            "salvage": [],
            "equippedUniques": {},
        }
        response = self.auth_request("patch", "/api/pvp/loadout", user, payload, PvpLoadoutView.as_view())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data["loadout"]

    def create_challenge(self, challenger, recipient_uid="bob"):
        return self.auth_request(
            "post",
            "/api/friends/challenges",
            challenger,
            {"recipientUid": recipient_uid},
            FriendChallengesView.as_view(),
        )

    def test_challenge_creation_requires_friend_and_synced_loadouts(self):
        self.sync_loadout(self.alice)

        non_friend = self.create_challenge(self.alice, recipient_uid="charlie")
        self.assertEqual(non_friend.status_code, status.HTTP_403_FORBIDDEN)

        missing_loadout = self.create_challenge(self.alice, recipient_uid="bob")
        self.assertEqual(missing_loadout.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("synced PvP loadout", str(missing_loadout.data))

    def test_accepting_valid_challenge_creates_match(self):
        self.sync_loadout(self.alice, berserks=["elemental", "freeze"])
        self.sync_loadout(self.bob, berserks=["striker"])

        create_response = self.create_challenge(self.alice)
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        challenge_id = create_response.data["challenge"]["id"]

        accept_response = self.auth_request(
            "patch",
            f"/api/friends/challenges/{challenge_id}",
            self.bob,
            {"status": "accepted"},
            FriendChallengeDetailView.as_view(),
            challenge_id=challenge_id,
        )
        self.assertEqual(accept_response.status_code, status.HTTP_200_OK)
        self.assertEqual(accept_response.data["challenge"]["status"], "accepted")
        self.assertIn("match", accept_response.data)
        self.assertEqual(len(self.matches._docs), 1)
        stored_match = next(iter(self.matches._docs.values()))
        self.assertEqual(stored_match["status"], "active")
        self.assertEqual(set(stored_match["snapshot"]["players"].keys()), {"alice", "bob"})

    def test_only_recipient_can_respond_to_challenge(self):
        self.sync_loadout(self.alice)
        self.sync_loadout(self.bob)
        challenge_id = self.create_challenge(self.alice).data["challenge"]["id"]

        response = self.auth_request(
            "patch",
            f"/api/friends/challenges/{challenge_id}",
            self.alice,
            {"status": "accepted"},
            FriendChallengeDetailView.as_view(),
            challenge_id=challenge_id,
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_completed_match_rejects_new_actions(self):
        self.sync_loadout(self.alice)
        self.sync_loadout(self.bob)
        challenge_id = self.create_challenge(self.alice).data["challenge"]["id"]
        match_response = self.auth_request(
            "patch",
            f"/api/friends/challenges/{challenge_id}",
            self.bob,
            {"status": "accepted"},
            FriendChallengeDetailView.as_view(),
            challenge_id=challenge_id,
        )
        match_id = match_response.data["match"]["id"]
        match_doc = next(iter(self.matches._docs.values()))
        match_doc["status"] = "completed"
        match_doc["snapshot"]["status"] = "completed"
        match_doc["winnerUid"] = "alice"
        match_doc["terminationReason"] = "elimination"

        action_response = self.auth_request(
            "post",
            f"/api/matches/{match_id}/actions",
            self.alice,
            {"fireNonce": 1},
            FriendMatchActionView.as_view(),
            match_id=match_id,
        )
        self.assertEqual(action_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("no longer accepting actions", str(action_response.data))

    def test_disconnect_timeout_forfeits_missing_player(self):
        self.sync_loadout(self.alice)
        self.sync_loadout(self.bob)
        challenge_id = self.create_challenge(self.alice).data["challenge"]["id"]
        match_response = self.auth_request(
            "patch",
            f"/api/friends/challenges/{challenge_id}",
            self.bob,
            {"status": "accepted"},
            FriendChallengeDetailView.as_view(),
            challenge_id=challenge_id,
        )
        match_id = match_response.data["match"]["id"]
        stored_id, stored_match = next(iter(self.matches._docs.items()))
        self.assertEqual(stored_id, match_id)

        stored_match["presenceByUid"]["bob"] = self.fake_now - 30_000
        self.fake_now += 31_000

        detail_response = self.auth_request(
            "get",
            f"/api/matches/{match_id}",
            self.alice,
            view=FriendMatchDetailView.as_view(),
            match_id=match_id,
        )
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data["match"]["status"], "forfeited")
        self.assertEqual(detail_response.data["match"]["winnerUid"], "alice")
