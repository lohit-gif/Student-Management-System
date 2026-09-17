"""
WSGI config for sms_backend project.

It exposes the WSGI callable as a module-level variable named ``application``.
Used by production WSGI servers (e.g., Gunicorn, uWSGI).
"""

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sms_backend.settings')

application = get_wsgi_application()
