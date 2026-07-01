# AI 知识库管理平台 — 项目现状总结

> **生成日期**: 2026-06-21
> **分支**: `master`
> **最新提交**: `5b84966` — 更新项目 README

---

## 一、项目概述

AI 知识库管理平台是一个面向**企业内部业务知识管理**场景的全栈 Web 应用。平台围绕 **"知识生产 → 知识治理 → 知识检索 → Agent 消费 → 反馈优化"** 构建完整业务闭环，帮助企业将分散的文档（PDF / DOCX / Markdown）转化为可检索、可问答的结构化知识体系。

项目仓库共计 **3 次提交**，于 2026年6月16日初始化，已完成核心功能的 MVP（最小可行产品）阶段。

---

## 二、技术架构全景

### 2.1 总体架构图

```
┌──────────────────────────────────────────┐
│              前端 React 应用              │
│ 知识库管理 / 知识编辑 / 文档导入 / Agent问答 │
│          Chat / 检索 / 看板 / 知识图谱      │
└──────────────────┬───────────────────────┘
                   │ HTTP REST / SSE (流式)
                   ▼
┌──────────────────────────────────────────┐
│            FastAPI 后端服务               │
│ Auth / KB / Knowledge / Document / Search │
│ Agent / Chat / Feedback / Stats / Graph   │
│ Conversation / Model Config               │
└───────────────┬───────────────────┬──────┘
                │                   │
                ▼                   ▼
┌──────────────────────────┐  ┌──────────────────────┐
│  PostgreSQL + pgvector    │  │  Redis + Celery      │
│  业务表 / 向量表 / 日志表  │  │  4 队列异步任务调度    │
└──────────────────────────┘  └──────────────────────┘
                │
                ▼
┌──────────────────────────┐  ┌──────────────────────┐
│  bge-m3 (1024维)         │  │  LLM 服务             │
│  sentence-transformers   │  │  OpenAI-compatible API│
└──────────────────────────┘  └──────────────────────┘
```

### 2.2 技术选型一览

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **前端** | React | 18.3 | UI 框架 |
| | TypeScript | 5.5 | 类型安全 |
| | Vite | 5.3 | 构建工具 |
| | Ant Design | 5.20 | UI 组件库 |
| | React Router | 6.24 | 客户端路由 |
| | TanStack Query | 5.45 | 服务端状态管理 & 缓存 |
| | Zustand | 4.5 | 客户端状态管理（Auth / App） |
| | Axios | 1.7 | HTTP 请求 |
| | react-markdown | 9.0 | Markdown 渲染 |
| | vis-network | (standalone) | 知识图谱可视化 |
| | dayjs | 1.11 | 日期处理 |
| **后端** | FastAPI | 0.115 | Web 框架 |
| | Uvicorn | 0.30 | ASGI 服务器 |
| | Pydantic | 2.8 | 数据校验 |
| | SQLAlchemy | 2.0.31 | ORM |
| | Alembic | 1.13.2 | 数据库迁移 |
| | python-jose | 3.3 | JWT 认证 |
| | passlib + bcrypt | 4.1.3 | 密码哈希 |
| | Celery | 5.4 | 异步任务队列 |
| | Redis | 5.0.8 | 消息代理 + 缓存 |
| | OpenAI SDK | 1.35 | LLM API 客户端 |
| | httpx | 0.27 | HTTP 客户端 |
| | loguru | 0.7 | 日志 |
| **文档解析** | PyMuPDF (fitz) | 1.24 | PDF 解析 (Tier 1) |
| | pdfplumber | 0.9 | PDF 解析 (Tier 2, 中文优化) |
| | pytesseract | 0.3.13 | OCR 识别 (Tier 3 兜底) |
| | pdf2image | 1.17 | PDF 转图片 |
| | python-docx | 1.1.2 | DOCX 解析 |
| | markdown | 3.6 | Markdown 解析 |
| | Pillow | 10.4 | 图片处理 |
| **AI/ML** | sentence-transformers | 3.0 | Embedding 框架 |
| | bge-m3 | BAAI/bge-m3 | 1024 维中文 Embedding 模型 |
| | OpenAI-compatible API | — | LLM 调用（可替换任意兼容模型） |
| **基础设施** | PostgreSQL 16 + pgvector | pgvector/pgvector:pg16 | 数据存储 + 向量检索 |
| | Redis | 7-alpine | 缓存 / 消息队列 |
| | Docker Compose | v3 | 容器编排 |
| | Nginx | — | 反向代理 |

