/** Node in the knowledge graph */
export interface GraphNode {
  id: string
  label: string
  category: string | null
  tags: string[]
  status: string          // draft | available | unavailable
  degree: number
}

/** Edge connecting two knowledge items */
export interface GraphEdge {
  source: string
  target: string
  weight: number
  label: string           // shared tag names
}

/** Complete graph response from API */
export interface GraphResponse {
  kb_id: string
  kb_name: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  total_nodes: number
  displayed_nodes: number
  truncated: boolean
}
