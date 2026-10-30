# BarbeariaShop iteration 2 regression: past/inactive booking, duration conflicts, status transitions, role mgmt, delete 409
import os
import uuid
from datetime import date, timedelta, datetime
from zoneinfo import ZoneInfo

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = ("admin@barbearia.com", "Admin@12345")
CLIENTE = ("cliente.teste@example.com", "cliente123")
TZ = ZoneInfo("America/Sao_Paulo")


def login(email, pw):
    return requests.post(f"{API}/auth/login", data={"username": email, "password": pw})


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def future_day(n=20):
    return (datetime.now(TZ).date() + timedelta(days=n)).isoformat()


@pytest.fixture(scope="module")
def admin():
    r = login(*ADMIN)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def cliente():
    r = login(*CLIENTE)
    if r.status_code != 200:
        r = requests.post(f"{API}/auth/register", json={"nome": "Cliente Teste", "email": CLIENTE[0], "password": CLIENTE[1]})
    assert r.status_code in (200, 201), r.text
    return r.json()


@pytest.fixture(scope="module")
def other_cliente():
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"nome": "TEST Other", "email": email, "password": "secret123"})
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture(scope="module")
def resources(admin):
    """Create TEST barbeiro + 60-min servico, cleaned up at end."""
    h = hdr(admin["access_token"])
    b = requests.post(f"{API}/barbeiros", json={"nome": "TEST_Barb", "galeria": ["https://x/1.jpg"]}, headers=h).json()
    s = requests.post(f"{API}/servicos", json={"nome": "TEST_Serv60", "preco": 50, "duracao_minutos": 60}, headers=h).json()
    s30 = requests.post(f"{API}/servicos", json={"nome": "TEST_Serv30", "preco": 30, "duracao_minutos": 30}, headers=h).json()
    created = []
    yield {"b": b, "s": s, "s30": s30, "created": created}
    for ag in created:
        requests.patch(f"{API}/agendamentos/{ag}/status", json={"status": "Cancelado"}, headers=h)
    requests.delete(f"{API}/servicos/{s['id']}", headers=h)
    requests.delete(f"{API}/servicos/{s30['id']}", headers=h)
    requests.delete(f"{API}/barbeiros/{b['id']}", headers=h)


def book(tok, b, s, d, h_):
    return requests.post(f"{API}/agendamentos", json={"barbeiro_id": b, "servico_id": s, "data": d, "horario": h_}, headers=hdr(tok))


# --- Booking validation ---
class TestBookingValidation:
    def test_past_date_400(self, cliente, resources):
        r = book(cliente["access_token"], resources["b"]["id"], resources["s30"]["id"], "2020-01-01", "09:00")
        assert r.status_code == 400, r.text

    def test_today_past_slot_400(self, cliente, resources):
        today = datetime.now(TZ).date().isoformat()
        r = book(cliente["access_token"], resources["b"]["id"], resources["s30"]["id"], today, "09:00")
        # 09:00 local is past unless test runs before 09:00 BRT
        if datetime.now(TZ).hour >= 9:
            assert r.status_code == 400, r.text

    def test_inactive_barber_400(self, admin, cliente):
        h = hdr(admin["access_token"])
        b = requests.post(f"{API}/barbeiros", json={"nome": "TEST_Inativo", "status": "Inativo"}, headers=h).json()
        s = requests.get(f"{API}/servicos").json()[0]
        try:
            r = book(cliente["access_token"], b["id"], s["id"], future_day(), "10:00")
            assert r.status_code == 400, r.text
        finally:
            requests.delete(f"{API}/barbeiros/{b['id']}", headers=h)

    def test_duration_conflict(self, cliente, other_cliente, resources):
        d = future_day(21)
        b, s, s30 = resources["b"]["id"], resources["s"]["id"], resources["s30"]["id"]
        r = book(cliente["access_token"], b, s, d, "14:00")
        assert r.status_code == 201, r.text
        resources["created"].append(r.json()["id"])
        # NOTE: AgendamentoOut does not expose duracao_minutos (minor)
        # 14:30 blocked by 60-min booking
        r2 = book(other_cliente["access_token"], b, s30, d, "14:30")
        assert r2.status_code == 409, r2.text
        # 13:30 with 60-min service overlaps 14:00
        r3 = book(other_cliente["access_token"], b, s, d, "13:30")
        assert r3.status_code == 409, r3.text
        # 15:00 free
        r4 = book(other_cliente["access_token"], b, s30, d, "15:00")
        assert r4.status_code == 201, r4.text
        resources["created"].append(r4.json()["id"])

    def test_horarios_duration_aware(self, resources):
        d = future_day(21)
        rows = requests.get(f"{API}/horarios", params={"barbeiro_id": resources["b"]["id"], "data": d, "servico_id": resources["s"]["id"]}).json()
        m = {x["horario"]: x["disponivel"] for x in rows}
        assert m["14:00"] is False and m["14:30"] is False
        assert m["13:30"] is False  # 60-min would overlap 14:00
        assert m["11:30"] is False  # 60-min would cross lunch break / end of morning
        assert m["18:30"] is False  # exceeds closing
        assert m["16:00"] is True

    def test_horarios_past_slots_unavailable(self, resources):
        rows = requests.get(f"{API}/horarios", params={"barbeiro_id": resources["b"]["id"], "data": "2020-01-01"}).json()
        assert all(x["disponivel"] is False for x in rows)

    def test_service_exceeds_closing_400(self, cliente, resources):
        r = book(cliente["access_token"], resources["b"]["id"], resources["s"]["id"], future_day(22), "18:30")
        assert r.status_code == 400, r.text

    def test_rebook_after_cancel(self, cliente, admin, resources):
        d = future_day(23)
        b, s30 = resources["b"]["id"], resources["s30"]["id"]
        r = book(cliente["access_token"], b, s30, d, "10:00")
        assert r.status_code == 201
        ag = r.json()["id"]
        c = requests.patch(f"{API}/agendamentos/{ag}/status", json={"status": "Cancelado"}, headers=hdr(cliente["access_token"]))
        assert c.status_code == 200 and c.json()["status"] == "Cancelado"
        r2 = book(cliente["access_token"], b, s30, d, "10:00")
        assert r2.status_code == 201, r2.text  # partial index allows rebooking
        resources["created"].append(r2.json()["id"])