---

## 三、项目结构

```
ai-knowledge-platform/
├── backend/                          # FastAPI 后端
│   ├── app/
│   │   ├── main.py                  # 应用入口，注册 12 个路由模块 + 健康检查 + 异常处理
│   │   ├── api/
│   │   │   ├── deps.py             # 依赖注入
│   │   │   └── routes/             # 12 个路由模块
│   │   │       ├── auth.py         # 登录/登出/获取当前用户
│   │   │       ├── kb.py           # 知识库 CRUD + 状态管理 + 概览
│   │   │       ├── knowledge.py    # 知识条目 CRUD + 发布/停用/切片查询
│   │   │       ├── document.py     # 文档上传/解析/状态/草稿/导入
│   │   │       ├── search.py       # 关键词/语义/混合检索
│   │   │       ├── agent.py        # Agent CRUD + 一键生成 + 问答
│   │   │       ├── chat.py         # SSE 流式问答 + 反馈提交
│   │   │       ├── feedback.py     # 反馈提交/查询
│   │   │       ├── stats.py        # 统计总览/热门知识/反馈/无答案/最近问答
│   │   │       ├── model_config.py # 模型配置 CRUD + 设为默认 + 测试连接
│   │   │       ├── conversation.py # 对话管理（暂存QA历史）
│   │   │       └── graph.py        # 知识图谱 API
│   │   ├── models/                 # 11 个 SQLAlchemy 数据模型
│   │   │   ├── user.py, knowledge_base.py, knowledge_item.py
│   │   │   ├── knowledge_chunk.py, document.py, agent.py
│   │   │   ├── qa_log.py, feedback.py, audit_log.py
│   │   │   ├── model_config.py, conversation.py
│   │   ├── schemas/                # Pydantic 请求/响应模型 (12 个模块)
│   │   ├── repositories/           # 数据访问层 (10 个 Repository)
│   │   ├── services/               # 业务逻辑层 (14 个 Service)
│   │   │   ├── auth_service.py     # 登录认证
│   │   │   ├── kb_service.py       # 知识库管理
│   │   │   ├── knowledge_service.py # 知识条目管理
│   │   │   ├── document_service.py # 文档上传与状态
│   │   │   ├── parser_service.py   # 文档解析（PDF三梯次降级+DOCX+MD）
│   │   │   ├── chunk_service.py    # 文本切片（8种策略）
│   │   │   ├── embedding_service.py # bge-m3 向量化（懒加载+优雅降级）
│   │   │   ├── retrieval_service.py # 多模式检索（关键词/语义/混合）
│   │   │   ├── rag_service.py      # RAG 全链路编排（检索→Prompt→LLM→日志）
│   │   │   ├── llm_service.py      # LLM API 封装（支持动态模型切换）
│   │   │   ├── agent_service.py    # Agent 管理 + 一键生成
│   │   │   ├── feedback_service.py # 用户反馈
│   │   │   ├── stats_service.py    # 统计服务
│   │   │   ├── graph_service.py    # 知识图谱计算（共享标签≥2建边）
│   │   │   ├── audit_service.py    # 审计日志
│   │   │   ├── model_config_service.py # 模型配置管理
│   │   ├── tasks/                  # Celery 异步任务
│   │   │   ├── celery_app.py       # Celery 应用配置（4个专用队列）
│   │   │   ├── document_tasks.py   # 文档解析任务
│   │   │   ├── embedding_tasks.py  # Embedding 生成任务
│   │   │   ├── index_tasks.py      # 索引任务
│   │   │   └── cleanup_tasks.py    # 清理任务
│   │   ├── prompts/                # RAG Prompt 模板文件
│   │   ├── utils/                  # 工具函数
│   │   │   ├── text_cleaner.py     # 文本清洗（通用+PDF专项）
│   │   │   ├── text_splitter.py    # 文本切分
│   │   │   ├── file_utils.py       # 文件处理
│   │   │   ├── hash_utils.py       # 哈希工具
│   │   │   ├── response_utils.py   # 响应格式化
│   │   │   └── time_utils.py       # 时间工具
│   │   ├── core/                   # 核心配置
│   │   │   ├── config.py           # 环境变量配置（28个配置项）
│   │   │   ├── database.py         # 数据库连接（连接池20+40溢出）
│   │   │   ├── security.py         # JWT + bcrypt + 角色权限依赖
│   │   │   ├── exceptions.py       # 6 类业务异常
│   │   │   ├── logging.py          # loguru 日志（控制台+按日滚动文件）
│   │   │   └── constants.py        # 状态枚举常量
│   │   └── tests/
│   │       └── test_auth.py        # 认证模块测试
│   ├── alembic/                    # 数据库迁移脚本
│   ├── scripts/                    # 管理脚本
│   │   ├── init_db.py              # 初始化数据库
│   │   ├── seed_data.py            # 种子数据
│   │   ├── create_admin.py         # 创建管理员
│   │   ├── rebuild_embeddings.py   # 重建向量
│   │   └── clear_demo_data.py      # 清空演示数据
│   ├── Dockerfile                  # 后端镜像（含 Tesseract OCR 中文包）
│   └── requirements.txt            # Python 依赖
├── frontend/                        # React 前端
│   └── src/
│       ├── pages/                   # 17 个页面组件
│       │   ├── Dashboard/          # 工作台（统计卡片+热门知识+最近问答）
│       │   ├── KnowledgeBase/      # 知识库列表 + 详情（含知识图谱Tab）
│       │   ├── Knowledge/          # 知识条目列表/详情/编辑
│       │   ├── DocumentImport/     # 文档上传与导入管理
│       │   ├── Agent/              # Agent 列表/配置/Chat 问答页面
│       │   ├── Search/             # 知识检索页面
│       │   ├── Stats/              # 数据统计看板
│       │   ├── Login/              # 登录页面
│       │   └── Settings/           # 模型配置管理
│       ├── api/                    # 13 个 API 调用模块
│       ├── components/             # 通用组件（MarkdownViewer, StatusTag）
│       ├── hooks/                  # 自定义 Hooks（useAuth, useChatStream）
│       ├── store/                  # Zustand 状态（authStore, appStore）
│       ├── types/                  # TypeScript 类型定义（6个模块）
│       ├── utils/                  # 工具函数（constants, formatTime, permission）
│       ├── layouts/                # 布局组件（BasicLayout, AuthLayout）
│       └── router/                 # 路由配置（8个菜单路由 + 隐藏路由）
├── docker/                         # Docker 配置
│   ├── nginx/                      # Nginx 配置
│   ├── postgres/init.sql           # PostgreSQL 初始化脚本
│   └── redis/                      # Redis 配置
├── docs/                           # 项目文档
│   ├── architecture.md             # 架构设计
│   ├── api.md                      # API 接口文档
│   ├── database.md                 # 数据库设计
│   ├── rag_design.md               # RAG 链路设计
│   ├── demo_script.md              # 演示脚本
│   └── project_summary.md          # 本文档
├── scripts/                        # 运维脚本
│   ├── build_all.sh                # 构建所有镜像
│   ├── dev_start.sh                # 开发环境启动
│   ├── dev_stop.sh                 # 开发环境停止
│   └── reset_db.sh                 # 数据库重置
├── docker-compose.yml              # 5 个服务编排（postgres/redis/celery/backend/frontend）
└── .env / .env.example             # 环境变量
```

