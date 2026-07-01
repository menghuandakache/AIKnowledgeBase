import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, Upload, Button, Select, Table, message, Space, Spin, Steps, Tabs, Tag } from 'antd'
import { InboxOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import { getKnowledgeBases } from '../../api/kb'
import {
  uploadDocument,
  parseDocument,
  getDocumentStatus,
  getDocumentDrafts,
  getDocumentList,
  importDraftKnowledge,
} from '../../api/document'
import type { DocumentItem, DraftKnowledgeItem } from '../../types/document'
import StatusTag from '../../components/StatusTag'
import { formatTime } from '../../utils/formatTime'

const { Dragger } = Upload

export default function DocumentImportPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // ─── URL-derived state (survives navigation) ───
  const kbId = searchParams.get('kb_id') || ''
  const activeTab = searchParams.get('tab') || 'import'
  const activeDocId = searchParams.get('doc_id') || ''

  // ─── Ephemeral state (new import flow only) ───
  const [uploadedDoc, setUploadedDoc] = useState<DocumentItem | null>(null)
  const [step, setStep] = useState(0)
  const [drafts, setDrafts] = useState<DraftKnowledgeItem[]>([])
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [chunkMethod, setChunkMethod] = useState<string>('auto')
  // Immediate parsing flag — set right after API call, before polling confirms
  const [parsingNow, setParsingNow] = useState(false)

  // Chunk method options
  const chunkMethodOptions = [
    { value: 'auto', label: '自动检测（推荐）' },
    { value: 'cn', label: '中文文档结构（第X章/X.X节）' },
    { value: 'h1', label: 'Markdown 一级标题（#）' },
    { value: 'h2', label: 'Markdown 二级标题（##）' },
    { value: 'h3', label: 'Markdown 三级标题（###）' },
    { value: 'sentence', label: '按句号切分' },
    { value: 'fixed', label: '固定长度切分' },
    { value: 'paragraph', label: '按段落切分' },
  ]

  // ─── Helpers to update URL ───
  const updateSearchParam = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (value) newParams.set(key, value)
    else newParams.delete(key)
    setSearchParams(newParams, { replace: true })
  }

  const setKbId = (id: string) => {
    updateSearchParam('kb_id', id)
  }

  const setActiveTab = (tab: string) => {
    updateSearchParam('tab', tab)
  }

  const setActiveDocId = (id: string) => {
    updateSearchParam('doc_id', id)
  }

  // ─── Queries ───

  // KB list
  const { data: kbList } = useQuery({
    queryKey: ['kb-list-import'],
    queryFn: async () => {
      const res: any = await getKnowledgeBases({ page_size: 100 })
      return res?.items || []
    },
  })

  // Document history list
  const { data: docListData, isLoading: docListLoading } = useQuery({
    queryKey: ['document-list', kbId, historyPage],
    queryFn: async () => {
      const res: any = await getDocumentList({ kb_id: kbId, page: historyPage, page_size: 20 })
      return res as { items: DocumentItem[]; total: number; page: number; page_size: number }
    },
    enabled: !!kbId,
  })

  // Polling: document parse status
  const { data: polledStatus } = useQuery({
    queryKey: ['document-status', activeDocId],
    queryFn: async () => {
      const res: any = await getDocumentStatus(activeDocId)
      return res
    },
    enabled: !!activeDocId,
    refetchInterval: (query) => {
      const status = query.state.data?.parse_status
      return status === 'parsing' ? 2000 : false
    },
  })

  // Drafts for current document (fetched when status becomes "parsed")
  const { data: fetchedDrafts } = useQuery({
    queryKey: ['document-drafts', activeDocId || uploadedDoc?.id],
    queryFn: async () => {
      const docId = activeDocId || uploadedDoc?.id
      const res: any = await getDocumentDrafts(docId!)
      return (res || []) as DraftKnowledgeItem[]
    },
    enabled: !!(
      activeDocId || uploadedDoc?.id
    ) && (
      polledStatus?.parse_status === 'parsed' ||
      (uploadedDoc && !activeDocId)
    ),
  })

  // When drafts are fetched from API, update local state and auto-select all
  useEffect(() => {
    if (fetchedDrafts && fetchedDrafts.length > 0) {
      setDrafts(fetchedDrafts)
      setSelectedDraftIds(new Set(fetchedDrafts.map(d => d.id)))
    }
  }, [fetchedDrafts])

  // ─── Upload props ───
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.pdf,.docx,.doc,.md,.markdown',
    showUploadList: false,
    customRequest: async ({ file, onSuccess, onError }: any) => {
      try {
        const res: any = await uploadDocument(kbId, file)
        setUploadedDoc(res)
        setStep(1)
        setDrafts([])
        setSelectedDraftIds(new Set())
        setParsingNow(false)
        onSuccess?.(res)
        message.success('上传成功')
      } catch (e: any) {
        onError?.(e)
        message.error('上传失败')
      }
    },
  }

  // ─── Actions ───

  const handleParse = async (docId?: string) => {
    const targetDocId = docId || uploadedDoc?.id
    if (!targetDocId) return

    try {
      const res: any = await parseDocument(targetDocId, chunkMethod)

      if (res.parse_status === 'parsed') {
        // Synchronous fallback: parsing completed inline (Celery unavailable)
        // Fetch drafts directly without waiting for polling cycle
        const draftsRes: any = await getDocumentDrafts(targetDocId)
        const draftList = (draftsRes || []) as DraftKnowledgeItem[]
        setDrafts(draftList)
        setSelectedDraftIds(new Set(draftList.map((d: DraftKnowledgeItem) => d.id)))
        setActiveDocId(targetDocId)
        setStep(2)
        setParsingNow(false)
        message.success(`解析完成，生成 ${draftList.length} 条草稿`)
        queryClient.invalidateQueries({ queryKey: ['document-list', kbId] })
      } else {
        // Async: parsing dispatched
        message.success('解析任务已提交，后台处理中...')
        setActiveDocId(targetDocId)
        setStep(2)
        setParsingNow(true) // Show spinner immediately, don't wait for polling
      }

      if (docId) {
        // Triggered from history tab
        queryClient.invalidateQueries({ queryKey: ['document-list', kbId] })
        setActiveTab('import')
      }
    } catch {
      message.error('提交解析失败')
    }
  }

  const handleImport = async () => {
    const docId = activeDocId || uploadedDoc?.id
    if (!docId || selectedDraftIds.size === 0) return

    setImporting(true)
    try {
      const ids = Array.from(selectedDraftIds)
      const res: any = await importDraftKnowledge(docId, ids)
      message.success(`成功导入 ${res.imported_count} 条知识`)
      queryClient.invalidateQueries({ queryKey: ['knowledge-list'] })
      queryClient.invalidateQueries({ queryKey: ['document-list', kbId] })
      setDrafts([])
      setSelectedDraftIds(new Set())
      setStep(0)
      setUploadedDoc(null)
      setActiveDocId('')
      if (res.imported_count > 0) {
        navigate('/knowledge')
      }
    } catch {
      message.error('导入失败')
    } finally {
      setImporting(false)
    }
  }

  // ─── Draft selection helpers ───

  const toggleDraftSelect = (id: string) => {
    setSelectedDraftIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllDrafts = () => {
    setSelectedDraftIds(new Set(drafts.map(d => d.id)))
  }

  const deselectAllDrafts = () => {
    setSelectedDraftIds(new Set())
  }

  const handleViewDrafts = (docId: string) => {
    setActiveDocId(docId)
    setActiveTab('import')
    setStep(3)
  }

  // ─── Derived state ───

  // Clear the immediate parsing flag when polling confirms status changed
  useEffect(() => {
    if (parsingNow && polledStatus?.parse_status && polledStatus.parse_status !== 'parsing') {
      setParsingNow(false)
    }
  }, [parsingNow, polledStatus?.parse_status])

  // Show parsing progress: immediate flag OR polling confirms "parsing"
  const showParsingProgress = (
    activeDocId && (parsingNow || polledStatus?.parse_status === 'parsing')
  )
  const showDraftsFromHistory = activeDocId && polledStatus?.parse_status === 'parsed' && activeTab === 'import'

  // ─── Render helpers ───

  const formatFileSize = (bytes: number | null | undefined) => {
    if (bytes == null) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const historyColumns = [
    { title: '文件名', dataIndex: 'filename', ellipsis: true },
    {
      title: '类型', dataIndex: 'file_type', width: 80,
      render: (v: string) => <Tag>{v.toUpperCase()}</Tag>,
    },
    {
      title: '大小', dataIndex: 'file_size', width: 90,
      render: (v: number | null) => formatFileSize(v),
    },
    {
      title: '解析状态', dataIndex: 'parse_status', width: 100,
      render: (s: string) => <StatusTag status={s} />,
    },
    {
      title: '草稿数', dataIndex: 'draft_count', width: 80,
    },
    {
      title: '上传时间', dataIndex: 'created_at', width: 160,
      render: (v: string) => formatTime(v),
    },
    {
      title: '操作', width: 160,
      render: (_: any, record: DocumentItem) => {
        if (record.parse_status === 'uploaded' || record.parse_status === 'failed') {
          return (
            <Space>
              <Button
                size="small"
                type="primary"
                onClick={() => handleParse(record.id)}
              >
                开始解析
              </Button>
            </Space>
          )
        }
        if (record.parse_status === 'parsing') {
          return (
            <Space>
              <Spin size="small" />
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setActiveDocId(record.id)
                  setActiveTab('import')
                }}
              >
                查看进度
              </Button>
            </Space>
          )
        }
        if (record.parse_status === 'parsed') {
          return (
            <Space>
              <Button
                size="small"
                type="primary"
                icon={<EyeOutlined />}
                onClick={() => handleViewDrafts(record.id)}
              >
                查看草稿
              </Button>
              <Button
                size="small"
                onClick={() => handleParse(record.id)}
              >
                重新解析
              </Button>
            </Space>
          )
        }
        if (record.parse_status === 'imported') {
          return <Tag color="green">已导入</Tag>
        }
        return null
      },
    },
  ]

  const draftsColumns = [
    { title: '标题', dataIndex: 'title', ellipsis: true, width: 250 },
    {
      title: '内容预览', dataIndex: 'content', ellipsis: true,
      render: (v: string) => v?.slice(0, 120),
    },
    {
      title: '分类', dataIndex: 'category', width: 80,
      render: (v: string | null) => v || '-',
    },
    {
      title: '标签', dataIndex: 'tags', width: 100,
      render: (v: string[]) => v?.join(', ') || '-',
    },
  ]

  // Expandable row renderer for full draft content
  const expandedRowRender = (record: DraftKnowledgeItem) => (
    <div style={{ padding: '12px 24px', background: '#fafafa', borderRadius: 4, maxHeight: 400, overflow: 'auto' }}>
      <h4>{record.title}</h4>
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 14 }}>
        {record.content}
      </div>
    </div>
  )

  // ─── Main render ───

  return (
    <div>
      <h2>文档导入</h2>

      {/* KB Selector & Chunk Method */}
      <Card style={{ marginBottom: 24 }}>
        <Space wrap>
          <div>
            <span style={{ marginRight: 8 }}>目标知识库：</span>
            <Select
              placeholder="选择知识库"
              value={kbId || undefined}
              onChange={setKbId}
              style={{ width: 250 }}
              options={(kbList as any[])?.map((k: any) => ({ value: k.id, label: k.name })) || []}
            />
          </div>
          <div>
            <span style={{ marginRight: 8 }}>切分方式：</span>
            <Select
              value={chunkMethod}
              onChange={setChunkMethod}
              style={{ width: 240 }}
              options={chunkMethodOptions}
            />
          </div>
        </Space>
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          // ═══ Tab 1: New Import ═══
          {
            key: 'import',
            label: '新建导入',
            children: (
              <div>
                <Steps
                  current={showParsingProgress ? 1 : showDraftsFromHistory ? 2 : step}
                  style={{ marginBottom: 24 }}
                  items={[
                    { title: '上传文档' },
                    { title: '解析文档' },
                    { title: '确认入库' },
                  ]}
                />

                {/* Step 0: Upload */}
                {(step === 0 && !showParsingProgress && !showDraftsFromHistory) && (
                  <Card>
                    <Dragger {...uploadProps} disabled={!kbId}>
                      <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                      <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                      <p className="ant-upload-hint">支持 PDF、DOCX、Markdown 格式文档</p>
                    </Dragger>
                  </Card>
                )}

                {/* Step 1: File uploaded, ready to parse */}
                {(step === 1 && !showParsingProgress) && (
                  <Card>
                    <p>
                      文件已上传：
                      <strong>{uploadedDoc?.filename}</strong>
                      &nbsp;({formatFileSize(uploadedDoc?.file_size)})
                    </p>
                    <div style={{ marginBottom: 16 }}>
                      <span style={{ marginRight: 8 }}>切分方式：</span>
                      <Select
                        value={chunkMethod}
                        onChange={setChunkMethod}
                        style={{ width: 260 }}
                        options={chunkMethodOptions}
                      />
                    </div>
                    <Button type="primary" onClick={() => handleParse()}>
                      开始解析
                    </Button>
                  </Card>
                )}

                {/* Step 2: Parsing in progress */}
                {showParsingProgress && (
                  <Card>
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      <Spin size="large" />
                      <p style={{ marginTop: 16, fontSize: 16 }}>
                        文档解析中，请稍候...
                      </p>
                      <p style={{ color: '#999' }}>
                        文件：{polledStatus?.filename || uploadedDoc?.filename || '-'}
                        &nbsp;|&nbsp;
                        状态：<StatusTag status="parsing" />
                      </p>
                      <p style={{ color: '#999', fontSize: 12 }}>
                        解析在后台进行，您可以切换到其他页面继续操作
                      </p>
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['document-status', activeDocId] })}
                      >
                        刷新状态
                      </Button>
                    </div>
                  </Card>
                )}

                {/* Auto-advance to drafts when parsing completes while watching */}
                {(showDraftsFromHistory || (step === 2 && polledStatus?.parse_status === 'parsed')) && (
                  <Card>
                    <p style={{ marginBottom: 16 }}>
                      解析完成！文档：<strong>{polledStatus?.filename || uploadedDoc?.filename}</strong>
                      &nbsp;|&nbsp;
                      状态：<StatusTag status="parsed" />
                    </p>
                    {fetchedDrafts && fetchedDrafts.length > 0 && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <span>
                            共生成 <strong>{fetchedDrafts.length}</strong> 条知识草稿，
                            已选 <strong>{selectedDraftIds.size}</strong> 条
                          </span>
                          <Space>
                            <Button size="small" onClick={selectAllDrafts}>全选</Button>
                            <Button size="small" onClick={deselectAllDrafts}>取消全选</Button>
                          </Space>
                        </div>
                        <Table
                          dataSource={fetchedDrafts}
                          rowKey="id"
                          pagination={false}
                          size="small"
                          style={{ marginBottom: 16 }}
                          columns={draftsColumns}
                          expandable={{
                            expandedRowRender,
                            rowExpandable: () => true,
                          }}
                          rowSelection={{
                            selectedRowKeys: Array.from(selectedDraftIds),
                            onChange: (keys) => setSelectedDraftIds(new Set(keys as string[])),
                          }}
                        />
                        <Space>
                          <Button
                            type="primary"
                            onClick={handleImport}
                            loading={importing}
                            disabled={selectedDraftIds.size === 0}
                          >
                            确认导入（{selectedDraftIds.size} 条）
                          </Button>
                          <Button onClick={() => {
                            setStep(0)
                            setUploadedDoc(null)
                            setDrafts([])
                            setSelectedDraftIds(new Set())
                            setActiveDocId('')
                          }}>
                            重新上传
                          </Button>
                        </Space>
                      </>
                    )}
                    {(!fetchedDrafts || fetchedDrafts.length === 0) && (
                      <p style={{ color: '#999' }}>未生成任何知识草稿，请尝试其他切分方式</p>
                    )}
                  </Card>
                )}

                {/* Parse failed */}
                {polledStatus?.parse_status === 'failed' && (
                  <Card>
                    <p style={{ color: 'red' }}>
                      解析失败：{polledStatus?.parse_error || '未知错误'}
                    </p>
                    <Space>
                      <Button type="primary" onClick={() => handleParse(activeDocId)}>
                        重新解析
                      </Button>
                      <Button onClick={() => {
                        setStep(0)
                        setUploadedDoc(null)
                        setActiveDocId('')
                      }}>
                        重新上传
                      </Button>
                    </Space>
                  </Card>
                )}
              </div>
            ),
          },

          // ═══ Tab 2: Import History ═══
          {
            key: 'history',
            label: '导入记录',
            children: (
              <Card>
                <Table
                  dataSource={docListData?.items || []}
                  rowKey="id"
                  loading={docListLoading}
                  columns={historyColumns}
                  pagination={{
                    current: historyPage,
                    pageSize: 20,
                    total: docListData?.total || 0,
                    onChange: (p) => setHistoryPage(p),
                    showTotal: (total) => `共 ${total} 条记录`,
                  }}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  )
}
