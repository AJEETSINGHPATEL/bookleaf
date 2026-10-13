import sys
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Ensure backend directory is in sys.path for Vercel Serverless runtime
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.db.database import engine, Base
from app.db.seed import seed_database
from app.routers import auth, author, tickets, admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seeding is completed in Supabase; avoid blocking cold start
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Author Support & Communication Portal with AI-assisted classification and response generation.",
    lifespan=lifespan,
    redirect_slashes=False
)

# Cross-Origin Resource Sharing (CORS) setup for local dev and web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount modular routers at /api
app.include_router(auth.router, prefix="/api")
app.include_router(author.router, prefix="/api")
app.include_router(tickets.router, prefix="/api")
app.include_router(admin.router, prefix="/api")

# Also mount without /api prefix to handle both rewrite modes seamlessly
app.include_router(auth.router)
app.include_router(author.router)
app.include_router(tickets.router)
app.include_router(admin.router)

@app.get("/")
@app.get("/api")
@app.get("/api/health")
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
