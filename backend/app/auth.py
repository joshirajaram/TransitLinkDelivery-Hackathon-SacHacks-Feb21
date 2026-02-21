"""
Authentication and Authorization Module
Implements Google OAuth, UC Davis CAS SSO, and role-based access control
"""

import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .db import SessionLocal, UserORM
from .models import UserRole

# Configuration from environment variables
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")

# CAS Configuration
CAS_SERVER_URL = "https://cas.ucdavis.edu/cas"
CAS_SERVICE_URL = "http://localhost:5173/auth/callback"  # Frontend callback URL

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


# Pydantic Models
class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict


class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[int] = None
    role: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str  # For demo/testing only; production uses CAS


class CurrentUser(BaseModel):
    id: int
    email: str
    name: str
    role: UserRole


# Helper Functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> TokenData:
    """Decode and verify a JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        role: str = payload.get("role")
        
        if email is None or user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )
        
        return TokenData(email=email, user_id=user_id, role=role)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )


# Database Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Authentication Dependencies
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> CurrentUser:
    """Get the current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token_data = decode_access_token(token)
    
    user = db.query(UserORM).filter(UserORM.id == token_data.user_id).first()
    if user is None:
        raise credentials_exception
    
    return CurrentUser(
        id=user.id,
        email=user.email,
        name=user.name,
        role=UserRole(user.role)
    )


# Role-based Access Control
def require_role(allowed_roles: list[UserRole]):
    """Dependency to require specific roles"""
    async def role_checker(current_user: CurrentUser = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[r.value for r in allowed_roles]}"
            )
        return current_user
    return role_checker


# Convenience role dependencies
async def require_student(current_user: CurrentUser = Depends(get_current_user)):
    """Require STUDENT role"""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required"
        )
    return current_user


async def require_restaurant(current_user: CurrentUser = Depends(get_current_user)):
    """Require RESTAURANT_OWNER role"""
    if current_user.role != UserRole.RESTAURANT_OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Restaurant owner access required"
        )
    return current_user


async def require_steward(current_user: CurrentUser = Depends(get_current_user)):
    """Require STEWARD role"""
    if current_user.role != UserRole.STEWARD:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Steward access required"
        )
    return current_user


async def require_admin(current_user: CurrentUser = Depends(get_current_user)):
    """Require ADMIN role"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


# CAS Authentication (for production)
def generate_cas_login_url(service_url: str = CAS_SERVICE_URL) -> str:
    """Generate CAS login URL"""
    return f"{CAS_SERVER_URL}/login?service={service_url}"


def validate_cas_ticket(ticket: str, service_url: str = CAS_SERVICE_URL) -> Optional[dict]:
    """
    Validate CAS ticket and return user info
    
    In production, this would make an HTTP request to CAS server:
    GET {CAS_SERVER_URL}/serviceValidate?ticket={ticket}&service={service_url}
    
    Returns: {"email": "student@ucdavis.edu", "name": "Student Name"}
    """
    # TODO: Implement actual CAS ticket validation
    # For now, this is a placeholder
    import httpx
    
    try:
        response = httpx.get(
            f"{CAS_SERVER_URL}/serviceValidate",
            params={"ticket": ticket, "service": service_url},
            timeout=10.0
        )
        
        if response.status_code == 200:
            # Parse CAS XML response
            # Extract user email and attributes
            # Return user info
            pass
    except Exception as e:
        print(f"CAS validation error: {e}")
        return None
    
    return None


def get_or_create_user_from_cas(cas_user_info: dict, db: Session) -> UserORM:
    """
    Get existing user or create new user from CAS authentication
    
    Assigns role based on email domain or ASUCD database lookup:
    - @ucdavis.edu → STUDENT (default)
    - ASUCD employee list → STEWARD or ADMIN
    - Restaurant owner list → RESTAURANT_OWNER
    """
    email = cas_user_info.get("email")
    name = cas_user_info.get("name", email.split("@")[0])
    
    # Check if user exists
    user = db.query(UserORM).filter(UserORM.email == email).first()
    
    if user:
        return user
    
    # Determine role (simplified logic)
    role = UserRole.STUDENT.value  # Default
    
    # TODO: Check ASUCD employee database
    # TODO: Check restaurant owner database
    
    # Create new user
    new_user = UserORM(
        email=email,
        name=name,
        role=role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


# ========== Google OAuth Functions ==========

async def verify_google_token(token: str) -> dict:
    """
    Verify Google ID token and extract user information
    
    Args:
        token: Google ID token from frontend
        
    Returns:
        dict with user info (email, name, picture)
        
    Raises:
        HTTPException if token is invalid
    """
    import httpx
    
    # Verify token with Google
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": token}
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google token"
            )
        
        token_info = response.json()
        
        # Verify audience (client ID)
        if GOOGLE_CLIENT_ID and token_info.get("aud") != GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token audience"
            )
        
        return {
            "email": token_info.get("email"),
            "name": token_info.get("name"),
            "picture": token_info.get("picture"),
            "email_verified": token_info.get("email_verified") == "true"
        }


def get_or_create_google_user(google_user_info: dict, db: Session) -> UserORM:
    """
    Get existing user or create new user from Google OAuth
    
    Assigns role based on email domain:
    - @ucdavis.edu → STUDENT (default)
    - Can be manually upgraded to other roles by admin
    """
    email = google_user_info.get("email")
    name = google_user_info.get("name", email.split("@")[0])
    
    if not google_user_info.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email not verified with Google"
        )
    
    # Check if user exists
    user = db.query(UserORM).filter(UserORM.email == email).first()
    
    if user:
        return user
    
    # Determine role based on email domain
    role = UserRole.STUDENT.value  # Default for all new users
    
    # Optionally restrict to UC Davis emails only
    if not email.endswith("@ucdavis.edu"):
        # For hackathon demo, allow all emails
        # For production, uncomment to restrict:
        # raise HTTPException(
        #     status_code=status.HTTP_403_FORBIDDEN,
        #     detail="Only UC Davis email addresses are allowed"
        # )
        pass
    
    # Create new user
    new_user = UserORM(
        email=email,
        name=name,
        role=role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user
