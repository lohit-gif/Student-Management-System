# 🎓 Student Management System (SMS)

A full-stack, enterprise-grade **Student Management System** web application built with **Django REST Framework** backend, SQLite database, and a modern, responsive HTML/CSS/JavaScript frontend with Token-Based Authentication.

---

## 🌟 Key Features

### 1. 🔐 Security & Authentication
* **Admin Login Portal**: Dedicated login screen for administrators (`login.html`).
* **Token Authentication**: All student CRUD API operations are secured with DRF Token Authentication (`Authorization: Token <token>`).
* **Session Guards**: Client-side route protection automatically redirects unauthenticated users to the login screen.
* **Input Sanitization**: Server-side XSS protection and string sanitization on text fields.
* **Environment Configuration**: Key configuration parameters (`SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`) separated into `.env` file.

### 2. ⚡ Complete CRUD Operations
* **Create**: Add new students with field validation (unique Student ID, email format, phone digits check, year range 1–4).
* **Read**: Paginated/filtered data table displaying student records with badge highlights.
* **Update**: Modal form pre-populated for full (`PUT`) or partial (`PATCH`) updates.
* **Delete**: Interactive modal confirmation dialog before permanent deletion.

### 3. 🔍 Instant Search, Filtering & Dynamic Sorting
* **Multi-Field Search**: Real-time matching across `student_id`, `full_name`, `email`, and `department`.
* **Category Filters**: Filter students by Department or Academic Year (Year 1–4) with a "Clear Filters" action.
* **Multi-Column Sorting**: Sort by Student ID, Name, Department, Year, or Creation Date in ascending/descending order.

### 4. 📊 Live Statistics Dashboard
* 6 dynamic KPI cards displaying live total student counts, unique department counts, and academic year breakdowns.
* Recent activity log tracking the 5 latest enrolled students.

### 5. 📱 Premium Responsive Design
* Hand-crafted CSS using custom design tokens, sleek dark mode palettes, subtle animations, and glassmorphism.
* Fully responsive across Mobile, Tablet, and Desktop viewports.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | HTML5, Modern Vanilla CSS (Variables, Flexbox, Grid), JavaScript (ES6+ Fetch API) |
| **Backend** | Python 3.10+, Django 5.x, Django REST Framework (DRF) |
| **Authentication** | DRF Token Authentication (`rest_framework.authtoken`) |
| **Database** | SQLite 3 |
| **Testing** | Django Automated Test Framework (`APITestCase`) |

---

## 📂 Project Structure

```
student management system/
├── .gitignore               # Git exclusion rules
├── README.md                # Project documentation
├── backend/
│   ├── .env                 # Environment secrets
│   ├── .env.example         # Template for environment configuration
│   ├── db.sqlite3           # SQLite database
│   ├── manage.py            # Django management CLI
│   ├── requirements.txt     # Python dependencies
│   ├── sms_backend/         # Core Django settings & URLs
│   │   ├── settings.py
│   │   └── urls.py
│   └── students/            # Student Management App
│       ├── admin.py
│       ├── models.py
│       ├── serializers.py
│       ├── tests.py         # Automated unit test suite (15 tests)
│       ├── urls.py
│       └── views.py
└── frontend/
    ├── about.html           # System overview & API status page
    ├── index.html           # Live statistics dashboard
    ├── login.html           # Secure administrator login page
    ├── students.html        # Main student management table & CRUD modal
    ├── css/
    │   └── style.css        # Core design system & theme tokens
    └── js/
        ├── api.js           # API fetch wrapper, token handling & helpers
        ├── about.js         # About page logic
        ├── dashboard.js     # Live statistics dashboard logic
        └── students.js      # CRUD state machine & table renderer
```

---

## 🚀 Quick Start & Installation

### Prerequisites
* **Python 3.10+** installed on your system.

### Step 1: Clone & Setup Backend

```powershell
# Navigate to backend directory
cd "student management system/backend"

# Create a virtual environment
python -m venv venv

# Activate virtual environment (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Apply database migrations
python manage.py migrate

# Create default admin user (admin / admin123)
python manage.py shell -c "from django.contrib.auth.models import User; User.objects.filter(username='admin').exists() or User.objects.create_superuser('admin', 'admin@example.com', 'admin123')"

# Start the Django backend server (Port 8000)
python manage.py runserver 8000
```

