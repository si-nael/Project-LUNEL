from fastapi import APIRouter, Depends, HTTPException

from app.auth.deps import get_current_user
from app.models.user import User
from app.models.enums import UserRole
from app.schemas.analysis import AnalysisRequest, AnalysisResponse
from app.services.expected_value import Choice, analyze_choices, recommend_strategy

router = APIRouter()


@router.post(
    "/expected-value",
    response_model=AnalysisResponse,
)
async def compute_expected_value(
    data: AnalysisRequest,
    current_user: User = Depends(get_current_user),
):
    # Admin or teacher only
    if current_user.role not in (UserRole.ADMIN, UserRole.TEACHER):
        raise HTTPException(status_code=403, detail="관리자 또는 교사만 사용 가능합니다.")

    # Validate probabilities sum to ~1 for each choice
    for choice_input in data.choices:
        prob_sum = sum(o.probability for o in choice_input.outcomes)
        if abs(prob_sum - 1.0) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"선택지 '{choice_input.name}'의 확률 합이 1이 아닙니다 ({prob_sum:.4f}).",
            )

    choices = [
        Choice(
            name=c.name,
            outcomes=[o.model_dump() for o in c.outcomes],
        )
        for c in data.choices
    ]
    results = analyze_choices(choices)
    strategy = recommend_strategy(results)
    return strategy
