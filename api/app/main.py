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

# Mount Vite frontend distribution if present (for single-service deployment on Render)
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

current_file_dir = os.path.dirname(os.path.abspath(__file__))
possible_dist_paths = [
    os.path.join(current_file_dir, "..", "..", "frontend", "dist"),
    os.path.join(current_file_dir, "..", "frontend", "dist"),
    os.path.join(os.getcwd(), "frontend", "dist"),
]

frontend_dist = None
for p in possible_dist_paths:
    if os.path.exists(os.path.join(p, "index.html")):
        frontend_dist = os.path.abspath(p)
        break

if frontend_dist:
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
    @app.get("/")
    def root_fallback():
        return health_check()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
