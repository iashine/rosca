from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import secrets
import random
import asyncio
from agentmail import AgentMail

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# AgentMail Settings
AGENTMAIL_API_KEY = os.environ.get('AGENTMAIL_API_KEY')
AGENTMAIL_INBOX = os.environ.get('AGENTMAIL_INBOX', 'noreply@rosca-hcc.net')

# Initialize AgentMail client
agentmail_client = None
if AGENTMAIL_API_KEY:
    agentmail_client = AgentMail(api_key=AGENTMAIL_API_KEY)

# Role Constants
ROLE_SUPERADMIN = "superadmin"
ROLE_MODERATOR = "moderator"
ROLE_MEMBER = "member"

# Create the main app
app = FastAPI(title="ROSCA Spin API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# ============ MODELS ============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "member"  # "moderator" or "member"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    contribution_amount: float = 0
    currency: str = "USD"

class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    contribution_amount: Optional[float] = None
    currency: Optional[str] = None

class GroupResponse(BaseModel):
    id: str
    name: str
    description: str
    contribution_amount: float
    currency: str
    moderator_id: str
    moderator_name: str
    member_count: int
    created_at: str

class MemberCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None

class MemberResponse(BaseModel):
    id: str
    name: str
    email: Optional[str]
    phone: Optional[str]
    status: str
    group_id: str
    created_at: str

class MemberInSpin(BaseModel):
    id: str
    name: str

class SessionResponse(BaseModel):
    id: str
    group_id: str
    group_name: str
    status: str  # "in_progress" or "completed"
    started_at: str
    completed_at: Optional[str]
    total_members: int
    spin_count: int
    remaining_members: int

class SpinResultCreate(BaseModel):
    session_id: str
    winner_member_id: str
    winner_name: str
    members_at_spin: List[MemberInSpin]
    spin_angle: float
    random_seed: str
    is_auto_selected: bool = False

class SpinResultResponse(BaseModel):
    id: str
    session_id: str
    winner_member_id: str
    winner_name: str
    members_at_spin: List[MemberInSpin]
    spin_angle: float
    spin_number: int
    is_auto_selected: bool
    created_at: str

class ThemePreferences(BaseModel):
    wheel_colors: List[str] = ["#3b82f6", "#6366f1", "#8b5cf6", "#0ea5e9", "#14b8a6", "#64748b"]
    background_color: str = "#1a1f36"
    text_color: str = "#ffffff"
    accent_color: str = "#3b82f6"

class AuditLogResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    action: str
    entity_type: str
    entity_id: str
    details: str
    created_at: str

# ============ AUTH HELPERS ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def log_audit(user_id: str, user_name: str, action: str, entity_type: str, entity_id: str, details: str = ""):
    audit_log = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user_name,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(audit_log)

# ============ AUTH ENDPOINTS ============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "role": user_data.role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    await log_audit(user_id, user_data.name, "REGISTER", "user", user_id, f"User registered: {user_data.email}")
    
    token = create_token(user_id, user_data.email, user_data.role)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            role=user_data.role,
            created_at=user["created_at"]
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"], user["role"])
    await log_audit(user["id"], user["name"], "LOGIN", "user", user["id"], "User logged in")
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        role=current_user["role"],
        created_at=current_user["created_at"]
    )

# ============ GROUP ENDPOINTS ============