---

## 四、已完成功能清单

### 4.1 认证与权限 (`Auth`)

| 功能 | 状态 | 说明 |
|------|------|------|
| 用户登录 | ✅ | JWT Token 认证，bcrypt 密码哈希 |
| 获取当前用户信息 | ✅ | `/api/auth/me` |
| 登出 | ✅ | 客户端清除 Token |
| 角色权限控制 | ✅ | 三级角色：admin / knowledge_admin / user |
| 路由级权限守卫 | ✅ | `require_admin` / `require_role` 依赖注入 |
| 用户状态校验 | ✅ | 仅 `active` 用户可访问 |
| 401 自动跳转登录 | ✅ | Axios 拦截器 + 前端路由守卫 |

### 4.2 知识库管理 (`Knowledge Base`)

| 功能 | 状态 | 说明 |
|------|------|------|
| 创建知识库 | ✅ | 名称、描述、业务域 |
| 查询知识库列表 | ✅ | 分页、关键词搜索、域名/状态筛选 |
| 查询知识库详情 | ✅ | 含基本信息 + 知识条目表格 |
| 更新知识库 | ✅ | 名称、描述、域名等字段 |
| 删除知识库 | ✅ | 软删除 |
| 启停知识库 | ✅ | enabled / disabled 状态切换 |
| 知识库概览统计 | ✅ | 知识总数、可用数、最近更新等 |

