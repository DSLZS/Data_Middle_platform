# Traffic Panel Web Server

交通流量看板，web服务

## 功能规划
1  支持时间轴回放的区域热力图，
2  繁忙路段，繁忙路口热力图
3  车辆运营调度利用率
4  城市道路利用率

还可以考虑做个简单的算法根据不同类型的道路以及道路繁忙程度加权算个城市道路健康度指标之类的

### 车辆轨迹原始数据 
示例 SQL: temp/trip.sql
mock数据: mock/trips.mock.json

## 技术栈与目录

- 前端：`Vite + React`
- 服务端：`Express`
- 数据：`mock/trips.mock.json`

```
traffic-panel-web-server
├─ server/            # Express API
├─ src/               # React 页面
├─ mock/              # Mock 数据
├─ temp/              # SQL 示例
└─ vite.config.js
```

## 本地启动

```bash
npm install
npm run dev
```

启动后：
- 前端地址：`http://localhost:5173`
- 后端地址：`http://localhost:3001`
- 健康检查：`http://localhost:3001/api/health`

## 部署到 Cloudflare Pages

项目已内置 `functions/api/[[path]].js`，部署后会自动提供 `/api/*` 接口，不依赖 Express 进程。

### 1) 首次登录 Cloudflare

```bash
npx wrangler login
```

### 2) 本地模拟 Cloudflare Pages

```bash
npm run cf:dev
```

默认会先执行前端构建，再用 Pages Functions 在本地启动 `dist` 目录。

### 3) 发布到 Cloudflare Pages

```bash
npm run cf:deploy
```

首次部署会提示你输入项目名（可使用 `traffic-panel-web-server`）并绑定账号。

### 4) Cloudflare 控制台可选配置（推荐）

- 在 Pages 项目里将 **Production branch** 设为你的主分支
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js 版本建议 `20+`

## 当前页面覆盖的看板能力

1. 全域态势指标卡（活跃车辆、总里程、平均车速、路网健康度）
2. 全天候潮汐运行心电图（按小时聚合）
3. 全城打车需求热点 Top5
4. 城市拥堵咽喉路段示例榜
5. 重点车辆轨迹复盘卡片