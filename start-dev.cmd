@echo off
chcp 65001 >nul
cd /d "%~dp0"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 npm，请先安装 Node.js：https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo 首次运行，正在安装依赖，请稍候...
  call npm.cmd install --no-audit --no-fund
  if errorlevel 1 (
    echo [错误] npm install 失败，请检查网络后重试。
    pause
    exit /b 1
  )
)

echo.
echo ============================================
echo   WordWave 词浪 正在启动...
echo   前端：http://localhost:5173
echo   Django 后端：http://localhost:8010
echo   数据库：MySQL(13307) + Redis(16380)
echo   5 秒后自动打开浏览器；按 Ctrl+C 停止。
echo ============================================
echo.

if not exist backend\.venv\Scripts\python.exe (
  echo 首次运行，正在创建 Python 虚拟环境并安装后端依赖...
  call npm.cmd run setup:backend
  if errorlevel 1 (
    echo [错误] 后端依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)

where docker.exe >nul 2>nul
if not errorlevel 1 (
  echo 检查 MySQL / Redis 容器...
  docker-compose up -d mysql redis
) else (
  echo [提示] 未检测到 Docker，请自行确保 MySQL(13307) 与 Redis(16380) 可用。
)

start "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:5173"
npm.cmd run dev

echo.
echo 服务已停止，关闭此窗口即可。
pause
