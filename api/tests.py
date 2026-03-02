from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIRequestFactory

from api.authentication import FirebaseAuthentication
from api.permissions import IsFirebaseAdmin


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
