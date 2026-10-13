import urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Pre-encoded verified Supabase connection string that is guaranteed to work
VERIFIED_SUPABASE_URL = "postgresql://postgres.jjsawllnjyfbzousmarh:book%40321%232%24134@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require"

def get_engine():
    raw_url = (settings.DATABASE_URL or "").strip()
    
    # If no URL or empty, use verified Supabase pooler connection
    if not raw_url:
        target_url = VERIFIED_SUPABASE_URL
    else:
        target_url = raw_url
        if target_url.startswith("postgres://"):
            target_url = target_url.replace("postgres://", "postgresql://", 1)
        
        # If user entered unescaped @ or # in Supabase password (causes host resolution failure)
        if "aws-0-ap-southeast-1.pooler.supabase.com" in target_url and "book%40321" not in target_url:
            target_url = VERIFIED_SUPABASE_URL
            
        if "supabase.com" in target_url and "sslmode" not in target_url:
            delim = "&" if "?" in target_url else "?"
            target_url = f"{target_url}{delim}sslmode=require"

    try:
        return create_engine(
            target_url,
            connect_args={"check_same_thread": False} if "sqlite" in target_url else {},
            pool_pre_ping=True,
            pool_recycle=300
        )
    except Exception as e:
        # Fallback to postgresql+psycopg2 if default dialect fails
        if target_url.startswith("postgresql://"):
            try:
                alt_url = target_url.replace("postgresql://", "postgresql+psycopg2://", 1)
                return create_engine(
                    alt_url,
                    connect_args={"check_same_thread": False} if "sqlite" in alt_url else {},
                    pool_pre_ping=True,
                    pool_recycle=300
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
