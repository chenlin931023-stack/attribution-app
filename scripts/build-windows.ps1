# Tauri 桌面应用构建脚本 (Windows PowerShell)
# 使用方法: 在 PowerShell 中运行 .\scripts\build-windows.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== 步骤 1/5: 设置环境变量 ===" -ForegroundColor Green
$env:Path = "C:\Users\抹茶悦\.cargo\bin;" + $env:Path
$env:PYTHONPATH = "D:\attribution-app\backend\python-deps"

Write-Host "=== 步骤 2/5: 验证环境 ===" -ForegroundColor Green
rustc --version
python --version
node --version

Write-Host "=== 步骤 3/5: PyInstaller 打包 Python sidecar ===" -ForegroundColor Green
Set-Location D:\attribution-app\backend
python -m PyInstaller --onefile --name attribution-engine --distpath .\dist --workpath .\build --add-data "app\config.py;app" --hidden-import openpyxl --hidden-import pandas --hidden-import numpy --paths python-deps --clean --noconfirm run.py

Write-Host "=== 步骤 4/5: 复制 sidecar 到 Tauri 资源目录 ===" -ForegroundColor Green
New-Item -ItemType Directory -Force -Path ..\src-tauri\sidecar | Out-Null
Copy-Item .\dist\attribution-engine.exe ..\src-tauri\sidecar\ -Force

Write-Host "=== 步骤 5/5: 构建 Tauri 桌面应用 ===" -ForegroundColor Green
Set-Location D:\attribution-app
npx tauri build

Write-Host "=== 构建完成! ===" -ForegroundColor Green
Write-Host "安装包位置: src-tauri\target\release\bundle\" -ForegroundColor Cyan