### 4.3 知识条目管理 (`Knowledge Item`)

| 功能 | 状态 | 说明 |
|------|------|------|
| 手动创建知识 | ✅ | 标题、正文、摘要、分类、标签 |
| 查询知识列表 | ✅ | 按 KB、关键词、分类、标签、状态多条件筛选 |
| 查询知识详情 | ✅ | 含 content + chunk 切片信息 |
| 编辑知识 | ✅ | 全部字段可更新 |
| 发布知识 | ✅ | draft → available，触发 embedding 生成 |
| 停用知识 | ✅ | available → unavailable，不再参与检索 |
| 软删除知识 | ✅ | 标记 deleted，不清除数据 |
| 查看知识切片 | ✅ | 展示该知识的所有 chunk 及其元数据 |
| 知识来源追溯 | ✅ | manual / document / ai_extract / dialogue |

### 4.4 文档导入 (`Document Import`)

| 功能 | 状态 | 说明 |
|------|------|------|
| 文件上传 | ✅ | 支持 PDF / DOCX / Markdown，限 50MB |
| PDF 文本提取 | ✅ | **三梯次降级**：PyMuPDF → pdfplumber → OCR |
| DOCX 文本提取 | ✅ | 段落级提取 |
| Markdown 文本提取 | ✅ | 先转 HTML 再剥离标签取纯文本 |
| 乱码检测 | ✅ | 7 项启发式信号判断 PDF 提取质量 |
| 异步文档解析 | ✅ | Celery 任务，后台切分+生成知识草稿 |
| 解析状态追踪 | ✅ | uploaded → parsing → parsed → failed → imported |
| 查看解析草稿 | ✅ | 每个文档关联的知识草稿列表 |
| 批量导入草稿 | ✅ | 选中草稿一键发布为知识条目 |

### 4.5 文本切片 (`Chunking`)

| 功能 | 状态 | 说明 |
|------|------|------|
| 自动检测 | ✅ | 中文结构 → 标题 → 段落 → 固定长度，逐级降级 |
| 中文文档结构 | ✅ | 识别"第X章"、"X.X节"、中文编号等8种模式 |
| Markdown 标题切分 | ✅ | H1/H2/H3 三级标题切分 |
| 段落切分 | ✅ | 按空行聚合，智能合并短段落 |
| 句子切分 | ✅ | 按句末标点切分+合并 |
| 固定长度切分 | ✅ | 800 字符 + 100 字符重叠 (可配置) |
| 大段落子切分 | ✅ | 超长段落自动递归固定长度切分 |
| Token 估算 | ✅ | 中英文混合估算 |

### 4.6 向量化与存储 (`Embedding`)

| 功能 | 状态 | 说明 |
|------|------|------|
| bge-m3 模型加载 | ✅ | 懒加载，首次使用时从 HuggingFace 缓存加载 |
| 单条查询编码 | ✅ | `encode_query()` with normalize |
| 批量文本编码 | ✅ | `encode_batch()` 批次 32 条 |
| 优雅降级 | ✅ | 模型未加载时关键词检索仍可用 |
| 异步 Embedding 生成 | ✅ | Celery 任务，知识发布后异步生成向量 |
| pgvector 存储 | ✅ | vector(1024) 类型，IVFFlat 索引 |

### 4.7 检索 (`Search & Retrieval`)

| 功能 | 状态 | 说明 |
|------|------|------|
| 关键词检索 | ✅ | PostgreSQL ILIKE + 全文搜索 |
| 语义检索 | ✅ | bge-m3 向量 + pgvector 余弦相似度 |
| 混合检索 | ✅ | 关键词 + 语义两路合并去重排序 |
| 知识状态过滤 | ✅ | 仅检索 `available` 知识 + `enabled` 知识库 |
| 相似度阈值过滤 | ✅ | 默认 0.5，低于阈值的召回丢弃 |
| 检索结果富化 | ✅ | 关联知识标题、分类、标签、来源文件 |
| 优雅降级 | ✅ | 语义检索失败时自动退回关键词检索 |

### 4.8 Agent 专家问答 (`Agent & RAG`)

