from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request
from src.schemas.user import Token
from src.core.security import (
    verify_password,
    create_access_token
)
from sqlalchemy.orm import Session
from src.auth.dependencies import get_current_user
from src.models.user import User
from fastapi.security import OAuth2PasswordRequestForm
from src.database.dependencies import get_db
from src.auth.roles import require_admin
from src.schemas.user import (
    UserCreate,
    UserResponse,
    UserLogin,
    Token
)

from src.crud.user import (
    get_user_by_email,
    create_user
)

from src.core.security import hash_password

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


@router.post(
    "/register",
    response_model=UserResponse
)
def register_user(
    user: UserCreate,
    db: Session = Depends(get_db)
):

    existing_user = get_user_by_email(
        db,
        user.email
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    new_user = create_user(
        db,
        {
            "name": user.name,
            "email": user.email,
            "password_hash": hash_password(
                user.password
            )
        }
    )

    return new_user

@router.post(
    "/login",
    response_model=Token
)
async def login_user(
    request: Request,
    db: Session = Depends(get_db)
):
    content_type = request.headers.get("content-type", "")
    email = None
    password = None

    if "application/json" in content_type:
        try:
            body = await request.json()
            email = body.get("email") or body.get("username")
            password = body.get("password")
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Invalid JSON payload"
            )
    else:
        try:
            form_data = await request.form()
            email = form_data.get("username") or form_data.get("email")
            password = form_data.get("password")
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Invalid form data"
            )

    if not email or not password:
        raise HTTPException(
            status_code=400,
            detail="Email and password are required"
        )

    db_user = get_user_by_email(
        db,
        email
    )

    if not db_user:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    if not verify_password(
        password,
        db_user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    access_token = create_access_token(
        {
            "sub": db_user.email
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

@router.get(
    "/me",
    response_model=UserResponse
)
def get_me(
    current_user: User = Depends(
        get_current_user
    )
):
    return current_user

@router.get("/admin")
def admin_dashboard(
    current_user=Depends(
        require_admin
    )
):
    return {
        "message": "Welcome Admin"
    }

from fastapi import Depends
from fastapi import HTTPException

from src.auth.dependencies import get_current_user


def require_role(role: str):

    def role_checker(
        current_user=Depends(
            get_current_user
        )
    ):

        if current_user.role != role:

            raise HTTPException(
                status_code=403,
                detail="Permission denied"
            )

        return current_user

    return role_checker