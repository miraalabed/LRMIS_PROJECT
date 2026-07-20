from datetime import datetime, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from app.database import db

authorization_header = APIKeyHeader(name="Authorization", auto_error=False)

STAFF_ROLES = {"staff", "registrar", "surveyor", "manager", "admin"}
BACK_OFFICE_ROLES = {"staff", "registrar", "manager", "admin"}
MANAGEMENT_ROLES = {"manager", "admin"}
SURVEY_ROLES = {"surveyor", "manager", "admin"}
REGISTRAR_ROLES = {"registrar", "manager", "admin"}


def get_current_user(authorization: str = Depends(authorization_header)):
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must be Bearer <token>",
        )

    token_doc = db.api_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    expires_at = token_doc.get("expires_at")
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expired",
            )

    user = db.users.find_one({"_id": token_doc.get("user_id")})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user",
        )
    return {**user, **token_doc}


def require_roles(current_user, allowed_roles: set[str], detail: str):
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )
    return current_user


def user_has_role(current_user, allowed_roles: set[str]) -> bool:
    return current_user.get("role") in allowed_roles


def is_back_office(current_user) -> bool:
    return user_has_role(current_user, BACK_OFFICE_ROLES)


def is_management(current_user) -> bool:
    return user_has_role(current_user, MANAGEMENT_ROLES)


def require_staff(current_user=Depends(get_current_user)):
    return require_roles(current_user, STAFF_ROLES, "Staff access required")


def require_back_office(current_user=Depends(get_current_user)):
    return require_roles(current_user, BACK_OFFICE_ROLES, "Back-office access required")


def require_management(current_user=Depends(get_current_user)):
    return require_roles(current_user, MANAGEMENT_ROLES, "Manager or admin access required")


def require_surveyor(current_user=Depends(get_current_user)):
    return require_roles(current_user, SURVEY_ROLES, "Surveyor access required")


def require_registrar(current_user=Depends(get_current_user)):
    return require_roles(current_user, REGISTRAR_ROLES, "Registrar access required")


def require_applicant(current_user=Depends(get_current_user)):
    if current_user.get("role") != "applicant":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Applicant access required",
        )
    return current_user
