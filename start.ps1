# ACM-Compass 快速启动脚本 (Windows PowerShell)

Set-Location $PSScriptRoot

Write-Host "正在启动 ACM-Compass..."
npm run install:all
npm run dev
