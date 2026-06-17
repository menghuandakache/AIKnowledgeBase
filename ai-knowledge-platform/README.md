<div align="center">

# 🤖 AI 知识库管理平台

**企业级 AI 知识库管理与专家 Agent 问答平台**

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

</div>

---

## 📖 项目简介

AI 知识库管理平台是一个面向企业业务知识管理场景的全栈应用。平台围绕 **"知识生产 → 知识治理 → 知识检索 → Agent 消费 → 反馈优化"** 构建完整闭环，帮助企业将分散的文档转化为可检索、可问答的结构化知识体系。

### ✨ 核心能力

- 📚 **知识库管理** — 创建、编辑、启用/停用知识库空间，支持多知识库隔离
- 📝 **知识条目管理** — 知识的 CRUD、发布/停用、分类标签管理
- 📄 **文档智能导入** — 支持 PDF / DOCX / Markdown 上传，自动解析文本生成知识草稿
- 🔍 **多模式检索** — 关键词检索、语义检索（bge-m3 向量）、混合检索
- 🎯 **专家 Agent 问答** — 基于知识库的 RAG 智能问答，展示引用来源，支持 SSE 流式输出
- 👍 **用户反馈闭环** — 点赞/点踩评价，问答日志记录，持续优化回答质量
- 📊 **数据看板** — 知识统计、热门知识、问答趋势、满意度分析

---

## 🏗️ 技术架构

| 层级 | 技术选型 |
|------|----------|
| 🖥️ **前端** | React 18 + TypeScript + Vite + Ant Design 5 + React Router 6 + TanStack Query + Zustand |
| ⚙️ **后端** | FastAPI + Pydantic + SQLAlchemy 2.0 + Alembic |
| 💾 **数据库** | PostgreSQL 16 + pgvector（向量存储） |
| ⚡ **缓存/队列** | Redis + Celery（异步任务） |
| 🧠 **Embedding** | bge-m3（1024 维，sentence-transformers） |
| 🤖 **大模型** | OpenAI-compatible API（可接入任意兼容模型） |
| 🐳 **容器化** | Docker Compose 一键部署 |

### 系统架构图

```mermaid
graph TD
    A[前端 React 应用] -->|HTTP / SSE| B[FastAPI 后端]
    B --> C[(PostgreSQL + pgvector)]
    B --> D[(Redis)]
    D --> E[Celery Worker]
    E --> F[文档解析]
    E --> G[Embedding 生成]
    B --> H[bge-m3 向量化]
    B --> I[LLM 服务]
```

```
┌──────────────────────────────────────────────┐
│              前端 React 应用                   │
│  知识库管理 / 知识编辑 / 文档导入 / Agent问答    │
└──────────────────┬───────────────────────────┘
                   │ HTTP / SSE
                   ▼
┌──────────────────────────────────────────────┐
│             FastAPI 后端服务                   │
│  Auth / KB / Knowledge / Document / Search    │
│  Agent / Chat / Feedback / Stats             │
└───────────────┬───────────────────┬──────────┘
                │                   │
                ▼                   ▼
┌──────────────────────────┐  ┌────────────────┐
│  PostgreSQL + pgvector    │  │  Redis + Celery │
│  业务表 / 向量表 / 日志表  │  │  异步任务队列    │
└──────────────────────────┘  └────────────────┘
```

---

## 🚀 快速开始

### 前置要求

- **Docker** & **Docker Compose**（推荐方式）
- Python 3.11+（本地开发）
- Node.js 20+（本地开发）

### 方式一：Docker Compose 一键启动（推荐）

```bash
# 1. 进入项目目录
cd ai-knowledge-platform

# 2. 复制环境变量文件
cp .env.example .env

# 3. 编辑 .env，填入你的 LLM API Key 等配置
vim .env

# 4. 一键启动所有服务
docker compose up -d

# 5. 初始化数据库和种子数据
docker compose exec backend python scripts/seed_data.py
```

**启动完成后访问：**

