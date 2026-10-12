from datetime import datetime, timedelta, timezone
from typing import Optional, Union, Any
from jose import jwt, JWTError
import hashlib
from app.core.config import settings

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    try:
        return pwd_context.hash(password)
    except Exception:
        # Fallback to salted sha256 if native bcrypt runtime fails
        salt = "bookleaf_salt_2026_"
        return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash, with backwards-compatibility for salted sha256."""
    if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$"):
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            pass
    # Legacy salted sha256 verification
    salt = "bookleaf_salt_2026_"
    legacy_hash = hashlib.sha256((salt + plain_password).encode("utf-8")).hexdigest()
    return legacy_hash == hashed_password

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None
