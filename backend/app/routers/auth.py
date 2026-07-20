from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from app.database import db
from app.services.audit_service import log_event
from app.utils.security import get_current_user
from bson import ObjectId
import secrets

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
PUBLIC_REGISTER_ROLES = {"applicant"}

router = APIRouter(prefix="/auth", tags=["auth"])


class TokenResponse(BaseModel):
    token: str
    expires_at: datetime


class LoginRequest(BaseModel):
    username: str = Field(...)
    password: str = Field(...)


class RegisterRequest(BaseModel):
    username: str = Field(...)
    password: str = Field(...)
    role: str = Field(...)
    linked_applicant_id: Optional[str] = None


class UserOut(BaseModel):
    id: str
    username: str
    role: str
    linked_applicant_id: Optional[str] = None


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest):
    if payload.role not in PUBLIC_REGISTER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public registration is limited to applicant accounts",
        )

    existing = db.users.find_one({"username": payload.username})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    if payload.linked_applicant_id:
        applicant = db.applicants.find_one({"_id": payload.linked_applicant_id})
        if not applicant:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Linked applicant not found")

    _id = str(ObjectId())
    now = datetime.now(timezone.utc)
    doc = {
        "_id": _id,
        "username": payload.username,
        "password": pwd_context.hash(payload.password),
        "role": payload.role,
        "linked_applicant_id": payload.linked_applicant_id,
        "created_at": now,
    }
    db.users.insert_one(doc)
    log_event("user_registered", user_id=_id, details={"username": doc["username"], "role": doc["role"], "linked_applicant_id": doc.get("linked_applicant_id")})
    return {
        "id": _id,
        "username": doc["username"],
        "role": doc["role"],
        "linked_applicant_id": doc.get("linked_applicant_id"),
    }


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    user = db.users.find_one({"username": payload.username})
    if not user or not user.get("password") or not pwd_context.verify(payload.password, user.get("password")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=8)
    db.api_tokens.insert_one({
        "_id": str(ObjectId()),
        "token": token,
        "user_id": user.get("_id"),
        "role": user.get("role"),
        "linked_applicant_id": user.get("linked_applicant_id"),
        "expires_at": expires_at,
        "created_at": now,
    })
    return {"token": token, "expires_at": expires_at}


@router.get("/me", response_model=UserOut)
def me(current_user=Depends(get_current_user)):
    return {
        "id": current_user.get("user_id") or current_user.get("_id"),
        "username": current_user.get("username"),
        "role": current_user.get("role"),
        "linked_applicant_id": current_user.get("linked_applicant_id"),
    }
