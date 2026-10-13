from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import asyncio
import random
from datetime import datetime

from app.db.database import get_db
from app.models.models import User, Ticket, TicketMessage, Book
from app.schemas.schemas import (
    TicketCreateRequest,
    TicketResponse,
    TicketMessageResponse,
    AddMessageRequest
)
from app.core.dependencies import get_current_user, require_author
from app.services.ai_service import analyze_ticket_with_ai
from app.services.sse_service import broadcaster

router = APIRouter(prefix="/tickets", tags=["Tickets (Author & Shared)"])

def format_ticket_response(ticket: Ticket) -> dict:
    return {
        "id": ticket.id,
        "ticket_number": ticket.ticket_number,
        "creator_id": ticket.creator_id,
        "creator_name": ticket.creator.name if ticket.creator else "Unknown",
        "creator_email": ticket.creator.email if ticket.creator else "Unknown",
        "book_id": ticket.book_id,
        "book_title": ticket.book.title if ticket.book else None,
        "book_isbn": ticket.book.isbn if ticket.book else None,
        "subject": ticket.subject,
        "description": ticket.description,
        "attachment_name": ticket.attachment_name,
        "category": ticket.category,
        "ai_predicted_category": ticket.ai_predicted_category,
        "priority": ticket.priority,
        "ai_predicted_priority": ticket.ai_predicted_priority,
        "priority_reasoning": ticket.priority_reasoning,
        "status": ticket.status,
        "assigned_to_id": ticket.assigned_to_id,
        "assigned_to_name": ticket.assigned_to.name if ticket.assigned_to else None,
        "ai_draft_response": ticket.ai_draft_response,
        "created_at": ticket.created_at,
        "updated_at": ticket.updated_at,
        "messages": [
            {
                "id": m.id,
                "ticket_id": m.ticket_id,
                "sender_id": m.sender_id,
                "sender_name": m.sender.name if m.sender else "Unknown",
                "sender_role": m.sender.role if m.sender else "author",
                "message": m.message,
                "is_admin_reply": m.is_admin_reply,
                "created_at": m.created_at
            }
            for m in ticket.messages
        ],
        "internal_notes": [
            {
                "id": n.id,
                "ticket_id": n.ticket_id,
                "admin_name": n.admin_user.name if n.admin_user else "Admin",
                "note": n.note,
                "created_at": n.created_at
            }
            for n in ticket.internal_notes
        ]
    }

