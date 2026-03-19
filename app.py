"""
Hércules Festas — Sistema de Gestão de Aluguéis
Backend: Python puro (http.server + psycopg2)
Banco de dados: PostgreSQL
Autor: Bernardo Dutra
"""

import datetime
import http.server
import json
import os
import time
import urllib.parse
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()  # carrega .env se existir

# ── Configuração ────────────────────────────────────────────
PORT   = int(os.environ.get('PORT', 5000))
HOST   = os.environ.get('HOST', '0.0.0.0')
BASE   = Path(__file__).parent
DB_URL = os.environ.get('DATABASE_URL', '')

PRECOS = {
    "Área baby (kit 1)": 200.00,
    "Área baby (kit 2)": 520.00,
    "Piscina de bolinhas": 210.00,
    "Pula-pula pequeno": 230.00,
    "Pula-pula médio": 250.00,
    "Pula-pula grande": 290.00,
    "Air game": 350.00,
    "Fliperama": 360.00,
    "Ping-pong profissional": 380.00,
    "Tamancobol": 190.00,
    "Totó": 250.00,
    "Castelinho (4h c/ monitor)": 650.00,
    "Tobogã (4h c/ monitor)": 690.00,
    "Futebol de sabão (4h c/ monitor)": 900.00,
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

# ── Serialização JSON com suporte a datetime ─────────────────
class _Encoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime.date, datetime.datetime)):
            return obj.isoformat()
        return super().default(obj)

def _dumps(data):
    return json.dumps(data, ensure_ascii=False, cls=_Encoder)

# ── Banco de dados ────────────────────────────────────────────
def get_db():
    return psycopg2.connect(DB_URL)

def db_fetch(sql, params=(), one=False):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchone() if one else cur.fetchall()
    finally:
        conn.close()

def db_exec(sql, params=()):
    """Executa um comando DML. Retorna a primeira linha (útil para RETURNING)."""
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            conn.commit()
            try:
                row = cur.fetchone()
                return dict(row) if row else None
            except psycopg2.ProgrammingError:
                return None
    finally:
        conn.close()

def init_db(retries=12, delay=3):
    """Cria a tabela e aplica migrações. Tenta reconectar se o Postgres ainda não estiver pronto."""
    for attempt in range(retries):
        try:
            conn = get_db()
            with conn.cursor() as cur:
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
                for col, definition in [
                    ('subtotal', 'REAL DEFAULT 0'),
                    ('frete',    'REAL DEFAULT 0'),
                    ('pago',     'INTEGER DEFAULT 0'),
                ]:
                    cur.execute(
                        f'ALTER TABLE alugueis ADD COLUMN IF NOT EXISTS {col} {definition}'
                    )
            conn.commit()
            conn.close()
            print('[OK] Banco de dados pronto.')
            return
        except psycopg2.OperationalError as e:
            if attempt < retries - 1:
                print(f'  Aguardando PostgreSQL... ({attempt + 1}/{retries}) — {e}')
                time.sleep(delay)
            else:
                print('[ERRO] Nao foi possivel conectar ao PostgreSQL.')
                raise

