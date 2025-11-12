"""
Data models for ACM Compass
"""
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator

# Constants
UnsolvedStage = Literal["未看题", "已看题无思路", "知道做法未实现"]
ContestStatus = Literal["ac", "attempted", "unsubmitted"]
LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


class ProblemIn(BaseModel):
    """Input model for creating/updating problems"""
    title: str = Field(..., min_length=1, description="题目标题")
    link: Optional[HttpUrl] = Field(None, description="题目链接")
    source: Optional[str] = Field(None, description="来源（Codeforces/AtCoder/Luogu等）")
    tags: List[str] = Field(default_factory=list, description="标签列表")
    assignee: Optional[str] = Field(None, description="当前补题人")
    solved: bool = Field(default=False, description="是否已解决")
    unsolved_stage: Optional[UnsolvedStage] = Field(default=None, description="未解决阶段分类")
    unsolved_custom_label: Optional[str] = Field(default=None, description="未解决自定义标签")
    pass_count: Optional[int] = Field(default=None, ge=0, description="场上通过人数（越多越简单）")
    notes: Optional[str] = Field(None, description="备注")

    @field_validator('source', 'assignee', 'unsolved_custom_label', mode='before')
    @classmethod
    def _strip_optional_text(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    @field_validator('notes', mode='before')
    @classmethod
    def _strip_notes(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            stripped = v.strip()
            return stripped or None
        return v

    @model_validator(mode='after')
    def _clear_unsolved_when_solved(self):
        if self.solved:
            self.unsolved_stage = None
            self.unsolved_custom_label = None
        return self


class Problem(ProblemIn):
    """Complete problem model with system fields"""
    id: str
    created_at: str
    updated_at: str
    has_solution: bool = False


class ContestProblemIn(BaseModel):
    """Input model for contest problem stats"""
    letter: Optional[str] = Field(None, description="A,B,C...")
    pass_count: int = Field(0, ge=0, description="通过人数")
    attempt_count: int = Field(0, ge=0, description="尝试人数")
    my_status: ContestStatus = Field("unsubmitted", description="本队本题状态")


class ContestIn(BaseModel):
    """Input model for creating/updating contests"""
    name: str = Field(..., min_length=1, description="比赛名称")
    total_problems: int = Field(..., ge=1, le=26, description="题目数量(≤26)")
    problems: List[ContestProblemIn] = Field(default_factory=list, description="题目数据 A..")
    rank_str: Optional[str] = Field(None, description="形如 a/b 的排名")
    summary: Optional[str] = Field(None, description="赛后总结")


class Contest(ContestIn):
    """Complete contest model with system fields"""
    id: str
    created_at: str
    updated_at: str
