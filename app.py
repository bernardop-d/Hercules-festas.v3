"""
Hércules Festas — Sistema de Gestão de Aluguéis
Backend: Python puro (http.server + psycopg2)
Banco de dados: PostgreSQL (NeonDB)
"""

import datetime
import http.server
import json
import os
import threading
import time
import urllib.parse
from pathlib import Path

import psycopg2
import psycopg2.extras
import psycopg2.pool
from dotenv import load_dotenv

# Quando empacotado com PyInstaller, __file__ aponta para o bundle interno.
# Queremos carregar o .env da pasta onde o executável está de fato.
import sys as _sys
_EXE_DIR = Path(_sys.executable).parent if getattr(_sys, 'frozen', False) else Path(__file__).parent
load_dotenv(_EXE_DIR / '.env')

# ── Configuração ─────────────────────────────────────────────
PORT   = int(os.environ.get('PORT', 5000))
HOST   = os.environ.get('HOST', '0.0.0.0')
BASE   = Path(_sys._MEIPASS) if getattr(_sys, 'frozen', False) else Path(__file__).parent
DB_URL = os.environ.get('DATABASE_URL', '')

# Preços padrão — usados apenas para seed inicial do banco
PRECOS_PADRAO = {
    "Conjunto de plástico (uma mesa + 4 cadeiras)": 20.00,
    "Area baby (kit 1)": 200.00,
    "Area baby (kit 2)": 520.00,
    "Piscina de bolinhas": 210.00,
    "Pula-pula pequeno": 230.00,
    "Pula-pula medio": 250.00,
    "Pula-pula grande": 290.00,
    "Air game": 350.00,
    "Fliperama": 360.00,
    "Ping-pong profissional": 380.00,
    "Tamancobol": 190.00,
    "Toto": 250.00,
    "Castelinho (4h c/ monitor)": 650.00,
    "Toboga (4h c/ monitor)": 690.00,
    "Futebol de sabao (4h c/ monitor)": 900.00,
    "Tenda 4x8": 350.00,
    "Tenda 8x8": 400.00,
    "Tenda 6x12": 450.00,
    "Tenda 10x10": 510.00,
    "Tenda 11x11": 520.00,
    "Tenda 8x12": 550.00,
    "Tenda 8x16": 590.00,
    "Tenda 11x20": 650.00,
    "Tenda 11x30": 800.00,
}

# ── Serialização JSON ─────────────────────────────────────────
class _Encoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime.date, datetime.datetime)):
            return obj.isoformat()
        return super().default(obj)

def _dumps(data):
    return json.dumps(data, ensure_ascii=False, cls=_Encoder)

# ── Connection Pool ───────────────────────────────────────────
_pool      = None
_pool_lock = threading.Lock()

def get_pool():
    global _pool
    with _pool_lock:
        if _pool is None or _pool.closed:
            _pool = psycopg2.pool.ThreadedConnectionPool(1, 10, DB_URL)
    return _pool

def _run(fn):
    """Executa fn(conn) com uma tentativa de reconexão em caso de conexão morta."""
    for attempt in range(2):
        pool = get_pool()
        conn = pool.getconn()
        try:
            result = fn(conn)
            pool.putconn(conn)
            return result
        except psycopg2.OperationalError:
            # Conexão morta (NeonDB encerrou idle) — descarta e tenta novamente
            try:
                pool.putconn(conn, close=True)
            except Exception:
                pass
            if attempt == 0:
                continue
            raise
        except Exception:
            try:
                conn.rollback()
                pool.putconn(conn)
            except Exception:
                pass
            raise

def db_fetch(sql, params=(), one=False):
    def fn(conn):
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchone() if one else cur.fetchall()
    return _run(fn)

def db_exec(sql, params=()):
    """Executa DML. Retorna a primeira linha (útil para RETURNING)."""
    def fn(conn):
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            conn.commit()
            try:
                row = cur.fetchone()
                return dict(row) if row else None
            except psycopg2.ProgrammingError:
                return None
    return _run(fn)

# ── Cache de Preços ───────────────────────────────────────────
_precos_cache: dict = {}
_precos_lock  = threading.Lock()

def _reload_precos():
    global _precos_cache
    rows = db_fetch('SELECT nome, preco FROM precos ORDER BY nome')
    with _precos_lock:
        _precos_cache = {r['nome']: float(r['preco']) for r in rows}

def get_precos() -> dict:
    if not _precos_cache:
        _reload_precos()
    return dict(_precos_cache)

