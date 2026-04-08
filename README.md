<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# lzudate — 兰大缘分

兰州大学匿名配对交友 Web App，基于腾讯云 CloudBase 托管。

## 本地开发

**前置要求：** Node.js ≥ 18

1. 安装依赖：
   ```bash
   npm install
   ```
2. 复制 `.env.example` 为 `.env.local`，填入你的 CloudBase 环境 ID：
   ```bash
   cp .env.example .env.local
   # 编辑 .env.local，设置 VITE_CLOUDBASE_ENV_ID
   ```
3. 启动开发服务器：
   ```bash
   npm run dev
   ```

> **注意：** GLM API 密钥不需要配置在本地 `.env` 文件中。所有 AI 调用都通过 `glm-proxy` 云函数完成，密钥仅保存在服务端环境变量中。

---

## 部署到腾讯云 CloudBase

### 前置条件

1. 拥有[腾讯云账号](https://cloud.tencent.com/)并开通 CloudBase 环境
2. 安装 CloudBase CLI：
   ```bash
   npm install -g @cloudbase/cli
   ```
3. 登录腾讯云：
   ```bash
   tcb login
   ```

### 一键部署（静态托管 + 云函数）

```bash
# 将 YOUR_ENV_ID 替换为你的 CloudBase 环境 ID
# 将 YOUR_GLM_API_KEY 替换为你的 GLM API 密钥（来自 https://open.bigmodel.cn/）
ENV_ID=YOUR_ENV_ID GLM_API_KEY=YOUR_GLM_API_KEY tcb framework deploy
```

以上命令会自动完成：
- 构建前端（`npm run build`），并将 `dist/` 部署到静态托管
- 部署 `glm-proxy` 云函数（处理 AI 聊天 & 向量嵌入，GLM 密钥安全保存在服务端）
- 部署 `weekly-matching` 定时云函数（每周一上午 10 点自动运行配对算法）

### 云函数环境变量说明

| 变量 | 说明 | 配置位置 |
|------|------|---------|
| `GLM_API_KEY` | 智谱 GLM API 密钥 | 云函数环境变量（通过 `cloudbaserc.json` 或控制台配置） |

### 手动在控制台配置云函数环境变量

如不使用命令行传参，可在 [CloudBase 控制台](https://console.cloud.tencent.com/tcb) → **云函数** → 选中函数 → **函数配置** → **环境变量** 中手动添加 `GLM_API_KEY`。

---

## 项目结构

```
├── cloudfunctions/
│   ├── glm-proxy/          # AI 代理云函数（聊天 + 向量嵌入）
│   └── weekly-matching/    # 定时配对云函数
├── src/
│   ├── components/         # React 页面组件
│   ├── services/           # 业务逻辑（matchingAlgorithm）
│   ├── utils/
│   │   ├── glm.ts          # 调用 glm-proxy 的前端工具函数
│   │   └── matching.ts     # 配对评分算法
│   └── cloudbase.ts        # CloudBase SDK 初始化
├── cloudbaserc.json        # CloudBase Framework 部署配置
└── vite.config.ts
```