@api_router.post("/groups", response_model=GroupResponse)
async def create_group(group_data: GroupCreate, current_user: dict = Depends(get_current_user)):
    group_id = str(uuid.uuid4())
    group = {
        "id": group_id,
        "name": group_data.name,
        "description": group_data.description or "",
        "contribution_amount": group_data.contribution_amount,
        "currency": group_data.currency,
        "moderator_id": current_user["id"],
        "moderator_name": current_user["name"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.groups.insert_one(group)
    await log_audit(current_user["id"], current_user["name"], "CREATE", "group", group_id, f"Created group: {group_data.name}")
    
    return GroupResponse(
        id=group_id,
        name=group_data.name,
        description=group_data.description or "",
        contribution_amount=group_data.contribution_amount,
        currency=group_data.currency,
        moderator_id=current_user["id"],
        moderator_name=current_user["name"],
        member_count=0,
        created_at=group["created_at"]
    )

@api_router.get("/groups", response_model=List[GroupResponse])
async def get_groups(current_user: dict = Depends(get_current_user)):
    groups = await db.groups.find({"moderator_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    
    result = []
    for group in groups:
        member_count = await db.members.count_documents({"group_id": group["id"], "status": "active"})
        result.append(GroupResponse(
            id=group["id"],
            name=group["name"],
            description=group.get("description", ""),
            contribution_amount=group.get("contribution_amount", 0),
            currency=group.get("currency", "USD"),
            moderator_id=group["moderator_id"],
            moderator_name=group.get("moderator_name", ""),
            member_count=member_count,
            created_at=group["created_at"]
        ))
    
    return result

@api_router.get("/groups/{group_id}", response_model=GroupResponse)
async def get_group(group_id: str, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id, "moderator_id": current_user["id"]}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    member_count = await db.members.count_documents({"group_id": group_id, "status": "active"})
    
    return GroupResponse(
        id=group["id"],
        name=group["name"],
        description=group.get("description", ""),
        contribution_amount=group.get("contribution_amount", 0),
        currency=group.get("currency", "USD"),
        moderator_id=group["moderator_id"],
        moderator_name=group.get("moderator_name", ""),
        member_count=member_count,
        created_at=group["created_at"]
    )

@api_router.put("/groups/{group_id}", response_model=GroupResponse)
async def update_group(group_id: str, group_data: GroupUpdate, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id, "moderator_id": current_user["id"]}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    update_data = {}
    if group_data.name is not None:
        update_data["name"] = group_data.name
    if group_data.description is not None:
        update_data["description"] = group_data.description
    if group_data.contribution_amount is not None:
        update_data["contribution_amount"] = group_data.contribution_amount
    if group_data.currency is not None:
        update_data["currency"] = group_data.currency
    
    if update_data:
        await db.groups.update_one({"id": group_id}, {"$set": update_data})
        await log_audit(current_user["id"], current_user["name"], "UPDATE", "group", group_id, f"Updated group: {group_data.name or group['name']}")
    
    updated_group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    member_count = await db.members.count_documents({"group_id": group_id, "status": "active"})
    
    return GroupResponse(
        id=updated_group["id"],
        name=updated_group["name"],
        description=updated_group.get("description", ""),
        contribution_amount=updated_group.get("contribution_amount", 0),
        currency=updated_group.get("currency", "USD"),
        moderator_id=updated_group["moderator_id"],
        moderator_name=updated_group.get("moderator_name", ""),
        member_count=member_count,
        created_at=updated_group["created_at"]
    )

@api_router.delete("/groups/{group_id}")
async def delete_group(group_id: str, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id, "moderator_id": current_user["id"]}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    await db.members.delete_many({"group_id": group_id})
    await db.sessions.delete_many({"group_id": group_id})
    await db.spin_results.delete_many({"group_id": group_id})
    await db.groups.delete_one({"id": group_id})
    
    await log_audit(current_user["id"], current_user["name"], "DELETE", "group", group_id, f"Deleted group: {group['name']}")
    
    return {"message": "Group deleted successfully"}

# ============ MEMBER ENDPOINTS ============

@api_router.post("/groups/{group_id}/members", response_model=MemberResponse)
async def add_member(group_id: str, member_data: MemberCreate, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id, "moderator_id": current_user["id"]}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    member_id = str(uuid.uuid4())
    member = {
        "id": member_id,
        "name": member_data.name,
        "email": member_data.email,
        "phone": member_data.phone,
        "group_id": group_id,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.members.insert_one(member)
    await log_audit(current_user["id"], current_user["name"], "ADD_MEMBER", "member", member_id, f"Added member: {member_data.name} to group: {group['name']}")
    
    return MemberResponse(
        id=member_id,
        name=member_data.name,
        email=member_data.email,
        phone=member_data.phone,
        status="active",
        group_id=group_id,
        created_at=member["created_at"]
    )

@api_router.get("/groups/{group_id}/members", response_model=List[MemberResponse])
async def get_members(group_id: str, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id, "moderator_id": current_user["id"]}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    members = await db.members.find({"group_id": group_id, "status": "active"}, {"_id": 0}).to_list(1000)
    
    return [MemberResponse(
        id=m["id"],
        name=m["name"],
        email=m.get("email"),
        phone=m.get("phone"),
        status=m["status"],
        group_id=m["group_id"],
        created_at=m["created_at"]
    ) for m in members]

@api_router.delete("/groups/{group_id}/members/{member_id}")
async def remove_member(group_id: str, member_id: str, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id, "moderator_id": current_user["id"]}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    member = await db.members.find_one({"id": member_id, "group_id": group_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    await db.members.delete_one({"id": member_id})
    await log_audit(current_user["id"], current_user["name"], "REMOVE_MEMBER", "member", member_id, f"Removed member: {member['name']} from group: {group['name']}")
    
    return {"message": "Member removed successfully"}

# ============ SESSION ENDPOINTS ============

@api_router.get("/groups/{group_id}/active-session")
async def get_active_session(group_id: str, current_user: dict = Depends(get_current_user)):
    """Get the active/in-progress session for a group, or null if none exists"""
    group = await db.groups.find_one({"id": group_id, "moderator_id": current_user["id"]}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Find in-progress session
    session = await db.sessions.find_one(
        {"group_id": group_id, "status": "in_progress"}, 
        {"_id": 0}
    )
    
    if not session:
        return {"session": None, "remaining_members": [], "winners": []}
    
    # Get spin results for this session
    spins = await db.spin_results.find({"session_id": session["id"]}, {"_id": 0}).sort("spin_number", 1).to_list(1000)
    
    # Get winner IDs from this session
    winner_ids = [spin["winner_member_id"] for spin in spins]
    
    # Get all active members
    all_members = await db.members.find({"group_id": group_id, "status": "active"}, {"_id": 0}).to_list(1000)
    
    # Calculate remaining members (those who haven't won yet)
    remaining_members = [m for m in all_members if m["id"] not in winner_ids]
    
    # Format winners
    winners = [SpinResultResponse(
        id=s["id"],
        session_id=s["session_id"],
        winner_member_id=s["winner_member_id"],
        winner_name=s["winner_name"],
        members_at_spin=s.get("members_at_spin", []),
        spin_angle=s["spin_angle"],
        spin_number=s["spin_number"],
        is_auto_selected=s.get("is_auto_selected", False),
        created_at=s["created_at"]
    ) for s in spins]
    
    return {
        "session": SessionResponse(
            id=session["id"],
            group_id=session["group_id"],
            group_name=session.get("group_name", ""),
            status=session["status"],
            started_at=session["started_at"],
            completed_at=session.get("completed_at"),
            total_members=session.get("total_members", len(all_members)),
            spin_count=len(spins),
            remaining_members=len(remaining_members)
        ),
        "remaining_members": [MemberResponse(
            id=m["id"],
            name=m["name"],
            email=m.get("email"),
            phone=m.get("phone"),
            status=m["status"],
            group_id=m["group_id"],
            created_at=m["created_at"]
        ) for m in remaining_members],
        "winners": winners
    }

@api_router.post("/groups/{group_id}/sessions", response_model=SessionResponse)
async def create_or_continue_session(group_id: str, current_user: dict = Depends(get_current_user)):
    """Create a new session or return existing in-progress session"""
    group = await db.groups.find_one({"id": group_id, "moderator_id": current_user["id"]}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check for existing in-progress session
    existing_session = await db.sessions.find_one(
        {"group_id": group_id, "status": "in_progress"}, 
        {"_id": 0}
    )
    
    if existing_session:
        spin_count = await db.spin_results.count_documents({"session_id": existing_session["id"]})
        spins = await db.spin_results.find({"session_id": existing_session["id"]}, {"_id": 0, "winner_member_id": 1}).to_list(1000)
        winner_ids = [s["winner_member_id"] for s in spins]
        all_members = await db.members.find({"group_id": group_id, "status": "active"}, {"_id": 0}).to_list(1000)
        remaining = len([m for m in all_members if m["id"] not in winner_ids])
        
        return SessionResponse(
            id=existing_session["id"],
            group_id=group_id,
            group_name=group["name"],
            status="in_progress",
            started_at=existing_session["started_at"],
            completed_at=None,
            total_members=existing_session.get("total_members", len(all_members)),
            spin_count=spin_count,
            remaining_members=remaining
        )
    
    # Get current member count
    members = await db.members.find({"group_id": group_id, "status": "active"}, {"_id": 0}).to_list(1000)
    if len(members) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 members to start a session")
    
    # Create new session
    session_id = str(uuid.uuid4())
    session = {
        "id": session_id,
        "group_id": group_id,
        "group_name": group["name"],
        "status": "in_progress",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "total_members": len(members),
        "created_by": current_user["id"]
    }
    
    await db.sessions.insert_one(session)
    await log_audit(current_user["id"], current_user["name"], "START_SESSION", "session", session_id, f"Started new ROSCA cycle for group: {group['name']}")
    
    return SessionResponse(
        id=session_id,
        group_id=group_id,
        group_name=group["name"],
        status="in_progress",
        started_at=session["started_at"],
        completed_at=None,
        total_members=len(members),
        spin_count=0,
        remaining_members=len(members)
    )

@api_router.get("/sessions", response_model=List[SessionResponse])
async def get_sessions(current_user: dict = Depends(get_current_user)):
    groups = await db.groups.find({"moderator_id": current_user["id"]}, {"_id": 0, "id": 1}).to_list(1000)
    group_ids = [g["id"] for g in groups]
    
    sessions = await db.sessions.find({"group_id": {"$in": group_ids}}, {"_id": 0}).sort("started_at", -1).to_list(1000)
    
    result = []
    for s in sessions:
        spin_count = await db.spin_results.count_documents({"session_id": s["id"]})
        spins = await db.spin_results.find({"session_id": s["id"]}, {"_id": 0, "winner_member_id": 1}).to_list(1000)
        winner_ids = [sp["winner_member_id"] for sp in spins]
        all_members = await db.members.find({"group_id": s["group_id"], "status": "active"}, {"_id": 0}).to_list(1000)
        remaining = len([m for m in all_members if m["id"] not in winner_ids])
        
        result.append(SessionResponse(
            id=s["id"],
            group_id=s["group_id"],
            group_name=s.get("group_name", ""),
            status=s["status"],
            started_at=s["started_at"],
            completed_at=s.get("completed_at"),
            total_members=s.get("total_members", 0),
            spin_count=spin_count,
            remaining_members=remaining if s["status"] == "in_progress" else 0
        ))
    
    return result

@api_router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str, current_user: dict = Depends(get_current_user)):
    session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    group = await db.groups.find_one({"id": session["group_id"], "moderator_id": current_user["id"]}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Session not found")
    
    spin_count = await db.spin_results.count_documents({"session_id": session_id})
    spins = await db.spin_results.find({"session_id": session_id}, {"_id": 0, "winner_member_id": 1}).to_list(1000)
    winner_ids = [s["winner_member_id"] for s in spins]
    all_members = await db.members.find({"group_id": session["group_id"], "status": "active"}, {"_id": 0}).to_list(1000)
    remaining = len([m for m in all_members if m["id"] not in winner_ids])
    
    return SessionResponse(
        id=session["id"],
        group_id=session["group_id"],
        group_name=session.get("group_name", ""),
        status=session["status"],
        started_at=session["started_at"],
        completed_at=session.get("completed_at"),
        total_members=session.get("total_members", 0),
        spin_count=spin_count,
        remaining_members=remaining if session["status"] == "in_progress" else 0
    )

# ============ SPIN ENDPOINTS ============

@api_router.post("/spins", response_model=SpinResultResponse)
async def record_spin(spin_data: SpinResultCreate, current_user: dict = Depends(get_current_user)):
    session = await db.sessions.find_one({"id": spin_data.session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    group = await db.groups.find_one({"id": session["group_id"], "moderator_id": current_user["id"]}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["status"] == "completed":
        raise HTTPException(status_code=400, detail="Session is already completed")
    
    # Get spin count for this session
    spin_count = await db.spin_results.count_documents({"session_id": spin_data.session_id})
    
    spin_id = str(uuid.uuid4())
    spin_result = {
        "id": spin_id,
        "session_id": spin_data.session_id,
        "group_id": session["group_id"],
        "winner_member_id": spin_data.winner_member_id,
        "winner_name": spin_data.winner_name,
        "members_at_spin": [{"id": m.id, "name": m.name} for m in spin_data.members_at_spin],
        "spin_angle": spin_data.spin_angle,
        "random_seed": spin_data.random_seed,
        "spin_number": spin_count + 1,
        "is_auto_selected": spin_data.is_auto_selected,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.spin_results.insert_one(spin_result)
    await log_audit(current_user["id"], current_user["name"], "SPIN", "spin", spin_id, 
                   f"Winner: {spin_data.winner_name}" + (" (auto-selected)" if spin_data.is_auto_selected else ""))
    
    # Check if session should be completed (all members have won)
    total_spins = spin_count + 1
    if total_spins >= session.get("total_members", 0):
        await db.sessions.update_one(
            {"id": spin_data.session_id},
            {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
        )
        await log_audit(current_user["id"], current_user["name"], "COMPLETE_SESSION", "session", spin_data.session_id,
                       f"ROSCA cycle completed for group: {group['name']}")
    
    return SpinResultResponse(
        id=spin_id,
        session_id=spin_data.session_id,
        winner_member_id=spin_data.winner_member_id,
        winner_name=spin_data.winner_name,
        members_at_spin=[MemberInSpin(id=m.id, name=m.name) for m in spin_data.members_at_spin],
        spin_angle=spin_data.spin_angle,
        spin_number=spin_count + 1,
        is_auto_selected=spin_data.is_auto_selected,
        created_at=spin_result["created_at"]
    )

@api_router.get("/sessions/{session_id}/spins", response_model=List[SpinResultResponse])
async def get_session_spins(session_id: str, current_user: dict = Depends(get_current_user)):
    session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    group = await db.groups.find_one({"id": session["group_id"], "moderator_id": current_user["id"]}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Session not found")
    
    spins = await db.spin_results.find({"session_id": session_id}, {"_id": 0}).sort("spin_number", 1).to_list(1000)
    
    return [SpinResultResponse(
        id=s["id"],
        session_id=s["session_id"],
        winner_member_id=s["winner_member_id"],
        winner_name=s["winner_name"],
        members_at_spin=[MemberInSpin(id=m["id"], name=m["name"]) for m in s.get("members_at_spin", [])],
        spin_angle=s["spin_angle"],
        spin_number=s["spin_number"],
        is_auto_selected=s.get("is_auto_selected", False),
        created_at=s["created_at"]
    ) for s in spins]

# ============ THEME ENDPOINTS ============

@api_router.get("/theme", response_model=ThemePreferences)
async def get_theme(current_user: dict = Depends(get_current_user)):
    theme = await db.theme_preferences.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not theme:
        return ThemePreferences()
    
    return ThemePreferences(
        wheel_colors=theme.get("wheel_colors", ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEEAD", "#D4A5A5"]),
        background_color=theme.get("background_color", "#1a1f36"),
        text_color=theme.get("text_color", "#ffffff"),
        accent_color=theme.get("accent_color", "#3b82f6")
    )

@api_router.put("/theme", response_model=ThemePreferences)
async def update_theme(theme_data: ThemePreferences, current_user: dict = Depends(get_current_user)):
    theme = {
        "user_id": current_user["id"],
        "wheel_colors": theme_data.wheel_colors,
        "background_color": theme_data.background_color,
        "text_color": theme_data.text_color,
        "accent_color": theme_data.accent_color,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.theme_preferences.update_one(
        {"user_id": current_user["id"]},
        {"$set": theme},
        upsert=True
    )
    
    return theme_data

# ============ AUDIT LOG ENDPOINTS ============

@api_router.get("/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_logs(limit: int = 50, current_user: dict = Depends(get_current_user)):
    logs = await db.audit_logs.find({"user_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return [AuditLogResponse(
        id=log["id"],
        user_id=log["user_id"],
        user_name=log["user_name"],
        action=log["action"],
        entity_type=log["entity_type"],
        entity_id=log["entity_id"],
        details=log.get("details", ""),
        created_at=log["created_at"]
    ) for log in logs]

# ============ STATS ENDPOINTS ============

@api_router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    groups = await db.groups.find({"moderator_id": current_user["id"]}, {"_id": 0, "id": 1}).to_list(1000)
    group_ids = [g["id"] for g in groups]
    
    total_groups = len(group_ids)
    total_members = await db.members.count_documents({"group_id": {"$in": group_ids}, "status": "active"})
    total_sessions = await db.sessions.count_documents({"group_id": {"$in": group_ids}})
    total_spins = await db.spin_results.count_documents({"group_id": {"$in": group_ids}})
    completed_sessions = await db.sessions.count_documents({"group_id": {"$in": group_ids}, "status": "completed"})
    
    return {
        "total_groups": total_groups,
        "total_members": total_members,
        "total_sessions": total_sessions,
        "total_spins": total_spins,
        "completed_cycles": completed_sessions
    }

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "ROSCA Spin API", "version": "2.0.0"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