| 功能 | 状态 | 说明 |
|------|------|------|
| Agent CRUD | ✅ | 创建/查看/编辑/停用 Agent |
| Agent 自动生成 | ✅ | 基于知识库一键生成专家 Agent（含 System Prompt） |
| 绑定知识库 | ✅ | 一个 Agent 可绑定多个知识库 |
| 普通问答 | ✅ | 全量返回 RAG 答案 + 引用来源 |
| SSE 流式问答 | ✅ | Server-Sent Events 逐 Token 推送 |
| RAG Prompt 模板 | ✅ | 独立 Prompt 文件，可修改 |
| 引用来源展示 | ✅ | chunk → knowledge → source_file 回溯链路 |
| 无答案拒答 | ✅ | 检索为空/相似度过低/知识不可用时明确告知 |
| 模型动态切换 | ✅ | 对话中可切换 LLM 模型配置 |
| 对话管理 | ✅ | 创建/查看/删除对话会话，保留历史消息 |

### 4.9 对话管理 (`Conversation`)

| 功能 | 状态 | 说明 |
|------|------|------|
| 对话列表 | ✅ | 按 Agent + 用户查询对话列表 |
| 创建对话 | ✅ | 新建会话，可设置标题 |
| 加载对话 | ✅ | 恢复历史对话及其消息 |
| 删除对话 | ✅ | 删除整个对话会话 |
| 侧边栏切换 | ✅ | ChatPage 左侧对话列表，可折叠/搜索 |

### 4.10 用户反馈 (`Feedback`)

| 功能 | 状态 | 说明 |
|------|------|------|
| 点赞/点踩 | ✅ | 对 QA 日志提交反馈 |
| 反馈原因 | ✅ | 可选填写 feedback_reason |
| 反馈关联 | ✅ | 反馈关联到具体 QA Log |
| 反馈统计 | ✅ | 点赞/点踩占比统计 |

### 4.11 数据看板 (`Dashboard & Stats`)

| 功能 | 状态 | 说明 |
|------|------|------|
| 总览统计 | ✅ | 知识总数、可用数、问答数、点赞数 |
| 热门知识排行 | ✅ | 按被引用次数排序 Top N |
| 反馈统计 | ✅ | 点赞/点踩/未反馈分布 |
| 无答案问题列表 | ✅ | 便于知识管理员发现知识盲区 |
| 最近问答列表 | ✅ | 最近的 QA 记录及状态 |

### 4.12 知识图谱 (`Knowledge Graph`)

| 功能 | 状态 | 说明 |
|------|------|------|
| 图谱可视化 | ✅ | vis-network 力导向图渲染 |
| 节点（知识条目） | ✅ | 按状态着色、度数调整大小 |
| 边（标签关联） | ✅ | 共享 ≥2 个标签的知识之间建立连线 |
| 节点详情弹窗 | ✅ | 点击节点查看标题、分类、状态、标签、关联数 |
| 截断提示 | ✅ | 超过 200 条节点时显示截断提示 |
| 空边提示 | ✅ | 无关联关系时明确告知 |

### 4.13 模型配置管理 (`Model Config`)

| 功能 | 状态 | 说明 |
|------|------|------|
| 模型配置 CRUD | ✅ | 添加/编辑/删除 LLM 模型配置 |
| 设为默认 | ✅ | 标记默认配置 |
| 连接测试 | ✅ | 测试 API Key 和 Base URL 是否可用 |

### 4.14 异步任务系统 (`Celery`)

| 功能 | 状态 | 说明 |
|------|------|------|
| 4 个专用队列 | ✅ | document_queue / embedding_queue / index_queue / maintenance_queue |
| 任务重试 | ✅ | 最多 3 次，指数退避 |
| 自动路由 | ✅ | 按模块自动路由到对应队列 |

### 4.15 系统基础能力

| 功能 | 状态 | 说明 |
|------|------|------|
| 健康检查 | ✅ | `/health` 端点，检测 DB + Redis + Embedding 状态 |
| 全局异常处理 | ✅ | 6 类业务异常 + 通用兜底 |
| 结构化日志 | ✅ | loguru，控制台彩色 + 按日文件滚动 (保留 30 天) |
| CORS 配置 | ✅ | 可配置多源跨域 |
| Docker 一键部署 | ✅ | `docker compose up -d` |
| 数据库自动建表 | ✅ | 应用启动时 `Base.metadata.create_all` |
| 种子数据 | ✅ | 预置测试账号和管理员 |

---

## 五、数据库设计

### 5.1 实体关系