# --- Status transitions ---
class TestStatusTransitions:
    def test_transitions(self, admin, cliente, other_cliente, resources):
        d = future_day(24)
        b, s30 = resources["b"]["id"], resources["s30"]["id"]
        ha, hc, ho = hdr(admin["access_token"]), hdr(cliente["access_token"]), hdr(other_cliente["access_token"])
        ag = book(cliente["access_token"], b, s30, d, "09:00").json()["id"]
        resources["created"].append(ag)
        # other cliente cannot cancel
        assert requests.patch(f"{API}/agendamentos/{ag}/status", json={"status": "Cancelado"}, headers=ho).status_code == 403
        # cliente cannot confirm
        assert requests.patch(f"{API}/agendamentos/{ag}/status", json={"status": "Confirmado"}, headers=hc).status_code == 403
        # admin confirm -> realizado
        assert requests.patch(f"{API}/agendamentos/{ag}/status", json={"status": "Confirmado"}, headers=ha).json()["status"] == "Confirmado"
        assert requests.patch(f"{API}/agendamentos/{ag}/status", json={"status": "Realizado"}, headers=ha).json()["status"] == "Realizado"
        # final
        assert requests.patch(f"{API}/agendamentos/{ag}/status", json={"status": "Cancelado"}, headers=ha).status_code == 400
        assert requests.patch(f"{API}/agendamentos/{ag}/status", json={"status": "Cancelado"}, headers=hc).status_code == 400
        # back to Pendente not allowed
        assert requests.patch(f"{API}/agendamentos/{ag}/status", json={"status": "Pendente"}, headers=ha).status_code == 400

    def test_cancelled_final(self, admin, cliente, resources):
        d = future_day(24)
        ag = book(cliente["access_token"], resources["b"]["id"], resources["s30"]["id"], d, "10:00").json()["id"]
        ha = hdr(admin["access_token"])
        assert requests.patch(f"{API}/agendamentos/{ag}/status", json={"status": "Cancelado"}, headers=ha).status_code == 200
        assert requests.patch(f"{API}/agendamentos/{ag}/status", json={"status": "Confirmado"}, headers=ha).status_code == 400

    def test_me_sorted_ascending(self, cliente):
        rows = requests.get(f"{API}/agendamentos/me", headers=hdr(cliente["access_token"])).json()
        keys = [(r["data"], r["horario"]) for r in rows]
        assert keys == sorted(keys)


# --- Admin role mgmt + delete conflicts ---
class TestAdminRoles:
    def test_role_invalid_barbeiro_400(self, admin, other_cliente):
        r = requests.patch(f"{API}/admin/users/{other_cliente['user']['id']}/role", json={"role": "barbeiro", "barbeiro_id": "nope"}, headers=hdr(admin["access_token"]))
        assert r.status_code == 400

    def test_role_promote_then_demote_clears(self, admin, other_cliente, resources):
        h = hdr(admin["access_token"])
        uid = other_cliente["user"]["id"]
        r = requests.patch(f"{API}/admin/users/{uid}/role", json={"role": "barbeiro", "barbeiro_id": resources["b"]["id"]}, headers=h)
        assert r.status_code == 200 and r.json()["barbeiro_id"] == resources["b"]["id"]
        r = requests.patch(f"{API}/admin/users/{uid}/role", json={"role": "cliente"}, headers=h)
        assert r.status_code == 200 and r.json()["role"] == "cliente" and r.json()["barbeiro_id"] is None

    def test_admin_cannot_demote_self(self, admin):
        r = requests.patch(f"{API}/admin/users/{admin['user']['id']}/role", json={"role": "cliente"}, headers=hdr(admin["access_token"]))
        assert r.status_code == 400

    def test_delete_with_active_bookings_409(self, admin, cliente, resources):
        h = hdr(admin["access_token"])
        r = book(cliente["access_token"], resources["b"]["id"], resources["s30"]["id"], future_day(25), "16:00")
        assert r.status_code == 201
        resources["created"].append(r.json()["id"])
        assert requests.delete(f"{API}/barbeiros/{resources['b']['id']}", headers=h).status_code == 409
        assert requests.delete(f"{API}/servicos/{resources['s30']['id']}", headers=h).status_code == 409


# --- Catalog data ---
class TestCatalog:
    def test_barbeiros_have_galeria(self):
        rows = requests.get(f"{API}/barbeiros").json()
        assert rows and all(isinstance(b.get("galeria"), list) for b in rows)
        seeded = [b for b in rows if not b["nome"].startswith("TEST")]
        assert any(len(b["galeria"]) > 0 for b in seeded)

    def test_product_images_reachable(self):
        rows = requests.get(f"{API}/produtos").json()
        bad = []
        for p in rows:
            u = p.get("imagem_url")
            if not u:
                bad.append((p["nome"], "empty"))
                continue
            try:
                c = requests.get(u, timeout=10, stream=True).status_code
            except Exception as e:
                c = str(e)
            if c != 200:
                bad.append((p["nome"], c))
        assert not bad, bad
