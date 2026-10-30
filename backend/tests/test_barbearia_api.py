# BarbeariaShop API regression tests: auth, CRUD, horarios, agendamentos, admin
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = ("admin@barbearia.com", "Admin@12345")
CLIENTE = ("cliente.teste@example.com", "cliente123")


def login(email, pw):
    r = requests.post(f"{API}/auth/login", data={"username": email, "password": pw})
    return r


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_tok():
    r = login(*ADMIN)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def cliente_tok():
    r = login(*CLIENTE)
    if r.status_code != 200:
        r = requests.post(f"{API}/auth/register", json={"nome": "Cliente Teste", "email": CLIENTE[0], "password": CLIENTE[1]})
        assert r.status_code == 201, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def new_user():
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"nome": "TEST_User", "email": email, "password": "senha123", "role": "admin"})
    assert r.status_code == 201, r.text
    return {"email": email, **r.json()}


# ---- Auth ----
class TestAuth:
    def test_register_role_forced_cliente(self, new_user):
        assert new_user["user"]["role"] == "cliente"
        assert new_user["access_token"]

    def test_register_duplicate_409(self, new_user):
        r = requests.post(f"{API}/auth/register", json={"nome": "Dup User", "email": new_user["email"].upper(), "password": "senha123"})
        assert r.status_code == 409

    def test_login_admin_and_me(self, admin_tok):
        r = requests.get(f"{API}/auth/me", headers=hdr(admin_tok))
        assert r.status_code == 200
        assert r.json()["role"] == "admin" and r.json()["email"] == ADMIN[0]

    def test_login_wrong_password(self):
        assert login(ADMIN[0], "wrong").status_code == 401

    def test_me_no_token(self):
        assert requests.get(f"{API}/auth/me").status_code == 401


# ---- CRUD barbeiros/servicos/produtos ----
PAYLOADS = {
    "barbeiros": {"nome": "TEST_Barbeiro", "especialidade": "Fade", "telefone": "1", "foto_url": "", "bio": "b", "status": "Ativo"},
    "servicos": {"nome": "TEST_Servico", "descricao": "d", "preco": 10.0, "duracao_minutos": 30},
    "produtos": {"nome": "TEST_Produto", "descricao": "d", "preco": 5.5, "estoque": 3},
}


@pytest.mark.parametrize("res", ["barbeiros", "servicos", "produtos"])
def test_crud_admin(res, admin_tok, cliente_tok):
    assert requests.get(f"{API}/{res}").status_code == 200
    # cliente forbidden
    assert requests.post(f"{API}/{res}", json=PAYLOADS[res], headers=hdr(cliente_tok)).status_code == 403
    assert requests.post(f"{API}/{res}", json=PAYLOADS[res]).status_code == 401
    r = requests.post(f"{API}/{res}", json=PAYLOADS[res], headers=hdr(admin_tok))
    assert r.status_code == 201, r.text
    obj = r.json()
    assert "_id" not in obj and obj["nome"] == PAYLOADS[res]["nome"]
    upd = {**PAYLOADS[res], "nome": PAYLOADS[res]["nome"] + "_UPD"}
    assert requests.put(f"{API}/{res}/{obj['id']}", json=upd, headers=hdr(cliente_tok)).status_code == 403
    r = requests.put(f"{API}/{res}/{obj['id']}", json=upd, headers=hdr(admin_tok))
    assert r.status_code == 200 and r.json()["nome"].endswith("_UPD")
    lst = requests.get(f"{API}/{res}").json()
    assert any(x["id"] == obj["id"] and x["nome"].endswith("_UPD") for x in lst)
    assert requests.delete(f"{API}/{res}/{obj['id']}", headers=hdr(cliente_tok)).status_code == 403
    assert requests.delete(f"{API}/{res}/{obj['id']}", headers=hdr(admin_tok)).status_code == 204
    assert requests.delete(f"{API}/{res}/{obj['id']}", headers=hdr(admin_tok)).status_code == 404