```
users (用户)
  ├── knowledge_bases (知识库) ── knowledge_items (知识条目) ── knowledge_chunks (知识切片)
  │                                      │
  ├── agents (专家Agent) ────────────────┘
  │
  ├── documents (文档)
  │
  ├── qa_logs (问答日志) ── feedbacks (反馈)
  │
  ├── conversations (对话会话)
  │
  └── audit_logs (审计日志)

model_configs (模型配置)
```

### 5.2 核心表一览

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `users` | 用户 | username, password_hash, role(admin/knowledge_admin/user), status |
| `knowledge_bases` | 知识库 | name, domain, status(enabled/disabled/deleted), owner_id |
| `knowledge_items` | 知识条目 | title, content, category, tags(JSONB), status(draft/available/unavailable/deleted), source_type |
| `knowledge_chunks` | 知识切片 | chunk_text, embedding(vector(1024)), chunk_index, metadata(JSONB) |
| `documents` | 文档 | filename, file_path, file_type, parse_status(5种状态) |
| `agents` | Agent | name, kb_ids(JSONB), prompt_config, answer_style, citation_policy |
| `qa_logs` | 问答日志 | question, answer, retrieved_chunk_ids(JSONB), cited_knowledge_ids(JSONB), status, feedback, latency_ms |
| `feedbacks` | 反馈 | qa_log_id, feedback_type(like/dislike), feedback_reason |
| `conversations` | 对话 | agent_id, user_id, title |
| `model_configs` | 模型配置 | name, base_url, api_key(加密), model_name, is_default |
| `audit_logs` | 审计日志 | action, resource_type, resource_id, detail(JSONB) |

### 5.3 索引策略

- 业务索引：kb_id, knowledge_id, status, category, created_at
- 向量索引：pgvector IVFFlat 索引 (`idx_chunk_embedding_ivfflat`)，余弦相似度，100 个 list

---

## 六、RAG 检索问答链路

完整的 RAG 链路如下：

```
1. 用户提问
       ↓
2. 关键词检索 (ILIKE) + 语义检索 (bge-m3 → pgvector cosine)
       ↓
3. 两路合并去重，按相似度排序，取 Top K
       ↓
4. 校验：阈值过滤(>0.5) + 知识状态过滤(available) + 知识库状态过滤(enabled)
       ↓
5. 检索结果为空？→ 返回无答案提示 (no_answer)
       ↓ 有结果
6. 构建 RAG Prompt：System Prompt + User Message (含 context)
       ↓
7. 调用 LLM (OpenAI-compatible API)
       ↓
8. 返回答案 + 引用来源 (chunk → knowledge_item → source_file)
       ↓
9. 记录 QA Log (含召回 chunk 列表、引用列表、耗时)
       ↓
10. 用户反馈 (点赞/点踩) → 更新 QA Log
```

**防幻觉设计**:
- 检索相似度阈值过滤（默认 0.5）
- 知识状态校验（仅 available 参与检索）
- 知识库状态校验（仅 enabled 参与检索）
- 引用来源回溯（chunk → knowledge → file）
- 无答案明确拒答（不编造内容）

**流式输出**: SSE 协议，先推送 sources，再逐 token 推送 `data: {"token": "..."}`，最后 `data: [DONE]`

---

## 七、PDF 文档解析三梯次降级

```
Tier 1: PyMuPDF (fitz)
  ├─ 成功 + 非乱码 → 返回文本
  └─ 失败或乱码 → Tier 2

Tier 2: pdfplumber
  ├─ 成功 + 非乱码 → 返回文本
  └─ 失败或乱码 → Tier 3

Tier 3: Tesseract OCR (中文包)
  ├─ 成功 → 返回文本
  └─ 失败 → 返回最佳可用文本
```

**乱码检测（7 项启发式信号）**:
1. 文本过短/为空
2. 中文字符序列占比过低
3. 单字符行超过 50%
4. 常用汉字完全缺失
5. CJK 字符间异常空格过多
6. U+FFFD 替换字符
7. CJK 字符唯一比例异常高

---

## 八、文本切片 8 种策略

| 策略 | 方法名 | 适用场景 |
|------|--------|----------|
| `auto` | 自动检测 | 通用，依次尝试 cn→heading→paragraph→fixed |
| `cn` | 中文文档结构 | 标准/规范类文档（第X章、编号节） |
| `fixed` | 固定长度 | 无结构纯文本 |
| `h1`/`h2`/`h3` | Markdown 标题 | 有层级标题的文档 |
| `sentence` | 句号切分 | 叙述性文档 |
| `paragraph` | 段落切分 | 已排版好的文档 |

