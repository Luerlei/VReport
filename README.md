# VReport

一款基于 Vue 3 + TypeScript 的 Web 端报表设计器，类 UReport 风格，支持可视化拖拽、公式计算、数据展开、条件格式、图表/二维码/条码等特殊单元格。

## ✨ 功能特性

### 核心引擎
- **展开引擎**：主格树 + 上下文传播，支持向下 / 向右展开，多数据集嵌套
- **表达式引擎**：Lexer + Parser + Evaluator，40+ 内置函数，Excel 风格公式
- **聚合引擎**：递归求值，自动循环依赖检测（`#CIRC!`）
- **参数引擎**：非破坏性数据集过滤，支持多种参数类型（文本/下拉/数字/日期）
- **条件格式引擎**：基于表达式的单元格样式动态渲染

### 设计器
- **可视化画布**：虚拟滚动，合并单元格，行高列宽拖拽调整
- **属性面板**：展开方向、主格配置、数据绑定、条件格式管理
- **数据面板**：数据源 / 数据集 / 字段管理，支持拖放插入
- **公式编辑**：函数联想、参数提示、引用高亮、实时语法校验
- **主格拾取**：点击画布快速设置左主格 / 上主格

### 特殊单元格
- **图片**：URL 或 base64 嵌入，支持 contain/cover 缩放
- **二维码**：自定义纠错等级、颜色、边距
- **条码**：9 种格式（CODE128 / CODE39 / EAN13 / EAN8 / UPC / ITF14 / MSI / Pharmacode / Codabar）
- **图表**：7 种类型（柱状图 / 折线图 / 面积图 / 饼图 / 雷达图 / 散点图 / 漏斗图），基于 ECharts

### 数据源与导出
- **数据源**：CSV / Excel / JSON / 本地文件
- **导出**：HTML / Excel / PDF
- **存储**：IndexedDB 本地持久化，支持模板导入导出

## 🚀 快速开始

### 环境要求
- Node.js >= 16
- npm / pnpm / yarn

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```
访问 http://localhost:5173 （或终端提示的端口）

### 构建生产版本
```bash
npm run build
```

### 预览生产构建
```bash
npm run preview
```

### 运行测试
```bash
# 端到端测试
npx vite-node test/e2e.test.ts

# 浏览器流程模拟
npx vite-node test/browser-flow.test.ts

# 新功能回归测试
npx vite-node test/new-features.test.ts

# 公式联想与参数筛选
npx vite-node test/formula-param.test.ts

# 特殊元素测试
npx vite-node test/insert-elements.test.ts
```

## 📁 项目结构

```
VReport/
├── src/
│   ├── components/
│   │   ├── designer/       # 设计器组件（画布、属性面板、工具栏等）
│   │   ├── preview/        # 预览组件
│   │   └── render/         # 渲染组件（图表、表格）
│   ├── core/
│   │   ├── cell/           # 单元格模型与网格
│   │   ├── datasource/     # 数据源提供者（CSV/Excel/JSON/文件）
│   │   ├── engine/         # 核心引擎（展开/聚合/主格树/上下文）
│   │   ├── expression/     # 表达式引擎（Lexer/Parser/Evaluator）
│   │   ├── export/         # 导出器（HTML/Excel/PDF）
│   │   ├── format/         # 条件格式
│   │   ├── parameter/      # 参数引擎
│   │   ├── render/         # 样式解析
│   │   └── serializer/     # 序列化
│   ├── stores/             # Pinia 状态管理
│   ├── views/              # 页面视图（模板列表/设计器/预览）
│   ├── utils/              # 工具函数（ID/DB/种子数据）
│   ├── styles/             # 全局样式
│   ├── types/              # TypeScript 类型
│   └── router/             # 路由
├── test/                   # 测试用例（218 个断言）
├── docs/                   # 设计文档
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Vue 3 + TypeScript |
| 构建 | Vite 5 |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 |
| UI 组件 | Ant Design Vue 4 |
| 图表 | ECharts 5 |
| 本地存储 | Dexie.js (IndexedDB) |
| Excel 处理 | ExcelJS + SheetJS (xlsx) |
| PDF | jsPDF + html2canvas |
| 二维码 | qrcode |
| 条码 | JsBarcode |
| 日期 | Day.js |
| 工具函数 | Lodash ES |
| CSV | PapaParse |

## 📄 License

MIT License — 详见 [LICENSE](LICENSE) 文件。
