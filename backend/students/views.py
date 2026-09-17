"""
API Views for the Students app — Full CRUD + Search, Filter, Sort & Stats.

Endpoints
---------
GET    /api/students/         → List all students (search, filter, sort)
POST   /api/students/         → Create a new student (validation)
GET    /api/students/stats/   → Summary statistics for the dashboard
GET    /api/students/<pk>/    → Retrieve a single student
PUT    /api/students/<pk>/    → Full update
PATCH  /api/students/<pk>/    → Partial update
DELETE /api/students/<pk>/    → Delete a student

Query Parameters for GET /api/students/
----------------------------------------
?search=<str>       Case-insensitive match on student_id, full_name, email, department
?year=<1|2|3|4>     Filter by academic year
?department=<str>   Filter by department (exact, case-insensitive)
?sort=<field>       Sort field: student_id | full_name | department | year | created_at
?order=asc|desc     Sort direction (default: asc)
"""

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import Q, Count
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Student
from .serializers import StudentSerializer, UserRegistrationSerializer


# ---------------------------------------------------------------------------
# Authentication Views
# ---------------------------------------------------------------------------
class RegisterView(APIView):
    """
    POST /api/auth/register/
    Registers a new user account with full name, username, email, phone number, and password.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, _ = Token.objects.get_or_create(user=user)
            full_name = f"{user.first_name} {user.last_name}".strip() or user.username
            return api_response(
                data={
                    'token': token.key,
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'email': user.email,
                        'full_name': full_name,
                        'first_name': user.first_name,
                        'last_name': user.last_name,
                    },
                },
                message='Account created successfully! Please log in to continue.',
                status_code=status.HTTP_201_CREATED,
            )

        return api_error(
            message='Registration failed. Please fix the errors in the form.',
            errors=serializer.errors,
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class LoginView(APIView):
    """
    POST /api/auth/login/
    Authenticates user credentials using Username OR Email address.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = str(
            request.data.get('username', '') or
            request.data.get('username_or_email', '') or
            request.data.get('email', '')
        ).strip()
        password = str(request.data.get('password', '')).strip()

        if not identifier or not password:
            return api_error(
                message='Both Username/Email and Password are required.',
                errors={
                    'username': ['Username or Email is required.'] if not identifier else [],
                    'password': ['Password is required.'] if not password else [],
                },
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Resolve email to username if an email address was supplied
        resolved_username = identifier
        if '@' in identifier:
            matched_user = User.objects.filter(email__iexact=identifier).first()
            if matched_user:
                resolved_username = matched_user.username

        user = authenticate(username=resolved_username, password=password)

        # Fallback check if user entered username as identifier but authenticate failed on case-sensitivity
        if not user and '@' not in identifier:
            matched_user = User.objects.filter(username__iexact=identifier).first()
            if matched_user:
                user = authenticate(username=matched_user.username, password=password)

        if not user:
            return api_error(
                message='Invalid Username/Email or password.',
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        token, _ = Token.objects.get_or_create(user=user)
        full_name = f"{user.first_name} {user.last_name}".strip() or user.username
        return api_response(
            data={
                'token': token.key,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'full_name': full_name,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                },
            },
            message='Login successful.',
        )


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Invalidates the active user's DRF Token.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if hasattr(request.user, 'auth_token'):
            request.user.auth_token.delete()
        return api_response(message='Logged out successfully.')


class UserProfileView(APIView):
    """
    GET /api/auth/me/ or /api/auth/profile/
    Returns current authenticated user profile details.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        full_name = f"{user.first_name} {user.last_name}".strip() or user.username
        return api_response(
            data={
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'full_name': full_name,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'date_joined': user.date_joined,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
            },
            message='User profile retrieved successfully.',
        )



# ---------------------------------------------------------------------------
# Allowed sort fields — whitelist to prevent injection attacks
# ---------------------------------------------------------------------------
ALLOWED_SORT_FIELDS = {
    'student_id', 'full_name', 'department', 'year', 'created_at', 'updated_at'
}


# ---------------------------------------------------------------------------
# Helper: consistent JSON response envelope
# ---------------------------------------------------------------------------
def api_response(data=None, message='', success=True, status_code=status.HTTP_200_OK):
    """
    Returns a consistently shaped JSON response for every endpoint.

    Shape:
        {
            "success": true | false,
            "message": "...",
            "data": { } | [ ] | null
        }
    """
    return Response(
        {'success': success, 'message': message, 'data': data},
        status=status_code,
    )


def api_error(message, status_code=status.HTTP_400_BAD_REQUEST, errors=None):
    """
    Convenience shortcut for error responses.

    Args:
        message    : Human-readable error summary.
        status_code: HTTP status code.
        errors     : Optional dict of field-level validation errors.
    """
    data = {'errors': errors} if errors else None
    return api_response(data=data, message=message, success=False, status_code=status_code)


# ---------------------------------------------------------------------------
# View 1: Student List & Create
# Route: GET /api/students/   |   POST /api/students/
# ---------------------------------------------------------------------------
class StudentListCreateView(APIView):
    """
    GET  → Returns all student records with optional search, filter, and sort.
           Query params:
             ?search=<str>      — search student_id, full_name, email, department
             ?year=<int>        — filter by year (1–4)
             ?department=<str>  — filter by exact department name (case-insensitive)
             ?sort=<field>      — field to sort by (default: student_id)
             ?order=asc|desc    — sort direction (default: asc)

    POST → Validates and creates a new student record.
           Returns 201 Created with the new student on success.
           Returns 400 Bad Request with field-level errors on failure.
    """

    def get(self, request):
        """List all students with search, filter, and sort support."""
        queryset = Student.objects.all()

        # ----------------------------------------------------------------
        # 1. Full-text search across key fields
        # ----------------------------------------------------------------
        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(student_id__icontains=search) |
                Q(full_name__icontains=search)  |
                Q(email__icontains=search)       |
                Q(department__icontains=search)
            )

        # ----------------------------------------------------------------
        # 2. Year filter (exact integer match)
        # ----------------------------------------------------------------
        year = request.query_params.get('year', '').strip()
        if year.isdigit() and int(year) in (1, 2, 3, 4):
            queryset = queryset.filter(year=int(year))

        # ----------------------------------------------------------------
        # 3. Department filter (case-insensitive exact match)
        # ----------------------------------------------------------------
        department = request.query_params.get('department', '').strip()
        if department:
            queryset = queryset.filter(department__iexact=department)

        # ----------------------------------------------------------------
        # 4. Sorting — field + direction
        # ----------------------------------------------------------------
        sort_field = request.query_params.get('sort', 'student_id').strip()
        sort_order = request.query_params.get('order', 'asc').strip().lower()

        # Validate sort field against whitelist (prevent arbitrary field access)
        if sort_field not in ALLOWED_SORT_FIELDS:
            sort_field = 'student_id'

        # Prefix '-' for descending order
        order_prefix = '-' if sort_order == 'desc' else ''
        if sort_field == 'student_id':
            queryset = queryset.order_by(f'{order_prefix}student_id')
        else:
            queryset = queryset.order_by(f'{order_prefix}{sort_field}', 'student_id')

        # ----------------------------------------------------------------
        # 5. Serialize and return
        # ----------------------------------------------------------------
        serializer = StudentSerializer(queryset, many=True)
        total = queryset.count()
        return api_response(
            data=serializer.data,
            message=f'{total} student(s) found.',
        )

    def post(self, request):
        """Create a new student record after validation."""
        serializer = StudentSerializer(data=request.data)

        if serializer.is_valid():
            # Explicit uniqueness check for student_id (gives a clearer error)
            student_id = serializer.validated_data.get('student_id', '')
            if Student.objects.filter(student_id__iexact=student_id).exists():
                return api_error(
                    message='A student with this Student ID already exists.',
                    errors={'student_id': ['This Student ID is already in use.']},
                )

            student = serializer.save()
            return api_response(
                data=StudentSerializer(student).data,
                message=f'Student "{student.full_name}" created successfully.',
                status_code=status.HTTP_201_CREATED,
            )

        return api_error(
            message='Validation failed. Please check the form fields.',
            errors=serializer.errors,
        )


# ---------------------------------------------------------------------------
# View 2: Dashboard Statistics
# Route: GET /api/students/stats/
# ---------------------------------------------------------------------------
class StudentStatsView(APIView):
    """
    GET → Returns aggregate statistics about all students.

    Response data shape:
    {
        "total_students": 25,
        "total_departments": 5,
        "departments": ["Computer Science", "Mechanical", ...],
        "by_year": {
            "1": 8,
            "2": 7,
            "3": 6,
            "4": 4
        }
    }
    """

    def get(self, request):
        """Return summary statistics for the dashboard."""
        total = Student.objects.count()

        # Count students per year using a single aggregation query
        year_counts = (
            Student.objects
            .values('year')
            .annotate(count=Count('id'))
            .order_by('year')
        )
        by_year = {str(row['year']): row['count'] for row in year_counts}
        # Ensure all four years are always present (even if zero)
        for y in ('1', '2', '3', '4'):
            by_year.setdefault(y, 0)

        # Unique department list (sorted alphabetically, filtering out empty/None values)
        departments = sorted([
            d for d in Student.objects
            .values_list('department', flat=True)
            .distinct()
            if d and isinstance(d, str) and d.strip()
        ])

        return api_response(
            data={
                'total_students':    total,
                'total_departments': len(departments),
                'departments':       departments,
                'by_year':           by_year,
            },
            message='Statistics retrieved successfully.',
        )


# ---------------------------------------------------------------------------
# View 3: Student Retrieve, Update & Destroy
# Route: GET/PUT/PATCH/DELETE /api/students/<pk>/
# ---------------------------------------------------------------------------
class StudentRetrieveUpdateDestroyView(APIView):
    """
    GET    → Returns the student matching <pk>.
    PUT    → Fully replaces the student's data.
    PATCH  → Partially updates the student's data.
    DELETE → Permanently removes the student record.
    """

    def _get_student(self, pk):
        """
        Fetch a student by primary key.
        Returns (student, None) on success or (None, error_response) on failure.
        """
        try:
            return Student.objects.get(pk=pk), None
        except Student.DoesNotExist:
            return None, api_error(
                message=f'Student with id={pk} was not found.',
                status_code=status.HTTP_404_NOT_FOUND,
            )

    def get(self, request, pk):
        """Retrieve a single student by primary key."""
        student, err = self._get_student(pk)
        if err:
            return err

        serializer = StudentSerializer(student)
        return api_response(
            data=serializer.data,
            message='Student retrieved successfully.',
        )

    def put(self, request, pk):
        """Fully update a student record (all fields required)."""
        student, err = self._get_student(pk)
        if err:
            return err

        serializer = StudentSerializer(student, data=request.data, partial=False)

        if serializer.is_valid():
            new_id = serializer.validated_data.get('student_id', '')
            if (Student.objects
                    .filter(student_id__iexact=new_id)
                    .exclude(pk=pk)
                    .exists()):
                return api_error(
                    message='Another student already has this Student ID.',
                    errors={'student_id': ['This Student ID is already in use by another student.']},
                )

            updated = serializer.save()
            return api_response(
                data=StudentSerializer(updated).data,
                message=f'Student "{updated.full_name}" updated successfully.',
            )

        return api_error(
            message='Validation failed. Please check the form fields.',
            errors=serializer.errors,
        )

    def patch(self, request, pk):
        """Partially update a student record (only supplied fields are changed)."""
        student, err = self._get_student(pk)
        if err:
            return err

        serializer = StudentSerializer(student, data=request.data, partial=True)

        if serializer.is_valid():
            new_id = serializer.validated_data.get('student_id')
            if new_id and (Student.objects
                           .filter(student_id__iexact=new_id)
                           .exclude(pk=pk)
                           .exists()):
                return api_error(
                    message='Another student already has this Student ID.',
                    errors={'student_id': ['This Student ID is already in use by another student.']},
                )

            updated = serializer.save()
            return api_response(
                data=StudentSerializer(updated).data,
                message=f'Student "{updated.full_name}" updated successfully.',
            )

        return api_error(
            message='Validation failed. Please check the form fields.',
            errors=serializer.errors,
        )

    def delete(self, request, pk):
        """Permanently delete a student record."""
        student, err = self._get_student(pk)
        if err:
            return err

        name = student.full_name
        student.delete()
        return api_response(
            data=None,
            message=f'Student "{name}" has been deleted.',
        )
