import os
import json
from sqlalchemy.orm import Session
from app.db.database import SessionLocal, engine, Base
from app.models.models import User, AuthorProfile, Book, Ticket, TicketMessage, InternalNote
from app.core.security import hash_password

def seed_database():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    
    try:
        # Check if already seeded
        admin_user = db.query(User).filter(User.email == "admin@bookleaf.com").first()
        if admin_user:
            print("Database already contains records. Verifying seed count...")
            user_count = db.query(User).count()
            book_count = db.query(Book).count()
            print(f"Current database has {user_count} users and {book_count} books.")
            return

        print("Seeding BookLeaf Database with initial sample dataset...")

        # 1. Create Default Admin user
        admin = User(
            email="admin@bookleaf.com",
            name="BookLeaf Ops Admin",
            hashed_password=hash_password("admin123"),
            role="admin",
            is_active=True
        )
        db.add(admin)
        db.flush()

        # 2. Load bookleaf_sample_data.json
        json_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "bookleaf_sample_data.json")
        if not os.path.exists(json_path):
            json_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "bookleaf_sample_data.json")

        if os.path.exists(json_path):
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            for author_data in data.get("authors", []):
                # Standard default password for all authors is author123
                author_user = User(
                    email=author_data["email"],
                    name=author_data["name"],
                    hashed_password=hash_password("author123"),
                    role="author",
                    is_active=True
                )
                db.add(author_user)
                db.flush()

                author_profile = AuthorProfile(
                    user_id=author_user.id,
                    author_id_code=author_data["author_id"],
                    phone=author_data.get("phone"),
                    city=author_data.get("city"),
                    joined_date=author_data.get("joined_date"),
                    bank_account_linked=True
                )
                db.add(author_profile)
                db.flush()

                for book_data in author_data.get("books", []):
                    def safe_float(val, default=0.0):
                        return float(val) if val is not None else default

                    def safe_int(val, default=0):
                        return int(val) if val is not None else default

                    book = Book(
                        author_profile_id=author_profile.id,
                        book_id_code=book_data["book_id"],
                        title=book_data["title"],
                        isbn=book_data["isbn"],
                        genre=book_data["genre"],
                        publication_date=book_data.get("publication_date"),
                        status=book_data["status"],
                        mrp=safe_float(book_data.get("mrp"), 0.0),
                        author_royalty_per_copy=safe_float(book_data.get("author_royalty_per_copy"), 0.0),
                        total_copies_sold=safe_int(book_data.get("total_copies_sold"), 0),
                        total_royalty_earned=safe_float(book_data.get("total_royalty_earned"), 0.0),
                        royalty_paid=safe_float(book_data.get("royalty_paid"), 0.0),
                        royalty_pending=safe_float(book_data.get("royalty_pending"), 0.0),
                        last_royalty_payout_date=book_data.get("last_royalty_payout_date"),
                        print_partner=book_data.get("print_partner"),
                        available_on=book_data.get("available_on") or []
                    )
                    db.add(book)

            db.commit()
            print("Successfully seeded 10 Authors, 18 Books, and Admin account!")
            
            # 3. Add 2 initial demo tickets representing realistic seed cases
            # Sample ticket 1: Royalty inquiry from Priya Sharma
            priya_user = db.query(User).filter(User.email == "priya.sharma@email.com").first()
            whispers_book = db.query(Book).filter(Book.book_id_code == "BK001").first()
            if priya_user and whispers_book:
                t1 = Ticket(
                    ticket_number="TIK-1001",
                    creator_id=priya_user.id,
                    book_id=whispers_book.id,
                    subject="Pending royalty payout clarification for Whispers of the Ganges",
                    description="I see a pending royalty of ₹3,570 on my dashboard for Q4. When is the next scheduled bank transfer payout?",
                    category="Royalty & Payments",
                    ai_predicted_category="Royalty & Payments",
                    priority="High",
                    ai_predicted_priority="High",
                    priority_reasoning="Author is inquiring about pending royalty balance above payout threshold.",
                    status="Open",
                    ai_draft_response=(
                        "Dear Priya,\n\n"
                        "Thank you for contacting BookLeaf author support. We appreciate your patience!\n\n"
                        "We have reviewed your account for 'Whispers of the Ganges' (ISBN: 978-93-5XXXX-01-1). "
                        "Your current pending royalty is ₹3,570, which comfortably exceeds our ₹1,000 threshold. "
                        "BookLeaf calculates royalties quarterly with payouts processed within 45 days of the quarter ending. "
                        "Your payout is currently queued for the upcoming cycle and will be wired directly to your registered bank account.\n\n"
                        "Please let us know if you need a detailed line-by-line statement.\n\n"
                        "Warm regards,\nBookLeaf Author Support Team"
                    )
                )
                db.add(t1)
                db.flush()
                msg1 = TicketMessage(
                    ticket_id=t1.id,
                    sender_id=priya_user.id,
                    message="I see a pending royalty of ₹3,570 on my dashboard for Q4. When is the next scheduled bank transfer payout?",
                    is_admin_reply=False
                )
                db.add(msg1)

                # Sample ticket 2: Production update inquiry for in-production book (Vikram Joshi)
                vikram_user = db.query(User).filter(User.email == "vikram.joshi@email.com").first()
                if vikram_user and vikram_user.author_profile:
                    vikram_book = db.query(Book).filter(Book.author_profile_id == vikram_user.author_profile.id).first()
                    t2 = Ticket(
                        ticket_number="TIK-1002",
                        creator_id=vikram_user.id,
                        book_id=vikram_book.id if vikram_book else None,
                        subject="Status update on typesetting progress",
                        description="My manuscript has been in the typesetting stage for over 2 weeks. Could you provide an update on when proofs will be shared?",
                        category="Book Status & Production Updates",
                        ai_predicted_category="Book Status & Production Updates",
                        priority="Medium",
                        ai_predicted_priority="Medium",
                        priority_reasoning="Standard production timeline inquiry regarding typesetting milestone.",
                        status="In Progress",
                        assigned_to_id=admin.id,
                        ai_draft_response=(
                            "Dear Vikram,\n\n"
                            "Thank you for reaching out regarding the production timeline of your book. "
                            "We are currently finalizing the interior interior typesetting and formatting at our Delhi production desk. "
                            "You can expect your initial proof copy within 3-4 business days for review and approval.\n\n"
                            "We will email the proof PDF to you as soon as it passes our formatting checks.\n\n"
                            "Warm regards,\nBookLeaf Production Team"
                        )
                    )
                    db.add(t2)
                    db.flush()
                    msg2 = TicketMessage(
                        ticket_id=t2.id,
                        sender_id=vikram_user.id,
                        message="My manuscript has been in the typesetting stage for over 2 weeks. Could you provide an update on when proofs will be shared?",
                        is_admin_reply=False
                    )
                    note2 = InternalNote(
                        ticket_id=t2.id,
                        admin_user_id=admin.id,
                        note="Assigned to typesetting lead Rohan. Expected proof export by Wednesday."
                    )
                    db.add_all([msg2, note2])

            db.commit()
            print("Initial sample tickets seeded successfully!")

        else:
            print(f"Warning: {json_path} not found.")

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
