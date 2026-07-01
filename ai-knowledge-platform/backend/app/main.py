"""FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import engine, SessionLocal
from app.core.logging import setup_logging
from app.core.exceptions import BusinessException
from app.api.routes import (
    auth,
    kb,
    knowledge,
    document,
    search,
    agent,
    chat,
    feedback,
    stats,
    model_config,
    conversation,
    graph,
)

settings = get_settings()
logger = setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Starting AI Knowledge Base Management Platform...")
    # Initialize database tables
    from app.core.database import Base
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized")
    yield
    logger.info("Shutting down AI Knowledge Base Management Platform...")


app = FastAPI(
    title="AI Knowledge Base Management Platform",
    description="企业级 AI 知识库管理与专家 Agent 问答平台",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
origins = settings.CORS_ORIGINS.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(BusinessException)
async def business_exception_handler(request: Request, exc: BusinessException):
    logger.warning(f"Business error: {exc.code} - {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.code,
            "message": exc.message,
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "code": "INTERNAL_ERROR",
            "message": "Internal server error",
        },
    )


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    health = {
        "app": "healthy",
        "database": "unknown",
        "redis": "unknown",
        "embedding_model": "unknown",
    }

    # Check database
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        health["database"] = "healthy"
    except Exception as e:
        health["database"] = f"unhealthy: {str(e)}"

    # Check Redis
    try:
        import redis
        r = redis.from_url(settings.REDIS_URL)
        r.ping()
        r.close()
        health["redis"] = "healthy"
    except Exception as e:
        health["redis"] = f"unhealthy: {str(e)}"

    return health


# Register API routes
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(kb.router, prefix="/api/kb", tags=["Knowledge Bases"])
app.include_router(knowledge.router, prefix="/api/knowledge", tags=["Knowledge Items"])
app.include_router(document.router, prefix="/api/documents", tags=["Documents"])
app.include_router(search.router, prefix="/api/search", tags=["Search"])
app.include_router(agent.router, prefix="/api/agents", tags=["Agents"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["Feedback"])
app.include_router(stats.router, prefix="/api/stats", tags=["Statistics"])
app.include_router(model_config.router, prefix="/api/models", tags=["Model Config"])
app.include_router(conversation.router, prefix="/api/conversations", tags=["Conversations"])
app.include_router(graph.router, prefix="/api", tags=["Knowledge Graph"])
