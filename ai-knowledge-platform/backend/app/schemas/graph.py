"""Knowledge Graph schemas."""
from pydantic import BaseModel, Field


class GraphNode(BaseModel):
    """A node in the knowledge graph representing a knowledge item."""
    id: str
    label: str                     # title of the knowledge item
    category: str | None = None    # category for color grouping
    tags: list[str] = []           # tags for tooltip
    status: str = "draft"          # draft/available/unavailable — affects node color
    degree: int = 0                # number of connected edges (for node sizing)


class GraphEdge(BaseModel):
    """An edge between two knowledge items."""
    source: str                    # source node id
    target: str                    # target node id
    weight: int = 1                # number of shared tags
    label: str = ""                # shared tag names (comma-separated)


class GraphResponse(BaseModel):
    """Complete graph data for a knowledge base."""
    kb_id: str
    kb_name: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    total_nodes: int               # total items in KB (before max_nodes limit)
    displayed_nodes: int           # actual nodes displayed
    truncated: bool = False        # whether nodes were limited by max_nodes
