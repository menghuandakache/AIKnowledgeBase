"""Knowledge Graph service — builds graph data from knowledge items and shared tags."""
from itertools import combinations

from sqlalchemy.orm import Session

from app.repositories.knowledge_repo import KnowledgeRepository
from app.repositories.kb_repo import KnowledgeBaseRepository
from app.core.exceptions import NotFoundException


class GraphService:
    """Computes graph nodes and edges for a knowledge base."""

    def __init__(self, db: Session):
        self.db = db
        self.knowledge_repo = KnowledgeRepository(db)
        self.kb_repo = KnowledgeBaseRepository(db)

    def build_graph(self, kb_id: str, max_nodes: int = 200) -> dict:
        """
        Build graph data for a knowledge base.

        Nodes: knowledge items with tags (status != deleted)
        Edges: items sharing >= 2 tags (weight = shared tag count)

        Args:
            kb_id: Knowledge base ID
            max_nodes: Maximum nodes to include (prioritizes items with tags)
        """
        kb = self.kb_repo.get_by_id(kb_id)
        if not kb:
            raise NotFoundException(f"Knowledge base {kb_id} not found")

        # Fetch all non-deleted items for this KB
        all_items = self.knowledge_repo.list_all(
            kb_id=kb_id,
            page=1,
            page_size=10000,  # get all items
        )

        # Filter to items that have tags (for meaningful edges)
        # Then supplement with tag-less items sorted by updated_at
        items_with_tags = []
        items_without_tags = []
        for item in all_items:
            tags = item.tags or []
            if len(tags) >= 1:
                items_with_tags.append(item)
            else:
                items_without_tags.append(item)

        # Prioritize items with tags, then fill up to max_nodes
        selected = items_with_tags[:max_nodes]
        remaining = max_nodes - len(selected)
        if remaining > 0:
            selected += items_without_tags[:remaining]

        total_count = len(all_items)
        truncated = total_count > max_nodes

        # Build nodes
        node_map: dict[str, dict] = {}
        for item in selected:
            node_id = str(item.id)
            node_map[node_id] = {
                "id": node_id,
                "label": item.title[:40] + ("…" if len(item.title) > 40 else ""),
                "category": item.category,
                "tags": item.tags or [],
                "status": item.status,
                "degree": 0,
            }

        # Build edges from shared tags (≥ 2)
        edges = []
        # Only compare items that have tags (for performance)
        tagged_items = [it for it in selected if it.tags and len(it.tags) >= 1]
        for a, b in combinations(tagged_items, 2):
            a_id = str(a.id)
            b_id = str(b.id)
            a_tags = set(a.tags or [])
            b_tags = set(b.tags or [])
            shared = a_tags & b_tags
            if len(shared) >= 2:
                edges.append({
                    "source": a_id,
                    "target": b_id,
                    "weight": len(shared),
                    "label": "、".join(sorted(shared)[:3]),
                })
                node_map[a_id]["degree"] += 1
                node_map[b_id]["degree"] += 1

        return {
            "kb_id": kb_id,
            "kb_name": kb.name,
            "nodes": list(node_map.values()),
            "edges": edges,
            "total_nodes": total_count,
            "displayed_nodes": len(selected),
            "truncated": truncated,
        }
