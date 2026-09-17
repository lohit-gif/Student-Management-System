"""
URL configuration for the Students app.

Full URL map:
    GET    /api/students/          → StudentListCreateView.get()   (list + search/filter/sort)
    POST   /api/students/          → StudentListCreateView.post()  (create)
    GET    /api/students/stats/    → StudentStatsView.get()        (dashboard statistics)
    GET    /api/students/<id>/     → StudentRetrieveUpdateDestroyView.get()
    PUT    /api/students/<id>/     → StudentRetrieveUpdateDestroyView.put()
    PATCH  /api/students/<id>/     → StudentRetrieveUpdateDestroyView.patch()
    DELETE /api/students/<id>/     → StudentRetrieveUpdateDestroyView.delete()

IMPORTANT: 'students/stats/' must be registered BEFORE 'students/<int:pk>/'
so that Django does not interpret "stats" as a numeric PK.
"""

from django.urls import path
from .views import (
    StudentListCreateView,
    StudentStatsView,
    StudentRetrieveUpdateDestroyView,
    RegisterView,
    LoginView,
    LogoutView,
    UserProfileView,
)

app_name = 'students'

urlpatterns = [
    # Authentication endpoints
    path('auth/register/', RegisterView.as_view(), name='auth-register'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/me/', UserProfileView.as_view(), name='auth-me'),
    path('auth/profile/', UserProfileView.as_view(), name='auth-profile'),

    # Collection endpoint — list all / create new
    path(
        'students/',
        StudentListCreateView.as_view(),
        name='student-list-create',
    ),

    # Statistics endpoint — dashboard summary (MUST be before <int:pk>)
    path(
        'students/stats/',
        StudentStatsView.as_view(),
        name='student-stats',
    ),

    # Single-resource endpoint — retrieve / update / delete by PK
    path(
        'students/<int:pk>/',
        StudentRetrieveUpdateDestroyView.as_view(),
        name='student-detail',
    ),
]
