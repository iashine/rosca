from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import secrets
import random
import asyncio
import httpx
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
    role: str = "moderator"  # "superadmin", "moderator" or "member"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    is_verified: bool = True
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# New models for registration flow
class RegistrationInitRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    math_answer: int

class RegistrationInitResponse(BaseModel):
    registration_id: str
    message: str

class RegistrationVerifyRequest(BaseModel):
    registration_id: str
    verification_code: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class MathChallengeResponse(BaseModel):
    challenge_id: str
    question: str
    num1: int
    num2: int
    operation: str

# CMS Models
class CMSContentCreate(BaseModel):
    key: str
    title: str
    content: str
    content_type: str = "text"  # text, html, json

class CMSContentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    content_type: Optional[str] = None

class CMSContentResponse(BaseModel):
    id: str
    key: str
    title: str
    content: str
    content_type: str
    updated_by: Optional[str] = None
    updated_at: str

# User management models
class UserUpdateRole(BaseModel):
    role: str

class UserListResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    is_verified: bool
    created_at: str

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

# ============ GEOBLOCKING MODELS ============

class GeoblockingSettings(BaseModel):
    enabled: bool = False
    allowed_countries: List[str] = ["US"]
    block_message: str = "Access to this site is restricted in your region."

class GeoblockingSettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    allowed_countries: Optional[List[str]] = None
    block_message: Optional[str] = None

class IPWhitelistCreate(BaseModel):
    ip_address: str
    description: Optional[str] = ""

class IPWhitelistResponse(BaseModel):
    id: str
    ip_address: str
    description: str
    added_by: str
    created_at: str

class IPLogResponse(BaseModel):
    id: str
    ip_address: str
    country_code: Optional[str]
    country_name: Optional[str]
    city: Optional[str]
    region: Optional[str]
    is_blocked: bool
    is_whitelisted: bool
    user_agent: Optional[str]
    path: str
    visit_count: int
    first_visit: str
    last_visit: str

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

def generate_verification_code() -> str:
    """Generate a 6-digit verification code"""
    return ''.join([str(random.randint(0, 9)) for _ in range(6)])

def generate_math_challenge():
    """Generate a simple math problem"""
    num1 = random.randint(1, 20)
    num2 = random.randint(1, 20)
    operations = ['+', '-', '*']
    operation = random.choice(operations)
    
    if operation == '+':
        answer = num1 + num2
    elif operation == '-':
        # Ensure positive result
        if num1 < num2:
            num1, num2 = num2, num1
        answer = num1 - num2
    else:
        num1 = random.randint(1, 10)
        num2 = random.randint(1, 10)
        answer = num1 * num2
    
    return {
        "num1": num1,
        "num2": num2,
        "operation": operation,
        "answer": answer,
        "question": f"What is {num1} {operation} {num2}?"
    }

