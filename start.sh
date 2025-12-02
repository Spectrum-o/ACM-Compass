#!/bin/bash
# ACM-Compass 快速启动脚本 (Linux/macOS)

cd "$(dirname "$0")"

echo "正在启动 ACM-Compass..."
npm run install:all
npm run dev
