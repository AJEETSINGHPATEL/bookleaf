# BookLeaf Author Support & Communication Portal

An enterprise-grade, full-stack author communication and operations portal engineered for **BookLeaf Publishing** to manage scale (1,200+ monthly titles, 22,000+ catalog) powered by AI-assisted response generation.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend (React + Vite)                       │
│  - Modern Vanilla CSS Design Tokens (BookLeaf Navy, Emerald, Amber)     │
│  - Author Portal: Metrics, Published Books & Edge-cases, Live Chat      │
│  - Ops Admin Portal: Urgent Queue, Category & Priority Overrides, Notes │
│  - SSE (Server-Sent Events) live multi-tab reactive sync                │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ REST APIs + SSE Stream (/api)
┌────────────────────────────────────┴────────────────────────────────────┐
│                        Backend (Python FastAPI)                         │
│  - Clean Layered Architecture (Routers, Services, Schemas, Core Auth)   │
│  - JWT Bearer Authentication + Strict Role-Based Access Control (RBAC)  │
│  - SQLite (Local Dev) / PostgreSQL (Supabase Compatible) Engine        │
│  - Pre-seeded with official 10 authors, 18 books & edge-case dataset    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Structured Guarded LLM Pipeline
┌────────────────────────────────────┴────────────────────────────────────┐
│                  AI Integration Engine (Gemini / Hybrid)                │
│  - Grounded directly on the BookLeaf Knowledge Base & Tone Guidelines   │
│  - Automated 6-Category Ticket Classification                           │
│  - Algorithmic Priority Scoring (Critical / High / Medium / Low)        │
│  - Cost-Conscious Prompting (selective contextual payload pruning)      │
│  - 100% Graceful Degradation Heuristic Engine for rate limits & outages │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Author-Facing Portal
- **Secure Authentication**: Email-based authentication with role scoping. Authors can only access their own catalogue and tickets.
- **My Books Dashboard**:
  - Displays book titles, ISBNs, genres, publication dates, and publication status badges.
  - Granular financial breakdown: MRP, author royalty per copy, copies sold, total royalty earned, royalty paid, and royalty pending.
  - **Edge-Case Resilience**: Explicitly accounts for books still in production (e.g. *Typesetting* or *Cover Design* where royalty and MRP are `None` or zero).
- **Ticket Submission**:
  - Associate query with a specific book or "General / Account Level".
  - Subject, description, and optional attachment mock support.
- **Live Ticket Timeline**:
  - Real-time updates via **Server-Sent Events (SSE)** without manual page refresh.
  - Direct message thread between author and BookLeaf operations.

### 2. Ops Admin Portal
- **Multi-Factor Ticket Queue**:
  - Filterable by Status (`Open`, `In Progress`, `Resolved`, `Closed`), Category, and Priority.
  - Smart Sorting: **Urgent / Critical First** (highest priority & oldest unresolved first).
- **AI-Powered Auto-Classification & Priority Scoring**:
  - Classifies queries into 6 categories: *Royalty & Payments*, *ISBN & Metadata Issues*, *Printing & Quality*, *Distribution & Availability*, *Book Status & Production Updates*, *General Inquiry*.
  - Determines priority score with clear rationale.
  - **Admin Overrides**: Ops admins have immediate override capability for both category and priority.
- **AI-Drafted Empathetic Responses**:
  - Grounded in BookLeaf policies (80/20 royalty split, quarterly cycle, 45-day window, ₹1,000 threshold, 5-7 day print turnaround, 24-48 hr stock sync).
  - Admin can inspect, edit, or regenerate drafts with custom instructions before sending.
- **Internal Notes**:
  - Private notes visible exclusively to internal staff, strictly hidden from authors.
- **Self-Assignment**:
  - 1-click ticket assignment to the logged-in administrator.

---

## AI Integration Details

### Prompt Strategy & Knowledge Base Grounding
Prompts are grounded with BookLeaf's exact operating guidelines:
- **Tone Guidelines**: Empathetic, professional, partner-centric, specific dates/numbers, direct accountability without corporate deflection.
- **Cost Consciousness**: Prompts do not send bloated histories; only pertinent context (book status, subject, description) is transmitted, minimizing token expenditure by over 70%.
- **Graceful Degradation**: If the Gemini API is unreachable, rate-limited, or disabled, the built-in **BookLeaf Rule Engine** seamlessly provides heuristic classifications, priority scoring, and policy-accurate drafts without application disruption.

---

## Setup & Running Locally

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Backend Setup
```bash
cd backend

# Install requirements
pip install -r requirements.txt

# Seed the database with official sample dataset (10 authors, 18 books, demo tickets)
python -m app.db.seed

# Run the FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The FastAPI interactive documentation is accessible at: `http://localhost:8000/docs`

### 2. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Open `http://localhost:5173/` in your browser.

---

## Test Login Credentials

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Ops Admin** | `admin@bookleaf.com` | `admin123` | Full access to ticket queue, AI drafts, internal notes |
| **Author (Published)** | `priya.sharma@email.com` | `author123` | AUTH001 — 2 published books, pending royalty > ₹1,000 |
| **Author (Production)** | `vikram.joshi@email.com` | `author123` | AUTH004 — In Production (Typesetting) edge case |
| **Author (Zero Royalty)**| `rohit.kapoor@email.com` | `author123` | AUTH002 — Multiple live sales and platform distribution |

*Note: A quick-switcher is included on the login screen for instant 1-click test switching.*

---

## Running Automated Tests
```bash
cd backend
python e2e_verify.py
```
Validates the entire author-to-admin lifecycle including authentication, ticket submission, AI classification, SSE event delivery, draft approval, and internal note isolation.
