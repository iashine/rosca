# ROSCA Spin Application - PRD

## Original Problem Statement
Build a ROSCA (Rotating Savings and Credit Association) Application with:
- User authentication (email/password JWT)
- Group management (CRUD operations)
- Member management within groups
- Spinning wheel for random winner selection with cryptographic randomness
- Session recording and history
- Theme customization (wheel colors)
- Audit logging
- Dashboard with statistics
- **Landing page and secure moderator sign-up flow**
- **RBAC for superadmin and moderators**
- **Password reset and forgot password features**
- **CMS section for content management**

## User Personas
1. **Superadmin** - Full system access, user management, CMS control, can promote moderators
2. **Moderator** - Creates and manages ROSCA groups, adds/removes members, conducts spin sessions
3. **Group Member** - Participates in savings circles (future: can view their status)

## Core Requirements
- JWT-based authentication (email/password)
- Three roles: Superadmin, Moderator, and Member
- Colorful spinning wheel with sound effects
- Dark/light mode toggle
- Professional blue color scheme
- Cryptographically secure random selection (Web Crypto API)
- Session recording with replay functionality
- Wheel theme customization
- Email verification for registration (AgentMail)
- Password reset via email

## Architecture
- **Backend**: FastAPI (Python) with MongoDB
- **Frontend**: React with Tailwind CSS, shadcn/ui components
- **Database**: MongoDB (collections: users, groups, members, sessions, spin_results, audit_logs, theme_preferences, pending_registrations, password_resets, math_challenges, cms_content)
- **Authentication**: JWT tokens with bcrypt password hashing
- **Email Service**: AgentMail API for transactional emails

## What's Been Implemented

### December 29, 2025 - MVP Release
- User registration & login with JWT
- Group CRUD operations
- Member management (add/remove)
- Session management (start/end)
- Spin result recording with Canvas API wheel
- Theme preferences storage
- Audit logging
- Statistics endpoint
- ROSCA Cycle logic (each member selected once per cycle)
- Auto-selection of last member
- Animated session replay
- Winner display delay (10 seconds)

### January 6, 2026 - Landing Page & Security Update
- **Landing Page** (`/landing`) - Public-facing page with:
  - Hero section with animated wheel preview
  - 6 feature cards
  - 4-step "How It Works" section
  - Benefits section
  - CTA and footer
- **Secure Registration Flow** - 3-step process:
  - Step 1: User details (name, email, password)
  - Step 2: Math captcha verification
  - Step 3: Email verification code (via AgentMail)
- **RBAC System**:
  - Superadmin role with full access
  - Moderator role for group management
  - Member role (future)
- **Password Reset Flow**:
  - Forgot password page
  - Email reset code
  - New password entry
- **Admin Dashboard** (`/admin`) - Superadmin only:
  - User management (list, update roles, delete)
  - CMS content management (CRUD)
- **Navigation Updates**: Admin link visible only for superadmin

## API Endpoints

### Authentication
- POST /api/auth/math-challenge - Get math captcha
- POST /api/auth/register/init - Start registration (sends verification email)
- POST /api/auth/register/verify - Complete registration with code
- POST /api/auth/register - Legacy direct registration
- POST /api/auth/login - User login
- GET /api/auth/me - Get current user
- POST /api/auth/forgot-password - Request password reset
- POST /api/auth/reset-password - Reset password with code
- POST /api/auth/change-password - Change password (authenticated)

### Admin (Superadmin only)
- GET /api/admin/users - List all users
- PUT /api/admin/users/{id}/role - Update user role
- DELETE /api/admin/users/{id} - Delete user

### CMS
- GET /api/cms/content - Get all content (public)
- GET /api/cms/content/{key} - Get content by key (public)
- POST /api/cms/content - Create content (superadmin)
- PUT /api/cms/content/{key} - Update content (superadmin)
- DELETE /api/cms/content/{key} - Delete content (superadmin)

### Groups & Sessions (unchanged)
- GET/POST /api/groups
- GET/PUT/DELETE /api/groups/{id}
- GET/POST/DELETE /api/groups/{id}/members
- GET/POST /api/sessions
- GET /api/sessions/{id}
- POST /api/spins
- GET /api/sessions/{id}/spins
- GET/PUT /api/theme
- GET /api/audit-logs
- GET /api/stats

## Test Accounts
- **Superadmin**: admin@rosca.com / admin123
- **Test User**: test@example.com / test123456

## Prioritized Backlog

### P0 (Critical) - DONE ✅
- [x] User authentication
- [x] Group management
- [x] Member management
- [x] Spinning wheel with random selection
- [x] Session recording
- [x] Landing page
- [x] Secure registration with email verification
- [x] RBAC (superadmin/moderator)
- [x] Password reset/forgot password
- [x] Admin dashboard with CMS

### P1 (Important) - In Progress
- [ ] Sound effects for spinning wheel
- [x] Theme customization
- [x] Audit logs
- [x] Session replay

### P2 (Nice to Have)
- [ ] Export session data (CSV/PDF)
- [ ] Group deletion UI improvements
- [ ] Reset/abandon in-progress cycle
- [ ] Member self-service portal
- [ ] Email notifications for winners
- [ ] Mobile app

## Third-Party Integrations
- **AgentMail** - Email verification and password reset
  - API Key: Configured in backend/.env
  - Inbox: noreply@rosca-hcc.net

## Known Issues
- ESLint warnings for useEffect dependencies (minor, not affecting functionality)
- AgentMail may not send emails in some environments - codes are logged to backend

## Files Structure
```
/app/
├── backend/
│   ├── server.py          # All API endpoints
│   ├── .env               # Environment variables
│   └── tests/
│       └── test_rosca_new_features.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx       # Navigation with RBAC
│   │   │   └── SpinWheel.jsx    # Canvas wheel component
│   │   ├── pages/
│   │   │   ├── Landing.jsx      # Public landing page
│   │   │   ├── Login.jsx        # Login with forgot password link
│   │   │   ├── Register.jsx     # 3-step registration
│   │   │   ├── ForgotPassword.jsx
│   │   │   ├── AdminDashboard.jsx  # User & CMS management
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Groups.jsx
│   │   │   ├── GroupDetail.jsx
│   │   │   ├── SpinSession.jsx
│   │   │   ├── SessionHistory.jsx
│   │   │   ├── SessionReplay.jsx
│   │   │   ├── ThemeSettings.jsx
│   │   │   └── AuditLogs.jsx
│   │   └── App.js          # Routes and context
│   └── .env
├── memory/
│   └── PRD.md
└── test_reports/
    └── iteration_2.json
```

## Next Action Items
1. Add sound effects to spinning wheel
2. Implement group deletion UI improvements
3. Add export functionality (CSV/PDF) for spin history
4. Consider adding reset/abandon cycle option