---

## 九、前端页面路由

### 9.1 菜单路由（8 项）

| 路径 | 页面 | 图标 | 说明 |
|------|------|------|------|
| `/dashboard` | 工作台 | DashboardOutlined | 统计概览 + 热门 + 最近 |
| `/knowledge-bases` | 知识库列表 | AppstoreOutlined | 知识库管理 |
| `/knowledge` | 知识条目列表 | FileTextOutlined | 跨库知识浏览 |
| `/document-import` | 文档导入 | UploadOutlined | 上传 + 解析 |
| `/agents` | 专家 Agent | RobotOutlined | Agent 列表 |
| `/search` | 知识检索 | SearchOutlined | 关键词/语义/混合 |
| `/stats` | 数据看板 | BarChartOutlined | 统计图表 |
| `/settings` | 模型配置 | SettingOutlined | LLM 模型管理 |

### 9.2 隐藏路由（5 项）

| 路径 | 页面 |
|------|------|
| `/knowledge-bases/:id` | 知识库详情（含知识图谱 Tab） |
| `/knowledge/:id` | 知识详情 |
| `/knowledge/:id/edit` | 知识编辑 |
| `/agents/:id/config` | Agent 配置 |
| `/agents/:id/chat` | Agent Chat 对话 |

---

## 十、前端状态管理

| Store | 库 | 存储内容 | 持久化 |
|-------|-----|----------|--------|
| `authStore` | Zustand + persist | token, username, role, userId | ✅ localStorage (`akp-auth`) |
| `appStore` | Zustand | sidebar collapsed | ❌ 内存 |
| 服务端状态 | TanStack Query | 所有 API 数据缓存 | ✅ 自动缓存+失效 |

---

## 十一、环境变量配置（28 项）

| 分类 | 变量 | 默认值 | 说明 |
|------|------|--------|------|
| DB | `DATABASE_URL` | PostgreSQL 连接串 | 同步连接 |
| DB | `DATABASE_URL_ASYNC` | asyncpg 连接串 | 异步连接 |
| Redis | `REDIS_URL` | `redis://localhost:6379/0` | 消息队列 |
| JWT | `JWT_SECRET_KEY` | (需修改) | 签名密钥 |
| JWT | `JWT_ALGORITHM` | HS256 | 签名算法 |
| JWT | `JWT_EXPIRE_MINUTES` | 1440 | 24 小时 |
| 上传 | `UPLOAD_DIR` | `./uploads` | 存储目录 |
| 上传 | `MAX_UPLOAD_SIZE_MB` | 50 | 大小限制 |
| Embedding | `BGE_M3_MODEL_PATH` | `BAAI/bge-m3` | 模型路径 |
| Embedding | `EMBEDDING_DEVICE` | cpu | 推理设备 |
| Embedding | `EMBEDDING_BATCH_SIZE` | 32 | 批量大小 |
| LLM | `LLM_BASE_URL` | OpenAI API | LLM 地址 |
| LLM | `LLM_API_KEY` | (需配置) | API Key |
| LLM | `LLM_MODEL_NAME` | `gpt-3.5-turbo` | 模型名 |
| LLM | `LLM_MAX_TOKENS` | 2048 | 最大输出 |
| LLM | `LLM_TEMPERATURE` | 0.1 | 温度（低=更确定） |
| 切片 | `CHUNK_SIZE` | 800 | 切片大小 |
| 切片 | `CHUNK_OVERLAP` | 100 | 重叠长度 |
| 检索 | `RETRIEVAL_TOP_K` | 5 | 召回数量 |
| 检索 | `SIMILARITY_THRESHOLD` | 0.5 | 相似度阈值 |
| CORS | `CORS_ORIGINS` | localhost:5173,3000 | 跨域来源 |
| Admin | `DEFAULT_ADMIN_USERNAME` | admin | 管理员账号 |
| Admin | `DEFAULT_ADMIN_PASSWORD` | admin123 | 管理员密码 |
| Admin | `DEFAULT_ADMIN_EMAIL` | admin@example.com | 管理员邮箱 |

---

## 十二、部署方式

### Docker Compose（推荐）

