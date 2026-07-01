"""Knowledge Graph API routes."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.graph import GraphResponse
from app.services.graph_service import GraphService

router = APIRouter()


@router.get("/kb/{kb_id}/graph", response_model=GraphResponse)
async def get_knowledge_graph(
    kb_id: str,
    max_nodes: int = Query(200, ge=10, le=500, description="Maximum nodes in graph"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get knowledge graph data for a knowledge base.

    Nodes are knowledge items. Edges are based on shared tags (≥2 shared tags).
    """
    service = GraphService(db)
    return service.build_graph(kb_id=kb_id, max_nodes=max_nodes)
