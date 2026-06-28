from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


class ChartSpec(BaseModel):
    type: Literal["bar", "donut", "line", "area", "volume_compare"] = "bar"
    title: str
    subtitle: str | None = None
    data: list[dict[str, Any]]
    granularity: Literal["day", "week", "month"] | None = None
    variant: Literal["bar", "area"] | None = None
    legend_name: str | None = None
    layout: Literal["horizontal", "vertical"] | None = None


class KpiSpec(BaseModel):
    label: str
    value: str | int | float


class ResponseSource(BaseModel):
    type: Literal["knowledge", "system", "hybrid"]
    label: str
    tools_used: list[str] = Field(default_factory=list)
    documents: list[str] = Field(default_factory=list)


class PendingActionSpec(BaseModel):
    id: str
    action_type: str
    summary: str
    risk: str = "medium"
    status: str = "pending"
    expires_at: str | None = None


class MixedResponse(BaseModel):
    type: Literal["mixed_response"] = "mixed_response"
    markdown: str
    charts: list[ChartSpec] = Field(default_factory=list)
    kpis: list[KpiSpec] = Field(default_factory=list)
    tables: list[dict[str, Any]] = Field(default_factory=list)
    sources: list[ResponseSource] = Field(default_factory=list)
    insights: list[str] = Field(default_factory=list)
    follow_ups: list[str] = Field(default_factory=list)
    data_limitations: str | None = None
    route: str | None = None
    pending_actions: list[PendingActionSpec] = Field(default_factory=list)


class TokenUsageTurn(BaseModel):
    input_tokens: int
    output_tokens: int
    total_tokens: int
    model: str
    provider: str
    source: Literal["provider", "estimated"]
    llm_calls: int = 0
    estimated_cost_usd: float = 0.0


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    session_input_tokens: int = 0
    session_output_tokens: int = 0
    session_cost_usd: float = 0.0
    session_turns: int = 0
    knowledge_mode: bool = False
    analysis_type: str = "geral"
    attachment_ids: list[str] = Field(default_factory=list)


class ChatResponse(BaseModel):
    conversation_id: str
    response: MixedResponse
    usage: TokenUsageTurn
    session_usage: TokenUsageTurn
