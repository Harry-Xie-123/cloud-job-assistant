# Cloud Job Assistant 项目交付说明

这份文件用于 GitHub 发布、面试复述和后续部署。它说明项目是什么、怎么运行、怎么部署、核心原理是什么，以及哪些外部资源需要你自己提供。

## 1. 项目定位

Cloud Job Assistant 是一个面向实习和毕业生岗位申请的云端 job tracker。它解决三个问题：

- 把 SEEK 或手动来源的岗位统一追踪起来。
- 根据 CV/profile 自动评分，判断岗位是否适合申请。
- 生成申请提醒、CSV/PDF/Calendar 导出、CV bullet 和 cover letter 草稿。

这个项目适合作为简历项目，因为它覆盖了：

- 前端 dashboard
- Node.js API
- 数据建模
- PostgreSQL/RDS
- Docker
- GitHub Actions
- AWS ECS/RDS/S3/CloudWatch 部署设计
- 隐私保护和安全边界

## 2. 当前功能

已实现：

- React/Vite 前端源码，以及无需安装依赖即可访问的静态 dashboard。
- Node.js HTTP API。
- 匿名 seed profile 和匿名 SEEK sample jobs。
- 私有本地 profile：`apps/api/src/data/profile.local.json`，不会进入 Git。
- JSON 本地数据层。
- PostgreSQL 数据层，可用于 Docker Postgres 或 AWS RDS。
- Job scoring：skills、location、work rights、degree fit、closing date。
- Tracked jobs status：saved、shortlisted、applied、rejected。
- Next Actions：按 closing date 和 status 生成提醒。
- CSV 导出：`/api/export/jobs.csv`。
- PDF 导出：`/api/export/jobs.pdf`。
- Calendar 导出：`/api/export/reminders.ics`。
- SEEK search link 生成。
- SEEK URL import。
- 用户粘贴 SEEK listing text 后本地解析。
- 用户授权 bookmarklet capture。
- SEEK official API adapter 占位，拿到 partner credentials 后可启用。
- 可选 admin auth，默认关闭。
- Dockerfile、docker-compose、GitHub Actions CI。
- Playwright E2E 测试文件。
- AWS RDS/ECS CloudFormation 模板。

外部条件仍需你提供：

- GitHub 账号和仓库。
- AWS 账号、VPC/subnet/security group、ECR/ECS/RDS 资源。
- SEEK official partner credentials，如果要启用官方 API。
- 生产环境 secrets，例如 `DATABASE_URL`、`ADMIN_PASSWORD`、`ADMIN_SESSION_SECRET`。

## 3. 本地运行

最简单方式：

```bash
node apps/api/src/server.js
```

然后打开：

```text
http://localhost:8080
```

如果安装了 pnpm：

```bash
pnpm install
pnpm dev
```

默认不需要密码。只有设置以下变量时才启用登录：

```text
ADMIN_AUTH_ENABLED=true
ADMIN_PASSWORD=<strong password>
ADMIN_SESSION_SECRET=<long random secret>
```

## 4. 用 PostgreSQL 运行

本地 Docker Postgres：

```powershell
$env:DATA_STORE="postgres"
$env:DATABASE_URL="postgres://app:app_password@postgres:5432/cloud_job_assistant"
docker compose --profile postgres up --build
```

如果你在本机直接连 Postgres：

```bash
pnpm install
DATABASE_URL=postgres://app:app_password@localhost:5432/cloud_job_assistant pnpm db:migrate
DATA_STORE=postgres DATABASE_URL=postgres://app:app_password@localhost:5432/cloud_job_assistant pnpm dev
```

Postgres schema 在：

```text
apps/api/src/db/schema.sql
```

核心表：

- `jobs`：岗位、来源、状态、技能、closing date、notes。
- `candidate_profiles`：私有 profile override。
- `application_events`：状态变化历史。

## 5. GitHub 发布步骤

推荐做法：

1. 在 GitHub 创建空仓库。
2. 不要勾选 GitHub 自动生成 README，因为项目已有 README。
3. 当前本地仓库已经重新初始化为 `main` 分支，不需要再次运行 `git init`。
4. 先运行 `node scripts/check-public-data.mjs`，确认没有私有文件、密钥或真实申请记录。
5. 网络可用后运行一次 `pnpm install`，生成并提交 `pnpm-lock.yaml`。
6. 在 GitHub 邮箱设置中启用隐私保护，并使用 GitHub 提供的 no-reply 提交邮箱。

命令行：

```bash
node scripts/check-public-data.mjs
git add .
git commit -m "Initial cloud job assistant project"
git remote add origin https://github.com/YOUR_USERNAME/cloud-job-assistant.git
git push -u origin main
```

之前未完成的 `.git` 元数据已经备份到项目目录外，当前项目中的 Git 仓库是干净的新仓库。

发布后建议：

- 在 GitHub About 里写：`Cloud job matching and application tracker with SEEK import, scoring, Postgres, Docker, AWS deployment templates, and CI.`
- 添加 topics：`react`、`nodejs`、`postgresql`、`aws`、`docker`、`job-tracker`、`github-actions`。
- Pin 到 GitHub profile。
- 在 README 顶部加一张 screenshot。

## 6. GitHub Actions CI

CI 文件：

```text
.github/workflows/ci.yml
```

它会：

- 安装 Node 22。
- 安装 pnpm。
- 检查公开仓库中是否包含私有数据或密钥。
- 安装依赖。
- 跑 API tests。
- build 并验证 React 生产 dashboard。
- 安装 Playwright Chromium。
- 对 React 生产页面运行 E2E tests。
- 构建 Docker 镜像，并启动镜像检查页面和健康接口。

