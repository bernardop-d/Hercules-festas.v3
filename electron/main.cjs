'use strict'

const { app, BrowserWindow, shell } = require('electron')
const { spawn, spawnSync }          = require('child_process')
const path = require('path')
const http = require('http')

const PORT = 5000
let win            = null
let pythonProcess  = null
let loadRetries    = 0

// ── Detecta o executável Python disponível ───────────────────
function findPython() {
  const candidates = process.platform === 'win32'
    ? ['py', 'python', 'python3']
    : ['python3', 'python']

  for (const exe of candidates) {
    try {
      const r = spawnSync(exe, ['--version'], { timeout: 2000 })
      if (r.status === 0) return exe
    } catch (_) { /* próximo */ }
  }
  return 'python' // última tentativa
}

// ── Inicia o servidor Python ──────────────────────────────────
function startPython() {
  const exe    = findPython()
  const script = path.join(__dirname, '..', 'app.py')

  console.log(`[Python] Iniciando com: ${exe} ${script}`)

  pythonProcess = spawn(exe, [script], {
    cwd:     path.join(__dirname, '..'),
    stdio:   'pipe',
    detached: false,
  })

  pythonProcess.stdout?.on('data', d => process.stdout.write(`[Python] ${d}`))
  pythonProcess.stderr?.on('data', d => process.stderr.write(`[Python] ${d}`))
  pythonProcess.on('error', err  => console.error('[Python] Erro:', err.message))
  pythonProcess.on('exit',  code => console.log(`[Python] Encerrou (código ${code})`))
}

// ── Aguarda o servidor HTTP estar pronto ─────────────────────
function waitForServer(retries, cb) {
  const req = http.get(`http://localhost:${PORT}/api/precos`, res => {
    res.resume()
    console.log('[Electron] Servidor pronto.')
    cb()
  })
  req.on('error', () => {
    if (retries > 0) {
      setTimeout(() => waitForServer(retries - 1, cb), 600)
    } else {
      console.warn('[Electron] Timeout aguardando servidor — tentando carregar mesmo assim.')
      cb()
    }
  })
  req.setTimeout(500, () => req.destroy())
}

// ── Cria a janela principal ───────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width:     1300,
    height:    820,
    minWidth:  860,
    minHeight: 600,
    title:     'Hércules Festas',
    backgroundColor: '#0d0d0d',
    show: false, // só mostra após carregar (evita tela preta)
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
    },
  })

  // Mostra a janela quando o conteúdo estiver renderizado
  win.once('ready-to-show', () => win.show())

  // Retry automático se a página falhar ao carregar
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    loadRetries++
    console.warn(`[Electron] Falha ao carregar (${code}: ${desc}) — tentativa ${loadRetries}`)
    if (loadRetries <= 10) {
      setTimeout(() => win?.loadURL(`http://localhost:${PORT}`), 800)
    }
  })

  win.webContents.on('did-finish-load', () => {
    loadRetries = 0
  })

  // Links externos abrem no navegador do sistema
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.on('closed', () => { win = null })

  win.loadURL(`http://localhost:${PORT}`)
}

// ── Ciclo de vida ─────────────────────────────────────────────
app.whenReady().then(() => {
  startPython()
  waitForServer(20, createWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  killPython()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', killPython)

// ── Mata o processo Python ao fechar ─────────────────────────
function killPython() {
  if (!pythonProcess) return
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(pythonProcess.pid), '/f', '/t'])
    } else {
      pythonProcess.kill('SIGTERM')
    }
  } catch (_) { /* processo já encerrado */ }
  pythonProcess = null
}
