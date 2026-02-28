import json

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication, get_authorization_header

try:
    import firebase_admin
    from firebase_admin import auth as firebase_auth
    from firebase_admin import credentials
except ImportError:  # pragma: no cover - handled at runtime in environments without dependency
    firebase_admin = None
    firebase_auth = None
    credentials = None


def initialize_firebase():
    if firebase_admin is None:
        raise exceptions.AuthenticationFailed(
            "firebase-admin is not installed. Install it with: pip install firebase-admin"
        )

    if getattr(firebase_admin, "_apps", None):
        return

    cred = None
    if settings.FIREBASE_CREDENTIALS_JSON:
        try:
            cred = credentials.Certificate(json.loads(settings.FIREBASE_CREDENTIALS_JSON))
        except json.JSONDecodeError as exc:
            raise exceptions.AuthenticationFailed("FIREBASE_CREDENTIALS_JSON is not valid JSON") from exc
        except Exception as exc:
            raise exceptions.AuthenticationFailed("Failed to load Firebase credentials JSON") from exc
    elif settings.FIREBASE_CREDENTIALS_FILE:
        try:
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_FILE)
        except Exception as exc:
            raise exceptions.AuthenticationFailed("Failed to load FIREBASE_CREDENTIALS_FILE") from exc

    options = {}
    if settings.FIREBASE_PROJECT_ID:
        options["projectId"] = settings.FIREBASE_PROJECT_ID

    try:
        firebase_admin.initialize_app(cred, options or None)
    except Exception as exc:
        raise exceptions.AuthenticationFailed("Failed to initialize Firebase Admin SDK") from exc


class FirebaseAuthentication(BaseAuthentication):
    def authenticate(self, request):
        header = get_authorization_header(request).split()
        if not header:
            return None

        if len(header) != 2 or header[0].lower() != b"bearer":
            raise exceptions.AuthenticationFailed("Authorization header must be in the format: Bearer <token>")

        try:
            token = header[1].decode("utf-8")
        except UnicodeDecodeError as exc:
            raise exceptions.AuthenticationFailed("Token is not valid UTF-8") from exc

        initialize_firebase()

        try:
            decoded_token = firebase_auth.verify_id_token(token)
        except Exception as exc:
            detail = f"Invalid Firebase token: {exc}" if settings.DEBUG else "Invalid Firebase token"
            raise exceptions.AuthenticationFailed(detail) from exc

        uid = decoded_token.get("uid")
        if not uid:
            raise exceptions.AuthenticationFailed("Firebase token missing uid")

        email = decoded_token.get("email", "")

        user_model = get_user_model()
        user, _ = user_model.objects.get_or_create(
            username=uid,
            defaults={"email": email},
        )

        if email and user.email != email:
            user.email = email
            user.save(update_fields=["email"])

        return (user, decoded_token)
