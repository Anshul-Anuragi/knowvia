from pydantic import BaseModel
from pydantic import EmailStr
from uuid import UUID


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    role: str
    subscription_tier: str = "free"
    subscription_status: str = "active"

    model_config = {
        "from_attributes": True
    }



class Token(BaseModel):
    access_token: str
    token_type: str