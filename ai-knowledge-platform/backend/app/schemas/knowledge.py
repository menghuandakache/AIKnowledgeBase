"""Knowledge Item schemas."""
from datetime import datetime
from pydantic import BaseModel, Field


class KnowledgeCreate(BaseModel):
    kb_id: str
    title: str = Field(..., min_length=1, max_length=500)
    content: str = Field(..., min_length=1)
    summary: str | None = None
    category: str | None = None
    tags: list[str] = Field(default_factory=list)
    status: str = "draft"


class KnowledgeUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    content: str | None = None
    summary: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    status: str | None = None


class KnowledgePublishRequest(BaseModel):
    pass


class KnowledgeResponse(BaseModel):
    id: str
    kb_id: str
    title: str
    content: str
    summary: str | None = None
    category: str | None = None
    tags: list[str] = []
    status: str
    source_type: str
    source_file_id: str | None = None
    created_by: str | None = None
    updated_by: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    chunk_count: int = 0

    class Config:
        from_attributes = True


class KnowledgeListQuery(BaseModel):
    kb_id: str | None = None
    keyword: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    status: str | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class KnowledgeListResponse(BaseModel):
    items: list[KnowledgeResponse]
    total: int
    page: int
    page_size: int


class BatchDeleteRequest(BaseModel):
    ids: list[str] = Field(..., min_length=1, max_length=500)


class BatchOperationError(BaseModel):
    id: str
    error: str


class BatchOperationResponse(BaseModel):
    success_count: int
    error_count: int
    errors: list[BatchOperationError] = []


class ChunkResponse(BaseModel):
    id: str
    knowledge_id: str
    chunk_text: str
    chunk_index: int
    metadata: dict | None = None
    token_count: int | None = None

    class Config:
        from_attributes = True
