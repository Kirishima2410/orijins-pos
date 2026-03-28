@echo off
echo ==========================================
echo   Orijins POS - Network Access Fixer v2
echo ==========================================
echo.
echo DETECTED ISSUE: Your Wi-Fi is set to 'Public'.
echo This creates a strict firewall that blocks connections.
echo.
echo This script will:
1. Open ports 3000 and 5000 specifically for Public networks.
2. Attempt to switch your Wi-Fi profile to 'Private' (Recommended for Home Wi-Fi).
echo.
echo [IMPORTANT]
echo Please click "Yes" when asked for Administrator permissions.
echo.
pause

powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command \"Write-Host ''Applying Firewall Rules...''; New-NetFirewallRule -DisplayName ''Orijins POS Frontend (Public)'' -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Any -ErrorAction SilentlyContinue; New-NetFirewallRule -DisplayName ''Orijins POS Backend (Public)'' -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow -Profile Any -ErrorAction SilentlyContinue; Write-Host ''Rules Added.''; Write-Host ''Attempting to change Network Profile to Private (Best for local sharing)...''; $net = Get-NetConnectionProfile; if ($net) { Set-NetConnectionProfile -InterfaceIndex $net.InterfaceIndex -NetworkCategory Private; Write-Host ''Network Profile switched to Private.''; } else { Write-Host ''Could not find network profile to switch.''; }; Write-Host ''DONE! You can verify by scanning the QR code.''; Start-Sleep -Seconds 10\"'"

echo.
echo Fix applied. 
echo.
echo 1. Your network should now be 'Private' (or ports opened on Public).
echo 2. Try scanning the QR code again.
echo.
pause
