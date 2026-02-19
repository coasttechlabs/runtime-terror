# my_game_app/authentication.py
from rest_framework import authentication
from rest_framework import exceptions
from firebase_admin import auth as firebase_auth
from django.contrib.auth.models import User

class FirebaseAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        # 1. Get the header
        auth_header = request.META.get('HTTP_AUTHORIZATION')
        if not auth_header:
            return None  # No auth header, let other methods try or fail

        # 2. Split "Bearer <token>"
        try:
            id_token = auth_header.split(' ')[1]
        except IndexError:
            raise exceptions.AuthenticationFailed('Token format invalid')

        # 3. Verify with Firebase
        try:
            decoded_token = firebase_auth.verify_id_token(id_token)
            uid = decoded_token['uid']
            email = decoded_token.get('email', '')
        except Exception:
            raise exceptions.AuthenticationFailed('Invalid Firebase token')

        # 4. Get or Create a Django User (to satisfy DRF)
        # We use the Firebase UID as the username so it's unique
        user, created = User.objects.get_or_create(username=uid)
        
        # Optional: Save their email if it's new
        if created and email:
            user.email = email
            user.save()

        return (user, None)
