import os
import urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

def get_engine():
    raw_url = (settings.DATABASE_URL or os.environ.get("DATABASE_URL") or "").strip()
    
    if not raw_url:
        # Graceful fallback to local SQLite for test environments and out-of-the-box dev
        raw_url = "sqlite:///./bookleaf_dev.db"

    target_url = raw_url
    if target_url.startswith("postgres://"):
        target_url = target_url.replace("postgres://", "postgresql://", 1)
        
    if "supabase.com" in target_url and "sslmode" not in target_url:
        delim = "&" if "?" in target_url else "?"
        target_url = f"{target_url}{delim}sslmode=require"

    is_sqlite = "sqlite" in target_url
    pool_kwargs = {
        "connect_args": {"check_same_thread": False}
    } if is_sqlite else {
        "pool_size": 10,
        "max_overflow": 20,
        "pool_timeout": 20,
        "pool_pre_ping": True,
        "pool_recycle": 300
    }

    try:
        return create_engine(
            target_url,
            **pool_kwargs
        )
    except Exception as e:
        # Fallback to postgresql+psycopg2 if default dialect fails
        if target_url.startswith("postgresql://"):
            try:
                alt_url = target_url.replace("postgresql://", "postgresql+psycopg2://", 1)
                return create_engine(
                    alt_url,
                    **pool_kwargs
                )
            except Exception:
                pass
        raise e

engine = get_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