本地可运行：

```bash
pnpm test
pnpm build
pnpm test:e2e
```

当前 Codex 环境没有完整 npm/browser 依赖，所以 E2E 主要交给 GitHub Actions 执行。

## 7. AWS 部署方案

推荐架构：

```mermaid
flowchart LR
  User["User Browser"] --> CF["CloudFront"]
  CF --> S3["S3 Static Assets"]
  User --> ALB["API Load Balancer / API Gateway"]
  ALB --> ECS["ECS Fargate Node API"]
  ECS --> RDS["RDS PostgreSQL"]
  ECS --> CW["CloudWatch Logs"]
  ECS --> SM["Secrets Manager / SSM"]
```

已提供模板：

- `infra/aws/rds-production.yml`
- `infra/aws/ecs-service-skeleton.yml`
- `infra/aws/cloudformation-skeleton.yml`

生产环境变量建议：

```text
NODE_ENV=production
PORT=8080
DATA_STORE=postgres
DATABASE_URL=<from Secrets Manager>
DATABASE_SSL=true
DATABASE_AUTO_MIGRATE=false
DATABASE_SEED_ON_EMPTY=false
ADMIN_AUTH_ENABLED=true
ADMIN_PASSWORD=<from Secrets Manager>
ADMIN_SESSION_SECRET=<from Secrets Manager>
```

部署顺序：

1. 创建 ECR repo。
2. Build Docker image。
3. Push image 到 ECR。
4. 创建 RDS PostgreSQL。
5. 将 `DATABASE_URL` 放入 Secrets Manager。
6. 运行一次 migration：`pnpm db:migrate`。
7. 部署 ECS Fargate service。
8. 配置 ALB/API Gateway 和 HTTPS。
9. 配置 CloudWatch logs 和 alarms。

## 8. SEEK 集成原理

项目没有做未授权 scraping，也不会自动提交申请。

支持三种安全路径：

1. SEEK search URL：根据关键词和地点打开 SEEK 搜索。
2. User-pasted listing text：用户复制岗位正文，系统本地解析。
3. Bookmarklet capture：用户在 SEEK 页面主动点击 bookmarklet，将当前可见文本发回自己的 app。

如果拿到 SEEK partner API credentials：

```text
SEEK_API_BASE_URL=<official partner API base url>
SEEK_API_KEY=<secret>
SEEK_API_KEY_HEADER=authorization
SEEK_API_JOB_PATH_TEMPLATE=/jobs/{id}
```

然后 API 会通过：

```text
POST /api/integrations/seek/fetch-url
```

从 SEEK job URL 提取 job id，再调用官方 API adapter。

## 9. Scoring 原理

每个岗位会根据 profile 计算 score：

- skills match：候选人的 skills 与 job requiredSkills 匹配。
- location fit：preferredLocations 与 job location 匹配。
- work rights：判断是否存在 eligibility risk。
- degree fit：degreeDisciplines 是否适合。
- closing date：越接近截止日期，提醒优先级越高。

输出包括：

- total score
- recommendation：apply、tailor、maybe、skip
- skill matches
- skill gaps
- work-right risk
- closing urgency

这些结果用于：

- Dashboard 排序和展示。
- CSV/PDF 导出。
- Next Actions。
- Cover letter 和 CV bullet draft。

## 10. 隐私原则

公开仓库不能包含：

- 真实姓名
- 电话
- 邮箱
- visa/work-right 细节
- 真实申请历史
- 真实 recruiter/employer notes
- 真实私有 SEEK URLs

本地私有数据位置：

```text
apps/api/src/data/profile.local.json
```

它已经被 `.gitignore` 和 `.dockerignore` 排除。

## 11. 简历描述建议

可以写：

```text
Built a cloud-based job matching and application tracker using React, Node.js, PostgreSQL, Docker, GitHub Actions, and AWS-oriented deployment templates. Implemented SEEK URL import, user-approved listing capture, job scoring against candidate profiles, status tracking, CSV/PDF/calendar exports, optional admin authentication, and RDS-ready persistence.
```

中文复述：

```text
我做了一个 Cloud Job Matching and Application Assistant，用来管理实习和 graduate job 申请。系统可以导入 SEEK 链接或用户粘贴的岗位文本，根据我的 profile 自动评分，生成申请建议、closing date reminder、CV bullet 和 cover letter draft。后端支持 JSON 本地模式和 PostgreSQL/RDS 模式，配有 Docker、GitHub Actions、Playwright E2E、AWS ECS/RDS 模板，并且注意了隐私保护和 SEEK 合规边界。
```

## 12. 交付前检查清单

发布 GitHub 前确认：

- `node scripts/check-public-data.mjs` 通过。
- `profile.local.json` 和 `jobs.local.json` 被 Git 忽略。
- `.env` 被 Git 忽略，仅提交 `.env.example`。
- `pnpm-lock.yaml` 已在联网安装依赖后生成并提交。
- README 能解释项目功能和限制。
- `pnpm test` 通过。
- GitHub Actions 首次运行通过。
- GitHub About 和 topics 已填写。
- repo 已 pin 到 profile。
- 简历项目描述已更新。

## 13. 当前限制

这不是因为代码没写，而是外部系统限制：

- SEEK 官方 API 需要 SEEK partner approval。
- AWS 生产部署需要你的 AWS account 和 billing。
- GitHub push 需要你的 GitHub repo URL 和登录权限。
- E2E 本地运行需要安装 Playwright 浏览器依赖。
