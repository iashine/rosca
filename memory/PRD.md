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

## User Personas
1. **Moderator** - Creates and manages ROSCA groups, adds/removes members, conducts spin sessions
2. **Group Member** - Participates in savings circles (future: can view their status)

## Core Requirements
- JWT-based authentication (email/password)
- Two roles: Moderator and Member
- Colorful spinning wheel with sound effects
- Dark/light mode toggle
- Professional blue color scheme
- Cryptographically secure random selection (Web Crypto API)
- Session recording with replay functionality
- Wheel theme customization

## Architecture
- **Backend**: FastAPI (Python) with MongoDB
- **Frontend**: React with Tailwind CSS, shadcn/ui components
- **Database**: MongoDB (collections: users, groups, members, sessions, spin_results, audit_logs, theme_preferences)
- **Authentication**: JWT tokens with bcrypt password hashing

## What's Been Implemented (December 29, 2025)

### Backend (100% Complete)
- User registration & login with JWT
- Group CRUD operations
- Member management (add/remove)
- Session management (start/end)
- Spin result recording
- Theme preferences storage
- Audit logging
- Statistics endpoint

### Frontend (95% Complete)
- Login & Registration pages
- Dashboard with stats widgets
- Groups list and management
- Group detail with member management
- Spinning wheel component with Canvas API
- Session spin page with real-time results
- Session history and replay
- Theme customization page
- Audit logs viewer
- Dark/light mode toggle
- Responsive design

### API Endpoints
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- GET/POST /api/groups
- GET/PUT/DELETE /api/groups/{id}
- GET/POST/DELETE /api/groups/{id}/members
- GET/POST /api/sessions
- GET /api/sessions/{id}
- POST /api/sessions/{id}/end
- POST /api/spins
- GET /api/sessions/{id}/spins
- GET/PUT /api/theme
- GET /api/audit-logs
- GET /api/stats

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] User authentication
- [x] Group management
- [x] Member management
- [x] Spinning wheel with random selection
- [x] Session recording

### P1 (Important) - Partially Done
- [x] Theme customization
- [x] Audit logs
- [x] Session replay
- [ ] Sound effects (audio files need to be added)
- [ ] Export session data

### P2 (Nice to Have)
- [ ] Member portal (view own status)
- [ ] Email notifications
- [ ] Mobile app
- [ ] Payment tracking integration
- [ ] Contribution reminders

## Next Action Items
1. Add proper sound effect audio files for wheel spin
2. Implement session data export (CSV/PDF)
3. Add member self-service portal
4. Consider payment tracking integration
