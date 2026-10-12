import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token

client = TestClient(app)

def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

def test_login_success_and_failure():
    # Admin login
    res = client.post("/api/auth/login", json={"email": "admin@bookleaf.com", "password": "admin123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "admin"

    # Author login
    res_author = client.post("/api/auth/login", json={"email": "priya.sharma@email.com", "password": "author123"})
    assert res_author.status_code == 200
    author_data = res_author.json()
    assert author_data["user"]["role"] == "author"
    assert author_data["user"]["author_id_code"] == "AUTH001"

    # Invalid login
    res_bad = client.post("/api/auth/login", json={"email": "admin@bookleaf.com", "password": "wrongpassword"})
    assert res_bad.status_code == 401

def test_author_books_access_control():
    # Login as Priya
    res = client.post("/api/auth/login", json={"email": "priya.sharma@email.com", "password": "author123"})
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch books
    res_books = client.get("/api/author/books", headers=headers)
    assert res_books.status_code == 200
    books = res_books.json()
    assert len(books) == 2  # Priya has 2 books: Whispers of the Ganges, The Saffron Diaries

    # Check dashboard metrics
    res_dash = client.get("/api/author/dashboard", headers=headers)
    assert res_dash.status_code == 200
    dash = res_dash.json()
    assert dash["metrics"]["total_books"] == 2
    assert dash["metrics"]["total_royalty_pending"] == 3570.0

def test_admin_tickets_queue():
    # Login as Admin
    res = client.post("/api/auth/login", json={"email": "admin@bookleaf.com", "password": "admin123"})
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res_tickets = client.get("/api/admin/tickets", headers=headers)
    assert res_tickets.status_code == 200
    tickets = res_tickets.json()
    assert len(tickets) >= 2

def test_ticket_creation_and_ai_classification():
    # Author creates ticket
    res = client.post("/api/auth/login", json={"email": "priya.sharma@email.com", "password": "author123"})
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "subject": "Missing Royalty for previous two quarters",
        "description": "I have not received any royalty payout for the last 6 months even though my sales are steady. Can someone review my linked bank transfer?",
        "attachment_name": "bank_statement.pdf"
    }
    create_res = client.post("/api/tickets", json=payload, headers=headers)
    assert create_res.status_code == 201
    ticket = create_res.json()
    assert ticket["category"] == "Royalty & Payments"
    assert ticket["priority"] in ["High", "Critical"]
    assert ticket["ai_draft_response"] is not None
    assert "BookLeaf" in ticket["ai_draft_response"]