# ── Inicialização do banco ────────────────────────────────────
def init_db(retries=12, delay=3):
    for attempt in range(retries):
        try:
            pool = get_pool()
            conn = pool.getconn()
            try:
                with conn.cursor() as cur:
                    # Tabela principal de aluguéis
                    cur.execute('''
                        CREATE TABLE IF NOT EXISTS alugueis (
                            id           SERIAL PRIMARY KEY,
                            nome         TEXT    NOT NULL,
                            contato      TEXT,
                            endereco     TEXT,
                            data_entrega TEXT,
                            itens        TEXT,
                            total        REAL    DEFAULT 0,
                            subtotal     REAL    DEFAULT 0,
                            frete        REAL    DEFAULT 0,
                            pago         INTEGER DEFAULT 0,
                            criado_em    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    ''')
                    # Migrações incrementais de colunas
                    for col, definition in [
                        ('subtotal', 'REAL DEFAULT 0'),
                        ('frete',    'REAL DEFAULT 0'),
                        ('pago',     'INTEGER DEFAULT 0'),
                        ('status',   "TEXT DEFAULT 'confirmado'"),
                        ('obs',      "TEXT DEFAULT ''"),
                    ]:
                        cur.execute(
                            f'ALTER TABLE alugueis ADD COLUMN IF NOT EXISTS {col} {definition}'
                        )
                    # Tabela de preços
                    cur.execute('''
                        CREATE TABLE IF NOT EXISTS precos (
                            nome  TEXT PRIMARY KEY,
                            preco REAL NOT NULL CHECK (preco >= 0)
                        )
                    ''')
                    # Seed: insere preços padrão se a tabela estiver vazia
                    cur.execute('SELECT COUNT(*) FROM precos')
                    count = cur.fetchone()[0]
                    if count == 0:
                        for nome, preco in PRECOS_PADRAO.items():
                            cur.execute(
                                'INSERT INTO precos (nome, preco) VALUES (%s, %s) ON CONFLICT DO NOTHING',
                                (nome, preco)
                            )
                conn.commit()
            finally:
                pool.putconn(conn)

            _reload_precos()
            print('[OK] Banco de dados pronto.')
            return
        except psycopg2.OperationalError as e:
            if attempt < retries - 1:
                print(f'  Aguardando PostgreSQL... ({attempt + 1}/{retries}) — {e}')
                time.sleep(delay)
            else:
                print('[ERRO] Nao foi possivel conectar ao PostgreSQL.')
                raise

