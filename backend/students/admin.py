"""
Django Admin registration for the Students app.

Registers the Student model with a customized admin interface
that makes managing records easy in the Django admin panel.
"""

from django.contrib import admin
from .models import Student


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the Student model.
    """

    # Columns shown in the list view
    list_display = [
        'student_id',
        'full_name',
        'department',
        'year',
        'email',
        'phone_number',
        'created_at',
    ]

    # Columns that link to the detail page
    list_display_links = ['student_id', 'full_name']

    # Sidebar filters
    list_filter = ['department', 'year']

    # Searchable fields
    search_fields = ['student_id', 'full_name', 'email', 'department']

    # Default sort order in admin list view
    ordering = ['student_id']

    # Read-only timestamps shown in detail view
    readonly_fields = ['created_at', 'updated_at']

    # Field layout in the detail / edit form
    fieldsets = [
        ('Identification', {
            'fields': ['student_id', 'full_name'],
        }),
        ('Academic Info', {
            'fields': ['department', 'year'],
        }),
        ('Contact Details', {
            'fields': ['email', 'phone_number', 'address'],
        }),
        ('Timestamps', {
            'fields': ['created_at', 'updated_at'],
            'classes': ['collapse'],  # Collapsible section
        }),
    ]
