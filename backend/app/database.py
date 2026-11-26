import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

logger = logging.getLogger(__name__)


def create_resilient_engine():
    target_url = settings.DATABASE_URL
    is_sqlite = target_url.startswith("sqlite")
    
    # Try initializing primary target database (PostgreSQL)
    try:
        connect_args = {"check_same_thread": False} if is_sqlite else {"connect_timeout": 10}
        test_engine = create_engine(
            target_url,
            connect_args=connect_args,
            echo=False,
            pool_pre_ping=True,
            **({} if is_sqlite else {"pool_size": 10, "max_overflow": 5})
        )
        # Execute test query
        with test_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        
        logger.info(" Relational Database connected: %s", target_url.split("@")[-1] if "@" in target_url else target_url)
        return test_engine
    except Exception as e:
        logger.warning(
            " Primary Database (%s) connection failed: %s. Using SQLite fallback for zero-downtime continuity.",
            target_url.split("@")[-1] if "@" in target_url else target_url,
            str(e)
        )
        fallback_engine = create_engine(
            settings.FALLBACK_SQLITE_URL,
            connect_args={"check_same_thread": False},
            echo=False,
            pool_pre_ping=True
        )
        return fallback_engine


engine = create_resilient_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency for database session injection with auto-cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