@router.get("/stream")
async def sse_tickets_stream(
    request: Request,
    token: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Server-Sent Events endpoint to stream real-time updates securely to client portals.
    Authenticates subscriber via query param 'token' (EventSource compatibility) or Bearer header.
    """
    auth_header = request.headers.get("Authorization")
    raw_token = token
    if auth_header and auth_header.startswith("Bearer "):
        raw_token = auth_header.replace("Bearer ", "").strip()

    user_id = 0
    user_role = "author"

    if raw_token:
        from app.core.security import decode_access_token
        payload = decode_access_token(raw_token)
        if payload and payload.get("sub"):
            user_id = int(payload["sub"])
            user_role = payload.get("role", "author")

    subscriber = await broadcaster.subscribe(user_id=user_id, role=user_role)

    async def event_generator():
        try:
            # Send initial ping with connection confirmation
            yield "event: ping\ndata: {\"message\": \"connected\"}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(subscriber.queue.get(), timeout=20.0)
                    yield data
                except asyncio.TimeoutError:
                    # Heartbeat to keep connection alive
                    yield "event: heartbeat\ndata: {}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            broadcaster.unsubscribe(subscriber)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.post("", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    payload: TicketCreateRequest,
    current_user: User = Depends(require_author),
    db: Session = Depends(get_db)
):
    # Verify book if selected
    book_title = None
    book_status = None
    if payload.book_id:
        book = db.query(Book).filter(Book.id == payload.book_id).first()
        if not book or (book.author.user_id != current_user.id):
            raise HTTPException(status_code=400, detail="Invalid book selection for current author.")
        book_title = book.title
        book_status = book.status

    subject = payload.subject.strip()
    description = payload.description.strip()
    if not subject or not description:
        raise HTTPException(status_code=400, detail="Subject and description cannot be empty.")

    # Generate ticket number (e.g. TIK-3841)
    ticket_num = f"TIK-{random.randint(1000, 9999)}"

    # Run AI analysis (Category, Priority, Empathetic Draft)
    ai_result = await analyze_ticket_with_ai(
        author_name=current_user.name,
        subject=subject,
        description=description,
        book_title=book_title,
        book_status=book_status
    )

    ticket = Ticket(
        ticket_number=ticket_num,
        creator_id=current_user.id,
        book_id=payload.book_id,
        subject=subject,
        description=description,
        attachment_name=payload.attachment_name.strip() if payload.attachment_name else None,
        category=ai_result["category"],
        ai_predicted_category=ai_result["category"],
        priority=ai_result["priority"],
        ai_predicted_priority=ai_result["priority"],
        priority_reasoning=ai_result["priority_reasoning"],
        status="Open",
        ai_draft_response=ai_result["draft_response"]
    )
    db.add(ticket)
    db.flush()

    # Create initial message
    msg = TicketMessage(
        ticket_id=ticket.id,
        sender_id=current_user.id,
        message=payload.description,
        is_admin_reply=False
    )
    db.add(msg)
    db.commit()
    db.refresh(ticket)

    res = format_ticket_response(ticket)
    # Broadcast to admin and author clients
    await broadcaster.broadcast("ticket_created", {"ticket_id": ticket.id, "ticket_number": ticket.ticket_number})

    return res

@router.get("/my-tickets", response_model=List[TicketResponse])
def get_my_tickets(
    current_user: User = Depends(require_author),
    db: Session = Depends(get_db)
):
    tickets = db.query(Ticket).filter(Ticket.creator_id == current_user.id).order_by(Ticket.created_at.desc()).all()
    # Note: Authors should NOT see internal notes
    results = []
    for t in tickets:
        formatted = format_ticket_response(t)
        formatted["internal_notes"] = []  # Explicitly stripped for author
        results.append(formatted)
    return results

@router.get("/{ticket_id}", response_model=TicketResponse)
def get_ticket_details(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    # Role-based access control check
    if current_user.role == "author" and ticket.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied: Cannot view another author's ticket.")

    formatted = format_ticket_response(ticket)
    if current_user.role == "author":
        formatted["internal_notes"] = []  # Strip internal notes for author
    return formatted

@router.post("/{ticket_id}/messages", response_model=TicketMessageResponse)
async def post_ticket_message(
    ticket_id: int,
    payload: AddMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    if current_user.role == "author" and ticket.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to this ticket.")

    content = payload.message.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    is_admin = (current_user.role == "admin")
    msg = TicketMessage(
        ticket_id=ticket.id,
        sender_id=current_user.id,
        message=content,
        is_admin_reply=is_admin
    )
    db.add(msg)

    # If admin replies and ticket was Open, transition to In Progress or keep current
    if is_admin and ticket.status == "Open":
        ticket.status = "In Progress"

    db.commit()
    db.refresh(msg)

    msg_data = {
        "id": msg.id,
        "ticket_id": msg.ticket_id,
        "sender_id": msg.sender_id,
        "sender_name": current_user.name,
        "sender_role": current_user.role,
        "message": msg.message,
        "is_admin_reply": msg.is_admin_reply,
        "created_at": msg.created_at
    }

    # Broadcast event via SSE scoped to ticket creator and admins
    await broadcaster.broadcast("new_message", {"ticket_id": ticket.id, "message": msg_data}, target_user_id=ticket.creator_id)
    await broadcaster.broadcast("ticket_updated", {"ticket_id": ticket.id, "status": ticket.status, "action": "new_message"})

    return msg_data
