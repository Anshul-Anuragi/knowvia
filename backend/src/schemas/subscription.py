from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr


class PlanLimits(BaseModel):
    max_documents: int
    max_file_size_mb: int
    max_daily_queries: int
    advanced_retrieval: bool
    priority_support: bool


class PlanResponse(BaseModel):
    id: str
    name: str
    category: str  # "individual" | "team_enterprise"
    tagline: str
    monthly_price: int
    yearly_price: int
    currency: str
    is_custom_price: bool = False
    price_prefix: Optional[str] = None
    recommended: bool = False
    commitment_note: Optional[str] = None
    feature_heading: Optional[str] = None
    features: List[str]
    limits: PlanLimits


class UserSubscriptionResponse(BaseModel):
    user_id: str
    email: str
    subscription_tier: str
    subscription_status: str
    active_plan: Optional[PlanResponse] = None
    limits: PlanLimits


class CheckoutRequest(BaseModel):
    plan_id: str
    billing_cycle: str = "monthly"  # "monthly" | "yearly"


class CheckoutResponse(BaseModel):
    status: str  # "active" | "pending_gateway" | "contact_sales"
    message: str
    plan_id: str
    billing_cycle: str
    amount: int
    currency: str
    checkout_url: Optional[str] = None


class ContactSalesRequest(BaseModel):
    name: str
    email: EmailStr
    company: str
    team_size: str
    message: Optional[str] = None


class ContactSalesResponse(BaseModel):
    success: bool
    message: str

