"""
Hércules Festas — Sistema de Gestão de Aluguéis
Backend: Python puro (http.server + sqlite3)
Zero dependências externas. Rode com: python app.py
Autor: Bernardo Dutra
"""

import http.server
import json
import sqlite3
import os
import urllib.parse
from pathlib import Path

# ── Configuração ───────────────────────────────────────────
PORT    = 5000
BASE    = Path(__file__).parent
DB_PATH = BASE / 'alugueis.db'

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

# ── Banco de dados ─────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS alugueis (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                nome         TEXT    NOT NULL,
                contato      TEXT,
                endereco     TEXT,
                data_entrega TEXT,
                itens        TEXT,
                total        REAL    DEFAULT 0,
                criado_em    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()

# ── Handler HTTP ───────────────────────────────────────────
class Handler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE / 'static'), **kwargs)

    # ── Silencia os logs de acesso ───
    def log_message(self, format, *args):
        pass

    # ── Helpers ──────────────────────────────────────────
    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return json.loads(self.rfile.read(length)) if length else {}

    # ── GET ───────────────────────────────────────────────
    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path

        # Página principal
        if path in ('/', '/index.html'):
            self.serve_file(BASE / 'static' / 'index.html', 'text/html')

        # API: preços
        elif path == '/api/precos':
            self.send_json(PRECOS)

        # API: listar aluguéis
        elif path == '/api/alugueis':
            with get_db() as conn:
                rows = conn.execute(
                    'SELECT * FROM alugueis ORDER BY criado_em DESC'
                ).fetchall()
            self.send_json([dict(r) for r in rows])

        # API: buscar aluguel por ID
        elif path.startswith('/api/alugueis/'):
            aluguel_id = path.split('/')[-1]
            with get_db() as conn:
                row = conn.execute(
                    'SELECT * FROM alugueis WHERE id = ?', (aluguel_id,)
                ).fetchone()
            if row:
                self.send_json(dict(row))
            else:
                self.send_json({'erro': 'Não encontrado.'}, 404)

        # Arquivos estáticos (CSS, JS)
        else:
            super().do_GET()

    # ── POST ──────────────────────────────────────────────
    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path

        if path == '/api/alugueis':
            data = self.read_body()

            nome         = data.get('nome', '').strip()
            contato      = data.get('contato', '').strip()
            endereco     = data.get('endereco', '').strip()
            data_entrega = data.get('data_entrega', '').strip()
            itens_dict   = data.get('itens', {})

            if not nome:
                self.send_json({'erro': 'Nome é obrigatório.'}, 400)
                return

            total = 0.0
            itens_lista = []
            for item, qtd in itens_dict.items():
                preco = PRECOS.get(item, 0)
                if preco and qtd > 0:
                    subtotal = preco * qtd
                    total   += subtotal
                    itens_lista.append(f'{item} (x{qtd}) — R$ {subtotal:.2f}')

            itens_str = ', '.join(itens_lista) if itens_lista else 'Nenhum item'

            with get_db() as conn:
                cur = conn.execute(
                    '''INSERT INTO alugueis
                       (nome, contato, endereco, data_entrega, itens, total)
                       VALUES (?, ?, ?, ?, ?, ?)''',
                    (nome, contato, endereco, data_entrega, itens_str, total)
                )
                conn.commit()
                novo_id = cur.lastrowid

            self.send_json({'id': novo_id, 'total': total, 'mensagem': 'Aluguel registrado!'}, 201)
        else:
            self.send_json({'erro': 'Rota não encontrada.'}, 404)

    # ── DELETE ────────────────────────────────────────────
    def do_DELETE(self):
        path = urllib.parse.urlparse(self.path).path

        if path.startswith('/api/alugueis/'):
            aluguel_id = path.split('/')[-1]
            with get_db() as conn:
                row = conn.execute(
                    'SELECT id FROM alugueis WHERE id = ?', (aluguel_id,)
                ).fetchone()

                if not row:
                    self.send_json({'erro': 'Aluguel não encontrado.'}, 404)
                    return

                conn.execute('DELETE FROM alugueis WHERE id = ?', (aluguel_id,))
                conn.commit()

            self.send_json({'mensagem': 'Aluguel excluído.'})
        else:
            self.send_json({'erro': 'Rota não encontrada.'}, 404)

    # ── Serve arquivo estático ────────────────────────────
    def serve_file(self, path, content_type):
        try:
            content = path.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', f'{content_type}; charset=utf-8')
            self.send_header('Content-Length', len(content))
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_json({'erro': 'Arquivo não encontrado.'}, 404)

# ── Inicialização ──────────────────────────────────────────
if __name__ == '__main__':
    init_db()
    server = http.server.HTTPServer(('localhost', PORT), Handler)
    print(f'Hércules Festas rodando em http://localhost:{PORT}')
    print('Pressione Ctrl+C para encerrar.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServidor encerrado.')
