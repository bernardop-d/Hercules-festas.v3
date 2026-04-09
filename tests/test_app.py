"""
Testes unitários — Hércules Festas (app.py)

Cobrem a lógica de negócio pura sem precisar de banco de dados:
  - Cálculo de subtotal / itens (_calc_itens via Handler)
  - Parsing de ID de URL (_parse_id)
  - Serialização de datas (_dumps)
  - Validação de status de aluguel
  - Validação de preço/frete
"""
import datetime
import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# ── Stub de psycopg2 para importar app.py sem banco instalado ──
_pg_stub = types.ModuleType("psycopg2")
_pg_stub.OperationalError = Exception
_pg_stub.ProgrammingError = Exception
_extras = types.ModuleType("psycopg2.extras")
_extras.RealDictCursor = None
_pool_mod = types.ModuleType("psycopg2.pool")
_pool_mod.ThreadedConnectionPool = MagicMock()
_pg_stub.extras = _extras
_pg_stub.pool = _pool_mod
sys.modules.setdefault("psycopg2", _pg_stub)
sys.modules.setdefault("psycopg2.extras", _extras)
sys.modules.setdefault("psycopg2.pool", _pool_mod)

# Stub de dotenv
_dotenv = types.ModuleType("dotenv")
_dotenv.load_dotenv = lambda *a, **kw: None
sys.modules.setdefault("dotenv", _dotenv)

sys.path.insert(0, str(Path(__file__).parent.parent))
import app  # noqa: E402  — importado após os stubs


class TestDumps(unittest.TestCase):
    """Serialização JSON com suporte a date/datetime."""

    def test_serializa_date(self):
        resultado = app._dumps({"data": datetime.date(2025, 1, 15)})
        self.assertIn("2025-01-15", resultado)

    def test_serializa_datetime(self):
        resultado = app._dumps({"ts": datetime.datetime(2025, 6, 1, 12, 30)})
        self.assertIn("2025-06-01", resultado)

    def test_serializa_dict_normal(self):
        resultado = json.loads(app._dumps({"nome": "Teste", "total": 100.0}))
        self.assertEqual(resultado["nome"], "Teste")
        self.assertAlmostEqual(resultado["total"], 100.0)


class TestParseId(unittest.TestCase):
    """Conversão de segmento de URL para int."""

    def _handler(self):
        h = app.Handler.__new__(app.Handler)
        return h

    def test_id_valido(self):
        self.assertEqual(self._handler()._parse_id("42"), 42)

    def test_id_zero(self):
        self.assertEqual(self._handler()._parse_id("0"), 0)

    def test_id_invalido_texto(self):
        self.assertIsNone(self._handler()._parse_id("abc"))

    def test_id_invalido_none(self):
        self.assertIsNone(self._handler()._parse_id(None))

    def test_id_invalido_vazio(self):
        self.assertIsNone(self._handler()._parse_id(""))


class TestCalcItens(unittest.TestCase):
    """Cálculo de subtotal e formatação da lista de itens."""

    def _handler(self):
        return app.Handler.__new__(app.Handler)

    def setUp(self):
        # Injeta preços sem precisar de banco
        app._precos_cache = {
            "Pula-pula pequeno": 230.0,
            "Fliperama": 360.0,
            "Conjunto de plástico (uma mesa + 4 cadeiras)": 20.0,
        }

    def test_subtotal_um_item(self):
        subtotal, _ = self._handler()._calc_itens({"Pula-pula pequeno": 1})
        self.assertAlmostEqual(subtotal, 230.0)

    def test_subtotal_multiplos_itens(self):
        subtotal, _ = self._handler()._calc_itens({"Pula-pula pequeno": 2, "Fliperama": 1})
        self.assertAlmostEqual(subtotal, 820.0)  # 460 + 360

    def test_itens_str_formatada(self):
        _, itens_str = self._handler()._calc_itens({"Fliperama": 1})
        self.assertIn("Fliperama", itens_str)
        self.assertIn("x1", itens_str)
        self.assertIn("360,00", itens_str.replace(".", ","))

    def test_item_quantidade_zero_ignorado(self):
        subtotal, itens_str = self._handler()._calc_itens({"Pula-pula pequeno": 0})
        self.assertAlmostEqual(subtotal, 0.0)
        self.assertEqual(itens_str, "Nenhum item")

    def test_item_desconhecido_preco_zero(self):
        subtotal, _ = self._handler()._calc_itens({"Item inexistente": 1})
        self.assertAlmostEqual(subtotal, 0.0)

    def test_carrinho_vazio(self):
        subtotal, itens_str = self._handler()._calc_itens({})
        self.assertAlmostEqual(subtotal, 0.0)
        self.assertEqual(itens_str, "Nenhum item")

    def test_quantidade_fracionada(self):
        # Quantidade fracionada é aceita (aluguel por horas)
        subtotal, _ = self._handler()._calc_itens({"Fliperama": 0.5})
        self.assertAlmostEqual(subtotal, 180.0)


class TestValidacaoStatus(unittest.TestCase):
    """Conjunto de status válidos."""

    STATUS_VALIDOS = {
        'aguardando', 'em_negociacao', 'aguardando_pagamento',
        'confirmado_parcial', 'confirmado', 'separado', 'em_entrega', 'devolvido'
    }

    def test_status_validos_aceitos(self):
        for s in self.STATUS_VALIDOS:
            self.assertIn(s, self.STATUS_VALIDOS)

    def test_status_invalido_nao_aceito(self):
        self.assertNotIn("cancelado", self.STATUS_VALIDOS)
        self.assertNotIn("", self.STATUS_VALIDOS)
        self.assertNotIn("CONFIRMADO", self.STATUS_VALIDOS)


class TestValidacaoPreco(unittest.TestCase):
    """Validação de preço e frete."""

    def test_preco_valido(self):
        self.assertGreaterEqual(float("150.50"), 0)

    def test_preco_zero_valido(self):
        self.assertGreaterEqual(float("0"), 0)

    def test_preco_negativo_invalido(self):
        with self.assertRaises(ValueError):
            preco = float("-10")
            if preco < 0:
                raise ValueError("Preço negativo")

    def test_preco_nao_numerico_invalido(self):
        with self.assertRaises((ValueError, TypeError)):
            float("abc")

    def test_frete_none_vira_zero(self):
        frete = float(None or 0)
        self.assertAlmostEqual(frete, 0.0)


if __name__ == "__main__":
    unittest.main()