| 服务 | 地址 |
|------|------|
| 🖥️ 前端页面 | [http://localhost:5173](http://localhost:5173) |
| 📚 API 文档 (Swagger) | [http://localhost:8000/docs](http://localhost:8000/docs) |
| 💚 健康检查 | [http://localhost:8000/health](http://localhost:8000/health) |

### 方式二：本地开发启动

<details>
<summary>展开查看详细步骤</summary>

**后端：**

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 启动依赖服务
docker compose up -d postgres redis

# 初始化数据库
python scripts/init_db.py
python scripts/seed_data.py

# 启动 API 服务
uvicorn app.main:app --reload --port 8000
```

**前端：**

```bash
cd frontend

npm install
npm run dev
```
</details>

### 测试账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 🔑 管理员 | `admin` | `admin123` |
| 👤 普通用户 | `user` | `user123` |

---

## 📁 目录结构

```
AI知识库/
├── ai-knowledge-platform/         # 主项目目录
│   ├── backend/                   # 后端 FastAPI 项目
│   │   ├── app/
│   │   │   ├── main.py           # 应用入口
│   │   │   ├── api/routes/       # API 路由（auth/kb/knowledge/document/search/agent/chat/...）
│   │   │   ├── core/             # 核心配置（config/database/security/logging）
│   │   │   ├── models/           # SQLAlchemy 数据模型
│   │   │   ├── schemas/          # Pydantic 请求/响应模型
│   │   │   ├── repositories/     # 数据访问层
│   │   │   ├── services/         # 业务逻辑层（rag/embedding/llm/parser/...）
│   │   │   ├── tasks/            # Celery 异步任务
│   │   │   ├── prompts/          # RAG Prompt 模板
│   │   │   └── utils/            # 工具函数
│   │   ├── alembic/              # 数据库迁移
│   │   ├── scripts/              # 初始化/管理脚本
│   │   └── requirements.txt
│   ├── frontend/                 # 前端 React 项目
│   │   └── src/
│   │       ├── pages/            # 页面组件（Dashboard/Knowledge/Agent/Search/...）
│   │       ├── api/              # API 调用封装
│   │       ├── components/       # 通用组件
│   │       ├── hooks/            # 自定义 Hooks
│   │       ├── store/            # Zustand 状态管理
│   │       └── types/            # TypeScript 类型定义
│   ├── docker/                   # Docker 配置（postgres/nginx）
│   ├── docs/                     # 项目文档
│   │   ├── architecture.md       # 架构设计文档
│   │   ├── api.md               # API 接口文档
│   │   ├── database.md          # 数据库设计文档
│   │   ├── rag_design.md        # RAG 链路设计文档
│   │   └── demo_script.md       # 演示脚本
│   ├── scripts/                  # 启停脚本
│   └── docker-compose.yml       # Docker Compose 编排
└── README.md                     # 本文件
```

---

## ⚙️ 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://knowledge_user:knowledge_pass@localhost:5432/ai_knowledge_platform` |
| `REDIS_URL` | Redis 连接串 | `redis://localhost:6379/0` |
| `JWT_SECRET_KEY` | JWT 签名密钥 | 需自行修改 |
| `LLM_BASE_URL` | LLM API 地址 | `https://api.openai.com/v1` |
| `LLM_API_KEY` | LLM API 密钥 | 需配置 |
| `LLM_MODEL_NAME` | LLM 模型名称 | `gpt-3.5-turbo` |
| `BGE_M3_MODEL_PATH` | Embedding 模型路径 | `BAAI/bge-m3` |
| `EMBEDDING_DEVICE` | Embedding 推理设备 | `cpu` |
| `CHUNK_SIZE` | 文本切片大小 | `800` |
| `CHUNK_OVERLAP` | 切片重叠长度 | `100` |
| `RETRIEVAL_TOP_K` | 检索返回数量 | `5` |
| `SIMILARITY_THRESHOLD` | 相似度阈值 | `0.5` |
| `MAX_UPLOAD_SIZE_MB` | 上传文件大小限制 | `50` |
| `CORS_ORIGINS` | 允许的跨域来源 | `http://localhost:5173,http://localhost:3000` |

---

## 🎬 演示流程

1. 🔑 登录系统（`admin` / `admin123`）
2. 📚 创建知识库（例如"财务报销知识库"）
3. 📝 手动创建一条知识条目
4. 📄 上传一份制度文档（PDF/DOCX/Markdown）
5. 📋 查看自动解析出的知识草稿并发布
6. 🤖 创建专属专家 Agent
7. 💬 向 Agent 提问，查看 RAG 回答和引用来源
8. 👍 对回答进行点赞/点踩反馈
9. 📊 查看数据统计看板

---

## 🌟 项目亮点

- 🔄 **完整业务闭环** — 知识生产 → 治理 → 检索 → Agent 消费 → 反馈统计
- 🔍 **RAG 链路可解释** — 文档解析 → 文本切片 → embedding → 向量检索 → Prompt 拼接 → LLM 生成 → 引用回溯 → 无答案拒答
- 🏗️ **工程化数据模型** — 清晰区分 KnowledgeBase / KnowledgeItem / KnowledgeChunk / Agent / QALog 实体
- ⚡ **异步任务机制** — Celery + Redis 解耦文档解析和 embedding 生成等耗时操作
- 🔌 **模型可替换** — embedding_service 和 llm_service 独立封装，轻松切换模型
- 🛡️ **防幻觉设计** — 检索阈值过滤、知识状态校验、引用来源回溯

---

## 🗺️ 路线图

- [ ] AI 自动提炼知识候选项
- [ ] 高频无答案问题聚类分析
- [ ] 低满意回答自动分析
- [ ] 知识版本管理与变更对比
- [ ] 多知识库联合问答
- [ ] Skill / 插件调用管理
- [ ] 多模态知识理解（图片、表格）
- [ ] 知识质量评分与治理看板

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 License

MIT © 2025
