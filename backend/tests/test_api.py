import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.services.ai_service import (
    ALLOWED_CATEGORIES,
    ALLOWED_PRIORITIES,
    heuristic_classify_and_score,
    heuristic_draft_response
)

client = TestClient(app)

def get_author_token():
    res = client.post("/api/auth/login", json={"email": "priya.sharma@email.com", "password": "author123"})
    return res.json()["access_token"]

def get_admin_token():
    res = client.post("/api/auth/login", json={"email": "admin@bookleaf.com", "password": "admin123"})
    return res.json()["access_token"]

# 1. Health check
def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

# 2. Authentication: Login success & failure
def test_login_success_and_failure():
    # Admin login
    res = client.post("/api/auth/login", json={"email": "admin@bookleaf.com", "password": "admin123"})
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "admin"

    # Author login
    res_author = client.post("/api/auth/login", json={"email": "priya.sharma@email.com", "password": "author123"})
    assert res_author.status_code == 200
    assert res_author.json()["user"]["role"] == "author"

    # Invalid credentials
    res_bad = client.post("/api/auth/login", json={"email": "admin@bookleaf.com", "password": "badpassword"})
    assert res_bad.status_code == 401

# 3. RBAC: Author cannot access admin routes
def test_author_cannot_access_admin_endpoints():
    token = get_author_token()
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/admin/tickets", headers=headers)
    assert res.status_code == 403

# 4. RBAC: Author cannot access another author's tickets
def test_author_isolation():
    # Login as Priya
    priya_token = get_author_token()
    priya_headers = {"Authorization": f"Bearer {priya_token}"}
    priya_tickets = client.get("/api/tickets/my-tickets", headers=priya_headers).json()
    assert len(priya_tickets) > 0
    ticket_id = priya_tickets[0]["id"]

    # Login as Rohit
    rohit_res = client.post("/api/auth/login", json={"email": "rohit.kapoor@email.com", "password": "author123"})
    rohit_token = rohit_res.json()["access_token"]
    rohit_headers = {"Authorization": f"Bearer {rohit_token}"}

    # Rohit tries to view Priya's ticket
    res = client.get(f"/api/tickets/{ticket_id}", headers=rohit_headers)
    assert res.status_code == 403

# 5. Security: Internal notes are strictly hidden from authors
def test_internal_notes_hidden_from_author():
    admin_token = get_admin_token()
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Fetch admin ticket and get an id
    tickets = client.get("/api/admin/tickets", headers=admin_headers).json()
    ticket_id = tickets[0]["id"]

    # Admin adds internal note
    client.post(
        f"/api/admin/tickets/{ticket_id}/internal-notes",
        json={"note": "Confidential ops memo"},
        headers=admin_headers
    )

    # If ticket belongs to Priya, verify notes are stripped on author endpoint
    priya_token = get_author_token()
    priya_headers = {"Authorization": f"Bearer {priya_token}"}
    my_tix = client.get("/api/tickets/my-tickets", headers=priya_headers).json()
    for t in my_tix:
        assert len(t.get("internal_notes", [])) == 0

# 6. AI: Fallback classifier validates the 6 assignment categories
def test_ai_classification_categories():
    queries = [
        ("Royalty missing", "Where is my quarterly payout?", "Royalty & Payments"),
        ("Wrong ISBN", "My printed ISBN is different than online listing", "ISBN & Metadata Issues"),
        ("Misprinted pages", "Binding is broken and text blurry", "Printing & Quality"),
        ("Unavailable on Amazon", "Book says out of stock on platform", "Distribution & Availability"),
        ("Typesetting delay", "When will my proofreading be ready?", "Book Status & Production Updates"),
        ("Author blurb update", "How do I edit my description?", "General Inquiry")
    ]
    for subj, desc, expected_cat in queries:
        result = heuristic_classify_and_score(subj, desc)
        assert result["category"] in ALLOWED_CATEGORIES
        assert result["category"] == expected_cat

# 7. AI: Fallback priorities use valid levels
def test_ai_priority_levels():
    critical_res = heuristic_classify_and_score("Duplicate ISBN", "There is a wrong book duplicate ISBN on Amazon")
    assert critical_res["priority"] in ALLOWED_PRIORITIES
    assert critical_res["priority"] == "Critical"

    low_res = heuristic_classify_and_score("Production check", "When is typesetting done?")
    assert low_res["priority"] in ALLOWED_PRIORITIES

# 8. AI Graceful Degradation: Ticket creation succeeds when Gemini API fails
@patch("app.services.ai_service.call_gemini_api", side_effect=RuntimeError("Gemini 503 Unavailable"))
def test_ticket_creation_gemini_failure_fallback(mock_ai):
    token = get_author_token()
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "subject": "Urgent ISBN Mismatch",
        "description": "Amazon is displaying duplicate ISBN code for my title.",
        "attachment_name": "isbn_proof.png"
    }
    res = client.post("/api/tickets", json=payload, headers=headers)
    assert res.status_code == 201
    ticket = res.json()
    assert ticket["category"] == "ISBN & Metadata Issues"
    assert ticket["priority"] in ["High", "Critical"]
    assert ticket["ai_draft_response"] is not None

# 9. Admin Overrides: Status, Category, Priority persist
def test_admin_overrides_persist():
    admin_token = get_admin_token()
    headers = {"Authorization": f"Bearer {admin_token}"}
    tickets = client.get("/api/admin/tickets", headers=headers).json()
    ticket_id = tickets[0]["id"]

    override_payload = {
        "status": "In Progress",
        "category": "General Inquiry",
        "priority": "Low"
    }
    res = client.patch(f"/api/admin/tickets/{ticket_id}", json=override_payload, headers=headers)
    assert res.status_code == 200
    updated = res.json()
    assert updated["status"] == "In Progress"
    assert updated["category"] == "General Inquiry"
    assert updated["priority"] == "Low"

# 10. Admin Public Reply: Appears on thread
def test_admin_public_response():
    admin_token = get_admin_token()
    headers = {"Authorization": f"Bearer {admin_token}"}
    tickets = client.get("/api/admin/tickets", headers=headers).json()
    ticket_id = tickets[0]["id"]

    reply_payload = {"message": "Official resolution statement from ops lead."}
    res = client.post(f"/api/tickets/{ticket_id}/messages", json=reply_payload, headers=headers)
    assert res.status_code == 200
    msg = res.json()
    assert msg["is_admin_reply"] is True
    assert msg["message"] == "Official resolution statement from ops lead."

# 11. Edge-Case Data: In-production books render safely without error
def test_in_production_books_handling():
    # Login as Sneha Kulkarni (AUTH007 - has 'Midnight in Mysore' in production)
    res = client.post("/api/auth/login", json={"email": "sneha.kulkarni@email.com", "password": "author123"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    books = client.get("/api/author/books", headers=headers).json()
    assert len(books) > 0
    prod_book = next((b for b in books if "In Production" in b["status"]), None)
    assert prod_book is not None
    # Verify that null values did not crash and defaulted safely
    assert prod_book["mrp"] == 0.0
    assert prod_book["royalty_pending"] == 0.0
