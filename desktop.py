"""
Hércules Festas — Launcher Desktop
Inicia o servidor e abre o app em janela própria (sem barra do navegador).
"""
import sys
import subprocess
import threading
import time
import os
from pathlib import Path

# ── Resolver caminhos quando empacotado com PyInstaller ────────
_EXE_DIR = Path(sys.executable).parent if getattr(sys, 'frozen', False) else Path(__file__).parent
sys.path.insert(0, str(_EXE_DIR))

# Carregar .env antes de importar app
from dotenv import load_dotenv
load_dotenv(_EXE_DIR / '.env')

# ── Importar servidor ──────────────────────────────────────────
import http.server
from app import Handler, init_db, PORT, HOST, BASE   # noqa: E402

# ── Encontrar Edge ou Chrome ───────────────────────────────────
def _find_browser():
    candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        # Chromium
        r"C:\Program Files\Chromium\Application\chrome.exe",
    ]
    for p in candidates:
        if Path(p).exists():
            return p
    return None

# ── Iniciar servidor em background ─────────────────────────────
_server: http.server.HTTPServer | None = None

def _run_server():
    global _server
    try:
        init_db()
    except Exception as e:
        print(f'[ERRO] Banco de dados: {e}')
        os._exit(1)
    _server = http.server.HTTPServer((HOST, PORT), Handler)
    _server.serve_forever()

# ── Main ───────────────────────────────────────────────────────
if __name__ == '__main__':
    print('Iniciando Hércules Festas...')

    t = threading.Thread(target=_run_server, daemon=True)
    t.start()

    # Aguarda servidor subir
    time.sleep(2)

    url    = f'http://localhost:{PORT}'
    browser = _find_browser()

    if browser:
        proc = subprocess.Popen([
            browser,
            f'--app={url}',
            '--window-size=1400,860',
            '--disable-extensions',
            '--disable-translate',
            '--no-first-run',
        ])
        print(f'App aberto em modo janela ({Path(browser).stem})')
        # Mantém servidor vivo enquanto a janela estiver aberta
        proc.wait()
    else:
        # Fallback: abre no navegador padrão
        import webbrowser
        webbrowser.open(url)
        print(f'Navegador padrão aberto em {url}')
        input('Pressione Enter para encerrar...')

    # Encerra servidor ao fechar a janela
    if _server:
        _server.shutdown()
