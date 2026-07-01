import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhCN} theme={{
        token: {
          colorPrimary: '#1a1a1a',
          colorInfo: '#1a1a1a',
          colorSuccess: '#2e7d32',
          colorWarning: '#e65100',
          colorError: '#c62828',
          borderRadius: 4,
          borderRadiusLG: 8,
          colorBgContainer: '#ffffff',
          colorBgElevated: '#ffffff',
          colorBorder: '#e0e0e0',
          colorBorderSecondary: '#eeeeee',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
          fontSize: 14,
          lineHeight: 1.6,
          controlHeight: 36,
          paddingContentHorizontal: 16,
        },
        components: {
          Button: {
            primaryShadow: 'none',
            defaultBorderColor: '#1a1a1a',
            defaultColor: '#1a1a1a',
          },
          Tag: {
            defaultBg: '#f5f5f5',
            defaultColor: '#1a1a1a',
          },
          Table: {
            headerBg: '#fafafa',
            headerColor: '#1a1a1a',
            rowHoverBg: '#f5f5f5',
          },
          Menu: {
            darkItemBg: '#1a1a1a',
            darkSubMenuItemBg: '#141414',
            darkItemSelectedBg: '#333333',
          },
          Card: {
            paddingLG: 24,
          },
          Input: {
            activeBorderColor: '#1a1a1a',
            hoverBorderColor: '#666666',
          },
          Select: {
            optionSelectedBg: '#f5f5f5',
          },
          Tabs: {
            inkBarColor: '#1a1a1a',
            itemActiveColor: '#1a1a1a',
            itemHoverColor: '#666666',
          },
        },
      }}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
