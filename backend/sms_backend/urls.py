"""
Root URL configuration for the SMS backend.

URL patterns:
    /admin/          → Django admin panel
    /api/students/   → Student list & create (via students app)
    /api/students/<id>/ → Student retrieve, update, delete (via students app)
"""

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    # Django admin interface
    path('admin/', admin.site.urls),

    # Student Management API routes — delegated to students/urls.py
    path('api/', include('students.urls')),
]
