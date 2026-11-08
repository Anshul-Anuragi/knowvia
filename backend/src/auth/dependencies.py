from fastapi import Depends
from fastapi import HTTPException
from fastapi.security import OAuth2PasswordBearer

from sqlalchemy.orm import Session

from src.database.dependencies import get_db

from src.core.security import (
    verify_access_token
)

from src.crud.user import (
    get_user_by_email
)


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/users/login"
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):

    payload = verify_access_token(
        token
    )

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={
                "WWW-Authenticate": "Bearer"
            }
        )

    email = payload.get(
        "sub"
    )

    if not email:
        raise HTTPException(
            status_code=401,
            detail="Invalid token",
            headers={
                "WWW-Authenticate": "Bearer"
            }
        )

    user = get_user_by_email(
        db,
        email
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found",
            headers={
                "WWW-Authenticate": "Bearer"
            }
        )

    return user