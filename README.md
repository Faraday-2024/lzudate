# LZU Date - 腾讯云部署与 GLM 云函数接入

本项目已改为: 前端不再直连 GLM API，而是统一调用腾讯云 CloudBase 云函数 `glmProxy`，由云函数持有 `GLM_API_KEY`。

## 1. 本地开发

前置条件:

- Node.js 18+
- 腾讯云 CloudBase 环境（已开通）

步骤:

1. 安装依赖

```bash
npm install
```

2. 创建环境变量文件

```bash
cp .env.example .env.local
```

3. 填写 `.env.local`

```env
VITE_CLOUDBASE_ENV_ID=你的云开发环境ID
VITE_CLOUDBASE_REGION=ap-shanghai
VITE_GLM_FUNCTION_NAME=glmProxy
```

4. 启动

```bash
npm run dev
```

## 2. 云函数部署（GLM 代理）

云函数目录: `cloudfunctions/glmProxy`

函数能力:

- `action=chat`: 调用 GLM Chat Completions
- `action=embedding`: 调用 GLM Embeddings

### 方式 A: 控制台部署（推荐）

1. 打开腾讯云 CloudBase 控制台 -> 云函数
2. 新建函数: `glmProxy`
3. 运行环境选择 Node.js（建议 18+）
4. 上传 `cloudfunctions/glmProxy` 目录代码
5. 在函数环境变量中新增:

```env
GLM_API_KEY=你的智谱GLM_API_KEY
```

6. 部署并测试

### 方式 B: CloudBase CLI 部署

```bash
npm i -g @cloudbase/cli
cloudbase login
cloudbase functions:deploy glmProxy cloudfunctions/glmProxy -e 你的环境ID
```

然后在 CloudBase 控制台为函数补充环境变量 `GLM_API_KEY`。

## 3. 前端静态站点部署到腾讯云（CloudBase Hosting）

1. 构建前端

```bash
npm run build
```

2. 发布静态资源

```bash
cloudbase hosting:deploy dist -e 你的环境ID
```

## 4. 关键改造说明

- 新增前端 AI 服务层: `src/services/aiService.ts`
- 新增云函数: `cloudfunctions/glmProxy/index.js`
- 组件与业务逻辑改为调用云函数:
  - `src/components/AIChatOnboarding.tsx`
  - `src/components/MatchAIChat.tsx`
  - `src/components/Onboarding.tsx`
  - `src/services/matchingAlgorithm.ts`

## 5. 常见问题

1. 报错 `GLM_API_KEY is not configured`

- 原因: 云函数环境变量未设置。
- 处理: 在 CloudBase 控制台函数配置里添加 `GLM_API_KEY` 并重新部署。

2. 前端调用云函数失败

- 检查 `VITE_CLOUDBASE_ENV_ID` 是否正确。
- 检查 `VITE_GLM_FUNCTION_NAME` 与函数名是否一致（默认 `glmProxy`）。

3. 本地可以跑，线上失败

- 通常是线上环境变量或函数权限问题。
- 建议先在控制台测试 `glmProxy` 函数返回是否正常，再排查前端。
