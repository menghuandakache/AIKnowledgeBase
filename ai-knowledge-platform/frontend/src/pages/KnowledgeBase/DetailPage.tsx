import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card, Descriptions, Button, Space, Table, Spin, Tabs } from 'antd'
import { PlusOutlined, RobotOutlined, UploadOutlined, ApartmentOutlined } from '@ant-design/icons'
import { getKnowledgeBase, getKnowledgeBaseOverview } from '../../api/kb'
import { getKnowledgeList } from '../../api/knowledge'
import StatusTag from '../../components/StatusTag'
import { formatTime } from '../../utils/formatTime'
import KnowledgeGraph from './components/KnowledgeGraph'

export default function KnowledgeBaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: kb, isLoading } = useQuery({
    queryKey: ['kb', id],
    queryFn: async () => {
      const res: any = await getKnowledgeBase(id!)
      return res
    },
    enabled: !!id,
  })

  const { data: overview } = useQuery({
    queryKey: ['kb-overview', id],
    queryFn: async () => {
      const res: any = await getKnowledgeBaseOverview(id!)
      return res
    },
    enabled: !!id,
  })

  const { data: knowledgeList } = useQuery({
    queryKey: ['knowledge-list', id],
    queryFn: async () => {
      const res: any = await getKnowledgeList({ kb_id: id })
      return res
    },
    enabled: !!id,
  })

  if (isLoading) return <Spin style={{ display: 'block', margin: '100px auto' }} />

  const tabItems = [
    {
      key: 'info',
      label: '基本信息',
      children: (
        <>
          <Card style={{ marginBottom: 24 }}>
            <Descriptions title="基本信息" column={3}>
              <Descriptions.Item label="名称">{kb?.name}</Descriptions.Item>
              <Descriptions.Item label="业务域">{kb?.domain || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态"><StatusTag status={kb?.status} /></Descriptions.Item>
              <Descriptions.Item label="描述">{kb?.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="知识总数">{overview?.total_knowledge || 0}</Descriptions.Item>
              <Descriptions.Item label="可用知识">{overview?.available_knowledge || 0}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatTime(kb?.created_at)}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{formatTime(kb?.updated_at)}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="知识条目列表">
            <Table
              dataSource={knowledgeList?.items || []}
              rowKey="id"
              pagination={{ pageSize: 20 }}
              columns={[
                { title: '标题', dataIndex: 'title', ellipsis: true },
                { title: '分类', dataIndex: 'category', width: 100 },
                {
                  title: '状态', dataIndex: 'status', width: 80,
                  render: (s: string) => <StatusTag status={s} />,
                },
                {
                  title: '更新时间', dataIndex: 'updated_at', width: 160,
                  render: (v: string) => formatTime(v),
                },
                {
                  title: '操作', width: 120,
                  render: (_: any, record: any) => (
                    <Space>
                      <Button size="small" onClick={() => navigate(`/knowledge/${record.id}`)}>查看</Button>
                      <Button size="small" onClick={() => navigate(`/knowledge/${record.id}/edit`)}>编辑</Button>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </>
      ),
    },
    {
      key: 'graph',
      label: (
        <span>
          <ApartmentOutlined /> 知识图谱
        </span>
      ),
      children: id ? <KnowledgeGraph kbId={id} /> : null,
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>{kb?.name || '知识库详情'}</h2>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => navigate(`/knowledge?kb_id=${id}`)}>新建知识</Button>
          <Button icon={<UploadOutlined />} onClick={() => navigate(`/document-import?kb_id=${id}`)}>导入文档</Button>
          <Button type="primary" icon={<RobotOutlined />} onClick={() => navigate(`/agents?kb_id=${id}`)}>创建Agent</Button>
        </Space>
      </div>

      <Tabs items={tabItems} />
    </div>
  )
}
