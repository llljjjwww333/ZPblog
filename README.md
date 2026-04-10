# ZPblog: A Multi-Agent Framework for Intelligent Content Curation

[![Python](https://img.shields.io/badge/Python-3.9%2B-blue)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-4dc0b5)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2.0-61dafb)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0.8-646cff)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ed)](https://www.docker.com/)
[![Render](https://img.shields.io/badge/Render-configured-00aab7)](https://render.com/)

**ZPblog** is a research-oriented, full-stack content ecosystem designed to explore the integration of Large Language Model (LLM) agents within modern web architectures. Unlike traditional CMS solutions that act as passive data repositories, ZPblog implements an active "Editorial Board" environment, utilizing multi-agent collaboration and hybrid recommendation algorithms to solve the challenges of automated quality control and "cold-start" distribution for new creators.
![HomePage](docs/images/home.png)
***

## Technical Stack

The project features a decoupled architecture with approximately **25,400** lines of original code, ensuring both industrial-grade stability and research reproducibility.

### Backend (Python)

- **Framework**: FastAPI 0.104.1
- **Persistence**: SQLAlchemy 2.0.23 + MySQL 8.0
- **Validation**: Pydantic V2
- **Task Management**: Native asyncio for non-blocking multi-agent orchestration
- **Security**: JWT + bcrypt for robust session-based authentication

### Frontend (TypeScript)

- **Library**: React 18.2.0 + TypeScript 5.2.2
- **Build Tool**: Vite 5.0.8
- **State Management**: React Context + Custom Hooks
- **Real-time**: WebSocket integration for live AI feedback

***

## Core Innovations

### 1. Multi-Agent Collaborative Review

The system simulates a professional publishing workflow. When an article is submitted, the `multi_agent_review_service.py` triggers an asynchronous discussion among five specialized agents:

- **Content Critic**: Evaluates logical depth and thematic consistency.
- **Grammar Checker**: Handles multi-language syntactical corrections.
- **Style Evaluator**: Analyzes tone, sentiment, and brand alignment.
- **Fact-Checker**: Identifies potential factual inaccuracies.
- **Originality Auditor**: Assesses content uniqueness and innovation.

![Multi-Agent Collaborative Review](docs/images/multi-agent-review.png)

### 2. Hybrid Recommendation Engine

Located in `ai_recommendation_service.py`, the engine fuses:

- **Collaborative Filtering (CF)**: Mapping user interests based on historical engagement behavior.
- **Semantic Embedding Analysis**: Using LLM-generated embeddings to match content with relevant readers based on topic resonance, effectively bypassing the "zero-traffic" hurdle for new creators.

![AI Review](docs/images/ai-review.png)

***

## Project Structure

```text
ZPblog/ 
├── backend/src/app/ 
│   ├── api/            # RESTful route controllers and endpoints 
│   ├── core/           # Security, permissions, and socket.py (WebSockets) 
│   ├── model/          # SQLAlchemy relational models 
│   ├── services/       # Core business logic (Multi-agent, Recommendation, AI Rewrite) 
│   └── alembic/        # Database migration history and schema evolution 
└── frontend/src/ 
    ├── components/     # UI components (MultiAgentReviewPanel, AIRewritePanel) 
    ├── hooks/          # Custom Hooks for AI streaming state management 
    ├── services/       # Typed API wrappers using Axios 
    └── types/          # Global TypeScript interface and type definitions 
```

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- MySQL 8.0+ (可选，默认使用SQLite)
- Docker and Docker Compose (推荐)

### Option 1: Docker (推荐)

```bash
# 1. 确保.env文件存在（已默认创建）

# 2. 启动整个项目
docker-compose up -d

# 3. 访问应用
# 前端: http://localhost:3000
# 后端API: http://localhost:8000
# API文档: http://localhost:8000/docs
```

### Option 2: 传统方式

#### 1. Backend Setup

```bash
cd backend/src
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # Configure DB credentials and LLM API Keys
uvicorn main:app --reload
```

#### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Render 部署

该项目已为 Render 平台配置 `render.yaml`，实现前后端一键 Blueprint 部署：

- `zpblog-backend`：后端 Docker Web Service，直接使用根目录 `Dockerfile` 构建。
- `zpblog-frontend`：前端静态站点，使用 `frontend` 目录构建并发布 `frontend/dist`。
- `zpblog-db`：Render 托管 PostgreSQL 数据库，自动注入后端 `DATABASE_URL`。

### Render Blueprint 快速部署

1. 将仓库推送到 GitHub。
2. 在 Render 控制台中选择“New”→“Import from GitHub”。
3. 选择本仓库，并启用 `render.yaml` Blueprint。
4. Render 将自动创建 `zpblog-backend`、`zpblog-frontend` 和 `zpblog-db` 三个服务。
5. 在后端服务中确认环境变量：
   - `SECRET_KEY`
   - `ALLOWED_ORIGINS=https://<your-frontend-service>.onrender.com,https://<your-backend-service>.onrender.com`
   - `AI_PROVIDER`
   - `AI_API_KEY`
   - `AI_MODEL`
   - `DATABASE_URL`（由 `zpblog-db` 自动注入）
6. 在前端服务中确认：
   - `VITE_API_BASE_URL=https://<your-backend-service>.onrender.com/api`

> 如果你现在还没有上传 GitHub，可以先继续使用本地开发地址 `http://localhost:3000` 和 `http://localhost:8000`，等仓库上传并在 Render 成功导入后再替换为实际 Render 服务域名。

### 生产环境建议

- Render 默认数据库为 PostgreSQL，后端已补充 `psycopg-binary` 支持。
- 如果你希望使用自定义 MySQL 连接，可直接把 `DATABASE_URL` 指向外部 MySQL 服务。
- Render 文件系统是临时性的，生产不要使用 SQLite 持久存储。

> 提示：如果部署后出现跨域问题，请将 `ALLOWED_ORIGINS` 更新为前端在 Render 中的实际域名。

## Quality Assurance (QA)

The system includes a robust automated testing suite covering the entire lifecycle of content and AI interactions.

- **Backend**: Executed via pytest with 16 core test cases.
- **Coverage**: JWT security chains, Multi-agent dispatching logic, and Recommendation feedback loops.

```bash
cd backend/src
pytest
```

## Code Statistics

- **Python**: \~8,400 lines
- **TypeScript/TSX**: \~14,500 lines
- **CSS/Styles**: \~2,500 lines
- **Total Original Code**: \~25,400 lines

## License & Author

- **Author**: Junwen Lou
- **Development Period**: Jan 2026 - Mar 2026
- **License**: Apache License 2.0 (LICENSE)
- **Contact**: <junwenlou@gmail.com> | GitHub Issues

