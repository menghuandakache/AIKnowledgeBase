import { useQuery } from '@tanstack/react-query'
import { Row, Col, Card, Statistic, Table, Spin } from 'antd'
import {
  FileTextOutlined, CheckCircleOutlined,
  MessageOutlined, LikeOutlined
} from '@ant-design/icons'
import { getOverviewStats, getHotKnowledge, getRecentQA } from '../../api/stats'
import { formatTime } from '../../utils/formatTime'

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['overview-stats'],
    queryFn: async () => {
      const res: any = await getOverviewStats()
      return res
    },
  })

  const { data: hotKnowledge } = useQuery({
    queryKey: ['hot-knowledge'],
    queryFn: async () => {
      const res: any = await getHotKnowledge(10)
      return res || []
    },
  })

  const { data: recentQA } = useQuery({
    queryKey: ['recent-qa'],
    queryFn: async () => {
      const res: any = await getRecentQA(10)
      return res || []
    },
  })

  if (isLoading) return <Spin style={{ display: 'block', margin: '100px auto' }} />

  return (
    <div>
      <h2>工作台</h2>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="知识总数" value={stats?.total_knowledge || 0} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="可用知识" value={stats?.available_knowledge || 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="问答次数" value={stats?.total_qa || 0} prefix={<MessageOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="点赞数" value={stats?.like_count || 0} prefix={<LikeOutlined />} valueStyle={{ color: '#1a1a1a' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="热门知识">
            <Table
              dataSource={hotKnowledge as any[]}
              rowKey="knowledge_id"
              pagination={false}
              size="small"
              columns={[
                { title: '标题', dataIndex: 'title', ellipsis: true },
                { title: '知识库', dataIndex: 'kb_name', width: 120 },
                { title: '引用次数', dataIndex: 'cite_count', width: 80 },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="最近问答">
            <Table
              dataSource={recentQA as any[]}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: '问题', dataIndex: 'question', ellipsis: true },
                { title: '状态', dataIndex: 'status', width: 80 },
                { title: '时间', dataIndex: 'created_at', width: 140, render: (v: string) => formatTime(v) },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
