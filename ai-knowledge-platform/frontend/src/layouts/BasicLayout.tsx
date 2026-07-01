import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import { Layout, Menu, Button, Dropdown, Space, theme, Input, Breadcrumb } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  BookOutlined,
  SearchOutlined,
  HomeOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../store/authStore'
import { menuRoutes } from '../router/routes'

const { Header, Sider, Content } = Layout

// Breadcrumb path → label mapping
const breadcrumbNameMap: Record<string, string> = {
  '/dashboard': '工作台',
  '/knowledge-bases': '知识库',
  '/knowledge': '知识条目',
  '/document-import': '文档导入',
  '/agents': '专家Agent',
  '/search': '知识检索',
  '/stats': '数据看板',
  '/settings': '模型配置',
}

export default function BasicLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })
  const [searchValue, setSearchValue] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const { username, logout } = useAuthStore()
  const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken()

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed))
  }, [collapsed])

  const selectedKey = menuRoutes.find(r => location.pathname.startsWith(r.path))?.path || '/dashboard'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Build breadcrumb items from current path
  const pathSnippets = location.pathname.split('/').filter(i => i)
  const breadcrumbItems = [
    { title: <Link to="/dashboard"><HomeOutlined /></Link> },
  ]
  let currentPath = ''
  for (const snippet of pathSnippets) {
    currentPath += '/' + snippet
    // Check if this is a UUID (detail/edit page) — use the parent path label
    const isUuid = /^[0-9a-f-]{36}$/i.test(snippet)
    if (isUuid) {
      const parentLabel = breadcrumbNameMap[currentPath.replace('/' + snippet, '')] || snippet
      breadcrumbItems.push({ title: `${parentLabel}详情` })
    } else {
      const label = breadcrumbNameMap[currentPath] || snippet
      breadcrumbItems.push({
        title: currentPath !== '/dashboard' ? <Link to={currentPath}>{label}</Link> : label,
      })
    }
  }

  const handleSearch = (value: string) => {
    if (!value.trim()) return
    navigate(`/search?q=${encodeURIComponent(value.trim())}`)
    setSearchValue('')
  }

  const dropdownItems = {
    items: [
      { key: 'user', label: username || 'User', disabled: true },
      { type: 'divider' as const },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout,
      },
    ],
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed}
        style={{ background: '#1a1a1a' }}
        theme="dark">
        <div style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: collapsed ? 16 : 17,
          fontWeight: 600,
          letterSpacing: 1,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <BookOutlined style={{ marginRight: collapsed ? 0 : 8, fontSize: collapsed ? 16 : 18 }} />
          {!collapsed && 'AI知识库'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={({ key }) => navigate(key)}
          items={menuRoutes.map(r => ({
            key: r.path,
            icon: r.icon,
            label: r.name,
          }))}
        />
      </Sider>
      <Layout>
        <Header style={{
          padding: '0 24px',
          background: colorBgContainer,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          gap: 16,
          height: 48,
          lineHeight: 'normal',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ height: 32, display: 'inline-flex', alignItems: 'center' }}
            />
            <Input.Search
              placeholder="全局搜索知识、文档..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onSearch={handleSearch}
              style={{ width: 280, height: 32 }}
              allowClear
            />
          </div>
          <Dropdown menu={dropdownItems}>
            <Space style={{ cursor: 'pointer' }}>
              <UserOutlined />
              {username}
            </Space>
          </Dropdown>
        </Header>
        {/* Breadcrumb */}
        <div style={{ padding: '12px 24px 0 24px' }}>
          <Breadcrumb items={breadcrumbItems} />
        </div>
        <Content style={{
          margin: '16px 24px 24px',
          padding: 28,
          background: '#fff',
          borderRadius: borderRadiusLG,
          minHeight: 280,
          overflow: 'auto',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
