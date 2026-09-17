"""
Automated Test Suite for the Students REST API and Authentication.

Tests cover:
  1. Authentication & Permissions (Login, Token generation, 401 Unauthorized checks)
  2. Student CRUD Operations (Create, Read All, Read Detail, PUT, PATCH, DELETE)
  3. Validation Rules (Duplicate IDs, Invalid Email, Missing Mandatory Fields, Invalid Phone/Year)
  4. Search, Filter & Sort Query Parameters
"""

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token

from .models import Student


class AuthenticationAPITests(APITestCase):
    """Test suite for Admin Login, Token authentication, and Unauthenticated access control."""

    def setUp(self):
        self.username = 'admin'
        self.password = 'admin123'
        self.user = User.objects.create_superuser(
            username=self.username,
            email='admin@example.com',
            password=self.password,
        )
        self.login_url = reverse('students:auth-login')
        self.students_url = reverse('students:student-list-create')

    def test_login_success(self):
        """Valid admin credentials return 200 OK and auth token."""
        response = self.client.post(self.login_url, {
            'username': self.username,
            'password': self.password,
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertIn('token', response.data['data'])

    def test_login_invalid_password(self):
        """Invalid password returns 401 Unauthorized."""
        response = self.client.post(self.login_url, {
            'username': self.username,
            'password': 'wrongpassword',
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data['success'])

    def test_unauthorized_api_access(self):
        """Accessing student endpoints without Token returns 401 Unauthorized."""
        response = self.client.get(self.students_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authorized_api_access(self):
        """Accessing student endpoints with Token header returns 200 OK."""
        token, _ = Token.objects.get_or_create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        response = self.client.get(self.students_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_registration_success(self):
        """POST /api/auth/register/ creates user with valid inputs."""
        reg_url = reverse('students:auth-register')
        payload = {
            'full_name': 'Rohan Patel',
            'username': 'rohanp',
            'email': 'rohan@example.com',
            'phone_number': '9876543210',
            'password': 'Password@123',
            'confirm_password': 'Password@123',
        }
        response = self.client.post(reg_url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        self.assertTrue(User.objects.filter(username='rohanp').exists())

    def test_registration_weak_password(self):
        """Registration rejects passwords missing uppercase/number/special char."""
        reg_url = reverse('students:auth-register')
        payload = {
            'full_name': 'Rohan Patel',
            'username': 'rohanp2',
            'email': 'rohan2@example.com',
            'phone_number': '9876543210',
            'password': 'simplepassword',
            'confirm_password': 'simplepassword',
        }
        response = self.client.post(reg_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registration_invalid_phone_length(self):
        """Registration rejects phone numbers not exactly 10 digits."""
        reg_url = reverse('students:auth-register')
        payload = {
            'full_name': 'Rohan Patel',
            'username': 'rohanp3',
            'email': 'rohan3@example.com',
            'phone_number': '12345',
            'password': 'Password@123',
            'confirm_password': 'Password@123',
        }
        response = self.client.post(reg_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_by_email(self):
        """Login using Email address instead of Username returns 200 OK."""
        response = self.client.post(self.login_url, {
            'username': 'admin@example.com',
            'password': self.password,
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])


class StudentCRUDAPITests(APITestCase):
    """Test suite for Student CRUD operations and Server-side Validation."""

    def setUp(self):
        self.user = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='admin123',
        )
        self.token, _ = Token.objects.get_or_create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

        self.list_url = reverse('students:student-list-create')
        self.stats_url = reverse('students:student-stats')

        self.valid_student_payload = {
            'student_id': 'STU-101',
            'full_name': 'Aarav Kumar',
            'department': 'Computer Science',
            'year': 1,
            'email': 'aarav@example.com',
            'phone_number': '+919876543210',
            'address': '123 Tech Park, Bangalore',
        }

        self.sample_student = Student.objects.create(
            student_id='STU-100',
            full_name='Priya Sharma',
            department='Electronics',
            year=2,
            email='priya@example.com',
            phone_number='+911234567890',
            address='456 Cyber City, Hyderabad',
        )
        self.detail_url = reverse('students:student-detail', kwargs={'pk': self.sample_student.pk})

    def test_create_student_success(self):
        """POST /api/students/ creates student record successfully."""
        response = self.client.post(self.list_url, self.valid_student_payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['student_id'], 'STU-101')

    def test_create_student_duplicate_id(self):
        """Duplicate Student ID returns 400 Bad Request with error message."""
        payload = self.valid_student_payload.copy()
        payload['student_id'] = 'STU-100'  # Same as sample_student
        response = self.client.post(self.list_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertIn('student_id', response.data['data']['errors'])

    def test_create_student_invalid_email(self):
        """Invalid email format returns 400 Bad Request."""
        payload = self.valid_student_payload.copy()
        payload['email'] = 'not-an-email'
        response = self.client.post(self.list_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_create_student_empty_mandatory_fields(self):
        """Empty required fields return 400 Bad Request."""
        payload = {
            'student_id': '',
            'full_name': '',
            'department': '',
            'year': 1,
            'email': '',
            'phone_number': '',
            'address': '',
        }
        response = self.client.post(self.list_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_read_students_list(self):
        """GET /api/students/ returns list of student records."""
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data['data']), 1)

    def test_read_single_student(self):
        """GET /api/students/<pk>/ returns correct record."""
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['student_id'], 'STU-100')

    def test_update_student_full(self):
        """PUT /api/students/<pk>/ updates student record."""
        updated_payload = self.valid_student_payload.copy()
        updated_payload['student_id'] = 'STU-100'
        updated_payload['full_name'] = 'Priya Sharma Updated'
        response = self.client.put(self.detail_url, updated_payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['full_name'], 'Priya Sharma Updated')

    def test_update_student_partial(self):
        """PATCH /api/students/<pk>/ partially updates student fields."""
        response = self.client.patch(self.detail_url, {'department': 'Information Technology'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['department'], 'Information Technology')

    def test_delete_student(self):
        """DELETE /api/students/<pk>/ removes student record."""
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Student.objects.filter(pk=self.sample_student.pk).exists())

    def test_search_and_filter_api(self):
        """GET /api/students/?search=Priya returns matching student."""
        response = self.client.get(f'{self.list_url}?search=Priya')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 1)

    def test_stats_api(self):
        """GET /api/students/stats/ returns valid statistics dict."""
        response = self.client.get(self.stats_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('total_students', response.data['data'])
        self.assertIn('by_year', response.data['data'])
