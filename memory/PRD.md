# ROSCA Spin Application - PRD

## Original Problem Statement
Build a ROSCA (Rotating Savings and Credit Association) Application with:
- User authentication (email/password JWT)
- Group management (CRUD operations)
- Member management within groups
- Spinning wheel for random winner selection
- Session recording and history
- Theme customization
- Audit logging
- Dashboard with statistics
- Landing page and secure moderator sign-up flow
- RBAC for superadmin and moderators
- Password reset and forgot password features
- CMS section for content management
- Geoblocking with IP whitelisting
- **Member Access Portal with passcodes, chat, and online presence**

## User Personas
1. **Superadmin** - Full system access, user management, CMS control, geoblocking management
2. **Moderator** - Creates and manages ROSCA groups, adds/removes members, conducts spin sessions
3. **Group Member** - Accesses group via passcode, views spin results, chats with other members

## Architecture
- **Backend**: FastAPI (Python) with MongoDB
- **Frontend**: React with Tailwind CSS, shadcn/ui components
- **Database**: MongoDB
- **Authentication**: JWT tokens (separate for moderators and members)
- **Email Service**: AgentMail API
- **Geolocation**: ip-api.com

## What's Been Implemented

### January 7, 2026 - Member Access & Collaboration
- **Private Shareable Links** - Each group gets unique access link
- **Member Passcodes** - Auto-generated easy-to-remember passcodes (e.g., "happy-star-42")
- **Email Invitations** - Sent automatically when member added with email
- **Passcode Management** - Moderator can update/regenerate passcodes (email notification sent)
- **Member Portal** - Dedicated page for members to:
  - View group info and contribution amount
  - See spin cycle status and recent winners
  - Chat with other members and moderator
  - See who's online (real-time presence with green indicators)
- **Moderator Chat View** - See and participate in group chat

## API Endpoints

### Member Access (NEW)
- GET /api/groups/{id}/members-access - Get members with passcodes (moderator)
- PUT /api/groups/{id}/members/{id}/passcode - Update member passcode
- POST /api/groups/{id}/members/{id}/resend-invite - Resend invitation email
- GET /api/groups/{id}/access-link - Get group shareable link
- GET /api/group-access/{code}/info - Get group info by access code (public)
- POST /api/group-access/{code}/login - Member login with passcode (public)
- GET /api/member-portal/group - Get group data for member
- POST /api/member-portal/heartbeat - Update online status
- GET /api/member-portal/chat - Get chat messages
- POST /api/member-portal/chat - Send chat message
- GET /api/groups/{id}/chat - Get chat (moderator)
- POST /api/groups/{id}/chat - Send chat as moderator

## Database Collections
- users, groups, members, sessions, spin_results
- audit_logs, theme_preferences
- pending_registrations, password_resets, math_challenges
- cms_content
- geoblocking_settings, ip_logs, ip_whitelist
- **chat_messages** (NEW)

## Test Accounts
- **Superadmin**: admin@rosca.com / admin123
- **Test Group Access Code**: b-fp8WWcA2Q
- **Test Member Passcode**: keen-moon-13

## Member Access Flow
1. Moderator creates group and adds members
2. Each member gets unique passcode (auto-generated)
3. If email provided, invitation sent with passcode and link
4. Member visits link, enters passcode, accesses portal
5. Member can view spins, chat, see online members
6. Moderator can update passcode (email notification sent)

## Files Structure
```
/app/
├── backend/
│   ├── server.py
│   └── tests/
│       ├── test_member_access.py
│       └── ...
├── frontend/
│   ├── src/pages/
│   │   ├── GroupDetail.jsx    # Enhanced with Member Access tab
│   │   ├── GroupAccess.jsx    # Member login with passcode
│   │   ├── MemberPortal.jsx   # Member view with chat/online
│   │   └── ...
│   └── App.js
└── test_reports/
    └── iteration_4.json
```

## Next Action Items
1. Add sound effects to spinning wheel
2. Add notification when new spin result available
3. Add push notifications for members
4. Export spin history to CSV/PDF

## Future/Backlog
- Mobile app
- Payment tracking integration
- Member self-registration option
- Video call integration for live spin events
