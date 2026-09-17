"""
Django REST Framework Serializer for the Student model.

Handles serialisation (model → JSON) and deserialisation (JSON → model)
for all API endpoints, including field-level validation.
"""

import html
import re
from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Student


def sanitize_input(text):
    """Strip HTML tags and trim whitespace to prevent XSS attacks."""
    if not isinstance(text, str):
        return text
    # Remove HTML tags
    clean = re.sub(r'<[^>]*>', '', text)
    return clean.strip()


class StudentSerializer(serializers.ModelSerializer):
    """
    Full ModelSerializer for the Student model with input sanitization and validation.

    Validation rules enforced:
      - student_id  : Non-empty, uppercased, sanitized
      - full_name   : Non-empty, minimum 2 characters, sanitized
      - department  : Non-empty, sanitized
      - year        : Integer 1–4
      - email       : Valid email format, lowercased
      - phone_number: Digits only (with optional leading +), 7–15 chars
      - address     : Non-empty, sanitized
    """

    # Human-readable year label (e.g. "First Year") — exposed read-only
    year_display = serializers.CharField(
        source='get_year_display',
        read_only=True,
    )

    class Meta:
        model = Student
        fields = [
            'id',
            'student_id',
            'full_name',
            'department',
            'year',
            'year_display',
            'email',
            'phone_number',
            'address',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'year_display', 'created_at', 'updated_at']

    # ------------------------------------------------------------------
    # Field-level validators & sanitizers
    # ------------------------------------------------------------------

    def validate_student_id(self, value):
        """
        Sanitize, normalise to uppercase, and ensure it is not blank.
        """
        value = sanitize_input(value).upper()
        if not value:
            raise serializers.ValidationError('Student ID cannot be blank.')
        if len(value) > 20:
            raise serializers.ValidationError('Student ID must be 20 characters or fewer.')
        return value

    def validate_full_name(self, value):
        """Full name must be at least 2 non-whitespace characters."""
        value = sanitize_input(value)
        if len(value) < 2:
            raise serializers.ValidationError('Full name must be at least 2 characters long.')
        return value

    def validate_department(self, value):
        """Department must not be blank."""
        value = sanitize_input(value)
        if not value:
            raise serializers.ValidationError('Department cannot be blank.')
        return value

    def validate_year(self, value):
        """Year must be an integer between 1 and 4 inclusive."""
        if value not in (1, 2, 3, 4):
            raise serializers.ValidationError('Year must be 1, 2, 3, or 4.')
        return value

    def validate_email(self, value):
        """Normalise email to lowercase (format is already checked by EmailField)."""
        value = sanitize_input(value).lower()
        if not value:
            raise serializers.ValidationError('Email address cannot be blank.')
        return value

    def validate_phone_number(self, value):
        """
        Phone number rules:
          - May optionally start with '+'
          - Must contain only digits after the optional '+'
          - Length: 7–15 digits (ITU-T E.164 range)
        """
        value = sanitize_input(value)
        digits_only = value.lstrip('+')
        if not digits_only.isdigit():
            raise serializers.ValidationError(
                'Phone number must contain only digits (an optional leading + is allowed).'
            )
        if not (7 <= len(digits_only) <= 15):
            raise serializers.ValidationError(
                'Phone number must be between 7 and 15 digits.'
            )
        return value

    def validate_address(self, value):
        """Address must not be blank."""
        value = sanitize_input(value)
        if not value:
            raise serializers.ValidationError('Address cannot be blank.')
        return value


class UserRegistrationSerializer(serializers.Serializer):
    """
    Serializer for User Sign Up / Registration.
    Validation rules enforced:
      - full_name       : Mandatory, at least 2 characters
      - username        : Mandatory, unique across User model
      - email           : Mandatory, valid format, unique across User model
      - phone_number    : Mandatory, exactly 10 digits
      - password        : Mandatory, ≥ 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char
      - confirm_password: Must match password
    """
    full_name = serializers.CharField(required=True)
    username = serializers.CharField(required=True)
    email = serializers.EmailField(required=True)
    phone_number = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate_full_name(self, value):
        value = sanitize_input(value)
        if len(value) < 2:
            raise serializers.ValidationError('Full Name must be at least 2 characters long.')
        return value

    def validate_username(self, value):
        value = sanitize_input(value).lower()
        if not value:
            raise serializers.ValidationError('Username cannot be blank.')
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('This username is already taken. Please choose another.')
        return value

    def validate_email(self, value):
        value = sanitize_input(value).lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email address already exists.')
        return value

    def validate_phone_number(self, value):
        value = sanitize_input(value)
        digits = re.sub(r'\D', '', value)
        if len(digits) != 10:
            raise serializers.ValidationError('Phone number must contain exactly 10 digits.')
        return digits

    def validate_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError('Password must be at least 8 characters long.')
        if not re.search(r'[A-Z]', value):
            raise serializers.ValidationError('Password must contain at least one uppercase letter (A-Z).')
        if not re.search(r'[a-z]', value):
            raise serializers.ValidationError('Password must contain at least one lowercase letter (a-z).')
        if not re.search(r'[0-9]', value):
            raise serializers.ValidationError('Password must contain at least one number (0-9).')
        if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]', value):
            raise serializers.ValidationError('Password must contain at least one special character (e.g. @, #, $, !).')
        return value

    def validate(self, attrs):
        password = attrs.get('password')
        confirm_password = attrs.get('confirm_password')
        if password != confirm_password:
            raise serializers.ValidationError({'confirm_password': ['Passwords do not match.']})
        return attrs

    def create(self, validated_data):
        full_name = validated_data['full_name'].strip()
        parts = full_name.split(' ', 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ''

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=first_name,
            last_name=last_name,
        )
        return user


