from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "BookLeaf Author Support & Communication Portal"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "bookleaf_ultra_secure_jwt_secret_key_2026_prod"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # Fallback to Supabase connection if DATABASE_URL is not set in environment
    DATABASE_URL: str = "postgresql://postgres.jjsawllnjyfbzousmarh:book%40321%232%24134@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
    
    # AI / Gemini Configuration (provided via Vercel Environment Variables)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
