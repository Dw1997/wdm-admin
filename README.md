# 副食批发平台 · 管理端（wdm-admin）

副食批发平台的管理后台（admin console），基于 Vue 3 + Vite + TypeScript + Naive UI 的单页应用。后端为兄弟仓库 `../wdm-backend`（FastAPI）。

## 技术栈

- **框架**：Vue 3（`<script setup>` 组合式 API）+ Vue Router 4 + Pinia
- **构建**：Vite 5、TypeScript（strict 模式）
- **UI**：Naive UI + @vicons/tabler，主题主色为红色（`#dc2626`，在 `App.vue` 全局配置）
- **图表**：ECharts 5 + vue-echarts
- **HTTP**：Axios（统一封装，见 `src/api/http.ts`）

## 环境要求

- Node.js ≥ 18
- npm ≥ 9

## 快速开始

```bash
npm install        # 安装依赖
npm run dev        # 启动开发服务器 http://localhost:9021（host 0.0.0.0，不自动打开浏览器）
```

## 可用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器（端口 9021） |
| `npm run build` | 生产构建，输出到 `dist/`（不含类型检查） |
| `npm run build:check` | 先 `vue-tsc --noEmit` 类型检查，再构建；**合并前必须通过** |
| `npm run type-check` | 仅类型检查（主要正确性门槛，每次改动都必须通过） |
| `npm run preview` | 本地预览构建产物 |

## 环境变量

在 `.env` 中配置（可用 gitignore 的 `.env.local` 覆盖）：

| 变量 | 说明 |
| --- | --- |
| `VITE_API_BASE_URL` | FastAPI 后端地址（如 `http://localhost:9020/api/v1`）。留空时回退为相对路径 `/api/v1` |
| `VITE_API_PROXY_TARGET` | 设置后，开发服务器将 `/api` 代理到该地址（前端保持 9021 端口，直连本地后端） |
| `VITE_APP_TITLE` | 应用标题 |

> 注意：项目早期内置的 mock 数据层已移除，所有请求均发往真实后端。后端接口未实现时，页面会通过错误提示展示网络/HTTP 错误。

## 架构与数据流

```
views（页面组件）
  → @/api（API 门面，src/api/index.ts，按资源分组：productApi / orderApi / financeApi …）
    → src/api/http.ts（get/post/put/del 薄封装 + 单一 Axios 实例）
      → 真实后端（wdm-backend，FastAPI）
```

- 后端将所有 `/api/v1` JSON 响应包裹为 `{code, message, data}` 信封；响应拦截器自动解包，门面方法直接拿到业务数据。
- 请求拦截器自动附加 `Authorization: Bearer <token>`；`401` 会触发登出并跳转 `/login`。
- Token 持久化在 `localStorage`（`wdm_admin_access` / `wdm_admin_refresh`）。

## 目录结构

```
src/
├── api/          # API 门面（index.ts）与 HTTP 封装（http.ts）
├── assets/       # 全局样式
├── layouts/      # MainLayout（侧边栏 + 头部 + 标签页）
├── router/       # 路由表（beforeEach 守卫 + document.title）
├── stores/       # Pinia：auth（token + 用户）、app（侧边栏折叠）
├── types/        # 全部领域类型，与后端 Pydantic schema 对齐
├── utils/        # dict.ts（枚举label/颜色映射）、format.ts（格式化）
└── views/        # 页面组件，按模块分目录
```

## 开发约定

- **API 优先**：新增/修改页面前，先在 Apifox 确认接口（路径、方法、请求体、响应字段）。UI、类型、API 门面严格以 Apifox 字段为准，不臆造字段；接口不存在时先补接口，不要猜测契约。
- **新增接口顺序**：`src/types/index.ts` → `src/api/index.ts`（门面方法）→ 后端路由。
- 页面只从 `@/api` 导入，不直接使用 axios。
- 领域枚举（订单状态、客户等级等）通过 `src/utils/dict.ts` 的 label/颜色映射暴露，**禁止**在组件内内联中文标签。
- **价格隔离**：价格由服务端按客户/等级解析，前端不得过滤或重算价格。
- 侧边栏 `menuOptions`（`MainLayout.vue`）与路由表是两份独立配置，增删路由时需同步。
- Vue API 与 Naive UI 组件自动导入（unplugin）；`auto-imports.d.ts`、`components.d.ts` 为生成文件，勿手改。
- 无 lint/formatter，请保持与周围代码一致的风格（2 空格缩进）。

## 提交规范

- 提交信息格式：`type: summary`（如 `feat: 客户等级价格预览`），主题简短、祈使语气。
- PR：描述变更与关联 issue，UI 变更附截图，并确认 `npm run build:check` 通过。
