"""
Student model definition.

Represents a single student record in the SMS database.
All seven required fields are included along with auto-managed timestamps.
"""

from django.db import models


class Student(models.Model):
    """
    Stores a single student's profile information.

    Fields
    ------
    student_id   : Unique identifier assigned by the institution (e.g. "STU-001").
                   Acts as the primary lookup key in the REST API.
    full_name    : Student's complete name.
    department   : Academic department (e.g. "Computer Science").
    year         : Current academic year (1 = First Year … 4 = Fourth Year).
    email        : Unique email address — used for communications.
    phone_number : Contact phone number (stored as a string to preserve formatting).
    address      : Full mailing / residential address.
    created_at   : Timestamp automatically set when the record is first created.
    updated_at   : Timestamp automatically updated on every save.
    """

    # -----------------------------------------------------------------------
    # Academic year choices
    # -----------------------------------------------------------------------
    YEAR_CHOICES = [
        (1, 'First Year'),
        (2, 'Second Year'),
        (3, 'Third Year'),
        (4, 'Fourth Year'),
    ]

    # -----------------------------------------------------------------------
    # Fields
    # -----------------------------------------------------------------------
    student_id = models.CharField(
        max_length=20,
        unique=True,
        primary_key=False,          # DB auto-id is still the PK; this is a business key
        verbose_name='Student ID',
        help_text='Unique institutional ID (e.g. STU-001)',
    )

    full_name = models.CharField(
        max_length=150,
        verbose_name='Full Name',
    )

    department = models.CharField(
        max_length=100,
        verbose_name='Department',
        help_text='Academic department name',
    )

    year = models.IntegerField(
        choices=YEAR_CHOICES,
        verbose_name='Academic Year',
    )

    email = models.EmailField(
        unique=True,
        verbose_name='Email Address',
    )

    phone_number = models.CharField(
        max_length=20,
        verbose_name='Phone Number',
        help_text='Include country code if applicable',
    )

    address = models.TextField(
        verbose_name='Address',
        help_text='Full residential or mailing address',
    )

    # -----------------------------------------------------------------------
    # Auto-managed timestamps
    # -----------------------------------------------------------------------
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Created At',
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Last Updated',
    )

    # -----------------------------------------------------------------------
    # Meta options
    # -----------------------------------------------------------------------
    class Meta:
        db_table = 'students'               # Explicit table name
        ordering = ['student_id']           # Default sort: by student ID
        verbose_name = 'Student'
        verbose_name_plural = 'Students'

    def __str__(self):
        """Human-readable string representation used in admin and debugging."""
        return f"{self.student_id} — {self.full_name}"
