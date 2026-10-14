import time
import logging
import contextvars
import re
import traceback
from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from sqlalchemy import event
from app.db.database import engine

logger = logging.getLogger("bookleaf.timing")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

# Thread/coroutine-safe context variables to track per-request database timing
db_query_time_var = contextvars.ContextVar("db_query_time", default=0.0)
db_query_count_var = contextvars.ContextVar("db_query_count", default=0)

# Attach SQLAlchemy query timing hooks
_hooks_registered = False

def register_db_timing_hooks(target_engine):
    global _hooks_registered
    if _hooks_registered:
        return

    @event.listens_for(target_engine, "before_cursor_execute")
    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        context._query_start_time = time.perf_counter()

    @event.listens_for(target_engine, "after_cursor_execute")
    def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        if hasattr(context, "_query_start_time"):
            duration = time.perf_counter() - context._query_start_time
            db_query_time_var.set(db_query_time_var.get() + duration)
            db_query_count_var.set(db_query_count_var.get() + 1)

    _hooks_registered = True

try:
    register_db_timing_hooks(engine)
except Exception as e:
    logger.warning(f"Failed to register DB timing hooks: {e}")

# Security redaction regexes
SENSITIVE_PARAM_PATTERN = re.compile(r'(token|password|secret|key|access_token|auth)=([^&]+)', re.IGNORECASE)

def sanitize_url(url_str: str) -> str:
    """Strictly redacts passwords, tokens, and secrets from logged request URLs."""
    return SENSITIVE_PARAM_PATTERN.sub(r'\1=***REDACTED***', url_str)

class ServerTimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Reset context per request
        db_query_time_var.set(0.0)
        db_query_count_var.set(0)

        start_time = time.perf_counter()
        sanitized_path = sanitize_url(str(request.url.path))
        if request.url.query:
            sanitized_path = f"{sanitized_path}?{sanitize_url(str(request.url.query))}"

        try:
            response = await call_next(request)
        except Exception as exc:
            total_duration_sec = time.perf_counter() - start_time
            total_ms = total_duration_sec * 1000.0
            db_ms = db_query_time_var.get() * 1000.0
            proc_ms = max(0.0, total_ms - db_ms)
            query_count = db_query_count_var.get()

            logger.error(
                f"[TIMING-ERROR] {request.method} {sanitized_path} status=500 "
                f"total={total_ms:.2f}ms db={db_ms:.2f}ms processing={proc_ms:.2f}ms queries={query_count} "
                f"error={type(exc).__name__}: {str(exc)}\n{traceback.format_exc()}"
            )
            return JSONResponse(
                status_code=500,
                content={"detail": "An internal server error occurred. Please retry your request."}
            )

        total_duration_sec = time.perf_counter() - start_time
        total_ms = total_duration_sec * 1000.0
        db_ms = db_query_time_var.get() * 1000.0
        proc_ms = max(0.0, total_ms - db_ms)
        query_count = db_query_count_var.get()

        # Add performance metrics headers (W3C Server-Timing standard)
        response.headers["Server-Timing"] = (
            f"db;dur={db_ms:.2f};desc=\"Database\", "
            f"app;dur={proc_ms:.2f};desc=\"Backend Processing\", "
            f"total;dur={total_ms:.2f};desc=\"Total Latency\""
        )
        response.headers["X-Response-Time"] = f"{total_ms:.2f}ms"
        response.headers["X-DB-Time"] = f"{db_ms:.2f}ms"
        response.headers["X-DB-Queries"] = str(query_count)

        # Server-side structured timing log
        logger.info(
            f"[TIMING] {request.method} {sanitized_path} status={response.status_code} "
            f"total={total_ms:.2f}ms db={db_ms:.2f}ms processing={proc_ms:.2f}ms queries={query_count}"
        )

        return response