### Step 2: Launch Frontend Server

Open a second terminal window:

```powershell
# Navigate to frontend directory
cd "student management system/frontend"

# Serve using Python HTTP server (Port 5500)
python -m http.server 5500
```

### Step 3: Access Application

Open your browser and navigate to:
* **Login Screen**: [http://localhost:5500/login.html](http://localhost:5500/login.html)
* **Default Admin Credentials**:
  * Username: `admin`
  * Password: `admin123`

---

## 📚 REST API Documentation

### Authentication Headers
For all protected endpoints under `/api/students/`, include the DRF Token in the request headers:
```http
Authorization: Token <your_auth_token_here>
```

### Endpoints Overview

| Endpoint | Method | Permission | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/login/` | `POST` | AllowAny | Authenticates user & returns token |
| `/api/auth/logout/` | `POST` | Authenticated | Deletes active user token |
| `/api/auth/me/` | `GET` | Authenticated | Retrieves profile of logged-in user |
| `/api/students/` | `GET` | Authenticated | Lists all students with search, filter, and sort |
| `/api/students/` | `POST` | Authenticated | Creates a new student record |
| `/api/students/stats/` | `GET` | Authenticated | Retrieves aggregate statistics for dashboard |
| `/api/students/{id}/` | `GET` | Authenticated | Retrieves details for student `{id}` |
| `/api/students/{id}/` | `PUT` | Authenticated | Updates all fields of student `{id}` |
| `/api/students/{id}/` | `PATCH` | Authenticated | Partially updates fields of student `{id}` |
| `/api/students/{id}/` | `DELETE` | Authenticated | Deletes student record `{id}` |

---

### Example API Payloads & Responses

#### 1. Login (`POST /api/auth/login/`)

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "token": "e987c6543210123456789abcdef0123456789abc",
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "first_name": "",
      "last_name": ""
    }
  }
}
```

#### 2. Create Student (`POST /api/students/`)

**Request Body:**
```json
{
  "student_id": "STU-003",
  "full_name": "Ananya Roy",
  "department": "Computer Science",
  "year": 2,
  "email": "ananya@example.com",
  "phone_number": "+919876501234",
  "address": "789 Park Lane, Bangalore"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Student \"Ananya Roy\" created successfully.",
  "data": {
    "id": 3,
    "student_id": "STU-003",
    "full_name": "Ananya Roy",
    "department": "Computer Science",
    "year": 2,
    "year_display": "Second Year",
    "email": "ananya@example.com",
    "phone_number": "+919876501234",
    "address": "789 Park Lane, Bangalore",
    "created_at": "2026-09-13T12:00:00.000Z",
    "updated_at": "2026-09-13T12:00:00.000Z"
  }
}
```

#### 3. Error Response Example (Duplicate ID / Invalid Email)

**Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "Validation failed. Please check the form fields.",
  "data": {
    "errors": {
      "student_id": ["A student with this Student ID already exists."],
      "email": ["Enter a valid email address."]
    }
  }
}
```

---

## 🧪 Automated Testing

The backend includes a 100% automated test suite verifying all Auth, CRUD, Validation, and Query functionality:

```powershell
cd backend
.\venv\Scripts\python.exe manage.py test students
```

**Test Output:**
```
Found 15 test(s).
System check identified no issues (0 silenced).
...............
----------------------------------------------------------------------
Ran 15 tests in 7.597s

OK
```

---

## 🔒 Security Practices Implemented
1. **Token Authentication**: All endpoints verify user token identity before processing requests.
2. **Server-side Validation**: Strict serializer validation on student fields (email regex, phone number length/digit checks, year bounds).
3. **XSS Sanitization**: Stripping HTML tags from text inputs before database write.
4. **Environment Isolation**: `.env` file for managing sensitive settings (`SECRET_KEY`).
5. **CORS Configuration**: Restricting pre-flight headers and cross-origin requests.

---

## 🚀 Future Enhancements
- [ ] Export student table data to CSV/PDF reports.
- [ ] Profile photo upload support using Django File Storage.
- [ ] Role-Based Access Control (RBAC) for Teachers vs. Administrators.
- [ ] Bulk CSV import for onboarding large student cohorts.

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
