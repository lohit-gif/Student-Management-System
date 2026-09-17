"""
App configuration for the Students app.
Auto-discovered by Django when listed in INSTALLED_APPS.
"""

from django.apps import AppConfig


class StudentsConfig(AppConfig):
    """Configuration class for the Students Django application."""

    # Default auto field type for model PKs
    default_auto_field = 'django.db.models.BigAutoField'

    # Must match the app directory name
    name = 'students'

    # Human-readable name shown in Django admin
    verbose_name = 'Student Management'
