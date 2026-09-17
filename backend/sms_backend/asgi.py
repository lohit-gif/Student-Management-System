"""
ASGI config for sms_backend project.

It exposes the ASGI callable as a module-level variable named ``application``.
Used for async-capable servers (e.g., Daphne, Uvicorn).
"""

import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sms_backend.settings')

application = get_asgi_application()
