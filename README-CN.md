# HIDConsole

基于 Tauri、React 和 Rust 构建的跨平台 HID 设备调试工具。

## 功能特性

- 扫描并连接 HID 设备
- 实时数据监控，支持时间戳
- 发送十六进制数据，支持格式验证
- Frame size 配置
- 自动刷新设备列表
- 跨平台支持 (macOS、Windows、Linux)

## 环境要求

- Node.js 18+
- Rust 1.70+
- Tauri CLI

## 安装

```bash
# 安装依赖
pnpm install

# 安装 Tauri CLI
cargo install tauri-cli
```

## 开发

```bash
# 启动开发服务器
pnpm tauri dev
```

## 构建

```bash
# 构建当前平台版本
pnpm tauri build
```

## 使用方法

1. 从下拉列表中选择设备
2. 配置 frame size (默认: 65)
3. 点击 "Open" 连接设备
4. 在响应面板查看接收的数据
5. 在输入框发送十六进制数据

## 技术栈

- **前端**: React 19, TypeScript, TailwindCSS
- **后端**: Rust, Tauri 2, hidapi
- **构建工具**: Vite

## 许可证

MIT
