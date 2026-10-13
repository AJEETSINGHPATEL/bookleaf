# 🍃 BookLeaf Publishing — Author Support & Communication Desk

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![AI Engine](https://img.shields.io/badge/AI%20Engine-Gemini%203.8%20Flash-FF6F00?logo=google&logoColor=white)](https://ai.google.dev)
[![Real--Time](https://img.shields.io/badge/Real--Time-SSE%20(Server--Sent%20Events)-brightgreen)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
[![Tests](https://img.shields.io/badge/Tests-11%2F11%20Passing-success)](file:///d:/bookleaf/backend/tests/test_api.py)

An enterprise-grade, full-stack author communication and operations portal engineered for **BookLeaf Publishing** to handle catalog scale (1,200+ monthly titles, 22,000+ catalog) with **zero-refresh real-time synchronization**, **strict role-based access control (RBAC)**, and **grounded AI response assistance**.

---

## 📑 Table of Contents
1. [Architecture Overview](#-architecture-overview)
2. [Real-Time Zero-Refresh Architecture](#-real-time-zero-refresh-architecture)
3. [Key Features](#-key-features)
4. [AI Copilot & Policy Grounding](#-ai-copilot--policy-grounding)
5. [Quick Start & Setup Guide](#-quick-start--setup-guide)
6. [Test Accounts Directory](#-test-accounts-directory)
7. [API Endpoint Specifications](#-api-endpoint-specifications)
8. [Automated Testing](#-automated-testing)
9. [Assignment PDF Compliance Checklist](#-assignment-pdf-compliance-checklist)

---

## 🏛️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (React 19 + Vite)                            │
│  - Clean Vanilla CSS Design System (BookLeaf Navy #1e3a8a, Emerald, Amber)       │
│  - Author Portal: Dashboard metrics, published books & edge cases, live chat     │
│  - Ops Admin Portal: Multi-filter queue, urgent-first sorting, AI copilot desk   │
│  - Real-Time Layer: EventSource (SSE) with auto-reconnect & gentle sync fallback │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ REST API + SSE Stream (/api)
┌────────────────────────────────────────┴─────────────────────────────────────────┐
│                             BACKEND (FastAPI + Python)                           │
│  - Layered Clean Architecture: Routers, Services, ORM Models, Schemas, Core Auth │
│  - Authentication: JWT Bearer Tokens + Strict Role-Based Access Control (RBAC)   │
│  - Real-Time SSE Broadcaster: Identity-scoped message queues with keep-alive     │
│  - Live Database: Supabase PostgreSQL via connection pooling (port 6543)        │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ Grounded Prompting + JSON Validation
┌────────────────────────────────────────┴─────────────────────────────────────────┐
│                   AI ENGINE (Google Gemini 3.8 Flash + Rule Engine)              │
│  - Grounded in BookLeaf Knowledge Base (80/20 royalty split, SLAs, print cycles) │
│  - 6-Category Ticket Classification & 4-Level Priority Scoring with Rationale    │
│  - Contextual AI Draft Response generation with admin manual override/editing    │
│  - Deterministic Zero-Outage Rule Engine fallback if Gemini API is unavailable   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Real-Time Zero-Refresh Architecture

The application implements instant real-time synchronization without requiring manual page refreshes:

```
[Author submits message / Admin solves ticket]
                    │
                    ▼
       FastAPI Endpoint Handlers
  (POST /tickets/.../messages or PATCH /admin/tickets/...)
                    │
                    ▼
     SSE Broadcaster (sse_service.py)
   Dispatches: "ticket_updated" & "new_message"
                    │
                    ▼
  Persistent EventSource Stream (App.jsx)
 (Scoped to authenticated subscriber JWT token)
                    │
                    ▼
          reloadSignal State Trigger
                    │
                    ├──► AdminPortal: Re-fetches operations queue & refreshes active ticket conversation
                    └──► AuthorPortal: Re-fetches author tickets & appends latest messages
```

### Key Real-Time Capabilities:
1. **Dynamic Token Attachment**: The SSE stream automatically connects and authenticates with the active user's JWT upon login and closes cleanly upon logout.
2. **Conversation Thread Refreshing**: When an author posts a message or an admin sends an official reply, the active discussion panel refreshes in sub-second time without interrupting active typing.
3. **Auto-Reconnect & Liveness Safeguard**: If network connectivity drops or the client tab wakes from sleep, the EventSource automatically reconnects with exponential backoff, supported by a 5-second gentle polling safeguard.
4. **Non-Blocking Toast System**: Replaced blocking modal `alert()` dialogs with sleek, non-blocking toast notification pills that auto-dismiss after 3.5 seconds.

---

## ✨ Key Features

### 1. 👤 Author Portal
* **Clean Authentication**: Secure email + password authentication. Zero hardcoded pre-fills or exposed credentials on the login screen.
* **My Books Catalog**:
  * Displays book title, ISBN, genre, publication date, and publication status.
  * Granular royalty analytics: MRP, author royalty per copy, copies sold, total royalties earned, royalty paid, and royalty pending.
  * **Edge-Case Resilience**: Seamlessly handles books in production (e.g. *Typesetting* or *Cover Design* where royalty and MRP are zero/not yet finalized).
* **Complaint & Ticket Submission**:
  * Optional attachment of ticket to a specific book from the author's catalog or general account-level inquiry.
  * Subject, description, and mock attachment support.
* **Live Support Timeline**:
  * Direct bidirectional conversation thread between the author and BookLeaf operations.
  * Authors view ticket statuses (`Open`, `In Progress`, `Resolved`, `Closed`).
  * **Strict Privacy Shield**: Internal ops notes and internal AI priority scores are completely hidden from authors.

### 2. 🛡️ Ops Admin Desk
* **Multi-Factor Filterable Queue**:
  * Filter simultaneously by **Status** (`Open`, `In Progress`, `Resolved`, `Closed`), **Category**, **Priority**, and **Created Date**.
  * **Urgent-First Sorting**: Critical and High priority tickets bubble to the top, ordered by oldest unresolved ticket first.
* **AI Ticket Triage & Classification**:
  * Automated categorization into 6 official BookLeaf categories.
  * Priority scoring (`Critical`, `High`, `Medium`, `Low`) accompanied by clear operational rationale.
  * **Admin Overrides**: Administrators can override category, priority, or status with immediate persistence.
* **AI-Drafted Response Copilot**:
  * Pre-drafts empathetic, policy-grounded replies citing exact BookLeaf turnaround timelines and financial guidelines.
  * Administrators can review, edit text inline, or provide custom prompt instructions to regenerate drafts.
  * 1-click **"Approve & Send to Author"** publishes the response directly into the author's conversation thread and marks the ticket as Resolved.
* **Self-Assignment & Internal Collaboration**:
  * 1-click self-assignment button assigns the ticket to the active administrator.
  * Internal notes thread visible **exclusively to administrators** for private team context.

---

## 🤖 AI Copilot & Policy Grounding

The AI engine is grounded in the official **BookLeaf Knowledge Base**:

| Policy Area | Grounded Rule / SLA |
| :--- | :--- |
| **Royalty Split** | 100% of author royalty per contract (typically 80/20 net model) |
| **Payout Cycle** | Quarterly payouts within 45 days of quarter close; minimum ₹1,000 threshold |
| **ISBN Registration** | Takes 7–10 business days; registered with Raja Rammohun Roy National Agency |
| **Printing Turnaround** | Print-on-Demand takes 5–7 business days; dispatched via standard courier |
| **Distribution Sync** | 24–48 hours for stock and metadata to reflect across Amazon and Flipkart |
| **Author Copies** | 10 complimentary author copies shipped within 14 days of title release |

### Zero-Outage Graceful Degradation
If the Google Gemini API encounters a rate limit, network timeout, or service interruption, the backend automatically transitions to the internal **BookLeaf Rule Engine**:
* Uses deterministic regex keyword weighting across all 6 categories.
* Accurately calculates priority level based on financial thresholds (pending royalties > ₹1,000) and legal terms.
* Generates an empathetic, policy-accurate draft response so the admin desk is never blocked.

---

## 🚀 Quick Start & Setup Guide

### Prerequisites
* **Python 3.10+**
* **Node.js 18+** and **npm**
* Active Internet connection (for live Supabase database pooling)

---

### Step 1: Clone and Configure Environment

```bash
git clone https://github.com/your-username/bookleaf.git
cd bookleaf
```

#### Backend Environment Configuration
Create or verify `backend/.env`:
```ini
PROJECT_NAME="BookLeaf Author Support & Communication Portal"
VERSION="1.0.0"
API_V1_STR="/api"
SECRET_KEY="bookleaf_ultra_secure_jwt_secret_key_2026_prod"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# PostgreSQL Connection URI (e.g. Supabase, Neon, or local PostgreSQL)
DATABASE_URL="postgresql://username:password@localhost:5432/bookleaf"

# Google Gemini AI Configuration
GEMINI_API_KEY="your_gemini_api_key_here"
GEMINI_MODEL="gemini-3.8-flash"
```

---

### Step 2: Start the Backend (FastAPI)

```bash
cd backend

# Create and activate virtual environment (Optional but recommended)
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Seed database directly from bookleaf_sample_data.json
# Automatically creates the Operations Admin and all 10 author accounts with their books & financial records
python -m app.db.seed

# Start Uvicorn development server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

> **FastAPI Interactive API Documentation:** Accessible at [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Step 3: Start the Frontend (React + Vite)

Open a new terminal window:

```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev -- --host 0.0.0.0 --port 5173
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🗄️ Dynamic Data Seeding & User Accounts

The platform dynamically seeds all real author and book data directly from [`bookleaf_sample_data.json`](./bookleaf_sample_data.json) into PostgreSQL without hardcoded or dummy placeholders:
- **Operations Admin:** Account created as `admin@bookleaf.com` with role `admin` for queue triage, ticket management, and approval workflows.
- **Author Accounts:** Created dynamically from each author record in [`bookleaf_sample_data.json`](./bookleaf_sample_data.json) (e.g., `priya.sharma@email.com`, `rohit.kapoor@email.com`, etc.), linking their complete bibliography, royalty balances, and active publishing status.
- **No Dummy Data:** All user accounts, books, and royalty calculations are fully relational and loaded directly into the configured database.

---

## 📡 API Endpoint Specifications

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticates email & password, returns JWT bearer token | Public |
| `GET` | `/api/auth/me` | Returns current user profile details | Authenticated |

### Author Desk (`/api/author`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/author/dashboard` | Summary metrics: total titles, copies sold, royalty breakdown | Author Only |
| `GET` | `/api/author/books` | Full book catalog with status, pricing, and sales data | Author Only |

### Ticket Management & Real-Time (`/api/tickets`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tickets/stream` | Server-Sent Events (SSE) real-time event subscription | Authenticated |
| `POST` | `/api/tickets` | Creates a ticket, triggers AI classification and draft | Author Only |
| `GET` | `/api/tickets/my-tickets` | List current author's tickets (internal notes stripped) | Author Only |
| `GET` | `/api/tickets/{id}` | Detailed ticket conversation thread | Scoped by Role |
| `POST` | `/api/tickets/{id}/messages` | Post a new reply message in ticket thread | Ticket Owner / Admin |

### Operations Desk (`/api/admin`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/tickets` | Multi-filter ticket queue (`status`, `category`, `priority`, `date`, `sort`) | Admin Only |
| `PATCH` | `/api/admin/tickets/{id}` | Override status, category, priority, or assignee | Admin Only |
| `POST` | `/api/admin/tickets/{id}/assign-self` | Assign ticket to the logged-in administrator | Admin Only |
| `POST` | `/api/admin/tickets/{id}/internal-notes` | Add internal collaboration note | Admin Only |
| `POST` | `/api/admin/tickets/{id}/regenerate-draft`| Re-run AI draft with custom prompt instructions | Admin Only |

---

## 🧪 Automated Testing

The backend includes a comprehensive `pytest` test suite:

```bash
cd backend
python -m pytest tests/test_api.py -v
```

### Test Suite Coverage:
1. `test_health_check`: Validates API availability and database connectivity.
2. `test_login_success_and_failure`: Checks JWT issuance and 401 unauthorized handling.
3. `test_author_cannot_access_admin_endpoints`: Asserts 403 Forbidden for authors accessing admin routes.
4. `test_author_isolation`: Confirms authors cannot view or retrieve another author's tickets.
5. `test_internal_notes_hidden_from_author`: Guarantees private notes are never sent in author payloads.
6. `test_ai_classification_categories`: Validates the 6 required categories.
7. `test_ai_priority_levels`: Validates 4 priority tiers (`Critical`, `High`, `Medium`, `Low`).
8. `test_ticket_creation_gemini_failure_fallback`: Validates heuristic rule engine fallback resilience.
9. `test_admin_overrides_persist`: Confirms category/priority manual overrides persist to the DB.
10. `test_admin_public_response`: Validates admin draft approval, message dispatch, and status update.
11. `test_in_production_books_handling`: Verifies edge cases for books with zero sales in production.

---

## 📋 Assignment PDF Compliance Checklist

| Requirement | Implementation Status | Evidence in Codebase |
| :--- | :---: | :--- |
| **Author Portal: My Books & Royalties** |  Complete | [AuthorPortal.jsx](file:///d:/bookleaf/frontend/src/components/AuthorPortal.jsx#L140-L240), [author.py](file:///d:/bookleaf/backend/app/routers/author.py#L30-L50) |
| **Author Portal: Ticket Submission + Mock Attachment** |  Complete | [AuthorPortal.jsx](file:///d:/bookleaf/frontend/src/components/AuthorPortal.jsx#L280-L380), [tickets.py](file:///d:/bookleaf/backend/app/routers/tickets.py#L127-L189) |
| **Real-Time Ticket Updates without Manual Refresh** |  Complete | [App.jsx](file:///d:/bookleaf/frontend/src/App.jsx#L14-L60), [sse_service.py](file:///d:/bookleaf/backend/app/services/sse_service.py) |
| **Ops Admin: Multi-Filter Queue (Status, Category, Priority, Date)** |  Complete | [AdminPortal.jsx](file:///d:/bookleaf/frontend/src/components/AdminPortal.jsx#L210-L288), [admin.py](file:///d:/bookleaf/backend/app/routers/admin.py#L22-L80) |
| **Ops Admin: Smart Sorting (Urgent First)** |  Complete | [admin.py](file:///d:/bookleaf/backend/app/routers/admin.py#L68-L75) |
| **AI Auto-Classification (6 Specific Categories)** |  Complete | [ai_service.py](file:///d:/bookleaf/backend/app/services/ai_service.py#L20-L40), [test_api.py](file:///d:/bookleaf/backend/tests/test_api.py#L115-L135) |
| **AI Priority Scoring with Rationale** |  Complete | [ai_service.py](file:///d:/bookleaf/backend/app/services/ai_service.py#L42-L75) |
| **AI-Drafted Responses Grounded in Knowledge Base** |  Complete | [ai_service.py](file:///d:/bookleaf/backend/app/services/ai_service.py#L90-L160) |
| **Admin Overrides for Category, Priority & Draft Editing** |  Complete | [AdminPortal.jsx](file:///d:/bookleaf/frontend/src/components/AdminPortal.jsx#L110-L160), [admin.py](file:///d:/bookleaf/backend/app/routers/admin.py#L81-L113) |
| **Internal Notes Strictly Shielded from Authors** |  Complete | [tickets.py](file:///d:/bookleaf/backend/app/routers/tickets.py#L200-L220), [test_api.py](file:///d:/bookleaf/backend/tests/test_api.py#L100-L114) |
| **Production-Ready Clean Login (No Auto-Fill, No Leaked Hints)** |  Complete | [Login.jsx](file:///d:/bookleaf/frontend/src/components/Login.jsx#L5-L10) |
| **Live Database Seed with Exact 10 Authors & 18 Books** |  Complete | [seed.py](file:///d:/bookleaf/backend/app/db/seed.py), Supabase PostgreSQL Pooler |

---

*Engineered with precision for the BookLeaf Publishing Technical Evaluation.*
