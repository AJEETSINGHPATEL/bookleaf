from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, JSON, Index
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="author")  # "author" or "admin"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    # Relationships
    author_profile = relationship("AuthorProfile", back_populates="user", uselist=False)
    created_tickets = relationship("Ticket", back_populates="creator", foreign_keys="Ticket.creator_id")
    assigned_tickets = relationship("Ticket", back_populates="assigned_to", foreign_keys="Ticket.assigned_to_id")
    messages = relationship("TicketMessage", back_populates="sender")
    internal_notes = relationship("InternalNote", back_populates="admin_user")

class AuthorProfile(Base):
    __tablename__ = "author_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    author_id_code = Column(String(50), unique=True, index=True, nullable=False)  # e.g., "AUTH001"
    phone = Column(String(50), nullable=True)
    city = Column(String(100), nullable=True)
    joined_date = Column(String(50), nullable=True)
    bank_account_linked = Column(Boolean, default=True)

    user = relationship("User", back_populates="author_profile")
    books = relationship("Book", back_populates="author")

class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    author_profile_id = Column(Integer, ForeignKey("author_profiles.id"), index=True, nullable=False)
    book_id_code = Column(String(50), unique=True, index=True, nullable=False)  # e.g., "BK001"
    title = Column(String(255), nullable=False)
    isbn = Column(String(50), nullable=False)
    genre = Column(String(100), nullable=False)
    publication_date = Column(String(50), nullable=True)
    status = Column(String(100), nullable=False)  # "Published & Live", "In Production - Typesetting", etc.
    mrp = Column(Float, default=0.0)
    author_royalty_per_copy = Column(Float, default=0.0)
    total_copies_sold = Column(Integer, default=0)
    total_royalty_earned = Column(Float, default=0.0)
    royalty_paid = Column(Float, default=0.0)
    royalty_pending = Column(Float, default=0.0)
    last_royalty_payout_date = Column(String(50), nullable=True)
    print_partner = Column(String(100), nullable=True)
    available_on = Column(JSON, default=list)  # list of strings e.g. ["Amazon India", "Flipkart"]

    author = relationship("AuthorProfile", back_populates="books")
    tickets = relationship("Ticket", back_populates="book")

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String(50), unique=True, index=True, nullable=False) # e.g. TIK-1001
    creator_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    book_id = Column(Integer, ForeignKey("books.id"), index=True, nullable=True) # nullable for General queries
    
    subject = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    attachment_name = Column(String(255), nullable=True)
    
    # AI-assisted classifications
    category = Column(String(100), index=True, nullable=False) 
    ai_predicted_category = Column(String(100), nullable=True)
    priority = Column(String(50), index=True, nullable=False, default="Medium") # Critical, High, Medium, Low
    ai_predicted_priority = Column(String(50), nullable=True)
    priority_reasoning = Column(Text, nullable=True)
    
    # Status lifecycle: Open -> In Progress -> Resolved -> Closed
    status = Column(String(50), index=True, nullable=False, default="Open")
    assigned_to_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    
    # AI response draft
    ai_draft_response = Column(Text, nullable=True)
    
    created_at = Column(DateTime, index=True, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        Index("ix_tickets_priority_created", "priority", "created_at"),
        Index("ix_tickets_status_priority", "status", "priority"),
    )

    # Relationships
    creator = relationship("User", back_populates="created_tickets", foreign_keys=[creator_id])
    assigned_to = relationship("User", back_populates="assigned_tickets", foreign_keys=[assigned_to_id])
    book = relationship("Book", back_populates="tickets")
    messages = relationship("TicketMessage", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketMessage.created_at")
    internal_notes = relationship("InternalNote", back_populates="ticket", cascade="all, delete-orphan", order_by="InternalNote.created_at")

class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), index=True, nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    is_admin_reply = Column(Boolean, default=False)
    created_at = Column(DateTime, index=True, default=utcnow)

    ticket = relationship("Ticket", back_populates="messages")
    sender = relationship("User", back_populates="messages")

class InternalNote(Base):
    __tablename__ = "internal_notes"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), index=True, nullable=False)
    admin_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    note = Column(Text, nullable=False)
    created_at = Column(DateTime, index=True, default=utcnow)

    ticket = relationship("Ticket", back_populates="internal_notes")
    admin_user = relationship("User", back_populates="internal_notes")
