@echo off
chcp 65001 > nul
echo.
echo  ===================================
echo   Hercules Festas — Build Release
echo  ===================================
echo.

:: ── 1. Frontend ──────────────────────────────────────────────
echo [1/3] Construindo frontend (React + Vite)...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo  ERRO: Falha no build do frontend. Verifique os erros acima.
    pause
    exit /b 1
)
echo  OK — pasta static\ atualizada.
echo.

:: ── 2. PyInstaller ───────────────────────────────────────────
echo [2/3] Instalando/verificando PyInstaller...
pip install pyinstaller --quiet --disable-pip-version-check
echo.

echo [3/3] Empacotando executavel...
pyinstaller ^
  --onedir ^
  --name "Hercules Festas" ^
  --add-data "static;static" ^
  --hidden-import psycopg2 ^
  --hidden-import dotenv ^
  --clean ^
  --noconfirm ^
  app.py

if %errorlevel% neq 0 (
    echo.
    echo  ERRO: Falha ao empacotar. Verifique os erros do PyInstaller.
    pause
    exit /b 1
)

:: ── 3. Copiar .env para a pasta de saída ─────────────────────
if exist .env (
    copy /Y .env "dist\Hercules Festas\.env" > nul
    echo  OK — .env copiado para a pasta de saida.
) else (
    echo  AVISO: .env nao encontrado. Copie manualmente para dist\Hercules Festas\.env
)

echo.
echo  ===================================
echo   Build concluido com sucesso!
echo  ===================================
echo.
echo  Executavel em:
echo    dist\Hercules Festas\Hercules Festas.exe
echo.
echo  Para distribuir, copie a pasta inteira:
echo    dist\Hercules Festas\
echo.
pause
