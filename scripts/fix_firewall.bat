@echo off
echo ==========================================
echo   Orijins POS - Network Access Fixer
echo ==========================================
echo.
echo This script will open ports 3000 and 5000 in your Windows Firewall
echo to allow mobile devices to connect to the POS system.
echo.
echo [IMPORTANT]
echo A popup will appear asking for Administrator permissions.
echo Please click "Yes" to continue.
echo.
pause

powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command \"New-NetFirewallRule -DisplayName ''Orijins POS Frontend'' -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue; New-NetFirewallRule -DisplayName ''Orijins POS Backend'' -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue; Write-Host ''Success! Firewall rules added.''; Write-Host ''You can now close this window.''; Start-Sleep -Seconds 5\"'"

echo.
echo Attempted to apply fixes.
echo.
echo 1. If you saw a 'Success' message in the popup, try scanning the QR code now.
echo 2. If it still fails, you may need to restart your computer.
echo.
pause
