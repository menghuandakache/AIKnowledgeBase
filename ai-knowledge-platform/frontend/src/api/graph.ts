import request from './request'
import type { GraphResponse } from '../types/graph'

/** Fetch knowledge graph data for a knowledge base */
export async function getKnowledgeGraph(
  kbId: string,
  maxNodes?: number,
): Promise<GraphResponse> {
  return request.get(`/kb/${kbId}/graph`, {
    params: maxNodes ? { max_nodes: maxNodes } : undefined,
  })
}
