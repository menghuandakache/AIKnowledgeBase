"""Knowledge Item routes."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.security import get_current_user, require_admin
from app.models.user import User
from app.schemas.knowledge import (
    KnowledgeCreate, KnowledgeUpdate,
    KnowledgeResponse, KnowledgeListResponse, ChunkResponse,
    BatchDeleteRequest, BatchOperationResponse,
)
from app.services.knowledge_service import KnowledgeService

router = APIRouter()


@router.get("", response_model=KnowledgeListResponse)
async def list_knowledge(
    kb_id: str = Query(None),
    keyword: str = Query(None),
    category: str = Query(None),
    status: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List knowledge items."""
    service = KnowledgeService(db)
    return service.list_all(
        kb_id=kb_id, keyword=keyword, category=category,
        status=status, page=page, page_size=page_size,
    )


@router.post("", response_model=KnowledgeResponse)
async def create_knowledge(
    request: KnowledgeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a knowledge item."""
    service = KnowledgeService(db)
    return service.create(
        kb_id=request.kb_id,
        title=request.title,
        content=request.content,
        summary=request.summary,
        category=request.category,
        tags=request.tags,
        status=request.status,
        source_type="manual",
        created_by=str(current_user.id),
    )


@router.get("/{knowledge_id}", response_model=KnowledgeResponse)
async def get_knowledge(
    knowledge_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get knowledge item detail."""
    service = KnowledgeService(db)
    return service.get_by_id(knowledge_id)


@router.put("/{knowledge_id}", response_model=KnowledgeResponse)
async def update_knowledge(
    knowledge_id: str,
    request: KnowledgeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update a knowledge item."""
    service = KnowledgeService(db)
    return service.update(knowledge_id, **request.model_dump(exclude_none=True))


@router.delete("/{knowledge_id}")
async def delete_knowledge(
    knowledge_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Soft delete a knowledge item."""
    service = KnowledgeService(db)
    return service.delete(knowledge_id)


@router.patch("/{knowledge_id}/publish")
async def publish_knowledge(
    knowledge_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Publish a knowledge item."""
    service = KnowledgeService(db)
    return service.publish(knowledge_id)


@router.patch("/{knowledge_id}/disable")
async def disable_knowledge(
    knowledge_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Disable a knowledge item."""
    service = KnowledgeService(db)
    return service.disable(knowledge_id)


@router.get("/{knowledge_id}/chunks", response_model=list[ChunkResponse])
async def get_knowledge_chunks(
    knowledge_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get chunks for a knowledge item."""
    service = KnowledgeService(db)
    return service.get_chunks(knowledge_id)


@router.post("/batch/delete", response_model=BatchOperationResponse)
async def batch_delete_knowledge(
    request: BatchDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Batch soft-delete knowledge items."""
    service = KnowledgeService(db)
    deleted = 0
    errors = []
    for kid in request.ids:
        try:
            service.delete(kid)
            deleted += 1
        except Exception as e:
            errors.append({"id": kid, "error": str(e)})
    return {"success_count": deleted, "error_count": len(errors), "errors": errors}


@router.post("/batch/publish", response_model=BatchOperationResponse)
async def batch_publish_knowledge(
    request: BatchDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Batch publish knowledge items."""
    service = KnowledgeService(db)
    published = 0
    errors = []
    for kid in request.ids:
        try:
            service.publish(kid)
            published += 1
        except Exception as e:
            errors.append({"id": kid, "error": str(e)})
    return {"success_count": published, "error_count": len(errors), "errors": errors}


@router.post("/batch/disable", response_model=BatchOperationResponse)
async def batch_disable_knowledge(
    request: BatchDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Batch disable knowledge items."""
    service = KnowledgeService(db)
    disabled = 0
    errors = []
    for kid in request.ids:
        try:
            service.disable(kid)
            disabled += 1
        except Exception as e:
            errors.append({"id": kid, "error": str(e)})
    return {"success_count": disabled, "error_count": len(errors), "errors": errors}
