import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Input, Button, Space, Select, message, Typography, Tag, Avatar, Modal, Tooltip } from 'antd'
import {
  SendOutlined, RobotOutlined, UserOutlined, CopyOutlined,
  LikeOutlined, DislikeOutlined, FileTextOutlined, ReloadOutlined,
  PlusOutlined, DeleteOutlined, MessageOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
} from '@ant-design/icons'
import { getAgent } from '../../api/agent'
import { submitFeedback, getAgentChatStreamUrl } from '../../api/chat'
import { getModelConfigs } from '../../api/models'
import { getConversations, getConversation, createConversation, deleteConversation } from '../../api/conversation'
import { useChatStream } from '../../hooks/useChatStream'
import MarkdownViewer from '../../components/MarkdownViewer'
import type { ChatMessage } from '../../types/chat'

const { Text } = Typography

export default function AgentChatPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { streaming, startStream } = useChatStream()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sources, setSources] = useState<any[]>([])
  const [modelConfigId, setModelConfigId] = useState<string | undefined>()
  const [showSources, setShowSources] = useState(false)
  const [convId, setConvId] = useState<string | undefined>()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [convSearch, setConvSearch] = useState('')
  const [lastQuestion, setLastQuestion] = useState('')
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const { data: agent } = useQuery({
    queryKey: ['agent', id], enabled: !!id,
    queryFn: async () => { const res: any = await getAgent(id!); return res },
  })

  const { data: models } = useQuery({
    queryKey: ['model-configs'],
    queryFn: async () => { const res: any = await getModelConfigs(); return res?.items || [] },
  })

  const { data: convList, refetch: refetchConvs } = useQuery({
    queryKey: ['conversations', id], enabled: !!id,
    queryFn: async () => { const res: any = await getConversations(id!); return res?.items || [] },
  })

  // Filter conversations by search
  const filteredConvs = useMemo(() => {
    if (!convList) return []
    if (!convSearch.trim()) return convList
    return convList.filter((c: any) => c.title?.toLowerCase().includes(convSearch.toLowerCase()))
  }, [convList, convSearch])

  useEffect(() => {
    if (models && models.length > 0 && !modelConfigId) {
      const dm = models.find((m: any) => m.is_default) || models[0]
      setModelConfigId(dm.id)
    }
  }, [models, modelConfigId])

  useEffect(() => {
    if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
  }, [messages])

  const loadConversation = useCallback(async (cId: string) => {
    setConvId(cId)
    try {
      const res: any = await getConversation(cId)
      if (res?.messages) {
        setMessages(res.messages)
        const last = [...res.messages].reverse().find((m: any) => m.role === 'assistant')
        if (last?.sources) setSources(last.sources)
        else setSources([])
      }
    } catch { /* empty */ }
  }, [])

  const startNewConv = useCallback(async () => {
    setMessages([]); setSources([]); setConvId(undefined); setLastQuestion('')
    try {
      const res: any = await createConversation(id!)
      setConvId(res.id)
      refetchConvs()
    } catch { /* empty */ }
  }, [id, refetchConvs])

  const handleDeleteConv = (cId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const conv = convList?.find((c: any) => c.id === cId)
    Modal.confirm({
      title: '删除对话',
      content: `确定要删除「${conv?.title || '该对话'}」吗？删除后无法恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteConversation(cId)
          if (cId === convId) { setMessages([]); setSources([]); setConvId(undefined) }
          refetchConvs()
          message.success('对话已删除')
        } catch { /* empty */ }
      },
    })
  }

  const currentModel = (models || []).find((m: any) => m.id === modelConfigId)

  // Check if last assistant message is an error
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')
  const hasError = lastAssistantMsg?.content?.includes('请求失败') || false

  const sendMessage = async (retryQuestion?: string) => {
    const question = retryQuestion || input.trim()
    if (!question || streaming) return
    if (!modelConfigId) { message.warning('请先配置模型 API'); return }

    if (!retryQuestion) {
      setInput('')
      setLastQuestion(question)
      setMessages(prev => [...prev, { role: 'user', content: question }])
    } else {
      // Retry: remove last failed assistant message
      setMessages(prev => {
        const u = [...prev]
        const lastIdx = u.length - 1
        if (lastIdx >= 0 && u[lastIdx].role === 'assistant') u.pop()
        return u
      })
    }

    let cId = convId
    if (!cId) {
      try {
        const res: any = await createConversation(id!, question.slice(0, 30))
        cId = res.id; setConvId(cId); refetchConvs()
      } catch { /* empty */ }
    }

    const msgIndex = retryQuestion ? messages.length : messages.length + 1
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    startStream(
      getAgentChatStreamUrl(id!),
      { question, llm_config_id: modelConfigId, conversation_id: cId },
      (token: string) => {
        setMessages(prev => {
          const u = [...prev]
          if (u[msgIndex] && u[msgIndex].role === 'assistant') {
            u[msgIndex] = { ...u[msgIndex], content: u[msgIndex].content + token }
          }
          return u
        })
      },
      (srcs: any[]) => {
        setSources(srcs || [])
        refetchConvs()
      },
      (err: string) => {
        message.error('请求失败: ' + err)
        setMessages(prev => {
          const u = [...prev]
          if (u[msgIndex] && u[msgIndex].role === 'assistant') {
            u[msgIndex] = { ...u[msgIndex], content: '请求失败，请重试' }
          }
          return u
        })
      },
    )
  }

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); message.success('已复制') }
  const handleFeedback = async () => { message.success('已反馈') }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', gap: 0 }}>
      {/* Conversation sidebar */}
      <div style={{
        width: sidebarCollapsed ? 0 : 260, flexShrink: 0, transition: 'width 0.2s',
        borderRight: sidebarCollapsed ? 'none' : '1px solid #f0f0f0',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong style={{ fontSize: 13 }}>对话历史</Text>
          <Space size={4}>
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={startNewConv} />
            <Button size="small" type="text" icon={<MenuFoldOutlined />} onClick={() => setSidebarCollapsed(true)} />
          </Space>
        </div>
        {/* Conversation search */}
        <div style={{ padding: '6px 8px' }}>
          <Input
            size="small"
            placeholder="搜索对话..."
            prefix={<MessageOutlined style={{ color: '#bbb', fontSize: 12 }} />}
            value={convSearch}
            onChange={e => setConvSearch(e.target.value)}
            allowClear
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
          {!filteredConvs || filteredConvs.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#bbb' }}>
              <MessageOutlined style={{ fontSize: 20 }} />
              <p style={{ marginTop: 6, fontSize: 12 }}>
                {convSearch ? '未找到匹配对话' : '暂无对话'}
              </p>
            </div>
          ) : filteredConvs.map((c: any) => (
            <div key={c.id} onClick={() => loadConversation(c.id)} style={{
              padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 2, fontSize: 12,
              background: convId === c.id ? '#e6f4ff' : 'transparent',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <Tooltip title={c.title}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {c.title}
                </div>
              </Tooltip>
              <DeleteOutlined
                style={{ color: '#ccc', fontSize: 12, flexShrink: 0, marginLeft: 4 }}
                onClick={(e) => handleDeleteConv(c.id, e)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Main chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0 0 10px 0', borderBottom: '1px solid #f0f0f0', marginBottom: 10, gap: 8, flexWrap: 'wrap',
        }}>
          <Space>
            {sidebarCollapsed && <Button size="small" type="text" icon={<MenuUnfoldOutlined />} onClick={() => setSidebarCollapsed(false)} />}
            <RobotOutlined style={{ fontSize: 16, color: '#1a1a1a' }} />
            <Text strong style={{ fontSize: 14 }}>{agent?.name || 'AI 助手'}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{currentModel ? currentModel.label : ''}</Text>
          </Space>
          <Space size={8}>
            <Select size="small" value={modelConfigId} onChange={setModelConfigId} style={{ width: 130 }}
              options={(models || []).map((m: any) => ({ value: m.id, label: m.label + (m.is_default ? ' ※' : '') }))} />
            <Button size="small" icon={<FileTextOutlined />} type={showSources ? 'primary' : 'default'}
              onClick={() => setShowSources(!showSources)} disabled={sources.length === 0} />
          </Space>
        </div>

        <div style={{ flex: 1, display: 'flex', gap: showSources ? 12 : 0, overflow: 'hidden' }}>
          <div ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <RobotOutlined style={{ fontSize: 44, color: '#1a1a1a', marginBottom: 10, opacity: 0.6 }} />
                  <h3>{agent?.name || 'AI 助手'}</h3>
                  <Text type="secondary">{agent?.description || '基于知识库的智能问答助手'}</Text>
                </div>
              </div>
            ) : messages.map((msg, idx) => (
              <div key={idx}>
                {msg.role === 'user' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ maxWidth: '75%', background: '#1a1a1a', color: '#fff', padding: '10px 14px', borderRadius: '10px 10px 4px 10px', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>
                    <Avatar size={28} icon={<UserOutlined />} style={{ backgroundColor: '#1a1a1a', marginLeft: 8, flexShrink: 0 }} />
                  </div>
                )}
                {msg.role === 'assistant' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <Avatar size={28} icon={<RobotOutlined />} style={{ backgroundColor: '#555', marginRight: 8, flexShrink: 0 }} />
                    <div style={{ maxWidth: '75%', minWidth: 60 }}>
                      <div style={{
                        background: msg.content?.includes('请求失败') ? '#fff2f0' : '#f7f8fa',
                        padding: '10px 14px', borderRadius: '10px 10px 10px 4px', fontSize: 14,
                        lineHeight: 1.7, wordBreak: 'break-word',
                        border: msg.content?.includes('请求失败') ? '1px solid #ffccc7' : '1px solid #eee',
                      }}>
                        {msg.content ? <MarkdownViewer content={msg.content} /> : (
                          <Space><span className="typing-dot" style={{ animation: 'typing 1.4s infinite' }}>●</span><span className="typing-dot" style={{ animation: 'typing 1.4s infinite 0.2s' }}>●</span><span className="typing-dot" style={{ animation: 'typing 1.4s infinite 0.4s' }}>●</span></Space>
                        )}
                      </div>
                      {!streaming && idx === messages.length - 1 && sources.length > 0 && (
                        <div style={{ marginTop: 4 }}><Space wrap size={[4,4]}>
                          {sources.map((s: any, si: number) => (
                            <Tag key={si} color="blue" style={{ cursor: 'pointer', fontSize: 11 }} onClick={() => navigate(`/knowledge/${s.knowledge_id}`)}>{s.title}</Tag>
                          ))}
                        </Space></div>
                      )}
                      {!streaming && msg.content && idx === messages.length - 1 && (
                        <Space style={{ marginTop: 4 }}>
                          {msg.content?.includes('请求失败') && (
                            <Button size="small" type="primary" icon={<ReloadOutlined />}
                              onClick={() => sendMessage(lastQuestion)}>重试</Button>
                          )}
                          <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => copyToClipboard(msg.content)} />
                          {!msg.content?.includes('请求失败') && (
                            <>
                              <Button size="small" type="text" icon={<LikeOutlined />} onClick={handleFeedback} />
                              <Button size="small" type="text" icon={<DislikeOutlined />} onClick={handleFeedback} />
                            </>
                          )}
                        </Space>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {showSources && sources.length > 0 && (
            <div style={{ width: 240, flexShrink: 0, overflowY: 'auto', borderLeft: '1px solid #f0f0f0', paddingLeft: 10, fontSize: 12 }}>
              <Text strong><FileTextOutlined /> 来源</Text>
              {sources.map((s: any, idx: number) => (
                <div key={idx} style={{ padding: '6px 8px', margin: '6px 0', borderRadius: 6, background: '#fafafa', border: '1px solid #f0f0f0', cursor: 'pointer' }} onClick={() => navigate(`/knowledge/${s.knowledge_id}`)}>
                  <div style={{ fontWeight: 500 }}>{s.title}</div>
                  <div style={{ color: '#999' }}>相关度: {(s.score * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ paddingTop: 8, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
          <Input.TextArea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder='输入问题，Enter 发送，Shift+Enter 换行' disabled={streaming || !modelConfigId}
            autoSize={{ minRows: 1, maxRows: 4 }} style={{ flex: 1, borderRadius: 8 }} />
          <Button type="primary" icon={<SendOutlined />} onClick={() => sendMessage()}
            loading={streaming} disabled={!input.trim() || !modelConfigId}
            style={{ borderRadius: 8, height: 36 }} />
        </div>
      </div>
    </div>
  )
}
