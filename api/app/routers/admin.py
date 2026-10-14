from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, asc, case, func
from typing import List, Optional

from app.db.database import get_db
from app.models.models import User, Ticket, InternalNote, TicketMessage
from app.schemas.schemas import (
    TicketResponse,
    TicketUpdateAdminRequest,
    InternalNoteResponse,
    AddInternalNoteRequest,
    RegenerateDraftRequest
)
from app.core.dependencies import require_admin
from app.routers.tickets import format_ticket_response
from app.services.ai_service import generate_refined_draft
from app.services.sse_service import broadcaster

router = APIRouter(prefix="/admin", tags=["Admin Operations"])

@router.get("/stats")
def get_admin_dashboard_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Returns aggregated operations statistics for the admin dashboard.
    Executes fast indexed count aggregations.
    """
    total_tickets = db.query(func.count(Ticket.id)).scalar() or 0
    open_tickets = db.query(func.count(Ticket.id)).filter(Ticket.status == "Open").scalar() or 0
    in_progress = db.query(func.count(Ticket.id)).filter(Ticket.status == "In Progress").scalar() or 0
    urgent_tickets = db.query(func.count(Ticket.id)).filter(Ticket.priority.in_(["Critical", "High"])).scalar() or 0
    resolved_tickets = db.query(func.count(Ticket.id)).filter(Ticket.status == "Resolved").scalar() or 0

    return {
        "total_tickets": total_tickets,
        "open_tickets": open_tickets,
        "in_progress": in_progress,
        "urgent_tickets": urgent_tickets,
        "resolved_tickets": resolved_tickets
    }

@router.get("/tickets", response_model=List[TicketResponse])
def get_admin_ticket_queue(
    status_filter: Optional[str] = Query(None, alias="status"),
    category_filter: Optional[str] = Query(None, alias="category"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    date_from: Optional[str] = Query(None, alias="date_from"),
    date_to: Optional[str] = Query(None, alias="date_to"),
    sort_by: Optional[str] = Query("urgent_first", alias="sort"),
    limit: Optional[int] = Query(50, ge=1, le=200),
    offset: Optional[int] = Query(0, ge=0),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    # Eager load related entities to eliminate N+1 round-trip queries
    query = db.query(Ticket).options(
        joinedload(Ticket.creator),
        joinedload(Ticket.book),
        joinedload(Ticket.assigned_to)
    )

    if status_filter and status_filter.lower() != "all":
        if status_filter.lower() in ["open", "open queue"]:
            query = query.filter(Ticket.status == "Open")
        elif status_filter.lower() in ["in progress", "in_progress"]:
            query = query.filter(Ticket.status == "In Progress")
        elif status_filter.lower() in ["resolved"]:
            query = query.filter(Ticket.status == "Resolved")
        elif status_filter.lower() in ["closed"]:
            query = query.filter(Ticket.status == "Closed")
        else:
            query = query.filter(Ticket.status == status_filter)

    if category_filter and category_filter.lower() != "all":
        query = query.filter(Ticket.category == category_filter)

    if priority_filter and priority_filter.lower() != "all":
        if priority_filter.lower() in ["urgent", "urgent / critical", "urgent/critical", "critical,high"]:
            query = query.filter(Ticket.priority.in_(["Critical", "High"]))
        else:
            query = query.filter(Ticket.priority == priority_filter)

    # Date range filtering (ISO format e.g. YYYY-MM-DD)
    if date_from:
        try:
            from datetime import datetime
            df = datetime.fromisoformat(date_from)
            query = query.filter(Ticket.created_at >= df)
        except Exception:
            pass

    if date_to:
        try:
            from datetime import datetime, time
            dt = datetime.combine(datetime.fromisoformat(date_to).date(), time.max)
            query = query.filter(Ticket.created_at <= dt)
        except Exception:
            pass

    # SQL-level sorting
    if sort_by == "urgent_first":
        priority_rank = case(
            (Ticket.priority == "Critical", 1),
            (Ticket.priority == "High", 2),
            (Ticket.priority == "Medium", 3),
            (Ticket.priority == "Low", 4),
            else_=5
        )
        query = query.order_by(priority_rank.asc(), Ticket.created_at.asc())
    elif sort_by == "oldest":
        query = query.order_by(Ticket.created_at.asc())
    else:  # newest
        query = query.order_by(Ticket.created_at.desc())

    # SQL-level pagination window
    paginated_tickets = query.offset(offset).limit(limit).all()

    # Omit heavy child collections in list view to avoid N+1 queries
    return [format_ticket_response(t, include_details=False) for t in paginated_tickets]

@router.patch("/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket_admin(
    ticket_id: int,
    payload: TicketUpdateAdminRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    if payload.status:
        ticket.status = payload.status
    if payload.category:
        ticket.category = payload.category
    if payload.priority:
        ticket.priority = payload.priority
    if payload.assigned_to_id is not None:
        if payload.assigned_to_id == 0:
            ticket.assigned_to_id = None
        else:
            assignee = db.query(User).filter(User.id == payload.assigned_to_id, User.role == "admin").first()
            if not assignee:
                raise HTTPException(status_code=400, detail="Invalid admin user assignment.")
            ticket.assigned_to_id = assignee.id

    db.commit()
    db.refresh(ticket)

    res = format_ticket_response(ticket)
    await broadcaster.broadcast("ticket_updated", {"ticket_id": ticket.id, "status": ticket.status})
    return res

@router.post("/tickets/{ticket_id}/assign-self", response_model=TicketResponse)
async def assign_ticket_to_self(
    ticket_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    ticket.assigned_to_id = current_user.id
    if ticket.status == "Open":
        ticket.status = "In Progress"

    db.commit()
    db.refresh(ticket)

    res = format_ticket_response(ticket)
    await broadcaster.broadcast("ticket_updated", {"ticket_id": ticket.id, "assigned_to": current_user.name})
    return res

@router.post("/tickets/{ticket_id}/internal-notes", response_model=InternalNoteResponse)
async def add_internal_note(
    ticket_id: int,
    payload: AddInternalNoteRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    note_content = payload.note.strip()
    if not note_content:
        raise HTTPException(status_code=400, detail="Note content cannot be empty.")

    note = InternalNote(
        ticket_id=ticket.id,
        admin_user_id=current_user.id,
        note=note_content
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    await broadcaster.broadcast("ticket_updated", {"ticket_id": ticket.id, "action": "internal_note"})

    return InternalNoteResponse(
        id=note.id,
        ticket_id=note.ticket_id,
        admin_name=current_user.name,
        note=note.note,
        created_at=note.created_at
    )

@router.post("/tickets/{ticket_id}/regenerate-draft")
async def regenerate_ticket_draft(
    ticket_id: int,
    payload: RegenerateDraftRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    author_name = ticket.creator.name if ticket.creator else "Author"
    book_title = ticket.book.title if ticket.book else None

    draft = await generate_refined_draft(
        author_name=author_name,
        subject=ticket.subject,
        description=ticket.description,
        book_title=book_title,
        category=ticket.category,
        custom_instructions=payload.instructions
    )

    ticket.ai_draft_response = draft
    db.commit()

    return {"draft_response": draft}
