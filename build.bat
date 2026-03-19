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
    echo  ERRO: Falha no build do frontend.
    pause & exit /b 1
)
echo  OK — pasta static\ atualizada.
echo.

:: ── 2. PyInstaller ───────────────────────────────────────────
echo [2/3] Verificando PyInstaller...
pip install pyinstaller --quiet --disable-pip-version-check
echo.

echo [3/3] Empacotando executavel...
pyinstaller ^
  --onedir ^
  --windowed ^
  --name "Hercules Festas" ^
  --add-data "static;static" ^
  --hidden-import psycopg2 ^
  --hidden-import dotenv ^
  --clean ^
  --noconfirm ^
  desktop.py

if %errorlevel% neq 0 (
    echo  ERRO: Falha ao empacotar.
    pause & exit /b 1
)

:: ── 3. Copiar .env ────────────────────────────────────────────
if exist .env (
    copy /Y .env "dist\Hercules Festas\.env" > nul
    echo  OK — .env copiado.
) else (
    echo  AVISO: .env nao encontrado. Copie para dist\Hercules Festas\.env
)

echo.
echo  ===================================
echo   Pronto!
echo  ===================================
echo.
echo  Executavel: dist\Hercules Festas\Hercules Festas.exe
echo.
echo  Ao abrir o .exe, uma janela propria sera aberta (sem barra do navegador).
echo.
pause
