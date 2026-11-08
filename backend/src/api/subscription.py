from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.database.dependencies import get_db
from src.auth.dependencies import get_current_user
from src.models.user import User
from src.schemas.subscription import (
    PlanResponse,
    PlanLimits,
    UserSubscriptionResponse,
    CheckoutRequest,
    CheckoutResponse,
    ContactSalesRequest,
    ContactSalesResponse,
)

router = APIRouter(
    prefix="/subscriptions",
    tags=["Subscriptions"]
)

# ---------------------------------------------------------------------------
# Trusted Server-Side Plan Configurations
# ---------------------------------------------------------------------------
SERVER_PLANS: Dict[str, Dict[str, Any]] = {
    "free": {
        "id": "free",
        "name": "Free",
        "category": "individual",
        "tagline": "Explore Knowvia with essential document intelligence",
        "monthly_price": 0,
        "yearly_price": 0,
        "currency": "INR",
        "is_custom_price": False,
        "price_prefix": None,
        "recommended": False,
        "commitment_note": None,
        "feature_heading": None,
        "features": [
            "Basic document uploads (PDF)",
            "Limited document storage (up to 5 documents)",
            "Standard hybrid vector search",
            "Basic retrieval and source citations",
            "Standard community access",
        ],
        "limits": {
            "max_documents": 5,
            "max_file_size_mb": 10,
            "max_daily_queries": 20,
            "advanced_retrieval": False,
            "priority_support": False,
        },
    },
    "pro": {
        "id": "pro",
        "name": "Pro",
        "category": "individual",
        "tagline": "Research, code, and synthesize without barriers",
        "monthly_price": 499,
        "yearly_price": 4968,  # ₹414/mo (17% off)
        "currency": "INR",
        "is_custom_price": False,
        "price_prefix": None,
        "recommended": True,
        "commitment_note": "No commitment · Cancel anytime",
        "feature_heading": "Everything in Free and:",
        "features": [
            "Higher document storage (up to 100 documents)",
            "Increased AI question allowance (250 queries/day)",
            "Conversational multi-turn document search",
            "Full source citations and session history",
            "Dense semantic retrieval with BGE-small",
            "Priority processing queue",
        ],
        "limits": {
            "max_documents": 100,
            "max_file_size_mb": 25,
            "max_daily_queries": 250,
            "advanced_retrieval": True,
            "priority_support": True,
        },
    },
    "max": {
        "id": "max",
        "name": "Max",
        "category": "individual",
        "tagline": "Higher limits, priority access for power researchers",
        "monthly_price": 1499,
        "yearly_price": 14930,  # ₹1,244/mo (17% off)
        "currency": "INR",
        "is_custom_price": False,
        "price_prefix": "From ",
        "recommended": False,
        "commitment_note": "No commitment · Cancel anytime",
        "feature_heading": "Everything in Pro, plus:",
        "features": [
            "Highest usage limits (up to 500 documents)",
            "Large document collections (up to 50MB per file)",
            "1,000 AI questions per day",
            "Advanced query rewriting & re-ranking",
            "Ultra-low latency inference queue",
            "Early access to new enterprise features",
        ],
        "limits": {
            "max_documents": 500,
            "max_file_size_mb": 50,
            "max_daily_queries": 1000,
            "advanced_retrieval": True,
            "priority_support": True,
        },
    },
    "team": {
        "id": "team",
        "name": "Team",
        "category": "team_enterprise",
        "tagline": "Shared knowledge workspace for collaborative teams",
        "monthly_price": 1499,
        "yearly_price": 14930,
        "currency": "INR",
        "is_custom_price": False,
        "price_prefix": "From ",
        "recommended": False,
        "commitment_note": "Per user / month · Min 3 seats",
        "feature_heading": "All Pro capabilities and:",
        "features": [
            "Shared team document repository",
            "Centralized document permissions & member management",
            "Collaborative conversation threads",
            "Shared query pool and usage controls",
            "Standard priority support",
        ],
        "limits": {
            "max_documents": 2000,
            "max_file_size_mb": 50,
            "max_daily_queries": 5000,
            "advanced_retrieval": True,
            "priority_support": True,
        },
    },
    "business": {
        "id": "business",
        "name": "Business",
        "category": "team_enterprise",
        "tagline": "High capacity with administrative controls and analytics",
        "monthly_price": 2999,
        "yearly_price": 29870,
        "currency": "INR",
        "is_custom_price": False,
        "price_prefix": "From ",
        "recommended": True,
        "commitment_note": "Per user / month · Billed annually or monthly",
        "feature_heading": "Everything in Team, plus:",
        "features": [
            "10,000 document knowledge base",
            "Workspace administrative controls and audit logs",
            "Team usage analytics and query attribution",
            "Custom chunking strategies & metadata filters",
            "Dedicated onboarding and priority SLA",
        ],
        "limits": {
            "max_documents": 10000,
            "max_file_size_mb": 100,
            "max_daily_queries": 20000,
            "advanced_retrieval": True,
            "priority_support": True,
        },
    },
    "enterprise": {
        "id": "enterprise",
        "name": "Enterprise",
        "category": "team_enterprise",
        "tagline": "Custom security, dedicated VPC, and private intelligence",
        "monthly_price": 0,
        "yearly_price": 0,
        "currency": "INR",
        "is_custom_price": True,
        "price_prefix": None,
        "recommended": False,
        "commitment_note": "Custom contract · Annual billing",
        "feature_heading": "Enterprise security & control:",
        "features": [
            "Unlimited document indexing and queries",
            "Dedicated VPC, on-premise, or hybrid deployment",
            "Enterprise SSO (SAML, Okta, Azure AD)",
            "Custom LLM & embedding routing (Gemini / Claude / Self-hosted)",
            "Role-based access control (RBAC) & compliance isolation",
            "24/7 dedicated support & 99.9% uptime guarantee",
        ],
        "limits": {
            "max_documents": 999999,
            "max_file_size_mb": 500,
            "max_daily_queries": 999999,
            "advanced_retrieval": True,
            "priority_support": True,
        },
    },
}


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@router.get("/plans", response_model=List[PlanResponse])
def get_plans():
    """Retrieve all available subscription plans with verified server configuration."""
    return [PlanResponse(**plan) for plan in SERVER_PLANS.values()]


