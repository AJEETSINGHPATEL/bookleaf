from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import User, AuthorProfile
from app.schemas.schemas import LoginRequest, Token, UserResponse
from app.core.security import verify_password, create_access_token
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email.ilike(request.email.strip())).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Contact support."
        )

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role, "email": user.email})

    author_code = user.author_profile.author_id_code if user.author_profile else None
    user_response = UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        author_id_code=author_code
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    author_code = current_user.author_profile.author_id_code if current_user.author_profile else None
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        author_id_code=author_code
    )

@router.get("/demo-users")
def get_demo_users(db: Session = Depends(get_db)):
    """
    Convenience endpoint for live demo reviewers to easily select and switch test accounts.
    """
    users = db.query(User).all()
    res = []
    for u in users:
        author_code = u.author_profile.author_id_code if u.author_profile else None
        res.append({
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "role": u.role,
            "author_id_code": author_code,
            "default_password": "admin123" if u.role == "admin" else "author123"
        })
    return res