# ---- Horarios + Agendamentos + role flows ----
class TestAgendamentos:
    @pytest.fixture(scope="class")
    def ctx(self, admin_tok):
        b = requests.post(f"{API}/barbeiros", json={**PAYLOADS["barbeiros"], "nome": "TEST_BarbAg"}, headers=hdr(admin_tok)).json()
        s = requests.get(f"{API}/servicos").json()[0]
        d = (date.today() + timedelta(days=30)).isoformat()
        yield {"b": b, "s": s, "d": d}
        requests.delete(f"{API}/barbeiros/{b['id']}", headers=hdr(admin_tok))

    def test_full_flow(self, ctx, admin_tok, cliente_tok, new_user):
        b, s, d = ctx["b"], ctx["s"], ctx["d"]
        slots = requests.get(f"{API}/horarios", params={"barbeiro_id": b["id"], "data": d}).json()
        assert len(slots) > 0 and all(x["disponivel"] for x in slots)
        body = {"barbeiro_id": b["id"], "servico_id": s["id"], "data": d, "horario": "10:00"}
        r = requests.post(f"{API}/agendamentos", json=body, headers=hdr(cliente_tok))
        assert r.status_code == 201, r.text
        ag = r.json()
        assert ag["status"] == "Pendente" and ag["barbeiro_nome"] == "TEST_BarbAg"
        # conflict
        r2 = requests.post(f"{API}/agendamentos", json=body, headers=hdr(new_user["access_token"]))
        assert r2.status_code == 409
        slots = requests.get(f"{API}/horarios", params={"barbeiro_id": b["id"], "data": d}).json()
        assert [x for x in slots if x["horario"] == "10:00"][0]["disponivel"] is False
        # me
        me = requests.get(f"{API}/agendamentos/me", headers=hdr(cliente_tok)).json()
        assert any(x["id"] == ag["id"] for x in me)
        # other cliente cannot see / cancel
        other = requests.get(f"{API}/agendamentos", headers=hdr(new_user["access_token"])).json()
        assert all(x["id"] != ag["id"] for x in other)
        assert requests.patch(f"{API}/agendamentos/{ag['id']}/status", json={"status": "Cancelado"}, headers=hdr(new_user["access_token"])).status_code == 403
        # owner cannot confirm
        assert requests.patch(f"{API}/agendamentos/{ag['id']}/status", json={"status": "Confirmado"}, headers=hdr(cliente_tok)).status_code == 403
        # admin sees all
        all_ = requests.get(f"{API}/agendamentos", headers=hdr(admin_tok)).json()
        assert any(x["id"] == ag["id"] for x in all_)
        # promote new_user to barbeiro
        uid = new_user["user"]["id"]
        r = requests.patch(f"{API}/admin/users/{uid}/role", json={"role": "barbeiro", "barbeiro_id": b["id"]}, headers=hdr(admin_tok))
        assert r.status_code == 200 and r.json()["role"] == "barbeiro" and r.json()["barbeiro_id"] == b["id"]
        btok = login(new_user["email"], "senha123").json()["access_token"]
        agenda = requests.get(f"{API}/agendamentos", headers=hdr(btok)).json()
        assert len(agenda) >= 1 and all(x["barbeiro_id"] == b["id"] for x in agenda)
        r = requests.patch(f"{API}/agendamentos/{ag['id']}/status", json={"status": "Confirmado"}, headers=hdr(btok))
        assert r.status_code == 200 and r.json()["status"] == "Confirmado"
        # owner cancels
        r = requests.patch(f"{API}/agendamentos/{ag['id']}/status", json={"status": "Cancelado"}, headers=hdr(cliente_tok))
        assert r.status_code == 200 and r.json()["status"] == "Cancelado"
        slots = requests.get(f"{API}/horarios", params={"barbeiro_id": b["id"], "data": d}).json()
        assert [x for x in slots if x["horario"] == "10:00"][0]["disponivel"] is True

    def test_invalid_inputs(self, ctx, cliente_tok):
        b, s, d = ctx["b"], ctx["s"], ctx["d"]
        base = {"barbeiro_id": b["id"], "servico_id": s["id"], "data": d, "horario": "10:30"}
        assert requests.post(f"{API}/agendamentos", json={**base, "horario": "07:00"}, headers=hdr(cliente_tok)).status_code == 400
        assert requests.post(f"{API}/agendamentos", json={**base, "data": "31-12-2026"}, headers=hdr(cliente_tok)).status_code == 400
        assert requests.post(f"{API}/agendamentos", json={**base, "barbeiro_id": "nope"}, headers=hdr(cliente_tok)).status_code == 404
        assert requests.post(f"{API}/agendamentos", json=base).status_code == 401

    def test_past_date_booking_rejected(self, ctx, cliente_tok):
        # Business rule: should not allow booking in the past
        b, s = ctx["b"], ctx["s"]
        body = {"barbeiro_id": b["id"], "servico_id": s["id"], "data": "2020-01-01", "horario": "11:00"}
        r = requests.post(f"{API}/agendamentos", json=body, headers=hdr(cliente_tok))
        assert r.status_code in (400, 422), f"Past-date booking accepted: {r.status_code}"


# ---- Admin ----
class TestAdmin:
    def test_users_list(self, admin_tok, cliente_tok):
        r = requests.get(f"{API}/admin/users", headers=hdr(admin_tok))
        assert r.status_code == 200 and all("password_hash" not in u for u in r.json())
        assert requests.get(f"{API}/admin/users", headers=hdr(cliente_tok)).status_code == 403

    def test_stats(self, admin_tok, cliente_tok):
        r = requests.get(f"{API}/admin/stats", headers=hdr(admin_tok))
        assert r.status_code == 200
        for k in ["total_users", "total_barbeiros", "total_servicos", "total_produtos", "total_agendamentos", "agendamentos_hoje", "receita_total"]:
            assert k in r.json()
        assert requests.get(f"{API}/admin/stats", headers=hdr(cliente_tok)).status_code == 403
