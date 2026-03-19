@echo off
chcp 65001 > nul
echo Iniciando Hercules Festas...
start "" "dist\Hercules Festas\Hercules Festas.exe"
timeout /t 3 /nobreak > nul
start "" "http://localhost:5000"
