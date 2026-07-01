import { useEffect, useRef, useState, useCallback } from 'react'
import { Modal, Descriptions, Tag, Spin, Empty, message } from 'antd'
import { DataSet, Network } from 'vis-network/standalone'
import type { GraphNode, GraphEdge } from '../../../types/graph'
import { getKnowledgeGraph } from '../../../api/graph'
import StatusTag from '../../../components/StatusTag'

// Node color by status
const STATUS_COLORS: Record<string, { border: string; background: string }> = {
  available: { border: '#1677ff', background: '#e6f4ff' },
  draft: { border: '#999', background: '#f5f5f5' },
  unavailable: { border: '#ff4d4f', background: '#fff2f0' },
}

interface Props {
  kbId: string
}

export default function KnowledgeGraph({ kbId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[]; truncated: boolean; displayed_nodes: number; total_nodes: number } | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  const loadGraph = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getKnowledgeGraph(kbId, 200)
      setGraphData(data)
      setLoading(false)
    } catch (e: any) {
      setError(e?.message || '加载图谱失败')
      setLoading(false)
    }
  }, [kbId])

  useEffect(() => {
    loadGraph()
  }, [loadGraph])

  // Mount vis-network when data is ready
  useEffect(() => {
    if (!graphData || !containerRef.current) return
    const { nodes, edges } = graphData

    if (nodes.length === 0) {
      networkRef.current?.destroy()
      networkRef.current = null
      return
    }

    // Calculate max degree for sizing
    const maxDegree = Math.max(1, ...nodes.map(n => n.degree))

    // Build vis nodes
    const visNodes = new DataSet(
      nodes.map(n => {
        const colors = STATUS_COLORS[n.status] || STATUS_COLORS.draft
        const size = 15 + (n.degree / maxDegree) * 25 // 15-40px
        return {
          id: n.id,
          label: n.label,
          title: `<b>${n.label}</b><br/>分类: ${n.category || '-'}<br/>标签: ${n.tags.join(', ') || '-'}<br/>关联数: ${n.degree}`,
          color: {
            border: colors.border,
            background: colors.background,
            hover: { border: colors.border, background: colors.background },
          },
          size,
          font: { size: 12, color: '#333' },
          borderWidth: n.degree > 0 ? 2 : 1,
        }
      })
    )

    // Build vis edges
    const visEdges = new DataSet(
      edges.map(e => ({
        from: e.source,
        to: e.target,
        title: `共享标签: ${e.label}`,
        value: e.weight,
        label: e.weight >= 3 ? String(e.weight) : '',
        width: Math.min(e.weight, 5),
        color: { color: '#bbb', hover: '#1677ff' },
        smooth: { type: 'continuous' as const },
      }))
    )

    // Destroy previous instance
    if (networkRef.current) {
      networkRef.current.destroy()
    }

    // Create network
    const network = new Network(containerRef.current, { nodes: visNodes, edges: visEdges }, {
      physics: {
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -50,
          centralGravity: 0.01,
          springLength: 200,
          springConstant: 0.08,
        },
        stabilization: { iterations: 100 },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        zoomView: true,
        dragView: true,
      },
      nodes: {
        shape: 'dot',
        scaling: { min: 10, max: 40 },
      },
      edges: {
        arrows: { to: { enabled: false } },
        font: { size: 10, color: '#666', align: 'middle' },
      },
    })

    // Click handler
    network.on('click', (params: any) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0]
        const node = nodes.find(n => n.id === nodeId)
        if (node) setSelectedNode(node)
      } else {
        setSelectedNode(null)
      }
    })

    networkRef.current = network

    return () => {
      network?.destroy()
      networkRef.current = null
    }
  }, [graphData])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" tip="加载知识图谱..." />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Empty description={error}>
          <a onClick={loadGraph} style={{ cursor: 'pointer' }}>重试</a>
        </Empty>
      </div>
    )
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Empty description="该知识库暂无知识条目" />
      </div>
    )
  }

  return (
    <div>
      {graphData.truncated && (
        <div style={{
          marginBottom: 12, padding: '8px 16px', background: '#fffbe6',
          borderRadius: 6, color: '#ad6800', fontSize: 13,
        }}>
          该知识库共有 {graphData.total_nodes} 条知识，图谱仅展示前 {graphData.displayed_nodes} 条。
        </div>
      )}
      {graphData.edges.length === 0 && (
        <div style={{
          marginBottom: 12, padding: '8px 16px', background: '#e6f4ff',
          borderRadius: 6, color: '#1677ff', fontSize: 13,
        }}>
          该知识库暂无共享标签 ≥2 的关联关系。图中仅展示独立节点。
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: 550,
          border: '1px solid #f0f0f0',
          borderRadius: 8,
          background: '#fafafa',
        }}
      />

      {/* Node detail modal */}
      <Modal
        title="知识条目详情"
        open={!!selectedNode}
        onCancel={() => setSelectedNode(null)}
        footer={null}
        width={520}
      >
        {selectedNode && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="标题">{selectedNode.label}</Descriptions.Item>
            <Descriptions.Item label="分类">{selectedNode.category || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <StatusTag status={selectedNode.status} />
            </Descriptions.Item>
            <Descriptions.Item label="标签">
              {selectedNode.tags.length > 0
                ? selectedNode.tags.map(t => <Tag key={t}>{t}</Tag>)
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="关联条目数">{selectedNode.degree}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
