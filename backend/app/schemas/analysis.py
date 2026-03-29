from pydantic import BaseModel, Field


class OutcomeInput(BaseModel):
    probability: float = Field(ge=0, le=1)
    score: float


class ChoiceInput(BaseModel):
    name: str
    outcomes: list[OutcomeInput]


class AnalysisRequest(BaseModel):
    choices: list[ChoiceInput] = Field(min_length=1)


class ChoiceResult(BaseModel):
    choice: str
    ev: float
    variance: float
    std_dev: float
    range: list[float]


class StrategyRecommendation(BaseModel):
    choice: str
    ev: float
    risk: float


class AnalysisResponse(BaseModel):
    best_expected_value: StrategyRecommendation
    safest_choice: StrategyRecommendation
    recommendation: str
    all_results: list[ChoiceResult]