```bash
cd ai-knowledge-platform
cp .env.example .env   # 编辑填入 LLM API Key
docker compose up -d    # 启动 5 个服务
```

启动的服务：
| 服务 | 容器名 | 端口 |
|------|--------|------|
| PostgreSQL + pgvector | `akp-postgres` | 5432 |
| Redis | `akp-redis` | 6379 |
| Celery Worker | `akp-celery-worker` | — |
| FastAPI Backend | `akp-backend` | 8000 |
| React Frontend | `akp-frontend` | 5173 |

### 本地开发

后端：`uvicorn app.main:app --reload --port 8000`
前端：`npm run dev`（Vite 开发服务器）

---

## 十三、项目亮点总结

1. **完整业务闭环**: 知识生产 → 治理 → 检索 → Agent 消费 → 反馈 → 统计优化
2. **PDF 三梯次解析**: PyMuPDF → pdfplumber → OCR，含 7 项启发式乱码检测
3. **8 种文本切片策略**: 覆盖中文标准文档、Markdown、段落、句子等场景
4. **混合检索 + 优雅降级**: 关键词+语义双路检索，向量模型不可用时不影响基本功能
5. **RAG 链路可解释**: 每一步可追溯，chunk → knowledge_item → source_file
6. **防幻觉设计**: 阈值过滤 + 状态校验 + 引用回溯 + 无答案拒答
7. **SSE 流式输出**: 实时逐 Token 推送 + 引用预展示
8. **模型热切换**: LLM 和 Embedding 服务独立封装，可运行时切换模型配置
9. **异步任务解耦**: Celery 4 队列分工，文档解析和 embedding 生成异步执行
10. **工程化架构**: 清晰的 API → Service → Repository 三层架构
11. **知识图谱可视化**: 基于共享标签的关系网络，vis-network 力导向图
12. **Docker 一键部署**: 完整的 Docker Compose 编排，后端镜像内置 Tesseract OCR 中文包

---

## 十四、待实现功能（路线图）

- [ ] AI 自动提炼知识候选项
- [ ] 高频无答案问题聚类分析
- [ ] 低满意回答自动分析
- [ ] 知识版本管理与变更对比
- [ ] 多知识库联合问答
- [ ] Skill / 插件调用管理
- [ ] 多模态知识理解（图片、表格）
- [ ] 知识质量评分与治理看板

---

## 十五、API 端点汇总

共计 **12 个路由模块**，**45+ 个 API 端点**：

| 模块 | 端点 | 方法 |
|------|------|------|
| Auth | `/api/auth/login`, `/me`, `/logout` | POST, GET, POST |
| KB | `/api/kb`, `/api/kb/{id}`, `/api/kb/{id}/status`, `/api/kb/{id}/overview` | GET/POST, GET/PUT/DELETE, PATCH, GET |
| Knowledge | `/api/knowledge`, `/api/knowledge/{id}`, `/{id}/publish`, `/{id}/disable`, `/{id}/chunks` | GET/POST, GET/PUT/DELETE, PATCH, PATCH, GET |
| Documents | `/api/documents/upload`, `/{id}/parse`, `/{id}/status`, `/{id}/drafts`, `/{id}/import` | POST, POST, GET, GET, POST |
| Search | `/api/search/keyword`, `/semantic`, `/hybrid` | POST×3 |
| Agents | `/api/agents`, `/api/agents/{id}`, `/{id}/disable`, `/generate`, `/{id}/chat`, `/{id}/chat/stream` | GET/POST, GET/PUT, PATCH, POST, POST, POST |
| Chat | `/api/chat/stream`, `/api/chat/feedback` | POST, POST |
| Feedback | `/api/feedback`, `/api/feedback/qa/{id}` | POST, GET |
| Stats | `/api/stats/overview`, `/hot-knowledge`, `/feedback`, `/no-answer`, `/recent-qa` | GET×5 |
| Models | `/api/models`, `/api/models/{id}`, `/{id}/default`, `/test-connection` | GET/POST, GET/PUT/DELETE, PUT, POST |
| Conversations | `/api/conversations`, `/{id}` | GET/POST, GET/DELETE |
| Graph | `/api/kb/{kb_id}/graph` | GET |

---

## 十六、测试账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | `admin` | `admin123` |
| 普通用户 | `user` | `user123` |

---

*本文档由 Claude Code 基于项目源码分析生成，反映 2026-06-21 时 `master` 分支的项目现状。*
