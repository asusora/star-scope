# 太阳系漫游

用 Vue 3、Vite 和 TypeScript 构建的交互式三维星图。Three.js 负责 WebGL 渲染，浏览器无法使用 WebGL 时自动切换到 Canvas 2D。

## 本地开发

使用 Node.js 20.19+（20.x）或 22.12+，在工程根目录运行以下命令。

```sh
npm ci
npm run dev
```

开发服务器地址会显示在终端。执行 `npm run typecheck` 检查 TypeScript 和 Vue 模板，`npm run build` 检查类型并生成 `dist/`，`npm run preview` 在本机预览构建结果。部署时将整个 `dist/` 放到静态 Web 服务器。

## 源码位置

- `src/components/` 包含天体导航、卫星目录、深空档案和使用说明。
- `src/scene/` 包含相机控制、轨道计算、深空模型和 Canvas 回退渲染。
- `src/data/` 保存天体名录和档案，`src/assets/` 保存纹理、缩略图和观测影像。图片随项目打包，来源和授权信息可在页面的使用说明及档案中查看。
- `outputs/solar-system.html` 是迁移前的独立页面，可用于对照。