# ── Handler HTTP ──────────────────────────────────────────────
class Handler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE / 'static'), **kwargs)

    def log_message(self, _format, *_args):
        pass  # silencia logs de acesso

    # ── Helpers ──────────────────────────────────────────────
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def send_json(self, data, status=200):
        body = _dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return json.loads(self.rfile.read(length)) if length else {}

    def _parse_id(self, segment: str):
        """Converte segmento de path para int. Retorna None se inválido."""
        try:
            return int(segment)
        except (ValueError, TypeError):
            return None

    def _calc_itens(self, itens_dict):
        precos  = get_precos()
        subtotal, itens_lista = 0.0, []
        for item, qtd in itens_dict.items():
            if not isinstance(qtd, (int, float)) or qtd <= 0:
                continue
            preco = precos.get(item, 0) or 0
            sub   = preco * qtd
            subtotal += sub
            itens_lista.append(f'{item} (x{int(qtd)}) — R$ {sub:.2f}')
        itens_str = ', '.join(itens_lista) if itens_lista else 'Nenhum item'
        return subtotal, itens_str

    # ── OPTIONS (preflight CORS) ──────────────────────────────
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    # ── GET ───────────────────────────────────────────────────
    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path

        if path in ('/', '/index.html', '/solicitar'):
            self.serve_file(BASE / 'static' / 'index.html', 'text/html')

        elif path == '/api/precos':
            self.send_json(get_precos())

        elif path == '/api/alugueis':
            rows = db_fetch('SELECT * FROM alugueis ORDER BY criado_em DESC')
            self.send_json([dict(r) for r in rows])

        elif path.startswith('/api/alugueis/'):
            aluguel_id = self._parse_id(path.split('/')[-1])
            if aluguel_id is None:
                self.send_json({'erro': 'ID inválido.'}, 400)
                return
            row = db_fetch('SELECT * FROM alugueis WHERE id = %s', (aluguel_id,), one=True)
            if row:
                self.send_json(dict(row))
            else:
                self.send_json({'erro': 'Não encontrado.'}, 404)

        else:
            super().do_GET()

    # ── POST ──────────────────────────────────────────────────
    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path

        # POST /api/precos — cria ou atualiza um item de preço
        if path == '/api/precos':
            data  = self.read_body()
            nome  = str(data.get('nome', '')).strip()
            preco = data.get('preco')
            if not nome:
                self.send_json({'erro': 'Nome é obrigatório.'}, 400)
                return
            try:
                preco = float(preco)
                if preco < 0:
                    raise ValueError
            except (TypeError, ValueError):
                self.send_json({'erro': 'Preço inválido.'}, 400)
                return
            db_exec(
                'INSERT INTO precos (nome, preco) VALUES (%s, %s) '
                'ON CONFLICT (nome) DO UPDATE SET preco = EXCLUDED.preco',
                (nome, preco)
            )
            _reload_precos()
            self.send_json({'mensagem': 'Preço salvo.', 'nome': nome, 'preco': preco}, 201)
            return

        # POST /api/alugueis — cria um aluguel
        if path == '/api/alugueis':
            data         = self.read_body()
            nome         = str(data.get('nome', '')).strip()
            contato      = str(data.get('contato', '')).strip()
            endereco     = str(data.get('endereco', '')).strip()
            data_entrega = str(data.get('data_entrega', '')).strip()
            pago         = 1 if data.get('pago') else 0
            try:
                frete = float(data.get('frete', 0) or 0)
                if frete < 0:
                    raise ValueError
            except (TypeError, ValueError):
                self.send_json({'erro': 'Frete inválido.'}, 400)
                return
            if not nome:
                self.send_json({'erro': 'Nome é obrigatório.'}, 400)
                return
            obs    = str(data.get('obs', '')).strip()
            status = str(data.get('status', 'confirmado')).strip()
            if status not in {'aguardando', 'em_negociacao', 'aguardando_pagamento', 'confirmado_parcial', 'confirmado', 'separado', 'em_entrega', 'devolvido'}:
                status = 'confirmado'
            subtotal, itens_str = self._calc_itens(data.get('itens', {}))
            total = subtotal + frete
            row = db_exec(
                '''INSERT INTO alugueis
                   (nome, contato, endereco, data_entrega, itens, subtotal, frete, total, pago, status, obs)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   RETURNING id''',
                (nome, contato, endereco, data_entrega, itens_str, subtotal, frete, total, pago, status, obs)
            )
            self.send_json({'id': row['id'], 'total': total, 'mensagem': 'Aluguel registrado!'}, 201)
            return

        self.send_json({'erro': 'Rota não encontrada.'}, 404)

    # ── PATCH ─────────────────────────────────────────────────
    def do_PATCH(self):
        path  = urllib.parse.urlparse(self.path).path
        parts = path.strip('/').split('/')

        if len(parts) < 2:
            self.send_json({'erro': 'Rota não encontrada.'}, 404)
            return

        # PATCH /api/precos/:nome — atualiza preço existente
        if parts[1] == 'precos' and len(parts) == 3:
            nome = urllib.parse.unquote(parts[2])
            data = self.read_body()
            try:
                preco = float(data.get('preco', -1))
                if preco < 0:
                    raise ValueError
            except (TypeError, ValueError):
                self.send_json({'erro': 'Preço inválido.'}, 400)
                return
            row = db_exec(
                'UPDATE precos SET preco = %s WHERE nome = %s RETURNING nome',
                (preco, nome)
            )
            if not row:
                self.send_json({'erro': 'Item não encontrado.'}, 404)
                return
            _reload_precos()
            self.send_json({'mensagem': 'Preço atualizado.', 'nome': nome, 'preco': preco})
            return

        if parts[1] != 'alugueis' or len(parts) < 3:
            self.send_json({'erro': 'Rota não encontrada.'}, 404)
            return

        aluguel_id = self._parse_id(parts[2])
        if aluguel_id is None:
            self.send_json({'erro': 'ID inválido.'}, 400)
            return

        # PATCH /api/alugueis/:id/pagamento
        if len(parts) == 4 and parts[3] == 'pagamento':
            data = self.read_body()
            pago = 1 if data.get('pago') else 0
            db_exec('UPDATE alugueis SET pago = %s WHERE id = %s', (pago, aluguel_id))
            self.send_json({'mensagem': 'Pagamento atualizado.'})
            return

        # PATCH /api/alugueis/:id/status
        if len(parts) == 4 and parts[3] == 'status':
            data   = self.read_body()
            status = str(data.get('status', '')).strip()
            valid  = {'aguardando', 'em_negociacao', 'aguardando_pagamento', 'confirmado_parcial', 'confirmado', 'separado', 'em_entrega', 'devolvido'}
            if status not in valid:
                self.send_json({'erro': f'Status inválido. Use: {", ".join(sorted(valid))}'}, 400)
                return
            db_exec('UPDATE alugueis SET status = %s WHERE id = %s', (status, aluguel_id))
            self.send_json({'mensagem': 'Status atualizado.'})
            return

        # PATCH /api/alugueis/:id — edição completa
        if len(parts) == 3:
            data         = self.read_body()
            nome         = str(data.get('nome', '')).strip()
            contato      = str(data.get('contato', '')).strip()
            endereco     = str(data.get('endereco', '')).strip()
            data_entrega = str(data.get('data_entrega', '')).strip()
            pago         = 1 if data.get('pago') else 0
            try:
                frete = float(data.get('frete', 0) or 0)
                if frete < 0:
                    raise ValueError
            except (TypeError, ValueError):
                self.send_json({'erro': 'Frete inválido.'}, 400)
                return
            if not nome:
                self.send_json({'erro': 'Nome é obrigatório.'}, 400)
                return
            obs    = str(data.get('obs', '')).strip()
            status = str(data.get('status', 'confirmado')).strip()
            if status not in {'aguardando', 'em_negociacao', 'aguardando_pagamento', 'confirmado_parcial', 'confirmado', 'separado', 'em_entrega', 'devolvido'}:
                status = 'confirmado'
            subtotal, itens_str = self._calc_itens(data.get('itens', {}))
            total = subtotal + frete
            db_exec(
                '''UPDATE alugueis
                   SET nome=%s, contato=%s, endereco=%s, data_entrega=%s,
                       itens=%s, subtotal=%s, frete=%s, total=%s, pago=%s, status=%s, obs=%s
                   WHERE id=%s''',
                (nome, contato, endereco, data_entrega,
                 itens_str, subtotal, frete, total, pago, status, obs, aluguel_id)
            )
            self.send_json({'mensagem': 'Aluguel atualizado.', 'total': total})
            return

        self.send_json({'erro': 'Rota não encontrada.'}, 404)

    # ── DELETE ────────────────────────────────────────────────
    def do_DELETE(self):
        path  = urllib.parse.urlparse(self.path).path
        parts = path.strip('/').split('/')

        # DELETE /api/precos/:nome
        if len(parts) == 3 and parts[1] == 'precos':
            nome = urllib.parse.unquote(parts[2])
            row  = db_exec('DELETE FROM precos WHERE nome = %s RETURNING nome', (nome,))
            if not row:
                self.send_json({'erro': 'Item não encontrado.'}, 404)
                return
            _reload_precos()
            self.send_json({'mensagem': 'Item excluído.'})
            return

        # DELETE /api/alugueis/:id
        if not path.startswith('/api/alugueis/'):
            self.send_json({'erro': 'Rota não encontrada.'}, 404)
            return

        aluguel_id = self._parse_id(path.split('/')[-1])
        if aluguel_id is None:
            self.send_json({'erro': 'ID inválido.'}, 400)
            return
        row = db_fetch('SELECT id FROM alugueis WHERE id = %s', (aluguel_id,), one=True)
        if not row:
            self.send_json({'erro': 'Aluguel não encontrado.'}, 404)
            return
        db_exec('DELETE FROM alugueis WHERE id = %s', (aluguel_id,))
        self.send_json({'mensagem': 'Aluguel excluído.'})

    # ── Serve arquivo estático ────────────────────────────────
    def serve_file(self, fpath, content_type):
        try:
            content = fpath.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', f'{content_type}; charset=utf-8')
            self.send_header('Content-Length', str(len(content)))
            self._cors()
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_json({'erro': 'Arquivo não encontrado.'}, 404)

# ── Inicialização ─────────────────────────────────────────────
if __name__ == '__main__':
    init_db()
    server = http.server.HTTPServer((HOST, PORT), Handler)
    print(f'Hercules Festas rodando em http://{HOST}:{PORT}')
    print('Pressione Ctrl+C para encerrar.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServidor encerrado.')
        if _pool:
            _pool.closeall()
