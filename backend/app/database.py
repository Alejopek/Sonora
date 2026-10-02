import os
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = os.getenv('DATABASE_URL', '')
engine = None
SessionLocal = None


def _url(url: str) -> str:
    return url.replace('postgresql://', 'postgresql+asyncpg://', 1) if url.startswith('postgresql://') else url


async def initialize_database() -> None:
    """Create tables for the self-contained Compose deployment when DB is configured."""
    global engine, SessionLocal
    if not DATABASE_URL:
        return
    engine = create_async_engine(_url(DATABASE_URL), pool_pre_ping=True)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    from app.models import Base
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)


async def close_database() -> None:
    if engine is not None:
        await engine.dispose()


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    if SessionLocal is None:
        from fastapi import HTTPException
        raise HTTPException(503, 'La persistencia no está configurada.')
    async with SessionLocal() as session:
        yield session
