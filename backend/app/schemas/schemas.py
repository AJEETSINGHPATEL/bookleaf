from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime

# --- Auth Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str
    user: "UserResponse"

class LoginRequest(BaseModel):
    email: str
    password: str

# --- User & Profile Schemas ---
class UserBase(BaseModel):
    email: str
    name: str
    role: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    author_id_code: Optional[str] = None

    class Config:
        from_attributes = True

# --- Book Schemas ---
class BookResponse(BaseModel):
    id: int
    book_id_code: str
    title: str
    isbn: str
    genre: str
    publication_date: Optional[str] = None
    status: str
    mrp: float
    author_royalty_per_copy: float
    total_copies_sold: int
    total_royalty_earned: float
    royalty_paid: float
    royalty_pending: float
    last_royalty_payout_date: Optional[str] = None
    print_partner: Optional[str] = None
    available_on: List[str] = []

    class Config:
        from_attributes = True

# --- Ticket & Message Schemas ---
class TicketMessageResponse(BaseModel):
    id: int
    ticket_id: int
    sender_id: int
    sender_name: str
    sender_role: str
    message: str
    is_admin_reply: bool
    created_at: datetime

    class Config:
        from_attributes = True

class InternalNoteResponse(BaseModel):
    id: int
    ticket_id: int
    admin_name: str
    note: str
    created_at: datetime

    class Config:
        from_attributes = True

class TicketCreateRequest(BaseModel):
    book_id: Optional[int] = None
    subject: str
    description: str
    attachment_name: Optional[str] = None

class TicketResponse(BaseModel):
    id: int
    ticket_number: str
    creator_id: int
    creator_name: str
    creator_email: str
    book_id: Optional[int] = None
    book_title: Optional[str] = None
    book_isbn: Optional[str] = None
    subject: str
    description: str
    attachment_name: Optional[str] = None
    category: str
    ai_predicted_category: Optional[str] = None
    priority: str
    ai_predicted_priority: Optional[str] = None
    priority_reasoning: Optional[str] = None
    status: str
    assigned_to_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    ai_draft_response: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    messages: List[TicketMessageResponse] = []
    internal_notes: List[InternalNoteResponse] = []

    class Config:
        from_attributes = True

class TicketUpdateAdminRequest(BaseModel):
    status: Optional[str] = None # Open, In Progress, Resolved, Closed
    category: Optional[str] = None
    priority: Optional[str] = None
    assigned_to_id: Optional[int] = None

class AddMessageRequest(BaseModel):
    message: str

class AddInternalNoteRequest(BaseModel):
    note: str

class RegenerateDraftRequest(BaseModel):
    instructions: Optional[str] = None