@router.get("/me", response_model=UserSubscriptionResponse)
def get_my_subscription(current_user: User = Depends(get_current_user)):
    """Retrieve current subscription status and operational limits for the authenticated user."""
    tier = getattr(current_user, "subscription_tier", "free") or "free"
    sub_status = getattr(current_user, "subscription_status", "active") or "active"

    plan_cfg = SERVER_PLANS.get(tier, SERVER_PLANS["free"])

    return UserSubscriptionResponse(
        user_id=str(current_user.id),
        email=current_user.email,
        subscription_tier=tier,
        subscription_status=sub_status,
        active_plan=PlanResponse(**plan_cfg),
        limits=PlanLimits(**plan_cfg["limits"]),
    )


@router.post("/checkout", response_model=CheckoutResponse)
def initiate_checkout(
    request: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Validate requested subscription plan and initialize checkout.
    Uses authenticated user identity and server-side pricing.
    """
    plan_id = request.plan_id.lower().strip()
    if plan_id not in SERVER_PLANS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid plan '{request.plan_id}'. Choose from: {list(SERVER_PLANS.keys())}",
        )

    plan = SERVER_PLANS[plan_id]
    billing = request.billing_cycle.lower().strip()
    if billing not in ["monthly", "yearly"]:
        billing = "monthly"

    # Enterprise requires sales contact
    if plan["is_custom_price"]:
        return CheckoutResponse(
            status="contact_sales",
            message="Enterprise plans require custom configuration. Please use the Contact Sales form.",
            plan_id=plan_id,
            billing_cycle=billing,
            amount=0,
            currency=plan["currency"],
        )

    # Free plan transition
    if plan_id == "free":
        current_user.subscription_tier = "free"
        current_user.subscription_status = "active"
        db.commit()
        db.refresh(current_user)

        return CheckoutResponse(
            status="active",
            message="Your account is now on the Free plan.",
            plan_id="free",
            billing_cycle=billing,
            amount=0,
            currency=plan["currency"],
        )

    # Paid Plan: Compute verified server-side price
    amount = plan["yearly_price"] if billing == "yearly" else plan["monthly_price"]

    # Since no commercial payment provider is configured, return clean sandbox/pending status
    # without faking payment completion
    return CheckoutResponse(
        status="pending_gateway",
        message=(
            f"Subscription order initialized for {plan['name']} ({billing}). "
            "Live payment gateway credentials have not yet been configured on this instance. "
            "No card was charged."
        ),
        plan_id=plan_id,
        billing_cycle=billing,
        amount=amount,
        currency=plan["currency"],
        checkout_url=None,
    )


@router.post("/contact-sales", response_model=ContactSalesResponse)
def contact_sales(
    request: ContactSalesRequest,
):
    """Submit an Enterprise inquiry with team sizing and deployment requirements."""
    return ContactSalesResponse(
        success=True,
        message=f"Thank you, {request.name}. Your inquiry for {request.company} has been received. Our Enterprise Solutions team will contact {request.email} shortly.",
    )

