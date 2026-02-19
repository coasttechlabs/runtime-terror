# settings.py
import firebase_admin
from firebase_admin import credentials

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware', # <--- Top
    'django.middleware.common.CommonMiddleware',
    ...
]

CORS_ALLOWED_ORIGINS = [
    "https://your-game-name.web.app",
    "https://your-game-name.firebaseapp.com",
    "http://localhost:5500", # For local testing
]


# Initialize Firebase Admin ONLY ONCE
if not firebase_admin._apps:
    cred = credentials.Certificate("path/to/your/serviceAccountKey.json")
    firebase_admin.initialize_app(cred)

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'my_game_app.authentication.FirebaseAuthentication', # Your custom class
        # 'rest_framework.authentication.SessionAuthentication', # Optional: keep if using admin panel
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated', # Lock everything by default
    ]
}

INSTALLED_APPS = [
    'corsheaders',
    'rest_framework',
]