import request from './request'

export async function getKnowledgeList(params?: Record<string, any>) {
  return request.get('/knowledge', { params })
}

export async function getKnowledgeDetail(id: string) {
  return request.get(`/knowledge/${id}`)
}

export async function createKnowledge(data: Record<string, any>) {
  return request.post('/knowledge', data)
}

export async function updateKnowledge(id: string, data: Record<string, any>) {
  return request.put(`/knowledge/${id}`, data)
}

export async function deleteKnowledge(id: string) {
  return request.delete(`/knowledge/${id}`)
}

export async function publishKnowledge(id: string) {
  return request.patch(`/knowledge/${id}/publish`)
}

export async function disableKnowledge(id: string) {
  return request.patch(`/knowledge/${id}/disable`)
}

export async function batchDeleteKnowledge(ids: string[]) {
  return request.post('/knowledge/batch/delete', { ids })
}

export async function batchPublishKnowledge(ids: string[]) {
  return request.post('/knowledge/batch/publish', { ids })
}

export async function batchDisableKnowledge(ids: string[]) {
  return request.post('/knowledge/batch/disable', { ids })
}

export async function getKnowledgeChunks(id: string) {
  return request.get(`/knowledge/${id}/chunks`)
}
