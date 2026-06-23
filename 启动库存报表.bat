@echo off
cd /d C:\Users\86177\Desktop\inventory

:: 运行 auto_report.js 更新数据
echo [%time%] 正在拉取最新库存数据...
node auto_report.js

:: 启动 HTTP 服务
echo [%time%] 启动 HTTP 服务...
start "HTTP-Server" cmd /k "npx http-server -p 8899"

:: 启动 Cloudflare Tunnel
echo [%time%] 启动 Cloudflare Tunnel 穿透...
start "Cloudflare-Tunnel" cmd /k "cloudflared.exe tunnel --url http://localhost:8899"

echo.
echo ============================================
echo  库存日报系统已启动！
echo  请等待 Cloudflare Tunnel 生成网址...
echo  浏览器打开显示的网址即可查看报表
echo ============================================
pause