async def send_verification_email(to_email: str, code: str, name: str):
    """Send verification email using AgentMail"""
    if not agentmail_client:
        logging.warning("AgentMail client not configured, skipping email")
        return False
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }}
            .code {{ font-size: 32px; font-weight: bold; text-align: center; color: #3b82f6; background: white; padding: 20px; border-radius: 8px; margin: 20px 0; letter-spacing: 8px; }}
            .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>ROSCA Spin</h1>
                <p>Email Verification</p>
            </div>
            <div class="content">
                <p>Hello {name},</p>
                <p>Thank you for registering with ROSCA Spin. Please use the following verification code to complete your registration:</p>
                <div class="code">{code}</div>
                <p>This code will expire in 15 minutes.</p>
                <p>If you didn't request this, please ignore this email.</p>
            </div>
            <div class="footer">
                <p>&copy; 2025 ROSCA Spin. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        await asyncio.to_thread(
            agentmail_client.inboxes.messages.send,
            AGENTMAIL_INBOX,
            to=to_email,
            subject="ROSCA Spin - Email Verification Code",
            html=html_content
        )
        return True
    except Exception as e:
        logging.error(f"Failed to send verification email: {e}")
        return False

async def send_password_reset_email(to_email: str, reset_token: str, name: str):
    """Send password reset email using AgentMail"""
    if not agentmail_client:
        logging.warning("AgentMail client not configured, skipping email")
        return False
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }}
            .code {{ font-size: 24px; font-weight: bold; text-align: center; color: #3b82f6; background: white; padding: 20px; border-radius: 8px; margin: 20px 0; letter-spacing: 4px; }}
            .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>ROSCA Spin</h1>
                <p>Password Reset</p>
            </div>
            <div class="content">
                <p>Hello {name},</p>
                <p>We received a request to reset your password. Use the following code to reset your password:</p>
                <div class="code">{reset_token}</div>
                <p>This code will expire in 30 minutes.</p>
                <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
            </div>
            <div class="footer">
                <p>&copy; 2025 ROSCA Spin. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        await asyncio.to_thread(
            agentmail_client.inboxes.messages.send,
            AGENTMAIL_INBOX,
            to=to_email,
            subject="ROSCA Spin - Password Reset Code",
            html=html_content
        )
        return True
    except Exception as e:
        logging.error(f"Failed to send password reset email: {e}")
        return False

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

def require_role(*allowed_roles):
    """Dependency to check user role"""
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=403, 
                detail=f"Access denied. Required role: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker

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

# Math challenge endpoint
@api_router.get("/auth/math-challenge", response_model=MathChallengeResponse)
async def get_math_challenge():
    """Generate a math challenge for registration"""
    challenge = generate_math_challenge()
    challenge_id = str(uuid.uuid4())
    
    # Store challenge temporarily (15 min expiry)
    await db.math_challenges.insert_one({
        "id": challenge_id,
        "answer": challenge["answer"],
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    })
    
    return MathChallengeResponse(
        challenge_id=challenge_id,
        question=challenge["question"],
        num1=challenge["num1"],
        num2=challenge["num2"],
        operation=challenge["operation"]
    )

# New registration flow - Step 1: Init registration
@api_router.post("/auth/register/init", response_model=RegistrationInitResponse)
async def register_init(data: RegistrationInitRequest):
    """Step 1: Validate math answer and send verification email"""
    # Check if email already exists
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check for pending registration
    pending = await db.pending_registrations.find_one({"email": data.email, "verified": False})
    if pending:
        # Delete old pending registration
        await db.pending_registrations.delete_one({"id": pending["id"]})
    
    # Validate password
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Generate verification code
    verification_code = generate_verification_code()
    registration_id = str(uuid.uuid4())
    
    # Store pending registration
    await db.pending_registrations.insert_one({
        "id": registration_id,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "verification_code": verification_code,
        "verified": False,
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Send verification email
    email_sent = await send_verification_email(data.email, verification_code, data.name)
    
    if not email_sent:
        # For development/testing, return the code in the response
        logging.warning(f"Email not sent. Verification code for {data.email}: {verification_code}")
    
    return RegistrationInitResponse(
        registration_id=registration_id,
        message="Verification code sent to your email. Please check your inbox."
    )

# New registration flow - Step 2: Verify email
@api_router.post("/auth/register/verify", response_model=TokenResponse)
async def register_verify(data: RegistrationVerifyRequest):
    """Step 2: Verify email code and complete registration"""
    # Find pending registration
    pending = await db.pending_registrations.find_one({"id": data.registration_id}, {"_id": 0})
    
    if not pending:
        raise HTTPException(status_code=404, detail="Registration not found or expired")
    
    # Check expiry
    expires_at = datetime.fromisoformat(pending["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        await db.pending_registrations.delete_one({"id": data.registration_id})
        raise HTTPException(status_code=400, detail="Verification code expired. Please register again.")
    
    # Verify code
    if pending["verification_code"] != data.verification_code:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Check if email was registered meanwhile
    existing = await db.users.find_one({"email": pending["email"]})
    if existing:
        await db.pending_registrations.delete_one({"id": data.registration_id})
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": pending["email"],
        "password_hash": pending["password_hash"],
        "name": pending["name"],
        "role": ROLE_MODERATOR,
        "is_verified": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    await db.pending_registrations.delete_one({"id": data.registration_id})
    await log_audit(user_id, pending["name"], "REGISTER", "user", user_id, f"User registered with email verification: {pending['email']}")
    
    token = create_token(user_id, pending["email"], ROLE_MODERATOR)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=pending["email"],
            name=pending["name"],
            role=ROLE_MODERATOR,
            is_verified=True,
            created_at=user["created_at"]
        )
    )

# Legacy register endpoint (for backward compatibility / direct registration)
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
        "is_verified": True,
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
            is_verified=True,
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
            is_verified=user.get("is_verified", True),
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
        is_verified=current_user.get("is_verified", True),
        created_at=current_user["created_at"]
    )

# Password Reset Endpoints
@api_router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    """Send password reset code to email"""
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If an account exists with this email, you will receive a reset code."}
    
    # Generate reset token (6 digit code)
    reset_token = generate_verification_code()
    
    # Store reset token
    await db.password_resets.delete_many({"email": data.email})  # Remove old tokens
    await db.password_resets.insert_one({
        "id": str(uuid.uuid4()),
        "email": data.email,
        "token": reset_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Send reset email
    email_sent = await send_password_reset_email(data.email, reset_token, user["name"])
    
    if not email_sent:
        logging.warning(f"Password reset email not sent. Code for {data.email}: {reset_token}")
    
    return {"message": "If an account exists with this email, you will receive a reset code."}

@api_router.post("/auth/reset-password")
async def reset_password(data: ResetPasswordRequest):
    """Reset password using the code sent via email"""
    # Find reset token
    reset_record = await db.password_resets.find_one({"token": data.reset_token}, {"_id": 0})
    
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    
    # Check expiry
    expires_at = datetime.fromisoformat(reset_record["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        await db.password_resets.delete_one({"token": data.reset_token})
        raise HTTPException(status_code=400, detail="Reset code has expired. Please request a new one.")
    
    # Validate new password
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Update password
    user = await db.users.find_one({"email": reset_record["email"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    await db.users.update_one(
        {"email": reset_record["email"]},
        {"$set": {"password_hash": hash_password(data.new_password)}}
    )
    
    # Delete reset token
    await db.password_resets.delete_one({"token": data.reset_token})
    
    await log_audit(user["id"], user["name"], "PASSWORD_RESET", "user", user["id"], "Password reset successfully")
    
    return {"message": "Password reset successfully. You can now login with your new password."}

@api_router.post("/auth/change-password")
async def change_password(data: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    """Change password for logged-in user"""
    # Verify current password
    if not verify_password(data.current_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Update password
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password_hash": hash_password(data.new_password)}}
    )
    
    await log_audit(current_user["id"], current_user["name"], "PASSWORD_CHANGE", "user", current_user["id"], "Password changed")
    
    return {"message": "Password changed successfully"}

# ============ ADMIN / USER MANAGEMENT ENDPOINTS ============

@api_router.get("/admin/users", response_model=List[UserListResponse])
async def list_users(current_user: dict = Depends(require_role(ROLE_SUPERADMIN))):
    """List all users (superadmin only)"""
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    
    return [UserListResponse(
        id=u["id"],
        email=u["email"],
        name=u["name"],
        role=u["role"],
        is_verified=u.get("is_verified", True),
        created_at=u["created_at"]
    ) for u in users]

@api_router.put("/admin/users/{user_id}/role")
async def update_user_role(user_id: str, data: UserUpdateRole, current_user: dict = Depends(require_role(ROLE_SUPERADMIN))):
    """Update user role (superadmin only)"""
    if data.role not in [ROLE_SUPERADMIN, ROLE_MODERATOR, ROLE_MEMBER]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent demoting yourself
    if user_id == current_user["id"] and data.role != ROLE_SUPERADMIN:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    
    await db.users.update_one({"id": user_id}, {"$set": {"role": data.role}})
    await log_audit(current_user["id"], current_user["name"], "UPDATE_ROLE", "user", user_id, f"Changed role to {data.role}")
    
    return {"message": f"User role updated to {data.role}"}

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_role(ROLE_SUPERADMIN))):
    """Delete user (superadmin only)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting yourself
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    await db.users.delete_one({"id": user_id})
    await log_audit(current_user["id"], current_user["name"], "DELETE_USER", "user", user_id, f"Deleted user: {user['email']}")
    
    return {"message": "User deleted successfully"}

# ============ CMS ENDPOINTS ============

@api_router.get("/cms/content")
async def get_all_cms_content():
    """Get all CMS content (public)"""
    content = await db.cms_content.find({}, {"_id": 0}).to_list(100)
    return content

@api_router.get("/cms/content/{key}")
async def get_cms_content(key: str):
    """Get specific CMS content by key (public)"""
    content = await db.cms_content.find_one({"key": key}, {"_id": 0})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    return content

@api_router.post("/cms/content", response_model=CMSContentResponse)
async def create_cms_content(data: CMSContentCreate, current_user: dict = Depends(require_role(ROLE_SUPERADMIN))):
    """Create CMS content (superadmin only)"""
    # Check if key already exists
    existing = await db.cms_content.find_one({"key": data.key})
    if existing:
        raise HTTPException(status_code=400, detail="Content with this key already exists")
    
    content_id = str(uuid.uuid4())
    content = {
        "id": content_id,
        "key": data.key,
        "title": data.title,
        "content": data.content,
        "content_type": data.content_type,
        "updated_by": current_user["name"],
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.cms_content.insert_one(content)
    await log_audit(current_user["id"], current_user["name"], "CREATE_CMS", "cms", content_id, f"Created CMS content: {data.key}")
    
    return CMSContentResponse(**content)

@api_router.put("/cms/content/{key}", response_model=CMSContentResponse)
async def update_cms_content(key: str, data: CMSContentUpdate, current_user: dict = Depends(require_role(ROLE_SUPERADMIN))):
    """Update CMS content (superadmin only)"""
    content = await db.cms_content.find_one({"key": key}, {"_id": 0})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    update_data = {"updated_by": current_user["name"], "updated_at": datetime.now(timezone.utc).isoformat()}
    if data.title is not None:
        update_data["title"] = data.title
    if data.content is not None:
        update_data["content"] = data.content
    if data.content_type is not None:
        update_data["content_type"] = data.content_type
    
    await db.cms_content.update_one({"key": key}, {"$set": update_data})
    await log_audit(current_user["id"], current_user["name"], "UPDATE_CMS", "cms", content["id"], f"Updated CMS content: {key}")
    
    updated = await db.cms_content.find_one({"key": key}, {"_id": 0})
    return CMSContentResponse(**updated)

@api_router.delete("/cms/content/{key}")
async def delete_cms_content(key: str, current_user: dict = Depends(require_role(ROLE_SUPERADMIN))):
    """Delete CMS content (superadmin only)"""
    content = await db.cms_content.find_one({"key": key}, {"_id": 0})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    await db.cms_content.delete_one({"key": key})
    await log_audit(current_user["id"], current_user["name"], "DELETE_CMS", "cms", content["id"], f"Deleted CMS content: {key}")
    
    return {"message": "Content deleted successfully"}

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

# ============ GEOBLOCKING ENDPOINTS ============

async def get_ip_geolocation(ip_address: str) -> dict:
    """Get geolocation data for an IP address using ip-api.com (free service)"""
    try:
        # Skip private/local IPs
        if ip_address in ["127.0.0.1", "localhost", "::1"] or ip_address.startswith("192.168.") or ip_address.startswith("10."):
            return {
                "country_code": "US",
                "country_name": "United States (Local)",
                "city": "Local",
                "region": "Local"
            }
        
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"http://ip-api.com/json/{ip_address}")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    return {
                        "country_code": data.get("countryCode", ""),
                        "country_name": data.get("country", ""),
                        "city": data.get("city", ""),
                        "region": data.get("regionName", "")
                    }
    except Exception as e:
        logger.error(f"Failed to get geolocation for {ip_address}: {e}")
    
    return {
        "country_code": "UNKNOWN",
        "country_name": "Unknown",
        "city": "",
        "region": ""
    }

async def log_ip_visit(ip_address: str, user_agent: str, path: str, geo_data: dict, is_blocked: bool, is_whitelisted: bool):
    """Log IP visit to database"""
    try:
        existing = await db.ip_logs.find_one({"ip_address": ip_address}, {"_id": 0})
        
        if existing:
            # Update existing record
            await db.ip_logs.update_one(
                {"ip_address": ip_address},
                {
                    "$set": {
                        "last_visit": datetime.now(timezone.utc).isoformat(),
                        "is_blocked": is_blocked,
                        "is_whitelisted": is_whitelisted,
                        "user_agent": user_agent,
                        "path": path
                    },
                    "$inc": {"visit_count": 1}
                }
            )
        else:
            # Create new record
            await db.ip_logs.insert_one({
                "id": str(uuid.uuid4()),
                "ip_address": ip_address,
                "country_code": geo_data.get("country_code"),
                "country_name": geo_data.get("country_name"),
                "city": geo_data.get("city"),
                "region": geo_data.get("region"),
                "is_blocked": is_blocked,
                "is_whitelisted": is_whitelisted,
                "user_agent": user_agent,
                "path": path,
                "visit_count": 1,
                "first_visit": datetime.now(timezone.utc).isoformat(),
                "last_visit": datetime.now(timezone.utc).isoformat()
            })
    except Exception as e:
        logger.error(f"Failed to log IP visit: {e}")

@api_router.get("/admin/geoblocking")
async def get_geoblocking_settings(current_user: dict = Depends(require_role(ROLE_SUPERADMIN))):
    """Get geoblocking settings (superadmin only)"""
    settings = await db.geoblocking_settings.find_one({}, {"_id": 0})
    if not settings:
        # Return defaults
        return GeoblockingSettings()
    
    return GeoblockingSettings(
        enabled=settings.get("enabled", False),
        allowed_countries=settings.get("allowed_countries", ["US"]),
        block_message=settings.get("block_message", "Access to this site is restricted in your region.")
    )

@api_router.put("/admin/geoblocking")
async def update_geoblocking_settings(data: GeoblockingSettingsUpdate, current_user: dict = Depends(require_role(ROLE_SUPERADMIN))):
    """Update geoblocking settings (superadmin only)"""
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.enabled is not None:
        update_data["enabled"] = data.enabled
    if data.allowed_countries is not None:
        update_data["allowed_countries"] = data.allowed_countries
    if data.block_message is not None:
        update_data["block_message"] = data.block_message
    
    await db.geoblocking_settings.update_one(
        {},
        {"$set": update_data},
        upsert=True
    )
    
    await log_audit(current_user["id"], current_user["name"], "UPDATE_GEOBLOCKING", "settings", "geoblocking", 
                   f"Geoblocking {'enabled' if data.enabled else 'disabled' if data.enabled is not None else 'updated'}")
    
    settings = await db.geoblocking_settings.find_one({}, {"_id": 0})
    return GeoblockingSettings(
        enabled=settings.get("enabled", False),
        allowed_countries=settings.get("allowed_countries", ["US"]),
        block_message=settings.get("block_message", "Access to this site is restricted in your region.")
    )

@api_router.get("/admin/ip-logs", response_model=List[IPLogResponse])
async def get_ip_logs(
    limit: int = 100, 
    skip: int = 0,
    country_filter: Optional[str] = None,
    blocked_only: bool = False,
    current_user: dict = Depends(require_role(ROLE_SUPERADMIN))
):
    """Get IP visit logs (superadmin only)"""
    query = {}
    if country_filter:
        query["country_code"] = country_filter
    if blocked_only:
        query["is_blocked"] = True
    
    logs = await db.ip_logs.find(query, {"_id": 0}).sort("last_visit", -1).skip(skip).limit(limit).to_list(limit)
    
    return [IPLogResponse(
        id=log["id"],
        ip_address=log["ip_address"],
        country_code=log.get("country_code"),
        country_name=log.get("country_name"),
        city=log.get("city"),
        region=log.get("region"),
        is_blocked=log.get("is_blocked", False),
        is_whitelisted=log.get("is_whitelisted", False),
        user_agent=log.get("user_agent"),
        path=log.get("path", ""),
        visit_count=log.get("visit_count", 1),
        first_visit=log.get("first_visit", ""),
        last_visit=log.get("last_visit", "")
    ) for log in logs]

@api_router.get("/admin/ip-logs/stats")
async def get_ip_logs_stats(current_user: dict = Depends(require_role(ROLE_SUPERADMIN))):
    """Get IP logs statistics (superadmin only)"""
    total_ips = await db.ip_logs.count_documents({})
    blocked_ips = await db.ip_logs.count_documents({"is_blocked": True})
    whitelisted_ips = await db.ip_whitelist.count_documents({})
    
    # Get country distribution
    pipeline = [
        {"$group": {"_id": "$country_code", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    country_stats = await db.ip_logs.aggregate(pipeline).to_list(10)
    
    return {
        "total_unique_ips": total_ips,
        "blocked_ips": blocked_ips,
        "whitelisted_ips": whitelisted_ips,
        "top_countries": [{"country": c["_id"], "count": c["count"]} for c in country_stats]
    }

@api_router.get("/admin/ip-whitelist", response_model=List[IPWhitelistResponse])
async def get_ip_whitelist(current_user: dict = Depends(require_role(ROLE_SUPERADMIN))):
    """Get IP whitelist (superadmin only)"""
    whitelist = await db.ip_whitelist.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    return [IPWhitelistResponse(
        id=w["id"],
        ip_address=w["ip_address"],
        description=w.get("description", ""),
        added_by=w.get("added_by", ""),
        created_at=w["created_at"]
    ) for w in whitelist]

@api_router.post("/admin/ip-whitelist", response_model=IPWhitelistResponse)
async def add_ip_to_whitelist(data: IPWhitelistCreate, current_user: dict = Depends(require_role(ROLE_SUPERADMIN))):
    """Add IP to whitelist (superadmin only)"""
    # Check if already whitelisted
    existing = await db.ip_whitelist.find_one({"ip_address": data.ip_address})
    if existing:
        raise HTTPException(status_code=400, detail="IP already whitelisted")
    
    whitelist_id = str(uuid.uuid4())
    entry = {
        "id": whitelist_id,
        "ip_address": data.ip_address,
        "description": data.description or "",
        "added_by": current_user["name"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ip_whitelist.insert_one(entry)
    
    # Update IP log if exists
    await db.ip_logs.update_one(
        {"ip_address": data.ip_address},
        {"$set": {"is_whitelisted": True, "is_blocked": False}}
    )
    
    await log_audit(current_user["id"], current_user["name"], "WHITELIST_IP", "ip_whitelist", whitelist_id, 
                   f"Whitelisted IP: {data.ip_address}")
    
    return IPWhitelistResponse(**entry)

@api_router.delete("/admin/ip-whitelist/{ip_address}")
async def remove_ip_from_whitelist(ip_address: str, current_user: dict = Depends(require_role(ROLE_SUPERADMIN))):
    """Remove IP from whitelist (superadmin only)"""
    result = await db.ip_whitelist.delete_one({"ip_address": ip_address})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="IP not found in whitelist")
    
    # Update IP log if exists
    await db.ip_logs.update_one(
        {"ip_address": ip_address},
        {"$set": {"is_whitelisted": False}}
    )
    
    await log_audit(current_user["id"], current_user["name"], "REMOVE_WHITELIST_IP", "ip_whitelist", ip_address, 
                   f"Removed IP from whitelist: {ip_address}")
    
    return {"message": f"IP {ip_address} removed from whitelist"}

@api_router.get("/geoblocking/check")
async def check_geoblocking_status(request: Request):
    """Public endpoint to check if current IP is blocked"""
    # Get client IP
    client_ip = request.headers.get("X-Forwarded-For", request.headers.get("X-Real-IP", request.client.host))
    if client_ip and "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()
    
    # Get settings
    settings = await db.geoblocking_settings.find_one({}, {"_id": 0})
    if not settings or not settings.get("enabled", False):
        return {"blocked": False, "reason": "Geoblocking disabled"}
    
    # Check whitelist
    whitelisted = await db.ip_whitelist.find_one({"ip_address": client_ip})
    if whitelisted:
        return {"blocked": False, "reason": "IP whitelisted", "ip": client_ip}
    
    # Get geolocation
    geo_data = await get_ip_geolocation(client_ip)
    country_code = geo_data.get("country_code", "UNKNOWN")
    
    allowed_countries = settings.get("allowed_countries", ["US"])
    is_blocked = country_code not in allowed_countries and country_code != "UNKNOWN"
    
    return {
        "blocked": is_blocked,
        "ip": client_ip,
        "country_code": country_code,
        "country_name": geo_data.get("country_name"),
        "allowed_countries": allowed_countries,
        "message": settings.get("block_message") if is_blocked else None
    }

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "ROSCA Spin API", "version": "2.0.0"}

# Include the router in the main app
app.include_router(api_router)

# Geoblocking Middleware
class GeoblockingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Skip geoblocking check for API endpoints (they handle their own auth)
        # Only block frontend requests
        path = request.url.path
        
        # Always allow API calls and static files
        if path.startswith("/api/") or path.startswith("/static/"):
            return await call_next(request)
        
        # Get client IP
        client_ip = request.headers.get("X-Forwarded-For", request.headers.get("X-Real-IP", ""))
        if not client_ip and request.client:
            client_ip = request.client.host
        if client_ip and "," in client_ip:
            client_ip = client_ip.split(",")[0].strip()
        
        if not client_ip:
            return await call_next(request)
        
        try:
            # Get settings
            settings = await db.geoblocking_settings.find_one({}, {"_id": 0})
            
            if not settings or not settings.get("enabled", False):
                # Geoblocking disabled, just log the visit
                geo_data = await get_ip_geolocation(client_ip)
                user_agent = request.headers.get("User-Agent", "")
                await log_ip_visit(client_ip, user_agent, path, geo_data, False, False)
                return await call_next(request)
            
            # Check whitelist first
            whitelisted = await db.ip_whitelist.find_one({"ip_address": client_ip})
            if whitelisted:
                geo_data = await get_ip_geolocation(client_ip)
                user_agent = request.headers.get("User-Agent", "")
                await log_ip_visit(client_ip, user_agent, path, geo_data, False, True)
                return await call_next(request)
            
            # Get geolocation
            geo_data = await get_ip_geolocation(client_ip)
            country_code = geo_data.get("country_code", "UNKNOWN")
            user_agent = request.headers.get("User-Agent", "")
            
            allowed_countries = settings.get("allowed_countries", ["US"])
            is_blocked = country_code not in allowed_countries and country_code != "UNKNOWN"
            
            # Log the visit
            await log_ip_visit(client_ip, user_agent, path, geo_data, is_blocked, False)
            
            if is_blocked:
                # Return blocked response - redirect to restricted page
                return JSONResponse(
                    status_code=403,
                    content={
                        "blocked": True,
                        "message": settings.get("block_message", "Access restricted"),
                        "country": country_code
                    }
                )
        except Exception as e:
            logger.error(f"Geoblocking middleware error: {e}")
        
        return await call_next(request)

# Add geoblocking middleware (before CORS)
app.add_middleware(GeoblockingMiddleware)

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