# ── Handler HTTP ─────────────────────────────────────────────
class Handler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE / 'static'), **kwargs)

    def log_message(self, format, *args):
        pass  # silencia logs de acesso

    # ── Helpers ──────────────────────────────────────────────
    def send_json(self, data, status=200):
        body = _dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return json.loads(self.rfile.read(length)) if length else {}

    def _calc_itens(self, itens_dict):
        subtotal, itens_lista = 0.0, []
        for item, qtd in itens_dict.items():
            preco = PRECOS.get(item, 0)
            if preco and qtd > 0:
                sub = preco * qtd
                subtotal += sub
                itens_lista.append(f'{item} (x{qtd}) — R$ {sub:.2f}')
        itens_str = ', '.join(itens_lista) if itens_lista else 'Nenhum item'
        return subtotal, itens_str

    # ── GET ───────────────────────────────────────────────────
    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path

        if path in ('/', '/index.html'):
            self.serve_file(BASE / 'static' / 'index.html', 'text/html')

        elif path == '/api/precos':
            self.send_json(PRECOS)

        elif path == '/api/alugueis':
            rows = db_fetch('SELECT * FROM alugueis ORDER BY criado_em DESC')
            self.send_json([dict(r) for r in rows])

        elif path.startswith('/api/alugueis/'):
            aluguel_id = path.split('/')[-1]
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

        if path != '/api/alugueis':
            self.send_json({'erro': 'Rota não encontrada.'}, 404)
            return

        data         = self.read_body()
        nome         = data.get('nome', '').strip()
        contato      = data.get('contato', '').strip()
        endereco     = data.get('endereco', '').strip()
        data_entrega = data.get('data_entrega', '').strip()
        frete        = float(data.get('frete', 0) or 0)
        pago         = 1 if data.get('pago') else 0

        if not nome:
            self.send_json({'erro': 'Nome é obrigatório.'}, 400)
            return

        subtotal, itens_str = self._calc_itens(data.get('itens', {}))
        total = subtotal + frete

        row = db_exec(
            '''INSERT INTO alugueis
               (nome, contato, endereco, data_entrega, itens, subtotal, frete, total, pago)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id''',
            (nome, contato, endereco, data_entrega, itens_str, subtotal, frete, total, pago)
        )
        self.send_json({'id': row['id'], 'total': total, 'mensagem': 'Aluguel registrado!'}, 201)

    # ── PATCH ─────────────────────────────────────────────────
    def do_PATCH(self):
        path  = urllib.parse.urlparse(self.path).path
        parts = path.strip('/').split('/')

        if len(parts) < 3 or parts[1] != 'alugueis':
            self.send_json({'erro': 'Rota não encontrada.'}, 404)
            return

        aluguel_id = parts[2]

        # PATCH /api/alugueis/:id/pagamento — toggle rápido
        if len(parts) == 4 and parts[3] == 'pagamento':
            data = self.read_body()
            pago = 1 if data.get('pago') else 0
            db_exec('UPDATE alugueis SET pago = %s WHERE id = %s', (pago, aluguel_id))
            self.send_json({'mensagem': 'Pagamento atualizado.'})
            return

        # PATCH /api/alugueis/:id — edição completa
        if len(parts) == 3:
            data         = self.read_body()
            nome         = data.get('nome', '').strip()
            contato      = data.get('contato', '').strip()
            endereco     = data.get('endereco', '').strip()
            data_entrega = data.get('data_entrega', '').strip()
            frete        = float(data.get('frete', 0) or 0)
            pago         = 1 if data.get('pago') else 0

            if not nome:
                self.send_json({'erro': 'Nome é obrigatório.'}, 400)
                return

            subtotal, itens_str = self._calc_itens(data.get('itens', {}))
            total = subtotal + frete

            db_exec(
                '''UPDATE alugueis
                   SET nome=%s, contato=%s, endereco=%s, data_entrega=%s,
                       itens=%s, subtotal=%s, frete=%s, total=%s, pago=%s
                   WHERE id=%s''',
                (nome, contato, endereco, data_entrega,
                 itens_str, subtotal, frete, total, pago, aluguel_id)
            )
            self.send_json({'mensagem': 'Aluguel atualizado.', 'total': total})
            return

        self.send_json({'erro': 'Rota não encontrada.'}, 404)

    # ── DELETE ────────────────────────────────────────────────
    def do_DELETE(self):
        path = urllib.parse.urlparse(self.path).path

        if not path.startswith('/api/alugueis/'):
            self.send_json({'erro': 'Rota não encontrada.'}, 404)
            return

        aluguel_id = path.split('/')[-1]
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
            self.send_header('Content-Length', len(content))
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_json({'erro': 'Arquivo não encontrado.'}, 404)

# ── Inicialização ─────────────────────────────────────────────
if __name__ == '__main__':
    init_db()
    server = http.server.HTTPServer((HOST, PORT), Handler)
    print(f'Hércules Festas rodando em http://{HOST}:{PORT}')
    print('Pressione Ctrl+C para encerrar.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServidor encerrado.')
