# HIDConsole

A cross-platform HID device debugger built with Tauri, React, and Rust.

## Features

- Scan and connect to HID devices
- Real-time data monitoring with timestamp
- Send hex data with validation
- Frame size configuration
- Auto-refresh device list
- Cross-platform support (macOS, Windows, Linux)

## Requirements

- Node.js 18+
- Rust 1.70+
- Tauri CLI

## Installation

```bash
# Install dependencies
pnpm install

# Install Tauri CLI
cargo install tauri-cli
```

## Development

```bash
# Start development server
pnpm tauri dev
```

## Build

```bash
# Build for current platform
pnpm tauri build
```

## Usage

1. Select a device from the dropdown list
2. Configure frame size (default: 65)
3. Click "Open" to connect
4. View received data in the response panel
5. Send hex data using the input field

## Tech Stack

- **Frontend**: React 19, TypeScript, TailwindCSS
- **Backend**: Rust, Tauri 2, hidapi
- **Build Tool**: Vite

## License

MIT