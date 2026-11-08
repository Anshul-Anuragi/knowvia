from sqlalchemy.orm import Session

from src.models.user import User


def get_user_by_email(
    db: Session,
    email: str
):
    return (
        db.query(User)
        .filter(User.email == email)
        .first()
    )


def create_user(
    db: Session,
    user_data: dict
):
    user = User(**user_data)

    db.add(user)
    db.commit()
    db.refresh(user)

    return user