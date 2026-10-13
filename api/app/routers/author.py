from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.db.database import get_db
from app.models.models import User, AuthorProfile, Book
from app.schemas.schemas import BookResponse
from app.core.dependencies import require_author

router = APIRouter(prefix="/author", tags=["Author Operations"])

@router.get("/dashboard")
def get_author_dashboard(
    current_user: User = Depends(require_author),
    db: Session = Depends(get_db)
):
    profile = current_user.author_profile
    if not profile:
        raise HTTPException(status_code=404, detail="Author profile not found.")

    books = db.query(Book).filter(Book.author_profile_id == profile.id).all()

    total_sales = sum(b.total_copies_sold for b in books)
    total_royalty_earned = sum(b.total_royalty_earned for b in books)
    total_royalty_paid = sum(b.royalty_paid for b in books)
    total_royalty_pending = sum(b.royalty_pending for b in books)

    return {
        "author": {
            "name": current_user.name,
            "email": current_user.email,
            "author_id_code": profile.author_id_code,
            "phone": profile.phone,
            "city": profile.city,
            "joined_date": profile.joined_date,
            "bank_account_linked": profile.bank_account_linked
        },
        "metrics": {
            "total_books": len(books),
            "total_copies_sold": total_sales,
            "total_royalty_earned": total_royalty_earned,
            "total_royalty_paid": total_royalty_paid,
            "total_royalty_pending": total_royalty_pending,
            "meets_payout_threshold": total_royalty_pending >= 1000.0,
            "payout_threshold": 1000.0
        }
    }

@router.get("/books", response_model=List[BookResponse])
def get_author_books(
    current_user: User = Depends(require_author),
    db: Session = Depends(get_db)
):
    profile = current_user.author_profile
    if not profile:
        raise HTTPException(status_code=404, detail="Author profile not found.")

    books = db.query(Book).filter(Book.author_profile_id == profile.id).all()
    return books
