import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import User

bearer = HTTPBearer(auto_error=False)
JWT_SECRET = os.getenv('JWT_SECRET', '')
JWT_ALGORITHM = 'HS256'

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, digest: str) -> bool:
    return bcrypt.checkpw(password.encode(), digest.encode())

def create_token(user: User) -> str:
    if not JWT_SECRET:
        raise HTTPException(503, 'JWT_SECRET no está configurado.')
    return jwt.encode({'sub': str(user.id), 'exp': datetime.now(timezone.utc) + timedelta(hours=int(os.getenv('JWT_EXPIRES_HOURS', '168')))}, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), session: AsyncSession = Depends(get_session)) -> User:
    if not credentials or not JWT_SECRET:
        raise HTTPException(401, 'Sesión no válida.')
    try:
        subject = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM]).get('sub')
        user = await session.scalar(select(User).where(User.id == int(subject)))
    except (jwt.PyJWTError, TypeError, ValueError):
        user = None
    if user is None:
        raise HTTPException(401, 'Sesión no válida.')
    return user
